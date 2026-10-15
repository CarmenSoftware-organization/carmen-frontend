# Email profile — Microsoft OAuth2 SMTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้โปรไฟล์อีเมลของ BU ส่ง SMTP ผ่านบัญชี Microsoft ได้ด้วย XOAUTH2 — Hotmail ส่วนตัว (device code flow + refresh token) และ Microsoft 365 (client credentials)

**Architecture:** micro-business เป็นเจ้าของการแลก/ต่ออายุ token (ถือ storage + encryption key ของ `email_profiles`) แล้วส่งแค่ access token ไปให้ micro-notification ซึ่งเปลี่ยน nodemailer เป็น `auth.type = 'OAuth2'` การเชื่อมต่อ Hotmail ใช้ device code flow แบบ stateless (`handle` = device_code ที่เข้ารหัส) ผ่าน endpoint ใหม่ 2 ตัวใน gateway ฝั่ง FE เพิ่มตัวเลือกวิธียืนยันตัวตนในฟอร์ม และ dialog เชื่อมต่อที่ poll สถานะ

**Tech Stack:** NestJS + Zod v4 (`zod/v4`) + Prisma (micro-business, gateway) · nodemailer 10 (micro-notification) · React 19 + react-hook-form + zod + use-intl (FE) · `@repo/secret-crypto` (`encryptSecret` / `decryptSecret` / `isEncrypted`)

**Spec:** `docs/superpowers/specs/2026-10-15-email-profile-microsoft-oauth2-design.md`

## Global Constraints

- รีโปและ branch: ทั้งสามรีโปใช้ branch `feature/email-profile-ms-oauth2`
  - FE: `carmen-inventory-frontend-react` (มีอยู่แล้ว)
  - BE: `carmen-turborepo-backend-v2` (แตกจาก `origin/main`)
  - `micro-notification` (แตกจาก `origin/main`)
- ไม่ต้องย้ายข้อมูล: โปรไฟล์ที่ไม่มี `auth_type` ให้ถือเป็น `'password'` และ payload `sendWithConfig` แบบเดิมต้องผ่านเหมือนเดิมทุกประการ
- `auth_type`: `'password' | 'oauth2_delegated' | 'oauth2_app'`
- Scope แบบ delegated: `https://outlook.office.com/SMTP.Send offline_access openid email` · scope แบบ app: `https://outlook.office365.com/.default`
- Authority: `https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/` ส่วน delegated ใช้ `tenant_id = 'consumers'` เสมอ
- Preset: Hotmail ใช้ `smtp-mail.outlook.com:587` ส่วน M365 ใช้ `smtp.office365.com:587` ทั้งคู่ `secure: false`
- Secret paths ของ `email_profiles`: `profiles.*.smtp.password`, `profiles.*.smtp.oauth.client_secret` และ `profiles.*.smtp.oauth.refresh_token`
- FE ไม่เคยเขียน `refresh_token` / `connected_account` / `connected_at` ตอน upsert backend ใช้ค่าที่เก็บไว้เสมอ
- **ห้ามเขียนเทสต์ใหม่** (ความต้องการของผู้ใช้): ข้ามทุกขั้น "write failing test" แต่ต้องรัน typecheck + lint และเทสต์ชุดเดิมให้เขียว BE ใช้ `jest` (ห้าม `bun test`)
- commit message เป็นภาษาไทย ส่วน PR เป็นภาษาอังกฤษ
- i18n (`messages/{en,th}.json`): ห้ามมี `{` `}` นอกจาก argument ของ ICU
- ลำดับ deploy: micro-notification → backend-v2 → FE

## Review Focus

ไม่มีเทสต์อัตโนมัติใหม่ (ผู้ใช้สั่ง) แต่ละข้อด้านล่างจึงผูกกับขั้นตรวจมือใน Task 10 แทน

1. **กด Save โปรไฟล์ Hotmail ที่เชื่อมต่อแล้ว (แก้แค่ `from_name`)** → refresh token ต้องยังอยู่ ถ้าฝั่ง restore พลาด การเชื่อมต่อจะหายเงียบ ๆ (Task 2, ตรวจ Task 10 ข้อ 5)
2. **บันทึกโปรไฟล์ Hotmail ใหม่ที่ยังไม่เคยเชื่อมต่อ** → ต้องบันทึกได้ ไม่ throw "no stored secret to restore" (Task 2, ตรวจ Task 10 ข้อ 2)
3. **โปรไฟล์ password เดิม (ไม่มี `auth_type`) ส่ง PO / ปุ่มทดสอบ** → ต้องทำงานเหมือนเดิม (Task 1, 2, 4 · ตรวจ Task 10 ข้อ 8)
4. **refresh token ใช้ไม่ได้ (`invalid_grant`)** → ส่ง PO ได้ error ที่บอกให้เชื่อมต่อใหม่ ไม่ใช่ 500 ทั่วไป (Task 4, ตรวจ Task 10 ข้อ 9)
5. **ปิด dialog เชื่อมต่อกลางคัน** → ต้องหยุด poll ไม่มี request ค้างยิงต่อ (Task 8, ตรวจ Task 10 ข้อ 3)

---

## File Structure

**micro-notification**
- Modify `src/email/email.service.ts` — `EmailConfig.password` เป็น optional และเพิ่ม `accessToken?` · transporter แบบ OAuth ไม่ใช้ pool และไม่เข้า cache
- Modify `src/platform-email/platform-email.service.ts` — `SmtpConfigSchema` รับ `auth_type: 'oauth2'` + `access_token`

**carmen-turborepo-backend-v2 / apps/micro-business/src/app-config/**
- Create `email-profile.schema.ts` — `EmailProfileSchema`, `EmailProfilesSchema`, type `EmailProfile`, `EmailProfileAuthType` (ย้ายออกจาก service)
- Create `microsoft-oauth.client.ts` — ฟังก์ชันล้วนที่คุยกับ Microsoft identity platform (ไม่มี DI)
- Create `email-profile-oauth.service.ts` — device login start/poll, resolve SMTP config ตอนส่ง, access-token cache, เขียน token กลับแบบ compare-and-swap
- Modify `app-config.service.ts` — import schema, secret paths, restore/identity-change, `resolveSmtpConfigForProfile`, `testEmailProfile`
- Modify `app-config.module.ts` / `app-config.controller.ts`
- Modify `../procurement/purchase-order/purchase-order.service.ts` · `../master/request-for-pricing/request-for-pricing.service.ts`

**carmen-turborepo-backend-v2 / อื่น ๆ**
- Modify `packages/rpc-contract/src/contracts/business.ts`
- Modify `apps/backend-gateway/src/config/config_app-config/config_app-config.{controller,service}.ts`
- Modify `packages/prisma-shared-schema-platform/prisma/permission.route-map.ts` แล้ว regenerate `apps/backend-gateway/src/license/license-catalog.generated.ts`

**carmen-inventory-frontend-react**
- Modify `types/email-profile.ts`, `constant/api-endpoints.ts`
- Modify `routes/system-admin/email-profile/email-profile-schema.ts`, `email-profile-dialog.tsx`, `email-profile-component.tsx`
- Create `routes/system-admin/email-profile/use-email-profile-oauth.ts`, `email-profile-oauth-dialog.tsx`
- Modify `messages/en.json`, `messages/th.json`
- Create `docs/email-profile-microsoft-oauth2.md`

---

### Task 1: micro-notification รับ OAuth2 access token

**Files:**
- Modify: `micro-notification/src/email/email.service.ts:17-26` (EmailConfig), `:157-192` (getTransporter)
- Modify: `micro-notification/src/platform-email/platform-email.service.ts` (`SmtpConfigSchema` ~`:93`, `sendWithConfig` ~`:483`)

**Interfaces:**
- Produces: payload `smtp_config` ของ RPC `notifications.send-with-config` รับได้สองรูป
  - `{ host, port, username, password, from, enabled, secure? }` (เดิม)
  - `{ host, port, username, from, enabled, secure?, auth_type: 'oauth2', access_token }` (ใหม่)

- [ ] **Step 1: แตก branch**

```bash
cd ../micro-notification && git fetch -q origin && git switch -c feature/email-profile-ms-oauth2 origin/main
```

- [ ] **Step 2: ขยาย `EmailConfig`**

ใน `src/email/email.service.ts` แทน interface เดิม:

```ts
export interface EmailConfig {
  host: string;
  port: number;
  username: string;
  /** Basic-auth password. Absent when `accessToken` is used (XOAUTH2). */
  password?: string;
  /**
   * OAuth2 access token for XOAUTH2 (Microsoft 365 / Outlook.com). Caller resolves and
   * refreshes it; this service never sees a refresh token.
   * access token สำหรับ XOAUTH2 ผู้เรียกเป็นคนแลก/ต่ออายุเอง service นี้ไม่เคยเห็น refresh token
   */
  accessToken?: string;
  from: string;
  enabled: boolean;
  secure?: boolean;
  fromName?: string;
}
```

- [ ] **Step 3: transporter แบบ OAuth ไม่ pool และไม่ cache**

ที่ต้นของ `getTransporter(config)` ก่อนคำนวณ cache key ให้เพิ่ม:

```ts
    // XOAUTH2: access token เปลี่ยนทุก ~1 ชม. ถ้าใส่ใน cache key จะได้ pool ใหม่ทุกชั่วโมงและ pool เก่า
    // ค้างในหน่วยความจำ ถ้าไม่ใส่ pool เดิมจะถือ token หมดอายุไว้ — จึงสร้าง transporter แบบไม่ pool
    // ต่อการส่งแต่ละครั้ง ปริมาณส่ง PO/RFP ไม่ถึงขั้นต้องใช้ pool
    if (config.accessToken) {
      return nodemailer.createTransport({
        host: config.host,
        port: config.port || 587,
        secure: config.secure ?? config.port === 465,
        auth: { type: 'OAuth2', user: config.username, accessToken: config.accessToken },
        connectionTimeout: CONNECTION_TIMEOUT_MS,
        socketTimeout: SOCKET_TIMEOUT_MS,
        greetingTimeout: CONNECTION_TIMEOUT_MS,
      });
    }
```

ส่วนที่เหลือไม่ต้องแก้ ใน branch password ยังใช้ `config.username && config.password` ตามเดิม แต่ตอนนี้ `password` เป็น optional แล้ว

- [ ] **Step 4: `SmtpConfigSchema` เป็น union**

ใน `src/platform-email/platform-email.service.ts` แทน `const SmtpConfigSchema = z.object({...})` ด้วย:

```ts
const SmtpConfigBase = {
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  from: z.string().min(1),
  enabled: z.boolean(),
  secure: z.boolean().optional(),
};

// ไม่มี `auth_type` = รูปเดิม (password) — ผู้เรียกเดิมทุกตัวไม่ต้องแก้อะไร
// `auth_type: 'oauth2'` = micro-business แลก access token ไว้แล้ว (XOAUTH2)
const SmtpConfigSchema = z.union([
  z.object({ ...SmtpConfigBase, auth_type: z.literal('oauth2'), access_token: z.string().min(1) }),
  z.object({ ...SmtpConfigBase, password: z.string().min(1) }),
]);
```

ใส่สาขา `oauth2` ไว้ก่อน เพราะสาขา password ไม่มี `auth_type` และ `z.object` ตัด key ที่ไม่รู้จักทิ้ง ถ้าเรียงกลับกัน payload oauth ที่บังเอิญมี `password` จะหลุดไปเข้าสาขา password

- [ ] **Step 5: ส่ง token ต่อใน `sendWithConfig`**

ในบล็อกที่ rebuild config ทีละฟิลด์ (`const smtp = parsedConfig.data;` ~`:483`) แทน object ที่ส่งเข้า `sendEmailDetailed` ด้วย:

```ts
      {
        host: smtp.host,
        port: smtp.port,
        username: smtp.username,
        password: 'password' in smtp ? smtp.password : undefined,
        accessToken: 'access_token' in smtp ? smtp.access_token : undefined,
        from: smtp.from,
        enabled: smtp.enabled,
        secure: smtp.secure,
      },
```

- [ ] **Step 6: Static checks + เทสต์เดิม**

```bash
bunx tsc --noEmit -p tsconfig.json && bunx eslint src/email/email.service.ts src/platform-email/platform-email.service.ts && bunx jest src/email src/platform-email
```

Expected: ผ่านทั้งหมด ถ้าเทสต์เดิมพัง ให้แก้ implementation ไม่ใช่แก้เทสต์ (เพราะ payload เดิมต้องผ่านเหมือนเดิม)

- [ ] **Step 7: Commit**

```bash
git add src/email/email.service.ts src/platform-email/platform-email.service.ts
git commit -m "feat(email): รับ OAuth2 access token ใน send-with-config เพื่อส่งผ่าน SMTP ของ Microsoft"
```

---

### Task 2: micro-business — schema ของโปรไฟล์ + การเก็บ secret แบบ OAuth

**Files:**
- Create: `apps/micro-business/src/app-config/email-profile.schema.ts`
- Modify: `apps/micro-business/src/app-config/app-config.service.ts` (`:105-140` schema, `:228-238` `secretPathsFor`, `:398-462` `retainMaskedEmailProfileSecrets`, `:863-865` decrypt ใน `getEmailProfileForSend`)

**Interfaces:**
- Produces (`email-profile.schema.ts`):
  - `export const EMAIL_PROFILE_AUTH_TYPES = ['password', 'oauth2_delegated', 'oauth2_app'] as const`
  - `export type EmailProfileAuthType = (typeof EMAIL_PROFILE_AUTH_TYPES)[number]`
  - `export const EmailProfileSchema`, `export const EmailProfilesSchema`, `export type EmailProfile`
  - `export function authTypeOf(profile: Pick<EmailProfile, 'smtp'>): EmailProfileAuthType`
- `getEmailProfileForSend` คืนโปรไฟล์ที่ถอดรหัส `password`, `oauth.client_secret` และ `oauth.refresh_token` แล้ว

- [ ] **Step 1: แตก branch**

```bash
cd ../carmen-turborepo-backend-v2 && git fetch -q origin && git switch -c feature/email-profile-ms-oauth2 origin/main
```

- [ ] **Step 2: สร้าง `email-profile.schema.ts`**

ย้าย `EmailProfileSchema` / `EmailProfilesSchema` / `EmailProfile` ออกจาก `app-config.service.ts` (`:105-140`) มาที่ไฟล์นี้ แล้วขยาย `smtp`:

```ts
import { z } from 'zod/v4';

/** วิธียืนยันตัวตนกับ SMTP — ไม่มีค่า = 'password' (โปรไฟล์ที่บันทึกก่อนมีฟิลด์นี้) */
export const EMAIL_PROFILE_AUTH_TYPES = ['password', 'oauth2_delegated', 'oauth2_app'] as const;
export type EmailProfileAuthType = (typeof EMAIL_PROFILE_AUTH_TYPES)[number];

/**
 * App registration ใน Microsoft Entra ของลูกค้าเอง
 * `refresh_token` / `connected_*` เขียนโดย backend (device code flow) เท่านั้น — upsert จาก FE
 * คงค่าที่เก็บไว้เสมอ (ดู AppConfigService.retainMaskedEmailProfileSecrets)
 */
const EmailProfileOAuthSchema = z.object({
  tenant_id: z.string().min(1),
  client_id: z.string().min(1),
  client_secret: z.string().optional(),
  refresh_token: z.string().optional(),
  connected_account: z.string().optional(),
  connected_at: z.string().optional(),
});

const EmailProfileSmtpSchema = z
  .object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    secure: z.boolean().default(true),
    username: z.string().min(1),
    auth_type: z.enum(EMAIL_PROFILE_AUTH_TYPES).optional(),
    password: z.string().optional(),
    oauth: EmailProfileOAuthSchema.optional(),
  })
  .superRefine((smtp, ctx) => {
    const type = smtp.auth_type ?? 'password';
    if (type === 'password' && !smtp.password) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'required for password auth' });
    }
    if (type !== 'password' && !smtp.oauth) {
      ctx.addIssue({ code: 'custom', path: ['oauth'], message: `required for ${type}` });
    }
    if (type === 'oauth2_app' && !smtp.oauth?.client_secret) {
      ctx.addIssue({
        code: 'custom',
        path: ['oauth', 'client_secret'],
        message: 'required for oauth2_app',
      });
    }
  });

/**
 * One named SMTP sender profile for a business unit. Stored inside the `email_profiles`
 * config key; secrets are encrypted at the paths `AppConfigService.secretPathsFor` lists.
 */
export const EmailProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  smtp: EmailProfileSmtpSchema,
  from_email: z.string().email(),
  from_name: z.string().default(''),
  reply_to: z.string().default(''),
  default_cc: z.array(z.string()).default([]),
  subject_template: z.string().default(''),
  body_template: z.string().default(''),
  // บันทึกภายในของผู้ดูแล ไม่เคยถูกส่งออกไปกับอีเมล — optional เพื่อให้แถวเดิมที่บันทึกก่อน
  // ฟิลด์นี้จะมีอยู่ยังอ่านผ่าน schema ได้ ไม่ต้อง migrate ข้อมูลเก่า
  note: z.string().default(''),
});

export const EmailProfilesSchema = z.object({
  default_profile_id: z.string().nullable().default(null),
  profiles: z.array(EmailProfileSchema).default([]),
});

export type EmailProfile = z.infer<typeof EmailProfileSchema>;

export function authTypeOf(profile: Pick<EmailProfile, 'smtp'>): EmailProfileAuthType {
  return profile.smtp.auth_type ?? 'password';
}
```

ให้คงคอมเมนต์ JSDoc เดิมของ schema ที่ย้ายมาไว้ด้วย ใน `app-config.service.ts` ลบบล็อกเดิมออก แล้ว import แทน:

```ts
import { EmailProfilesSchema, type EmailProfile } from './email-profile.schema';
```

และคง `export type { EmailProfile } from './email-profile.schema';` ไว้ใน `app-config.service.ts` เพราะ PO/RFP/spec อาจ import type จากที่นี่ ตรวจด้วย `grep -rn "EmailProfile" apps/micro-business/src --include=*.ts | grep import`

- [ ] **Step 3: secret paths**

ใน `secretPathsFor` แทนบรรทัด `email_profiles`:

```ts
    if (key === 'email_profiles')
      return [
        ['profiles', '*', 'smtp', 'password'],
        ['profiles', '*', 'smtp', 'oauth', 'client_secret'],
        ['profiles', '*', 'smtp', 'oauth', 'refresh_token'],
      ];
```

`mapSecrets` คืน `obj` เดิมเมื่อทางเดินไปไม่ถึง (ไม่มี `oauth`) อยู่แล้ว จึงไม่ต้องแก้

- [ ] **Step 4: เขียน `retainMaskedEmailProfileSecrets` ใหม่**

แทน body ของ method (คง JSDoc เดิมไว้ แล้วต่อท้ายด้วยย่อหน้าภาษาไทยเรื่อง OAuth ตามคอมเมนต์ในโค้ดด้านล่าง):

```ts
  private retainMaskedEmailProfileSecrets(
    key: string,
    incoming: unknown,
    stored: unknown,
  ): unknown {
    if (!incoming || typeof incoming !== 'object') return incoming;
    const incomingProfiles = (incoming as { profiles?: unknown }).profiles;
    if (!Array.isArray(incomingProfiles)) return incoming;

    type Smtp = {
      username?: unknown;
      password?: unknown;
      auth_type?: unknown;
      oauth?: Record<string, unknown>;
    };
    const storedSmtpById = new Map<string, Smtp>();
    const storedProfiles = (stored as { profiles?: unknown } | null | undefined)?.profiles;
    if (Array.isArray(storedProfiles)) {
      for (const p of storedProfiles) {
        const id = (p as { id?: unknown } | null)?.id;
        const smtp = (p as { smtp?: Smtp } | null)?.smtp;
        if (typeof id === 'string' && smtp) storedSmtpById.set(id, smtp);
      }
    }

    // mask / ค่าว่าง = "ใช้ของเดิม" · mask แต่ไม่มีของเดิมให้คืน = throw (เหตุผลเดียวกับ path ทั่วไป)
    const restoreSecret = (
      current: unknown,
      previous: unknown,
      field: string,
      id: string | undefined,
    ): unknown => {
      const prev = typeof previous === 'string' && previous ? previous : undefined;
      if (typeof current === 'string' && current.trim() === '') return prev ?? current;
      if (current !== MASK) return current;
      if (!prev) {
        throw new Error(
          `Cannot save ${key}: no stored secret to restore for profiles.*.smtp.${field} (id=${id ?? 'unknown'})`,
        );
      }
      return prev;
    };

    const profiles = incomingProfiles.map((profile) => {
      const p = profile as { id?: unknown; smtp?: Smtp } | null;
      if (!p?.smtp) return profile;
      const id = typeof p.id === 'string' ? p.id : undefined;
      const prev = id ? storedSmtpById.get(id) : undefined;
      const smtp: Smtp = { ...p.smtp };

      if (smtp.password !== undefined) {
        smtp.password = restoreSecret(smtp.password, prev?.password, 'password', id);
      }

      if (smtp.oauth) {
        const oauth = { ...smtp.oauth };
        const prevOauth = prev?.oauth;
        if (oauth.client_secret !== undefined) {
          oauth.client_secret = restoreSecret(
            oauth.client_secret,
            prevOauth?.client_secret,
            'oauth.client_secret',
            id,
          );
        }
        // refresh_token / connected_* มาจาก device code flow เท่านั้น — ไม่เชื่อค่าจาก caller
        delete oauth.refresh_token;
        delete oauth.connected_account;
        delete oauth.connected_at;
        // ตัวตนเปลี่ยน (app, tenant, mailbox หรือวิธียืนยัน) = token เดิมใช้กับตัวตนใหม่ไม่ได้ → ทิ้ง
        const sameIdentity =
          !!prevOauth &&
          (prev?.auth_type ?? 'password') === (smtp.auth_type ?? 'password') &&
          prevOauth.client_id === oauth.client_id &&
          prevOauth.tenant_id === oauth.tenant_id &&
          String(prev?.username ?? '').toLowerCase() === String(smtp.username ?? '').toLowerCase();
        if (sameIdentity) {
          if (prevOauth.refresh_token) oauth.refresh_token = prevOauth.refresh_token;
          if (prevOauth.connected_account) oauth.connected_account = prevOauth.connected_account;
          if (prevOauth.connected_at) oauth.connected_at = prevOauth.connected_at;
        }
        smtp.oauth = oauth;
      }

      return { ...(profile as Record<string, unknown>), smtp };
    });

    return { ...(incoming as Record<string, unknown>), profiles };
  }
```

หมายเหตุ: `validateValue` รันก่อน method นี้ และ `z.object` ไม่ตัด `refresh_token` ที่ FE ส่ง mask มา (เพราะอยู่ใน schema) แต่ method นี้ลบทิ้งแล้วเติมใหม่จากค่าที่เก็บไว้ ส่วน `refresh_token` ที่เติมกลับเป็นค่าที่เข้ารหัสอยู่แล้ว `encryptSensitiveFields` จึงข้ามไปเพราะ `isEncrypted`

- [ ] **Step 5: ถอดรหัส secret ใหม่ใน `getEmailProfileForSend`**

แทนบล็อกถอดรหัส (`if (isEncrypted(profile.smtp.password)) {...}`):

```ts
    const dec = (v: string | undefined) => (v && isEncrypted(v) ? decryptSecret(v) : v);
    profile.smtp.password = dec(profile.smtp.password);
    if (profile.smtp.oauth) {
      profile.smtp.oauth.client_secret = dec(profile.smtp.oauth.client_secret);
      profile.smtp.oauth.refresh_token = dec(profile.smtp.oauth.refresh_token);
    }
    return profile;
```

- [ ] **Step 6: Static checks + เทสต์เดิม**

```bash
cd apps/micro-business && bunx tsc --noEmit -p tsconfig.json && bunx eslint src/app-config && bunx jest src/app-config
```

Expected: ผ่านทั้งหมด จุดที่ tsc น่าจะฟ้อง: `profile.smtp.password` เป็น `string | undefined` ที่ PO/RFP/testEmailProfile ถ้าเจอ ใช้ `profile.smtp.password ?? ''` ชั่วคราวได้ เพราะ Task 4 จะแทนสามจุดนี้ทั้งหมดอยู่แล้ว

- [ ] **Step 7: Commit**

```bash
git add apps/micro-business/src/app-config
git commit -m "feat(app-config): email_profiles รองรับ auth_type แบบ OAuth2 และเก็บ client_secret/refresh_token เป็น secret"
```

---

### Task 3: micro-business — Microsoft identity client

**Files:**
- Create: `apps/micro-business/src/app-config/microsoft-oauth.client.ts`

**Interfaces:**
- Produces:
  - `DELEGATED_SMTP_SCOPE`, `APP_SMTP_SCOPE`, `CONSUMERS_TENANT` (const)
  - `class MicrosoftOAuthError extends Error { code: string }`
  - `requestDeviceCode(tenant: string, clientId: string): Promise<DeviceCodeResponse>`
  - `pollDeviceToken(tenant: string, clientId: string, deviceCode: string): Promise<TokenResponse>` (throws `MicrosoftOAuthError` เช่น `authorization_pending`)
  - `refreshAccessToken(tenant: string, clientId: string, refreshToken: string): Promise<TokenResponse>`
  - `clientCredentialsToken(tenant: string, clientId: string, clientSecret: string): Promise<TokenResponse>`
  - `emailFromIdToken(idToken: string | undefined): string | undefined`
  - `interface DeviceCodeResponse { device_code; user_code; verification_uri; expires_in: number; interval: number }`
  - `interface TokenResponse { access_token; expires_in: number; refresh_token?; id_token? }`

- [ ] **Step 1: เขียนไฟล์**

```ts
/**
 * Thin client for the Microsoft identity platform endpoints that SMTP XOAUTH2 needs.
 * No DI and no storage — callers own persistence and encryption.
 * ตัวเรียก endpoint ของ Microsoft identity platform ที่ SMTP XOAUTH2 ต้องใช้ ไม่มี DI และไม่เก็บอะไร
 */

export const CONSUMERS_TENANT = 'consumers';
export const DELEGATED_SMTP_SCOPE =
  'https://outlook.office.com/SMTP.Send offline_access openid email';
export const APP_SMTP_SCOPE = 'https://outlook.office365.com/.default';

const AUTHORITY = 'https://login.microsoftonline.com';
const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const TIMEOUT_MS = 15_000;

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}

/** Error body from the token endpoint; `code` is Microsoft's `error` (e.g. `invalid_grant`). */
export class MicrosoftOAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MicrosoftOAuthError';
  }
}

async function postForm<T>(tenant: string, path: string, form: Record<string, string>): Promise<T> {
  const res = await fetch(`${AUTHORITY}/${encodeURIComponent(tenant)}/oauth2/v2.0/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof body.error === 'string') {
    const code = typeof body.error === 'string' ? body.error : `http_${res.status}`;
    // error_description ของ Microsoft มีรหัส AADSTS ที่ผู้ดูแลเอาไปค้นต่อได้ — ไม่มี secret อยู่ในนั้น
    const desc =
      typeof body.error_description === 'string' ? body.error_description.split('\r\n')[0] : code;
    throw new MicrosoftOAuthError(code, desc);
  }
  return body as T;
}

export function requestDeviceCode(tenant: string, clientId: string): Promise<DeviceCodeResponse> {
  return postForm<DeviceCodeResponse>(tenant, 'devicecode', {
    client_id: clientId,
    scope: DELEGATED_SMTP_SCOPE,
  });
}

export function pollDeviceToken(
  tenant: string,
  clientId: string,
  deviceCode: string,
): Promise<TokenResponse> {
  return postForm<TokenResponse>(tenant, 'token', {
    grant_type: DEVICE_CODE_GRANT,
    client_id: clientId,
    device_code: deviceCode,
  });
}

export function refreshAccessToken(
  tenant: string,
  clientId: string,
  refreshToken: string,
): Promise<TokenResponse> {
  return postForm<TokenResponse>(tenant, 'token', {
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
    scope: DELEGATED_SMTP_SCOPE,
  });
}

export function clientCredentialsToken(
  tenant: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenResponse> {
  return postForm<TokenResponse>(tenant, 'token', {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: APP_SMTP_SCOPE,
  });
}

/**
 * Read the signed-in mailbox from an id_token. Not verified: it came straight from the token
 * endpoint over TLS in this same request, and is only used to reject a mismatched account.
 * อ่านอีเมลจาก id_token โดยไม่ตรวจลายเซ็น — ได้มาจาก token endpoint ตรง ๆ ใน request เดียวกัน
 */
export function emailFromIdToken(idToken: string | undefined): string | undefined {
  const payload = idToken?.split('.')[1];
  if (!payload) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      email?: unknown;
      preferred_username?: unknown;
    };
    const value = claims.email ?? claims.preferred_username;
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 2: Static checks**

```bash
cd apps/micro-business && bunx tsc --noEmit -p tsconfig.json && bunx eslint src/app-config/microsoft-oauth.client.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/micro-business/src/app-config/microsoft-oauth.client.ts
git commit -m "feat(app-config): เพิ่ม client เรียก Microsoft identity platform สำหรับ SMTP XOAUTH2"
```

---

### Task 4: micro-business — `EmailProfileOAuthService` + เปลี่ยนจุดส่งเมลทั้ง 3 จุด

**Files:**
- Create: `apps/micro-business/src/app-config/email-profile-oauth.service.ts`
- Modify: `apps/micro-business/src/app-config/app-config.module.ts`
- Modify: `apps/micro-business/src/app-config/app-config.service.ts` (constructor, `testEmailProfile` ~`:950-985`, method ใหม่ `resolveSmtpConfigForProfile`)
- Modify: `apps/micro-business/src/procurement/purchase-order/purchase-order.service.ts` (~`:7039-7105`)
- Modify: `apps/micro-business/src/master/request-for-pricing/request-for-pricing.service.ts` (~`:917-945`)

**Interfaces:**
- Consumes: Task 2 `EmailProfilesSchema`, `EmailProfile`, `authTypeOf` · Task 3 ทุก export
- Produces:
  - `type SmtpSendConfig = { host; port; username; from; enabled; secure?: boolean } & ({ password: string } | { auth_type: 'oauth2'; access_token: string })`
  - `class EmailProfileAuthError extends Error` (ข้อความพร้อมแสดงผู้ใช้)
  - `EmailProfileOAuthService.resolveSmtpConfig(bu_code: string, profile: EmailProfile): Promise<SmtpSendConfig>`
  - `EmailProfileOAuthService.startDeviceLogin(bu_code: string, profile_id: string): Promise<DeviceLoginStart>` โดย `DeviceLoginStart = { user_code; verification_uri; interval; expires_in; handle }`
  - `EmailProfileOAuthService.pollDeviceLogin(bu_code: string, profile_id: string, handle: string): Promise<DeviceLoginPoll>` โดย `DeviceLoginPoll = { status: 'pending' | 'slow_down' | 'connected' | 'expired' | 'denied' | 'error'; account?: string; message?: string }`
  - `AppConfigService.resolveSmtpConfigForProfile(bu_code, profile)` ส่งต่อไปที่ service ด้านบน
  - `AppConfigService.startEmailProfileOAuth(bu_code, profile_id)` / `pollEmailProfileOAuth(bu_code, profile_id, handle)`

- [ ] **Step 1: เขียน `email-profile-oauth.service.ts`**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { encryptSecret, decryptSecret, isEncrypted } from '@repo/secret-crypto';
import { TenantService } from '@/tenant/tenant.service';
import { EmailProfilesSchema, authTypeOf, type EmailProfile } from './email-profile.schema';
import {
  CONSUMERS_TENANT,
  MicrosoftOAuthError,
  clientCredentialsToken,
  emailFromIdToken,
  pollDeviceToken,
  refreshAccessToken,
  requestDeviceCode,
} from './microsoft-oauth.client';

export type SmtpSendConfig = {
  host: string;
  port: number;
  username: string;
  from: string;
  enabled: boolean;
  secure?: boolean;
} & ({ password: string } | { auth_type: 'oauth2'; access_token: string });

export interface DeviceLoginStart {
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
  handle: string;
}

export interface DeviceLoginPoll {
  status: 'pending' | 'slow_down' | 'connected' | 'expired' | 'denied' | 'error';
  account?: string;
  message?: string;
}

/** Expected, user-facing failure (misconfigured profile, needs reconnect). Message is shown as-is. */
export class EmailProfileAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailProfileAuthError';
  }
}

/** ต่ออายุก่อนหมดจริง 5 นาที — กันกรณี token หมดระหว่าง SMTP handshake */
const EXPIRY_SKEW_MS = 5 * 60 * 1000;
const WRITE_BACK_ATTEMPTS = 3;

/**
 * Owns Microsoft OAuth2 for `email_profiles`: device-code connect, access-token resolution at
 * send time (in-memory cache), and write-back of rotated refresh tokens.
 * ดูแล OAuth2 ของ Microsoft สำหรับ email_profiles — เชื่อมต่อด้วย device code, แลก access token
 * ตอนส่ง (cache ในหน่วยความจำ) และเขียน refresh token ที่หมุนแล้วกลับลง DB
 */
@Injectable()
export class EmailProfileOAuthService {
  private readonly logger = new Logger(EmailProfileOAuthService.name);
  private readonly tokenCache = new Map<string, { token: string; expiresAt: number }>();

  constructor(private readonly tenantService: TenantService) {}

  // ─── Send time ───

  async resolveSmtpConfig(bu_code: string, profile: EmailProfile): Promise<SmtpSendConfig> {
    const base = {
      host: profile.smtp.host,
      port: profile.smtp.port,
      username: profile.smtp.username,
      from: profile.from_email,
      enabled: profile.enabled,
      secure: profile.smtp.secure,
    };
    const type = authTypeOf(profile);
    if (type === 'password') {
      return { ...base, password: profile.smtp.password ?? '' };
    }
    const oauth = profile.smtp.oauth;
    if (!oauth) throw new EmailProfileAuthError(`Email profile "${profile.name}" has no OAuth settings`);

    const cacheKey = `${bu_code}|${profile.id}|${oauth.client_id}|${profile.smtp.username.toLowerCase()}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...base, auth_type: 'oauth2', access_token: cached.token };
    }

    let token: Awaited<ReturnType<typeof refreshAccessToken>>;
    try {
      if (type === 'oauth2_app') {
        token = await clientCredentialsToken(oauth.tenant_id, oauth.client_id, oauth.client_secret ?? '');
      } else {
        if (!oauth.refresh_token) {
          throw new EmailProfileAuthError(
            `Email profile "${profile.name}" is not connected to a Microsoft account yet`,
          );
        }
        token = await refreshAccessToken(oauth.tenant_id, oauth.client_id, oauth.refresh_token);
      }
    } catch (error) {
      if (error instanceof MicrosoftOAuthError) {
        if (error.code === 'invalid_grant' || error.code === 'interaction_required') {
          throw new EmailProfileAuthError(
            `Email profile "${profile.name}" must reconnect its Microsoft account (${error.message})`,
          );
        }
        throw new EmailProfileAuthError(
          `Microsoft sign-in failed for email profile "${profile.name}": ${error.message}`,
        );
      }
      throw error;
    }

    this.tokenCache.set(cacheKey, {
      token: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000 - EXPIRY_SKEW_MS,
    });

    if (type === 'oauth2_delegated' && token.refresh_token && token.refresh_token !== oauth.refresh_token) {
      // token เก่ายังใช้ได้จนครบอายุของมัน — เขียนกลับไม่สำเร็จจึงแค่ warn ไม่ทำให้การส่งพัง
      await this.writeOAuthTokens(bu_code, profile.id, { refresh_token: token.refresh_token }).catch(
        (err) =>
          this.logger.warn(
            `Could not persist rotated refresh token for ${bu_code}/${profile.id}: ${err instanceof Error ? err.message : String(err)}`,
          ),
      );
    }
    return { ...base, auth_type: 'oauth2', access_token: token.access_token };
  }

  // ─── Device code connect ───

  async startDeviceLogin(bu_code: string, profile_id: string): Promise<DeviceLoginStart> {
    const profile = await this.loadDelegatedProfile(bu_code, profile_id);
    const oauth = profile.smtp.oauth!;
    let res: Awaited<ReturnType<typeof requestDeviceCode>>;
    try {
      res = await requestDeviceCode(CONSUMERS_TENANT, oauth.client_id);
    } catch (error) {
      if (error instanceof MicrosoftOAuthError) throw new EmailProfileAuthError(error.message);
      throw error;
    }
    const handle = encryptSecret(
      JSON.stringify({
        device_code: res.device_code,
        profile_id,
        client_id: oauth.client_id,
        exp: Date.now() + res.expires_in * 1000,
      }),
    );
    return {
      user_code: res.user_code,
      verification_uri: res.verification_uri,
      interval: res.interval,
      expires_in: res.expires_in,
      handle,
    };
  }

  async pollDeviceLogin(bu_code: string, profile_id: string, handle: string): Promise<DeviceLoginPoll> {
    let state: { device_code: string; profile_id: string; client_id: string; exp: number };
    try {
      if (!isEncrypted(handle)) throw new Error('not encrypted');
      state = JSON.parse(decryptSecret(handle));
    } catch {
      return { status: 'error', message: 'Invalid sign-in session; start again' };
    }
    if (state.exp < Date.now()) return { status: 'expired' };

    const profile = await this.loadDelegatedProfile(bu_code, profile_id);
    const oauth = profile.smtp.oauth!;
    if (state.profile_id !== profile_id || state.client_id !== oauth.client_id) {
      return { status: 'error', message: 'Profile changed during sign-in; start again' };
    }

    let token: Awaited<ReturnType<typeof pollDeviceToken>>;
    try {
      token = await pollDeviceToken(CONSUMERS_TENANT, oauth.client_id, state.device_code);
    } catch (error) {
      if (!(error instanceof MicrosoftOAuthError)) throw error;
      switch (error.code) {
        case 'authorization_pending':
          return { status: 'pending' };
        case 'slow_down':
          return { status: 'slow_down' };
        case 'expired_token':
          return { status: 'expired' };
        case 'authorization_declined':
          return { status: 'denied' };
        default:
          return { status: 'error', message: error.message };
      }
    }

    const account = emailFromIdToken(token.id_token);
    if (!account || account.toLowerCase() !== profile.smtp.username.toLowerCase()) {
      return {
        status: 'error',
        account,
        message: `Signed in as ${account ?? 'an unknown account'}, but this profile sends as ${profile.smtp.username}`,
      };
    }
    if (!token.refresh_token) {
      return { status: 'error', message: 'Microsoft did not return a refresh token (offline_access missing)' };
    }

    await this.writeOAuthTokens(bu_code, profile_id, {
      refresh_token: token.refresh_token,
      connected_account: account,
      connected_at: new Date().toISOString(),
    });
    this.tokenCache.set(`${bu_code}|${profile_id}|${oauth.client_id}|${account.toLowerCase()}`, {
      token: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000 - EXPIRY_SKEW_MS,
    });
    return { status: 'connected', account };
  }

  // ─── Storage ───

  private async loadDelegatedProfile(bu_code: string, profile_id: string): Promise<EmailProfile> {
    const prisma = await this.tenantService.getdb_connection_for_external(bu_code, 'micro-notification');
    const row = await prisma.tb_application_config.findFirst({
      where: { key: 'email_profiles', deleted_at: null },
      select: { value: true },
    });
    const parsed = row ? EmailProfilesSchema.safeParse(row.value) : null;
    const profile = parsed?.success ? parsed.data.profiles.find((p) => p.id === profile_id) : undefined;
    if (!profile) throw new EmailProfileAuthError(`Email profile ${profile_id} not found; save it first`);
    if (authTypeOf(profile) !== 'oauth2_delegated' || !profile.smtp.oauth?.client_id) {
      throw new EmailProfileAuthError('Only Microsoft personal-account profiles connect by sign-in');
    }
    return profile;
  }

  /**
   * Patch only `smtp.oauth.{refresh_token, connected_*}` of one profile. Compare-and-swap on
   * `updated_at` so an admin's concurrent save is never overwritten; retries on conflict.
   * แก้เฉพาะฟิลด์ token ของโปรไฟล์เดียว ใช้ updated_at เป็นเงื่อนไข (CAS) — ไม่ทับการบันทึกของผู้ดูแล
   */
  private async writeOAuthTokens(
    bu_code: string,
    profile_id: string,
    patch: { refresh_token: string; connected_account?: string; connected_at?: string },
  ): Promise<void> {
    const prisma = await this.tenantService.getdb_connection_for_external(bu_code, 'micro-notification');
    for (let attempt = 0; attempt < WRITE_BACK_ATTEMPTS; attempt++) {
      const row = await prisma.tb_application_config.findFirst({
        where: { key: 'email_profiles', deleted_at: null },
        select: { id: true, value: true, updated_at: true },
      });
      const value = row?.value as { profiles?: Array<Record<string, any>> } | null;
      const target = value?.profiles?.find((p) => p?.id === profile_id);
      if (!row || !target?.smtp?.oauth) return; // โปรไฟล์ถูกลบหรือเปลี่ยนวิธีไปแล้ว — ไม่มีอะไรให้เขียน

      const profiles = value!.profiles!.map((p) =>
        p?.id !== profile_id
          ? p
          : {
              ...p,
              smtp: {
                ...p.smtp,
                oauth: {
                  ...p.smtp.oauth,
                  ...patch,
                  refresh_token: encryptSecret(patch.refresh_token),
                },
              },
            },
      );
      const result = await prisma.tb_application_config.updateMany({
        where: { id: row.id, updated_at: row.updated_at },
        data: { value: { ...value, profiles }, updated_at: new Date().toISOString() },
      });
      if (result.count === 1) return;
    }
    throw new Error(`write-back conflicted ${WRITE_BACK_ATTEMPTS} times`);
  }
}
```

ข้อควรระวังตอนทำ: ถ้า Prisma ไม่ยอมให้ใช้ `updated_at: null` ใน `where` ของแถวที่ไม่เคยถูกแก้ (ได้ type error) ให้ใช้ `updated_at: row.updated_at ?? null` และตรวจว่า type เป็น `Date | string | null` ตาม client ของ tenant ถ้า lint ไม่ยอมรับ `any` ให้ประกาศ type แคบ ๆ เองแทน `Record<string, any>`

- [ ] **Step 2: ลงทะเบียน provider**

`app-config.module.ts`:

```ts
import { EmailProfileOAuthService } from './email-profile-oauth.service';
// …
  providers: [AppConfigService, EmailProfileOAuthService],
```

`exports` ยังเป็น `[AppConfigService]` เหมือนเดิม เพราะ PO/RFP เรียกผ่าน AppConfigService

- [ ] **Step 3: ทางเข้าใน `AppConfigService`**

constructor:

```ts
  constructor(
    private readonly tenantService: TenantService,
    private readonly rpc: RpcClient,
    private readonly emailProfileOAuth: EmailProfileOAuthService,
  ) {}
```

ต่อท้าย class:

```ts
  /**
   * Build the `smtp_config` payload for `notifications.send-with-config` from a decrypted
   * profile — basic auth as before, or a fresh Microsoft access token for OAuth2 profiles.
   * Throws `EmailProfileAuthError` (user-facing message) when the profile must reconnect.
   * ประกอบ smtp_config จากโปรไฟล์ — ใช้ร่วมกันทั้ง PO / RFP / ปุ่มทดสอบ (เดิมเขียนแยกกัน 3 ที่)
   */
  resolveSmtpConfigForProfile(bu_code: string, profile: EmailProfile): Promise<SmtpSendConfig> {
    return this.emailProfileOAuth.resolveSmtpConfig(bu_code, profile);
  }

  startEmailProfileOAuth(bu_code: string, profile_id: string): Promise<DeviceLoginStart> {
    return this.emailProfileOAuth.startDeviceLogin(bu_code, profile_id);
  }

  pollEmailProfileOAuth(bu_code: string, profile_id: string, handle: string): Promise<DeviceLoginPoll> {
    return this.emailProfileOAuth.pollDeviceLogin(bu_code, profile_id, handle);
  }
```

พร้อม import `EmailProfileOAuthService`, `SmtpSendConfig`, `DeviceLoginStart`, `DeviceLoginPoll` จาก `./email-profile-oauth.service`

ใน `testEmailProfile` แทน object `smtp_config: { host: …, secure: profile.smtp.secure }` ด้วย:

```ts
        smtp_config: await this.resolveSmtpConfigForProfile(bu_code, profile),
```

`EmailProfileAuthError` เป็นลูกของ `Error` อยู่แล้ว `catch` เดิมจึงคืน `{ sent: false, error: msg }` ให้เอง ไม่ต้องแก้

- [ ] **Step 4: PO** (`purchase-order.service.ts`)

หลังเช็ก `!profile.enabled` (~`:7048`) ก่อนคอมเมนต์ "Past this point…" ให้เพิ่ม:

```ts
    // แลก token ก่อนแตะสถานะใด ๆ ของ PO — โปรไฟล์ที่ต้องเชื่อมต่อใหม่ต้องจบตรงนี้ด้วยข้อความที่อ่านรู้เรื่อง
    let smtpConfig: SmtpSendConfig;
    try {
      smtpConfig = await this.appConfigService.resolveSmtpConfigForProfile(this.bu_code, profile);
    } catch (error) {
      if (error instanceof EmailProfileAuthError) {
        return Result.error(error.message, ErrorCode.INVALID_ARGUMENT);
      }
      throw error;
    }
```

แล้วแทน `smtp_config: { host: …, secure: profile.smtp.secure },` (~`:7097-7105`) ด้วย `smtp_config: smtpConfig,` ลบคอมเมนต์ "Built field-by-field…" เหนือมันที่ไม่จริงแล้ว และเขียนคอมเมนต์สั้น ๆ แทนว่ามาจาก `resolveSmtpConfigForProfile` import:

```ts
import {
  EmailProfileAuthError,
  type SmtpSendConfig,
} from '@/app-config/email-profile-oauth.service';
```

(ตรวจ alias ที่ไฟล์นี้ใช้ import `AppConfigService` อยู่ แล้วใช้รูปแบบเดียวกัน)

- [ ] **Step 5: RFP** (`request-for-pricing.service.ts`)

ทำแบบเดียวกับ Step 4: เพิ่มบล็อก `try { smtpConfig = await … }` หลังเช็ก `!profile.enabled` (~`:925`) แล้วแทน object `smtp_config` (~`:934-942`) ด้วย `smtp_config: smtpConfig,`

- [ ] **Step 6: ตรวจว่าไม่เหลือจุดที่ประกอบเอง**

```bash
grep -rn "password: profile.smtp.password" apps/micro-business/src | grep -v spec.ts
```

Expected: ไม่เจออะไร

- [ ] **Step 7: Static checks + เทสต์เดิม**

```bash
cd apps/micro-business && bunx tsc --noEmit -p tsconfig.json && bunx eslint src/app-config src/procurement/purchase-order/purchase-order.service.ts src/master/request-for-pricing/request-for-pricing.service.ts && bunx jest src/app-config src/procurement/purchase-order/purchase-order.service.spec.ts src/master/request-for-pricing
```

Expected: ผ่าน เทสต์เดิมที่ mock `appConfigService` ใน PO/RFP spec จะไม่มี `resolveSmtpConfigForProfile` และพัง ให้เติม mock นั้นใน spec เดิม (เป็นการแก้ setup ของเทสต์เดิม ไม่ใช่เขียนเทสต์ใหม่):

```ts
resolveSmtpConfigForProfile: jest.fn(async (_bu, p) => ({
  host: p.smtp.host, port: p.smtp.port, username: p.smtp.username, password: p.smtp.password,
  from: p.from_email, enabled: p.enabled, secure: p.smtp.secure,
})),
```

ส่วน `app-config.service.spec` ต้องเพิ่ม provider `EmailProfileOAuthService` ใน `Test.createTestingModule` ถ้ามันสร้าง service ผ่าน DI (หรือส่ง arg ตัวที่สามถ้า `new` ตรง ๆ) โดยใช้ของจริงที่ต่อกับ tenant mock เดิม เพื่อให้ testEmailProfile ทาง password ยังผ่านเส้นทางจริง

- [ ] **Step 8: Commit**

```bash
git add apps/micro-business/src
git commit -m "feat(app-config): แลก access token ของ Microsoft ตอนส่ง PO/RFP/ทดสอบ และเชื่อมต่อบัญชีด้วย device code"
```

---

### Task 5: RPC contract + endpoint ใน gateway + license route

**Files:**
- Modify: `packages/rpc-contract/src/contracts/business.ts:20`
- Modify: `apps/micro-business/src/app-config/app-config.controller.ts` (ต่อจาก `testEmailProfile` ~`:145`)
- Modify: `apps/backend-gateway/src/config/config_app-config/config_app-config.service.ts` (~`:319`)
- Modify: `apps/backend-gateway/src/config/config_app-config/config_app-config.controller.ts` (ต่อท้าย class)
- Modify: `packages/prisma-shared-schema-platform/prisma/permission.route-map.ts:262`
- Regenerate: `apps/backend-gateway/src/license/license-catalog.generated.ts`

**Interfaces:**
- Consumes: Task 4 `AppConfigService.startEmailProfileOAuth` / `pollEmailProfileOAuth`, `EmailProfileAuthError`
- Produces (HTTP — ห่อด้วย `StdResponse` → FE อ่านที่ `.data`):
  - `POST /api/config/:bu_code/app-config/email-profile/oauth/start` body `{ profile_id }` → `DeviceLoginStart`
  - `POST /api/config/:bu_code/app-config/email-profile/oauth/poll` body `{ profile_id, handle }` → `DeviceLoginPoll`
  - `EmailProfileAuthError` → HTTP 400 พร้อมข้อความ ส่วนอย่างอื่น → 500

- [ ] **Step 1: contract**

ใน `business.ts` ต่อจาก `appConfigTestEmailProfile`:

```ts
  appConfigEmailProfileOAuthStart: rpc('appConfig.emailProfileOAuthStart', 'micro-business').restTodo(),
  appConfigEmailProfileOAuthPoll: rpc('appConfig.emailProfileOAuthPoll', 'micro-business').restTodo(),
```

ถ้าไฟล์เรียง key ตามตัวอักษร ให้แทรกในตำแหน่งที่ถูก แล้ว build contract ตามที่ package ระบุ (`cd packages/rpc-contract && bun run build` ถ้ามี script `build`)

- [ ] **Step 2: micro-business controller**

```ts
  /**
   * Start Microsoft device-code sign-in for an `oauth2_delegated` email profile
   * เริ่มเชื่อมต่อบัญชี Microsoft ด้วย device code ของโปรไฟล์แบบ oauth2_delegated
   */
  @MessagePattern(Business.appConfigEmailProfileOAuthStart.pattern)
  async emailProfileOAuthStart(data: { bu_code: string; profile_id: string }) {
    try {
      const result = await this.appConfigService.startEmailProfileOAuth(data.bu_code, data.profile_id);
      return { status: 200, data: result };
    } catch (error) {
      if (error instanceof EmailProfileAuthError) return { status: 400, error: error.message };
      return { status: 500, error: 'Email profile sign-in failed', details: errMsg(error) };
    }
  }

  /**
   * Poll a device-code sign-in started by `emailProfileOAuthStart`
   * ตรวจสถานะการเชื่อมต่อที่เริ่มจาก emailProfileOAuthStart
   */
  @MessagePattern(Business.appConfigEmailProfileOAuthPoll.pattern)
  async emailProfileOAuthPoll(data: { bu_code: string; profile_id: string; handle: string }) {
    try {
      const result = await this.appConfigService.pollEmailProfileOAuth(
        data.bu_code,
        data.profile_id,
        data.handle,
      );
      return { status: 200, data: result };
    } catch (error) {
      if (error instanceof EmailProfileAuthError) return { status: 400, error: error.message };
      return { status: 500, error: 'Email profile sign-in failed', details: errMsg(error) };
    }
  }
```

import `EmailProfileAuthError` จาก `./email-profile-oauth.service`

**สำคัญ:** `call()` ของ gateway ถือว่าอะไรที่ไม่ใช่ `okStatus` คือ error ให้ดูว่าส่ง `status: 400` แล้วกลายเป็น HTTP 400 จริงไหม โดยอ่านโค้ดต่อจาก `config_app-config.service.ts:157` ถ้ามันโยนทุกอย่างเป็น 500 ให้ map ตามที่โค้ดนั้นรองรับ (เช่นส่ง field `code` ที่ catalog รู้จัก) อย่าเดา

- [ ] **Step 3: gateway service**

ต่อจาก `testEmailProfile`:

```ts
  async emailProfileOAuthStart(bu_code: string, profile_id: string) {
    this.logger.debug({ function: 'emailProfileOAuthStart', bu_code, profile_id }, ConfigAppConfigService.name);
    return this.call(Business.appConfigEmailProfileOAuthStart, { bu_code, profile_id });
  }

  async emailProfileOAuthPoll(bu_code: string, profile_id: string, handle: string) {
    this.logger.debug({ function: 'emailProfileOAuthPoll', bu_code, profile_id }, ConfigAppConfigService.name);
    return this.call(Business.appConfigEmailProfileOAuthPoll, { bu_code, profile_id, handle });
  }
```

ห้าม log `handle` เพราะเป็น device_code ที่เข้ารหัสแล้ว และใช้แลก token ได้จนกว่าจะหมดอายุ

- [ ] **Step 4: gateway controller**

ทำตามรูปแบบของ `testEmailProfile` (`@ApiBody` / `@ApiOperation` / `@ApiParam` / `@ApiStdResponse` / `@ApiResponse`):

```ts
  @ApiBody({
    description: 'Request payload',
    examples: { default: { summary: 'Default payload', value: { profile_id: '019638a6-2a00-7c4f-8e46-9b7a52c80c4d' } } },
  })
  @Post('email-profile/oauth/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start Microsoft sign-in (device code) for an email profile',
    description:
      'Returns a user code and verification URL; the admin signs in to the profile mailbox at that URL, then the client polls `email-profile/oauth/poll`.\n\nเริ่มเชื่อมต่อบัญชี Microsoft ของโปรไฟล์อีเมลด้วย device code',
    operationId: 'configAppConfig_emailProfileOAuthStart',
  })
  @ApiParam({ name: 'bu_code', description: 'Business unit code', example: 'BU-001' })
  @ApiStdResponse(undefined, { status: 200, description: 'Device code issued' })
  @ApiResponse({ status: 400, description: 'Profile missing, not saved, or not a Microsoft personal-account profile' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  async emailProfileOAuthStart(
    @Req() req: Request,
    @Res() res: Response,
    @Param('bu_code') bu_code: string,
    @Body() body: { profile_id: string },
  ): Promise<void> {
    this.logger.debug({ function: 'emailProfileOAuthStart', bu_code, profile_id: body?.profile_id }, ConfigAppConfigController.name);
    this.respond(res, await this.appConfigService.emailProfileOAuthStart(bu_code, body?.profile_id));
  }

  @ApiBody({
    description: 'Request payload',
    examples: { default: { summary: 'Default payload', value: { profile_id: '019638a6-2a00-7c4f-8e46-9b7a52c80c4d', handle: '<opaque handle from start>' } } },
  })
  @Post('email-profile/oauth/poll')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Poll Microsoft sign-in status for an email profile',
    description:
      'Returns pending / slow_down / connected / expired / denied / error. On `connected` the refresh token is stored encrypted on the profile.\n\nตรวจสถานะการเชื่อมต่อบัญชี Microsoft',
    operationId: 'configAppConfig_emailProfileOAuthPoll',
  })
  @ApiParam({ name: 'bu_code', description: 'Business unit code', example: 'BU-001' })
  @ApiStdResponse(undefined, { status: 200, description: 'Sign-in status' })
  @ApiResponse({ status: 400, description: 'Profile missing or not a Microsoft personal-account profile' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  async emailProfileOAuthPoll(
    @Req() req: Request,
    @Res() res: Response,
    @Param('bu_code') bu_code: string,
    @Body() body: { profile_id: string; handle: string },
  ): Promise<void> {
    this.logger.debug({ function: 'emailProfileOAuthPoll', bu_code, profile_id: body?.profile_id }, ConfigAppConfigController.name);
    this.respond(res, await this.appConfigService.emailProfileOAuthPoll(bu_code, body?.profile_id, body?.handle));
  }
```

**ไม่ต้องเติม allowlist api_name:** controller นี้ใช้แค่ `@UseGuards(KeycloakGuard)` ระดับ class (`:56`) ไม่มี `AppIdGuard` ราย endpoint ให้ยืนยันด้วย `grep -n "AppIdGuard" config_app-config.controller.ts` ซึ่งต้องไม่เจออะไร ถ้าเจอ ให้หยุดแล้วแจ้ง เพราะต้องเติม allowlist ก่อน deploy

- [ ] **Step 5: license route**

route `/api/config/T02/app-config/email-profile/oauth/start` resolve เป็นคีย์ `config:app-config/email-profile` (`CONFIG_RE` ใช้แค่ segment แรกของ sub) ถ้าไม่มี override จะตกไปเป็น `configuration.app_config` ใน `permission.route-map.ts` ต่อจากบรรทัด `test-email-profile` (`:262`):

```ts
  'config:app-config/email-profile': 'configuration.email_profile',
```

แล้ว regenerate:

```bash
bun run generate:license-catalog && git diff --stat apps/backend-gateway/src/license/license-catalog.generated.ts
```

Expected: มีบรรทัดใหม่ `"config:app-config/email-profile": "configuration.email_profile"`

- [ ] **Step 6: Static checks + เทสต์เดิม**

```bash
bunx tsc --noEmit -p apps/backend-gateway/tsconfig.json && bunx tsc --noEmit -p apps/micro-business/tsconfig.json \
 && bunx eslint apps/backend-gateway/src/config/config_app-config apps/micro-business/src/app-config \
 && (cd apps/backend-gateway && bunx jest src/config/config_app-config src/license) \
 && (cd apps/micro-business && bunx jest src/app-config)
```

- [ ] **Step 7: Commit**

```bash
git add packages/rpc-contract packages/prisma-shared-schema-platform/prisma/permission.route-map.ts apps/backend-gateway apps/micro-business/src/app-config
git commit -m "feat(gateway): เพิ่ม endpoint เชื่อมต่อบัญชี Microsoft ของ email profile (device code start/poll)"
```

---

### Task 6: FE — types, schema, endpoints, hook เชื่อมต่อ

**Files:**
- Modify: `types/email-profile.ts`
- Modify: `constant/api-endpoints.ts:53-54`
- Modify: `routes/system-admin/email-profile/email-profile-schema.ts`
- Create: `routes/system-admin/email-profile/use-email-profile-oauth.ts`

**Interfaces:**
- Produces:
  - `type EmailProfileAuthType = "password" | "oauth2_delegated" | "oauth2_app"`
  - `EmailProfile.smtp.auth_type?`, `EmailProfile.smtp.password?`, `EmailProfile.smtp.oauth?: EmailProfileOAuth`
  - `authTypeOf(profile: EmailProfile): EmailProfileAuthType` · `isOAuthConnected(profile: EmailProfile): boolean`
  - `MICROSOFT_PRESETS: Record<"oauth2_delegated" | "oauth2_app", { host: string; port: number }>`
  - `API_ENDPOINTS.APP_CONFIG_EMAIL_PROFILE_OAUTH_START(buCode)` / `..._POLL(buCode)`
  - form fields: `smtp_auth_type`, `oauth_tenant_id`, `oauth_client_id`, `oauth_client_secret`
  - `useEmailProfileOAuth()` → `{ start(profileId): Promise<DeviceLoginStart>, poll(profileId, handle): Promise<DeviceLoginPoll> }`

- [ ] **Step 1: types**

`types/email-profile.ts`:

```ts
export type EmailProfileAuthType = "password" | "oauth2_delegated" | "oauth2_app";

/** App registration ใน Microsoft Entra ของลูกค้า — `refresh_token` / `connected_*` backend เขียนเอง */
export interface EmailProfileOAuth {
  tenant_id: string;
  client_id: string;
  client_secret?: string;
  refresh_token?: string;
  connected_account?: string;
  connected_at?: string;
}

export interface EmailProfile {
  id: string;
  name: string;
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    /** ไม่มี = "password" (โปรไฟล์ที่บันทึกก่อนมีฟิลด์นี้) */
    auth_type?: EmailProfileAuthType;
    password?: string;
    oauth?: EmailProfileOAuth;
  };
  from_email: string;
  from_name: string;
}

// …EmailProfilesValue, SECRET_MASK, EMAIL_PROFILES_CONFIG_KEY คงเดิม

/** Hotmail ส่วนตัว — Microsoft บังคับ tenant นี้สำหรับ personal account */
export const CONSUMERS_TENANT = "consumers";

/** host/port ของ Microsoft — ทั้งคู่เป็น STARTTLS จึงต้อง `secure: false` */
export const MICROSOFT_PRESETS = {
  oauth2_delegated: { host: "smtp-mail.outlook.com", port: 587 },
  oauth2_app: { host: "smtp.office365.com", port: 587 },
} as const;

export function authTypeOf(profile: EmailProfile): EmailProfileAuthType {
  return profile.smtp.auth_type ?? "password";
}

export function isOAuthConnected(profile: EmailProfile): boolean {
  return !!profile.smtp.oauth?.connected_at;
}

export interface DeviceLoginStart {
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
  handle: string;
}

export interface DeviceLoginPoll {
  status: "pending" | "slow_down" | "connected" | "expired" | "denied" | "error";
  account?: string;
  message?: string;
}
```

ต้องตรวจผู้ใช้ `profile.smtp.password` ใน FE ด้วย (`grep -rn "smtp.password" routes hooks components`) ผู้ใช้ที่ต้องการ `string` ให้ใช้ `?? ""`

- [ ] **Step 2: endpoints**

`constant/api-endpoints.ts` ต่อจาก `APP_CONFIG_TEST_EMAIL_PROFILE`:

```ts
  APP_CONFIG_EMAIL_PROFILE_OAUTH_START: (buCode: string) =>
    `/api/proxy/api/config/${buCode}/app-config/email-profile/oauth/start`,
  APP_CONFIG_EMAIL_PROFILE_OAUTH_POLL: (buCode: string) =>
    `/api/proxy/api/config/${buCode}/app-config/email-profile/oauth/poll`,
```

- [ ] **Step 3: form schema**

`email-profile-schema.ts` เขียนใหม่ทั้งไฟล์ (คง JSDoc เดิมของ `toEmailProfileFormValues` / `fromEmailProfileFormValues` ไว้ แล้วเพิ่มย่อหน้าเรื่อง OAuth):

```ts
import { z } from "zod";
import {
  CONSUMERS_TENANT,
  SECRET_MASK,
  authTypeOf,
  type EmailProfile,
  type EmailProfileAuthType,
} from "@/types/email-profile";

export const emailProfileSchema = z
  .object({
    name: z.string().min(1),
    enabled: z.boolean(),
    smtp_auth_type: z.enum(["password", "oauth2_delegated", "oauth2_app"]),
    smtp_host: z.string().min(1),
    smtp_port: z.coerce.number().int().min(1).max(65535),
    smtp_secure: z.boolean(),
    smtp_username: z.string().min(1),
    smtp_password: z.string(),
    oauth_tenant_id: z.string(),
    oauth_client_id: z.string(),
    oauth_client_secret: z.string(),
    from_email: z.string().email(),
    from_name: z.string(),
  })
  .superRefine((v, ctx) => {
    const required = (path: keyof typeof v) =>
      ctx.addIssue({ code: "custom", path: [path], message: "Required" });
    if (v.smtp_auth_type === "password" && !v.smtp_password) required("smtp_password");
    if (v.smtp_auth_type !== "password" && !v.oauth_client_id.trim()) required("oauth_client_id");
    if (v.smtp_auth_type === "oauth2_app") {
      if (!v.oauth_tenant_id.trim()) required("oauth_tenant_id");
      if (!v.oauth_client_secret) required("oauth_client_secret");
    }
  });

export type EmailProfileFormValues = z.infer<typeof emailProfileSchema>;

export const EMPTY_EMAIL_PROFILE_FORM: EmailProfileFormValues = {
  name: "",
  enabled: true,
  smtp_auth_type: "password",
  smtp_host: "",
  smtp_port: 587,
  smtp_secure: true,
  smtp_username: "",
  smtp_password: "",
  oauth_tenant_id: "",
  oauth_client_id: "",
  oauth_client_secret: "",
  from_email: "",
  from_name: "",
};

export function toEmailProfileFormValues(profile?: EmailProfile): EmailProfileFormValues {
  if (!profile) return { ...EMPTY_EMAIL_PROFILE_FORM };
  const type = authTypeOf(profile);
  const oauth = profile.smtp.oauth;
  return {
    name: profile.name,
    enabled: profile.enabled,
    smtp_auth_type: type,
    smtp_host: profile.smtp.host,
    smtp_port: profile.smtp.port,
    smtp_secure: profile.smtp.secure,
    smtp_username: profile.smtp.username,
    // mask = "ใช้ของเดิม" เฉพาะเมื่อมีของเดิมจริง — โปรไฟล์ OAuth ไม่มีรหัสผ่านให้คืน
    smtp_password: type === "password" ? SECRET_MASK : "",
    oauth_tenant_id: oauth?.tenant_id ?? "",
    oauth_client_id: oauth?.client_id ?? "",
    oauth_client_secret: type === "oauth2_app" && oauth?.client_secret ? SECRET_MASK : "",
    from_email: profile.from_email,
    from_name: profile.from_name,
  };
}

export function fromEmailProfileFormValues(
  values: EmailProfileFormValues,
  existing?: EmailProfile,
): EmailProfile {
  const type: EmailProfileAuthType = values.smtp_auth_type;
  return {
    id: existing?.id ?? crypto.randomUUID(),
    name: values.name,
    enabled: values.enabled,
    smtp: {
      host: values.smtp_host,
      port: values.smtp_port,
      secure: values.smtp_secure,
      username: values.smtp_username.trim(),
      auth_type: type,
      ...(type === "password" ? { password: values.smtp_password } : {}),
      ...(type === "password"
        ? {}
        : {
            // refresh_token / connected_* ไม่ส่ง — backend คงของเดิมเอง (หรือล้างถ้าตัวตนเปลี่ยน)
            oauth: {
              tenant_id: type === "oauth2_delegated" ? CONSUMERS_TENANT : values.oauth_tenant_id.trim(),
              client_id: values.oauth_client_id.trim(),
              ...(type === "oauth2_app" ? { client_secret: values.oauth_client_secret } : {}),
            },
          }),
    },
    from_email: values.from_email,
    from_name: values.from_name,
  };
}
```

- [ ] **Step 4: hook เชื่อมต่อ**

`use-email-profile-oauth.ts`:

```ts
import { useApiMutation } from "@/hooks/use-api-mutation";
import { httpClient } from "@/lib/http-client";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { DeviceLoginPoll, DeviceLoginStart } from "@/types/email-profile";

/** gateway ห่อทุกผลลัพธ์ไว้ใต้ `data` — useApiMutation คืน body ทั้งก้อน ไม่แกะให้ */
interface Envelope<T> {
  data: T;
}

/**
 * เริ่ม / ตรวจสถานะการเชื่อมต่อบัญชี Microsoft (device code) ของโปรไฟล์ `oauth2_delegated`
 *
 * poll เมื่อได้ `connected` จะ invalidate `email_profiles` (APP_CONFIGS + EMAIL_SENDERS) ให้หน้า list
 * เห็น `connected_at` ใหม่ — ตัว loop อยู่ใน dialog ไม่ใช่ที่นี่ เพื่อให้หยุดตามอายุของ dialog
 */
export function useEmailProfileOAuth() {
  const start = useApiMutation<{ profile_id: string }, Envelope<DeviceLoginStart>>({
    mutationFn: (body, buCode) =>
      httpClient.post(API_ENDPOINTS.APP_CONFIG_EMAIL_PROFILE_OAUTH_START(buCode), body),
    invalidateKeys: [],
    errorMessage: "Could not start Microsoft sign-in",
  });
  const poll = useApiMutation<{ profile_id: string; handle: string }, Envelope<DeviceLoginPoll>>({
    mutationFn: (body, buCode) =>
      httpClient.post(API_ENDPOINTS.APP_CONFIG_EMAIL_PROFILE_OAUTH_POLL(buCode), body),
    invalidateKeys: [],
    errorMessage: "Microsoft sign-in check failed",
  });
  const connected = useApiMutation<void>({
    mutationFn: async () => new Response(null, { status: 204 }),
    invalidateKeys: [QUERY_KEYS.APP_CONFIGS, QUERY_KEYS.EMAIL_SENDERS],
  });

  return {
    start: async (profileId: string) => (await start.mutateAsync({ profile_id: profileId })).data,
    poll: async (profileId: string, handle: string) =>
      (await poll.mutateAsync({ profile_id: profileId, handle })).data,
    refreshProfiles: () => connected.mutate(),
  };
}
```

ก่อนใช้ mutation หลอก `connected` ให้อ่าน `hooks/use-api-mutation.ts` ก่อนว่ามันอ่าน `res.ok` แล้วเรียก `res.json()` ไหม ถ้า 204 ทำให้ `json()` พัง ให้ใช้ `useQueryClient().invalidateQueries({ queryKey: [QUERY_KEYS.APP_CONFIGS] })` + `EMAIL_SENDERS` ตรง ๆ แทน และดูรูปของ queryKey ที่ `invalidateKeys` ใช้จริงให้ตรงกัน (อาจมี `buCode` ต่อท้าย)

- [ ] **Step 5: Static checks**

```bash
bun run typecheck && bunx eslint types/email-profile.ts constant/api-endpoints.ts routes/system-admin/email-profile
```

ถ้า typecheck ฟ้องที่ `email-profile-dialog.tsx` ว่า field ใหม่ยังไม่มีใน UI ให้ปล่อยไว้ เพราะ Task 7 จะแก้ แต่ต้องไม่มี error ที่อื่น

- [ ] **Step 6: Commit**

```bash
git add types/email-profile.ts constant/api-endpoints.ts routes/system-admin/email-profile
git commit -m "feat(email-profile): type/schema ของโปรไฟล์รองรับ OAuth2 ของ Microsoft และ hook เชื่อมต่อบัญชี"
```

---

### Task 7: FE — ฟอร์มเลือกวิธียืนยันตัวตน

**Files:**
- Modify: `routes/system-admin/email-profile/email-profile-dialog.tsx`
- Modify: `messages/en.json`, `messages/th.json` (`systemAdmin.emailProfile.dialog`)

**Interfaces:**
- Consumes: Task 6 form fields, `MICROSOFT_PRESETS`, `isOAuthConnected`, `authTypeOf`

- [ ] **Step 1: select วิธียืนยันตัวตน + preset**

ใน component เพิ่ม:

```tsx
  const authType = form.watch("smtp_auth_type");

  const changeAuthType = (next: EmailProfileAuthType) => {
    form.setValue("smtp_auth_type", next, { shouldDirty: true });
    form.clearErrors();
    if (next === "password") return;
    // เติม preset เฉพาะช่องที่ยังว่าง — ไม่เขียนทับค่าที่ผู้ใช้กรอกไว้
    const preset = MICROSOFT_PRESETS[next];
    if (!form.getValues("smtp_host").trim()) {
      form.setValue("smtp_host", preset.host, { shouldDirty: true });
      form.setValue("smtp_port", preset.port, { shouldDirty: true });
      form.setValue("smtp_secure", false, { shouldDirty: true });
    }
    if (!form.getValues("smtp_username").trim()) {
      form.setValue("smtp_username", form.getValues("from_email"), { shouldDirty: true });
    }
  };
```

ใช้ `Select` จาก `@/components/ui/select` (ดูตัวอย่างการใช้ที่มีอยู่ใน repo ด้วย `grep -rln "SelectTrigger" routes/system-admin | head -1`) วางเป็นฟิลด์แรกของ section SMTP ก่อน grid host/port:

```tsx
              <Field>
                <FieldLabel htmlFor="ep-auth-type">{t("dialog.authType")}</FieldLabel>
                <Select value={authType} onValueChange={(v) => changeAuthType(v as EmailProfileAuthType)} disabled={isSaving}>
                  <SelectTrigger id="ep-auth-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="password">{t("dialog.authPassword")}</SelectItem>
                    <SelectItem value="oauth2_delegated">{t("dialog.authMicrosoftPersonal")}</SelectItem>
                    <SelectItem value="oauth2_app">{t("dialog.authMicrosoft365")}</SelectItem>
                  </SelectContent>
                </Select>
                {authType !== "password" && (
                  <p className="text-muted-foreground text-micro">
                    {t("dialog.oauthGuideHint")}{" "}
                    <a href={OAUTH_GUIDE_URL} target="_blank" rel="noreferrer" className="underline">
                      {t("dialog.oauthGuideLink")}
                    </a>
                  </p>
                )}
              </Field>
```

`OAUTH_GUIDE_URL` เป็น const ในไฟล์นี้ ชี้ไปที่ไฟล์คู่มือใน GitHub ของรีโป:
`https://github.com/CarmenSoftware-organization/carmen-inventory-frontend-react/blob/main/docs/email-profile-microsoft-oauth2.md`

- [ ] **Step 2: แสดงช่องตามวิธี**

- ช่องรหัสผ่าน (บล็อก `Field` ของ `smtp_password` ทั้งก้อน) แสดงเฉพาะ `authType === "password"` ถ้าโปรไฟล์ที่แก้อยู่เดิมไม่ใช่ password แล้วผู้ใช้เปลี่ยนมาเป็น password ให้ตั้ง `changingPassword = true` ใน `changeAuthType` เพราะไม่มีรหัสเดิมให้ใช้ ถ้าไม่ตั้ง mask จะ throw ที่ backend
- `oauth2_delegated` และ `oauth2_app`: แสดง `oauth_client_id` (`Input`, id `ep-oauth-client-id`, label `t("dialog.clientId")`, required)
- `oauth2_app`: แสดงเพิ่ม `oauth_tenant_id` (label `t("dialog.tenantId")`, placeholder `00000000-0000-0000-0000-000000000000`) และ `oauth_client_secret` โดยใช้ UI "ตั้งไว้แล้ว / เปลี่ยน" แบบเดียวกับรหัสผ่าน (state `changingSecret` ที่เริ่มจาก `!(isEdit && profile 'oauth2_app' และมี client_secret)`) และใช้ key ข้อความ `dialog.secretIsSet`, `dialog.changeSecret`, `dialog.keepSecret`
- `oauth2_delegated` + กำลังแก้โปรไฟล์ที่มีอยู่: กล่องสถานะใต้ client_id

```tsx
                <p className="text-muted-foreground text-xs">
                  {profile && isOAuthConnected(profile)
                    ? t("dialog.oauthConnected", {
                        account: profile.smtp.oauth?.connected_account ?? "",
                      })
                    : t("dialog.oauthNotConnected")}
                </p>
```

ส่วนโปรไฟล์ใหม่ให้แสดง `t("dialog.oauthConnectAfterSave")` แทน ปุ่มเชื่อมต่ออยู่ที่แถวในหน้า list (Task 8) จึงไม่ต้องจัดการสถานะ dirty ในฟอร์ม

- `useEffect` ที่ reset ตอนเปิด dialog ให้ reset `changingSecret` ด้วย
- label ของช่อง username เมื่อเป็น OAuth ให้ใช้ `t("dialog.mailbox")` แทน `tfl("username")` เพราะ Microsoft ต้องได้อีเมลของ mailbox

- [ ] **Step 3: i18n**

`messages/en.json` ใต้ `systemAdmin.emailProfile.dialog`:

```json
"authType": "Sign-in method",
"authPassword": "Username and password",
"authMicrosoftPersonal": "Microsoft — Hotmail / Outlook.com",
"authMicrosoft365": "Microsoft 365 (organization)",
"oauthGuideHint": "Needs an app registration in Microsoft Entra.",
"oauthGuideLink": "Setup guide",
"clientId": "Application (client) ID",
"tenantId": "Directory (tenant) ID",
"clientSecret": "Client secret",
"secretIsSet": "Client secret is set",
"changeSecret": "Change secret",
"keepSecret": "Keep current secret",
"mailbox": "Mailbox (email address)",
"oauthConnected": "Connected as {account}",
"oauthNotConnected": "Not connected — use Connect in the profile list",
"oauthConnectAfterSave": "Save this profile, then connect the Microsoft account from the list"
```

`messages/th.json`:

```json
"authType": "วิธียืนยันตัวตน",
"authPassword": "ชื่อผู้ใช้และรหัสผ่าน",
"authMicrosoftPersonal": "Microsoft — Hotmail / Outlook.com",
"authMicrosoft365": "Microsoft 365 (องค์กร)",
"oauthGuideHint": "ต้องสร้าง App registration ใน Microsoft Entra ก่อน",
"oauthGuideLink": "คู่มือการตั้งค่า",
"clientId": "Application (client) ID",
"tenantId": "Directory (tenant) ID",
"clientSecret": "Client secret",
"secretIsSet": "ตั้ง client secret ไว้แล้ว",
"changeSecret": "เปลี่ยน secret",
"keepSecret": "ใช้ secret เดิม",
"mailbox": "Mailbox (อีเมล)",
"oauthConnected": "เชื่อมต่อแล้วกับ {account}",
"oauthNotConnected": "ยังไม่เชื่อมต่อ — กดเชื่อมต่อจากรายการโปรไฟล์",
"oauthConnectAfterSave": "บันทึกโปรไฟล์ก่อน แล้วเชื่อมต่อบัญชี Microsoft จากรายการ"
```

- [ ] **Step 4: Static checks**

```bash
bun run typecheck && bunx eslint routes/system-admin/email-profile && bun test:run components/ui/type-ladder.test.ts lib/__tests__
```

- [ ] **Step 5: Commit**

```bash
git add routes/system-admin/email-profile messages/en.json messages/th.json
git commit -m "feat(email-profile): ฟอร์มเลือกวิธียืนยันตัวตน รหัสผ่าน / Hotmail / Microsoft 365"
```

---

### Task 8: FE — dialog เชื่อมต่อ + ปุ่ม/badge ในหน้า list

**Files:**
- Create: `routes/system-admin/email-profile/email-profile-oauth-dialog.tsx`
- Modify: `routes/system-admin/email-profile/email-profile-component.tsx`
- Modify: `messages/en.json`, `messages/th.json` (`systemAdmin.emailProfile.oauth`)

**Interfaces:**
- Consumes: Task 6 `useEmailProfileOAuth`, `authTypeOf`, `isOAuthConnected`, `DeviceLoginStart`, `DeviceLoginPoll`
- Produces: `<EmailProfileOAuthDialog profile onOpenChange />` ซึ่ง mount เฉพาะตอนเปิด

- [ ] **Step 1: dialog**

```tsx
import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DeviceLoginStart, EmailProfile } from "@/types/email-profile";
import { useEmailProfileOAuth } from "./use-email-profile-oauth";

type Phase =
  | { kind: "starting" }
  | { kind: "waiting"; start: DeviceLoginStart }
  | { kind: "connected"; account: string }
  | { kind: "failed"; message: string };

interface EmailProfileOAuthDialogProps {
  readonly profile: EmailProfile;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * เชื่อมต่อบัญชี Hotmail ของโปรไฟล์ด้วย device code — แสดงโค้ดให้ผู้ใช้ไปกรอกที่ Microsoft
 * แล้ว poll จนได้สถานะสุดท้าย loop ผูกกับอายุ component (ตัวเรียก mount เฉพาะตอนเปิด)
 * ปิด dialog = unmount = หยุด poll ทันที ไม่มี request ค้าง
 */
export function EmailProfileOAuthDialog({ profile, onOpenChange }: EmailProfileOAuthDialogProps) {
  const t = useTranslations("systemAdmin.emailProfile.oauth");
  const tc = useTranslations("common");
  const { start, poll, refreshProfiles } = useEmailProfileOAuth();
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      let session: DeviceLoginStart;
      try {
        session = await start(profile.id);
      } catch (e) {
        if (alive.current) setPhase({ kind: "failed", message: e instanceof Error ? e.message : String(e) });
        return;
      }
      if (!alive.current) return;
      setPhase({ kind: "waiting", start: session });
      const deadline = Date.now() + session.expires_in * 1000;
      let interval = session.interval;

      const tick = async () => {
        if (!alive.current) return;
        if (Date.now() > deadline) return setPhase({ kind: "failed", message: t("expired") });
        try {
          const res = await poll(profile.id, session.handle);
          if (!alive.current) return;
          switch (res.status) {
            case "pending":
              break;
            case "slow_down":
              interval += 5;
              break;
            case "connected":
              refreshProfiles();
              return setPhase({ kind: "connected", account: res.account ?? "" });
            case "expired":
              return setPhase({ kind: "failed", message: t("expired") });
            case "denied":
              return setPhase({ kind: "failed", message: t("denied") });
            default:
              return setPhase({ kind: "failed", message: res.message ?? t("failed") });
          }
        } catch (e) {
          if (alive.current) setPhase({ kind: "failed", message: e instanceof Error ? e.message : String(e) });
          return;
        }
        timer = setTimeout(tick, interval * 1000);
      };
      timer = setTimeout(tick, interval * 1000);
    };

    void run();
    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
    };
    // attempt เปลี่ยน = ผู้ใช้กด "ลองใหม่" → เริ่ม session ใหม่
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, attempt]);

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc", { mailbox: profile.smtp.username })}</DialogDescription>
        </DialogHeader>

        {phase.kind === "starting" && (
          <div className="flex items-center gap-2 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t("starting")}
          </div>
        )}

        {phase.kind === "waiting" && (
          <div className="space-y-4 py-2">
            <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
              <li>{t("step1")}</li>
              <li>{t("step2")}</li>
              <li>{t("step3", { mailbox: profile.smtp.username })}</li>
            </ol>
            <div className="flex items-center justify-center gap-2">
              <code className="bg-muted rounded-md px-4 py-2 font-mono text-2xl tracking-widest">
                {phase.start.user_code}
              </code>
              <Button type="button" variant="outline" size="icon-sm" aria-label={t("copy")} onClick={() => copyCode(phase.start.user_code)}>
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              </Button>
            </div>
            <Button asChild className="w-full">
              <a href={phase.start.verification_uri} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden="true" />
                {t("openMicrosoft")}
              </a>
            </Button>
            <p className="text-muted-foreground flex items-center justify-center gap-2 text-xs" aria-live="polite">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              {t("waiting")}
            </p>
          </div>
        )}

        {phase.kind === "connected" && (
          <p className="text-success-ink py-6 text-sm" role="status">
            {t("connected", { account: phase.account })}
          </p>
        )}

        {phase.kind === "failed" && (
          <p className="text-destructive py-6 text-sm" role="alert">
            {phase.message}
          </p>
        )}

        <DialogFooter>
          {phase.kind === "failed" && (
            <Button type="button" variant="outline" size="sm" onClick={() => { setPhase({ kind: "starting" }); setCopied(false); setAttempt((n) => n + 1); }}>
              {t("retry")}
            </Button>
          )}
          <Button type="button" size="sm" variant={phase.kind === "connected" ? "default" : "outline"} onClick={() => onOpenChange(false)}>
            {phase.kind === "connected" ? tc("done") : tc("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

ตรวจก่อนใช้: `Button` มี `size="icon-sm"` และ `asChild` จริงไหม (`components/ui/button.tsx`) ถ้าไม่มีให้ใช้ size ที่ใกล้ที่สุด · มี key `common.done` ไหม (`grep -n '"done"' messages/en.json`) ถ้าไม่มีให้ใช้ `tc("close")` หรือเพิ่ม `oauth.done` · ESLint ของรีโปอาจมีกฎ `react-hooks/set-state-in-effect` ทุก `setPhase` ด้านบนอยู่ใน async callback จึงไม่ควรโดนจับ ถ้าโดน ห้ามปิดกฎทั้งไฟล์ ให้ย้าย logic เข้า callback แทน

- [ ] **Step 2: ปุ่มและ badge ในหน้า list**

ใน `email-profile-component.tsx`:
- state `const [connectTarget, setConnectTarget] = useState<EmailProfile | null>(null);`
- ใน cell ชื่อโปรไฟล์ ต่อจาก badge default:

```tsx
                        {authTypeOf(profile) !== "password" && (
                          <Badge variant="secondary" size="xs">
                            {authTypeOf(profile) === "oauth2_app" ? t("badgeMicrosoft365") : t("badgeMicrosoft")}
                          </Badge>
                        )}
                        {authTypeOf(profile) === "oauth2_delegated" && !isOAuthConnected(profile) && (
                          <Badge variant="warning-light" size="xs">
                            {t("badgeNotConnected")}
                          </Badge>
                        )}
```

(ตรวจ variant ที่มีจริงใน `components/ui/badge.tsx` ถ้าไม่มี `warning-light` ให้เลือก variant เตือนที่มีอยู่)
- ใน row actions ก่อนปุ่ม Send:

```tsx
                        {authTypeOf(profile) === "oauth2_delegated" && (
                          <Button variant="ghost" size="xs" onClick={() => setConnectTarget(profile)}>
                            <Link2 className="size-3" aria-hidden="true" />
                            {isOAuthConnected(profile) ? t("reconnect") : t("connect")}
                          </Button>
                        )}
```

- ท้าย JSX ข้าง test dialog:

```tsx
      {/* mount เฉพาะตอนเปิด — ปิด = unmount = poll หยุดทันที */}
      {connectTarget && (
        <EmailProfileOAuthDialog
          profile={connectTarget}
          onOpenChange={(open) => !open && setConnectTarget(null)}
        />
      )}
```

import `Link2` จาก lucide-react, `authTypeOf` / `isOAuthConnected` จาก `@/types/email-profile` และ `EmailProfileOAuthDialog`

- [ ] **Step 3: i18n**

en ใต้ `systemAdmin.emailProfile`:

```json
"badgeMicrosoft": "Microsoft",
"badgeMicrosoft365": "Microsoft 365",
"badgeNotConnected": "Not connected",
"connect": "Connect",
"reconnect": "Reconnect",
"oauth": {
  "title": "Connect Microsoft account",
  "desc": "Sign in as {mailbox} to allow Carmen to send email from it.",
  "starting": "Requesting a sign-in code…",
  "step1": "Open the Microsoft sign-in page.",
  "step2": "Enter the code below.",
  "step3": "Sign in as {mailbox} and accept the permission.",
  "copy": "Copy code",
  "openMicrosoft": "Open Microsoft sign-in",
  "waiting": "Waiting for you to finish signing in…",
  "connected": "Connected as {account}. You can send a test email now.",
  "expired": "The code expired. Try again.",
  "denied": "Permission was declined on the Microsoft page.",
  "failed": "Microsoft sign-in failed.",
  "retry": "Try again"
}
```

th:

```json
"badgeMicrosoft": "Microsoft",
"badgeMicrosoft365": "Microsoft 365",
"badgeNotConnected": "ยังไม่เชื่อมต่อ",
"connect": "เชื่อมต่อ",
"reconnect": "เชื่อมต่อใหม่",
"oauth": {
  "title": "เชื่อมต่อบัญชี Microsoft",
  "desc": "ล็อกอินด้วย {mailbox} เพื่ออนุญาตให้ Carmen ส่งอีเมลจากบัญชีนี้",
  "starting": "กำลังขอรหัสสำหรับล็อกอิน…",
  "step1": "เปิดหน้าล็อกอินของ Microsoft",
  "step2": "กรอกรหัสด้านล่าง",
  "step3": "ล็อกอินด้วย {mailbox} แล้วกดยอมรับสิทธิ์",
  "copy": "คัดลอกรหัส",
  "openMicrosoft": "เปิดหน้าล็อกอิน Microsoft",
  "waiting": "รอให้ล็อกอินให้เสร็จ…",
  "connected": "เชื่อมต่อแล้วกับ {account} ลองกดส่งอีเมลทดสอบได้เลย",
  "expired": "รหัสหมดอายุแล้ว กรุณาลองใหม่",
  "denied": "ไม่ได้กดยอมรับสิทธิ์ในหน้า Microsoft",
  "failed": "เชื่อมต่อบัญชี Microsoft ไม่สำเร็จ",
  "retry": "ลองใหม่"
}
```

- [ ] **Step 4: Static checks**

```bash
bun run typecheck && bun run lint && bun test:run routes/system-admin
```

- [ ] **Step 5: Commit**

```bash
git add routes/system-admin/email-profile messages/en.json messages/th.json
git commit -m "feat(email-profile): dialog เชื่อมต่อบัญชี Hotmail ด้วย device code และสถานะการเชื่อมต่อในรายการ"
```

---

### Task 9: คู่มือลูกค้า + ปรับ spec ให้ตรงกับแผน

**Files:**
- Create: `docs/email-profile-microsoft-oauth2.md` (FE repo)
- Modify: `docs/superpowers/specs/2026-10-15-email-profile-microsoft-oauth2-design.md`

- [ ] **Step 1: คู่มือ** — เขียนเป็นภาษาไทย มีสามหัวข้อ (เนื้อหาตาม spec §3d):

  1. **Hotmail / Outlook.com** — portal.azure.com → Microsoft Entra ID → App registrations → New registration · Supported account types: *Personal Microsoft accounts only* · Redirect URI: ไม่ต้องใส่ · Authentication → Advanced settings → **Allow public client flows: Yes** → Save · API permissions → Add → Microsoft Graph → Delegated → `SMTP.Send`, `offline_access`, `openid`, `email` · คัดลอก **Application (client) ID** มาใส่ใน Carmen → บันทึก → กด **เชื่อมต่อ** ในรายการ
  2. **Microsoft 365** — New registration (*Accounts in this organizational directory only*) · Certificates & secrets → New client secret (บันทึกวันหมดอายุไว้ เพราะต้องมาเปลี่ยนใน Carmen ก่อนหมด) · API permissions → APIs my organization uses → **Office 365 Exchange Online** → Application → `SMTP.SendAsApp` → **Grant admin consent** · Exchange Online PowerShell:
     ```powershell
     Connect-ExchangeOnline
     New-ServicePrincipal -AppId <Application (client) ID> -ObjectId <Object ID ของ Enterprise application>
     Add-MailboxPermission -Identity <mailbox@company.com> -User <Object ID เดียวกัน> -AccessRights FullAccess
     Set-CASMailbox -Identity <mailbox@company.com> -SmtpClientAuthenticationDisabled $false
     ```
     ⚠️ ObjectId ต้องมาจาก **Enterprise applications** ไม่ใช่ App registrations (เป็นคนละค่ากัน และเป็นจุดที่ตั้งผิดบ่อยที่สุด) · ใส่ tenant ID, client ID, secret และ mailbox ใน Carmen → บันทึก → กดทดสอบ
  3. **ปัญหาที่พบบ่อย** — `AADSTS7000218` → ยังไม่เปิด public client flows · `AADSTS50020`/`AADSTS9002331` → ตั้ง account types ไม่ตรงกับชนิดบัญชี · `535 5.7.3 Authentication unsuccessful` → SMTP AUTH ของ mailbox ปิดอยู่ หรือยังไม่ได้ `New-ServicePrincipal` / `Add-MailboxPermission` · "must reconnect its Microsoft account" → refresh token หมดอายุ (ไม่ได้ส่งเมล 90 วัน, เปลี่ยนรหัสผ่าน, หรือถอนสิทธิ์) ให้กด **เชื่อมต่อใหม่** · ล็อกอินด้วยบัญชีอื่นที่ไม่ใช่ mailbox ของโปรไฟล์ → ระบบปฏิเสธ ให้ล็อกอินด้วยบัญชีที่ตรงกัน

- [ ] **Step 2: แก้ spec สามจุดที่แผนตัดสินใจต่างไป**
  - §2d: `FOR UPDATE` → compare-and-swap บน `updated_at` (retry 3 ครั้ง) เพราะ Prisma ไม่มี `FOR UPDATE` ถ้าไม่ใช้ raw SQL และ CAS ให้ผลเดียวกัน
  - §3a: ปุ่มเชื่อมต่ออยู่ที่แถวในหน้า list ไม่ได้อยู่ใน dialog แก้ไข เพราะต้องบันทึกก่อนอยู่แล้ว และไม่ต้องจัดการสถานะ dirty ส่วน dialog แสดงแค่สถานะ
  - §3b: controller นี้ไม่มี `AppIdGuard` จึง**ไม่ต้องเติม allowlist api_name** แต่ต้องเพิ่ม license override `config:app-config/email-profile` (ไม่งั้นจะตกไปใช้ feature `configuration.app_config`)

- [ ] **Step 3: Commit**

```bash
git add docs/email-profile-microsoft-oauth2.md docs/superpowers/specs/2026-10-15-email-profile-microsoft-oauth2-design.md
git commit -m "docs: คู่มือตั้ง App ใน Microsoft Entra สำหรับ email profile และปรับ spec ให้ตรงกับแผน"
```

---

### Task 10: ตรวจมือแบบครบวง (local) แล้วเปิด PR

**Files:** ไม่มี (ตรวจเท่านั้น)

ก่อนเริ่ม: ตาม memory backend ที่ `:4000` คือ **dev DB ที่ใช้ร่วมกัน** ให้ backup แถว `email_profiles` ของ BU ที่จะใช้ทดสอบก่อนแก้ (`SELECT value FROM tb_application_config WHERE key='email_profiles'` แล้วเก็บไว้ใน scratchpad) และให้รัน micro-notification + micro-business + gateway จาก branch ใหม่ในเครื่อง

- [ ] **Step 1: เตรียม** — ผู้ใช้สร้าง app registration สำหรับ Hotmail ตามคู่มือ Task 9 แล้วส่ง client ID มาให้ (client ID ไม่ใช่ secret) จากนั้นรัน `VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev`

- [ ] **Step 2: ไล่เช็กตามลิสต์** (บันทึกผลทุกข้อ)
  1. สร้างโปรไฟล์ Hotmail → บันทึกผ่าน (Review Focus 2)
  2. badge "ยังไม่เชื่อมต่อ" ขึ้น → กด **เชื่อมต่อ** → ได้โค้ด → ล็อกอินที่ Microsoft → dialog ขึ้น `connected` พร้อมอีเมลที่ถูกต้อง → badge หาย
  3. เปิด dialog เชื่อมต่อแล้วปิดทันที → ดูแท็บ Network ว่าไม่มี `oauth/poll` ยิงต่อ (Review Focus 5)
  4. ปุ่มทดสอบ → เมลถึงกล่องจริง
  5. แก้ `from_name` → Save → ยังเชื่อมต่ออยู่ และปุ่มทดสอบยังส่งได้ (Review Focus 1)
  6. ส่ง PO จริง 1 ใบผ่านโปรไฟล์นี้ → ถึงผู้รับ
  7. เปลี่ยน `client_id` เป็นค่าอื่น → Save → กลับเป็น "ยังไม่เชื่อมต่อ" แล้วเปลี่ยนกลับและเชื่อมต่อใหม่
  8. ล็อกอินด้วยบัญชี Microsoft อื่นที่ไม่ตรงกับ mailbox → ได้ข้อความปฏิเสธ
  9. โปรไฟล์ password เดิม → ปุ่มทดสอบส่งได้เหมือนเดิม (Review Focus 3)
  10. ทำให้ token พังโดยแก้ DB ให้ `refresh_token` เป็นค่าที่เข้ารหัสจากสตริงขยะ (`encryptSecret('x')` ผ่านสคริปต์ bun สั้น ๆ ใน micro-business) แล้วรีสตาร์ท micro-business เพื่อล้าง cache → ปุ่มทดสอบ / ส่ง PO ได้ข้อความ "must reconnect" (Review Focus 4) → เชื่อมต่อใหม่เพื่อกู้
  11. คืนค่า `email_profiles` จาก backup ถ้าจำเป็น

- [ ] **Step 3: PR (ภาษาอังกฤษ) ครบ 3 รีโป** — แต่ละใบต้องระบุ: ลำดับ deploy (micro-notification → backend-v2 → FE) · ใบ BE ต้องบอกว่าต้องตั้ง `SECRET_ENCRYPTION_KEY` (มีอยู่แล้วในทุก env ที่ใช้ email profile) · ใบ FE/BE เขียนตรง ๆ ว่า **M365 (`oauth2_app`) ยังไม่ได้ทดสอบมือ เพราะไม่มี tenant ทดสอบ** · ไม่ต้องเติม allowlist api_name (ให้เหตุผลตาม Task 5 Step 4)
