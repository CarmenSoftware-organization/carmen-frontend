# Inbound API key + Inventory Posting Export (ช่วง 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API key หนึ่งใบต่อ BU ที่จัดการเองได้ในหน้า Interface → External และ endpoint `GET /api/ext/v1/inventory-postings` ที่คืนคู่ Dr/Cr ของ GRN/CN/SR/SI/SO

**Architecture:** ตาราง platform `tb_bu_api_key` + `tb_external_api` (รายการ api_name+method ที่อนุญาต) · micro-business `authen/bu_api_key/` จัดการ key (แบบ `mcp_token`) · gateway `BuApiKeyGuard` (CanActivate ของตัวเอง — **ไม่ใช้ขั้น membership ของ KeycloakGuard** เพราะไม่มี user) ปักหมุด BU, ตรวจ allowlist/license/rate limit · micro-business `inventory/inventory-posting/` สร้างเอกสาร posting โดยรันใน tenant context แบบไม่มี user (`runWithApiKey` ตามแบบ `runWithExternalToken`) และ resolve บัญชีด้วย `AccountMappingService.resolveKeys` ของช่วง 1

**Tech Stack:** NestJS + Prisma 7 (platform/tenant), RPC contract package, Vite React FE

**Spec:** `docs/superpowers/specs/2026-10-16-inbound-api-key-inventory-posting-design.md` · **ต้องทำหลัง** `docs/superpowers/plans/2026-10-16-contra-account-defaults.md`

## Global Constraints

- **ข้ามขั้นเขียนเทสต์ใหม่** (CLAUDE.md ของ user); spec เดิมต้องผ่าน; ปิดทุก task ด้วย tsc + eslint ของ app ที่แตะ
- BE jest (`bunx jest`), ห้าม `bun test`; commit ภาษาไทย; branch `feature/inbound-api-key-inventory-posting` ทั้งสองรีโป
- credential: header `x-client-id` + `x-client-secret`; secret เก็บทั้ง sha256 hex (ตรวจ) และ `encryptSecret()` ของ `packages/secret-crypto` (View)
- regenerate = เขียนทับแถวเดิม → secret เก่าตายทันที; หนึ่งแถวที่ยังไม่ลบต่อ BU
- license ที่ต้องมี: `interface.accounting.external` ใน `features` ของ BU และ state ไม่หมดอายุ
- rate limit ต่อ key: 300/นาที (`FixedWindowRateLimiter`, key = row id)
- ห้ามใช้ `resolveForPosting` (มัน insert แถว mapping); ใช้ `resolveKeys`
- skip ตัดเฉพาะ location consignment; อื่น ๆ ส่งพร้อม `unmapped`
- api_name ใหม่ของ endpoint จัดการ key → regenerate `apps/backend-gateway/src/platform/applications/app-api-catalog.generated.ts` และ **เติม allowlist ทุก env ก่อน deploy FE** (ไม่งั้น user โดน logout)
- `SECRET_ENCRYPTION_KEY` ต้องมีใน micro-business (validate อยู่แล้วที่ `libs/config.env.ts:88`)

## Review Focus

1. ส่ง `bu_code` ของ BU อื่นมาใน query/path ของ endpoint ส่งออก → ต้องยังได้ข้อมูล BU ของ key เท่านั้น (guard เขียนทับ, controller ไม่อ่าน bu_code จาก request) → Task 3 Step 5
2. key ถูก deactivate / regenerate / BU ถูกปิด / license หมดอายุ ระหว่างที่ระบบบัญชีกำลังดึง → 401/403 ทันทีใน request ถัดไป (ไม่มี cache ของแถว key) → Task 3
3. เอกสารที่ Dr ≠ Cr (ต้นทุน cost layer ปัดเศษ, VAT ปัด) → `balanced:false` ต้องโชว์ ไม่ใช่แอบปรับยอด → Task 5
4. ช่วงวันที่กว้าง (ทั้งปี) → ต้องแบ่งหน้าและ perpage สูงสุด 200, ไม่ query cost layer แบบ N+1 → Task 5
5. View secret ถูกเรียกโดย user ที่ไม่ใช่สมาชิก BU (ผ่าน bu_code ใน query คนละอันกับ path) → KeycloakGuard + handler ต้องใช้ bu_code ตัวเดียวกัน (กับดัก query vs path) → Task 2 Step 3

---

### Task 1: Platform schema + migration + secret helpers

**Files:**
- Create: `packages/prisma-shared-schema-platform/prisma/migrations/20261016150000_bu_api_key/migration.sql`
- Modify: `packages/prisma-shared-schema-platform/prisma/schema.prisma` (ข้าง `tb_mcp_token` :595)
- Create: `packages/prisma-shared-schema-platform/src/bu-api-key.ts` (+ export จาก index ของ package ตามแบบ `mcp-token.ts`)

**Interfaces:**
- Produces:
  ```ts
  // tb_bu_api_key: id uuid pk, business_unit_id uuid fk→tb_business_unit, client_id varchar unique,
  //   secret_hash varchar, secret_ciphertext text, secret_last4 varchar(4), is_active bool default true,
  //   last_used_at timestamptz?, created_at/by, updated_at/by, deleted_at/by
  //   partial unique (business_unit_id) WHERE deleted_at IS NULL
  // tb_external_api: id, api_name varchar, http_method varchar, is_enabled bool default true, description?, audit
  //   unique (api_name, http_method); seed: ('inventoryPosting.list','GET')
  mintBuApiClientId(): string            // 'ck_' + 16 random bytes base64url
  mintBuApiSecret(): string              // 'cs_' + 32 random bytes base64url
  hashBuApiSecret(secret: string): string                 // sha256 hex
  isSameBuApiSecretHash(a: string, b: string): boolean    // timingSafeEqual, false เมื่อความยาวต่าง
  ```

- [ ] **Step 1:** migration SQL (idempotent, คอมเมนต์ไทย) + model ใน schema + generate client + build dist ของ package ที่ gateway/micro ใช้
- [ ] **Step 2:** helpers ตามแบบ `mcp-token.ts:12-44`
- [ ] **Step 3:** รัน migration platform บน dev (backup ก่อน) — ตรวจตารางและแถว seed
- [ ] **Step 4:** Commit `feat(platform): ตาราง tb_bu_api_key และ tb_external_api`

### Task 2: micro-business + gateway — จัดการ key

**Files:**
- Create: `apps/micro-business/src/authen/bu_api_key/{bu_api_key.module.ts,bu_api_key.controller.ts,bu_api_key.service.ts}` (แบบ `authen/mcp_token/`)
- Create: `packages/rpc-contract/src/contracts/bu-api-keys.ts` (ผ่าน `bun run gen:rpc-contract`)
- Create: `apps/backend-gateway/src/config/config_bu-api-key/{module,controller,service}.ts` + `swagger/`
- Modify: `apps/backend-gateway/src/app.module.ts`, `apps/micro-business/src/app.module.ts`
- Modify: `packages/prisma-shared-schema-platform/prisma/permission.route-map.ts` (`LICENSE_ROUTE_OVERRIDES` :259 → `'config:bu-api-key': 'interface.accounting.external'`) แล้ว regenerate license catalog
- Regenerate: `app-api-catalog.generated.ts`

**Interfaces:**
- Produces RPC `bu-api-keys.get | create | regenerate | set-active | reveal` payload `{ user_id, bu_code, is_active? }`
- Gateway routes (KeycloakGuard + `new AppIdGuard('buApiKey.<action>')`), base `api/config/:bu_code/bu-api-key`:
  - `GET` → `{ exists, client_id, secret_last4, is_active, last_used_at, created_by_name, created_at, base_url }` (ไม่มี secret)
  - `POST` (create; 409 ถ้ามีแล้ว) → `{ client_id, secret }`
  - `POST regenerate` → `{ client_id, secret }`
  - `PATCH` `{ is_active: boolean }`
  - `POST reveal` → `{ secret }` + `logTenantEvent('view', 'bu_api_key', id, ctx)`
- `base_url` = `${PUBLIC_API_BASE_URL}/api/ext/v1` (env ใหม่ของ gateway; ถ้าไม่ตั้ง ให้ FE แสดง origin ของ BACKEND_URL)

- [ ] **Step 1:** service: create/regenerate ใช้ helper Task 1, เก็บ hash + `encryptSecret` + last4; reveal ใช้ `decryptSecret`; ทุก write ห่อ `runWithAuditContext` ตามแบบ `mcp_token.controller.ts`; create/regenerate/set-active log activity ด้วย
- [ ] **Step 2:** gateway controller/service + swagger + เชื่อม module ทั้งสองฝั่ง
- [ ] **Step 3:** ทุก handler อ่าน `bu_code` จาก `@Param` เท่านั้น และตรวจว่าไม่มี `query.bu_code` คนละค่ากับ path (ถ้ามี → 400) — ปิดกับดัก query/path ของ KeycloakGuard
- [ ] **Step 4:** regenerate api catalog + license catalog; `bunx tsc` ทั้งสอง app + `bun run audit:app-api-catalog-drift`
- [ ] **Step 5:** curl local: create → get (ไม่มี secret) → reveal (ได้ค่าตรงกับ create) → regenerate → reveal ได้ค่าใหม่ → ตรวจ `tb_activity` มีแถว `view`
- [ ] **Step 6:** Commit `feat(bu-api-key): endpoint จัดการ API key ต่อ BU (สร้าง/ดู/regenerate/ปิดใช้งาน)`

### Task 3: gateway — `BuApiKeyGuard` + allowlist store

**Files:**
- Create: `apps/backend-gateway/src/external-api/bu-api-key.guard.ts`
- Create: `apps/backend-gateway/src/external-api/external-api-allowlist.store.ts` (snapshot `tb_external_api` ทุก 60s อ่าน `PRISMA_SYSTEM` ตรง)
- Create: `apps/backend-gateway/src/external-api/external-api.decorator.ts` — `ExternalApi(apiName: string)` (SetMetadata)
- Create: `apps/backend-gateway/src/external-api/external-api.constants.ts` (`BU_API_KEY_RATE_LIMIT_PER_MINUTE = 300`, header names)
- Create: `apps/backend-gateway/src/external-api/external-api.module.ts`

**Interfaces:**
- Consumes: Task 1 helpers, `FixedWindowRateLimiter` (`src/telemetry/rate-limiter.ts:13`), `LicenseService.resolveByBuCode` (`license/license.service.ts:336`)
- Produces: `request.buApiKey = { id: string; business_unit_id: string; bu_code: string }`; ตั้ง `request.user`/`x-bu-code`/`x-bu-id`/`x-bu-datas` แบบ `keycloak.guard.ts:205-227` (user_id = ค่าคงที่ external actor เดียวกับฝั่ง micro)

- [ ] **Step 1:** `canActivate`: header ครบ → หาแถวตาม `client_id` (`deleted_at IS NULL`) join BU (active) → `isSameBuApiSecretHash` → `is_active` → `tryConsume(row.id)` (เกิน = 429) → allowlist มี `(apiName จาก metadata, request.method)` และ `is_enabled` → license มี `interface.accounting.external` (state unresolved = 503, ไม่มี/หมดอายุ = 403) → ตั้ง context → update `last_used_at` แบบ fire-and-forget เฉพาะเมื่อค่าเดิมเก่ากว่า 60s
- [ ] **Step 2:** ข้อผิดพลาดทาง credential ทุกแบบคืน 401 ข้อความเดียวกัน (ไม่บอกว่า client_id มีจริงไหม)
- [ ] **Step 3:** route ที่ไม่มี metadata `ExternalApi` → deny (ปลอดภัยไว้ก่อน)
- [ ] **Step 4:** ลบ `bu_code` ออกจาก `request.query`/`request.params` ก่อนปล่อยต่อ แล้วใส่ค่าของ key แทน
- [ ] **Step 5:** tsc + eslint gateway; ทดสอบด้วย curl ใน Task 6
- [ ] **Step 6:** Commit `feat(gateway): BuApiKeyGuard ปักหมุด BU ตรวจ allowlist/license/rate limit`

### Task 4: micro-business — tenant context แบบ API key

**Files:**
- Modify: `apps/micro-business/src/tenant/tenant-context.runner.ts` (เพิ่ม `runWithApiKey` ข้าง `runWithExternalToken` :212-238)
- Modify: `apps/micro-business/src/tenant/tenant.service.ts` (ถ้าต้อง: ตัวหา connection จาก bu_code ที่กรอง `is_active`/`deleted_at` — `getdb_connection_for_external` :518 ไม่กรอง)
- Modify: `apps/micro-business/src/common/constant.ts` (ค่าคงที่ actor ของ API key ถ้า reuse `EXTERNAL_VENDOR_UNKNOWN_ACTOR_ID` ไม่เหมาะ)

**Interfaces:**
- Produces: `TenantContextRunner.runWithApiKey<T>(bu_code: string, api_key_id: string, fn: () => Promise<T>): Promise<T>` — `actor_kind: 'external'`, metadata มี `api_key_id`; ปฏิเสธ `bu_code` ว่าง (กับดัก `findFirst({where:{}})` :155)

- [ ] **Step 1:** implement + tsc
- [ ] **Step 2:** Commit `feat(tenant): tenant context สำหรับคำขอผ่าน API key`

### Task 5: micro-business — inventory posting builder

**Files:**
- Create: `apps/micro-business/src/inventory/inventory-posting/{inventory-posting.module.ts,inventory-posting.controller.ts,inventory-posting.service.ts,inventory-posting.types.ts,inventory-posting.dto.ts}`
- Create: `apps/micro-business/src/inventory/inventory-posting/builders/{grn.builder.ts,cn.builder.ts,sr.builder.ts,stock-adjustment.builder.ts}` (SI/SO ใช้ตัวเดียวกัน มี direction)
- Create: `packages/rpc-contract/src/contracts/inventory-postings.ts` (`inventory-postings.list`)

**Interfaces:**
- Consumes: Task 4 runner, ช่วง 1 `AccountMappingService.resolveKeys` + `loadContraCodes` (สำหรับ input VAT)
- Produces:
  ```ts
  ListInventoryPostingsDto = { bu_code: string; api_key_id: string;
    doc_types?: ('GRN'|'CN'|'SR'|'SI'|'SO')[];  date_field: 'document'|'updated';
    date_from: string; date_to: string;  // ISO date, ช่วงไม่เกิน 366 วัน
    page: number; perpage: number }       // perpage ≤ 200, default 50
  PostingDocument = { id; doc_type; doc_no; doc_date; status: 'final'|'voided'; updated_at;
    currency_code; exchange_rate: string; vendor: {id; code; name} | null;
    adjustment_type: {code; type: 'stock_in'|'stock_out'|'eop_in'|'eop_out'} | null;
    balanced: boolean; lines: PostingLine[] }
  PostingLine = { side: 'Dr'|'Cr'; role: 'inventory'|'ap'|'input_vat'|'adjustment'|'sr_in'|'sr_out';
    account_code: string|null; cost_center_code: string|null; amount: string /* base currency, 2dp */;
    location_code: string|null; product_code: string|null; item_group_code: string|null;
    unmapped: boolean; issue: string|null }
  ```
- กติกาต่อเอกสาร (ยอดเป็นสกุลเงินฐาน):
  | doc | final status | Dr | Cr | ยอด |
  |---|---|---|---|---|
  | GRN | `committed` | inventory (GL grn) ต่อบรรทัด = `base_net_amount`; input_vat ต่อเอกสาร = Σ`base_tax_amount` | ap (AP grn + `vendor_id`) = Σ(net+tax) | `tb_good_received_note_detail_item` |
  | CN | `completed` | ap = Σ(net+tax) | inventory (GL cn) ต่อบรรทัด + input_vat | `tb_credit_note_detail` |
  | SR | `completed` | sr_in @ `to_location` | sr_out @ `from_location` | cost layer ของ `inventory_transaction_id` |
  | SI | `completed` | inventory (GL grn @ location) | adjustment (`adjustment_type_id`) | cost layer |
  | SO | `completed` | adjustment | inventory (GL grn @ location) | cost layer |
  - `voided` ส่งด้วยกติกาเดียวกัน (status = `voided`) ให้ระบบบัญชีกลับรายการเอง
  - บรรทัด ap / input_vat ไม่มี location_code/product_code; ap ใช้ cost center ของ resolver แถวแรกของเอกสาร — **call ผู้ออกแบบ** (เขียนลง API doc)
  - `balanced` = Σ Dr == Σ Cr (เทียบ 2dp)

- [ ] **Step 1:** dto (zod) + types + rpc contract + controller ที่ห่อ `runWithApiKey`
- [ ] **Step 2:** service: query หัวเอกสารแต่ละประเภทตาม `date_field` (`*_date` หรือ `updated_at`), สถานะ final+voided, เรียง (`doc_date`, `doc_no`), แบ่งหน้ารวมทุกประเภท (union ids แล้ว paginate) — ยืนยันว่า `updated_at` ขยับเมื่อแก้หลัง commit (BE #694) และเมื่อ void; ถ้าไม่ขยับ ให้แก้ path นั้นให้ตั้ง `updated_at`
- [ ] **Step 3:** builders: โหลดบรรทัด + cost layer ของทั้งหน้าในครั้งเดียว (ไม่ N+1), สร้าง `MappingKey[]` ทั้งหน้า → `resolveKeys` ครั้งเดียว → map ผลกลับ; skip เพราะ consignment → ตัดบรรทัด; skip อื่น/issue → `unmapped:true`
- [ ] **Step 4:** tsc + eslint + jest ของ account-mapping ยังผ่าน
- [ ] **Step 5:** Commit `feat(inventory-posting): สร้างคู่ Dr/Cr ของ GRN/CN/SR/SI/SO สำหรับส่งออก`

### Task 6: gateway — endpoint ส่งออก

**Files:**
- Create: `apps/backend-gateway/src/external-api/inventory-posting/{inventory-posting.controller.ts,inventory-posting.service.ts,swagger/}`
- Modify: `external-api.module.ts`, `app.module.ts`

**Interfaces:**
- Route: `GET /api/ext/v1/inventory-postings?doc_types=GRN,CN&date_field=document&date_from=2026-10-01&date_to=2026-10-31&page=1&perpage=50`
- `@UseGuards(BuApiKeyGuard)` + `@ExternalApi('inventoryPosting.list')`; **ไม่ใส่** KeycloakGuard/AppIdGuard; คง ThrottlerGuard global
- Response: `{ data: PostingDocument[], paginate: {page, perpage, total, pages} }`

- [ ] **Step 1:** controller/service เรียก `inventory-postings.list` ด้วย `bu_code`/`api_key_id` จาก `request.buApiKey`
- [ ] **Step 2:** tsc + eslint
- [ ] **Step 3:** curl local (key จาก Task 2): ได้ข้อมูล; secret ผิด → 401; deactivate → 401; ส่ง `?bu_code=<BU อื่น>` → ยังเป็น BU ของ key; `POST` ที่ path เดียวกัน → 403/404; ปิด `is_enabled` ของแถว allowlist → 403 ภายใน 60s; BU ที่ไม่มี INF external → 403; ตรวจสักเอกสารว่า `balanced:true` และรหัสบัญชีตรงกับหน้า mapping
- [ ] **Step 4:** Commit `feat(external-api): GET /api/ext/v1/inventory-postings`

### Task 7: FE — ส่วน API Access ในหน้า External

**Files:**
- Create: `routes/system-admin/interface/external-api-access-section.tsx`
- Create: `routes/system-admin/interface/use-bu-api-key.ts` (query + mutations)
- Create: `components/ui/copy-button.tsx` (ถอด logic จาก `components/ui/error-state.tsx:89-98` แล้วให้ error-state ใช้ตัวนี้)
- Modify: `constant/api-endpoints.ts` (`BU_API_KEY: (buCode) => \`/api/proxy/api/config/${buCode}/bu-api-key\``)
- Modify: `routes/system-admin/interface/external-interface-form.tsx` (จากช่วง 1) — render section
- Modify: `messages/{en,th}.json`

**Interfaces:**
- Consumes: Task 2 routes, `useApiMutation` (`hooks/use-api-mutation.ts:81`), `ConfirmDialog` (`components/ui/confirm-dialog.tsx:49`)

- [ ] **Step 1:** ยังไม่มี key → ปุ่ม "สร้าง key"; มี key → Base URL, Client ID (+copy), secret `••••` + last4 + ปุ่ม View (เรียก reveal ทุกครั้งที่กด, ไม่ cache ใน query cache) + Copy, ผู้สร้าง/วันที่/ใช้ล่าสุด, สวิตช์เปิด/ปิด, ปุ่ม Regenerate (ConfirmDialog แจ้งว่า secret เดิมใช้ไม่ได้ทันที) → แสดง secret ใหม่ใน dialog พร้อม copy
- [ ] **Step 2:** license expired → ซ่อนปุ่มเขียนทั้งหมด (View ยังได้ถ้า backend ยอม — ถ้า 403 ให้แสดงข้อความ)
- [ ] **Step 3:** typecheck + eslint + `bun test:run routes/system-admin/interface components/ui` ผ่าน
- [ ] **Step 4:** ตรวจในเบราว์เซอร์: สร้าง → View → Regenerate → secret เก่าใช้ curl ไม่ได้ / ใหม่ได้ → ปิดใช้งาน → curl 401
- [ ] **Step 5:** Commit `feat(interface): จัดการ API key ของ BU ในหน้า External`

### Task 8: เอกสารการใช้งาน + ลำดับ deploy

**Files:**
- Create: BE `docs/external-api/inventory-postings.md` (วิธีส่ง header, พารามิเตอร์, รูป response, ความหมาย role/unmapped/balanced/voided, ข้อจำกัด rate limit, ตัวอย่าง curl)
- Modify: FE `routes/system-admin/interface/CLAUDE.md` (ส่วน API key: ขาเข้า ≠ secret ขาออกของแบรนด์อื่น)

- [ ] **Step 1:** เขียนเอกสาร
- [ ] **Step 2:** Commit `docs(external-api): คู่มือ inventory-postings สำหรับระบบบัญชีภายนอก`

### ลำดับ deploy ของช่วงนี้

ช่วง 1 ขึ้นครบก่อน → platform migration (backup) → BE (micro-business + gateway, env `PUBLIC_API_BASE_URL`) → เติม allowlist `buApiKey.*` ทุก env → FE (`vercel --prod`)
