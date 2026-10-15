# Email profile — ส่งผ่าน SMTP ของ Microsoft ด้วย OAuth2 — design

วันที่: 2026-10-15 · รีโป: `carmen-inventory-frontend-react` (FE) + `carmen-turborepo-backend-v2` (BE:
micro-business + backend-gateway) + `micro-notification`

## ปัญหา

หน้า `/system-admin/email-profile` (app-config key `email_profiles` ต่อ BU ใช้ส่ง PO / RFP) รองรับ
SMTP แบบ username + password เท่านั้น Microsoft ปิด basic auth ของ SMTP สำหรับบัญชี
Outlook.com / Hotmail ส่วนตัวแล้ว และกำลังทยอยปิดฝั่ง Exchange Online ด้วย ลูกค้าที่ใช้บัญชี
Microsoft จึงตั้งโปรไฟล์ส่งเมลไม่ได้ ต้องใช้ XOAUTH2 แทน

## เป้าหมาย / ไม่ใช่เป้าหมาย

- **ทำ:** โปรไฟล์ของ BU เลือกวิธียืนยันตัวตนได้ 3 แบบ
  - `password` — แบบเดิม
  - `oauth2_delegated` — Hotmail / Outlook.com ส่วนตัว ใช้ device code flow ให้เจ้าของบัญชีกด
    consent ครั้งเดียว แล้วเก็บ refresh token
  - `oauth2_app` — Microsoft 365 ขององค์กร ใช้ client credentials (app-only) ไม่ต้องให้ใครกด consent ต่อบัญชี
- **ทำ:** ใช้กับทุกเส้นทางที่ส่งผ่านโปรไฟล์ (ส่ง PO, ส่ง RFP, ปุ่มทดสอบ)
- **ไม่ทำ:** โปรไฟล์ผู้ส่งระดับ platform (`tb_email_sender_profile` / carmen-platform) — ฝั่ง
  micro-notification ออกแบบให้ platform มาใช้ต่อได้ภายหลัง
- **ไม่ทำ:** `report_email` (config SMTP เดี่ยวของ BU)
- **ไม่ทำ:** OAuth ของผู้ให้บริการอื่น (Gmail ฯลฯ) — `auth_type` เปิดทางไว้ แต่ไม่ทำรอบนี้
- **ไม่ทำ:** Microsoft Graph `sendMail` — ยังส่งผ่าน SMTP เหมือนเดิม

## การตัดสินใจ

| เรื่อง | เลือก | เหตุผล |
|---|---|---|
| ชนิดบัญชี | ทั้ง Hotmail ส่วนตัว และ M365 องค์กร | ลูกค้ามีทั้งสองแบบ |
| เจ้าของ App registration (Entra) | ลูกค้ากรอก client_id / secret เองต่อโปรไฟล์ | ไม่ต้องผ่าน publisher verification · ไม่มี secret กลางที่ถ้าหลุดจะกระทบทุกลูกค้า |
| วิธี consent ของ Hotmail | **device code flow** | ไม่ต้องมี redirect URI — FE เป็น SPA ไม่มี server และมีหลายโดเมน (Vercel / GCS / Docker ของลูกค้า) · ไม่ต้องใช้ client_secret |
| ที่แลก / ต่ออายุ token | micro-business | ถือ storage + encryption key ของ `email_profiles` อยู่แล้ว · micro-notification รับแค่ access token |
| state ระหว่าง poll | stateless — `handle` = `device_code` ที่ `encryptSecret` แล้ว | ไม่พังเมื่อ micro-business มีหลาย instance · FE ไม่เห็น device_code จริง |
| pool ของ transporter แบบ OAuth | ปิด (`pool: false`) | access token เปลี่ยนทุกชั่วโมง pool เก่าจะถือ token หมดอายุค้าง · ปริมาณส่ง PO ไม่ต้องใช้ pool |

**ทางที่ไม่เลือก:** authorization code + redirect กลับมาที่ FE — ลูกค้าต้องลงทะเบียน redirect URI ให้ตรงกับ
FE ทุกโดเมน (ผิดแล้วเจอ `AADSTS50011`) และถ้าลงทะเบียนเป็น platform "SPA" refresh token
จะหมดอายุใน 24 ชั่วโมง ส่วนการให้ลูกค้าวาง refresh token เองก็ใช้ยากเกินไป

## ส่วนที่ 1 — รูปร่างข้อมูล

`smtp` ของแต่ละโปรไฟล์ใน `email_profiles.profiles[]`:

```ts
smtp: {
  host: string; port: number; secure: boolean;
  username: string;                       // mailbox ที่ใช้ส่ง (ทุกวิธี)
  auth_type?: 'password' | 'oauth2_delegated' | 'oauth2_app';  // ไม่มี = 'password'
  password?: string;                      // 🔒 ต้องมีเมื่อ auth_type = password
  oauth?: {
    tenant_id: string;                    // delegated: 'consumers' เสมอ · app: GUID ของ tenant
    client_id: string;
    client_secret?: string;               // 🔒 ต้องมีเมื่อ oauth2_app
    refresh_token?: string;               // 🔒 delegated — backend เขียนเองเท่านั้น
    connected_account?: string;           // อีเมลจาก id_token ตอนเชื่อมต่อ
    connected_at?: string;                // ISO timestamp
  };
}
```

- **ไม่ต้อง migrate ข้อมูล** โปรไฟล์เดิมไม่มี `auth_type` และถือเป็น `password` ส่วน `password` เปลี่ยนเป็น optional
  ใน schema แต่ใช้ refine บังคับตาม `auth_type`
- `EmailProfilesSchema` (micro-business `app-config.service.ts`) ใช้ discriminated ตาม `auth_type`
- `secretPathsFor('email_profiles')` เพิ่ม `['profiles','*','smtp','oauth','client_secret']` และ
  `['profiles','*','smtp','oauth','refresh_token']` ใช้ mask / restore ตาม `id` แบบเดียวกับ
  `smtp.password` ที่มีอยู่ ทำให้การกด Save ในฟอร์มไม่ลบ token ที่เชื่อมไว้
  - ⚠️ restore ตอนนี้ throw เมื่อ "ไม่มี secret เดิมให้คืน" (`app-config.service.ts` ~`:449`)
    แต่ `refresh_token` ว่างได้ตามปกติ (ยังไม่เชื่อมต่อ) ฟิลด์ที่ว่างได้จึงต้องไม่ throw
- **FE ไม่เคยส่ง `refresh_token` / `connected_*` ที่เป็นค่าใหม่** ตอน upsert backend ใช้ค่าเดิมที่เก็บไว้เสมอ
  (FE ส่ง mask กลับมา หรือไม่ส่งเลยก็ได้) จะเขียนค่าใหม่ได้ผ่าน endpoint poll เท่านั้น
- **ล้าง token เมื่อตัวตนเปลี่ยน:** ตอน upsert ถ้าโปรไฟล์ delegated เปลี่ยน `client_id`, `tenant_id`
  หรือ `username` หรือเปลี่ยน `auth_type` ออกจาก delegated ให้ลบ `refresh_token` / `connected_*`
- **Preset ที่ FE:** Hotmail ใช้ `smtp-mail.outlook.com:587` ส่วน M365 ใช้ `smtp.office365.com:587`
  ทั้งคู่ `secure: false` (STARTTLS) ค่า default ของฟอร์มตอนนี้เป็น `secure: true` ซึ่งใช้กับพอร์ต 587 ไม่ได้

## ส่วนที่ 2 — Flow

### 2a. เชื่อมต่อบัญชี Hotmail (`oauth2_delegated` เท่านั้น)

ต้องบันทึกโปรไฟล์ก่อน backend อ่าน `tenant_id` / `client_id` จาก DB ตาม `profile_id`
และไม่รับค่าเหล่านี้จาก FE

```
FE                              gateway → micro-business                 Microsoft
POST …/email-profile/oauth/start {profile_id}
  ─────────────────────────────▶ POST login.microsoftonline.com/{tenant}/oauth2/v2.0/devicecode
                                  scope = https://outlook.office.com/SMTP.Send offline_access openid email
  ◀── { user_code, verification_uri, interval, expires_in, handle }

ทุก interval วินาที:
POST …/email-profile/oauth/poll {profile_id, handle}
  ─────────────────────────────▶ POST …/{tenant}/oauth2/v2.0/token
                                  grant_type = urn:ietf:params:oauth:grant-type:device_code
  ◀── { status: 'pending' | 'slow_down' | 'connected' | 'expired' | 'denied' | 'error',
        account?, message? }
```

- `handle` = `encryptSecret(JSON{ device_code, profile_id, client_id, exp })` ตอน poll ให้ตรวจว่า
  `profile_id` / `client_id` ยังตรงกับที่บันทึกไว้ และยังไม่เลย `exp`
- `connected`: ตรวจว่าอีเมลใน `id_token` (`email` หรือ `preferred_username`) **ตรงกับ `smtp.username`
  โดยไม่สนตัวพิมพ์** ถ้าไม่ตรงให้ตอบ `error` เพราะ Hotmail ส่งในนามบัญชีอื่นไม่ได้ ถ้าตรง
  ให้เข้ารหัส `refresh_token` แล้วเขียนลงโปรไฟล์นั้นแบบเจาะจุด (ข้อ 2d) พร้อม `connected_account` / `connected_at`
- แปลง error ของ Microsoft: `authorization_pending` → `pending` · `slow_down` → `slow_down` ·
  `expired_token` → `expired` · `authorization_declined` → `denied` · อื่น ๆ → `error` + message

### 2b. Resolve config ตอนส่ง — `resolveSmtpConfigForProfile(bu_code, profile)`

ตัวช่วยใหม่ตัวเดียวใน `AppConfigService` มาแทนโค้ดประกอบ `smtp_config` ที่เขียนเองอยู่ 3 จุด:
`purchase-order.service.ts` ~`:7100`, `request-for-pricing.service.ts` ~`:938` และ
`app-config.service.ts` `testEmailProfile` ~`:973`

| auth_type | การทำงาน |
|---|---|
| `password` | `{ …, password }` เหมือนเดิม |
| `oauth2_app` | `client_credentials` · scope `https://outlook.office365.com/.default` → `{ …, auth_type: 'oauth2', access_token }` |
| `oauth2_delegated` | `refresh_token` grant · scope เดียวกับ 2a → ถ้าได้ refresh token ใหม่ที่ต่างจากเดิม ให้เขียนกลับ (ข้อ 2d) |

- cache access token ใน memory ต่อ key `bu_code|profile_id|client_id|username` จนถึง `expires_in − 300s`
- ถ้าเขียน refresh token กลับไม่สำเร็จ ให้ `logger.warn` แล้วส่งต่อ ห้าม fail การส่ง (token เก่ายังใช้ได้จนหมดอายุของมัน)
- `invalid_grant` / `interaction_required` → throw error ที่อ่านรู้เรื่อง:
  `Email profile "<name>" must reconnect its Microsoft account` ข้อความนี้ต้องขึ้นทั้งตอนส่ง PO / RFP และในปุ่มทดสอบ
- `oauth2_delegated` ที่ยังไม่มี `refresh_token` → error "ยังไม่ได้เชื่อมต่อบัญชี Microsoft" ไม่ต้องยิงไปหา Microsoft

### 2c. micro-notification

- `SmtpConfigSchema` (`platform-email.service.ts`) เปลี่ยนเป็น union:
  `{ …, password }` | `{ …, auth_type: 'oauth2', access_token }` payload เดิม (ไม่มี `auth_type`) ต้องผ่านเหมือนเดิมทุกประการ
- `EmailService.getTransporter`: แบบ OAuth ใช้ `auth: { type: 'OAuth2', user, accessToken }` + `pool: false`
  และ**ไม่เข้า transporter cache** (หรือ cache key ห้ามมี token) แบบ password ไม่เปลี่ยน

### 2d. เขียนกลับแบบเจาะจุด

ใช้ทั้งตอน `connected` (2a) และตอน refresh token หมุน (2b): อ่านแถว `email_profiles`
หาโปรไฟล์ตาม `id` แล้วแก้เฉพาะ `smtp.oauth.{refresh_token, connected_account, connected_at}`
จากนั้นเขียนกลับแบบ compare-and-swap บน `updated_at` (ถ้าแถวถูกแก้ระหว่างนั้นให้อ่านใหม่แล้วลองอีก
สูงสุด 3 ครั้ง) ไม่ใช้ `FOR UPDATE` เพราะ Prisma ทำไม่ได้ถ้าไม่ใช้ raw SQL และ CAS ให้ผลเดียวกัน วิธีนี้ไม่ทับการแก้ฟิลด์อื่นที่ผู้ดูแลเพิ่งบันทึก และถ้าโปรไฟล์ถูกลบไปแล้ว ให้ข้ามโดยไม่ error

## ส่วนที่ 3 — UI, endpoint, deploy

### 3a. FE (`routes/system-admin/email-profile/`)

- `email-profile-schema.ts`: เพิ่ม `smtp_auth_type`, `oauth_tenant_id`, `oauth_client_id`,
  `oauth_client_secret` (mask ด้วย `SECRET_MASK`) และ `superRefine` บังคับฟิลด์ตามวิธี
  (`password` ไม่ต้องกรอกเมื่อเป็น OAuth) แก้ `to/fromEmailProfileFormValues` ให้ครบ
- `email-profile-dialog.tsx`:
  - select **วิธียืนยันตัวตน** (รหัสผ่าน / Microsoft — Hotmail, Outlook.com / Microsoft 365 — องค์กร)
  - เปลี่ยนวิธีแล้ว: ถ้า host ยังว่าง ให้เติม preset host / port / `secure:false` ให้ แต่ไม่เขียนทับค่าที่กรอกไว้แล้ว
  - Hotmail: ช่อง `client_id` (ซ่อน `tenant_id` และตั้งเป็น `consumers`) + กล่องสถานะ
    "เชื่อมต่อแล้วกับ … เมื่อ …" / "ยังไม่เชื่อมต่อ" (แสดงสถานะอย่างเดียว) ปุ่ม
    **เชื่อมต่อ / เชื่อมต่อใหม่** อยู่ที่แถวของโปรไฟล์ในหน้า list ไม่ได้อยู่ใน dialog แก้ไข เพราะต้อง
    บันทึกก่อนอยู่แล้ว และไม่ต้องจัดการสถานะ dirty
  - M365: `tenant_id`, `client_id`, `client_secret`
  - ลิงก์ไปคู่มือการตั้ง App ใน Azure (3d)
- ไฟล์ใหม่ `email-profile-oauth-dialog.tsx`: แสดง `user_code` ตัวใหญ่ + ปุ่มคัดลอก + ลิงก์
  `verification_uri` (แท็บใหม่) + สถานะรอ poll ด้วย `useQuery` + `refetchInterval` (เริ่มจาก `interval`
  และ +5 วินาทีเมื่อได้ `slow_down`) หยุดเมื่อได้สถานะสุดท้าย, ปิด dialog หรือเลย `expires_in`
  เมื่อ `connected` ให้ invalidate query ของ `email_profiles`
- `email-profile-component.tsx` (list): badge วิธีเชื่อมต่อ + badge เตือนเมื่อเป็น delegated ที่ยังไม่มี `connected_at`
- `types/email-profile.ts`: เพิ่มฟิลด์ตามส่วนที่ 1
- i18n `messages/{en,th}.json` — **ห้ามมี `{` `}` นอกจาก argument ของ ICU** (ไม่งั้นหน้าพังทั้งหน้า)

### 3b. Endpoint ใหม่ (gateway `config_app-config.controller.ts`)

- `POST /api/config/:bu_code/app-config/email-profile/oauth/start` body `{ profile_id }`
- `POST /api/config/:bu_code/app-config/email-profile/oauth/poll` body `{ profile_id, handle }`
- RPC contract ใหม่ใน `packages/rpc-contract/src/contracts/business.ts` ใช้แบบเดียวกับ `appConfigTestEmailProfile`
- สิทธิ์ใช้แบบเดียวกับการแก้ `email_profiles` / `test-email-profile` เติมใน `permission.route-map.ts`
  และ license route resolver controller นี้ไม่มี `AppIdGuard` จึง**ไม่ต้องเติม api_name allowlist**
  แต่ต้องเพิ่ม license override `config:app-config/email-profile` → `configuration.email_profile`
  (ไม่งั้น route จะตกไปใช้ feature `configuration.app_config`)

### 3c. ลำดับ deploy

1. **micro-notification** — schema รับทั้งสองแบบ ผู้เรียกเดิมไม่กระทบ
2. **backend-v2** (micro-business + gateway)
3. **FE**

FE ห้ามขึ้นก่อน BE เพราะ BE รุ่นเก่าจะ 400 หรือตัดฟิลด์ `oauth` ทิ้งตอนบันทึก ไม่ต้อง rollback
ข้อมูล เพราะโปรไฟล์ `password` เดิมไม่เปลี่ยนรูป

### 3d. คู่มือลูกค้า — `docs/email-profile-microsoft-oauth2.md`

- **Hotmail / Outlook.com:** Register app → Supported account types = *Personal Microsoft accounts only*
  (หรือรวม personal) → Authentication → **Allow public client flows = Yes** → API permissions:
  `SMTP.Send` (delegated) ไม่ต้องใช้ client secret
- **Microsoft 365:** Register app (single tenant) + client secret → API permissions:
  Office 365 Exchange Online → `SMTP.SendAsApp` (application) + **Grant admin consent** →
  Exchange Online PowerShell: `New-ServicePrincipal -AppId … -ObjectId …` +
  `Add-MailboxPermission -Identity <mailbox> -User <SP id> -AccessRights FullAccess` →
  ตรวจว่า SMTP AUTH ของ mailbox เปิดอยู่ (`Set-CASMailbox -SmtpClientAuthenticationDisabled $false`)
- error ที่พบบ่อยและวิธีแก้: `AADSTS7000218` (ยังไม่เปิด public client flows) ·
  `535 5.7.3` (ปิด SMTP AUTH / ยังไม่ผูก mailbox permission) · ต้องเชื่อมต่อใหม่ (refresh token หมดอายุหลังไม่ได้ใช้ 90 วัน)

## ส่วนที่ 4 — การตรวจ

- ตามความต้องการของผู้ใช้ ระหว่างทำตามแผน**ไม่เขียนเทสต์ใหม่** แต่ต้องรัน typecheck + lint ทั้ง 3 รีโป
  และเทสต์ชุดเดิมที่เกี่ยวข้องต้องเขียว (BE ใช้ jest ห้ามใช้ bun test):
  `app-config.service.spec`, `purchase-order.service.spec`, `request-for-pricing.service.spec`,
  `config_app-config.service.spec`, micro-notification `platform-email` / `email`
- **ตรวจมือ — Hotmail (มีบัญชีทดสอบ):**
  1. สร้าง app registration ตาม 3d
  2. สร้างโปรไฟล์ Hotmail → บันทึก → เชื่อมต่อ → ได้ `connected` และแสดงอีเมลถูกต้อง
  3. ปุ่มทดสอบส่งถึงจริง
  4. ส่ง PO จริง 1 ใบผ่านโปรไฟล์นี้
  5. แก้ `from_name` แล้ว Save → ยังเชื่อมต่ออยู่ (token ไม่หาย)
  6. เปลี่ยน `client_id` แล้ว Save → สถานะกลับเป็น "ยังไม่เชื่อมต่อ"
  7. consent ด้วยบัญชีที่ไม่ตรงกับ username → ได้ `error`
  8. โปรไฟล์ password เดิมยังส่งได้ (regression)
- **M365 (`oauth2_app`): ไม่มี tenant ทดสอบ — ship โดยยังไม่ได้ตรวจมือ** ตรวจได้แค่ระดับโค้ด
  (token request ตรงตามเอกสารของ Microsoft) ต้องเขียนไว้ใน PR และแจ้งลูกค้า M365 รายแรกว่าเป็นการใช้งานจริงครั้งแรก

## ความเสี่ยงที่ยอมรับ

- refresh token ของ Hotmail หมดอายุเมื่อไม่ได้ใช้ 90 วัน BU ที่ส่ง PO ไม่บ่อยจะต้องเชื่อมต่อใหม่เป็นครั้งคราว
  ระบบรู้ตอนส่งเท่านั้น ไม่มีแจ้งเตือนล่วงหน้า (ไม่ทำรอบนี้)
- access token cache อยู่ใน memory ของแต่ละ instance ทำให้หลาย instance ยิง refresh ซ้ำกันได้ ไม่เป็นปัญหาความถูกต้อง
- Microsoft ไม่ได้เพิกถอน refresh token เก่าทันทีที่หมุนตัวใหม่ จึงรับ race ของการเขียนกลับพร้อมกันได้ (ตัวท้ายชนะ)
