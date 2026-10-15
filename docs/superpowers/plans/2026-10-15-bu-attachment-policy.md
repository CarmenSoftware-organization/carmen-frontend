# นโยบายไฟล์แนบ comment ต่อ BU — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทีม Carmen ตั้งชนิดไฟล์ (เป็นกลุ่ม) และขนาดสูงสุดของไฟล์แนบ comment ได้ต่อ BU จาก carmen-platform — gateway บังคับใช้ inventory FE ใช้ตรวจก่อนอัปโหลด

**Architecture:** ค่าเก็บเป็น entry ใน `tb_business_unit.config` (platform DB) · gateway มี `AttachmentPolicyService` อ่านตรงผ่าน `PRISMA_SYSTEM` + cache 60 วิ แทนโค้ดตรวจไฟล์ที่ copy ไว้ 138 จุดใน 46 comment controller · endpoint อ่านนโยบายให้ FE · ฝั่ง BU เขียน key `attachment.*` ไม่ได้ · platform มี section ตั้งค่า

**Tech Stack:** NestJS + Prisma + jest (BE) · React + Vite (platform) · React + TanStack Query + use-intl (inventory FE)

**Spec:** `docs/superpowers/specs/2026-10-15-bu-attachment-policy-design.md` (รีโปนี้)

## Global Constraints

- **ไม่เขียนเทสต์ใหม่** (preference ของ user) — ข้ามทุกขั้น "write failing test" · **ห้ามสร้าง** `*.spec.ts` / `*.test.ts` ใหม่ · ยังต้องรัน static check (typecheck/lint) และ**เทสต์เดิมต้องเขียว** · ตรวจด้วยมือ (curl/เบราว์เซอร์) แทน
- BE ใช้ **jest** (`bunx jest …` ใน `apps/backend-gateway`) **ห้าม `bun test`**
- commit message เป็นภาษาไทย · PR เป็นภาษาอังกฤษ · merge ด้วย merge commit ห้าม squash
- กลุ่มชนิด: `image` `pdf` `excel` `word` `csv` `text` (รายการตายตัว) · ค่าเริ่มต้น `["image","pdf"]`
- ขนาด: จำนวนเต็ม 1–25 MB · ค่าเริ่มต้น 10 · เพดาน multer 25MB
- key: `attachment.allowed_types` (array ของรหัสกลุ่ม) · `attachment.max_size_mb` (number) · prefix `attachment.` = platform-only
- รหัส error: `ATTACHMENT_TYPE_NOT_ALLOWED` · `ATTACHMENT_TOO_LARGE` · `ATTACHMENT_POLICY_INVALID` (http 400 ทั้งหมด)
- api_name ใหม่: `attachmentPolicy.get` — ต้องอยู่ใน `app-api-catalog.generated.ts` และ allowlist ของ env ก่อน deploy FE
- dev DB (`:4000` → dev.blueledgers.com) ใช้ร่วมกัน — **backup `config` ของ BU T02 ก่อนแก้ และคืนค่าเมื่อเสร็จ**
- ไฟล์แปลห้ามมี `{{ }}`
- ลำดับ deploy: BE → allowlist → platform → inventory FE

## Review Focus

1. **`PUT api/business-units` จาก inventory ต้องไม่ลบค่าที่ platform ตั้งไว้** — คนกดบันทึกหน้า Default Setting แล้วนโยบายไฟล์หาย คือบั๊กที่มองไม่เห็นจนลูกค้าแนบ Excel ไม่ได้ (Task 6 Step 5 ตรวจด้วย curl)
2. **ไฟล์ที่ browser ส่ง MIME ว่าง/`application/octet-stream`** (.csv บางเครื่อง, .doc) — ต้องผ่านด้วยนามสกุลถ้ากลุ่มเปิดอยู่ แต่ MIME ที่ระบุชัดว่าต้องห้ามต้องไม่ผ่านแม้นามสกุลถูก (Task 7 curl `-F "files=@x.xlsx;type=application/octet-stream"` และ `x.pdf;type=text/html`)
3. **ค่าที่ถูกแก้ผ่านตัวแก้ config ทั่วไปในรูปสตริง** (`"15"`, `'["image","excel"]'`) — resolve ต้องอ่านได้ ไม่ตกเป็นค่าเริ่มต้นเงียบ ๆ (Task 2 resolver รับสตริง · Task 7 ตรวจด้วย SQL)
4. **ไฟล์ 30MB** — ต้องได้ 400 `ATTACHMENT_TOO_LARGE` ไม่ใช่ 413/500 ไร้รหัส และ gateway ไม่ถือไฟล์ทั้งก้อน (Task 7)
5. **FE ขึ้นก่อน BE / endpoint ตอบ 404** — แผง comment ยังใช้ได้ด้วยค่าเริ่มต้นและ user ไม่ถูก logout (Task 10 Step 6)

---

## รีโป 1: `carmen-turborepo-backend-v2`

ทำงานบน branch ใหม่จาก `origin/main`:

```bash
cd ../carmen-turborepo-backend-v2
git fetch -q origin && git checkout -b feature/bu-attachment-policy origin/main
```

### Task 1: รหัส error ใน catalog

**Files:**
- Modify: `packages/error-catalog/src/catalog.ts` (ต่อท้ายกลุ่ม `// ----- 100 common / system -----` หลัง `COMMON_UNIQUE_CONSTRAINT_VIOLATION` ซึ่งใช้ `makeId(MODULE.COMMON, 12)`)
- Regenerate: `packages/error-catalog/reference/error-codes.json`, `error-codes.md`

**Interfaces:**
- Produces: `ERROR_CATALOG.ATTACHMENT_TYPE_NOT_ALLOWED` (params `{allowed}`), `ERROR_CATALOG.ATTACHMENT_TOO_LARGE` (params `{max_mb}`), `ERROR_CATALOG.ATTACHMENT_POLICY_INVALID` (params `{key}`, `{max_mb}`) — Task 2/6 โยนด้วยรหัสสตริงเหล่านี้

- [ ] **Step 1: ตรวจว่าเลข 13–15 ของ COMMON ว่าง**

Run: `grep -n "makeId(MODULE.COMMON, 1[3-5])" packages/error-catalog/src/catalog.ts`
Expected: ไม่มีผลลัพธ์ (ถ้ามี ให้ใช้เลขถัดไปที่ว่างแทนทั้งสามตัว)

- [ ] **Step 2: เพิ่มสาม entry ต่อจาก `COMMON_UNIQUE_CONSTRAINT_VIOLATION`**

```ts
  // ไฟล์แนบ comment — นโยบายต่อ BU (tb_business_unit.config: attachment.*) ตั้งจาก platform
  // ข้อความไม่อ้างชื่อไฟล์: กรณีโดน multer ตัดที่เพดานระบบ ไม่รู้ชื่อไฟล์
  ATTACHMENT_TYPE_NOT_ALLOWED: {
    code: 'ATTACHMENT_TYPE_NOT_ALLOWED',
    id: makeId(MODULE.COMMON, 13),
    http_status: 400,
    message_en: 'This file type is not allowed. Allowed: {allowed}',
    message_th: 'ไม่อนุญาตไฟล์ชนิดนี้ แนบได้เฉพาะ {allowed}',
  },
  ATTACHMENT_TOO_LARGE: {
    code: 'ATTACHMENT_TOO_LARGE',
    id: makeId(MODULE.COMMON, 14),
    http_status: 400,
    message_en: 'The file is larger than the {max_mb} MB limit',
    message_th: 'ไฟล์มีขนาดเกิน {max_mb} MB',
  },
  ATTACHMENT_POLICY_INVALID: {
    code: 'ATTACHMENT_POLICY_INVALID',
    id: makeId(MODULE.COMMON, 15),
    http_status: 400,
    message_en: 'Invalid attachment setting {key}: file types must come from the supported list and size must be 1–{max_mb} MB',
    message_th: 'ค่าไฟล์แนบ {key} ไม่ถูกต้อง: ชนิดไฟล์ต้องมาจากรายการที่รองรับ และขนาดต้องอยู่ระหว่าง 1–{max_mb} MB',
  },
```

- [ ] **Step 3: สร้าง reference ใหม่ + build dist + เทสต์เดิมของ package**

```bash
bun run --cwd packages/error-catalog gen:reference
bun run --cwd packages/error-catalog build:package
bun run --cwd packages/error-catalog test
```
Expected: reference มีสามรหัสใหม่ · build ไม่มี error · test PASS (มีเทสต์ตรวจว่า id ไม่ซ้ำ)

- [ ] **Step 4: Commit**

```bash
git add packages/error-catalog
git commit -m "feat(error-catalog): รหัส ATTACHMENT_TYPE_NOT_ALLOWED / ATTACHMENT_TOO_LARGE / ATTACHMENT_POLICY_INVALID"
```

### Task 2: แกนนโยบาย (pure) — รายการกลุ่ม, resolve, จับคู่ไฟล์, ตรวจตอนเขียน

**Files:**
- Create: `apps/backend-gateway/src/common/attachment-policy/attachment-policy.ts`

**Interfaces:**
- Produces (ทุกตัว export จากไฟล์นี้):
  - `ATTACHMENT_KEY_PREFIX = 'attachment.'`, `ATTACHMENT_CONFIG_KEYS = { allowedTypes: 'attachment.allowed_types', maxSizeMb: 'attachment.max_size_mb' }`
  - `ATTACHMENT_MAX_SIZE_MB_CEILING = 25`, `ATTACHMENT_DEFAULT_MAX_SIZE_MB = 10`, `ATTACHMENT_DEFAULT_TYPES`
  - `type AttachmentTypeGroup`, `ATTACHMENT_TYPE_GROUPS`
  - `interface AttachmentPolicy { allowed_types: AttachmentTypeGroup[]; max_size_mb: number; mime_types: string[]; extensions: string[] }`
  - `resolveAttachmentPolicy(config: unknown): AttachmentPolicy`
  - `isFileAllowed(file: { originalname: string; mimetype: string }, policy: AttachmentPolicy): boolean`
  - `assertAttachments(files: Express.Multer.File[], policy: AttachmentPolicy): void` — โยน `BadRequestException`
  - `findInvalidAttachmentConfig(config: unknown): string | null` — คืน key ที่ผิด
  - `isPlatformOnlyConfigEntry(entry: unknown): boolean`

- [ ] **Step 1: เขียนไฟล์**

```ts
import { BadRequestException } from '@nestjs/common';

/**
 * นโยบายไฟล์แนบ comment ต่อ BU — ค่าอยู่ใน tb_business_unit.config (platform DB) ตั้งจาก carmen-platform เท่านั้น
 * Per-BU comment attachment policy, stored as tb_business_unit.config entries and set from carmen-platform only.
 *
 * spec: carmen-inventory-frontend-react/docs/superpowers/specs/2026-10-15-bu-attachment-policy-design.md
 */

/** key ที่ขึ้นต้นด้วย prefix นี้ ฝั่ง BU (PUT/PATCH api/business-units) เขียนไม่ได้ */
export const ATTACHMENT_KEY_PREFIX = 'attachment.';
export const ATTACHMENT_CONFIG_KEYS = {
  allowedTypes: 'attachment.allowed_types',
  maxSizeMb: 'attachment.max_size_mb',
} as const;

export const ATTACHMENT_MAX_SIZE_MB_CEILING = 25;
export const ATTACHMENT_DEFAULT_MAX_SIZE_MB = 10;

/**
 * กลุ่มชนิดไฟล์ที่ platform เลือกเปิดได้ — รายการตายตัว ไม่มีทางเปิด svg/html/exe
 * `application/vnd.ms-excel` อยู่ทั้ง excel และ csv เพราะ Windows ส่ง MIME นี้มากับ .csv
 * ต้องตรงกับ carmen-platform `src/constants/attachmentTypes.ts`
 */
export const ATTACHMENT_TYPE_GROUPS = {
  image: {
    mime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    ext: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  },
  pdf: { mime: ['application/pdf'], ext: ['.pdf'] },
  excel: {
    mime: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
    ext: ['.xlsx', '.xls'],
  },
  word: {
    mime: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
    ext: ['.docx', '.doc'],
  },
  csv: { mime: ['text/csv', 'application/vnd.ms-excel'], ext: ['.csv'] },
  text: { mime: ['text/plain'], ext: ['.txt'] },
} as const satisfies Record<string, { mime: readonly string[]; ext: readonly string[] }>;

export type AttachmentTypeGroup = keyof typeof ATTACHMENT_TYPE_GROUPS;
export const ATTACHMENT_DEFAULT_TYPES: readonly AttachmentTypeGroup[] = ['image', 'pdf'];

export interface AttachmentPolicy {
  allowed_types: AttachmentTypeGroup[];
  max_size_mb: number;
  /** MIME ทั้งหมดของกลุ่มที่เปิด (ไม่ซ้ำ) */
  mime_types: string[];
  /** นามสกุลทั้งหมดของกลุ่มที่เปิด (ตัวเล็ก มีจุดนำหน้า) */
  extensions: string[];
}

const isGroup = (v: unknown): v is AttachmentTypeGroup =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(ATTACHMENT_TYPE_GROUPS, v);

const configValue = (config: unknown, key: string): unknown => {
  if (!Array.isArray(config)) return undefined;
  const entry = config.find(
    (e): e is { key: string; value?: unknown } =>
      !!e && typeof e === 'object' && (e as { key?: unknown }).key === key,
  );
  return entry?.value;
};

/** ค่าที่ถูกแก้ผ่านตัวแก้ config ทั่วไปของ platform เป็นสตริงเสมอ — `'["image","excel"]'` ต้องอ่านได้ */
const asArray = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

/**
 * แปลง config ของ BU เป็นนโยบายที่ใช้ได้เสมอ — ค่าผิดรูปไม่ทำให้พัง:
 * ขนาด clamp เข้า 1–25 (ไม่ใช่ตัวเลข = 10) · กลุ่มที่ไม่รู้จักถูกทิ้ง · เหลือว่าง = ค่าเริ่มต้น
 * Resolve a BU's config into a usable policy; malformed values fall back instead of throwing.
 */
export function resolveAttachmentPolicy(config: unknown): AttachmentPolicy {
  const groups = [...new Set(asArray(configValue(config, ATTACHMENT_CONFIG_KEYS.allowedTypes)).filter(isGroup))];
  const allowed_types = groups.length > 0 ? groups : [...ATTACHMENT_DEFAULT_TYPES];

  const rawSize = Number(configValue(config, ATTACHMENT_CONFIG_KEYS.maxSizeMb));
  const max_size_mb =
    Number.isFinite(rawSize) && rawSize > 0
      ? Math.min(Math.max(Math.floor(rawSize), 1), ATTACHMENT_MAX_SIZE_MB_CEILING)
      : ATTACHMENT_DEFAULT_MAX_SIZE_MB;

  const mime_types = [...new Set(allowed_types.flatMap((g) => ATTACHMENT_TYPE_GROUPS[g].mime))];
  const extensions = [...new Set(allowed_types.flatMap((g) => ATTACHMENT_TYPE_GROUPS[g].ext))];
  return { allowed_types, max_size_mb, mime_types, extensions };
}

/** MIME ที่ไม่บอกอะไร — กรณีนี้เท่านั้นที่ถอยไปดูนามสกุล */
const NEUTRAL_MIME = new Set(['', 'application/octet-stream']);

/**
 * ไฟล์ผ่านนโยบายไหม — MIME ต้องอยู่ในชุดของกลุ่มที่เปิด · นามสกุลเป็นทางสำรองเฉพาะเมื่อ MIME เป็นค่ากลาง
 * MIME ที่ชี้ชัดว่าต้องห้ามถูกปฏิเสธเสมอแม้นามสกุลดูถูก (`x.pdf` ที่ส่ง `text/html` ไม่ผ่าน)
 */
export function isFileAllowed(
  file: { originalname: string; mimetype: string },
  policy: AttachmentPolicy,
): boolean {
  const mime = (file.mimetype ?? '').toLowerCase().trim();
  if (!NEUTRAL_MIME.has(mime)) return policy.mime_types.includes(mime);
  const name = file.originalname ?? '';
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
  return ext !== '' && policy.extensions.includes(ext);
}

/**
 * ตรวจไฟล์ทุกตัวตามนโยบาย — เช็กขนาดก่อนชนิด (ลำดับเดียวกับโค้ดเดิม)
 * โยน BadRequestException ที่มี `code` ของ catalog — exception filter ของ gateway render ข้อความตามภาษาให้
 */
export function assertAttachments(files: Express.Multer.File[], policy: AttachmentPolicy): void {
  const maxBytes = policy.max_size_mb * 1024 * 1024;
  for (const f of files) {
    if (f.size > maxBytes) {
      throw new BadRequestException({
        code: 'ATTACHMENT_TOO_LARGE',
        name: f.originalname,
        max_mb: policy.max_size_mb,
      });
    }
    if (!isFileAllowed(f, policy)) {
      throw new BadRequestException({
        code: 'ATTACHMENT_TYPE_NOT_ALLOWED',
        name: f.originalname,
        allowed: policy.extensions.join(', '),
      });
    }
  }
}

/**
 * ตรวจ entry `attachment.*` ตอน platform เขียน BU — คืน key แรกที่ผิด หรือ null
 * เข้มกว่าตอนอ่าน: platform ต้องส่ง array ของกลุ่มที่รู้จัก (ไม่ว่าง) และจำนวนเต็ม 1–25
 */
export function findInvalidAttachmentConfig(config: unknown): string | null {
  if (!Array.isArray(config)) return null;
  for (const e of config) {
    if (!e || typeof e !== 'object') continue;
    const { key, value } = e as { key?: unknown; value?: unknown };
    if (key === ATTACHMENT_CONFIG_KEYS.allowedTypes) {
      if (!Array.isArray(value) || value.length === 0 || !value.every(isGroup)) return key;
    } else if (key === ATTACHMENT_CONFIG_KEYS.maxSizeMb) {
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > ATTACHMENT_MAX_SIZE_MB_CEILING
      ) {
        return key;
      }
    }
  }
  return null;
}

/** entry ที่ฝั่ง BU เขียนไม่ได้ (ขึ้นต้น `attachment.`) */
export function isPlatformOnlyConfigEntry(entry: unknown): boolean {
  const key = (entry as { key?: unknown } | null)?.key;
  return typeof key === 'string' && key.startsWith(ATTACHMENT_KEY_PREFIX);
}
```

- [ ] **Step 2: typecheck**

Run: `cd apps/backend-gateway && bunx tsc --noEmit -p tsconfig.json`
Expected: ไม่มี error (ถ้า `Express.Multer.File` หาไม่เจอ ดูว่าไฟล์ controller เดิม import type อย่างไรแล้วทำตาม)

- [ ] **Step 3: Commit**

```bash
git add apps/backend-gateway/src/common/attachment-policy/attachment-policy.ts
git commit -m "feat(attachment): แกนนโยบายไฟล์แนบต่อ BU — กลุ่มชนิด, resolve, จับคู่ไฟล์, ตรวจตอนเขียน"
```

### Task 3: `AttachmentPolicyService` + module + interceptor ของ comment

**Files:**
- Create: `apps/backend-gateway/src/common/attachment-policy/attachment-policy.service.ts`
- Create: `apps/backend-gateway/src/common/attachment-policy/comment-files.interceptor.ts`
- Create: `apps/backend-gateway/src/common/attachment-policy/attachment-policy.module.ts`
- Modify: `apps/backend-gateway/src/app.module.ts` (import + ใส่ใน `imports` ข้าง `LicenseModule` บรรทัด ~204)

**Interfaces:**
- Consumes: Task 2 ทั้งไฟล์
- Produces: `AttachmentPolicyService.getPolicy(bu_code: string): Promise<AttachmentPolicy>` · `AttachmentPolicyService.assertFiles(bu_code: string, files: Express.Multer.File[]): Promise<void>` · `CommentFilesInterceptor(): Type<NestInterceptor>` · `AttachmentPolicyModule` (`@Global`, exports service)

- [ ] **Step 1: service**

```ts
import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient_SYSTEM } from '@repo/prisma-shared-schema-platform';
import { BackendLogger } from 'src/common/helpers/backend.logger';
import { AttachmentPolicy, assertAttachments, resolveAttachmentPolicy } from './attachment-policy';

const TTL_MS = 60_000;

/**
 * อ่านนโยบายไฟล์แนบของ BU จาก platform DB ตรง ๆ (ไม่ข้าม TCP) + cache 60 วิต่อ bu_code
 * ลอกรูปจาก LicenseService — platform เปลี่ยนค่าแล้วมีผลภายใน ≤ 1 นาที (ต่อ instance)
 * Reads a BU's attachment policy straight from the platform DB, cached 60s per bu_code.
 */
@Injectable()
export class AttachmentPolicyService {
  private readonly logger = new BackendLogger(AttachmentPolicyService.name);
  private readonly cache = new Map<string, { value: AttachmentPolicy; expiresAt: number }>();

  constructor(@Inject('PRISMA_SYSTEM') private readonly prismaSystem: typeof PrismaClient_SYSTEM) {}

  /**
   * นโยบายของ BU — หา BU ไม่เจอหรือ DB ล่ม = ค่าเริ่มต้น (รูป + PDF 10MB ซึ่งเข้มอยู่แล้ว) และไม่ cache ความล้มเหลว
   * @param bu_code - Business unit code / รหัสหน่วยธุรกิจ
   * @returns Resolved policy / นโยบายที่ใช้ได้
   */
  async getPolicy(bu_code: string): Promise<AttachmentPolicy> {
    const now = Date.now();
    const hit = this.cache.get(bu_code);
    if (hit && hit.expiresAt > now) return hit.value;

    let config: unknown = null;
    try {
      const bu = await this.prismaSystem.tb_business_unit.findFirst({
        where: { code: bu_code, deleted_at: null },
        select: { config: true },
      });
      config = bu?.config ?? null;
    } catch (error) {
      this.logger.warn({ function: 'getPolicy', bu_code, error: String(error) }, AttachmentPolicyService.name);
      return resolveAttachmentPolicy(null);
    }

    const value = resolveAttachmentPolicy(config);
    this.cache.set(bu_code, { value, expiresAt: now + TTL_MS });
    return value;
  }

  /**
   * ตรวจไฟล์ที่อัปโหลดตามนโยบายของ BU — ไม่มีไฟล์ = ไม่แตะ DB
   * @param bu_code - Business unit code / รหัสหน่วยธุรกิจ
   * @param files - Uploaded files / ไฟล์ที่อัปโหลด
   */
  async assertFiles(bu_code: string, files: Express.Multer.File[]): Promise<void> {
    if (files.length === 0) return;
    assertAttachments(files, await this.getPolicy(bu_code));
  }
}
```

ถ้า `this.logger.warn` รับ signature ต่างจากนี้ ให้ดู `src/common/helpers/backend.logger.ts` แล้วใช้รูปแบบเดียวกับ `license.service.ts`

- [ ] **Step 2: interceptor ของ comment (ตัด multer ที่เพดานระบบ แล้วแปลง error เป็นรหัส catalog)**

```ts
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  PayloadTooLargeException,
  Type,
  mixin,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';
import { ATTACHMENT_MAX_SIZE_MB_CEILING } from './attachment-policy';

/**
 * `FilesInterceptor('files')` ของ comment + `limits.fileSize` = เพดานระบบ 25MB
 * เดิมไม่มี limits: ไฟล์ทั้งก้อนถูกบัฟเฟอร์เข้า RAM ก่อนจะถูกเช็กขนาด · ขนาดตามนโยบาย BU ยังตรวจใน
 * AttachmentPolicyService.assertFiles — ตัวนี้แค่ตัดของที่เกินทุกนโยบายที่เป็นไปได้ทิ้งระหว่าง stream
 * multer ตัดแล้ว Nest โยน PayloadTooLargeException (413 ไร้รหัส) — แปลงเป็น ATTACHMENT_TOO_LARGE
 */
export function CommentFilesInterceptor(): Type<NestInterceptor> {
  const Base = FilesInterceptor('files', undefined, {
    limits: { fileSize: ATTACHMENT_MAX_SIZE_MB_CEILING * 1024 * 1024 },
  });

  class CommentFilesInterceptorMixin extends Base {
    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
      try {
        return await super.intercept(context, next);
      } catch (error) {
        if (error instanceof PayloadTooLargeException) {
          throw new BadRequestException({
            code: 'ATTACHMENT_TOO_LARGE',
            name: '',
            max_mb: ATTACHMENT_MAX_SIZE_MB_CEILING,
          });
        }
        throw error;
      }
    }
  }
  return mixin(CommentFilesInterceptorMixin);
}
```

- [ ] **Step 3: module (`@Global` — controller 46 ตัวใช้ได้โดยไม่แก้ module ของมัน)**

```ts
import { Global, Module } from '@nestjs/common';
import { AttachmentPolicyService } from './attachment-policy.service';

/**
 * @Global เพราะ comment controller 46 ตัวต้อง inject AttachmentPolicyService โดยไม่ควรไปแก้ module ทีละตัว
 * PRISMA_SYSTEM มาจาก DatabaseModule ซึ่งเป็น @Global อยู่แล้ว
 */
@Global()
@Module({
  providers: [AttachmentPolicyService],
  exports: [AttachmentPolicyService],
})
export class AttachmentPolicyModule {}
```

(controller ของ endpoint อ่านนโยบายเติมใน Task 5)

- [ ] **Step 4: ลงทะเบียนใน `app.module.ts`**

เพิ่ม `import { AttachmentPolicyModule } from './common/attachment-policy/attachment-policy.module';` ข้าง import ของ `LicenseModule` (บรรทัด ~67) และใส่ `AttachmentPolicyModule,` ต่อจาก `LicenseModule,` ใน `imports` (บรรทัด ~204)

- [ ] **Step 5: typecheck + lint**

```bash
cd apps/backend-gateway && bunx tsc --noEmit -p tsconfig.json && bunx eslint src/common/attachment-policy src/app.module.ts
```
Expected: ผ่าน

- [ ] **Step 6: Commit**

```bash
git add apps/backend-gateway/src/common/attachment-policy apps/backend-gateway/src/app.module.ts
git commit -m "feat(attachment): AttachmentPolicyService (cache 60 วิ) + interceptor ตัดไฟล์ที่เพดาน 25MB"
```

### Task 4: แทนโค้ดตรวจไฟล์ 138 จุดใน 46 comment controller (codemod)

**Files:**
- Modify: ทุก `apps/backend-gateway/src/**/*comments.controller.ts` ที่มี `ALLOWED_MIME_TYPES` (46 ไฟล์)
- Modify: ทุก `apps/backend-gateway/src/**/*comments.controller.spec.ts` ที่คู่กัน (46 ไฟล์) — เติม provider เท่านั้น ไม่เพิ่มเคส
- Create (ชั่วคราว ไม่ commit): `/private/tmp/claude-501/-Users-samutpra-GitHub-carmensoftware-organize-carmen-inventory-frontend-react/7e9fae62-24fa-4709-a30c-b09932aa9925/scratchpad/codemod-attachment-policy.py`

**Interfaces:**
- Consumes: `AttachmentPolicyService.assertFiles`, `CommentFilesInterceptor` (Task 3)

ข้อเท็จจริงที่ยืนยันแล้ว (2026-10-15): ทั้ง 46 ไฟล์มีบล็อกค่าคงที่ `MAX_FILES … ALLOWED_MIME_TYPES = [...] as const;` ชุดเดียวกัน · loop ตรวจ 138 จุดตรงกับ regex เดียว · `FilesInterceptor('files')` 138 จุด · constructor มี 2 รูป (บรรทัดเดียว 31 ไฟล์ / หลายบรรทัด 15 ไฟล์) · spec ทุกไฟล์มี `providers: [{ provide: X, useValue: mockService }],` หนึ่งจุด และคาด `BadRequestException` สำหรับไฟล์ 11MB และ `text/plain`

- [ ] **Step 1: เขียน codemod (assert ทุกจุด — ไฟล์ไหนไม่ตรงให้ล้มทั้งชุด)**

```python
import re, glob, sys, os
ROOT = 'apps/backend-gateway/src'
ctrls = sorted(f for f in glob.glob(f'{ROOT}/**/*comments.controller.ts', recursive=True)
               if 'ALLOWED_MIME_TYPES' in open(f).read())
assert len(ctrls) == 46, len(ctrls)

LOOP = re.compile(
    r"\n( *)for \(const (\w+) of files\) \{\n\s*if \(\2\.size > MAX_FILE_SIZE_BYTES\) \{\n\s*throw new BadRequestException\(\n?\s*"
    r"`File \"\$\{\2\.originalname\}\" exceeds max size of \$\{MAX_FILE_SIZE_BYTES\} bytes`,?\n?\s*\);\n\s*\}\n\s*"
    r"if \(!\(ALLOWED_MIME_TYPES as readonly string\[\]\)\.includes\(\2\.mimetype\)\) \{\n\s*throw new BadRequestException\(\n?\s*"
    r"`File \"\$\{\2\.originalname\}\" has unsupported mime type \"\$\{\2\.mimetype\}\"`,?\n?\s*\);\n\s*\}\n\1\}")
CONSTS = re.compile(r"const MAX_FILE_SIZE_BYTES = .*?\nconst ALLOWED_MIME_TYPES = \[.*?\] as const;\n", re.S)
CTOR = re.compile(r"constructor\(\s*private readonly (\w+): (\w+),?\s*\) \{\}")
IMPORT_ANCHOR = "import { FilesInterceptor } from '@nestjs/platform-express';\n"

for f in ctrls:
    s = open(f).read()
    n_loop = len(LOOP.findall(s)); n_int = s.count("FilesInterceptor('files')")
    assert n_loop == 3 and n_int == 3, (f, n_loop, n_int)
    # ทุก loop ต้องอยู่ใน handler ที่มี bu_code
    for m in LOOP.finditer(s):
        head = s[:m.start()]
        assert "bu_code: string" in head[head.rfind('async '):], (f, 'no bu_code in handler')
    s = LOOP.sub(r"\n\1await this.attachmentPolicy.assertFiles(bu_code, files);", s)
    s, k = CONSTS.subn('', s); assert k == 1, (f, 'consts')
    s, k = CTOR.subn(r"constructor(\n    private readonly \1: \2,\n    private readonly attachmentPolicy: AttachmentPolicyService,\n  ) {}", s); assert k == 1, (f, 'ctor')
    s = s.replace("FilesInterceptor('files')", "CommentFilesInterceptor()")
    assert s.count(IMPORT_ANCHOR) == 1, (f, 'import anchor')
    s = s.replace(IMPORT_ANCHOR,
        "import { AttachmentPolicyService } from 'src/common/attachment-policy/attachment-policy.service';\n"
        "import { CommentFilesInterceptor } from 'src/common/attachment-policy/comment-files.interceptor';\n")
    assert 'ALLOWED_MIME_TYPES' not in s and 'MAX_FILE_SIZE_BYTES' not in s, f
    open(f, 'w').write(s)

PROV = re.compile(r"providers: \[\{ provide: (\w+), useValue: mockService \}\],")
for f in ctrls:
    sp = f.replace('.controller.ts', '.controller.spec.ts')
    assert os.path.exists(sp), sp
    s = open(sp).read()
    s, k = PROV.subn(r"providers: [\n        { provide: \1, useValue: mockService },\n        AttachmentPolicyService,\n        { provide: 'PRISMA_SYSTEM', useValue: noBuPrisma },\n      ],", s)
    assert k == 1, (sp, k)
    # แทรกหลัง import บรรทัดสุดท้าย
    last = [m.end() for m in re.finditer(r"^import [^;]+;\n", s, re.M)][-1]
    s = (s[:last]
         + "import { AttachmentPolicyService } from 'src/common/attachment-policy/attachment-policy.service';\n"
         + "\n// BU ไม่มี config = นโยบายเริ่มต้น (รูป + PDF 10MB) — เท่ากับค่าคงที่เดิมที่เทสต์ชุดนี้เขียนไว้\n"
         + "const noBuPrisma = { tb_business_unit: { findFirst: jest.fn().mockResolvedValue(null) } };\n"
         + s[last:])
    open(sp, 'w').write(s)
print('ok', len(ctrls))
```

ถ้า `assert` ล้มที่ไฟล์ไหน: เปิดไฟล์นั้นดูความต่าง แก้ regex ให้ครอบ แล้ว `git checkout -- apps/backend-gateway/src` ก่อนรันใหม่ทั้งชุด (ห้ามแก้ทีละไฟล์ด้วยมือแบบครึ่ง ๆ)

- [ ] **Step 2: รัน codemod + จัดรูป**

```bash
python3 /private/tmp/claude-501/-Users-samutpra-GitHub-carmensoftware-organize-carmen-inventory-frontend-react/7e9fae62-24fa-4709-a30c-b09932aa9925/scratchpad/codemod-attachment-policy.py
git diff --name-only | grep 'comments.controller' | xargs bunx prettier --write
```
Expected: `ok 46` และ diff แตะ 92 ไฟล์

- [ ] **Step 3: ตรวจว่าไม่เหลือของเก่า**

```bash
grep -rln "ALLOWED_MIME_TYPES\|MAX_FILE_SIZE_BYTES\|FilesInterceptor('files')" apps/backend-gateway/src --include='*comments.controller.ts' | wc -l
grep -rl "attachmentPolicy.assertFiles" apps/backend-gateway/src | wc -l
grep -rho "attachmentPolicy.assertFiles" apps/backend-gateway/src | wc -l
```
Expected: `0` · `46` · `138`

- [ ] **Step 4: typecheck + lint + เทสต์เดิมของ controller ทั้ง 46 ตัว**

```bash
cd apps/backend-gateway
bunx tsc --noEmit -p tsconfig.json
git diff --name-only -- src | sed 's#apps/backend-gateway/##' | xargs bunx eslint --quiet
bunx jest comments.controller
```
Expected: tsc/eslint ผ่าน · jest PASS ทุกไฟล์ (เคส "rejects a file that is too large" และ "rejects an unsupported mime type" ยังผ่านเพราะนโยบายเริ่มต้น = ค่าเดิม และยังเป็น `BadRequestException`)

- [ ] **Step 5: Commit**

```bash
git add apps/backend-gateway/src
git commit -m "refactor(comment): ตรวจไฟล์แนบ 46 controller ผ่าน AttachmentPolicyService แทนค่าคงที่ที่ copy ไว้ 138 จุด"
```

### Task 5: endpoint อ่านนโยบาย `GET api/:bu_code/attachment-policy`

**Files:**
- Create: `apps/backend-gateway/src/common/attachment-policy/attachment-policy.controller.ts`
- Modify: `apps/backend-gateway/src/common/attachment-policy/attachment-policy.module.ts` (เติม `controllers`)
- Modify: `scripts/swagger-sync/tag-mapping.json` (เพิ่ม mapping)
- Regenerate: `apps/backend-gateway/src/platform/applications/app-api-catalog.generated.ts`

**Interfaces:**
- Produces: `GET /api/:bu_code/attachment-policy` → `{ data: AttachmentPolicy, ... }` (std response) · api_name `attachmentPolicy.get`

- [ ] **Step 1: controller**

```ts
import { Controller, Get, HttpCode, HttpStatus, Param, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { BaseHttpController, Result } from '@/common';
import { AppIdGuard } from 'src/common/guard/app-id.guard';
import { BuCodePathQueryMatchGuard } from 'src/common/guard/bu-code-path-query-match.guard';
import { KeycloakGuard } from 'src/auth/guards/keycloak.guard';
import { PermissionGuard } from 'src/auth/guards/permission.guard';
import { ApiHeaderRequiredXAppId } from 'src/common/decorators/x-app-id.decorator';
import { AttachmentPolicyService } from './attachment-policy.service';

/**
 * นโยบายไฟล์แนบของ BU สำหรับ FE ใช้ตรวจก่อนอัปโหลดและตั้ง `accept` — ผู้ใช้ทุกคนของ BU อ่านได้
 * BuCodePathQueryMatchGuard: KeycloakGuard ตรวจ `?bu_code` ก่อน path จึงต้องบังคับให้ตรงกัน
 * (ดู memory keycloak-guard-query-bu-code-cross-tenant)
 */
@ApiHeaderRequiredXAppId()
@ApiTags('Documents: File Management')
@Controller('api/:bu_code/attachment-policy')
@UseGuards(BuCodePathQueryMatchGuard, KeycloakGuard, PermissionGuard)
@ApiBearerAuth()
export class AttachmentPolicyController extends BaseHttpController {
  constructor(private readonly service: AttachmentPolicyService) {
    super();
  }

  /**
   * Get the attachment policy of a business unit
   * ดูนโยบายไฟล์แนบของหน่วยธุรกิจ (ชนิด + ขนาดสูงสุด)
   * @param res - HTTP response / การตอบกลับ HTTP
   * @param bu_code - Business unit code / รหัสหน่วยธุรกิจ
   */
  @Get()
  @UseGuards(new AppIdGuard('attachmentPolicy.get'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get attachment policy',
    description:
      'Allowed file types and max size for comment attachments in this business unit.\n\nชนิดไฟล์และขนาดสูงสุดของไฟล์แนบ comment ใน BU นี้',
    operationId: 'attachmentPolicy_get',
  })
  @ApiParam({ name: 'bu_code', example: 'BU-001' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token' })
  async get(@Res() res: Response, @Param('bu_code') bu_code: string): Promise<void> {
    this.respond(res, Result.ok(await this.service.getPolicy(bu_code)));
  }
}
```

ตรวจ path ของ import (`@/common`, guard, decorator) เทียบกับ `src/application/dashboard-widgets/dashboard-bu-widgets.controller.ts` ที่ใช้รูปแบบเดียวกัน

- [ ] **Step 2: เติม controller ใน module** — ใน `attachment-policy.module.ts` เพิ่ม `import { AttachmentPolicyController } from './attachment-policy.controller';` และ `controllers: [AttachmentPolicyController],` เหนือ `providers`

- [ ] **Step 3: swagger mapping** — ใน `scripts/swagger-sync/tag-mapping.json` เพิ่ม
`"apps/backend-gateway/src/common/attachment-policy/attachment-policy.controller.ts": "Documents: File Management",` (เรียงตามตัวอักษรถ้าไฟล์เรียงอยู่) แล้วรัน `bun run swagger:verify` — Expected: ผ่าน

- [ ] **Step 4: ทะเบียน api_name**

```bash
bun run scripts/generate-app-api-catalog/run.ts
bun run audit:app-api-catalog-drift
grep -n "attachmentPolicy.get" apps/backend-gateway/src/platform/applications/app-api-catalog.generated.ts
```
Expected: generated มี `attachmentPolicy.get` · audit ไม่มี drift

- [ ] **Step 5: typecheck + lint + commit**

```bash
cd apps/backend-gateway && bunx tsc --noEmit -p tsconfig.json && bunx eslint src/common/attachment-policy && cd ../..
git add apps/backend-gateway scripts/swagger-sync/tag-mapping.json
git commit -m "feat(attachment): GET api/:bu_code/attachment-policy ให้ FE อ่านนโยบายไฟล์แนบของ BU"
```

### Task 6: ปิดช่องเขียนจากฝั่ง BU + ตรวจตอน platform เขียน

**Files:**
- Modify: `apps/backend-gateway/src/application/user-business-units/user-business-units.service.ts` (`updateCurrentBusinessUnit` :198 · `patchCurrentBusinessUnit` :227)
- Modify: `apps/backend-gateway/src/platform/platform_business-units/platform_business-units.controller.ts` (`createBusinessUnit` :355 · `updateBusinessUnit` :462)

**Interfaces:**
- Consumes: `isPlatformOnlyConfigEntry`, `findInvalidAttachmentConfig`, `ATTACHMENT_MAX_SIZE_MB_CEILING` (Task 2)

- [ ] **Step 1: PATCH — ทิ้ง entry `attachment.*` ที่ส่งมาก่อน merge**

ใน `patchCurrentBusinessUnit` แก้บรรทัด

```ts
      data.config = mergeConfigByKey(currentConfig, data.config);
```
เป็น
```ts
      // attachment.* ตั้งจาก platform เท่านั้น — ทิ้งของที่ส่งมา ค่าเดิมคงอยู่เพราะ merge ทับเฉพาะ key ที่ส่ง
      const incoming = Array.isArray(data.config)
        ? data.config.filter((e: unknown) => !isPlatformOnlyConfigEntry(e))
        : data.config;
      data.config = mergeConfigByKey(currentConfig, incoming);
```

- [ ] **Step 2: PUT — แทนทั้งก้อน จึงต้องต่อ entry `attachment.*` เดิมกลับเข้าไป**

ใน `updateCurrentBusinessUnit` หลัง `this.stripNonUserWritableFields(data);` และก่อน `data.id = resolved.value;` เพิ่ม

```ts
    if (data.config !== undefined) {
      // PUT แทน config ทั้งก้อน — ทิ้ง attachment.* ที่ส่งมาแล้วต่อของเดิมกลับ ไม่งั้นการบันทึกหน้า
      // Default Setting ของ inventory จะลบนโยบายไฟล์แนบที่ platform ตั้งไว้ทิ้งเงียบ ๆ
      const findResponse = await this.rpc.send(BusinessUnits.findOneForMember, {
        id: resolved.value,
        user_id: user_id,
        tenant_id: tenant_id,
        version: version,
      });
      if (findResponse.response.status !== HttpStatus.OK) {
        return Result.fromMicroserviceError(findResponse);
      }
      const currentConfig = (findResponse.data as Record<string, unknown>)?.config;
      const kept = Array.isArray(currentConfig) ? currentConfig.filter(isPlatformOnlyConfigEntry) : [];
      const incoming = Array.isArray(data.config)
        ? data.config.filter((e: unknown) => !isPlatformOnlyConfigEntry(e))
        : [];
      data.config = [...incoming, ...kept];
    }
```

เพิ่ม import `import { isPlatformOnlyConfigEntry } from 'src/common/attachment-policy/attachment-policy';` · ถ้าตัวแปร `resolved` ในฟังก์ชันนี้ชื่ออื่น ให้ใช้ชื่อที่มีอยู่ (ดูบรรทัด `data.id = …`) · ถ้า type ของ `data.config` ไม่ยอมรับ array ให้ cast เป็น `IBusinessUnitUpdate['config']`

- [ ] **Step 3: platform — ตรวจ entry `attachment.*` ก่อนเรียก service**

ใน `createBusinessUnit` และ `updateBusinessUnit` ของ `platform_business-units.controller.ts` เพิ่มบรรทัดแรกหลัง `this.logger.debug(...)`:

```ts
    const invalidAttachmentKey = findInvalidAttachmentConfig(createBusinessUnitDto.config);
    if (invalidAttachmentKey) {
      throw new BadRequestException({
        code: 'ATTACHMENT_POLICY_INVALID',
        key: invalidAttachmentKey,
        max_mb: ATTACHMENT_MAX_SIZE_MB_CEILING,
      });
    }
```
(ใน `updateBusinessUnit` ใช้ `updateBusinessUnitDto.config`) · import `BadRequestException` จาก `@nestjs/common` (ถ้ายังไม่มี) และ `findInvalidAttachmentConfig`, `ATTACHMENT_MAX_SIZE_MB_CEILING` จาก `src/common/attachment-policy/attachment-policy`

- [ ] **Step 4: typecheck + lint + เทสต์เดิมของสองไฟล์**

```bash
cd apps/backend-gateway
bunx tsc --noEmit -p tsconfig.json
bunx eslint src/application/user-business-units src/platform/platform_business-units
bunx jest user-business-units platform_business-units
```
Expected: ผ่านทั้งหมด · ถ้าเทสต์เดิมของ `updateCurrentBusinessUnit` ล้มเพราะ mock `rpc.send` ไม่ได้เตรียมไว้สำหรับ findOneForMember ในเส้น PUT ให้เติม mock ในเทสต์เคสนั้น (แก้ fixture ของเทสต์เดิม ไม่เพิ่มเคสใหม่)

- [ ] **Step 5: Commit**

```bash
git add apps/backend-gateway/src
git commit -m "fix(business-unit): ฝั่ง BU เขียน attachment.* ไม่ได้ (PUT คืนค่าเดิม, PATCH ทิ้ง) + platform ตรวจค่าก่อนเขียน"
```

### Task 7: ตรวจ BE ด้วยมือที่ `:4000` (ไม่ commit)

ต้องรัน gateway จาก branch นี้ในเครื่อง (ดู skill/README ของรีโป backend) · ใช้ BU **T02** · token: login `admin@zebra.com` ผ่าน `POST /api/auth/login` (อย่าเขียน token ลงไฟล์ที่ commit)

- [ ] **Step 1: backup config ของ T02**

```bash
psql "$PLATFORM_DB_URL" -Atc "select config from tb_business_unit where code='T02' and deleted_at is null" > /private/tmp/claude-501/-Users-samutpra-GitHub-carmensoftware-organize-carmen-inventory-frontend-react/7e9fae62-24fa-4709-a30c-b09932aa9925/scratchpad/t02-config-backup.json
```
(ถ้าไม่มี `PLATFORM_DB_URL` ในเครื่อง ให้ถาม user — ห้ามเดา connection string)

- [ ] **Step 2: นโยบายเริ่มต้น** — `GET /api/T02/attachment-policy` → `max_size_mb: 10`, `allowed_types: ["image","pdf"]` · POST comment ของ vendor (`/api/config/T02/vendor-comments/<vendor_id>`) ด้วย `.txt` → 400 `error.code = ATTACHMENT_TYPE_NOT_ALLOWED` · PDF 11MB → `ATTACHMENT_TOO_LARGE`

- [ ] **Step 3: ไฟล์ 30MB** → 400 `ATTACHMENT_TOO_LARGE` (ไม่ใช่ 413/500)

- [ ] **Step 4: ตั้งค่าผ่าน platform API** — `PUT /api-system/business-units/<T02 id>` ด้วย config เดิม + `{key:"attachment.allowed_types",label:"Attachment types",datatype:"json",value:["image","pdf","excel"]}` + `{key:"attachment.max_size_mb",label:"Attachment max size (MB)",datatype:"number",value:15}` → รอ 60 วิ (cache) → `.xlsx` 12MB ผ่าน · `x.xlsx;type=application/octet-stream` ผ่าน · `x.pdf;type=text/html` ถูกปฏิเสธ
  - ส่ง `value: 30` → 400 `ATTACHMENT_POLICY_INVALID`

- [ ] **Step 5: ฝั่ง BU เขียนไม่ได้** — `PATCH /api/business-units` ส่ง `config:[{key:"attachment.max_size_mb",value:25,...}]` และ `PUT /api/business-units` ส่ง config ที่**ไม่มี** `attachment.*` → อ่าน DB แล้ว `attachment.max_size_mb` ยังเป็น 15 และ `allowed_types` ยังอยู่ทั้งสองกรณี

- [ ] **Step 6: ค่าเป็นสตริง** — `UPDATE` ใน DB ให้ value เป็น `"20"` และ `'["image","word"]'` (สตริง JSON) → รอ cache → `GET attachment-policy` ได้ 20 และ `["image","word"]`

- [ ] **Step 7: คืนค่า config ของ T02 จาก backup แล้วยืนยันด้วย `GET attachment-policy` ว่ากลับเป็นค่าเริ่มต้น**

- [ ] **Step 8: push + PR (ยังไม่ merge — รอ user)**

```bash
git push -u origin feature/bu-attachment-policy
gh pr create --base main --title "feat(attachment): per-BU comment attachment policy (types + max size)" --body-file <(printf "## Summary\nPer-BU comment attachment policy (spec in carmen-inventory-frontend-react docs/superpowers/specs/2026-10-15-bu-attachment-policy-design.md): AttachmentPolicyService + one shared check replaces 138 copied checks in 46 comment controllers; multer limit 25MB; GET api/:bu_code/attachment-policy; BU-side PUT/PATCH cannot write attachment.*; platform write validation; 3 catalog codes.\n\n## Deploy note\nAdd api_name attachmentPolicy.get to the allowlist of every env that is not allow_all BEFORE deploying the inventory FE. BUs without settings keep today's behavior (images + PDF, 10MB).\n\n## Test plan\n<paste the Task 7 curl results>\n")
```

---

## รีโป 2: `carmen-platform`

```bash
cd ../carmen-platform && git fetch -q origin && git checkout -b feature/bu-attachment-policy origin/main
```

### Task 8: section ตั้งค่านโยบายไฟล์แนบในหน้าแก้ BU

**Files:**
- Create: `src/constants/attachmentTypes.ts`
- Create: `src/pages/businessUnitEdit/sections/AttachmentPolicySection.tsx`
- Modify: `src/pages/businessUnitEdit/sections/ConfigurationSection.tsx` (ซ่อน key `attachment.*`)
- Modify: `src/pages/businessUnitEdit/BusinessUnitDocument.tsx` (render section ในแท็บ `technical` ก่อน `ConfigurationSection` + รับ prop ใหม่)
- Modify: `src/pages/BusinessUnitEdit.tsx` (handler `setAttachmentPolicy` + ส่ง prop)
- Modify: `src/i18n/en.ts`, `src/i18n/th.ts` (คีย์ใต้ `pages.businessUnits`)

**Interfaces:**
- Produces: `ATTACHMENT_TYPE_GROUPS: readonly { code: AttachmentTypeCode; labelKey: string }[]`, `ATTACHMENT_KEYS`, `ATTACHMENT_DEFAULT_TYPES`, `ATTACHMENT_DEFAULT_MAX_MB = 10`, `ATTACHMENT_MAX_MB = 25`, `isAttachmentKey(key: string): boolean`
- `AttachmentPolicySection` props: `{ formData: BusinessUnitFormData; editing: boolean; onChange: (next: { allowed_types: string[]; max_size_mb: number } | null) => void }` — `null` = คืนค่าเริ่มต้น (ลบสอง entry)

- [ ] **Step 1: constants**

```ts
/**
 * กลุ่มชนิดไฟล์แนบ comment ที่เลือกเปิดให้ BU ได้ — ต้องตรงกับ backend
 * `apps/backend-gateway/src/common/attachment-policy/attachment-policy.ts` (ATTACHMENT_TYPE_GROUPS)
 * gateway เป็นด่านจริง: ส่งรหัสที่ไม่รู้จักไปจะได้ 400 ATTACHMENT_POLICY_INVALID
 */
export const ATTACHMENT_KEYS = {
  allowedTypes: 'attachment.allowed_types',
  maxSizeMb: 'attachment.max_size_mb',
} as const;
export const ATTACHMENT_KEY_PREFIX = 'attachment.';
export const isAttachmentKey = (key: string | undefined) => !!key && key.startsWith(ATTACHMENT_KEY_PREFIX);

export type AttachmentTypeCode = 'image' | 'pdf' | 'excel' | 'word' | 'csv' | 'text';
export const ATTACHMENT_TYPE_GROUPS: readonly { code: AttachmentTypeCode; labelKey: string }[] = [
  { code: 'image', labelKey: 'pages.businessUnits.attachmentTypeImage' },
  { code: 'pdf', labelKey: 'pages.businessUnits.attachmentTypePdf' },
  { code: 'excel', labelKey: 'pages.businessUnits.attachmentTypeExcel' },
  { code: 'word', labelKey: 'pages.businessUnits.attachmentTypeWord' },
  { code: 'csv', labelKey: 'pages.businessUnits.attachmentTypeCsv' },
  { code: 'text', labelKey: 'pages.businessUnits.attachmentTypeText' },
];
export const ATTACHMENT_DEFAULT_TYPES: readonly AttachmentTypeCode[] = ['image', 'pdf'];
export const ATTACHMENT_DEFAULT_MAX_MB = 10;
export const ATTACHMENT_MAX_MB = 25;
```

- [ ] **Step 2: i18n** — ใต้ `pages.businessUnits` ใน `en.ts` / `th.ts` (หา object เดียวกับที่มี `configDescription`) เพิ่ม:

| key | en | th |
|---|---|---|
| `attachmentPolicyTitle` | Comment attachments | ไฟล์แนบใน comment |
| `attachmentPolicyDescription` | File types and max size users of this business unit can attach to comments. | ชนิดไฟล์และขนาดสูงสุดที่ผู้ใช้ของหน่วยธุรกิจนี้แนบใน comment ได้ |
| `attachmentTypesLabel` | Allowed file types | ชนิดไฟล์ที่อนุญาต |
| `attachmentMaxSizeLabel` | Max size per file (MB) | ขนาดสูงสุดต่อไฟล์ (MB) |
| `attachmentDefaultHint` | Not set — using the default: images and PDF, up to 10 MB | ยังไม่ได้ตั้ง — ใช้ค่าเริ่มต้น: รูปภาพและ PDF ไม่เกิน 10 MB |
| `attachmentReset` | Reset to default | คืนค่าเริ่มต้น |
| `attachmentTypesRequired` | Select at least one file type | เลือกอย่างน้อยหนึ่งชนิด |
| `attachmentMaxSizeRange` | Must be a whole number from 1 to 25 | ต้องเป็นจำนวนเต็ม 1–25 |
| `attachmentMacroWarning` | Excel and Word files may contain macros and are not virus-scanned. | ไฟล์ Excel และ Word อาจมี macro และไม่ได้ผ่านการสแกนไวรัส |
| `attachmentTypeImage` | Images (JPG, PNG, WEBP, GIF) | รูปภาพ (JPG, PNG, WEBP, GIF) |
| `attachmentTypePdf` | PDF | PDF |
| `attachmentTypeExcel` | Excel (XLSX, XLS) | Excel (XLSX, XLS) |
| `attachmentTypeWord` | Word (DOCX, DOC) | Word (DOCX, DOC) |
| `attachmentTypeCsv` | CSV | CSV |
| `attachmentTypeText` | Text (TXT) | ข้อความ (TXT) |

ถ้ารีโปมีไฟล์ type ของ i18n (`src/i18n/types.ts`) ที่สร้างจาก `en.ts` ให้ทำตามวิธีที่ไฟล์นั้นกำหนด

- [ ] **Step 3: section component** — วางตามแบบ `CalculationSettingsSection.tsx` (`CollapsibleSection`, `Label`, `Input`, `useI18n`)

```tsx
import React from 'react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { CollapsibleSection } from '../shared';
import { useI18n } from '../../../hooks/useI18n';
import type { SectionFieldProps } from '../types';
import {
  ATTACHMENT_DEFAULT_MAX_MB,
  ATTACHMENT_DEFAULT_TYPES,
  ATTACHMENT_KEYS,
  ATTACHMENT_MAX_MB,
  ATTACHMENT_TYPE_GROUPS,
  type AttachmentTypeCode,
} from '../../../constants/attachmentTypes';

export interface AttachmentPolicyValue {
  allowed_types: AttachmentTypeCode[];
  max_size_mb: number;
}

interface AttachmentPolicySectionProps extends SectionFieldProps {
  /** null = คืนค่าเริ่มต้น (ลบสอง entry ทิ้ง ให้ตามค่าเริ่มต้นของระบบ) */
  onAttachmentPolicyChange: (next: AttachmentPolicyValue | null) => void;
}

/** อ่านค่าจาก config — ค่าที่เป็นสตริง (แก้ผ่านตัวแก้ทั่วไปมาก่อน) ก็อ่านได้ */
export const readAttachmentPolicy = (
  config: { key: string; value?: unknown }[],
): AttachmentPolicyValue | null => {
  const types = config.find((c) => c.key === ATTACHMENT_KEYS.allowedTypes)?.value;
  const size = config.find((c) => c.key === ATTACHMENT_KEYS.maxSizeMb)?.value;
  if (types === undefined && size === undefined) return null;
  let parsed: unknown = types;
  if (typeof types === 'string') {
    try { parsed = JSON.parse(types); } catch { parsed = []; }
  }
  const valid = ATTACHMENT_TYPE_GROUPS.map((g) => g.code);
  const allowed = Array.isArray(parsed) ? parsed.filter((v): v is AttachmentTypeCode => valid.includes(v)) : [];
  const n = Number(size);
  return {
    allowed_types: allowed.length > 0 ? allowed : [...ATTACHMENT_DEFAULT_TYPES],
    max_size_mb: Number.isInteger(n) && n >= 1 && n <= ATTACHMENT_MAX_MB ? n : ATTACHMENT_DEFAULT_MAX_MB,
  };
};

const AttachmentPolicySection: React.FC<AttachmentPolicySectionProps> = ({ formData, editing, onAttachmentPolicyChange }) => {
  const { t } = useI18n();
  const current = readAttachmentPolicy(formData.config);
  const effective: AttachmentPolicyValue = current ?? {
    allowed_types: [...ATTACHMENT_DEFAULT_TYPES],
    max_size_mb: ATTACHMENT_DEFAULT_MAX_MB,
  };
  const toggle = (code: AttachmentTypeCode, on: boolean) => {
    const next = on
      ? [...effective.allowed_types, code]
      : effective.allowed_types.filter((c) => c !== code);
    onAttachmentPolicyChange({ ...effective, allowed_types: ATTACHMENT_TYPE_GROUPS.map((g) => g.code).filter((c) => next.includes(c)) });
  };
  const typesError = effective.allowed_types.length === 0;
  const sizeError = !Number.isInteger(effective.max_size_mb) || effective.max_size_mb < 1 || effective.max_size_mb > ATTACHMENT_MAX_MB;
  const hasOffice = effective.allowed_types.some((c) => c === 'excel' || c === 'word');

  return (
    <CollapsibleSection title={t('pages.businessUnits.attachmentPolicyTitle')} description={t('pages.businessUnits.attachmentPolicyDescription')} forceOpen>
      <div className="space-y-4">
        {!current && <p className="text-sm text-muted-foreground">{t('pages.businessUnits.attachmentDefaultHint')}</p>}
        <div className="space-y-2">
          <Label>{t('pages.businessUnits.attachmentTypesLabel')}</Label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ATTACHMENT_TYPE_GROUPS.map((g) => (
              <label key={g.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!editing}
                  checked={effective.allowed_types.includes(g.code)}
                  onChange={(e) => toggle(g.code, e.target.checked)}
                />
                {t(g.labelKey)}
              </label>
            ))}
          </div>
          {editing && typesError && <p className="text-sm text-destructive">{t('pages.businessUnits.attachmentTypesRequired')}</p>}
          {hasOffice && <p className="text-sm text-muted-foreground">{t('pages.businessUnits.attachmentMacroWarning')}</p>}
        </div>
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="attachment-max-size">{t('pages.businessUnits.attachmentMaxSizeLabel')}</Label>
          <Input
            id="attachment-max-size"
            type="number"
            min={1}
            max={ATTACHMENT_MAX_MB}
            step={1}
            disabled={!editing}
            value={effective.max_size_mb}
            onChange={(e) => onAttachmentPolicyChange({ ...effective, max_size_mb: Number(e.target.value) })}
          />
          {editing && sizeError && <p className="text-sm text-destructive">{t('pages.businessUnits.attachmentMaxSizeRange')}</p>}
        </div>
        {editing && current && (
          <Button type="button" variant="outline" size="sm" onClick={() => onAttachmentPolicyChange(null)}>
            {t('pages.businessUnits.attachmentReset')}
          </Button>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default AttachmentPolicySection;
```

ถ้ารีโปมี checkbox primitive ใน `src/components/ui/` (เช่น `checkbox.tsx`) ให้ใช้ตัวนั้นแทน `<input type="checkbox">` · `SectionFieldProps` ต้องมี `formData` และ `editing` (ดู `../types`) ถ้าไม่ตรงให้ปรับ props ตามจริง

- [ ] **Step 4: handler ใน `BusinessUnitEdit.tsx`** ข้าง `handleConfigChange` (บรรทัด ~377)

```ts
  // นโยบายไฟล์แนบ — เขียนเป็น entry ใน config · null = ลบสอง entry ทิ้ง (ตามค่าเริ่มต้นของระบบ)
  const setAttachmentPolicy = (next: AttachmentPolicyValue | null) => {
    setFormData((prev) => {
      const rest = prev.config.filter((c) => !isAttachmentKey(c.key));
      if (!next) return { ...prev, config: rest };
      return {
        ...prev,
        config: [
          ...rest,
          { key: ATTACHMENT_KEYS.allowedTypes, label: 'Attachment types', datatype: 'json', value: next.allowed_types },
          { key: ATTACHMENT_KEYS.maxSizeMb, label: 'Attachment max size (MB)', datatype: 'number', value: next.max_size_mb },
        ],
      };
    });
  };
```
ใช้ชื่อ setter ของ form state ตามที่ไฟล์ใช้จริง (`handleConfigChange` ใช้ตัวไหนก็ใช้ตัวนั้น) · ส่ง `onAttachmentPolicyChange={setAttachmentPolicy}` ไปที่ `BusinessUnitDocument` (บรรทัด ~737) · ใน `handleSave` ถ้า `readAttachmentPolicy(formData.config)` ผิดเงื่อนไข (types ว่าง / size นอก 1–25) ให้หยุดบันทึกและ toast `attachmentTypesRequired` / `attachmentMaxSizeRange` ตามแบบ validation อื่นในไฟล์

- [ ] **Step 5: `BusinessUnitDocument.tsx`** — เพิ่ม prop `onAttachmentPolicyChange` ใน `BusinessUnitDocumentProps` และ render `<AttachmentPolicySection {...sectionField} onAttachmentPolicyChange={onAttachmentPolicyChange} />` ก่อน `<ConfigurationSection` ในแท็บ `technical` (บรรทัด ~363) · `clusterAdmin/BusinessUnitForm.tsx` **ไม่แตะ** (ถ้า TS บังคับ prop ให้ทำเป็น optional แล้ว render section เฉพาะเมื่อมี prop)

- [ ] **Step 6: ซ่อน key `attachment.*` ใน `ConfigurationSection.tsx`**
  - โหมดแก้ไข: ใน `formData.config.map((item, index) => …)` ให้ `if (isAttachmentKey(item.key)) return null;` ก่อน JSX (คง `index` เดิมของ formData.config ไว้ — ห้าม filter ก่อน map)
  - โหมดดู: `viewRows` = `sortRows(formData.config.filter((c) => !isAttachmentKey(c.key)), sort, sortAccessor)` และข้อความ "ไม่มี entry" ใช้จำนวนหลังกรอง

- [ ] **Step 7: typecheck + lint + เทสต์เดิม**

```bash
bunx tsc --noEmit && bun run lint && bun run test -- --run
```
(ใช้สคริปต์ที่ `package.json` ของ platform กำหนดจริง) Expected: ผ่าน

- [ ] **Step 8: Commit + push + PR (ยังไม่ merge)**

```bash
git add -A && git commit -m "feat(business-unit): ตั้งนโยบายไฟล์แนบ comment (ชนิด + ขนาด) ต่อ BU"
git push -u origin feature/bu-attachment-policy
gh pr create --base main --title "feat(business-unit): per-BU comment attachment policy" --body "Adds an Attachment policy section (file type groups + max MB, 1–25) to the platform BU edit page and hides attachment.* keys from the generic config editor. Deploy AFTER the backend PR (backend validates and enforces)."
```

---

## รีโป 3: `carmen-inventory-frontend-react` (branch `feature/bu-attachment-policy` ที่มี spec อยู่แล้ว)

### Task 9: ใช้นโยบายของ BU ในแผง comment และ notes dialog

**Files:**
- Create: `lib/attachment-policy.ts`
- Create: `hooks/use-attachment-policy.ts`
- Modify: `constant/api-endpoints.ts` (`ATTACHMENT_POLICY`) · `constant/query-keys.ts` (`ATTACHMENT_POLICY`)
- Modify: `components/ui/comment-sheet.tsx` (prop `attachmentPolicy` แทน `ALLOWED_TYPES`/`MAX_FILE_SIZE`/`ACCEPT`)
- Modify: `components/share/entity-comment-sheet.tsx` (เรียก hook ส่ง prop)
- Modify: `routes/inventory-management/shared/entry-notes-dialog.tsx` (`MAX_BYTES`/`ACCEPT` → นโยบาย)
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Produces: `interface AttachmentPolicy { allowed_types: string[]; max_size_mb: number; mime_types: string[]; extensions: string[] }` · `DEFAULT_ATTACHMENT_POLICY` · `isFileAllowed(file: File, policy): boolean` · `acceptFor(policy): string` · `maxBytesOf(policy): number` · `useAttachmentPolicy(): AttachmentPolicy`

- [ ] **Step 1: `lib/attachment-policy.ts`**

```ts
/**
 * นโยบายไฟล์แนบ comment ของ BU — ค่าจริงมาจาก `GET api/:bu_code/attachment-policy` (ตั้งจาก carmen-platform)
 * ค่าเริ่มต้นต้องเท่ากับของ backend (`attachment-policy.ts` ใน backend-gateway): ใช้ระหว่างโหลด / ดึงไม่สำเร็จ
 * backend เป็นด่านจริง — ฝั่งนี้แค่ช่วยให้ผู้ใช้รู้ก่อนอัปโหลด
 */
export interface AttachmentPolicy {
  allowed_types: string[];
  max_size_mb: number;
  mime_types: string[];
  extensions: string[];
}

export const DEFAULT_ATTACHMENT_POLICY: AttachmentPolicy = {
  allowed_types: ["image", "pdf"],
  max_size_mb: 10,
  mime_types: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"],
  extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"],
};

/** MIME ที่ไม่บอกอะไร — กรณีนี้เท่านั้นที่ถอยไปดูนามสกุล (กติกาเดียวกับ backend) */
const NEUTRAL_MIME = new Set(["", "application/octet-stream"]);

export function isFileAllowed(file: File, policy: AttachmentPolicy): boolean {
  const mime = file.type.toLowerCase().trim();
  if (!NEUTRAL_MIME.has(mime)) return policy.mime_types.includes(mime);
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  return ext !== "" && policy.extensions.includes(ext);
}

/** ค่า `accept` ของ file picker — ใส่ทั้ง MIME และนามสกุล เพราะบาง OS กรองด้วยนามสกุลเท่านั้น */
export const acceptFor = (policy: AttachmentPolicy) =>
  [...policy.mime_types, ...policy.extensions].join(",");

export const maxBytesOf = (policy: AttachmentPolicy) => policy.max_size_mb * 1024 * 1024;

/** รายการนามสกุลสำหรับข้อความเตือน เช่น "JPG, PNG, PDF, XLSX" */
export const typesLabel = (policy: AttachmentPolicy) =>
  [...new Set(policy.extensions.map((e) => e.replace(".", "").toUpperCase()))]
    .filter((e) => e !== "JPEG")
    .join(", ");
```

- [ ] **Step 2: endpoint + query key**

`constant/api-endpoints.ts` (เรียงตามตัวอักษรใกล้ ๆ `ADJUSTMENT_*`/`A…`):
```ts
  ATTACHMENT_POLICY: (buCode: string) =>
    `/api/proxy/api/${buCode}/attachment-policy`,
```
`constant/query-keys.ts`: `ATTACHMENT_POLICY: "attachment-policy",`

- [ ] **Step 3: `hooks/use-attachment-policy.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import { CACHE_STATIC } from "@/lib/cache-config";
import { QUERY_KEYS } from "@/constant/query-keys";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import {
  DEFAULT_ATTACHMENT_POLICY,
  type AttachmentPolicy,
} from "@/lib/attachment-policy";

/**
 * นโยบายไฟล์แนบของ BU ปัจจุบัน — ระหว่างโหลด / ดึงไม่สำเร็จ (เช่น backend ยังไม่ deploy ได้ 404)
 * คืนค่าเริ่มต้นแทน ไม่บล็อกการแนบไฟล์ · key ผูก buCode สลับ BU แล้วได้ค่าใหม่
 * query error ไม่ขึ้น toast (MutationCache เท่านั้นที่ toast) จึงไม่ต้องกดเงียบ
 */
export function useAttachmentPolicy(): AttachmentPolicy {
  const buCode = useBuCode();
  const { data } = useQuery<AttachmentPolicy, ApiError>({
    queryKey: [QUERY_KEYS.ATTACHMENT_POLICY, buCode],
    queryFn: async () => {
      const res = await httpClient.get(API_ENDPOINTS.ATTACHMENT_POLICY(buCode!));
      if (!res.ok)
        throw await ApiError.from(res, "Failed to fetch attachment policy");
      const json = await res.json();
      return json.data;
    },
    ...CACHE_STATIC,
    retry: false,
    enabled: !!buCode,
  });
  return data ?? DEFAULT_ATTACHMENT_POLICY;
}
```

- [ ] **Step 4: `comment-sheet.tsx`**
  - ลบ `MAX_FILE_SIZE`, `ALLOWED_TYPES`, `ACCEPT` และคอมเมนต์ที่ผูกกับมัน (บรรทัด ~90–102)
  - เพิ่ม prop `readonly attachmentPolicy?: AttachmentPolicy;` ใน `CommentSheetProps` และ destructure `attachmentPolicy = DEFAULT_ATTACHMENT_POLICY`
  - ใน `handleFileSelect` แทนเงื่อนไขเดิม:
    ```ts
      if (!isFileAllowed(file, attachmentPolicy)) {
        toast.warning(
          t("fileNotAllowed", { name: file.name, types: typesLabel(attachmentPolicy) }),
        );
      } else if (file.size > maxBytesOf(attachmentPolicy)) {
        toast.warning(
          t("fileTooLarge", { name: file.name, max: attachmentPolicy.max_size_mb }),
        );
      } else {
    ```
  - `accept={ACCEPT}` → `accept={acceptFor(attachmentPolicy)}`
  - import `DEFAULT_ATTACHMENT_POLICY, acceptFor, isFileAllowed, maxBytesOf, typesLabel, type AttachmentPolicy` จาก `@/lib/attachment-policy`

- [ ] **Step 5: `entity-comment-sheet.tsx`** — `const attachmentPolicy = useAttachmentPolicy();` แล้วส่ง `attachmentPolicy={attachmentPolicy}` ให้ `CommentSheet`

- [ ] **Step 6: `entry-notes-dialog.tsx`** (UI รูปหลักฐาน — รับเฉพาะ `image/*` ที่อยู่ในนโยบาย)
  - ลบ `MAX_BYTES` และ `ACCEPT` (บรรทัด 61–62)
  - ในคอมโพเนนต์: 
    ```ts
      const policy = useAttachmentPolicy();
      // UI นี้แสดง thumbnail — รับแค่รูปที่นโยบายของ BU เปิดไว้ ขนาดตามนโยบาย (เดิมตายตัว 3MB)
      const imageMimes = policy.mime_types.filter((m) => m.startsWith("image/"));
      const maxBytes = maxBytesOf(policy);
    ```
  - `addFiles`: `if (!imageMimes.includes(file.type.toLowerCase()))` → `evidenceNotImage` · `if (file.size > maxBytes)` → `t("evidenceTooLarge", { name: file.name, max: policy.max_size_mb })`
  - `accept={ACCEPT}` → `accept={imageMimes.join(",")}`
  - import `useAttachmentPolicy` จาก `@/hooks/use-attachment-policy` และ `maxBytesOf` จาก `@/lib/attachment-policy`

- [ ] **Step 7: ข้อความ** (`messages/en.json` / `th.json` — ห้ามมี `{{ }}`)

| key | en | th |
|---|---|---|
| `commentSheet.fileNotAllowed` | `"{name}" — only {types} files are allowed` | `"{name}" — แนบได้เฉพาะไฟล์ {types}` |
| `commentSheet.fileTooLarge` | `"{name}" exceeds {max} MB limit` | `"{name}" มีขนาดเกิน {max} MB` |
| `inventoryManagement.entryDialogs.evidenceTooLarge` | `"{name}" exceeds {max} MB limit` | `"{name}" มีขนาดเกิน {max} MB` |

แล้ว `grep -rn "evidenceMaxSize" routes components` — ถ้ามีผู้ใช้ ให้เปลี่ยนข้อความเป็น `Max {max} MB per image` / `ไม่เกิน {max} MB ต่อรูป` และส่ง `{ max: policy.max_size_mb }` · ถ้าไม่มีผู้ใช้ ไม่ต้องแตะ

- [ ] **Step 8: static check + เทสต์เดิม**

```bash
git diff --name-only | xargs bunx prettier --write
bun run typecheck
git diff --name-only -- '*.ts' '*.tsx' | xargs bunx eslint --quiet
bun test:run lib/__tests__ components/ui/type-ladder.test.ts routes/inventory-management
```
Expected: ผ่านทั้งหมด

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(comment): ใช้นโยบายไฟล์แนบของ BU (ชนิด + ขนาด) ในแผง comment และ notes dialog"
```

### Task 10: ตรวจ end-to-end ด้วยมือ + PR (ไม่ merge จนกว่า user สั่ง)

- [ ] **Step 1:** gateway จาก branch ของ Task 1–6 รันอยู่ที่ `:4000` · platform dev server จาก Task 8 · inventory `bun dev` (`:3000`) · backup config T02 (Task 7 Step 1)
- [ ] **Step 2:** platform → แก้ BU T02 → เปิด Excel + 15 MB → บันทึก → ตัวแก้ config ทั่วไปไม่แสดง `attachment.*`
- [ ] **Step 3:** รอ ≤ 60 วิ → inventory หน้า vendor A001 → Comment → `input[type=file]` มี `accept` รวม `.xlsx` · แนบ `.xlsx` ได้ (201) · `.txt` ขึ้นเตือนพร้อมรายการชนิด · ไฟล์ 16MB ขึ้นเตือน 15 MB
- [ ] **Step 4:** หน้า Default Setting ของ inventory → บันทึกอะไรก็ได้ → platform ยังเห็น Excel + 15 MB (ยืนยัน PUT/PATCH ไม่ลบ)
- [ ] **Step 5:** spot-check / physical-count notes dialog → `accept` เป็นรูปเท่านั้น · รูป 12MB ผ่าน (เดิมเกิน 3MB)
- [ ] **Step 6:** หยุด gateway ตัวใหม่ แล้วรัน gateway จาก `main` (ยังไม่มี endpoint) → inventory เปิดแผง comment → แนบรูปได้ตามค่าเริ่มต้น **และไม่ถูก logout**
- [ ] **Step 7:** platform → "คืนค่าเริ่มต้น" → บันทึก → DB ไม่มี entry `attachment.*` · คืน config T02 จาก backup · ลบ comment ทดสอบทั้งหมด
- [ ] **Step 8:** push + PR ของ inventory (body: ต้อง deploy หลัง BE + allowlist `attachmentPolicy.get` · ลิงก์ PR ของ BE และ platform) · รายงานผลให้ user แล้ว**รอคำสั่ง merge**
