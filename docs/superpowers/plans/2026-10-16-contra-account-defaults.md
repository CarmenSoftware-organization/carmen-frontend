# Contra-account defaults (ช่วง 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ account-mapping resolve บัญชีฝั่งตรงข้ามได้จริง — AP จาก vendor → BU default, adjustment จากบัญชีของ adjustment type — และเพิ่มแถว GL `grn`/`cn` เพื่อให้ช่วง 2 (export) ออกคู่ Dr/Cr ที่ balance

**Architecture:** resolver TS (`resolveAccountMapping`) รู้จัก `mapping_type`/`movement` และรับ "contra codes" ที่ service โหลดมาให้ (vendor / `gl_setting` / adjustment type — ทั้งหมดเก็บเป็น CoA uuid จึงแปลงเป็น code ก่อน) `statusCte` SQL ต้องสะท้อนลำดับเดียวกัน FE เพิ่มช่องบัญชีใน vendor / adjustment type และหน้า External มีส่วนตั้งค่า `gl_setting`

**Tech Stack:** NestJS microservices + Prisma 7 (BE), Vite + React 19 + TanStack Query + RHF/zod (FE)

**Spec:** `docs/superpowers/specs/2026-10-16-inbound-api-key-inventory-posting-design.md`

## Global Constraints

- **ข้ามขั้นเขียนเทสต์ใหม่** (CLAUDE.md ของ user) — แต่ spec ที่มีอยู่ต้องยังผ่าน: แก้ expectation ของ spec เดิมที่พังเพราะ type/enum ขยายได้ ห้ามลบเคส
- ทุก task ปิดด้วย: BE `bunx tsc --noEmit -p <app>` + `bunx eslint <files>`; FE `bun run typecheck` + `bunx eslint <files>`
- BE ใช้ jest (`bunx jest <path>`) ห้าม `bun test`
- commit message ภาษาไทย, BE branch `feature/inbound-api-key-inventory-posting` (สร้างจาก `origin/main`), FE branch เดียวกันที่มีอยู่แล้ว
- dev DB เป็นของกลาง: backup `tb_account_mapping`, `tb_adjustment_type` ก่อนรัน migration กับ BU ใดก็ตาม
- ลำดับ resolve (spec): AP = override → vendor → BU default; GL adjustment = override → adjustment type; อื่น ๆ = เดิม (override → item_group → sub_category → category ตาม `location_type`)
- `gl_setting` เดิมมี `ap_control_account_id` และ `input_vat_account_id` อยู่แล้ว (`apps/micro-business/src/app-config/app-config.service.ts:94-114`) — **ห้ามสร้างคีย์ใหม่**; การเขียนต้อง merge กับค่าเดิม (PUT แทนทั้งก้อน)
- คีย์ api_name ใหม่ (ถ้ามี) → regenerate `app-api-catalog.generated.ts` + เติม allowlist ทุก env ก่อน FE

## Review Focus

1. แถว AP ในหน้า mapping (ไม่มี vendor) ต้องแสดงบัญชี BU default ไม่ใช่บัญชีสินค้า — ตัวกรอง "incomplete" ต้องนับตามกติกาใหม่ (TS กับ `statusCte` ต้องตรงกัน) → Task 3 Step "parity check"
2. CoA uuid ที่ชี้บัญชีที่ถูกลบ/ปิดใช้ → ต้องได้ issue ไม่ใช่ code ว่าง ๆ ที่ดูเหมือนผ่าน → Task 3
3. บันทึก `gl_setting` จาก FE ต้องไม่ลบฟิลด์อื่นของ `gl_setting` (เช่นบัญชี AR/retained earnings) → Task 6
4. adjustment type ที่ไม่มีบัญชี → แถว adjustment ขึ้น `missing_adjustment_account` (ไม่ตกไปบัญชีสินค้าแบบเดิม) → Task 3
5. แถว GL `grn`/`cn` ใหม่: generate ซ้ำต้องไม่ชน CHECK / ไม่สร้างซ้ำ (ON CONFLICT) → Task 1 + Task 3

---

### Task 1: Tenant migration — CHECK constraint + บัญชีของ adjustment type

**Files:**
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261016140000_account_mapping_contra_defaults/migration.sql`
- Modify: `packages/prisma-shared-schema-tenant/prisma/schema.prisma` (model `tb_adjustment_type` ~:3299)

**Interfaces:**
- Produces: คอลัมน์ `tb_adjustment_type.chart_of_accounts_id uuid NULL` (ไม่มี Prisma relation — ตามแบบ `tb_vendor.ap_chart_of_accounts_id`), CHECK `accountmapping_type_movement_ck` ที่อนุญาต AP{grn,cn} และ GL{grn,cn,adjustment,sr_in,sr_out}

- [ ] **Step 1:** เขียน SQL แบบ idempotent (คอมเมนต์ไทยตามแบบไฟล์ข้างเคียง เช่น `20261014100100_account_mapping`): `ALTER TABLE tb_adjustment_type ADD COLUMN IF NOT EXISTS chart_of_accounts_id uuid;` + `ALTER TABLE tb_account_mapping DROP CONSTRAINT IF EXISTS accountmapping_type_movement_ck;` + `ADD CONSTRAINT ... CHECK ((mapping_type='AP' AND movement IN ('grn','cn')) OR (mapping_type='GL' AND movement IN ('grn','cn','adjustment','sr_in','sr_out')))` — คงเงื่อนไข adjustment_type_id เดิมของ CHECK ไว้ถ้ามี (อ่านของเดิมที่ `:42-44` ก่อน)
- [ ] **Step 2:** เพิ่ม `chart_of_accounts_id String? @db.Uuid` ใน schema แล้ว `bun run --filter @repo/prisma-shared-schema-tenant generate` (หรือคำสั่ง generate ตาม package.json ของ package) + build dist ของ `prisma-tenant` ตามที่ app ใช้
- [ ] **Step 3:** รัน migration กับ dev BU เดียว (`scripts/migrate-tenants.sh <schema>`) หลัง backup — ตรวจ `\d tb_adjustment_type` และ `\d+ tb_account_mapping` เห็นคอลัมน์/CHECK ใหม่
- [ ] **Step 4:** Commit `feat(account-mapping): migration เพิ่มบัญชีของ adjustment type และอนุญาตแถว GL grn/cn`

### Task 2: BE — adjustment type รับ/ส่ง `chart_of_accounts_id`

**Files:**
- Modify: `apps/micro-business/src/master/adjustment-type/adjustment-type.service.ts` (create :128, update :190 — ตรวจ CoA active ตามแบบ `vendors.service.ts:84-86`)
- Modify: `apps/micro-business/src/master/adjustment-type/interface/adjustment-type.interface.ts`
- Modify: `apps/backend-gateway/src/common/dto/adjustment-type/{adjustment-type.create.dto.ts,adjustment-type.update.dto.ts,adjustment-type.serializer.ts}` (base schema :8 — detail/list สืบทอด)
- Modify: `apps/backend-gateway/src/config/config_adjustment-types/swagger/{request,response}.ts`

**Interfaces:**
- Produces: request/response field `chart_of_accounts_id: string | null` (uuid) บน adjustment type

- [ ] **Step 1:** เพิ่ม field (zod `z.string().uuid().nullable().optional()`) ใน create/update dto และ serializer base; ตรวจใน service ว่าถ้ามีค่าต้องเป็น CoA ที่ active ไม่งั้นคืน error catalog เดียวกับ vendor
- [ ] **Step 2:** `bunx tsc --noEmit` ทั้ง gateway และ micro-business + `bunx jest apps/micro-business/src/master/adjustment-type apps/backend-gateway/src/common/dto/adjustment-type` ผ่าน
- [ ] **Step 3:** curl ผ่าน gateway local (:4000, `admin@zebra.com`): PATCH adjustment type ใส่ `chart_of_accounts_id` แล้ว GET คืนค่ากลับมา (ยืนยัน serializer ไม่ตัดทิ้ง)
- [ ] **Step 4:** Commit `feat(adjustment-type): เพิ่มบัญชีของ adjustment type`

### Task 3: BE — resolver และ service รู้จักบัญชีฝั่งตรงข้าม

**Files:**
- Modify: `apps/micro-business/src/master/account-mapping/account-mapping.resolver.ts`
- Modify: `apps/micro-business/src/master/account-mapping/account-mapping.service.ts` (`statusCte` :113-144, `loadAccountCodes` :264, `hydrate` :347-391, `movementsSql` :661-670, `resolveKeys` :721-751, `resolveVirtual` :758-803)
- Modify: `apps/micro-business/src/master/account-mapping/dto/account-mapping.dto.ts` (`MappingKeySchema` :7-14)
- Modify: `apps/backend-gateway/src/common/dto/account-mapping/account-mapping.serializer.ts` (source enum :28, issue enum :29-30) + `account-mapping.dto.ts` (resolve request)
- Modify (expectations only): `account-mapping.resolver.spec.ts`, `account-mapping.service.spec.ts`, dto specs

**Interfaces:**
- Consumes: Task 1 column, Task 2 field
- Produces (ช่วง 2 ใช้):
  ```ts
  type AccountSource = 'override'|'item_group'|'sub_category'|'category'|'vendor'|'bu_default'|'adjustment_type';
  type AccountIssue = 'missing_inventory_account'|'missing_direct_account'|'account_not_in_coa'
                    |'missing_ap_account'|'missing_adjustment_account';
  interface ResolveInput { /* เดิม */ mapping_type: 'AP'|'GL'; movement: MappingMovement;
    contra: { vendor: string|null; bu_default_ap: string|null; adjustment_type: string|null } } // ทั้งหมดเป็น account CODE
  MappingKey += { vendor_id?: string }   // context ตอน resolve เท่านั้น ไม่ใช่ identity ของแถว
  AccountMappingService.resolveKeys(lines: MappingKey[]): Promise<ResolvedKey[]>  // signature เดิม, รับ vendor_id ได้
  AccountMappingService.loadContraCodes(lines: MappingKey[]): Promise<{ buDefaultAp: string|null; inputVat: string|null;
    vendor: Map<string,string|null>; adjustmentType: Map<string,string|null> }>
  ```

- [ ] **Step 1:** resolver: กิ่งใหม่ก่อนกิ่งเดิม (หลัง consignment skip) — `AP`: override → `contra.vendor` → `contra.bu_default_ap` → issue `missing_ap_account`; `GL`+`adjustment`: override → `contra.adjustment_type` → issue `missing_adjustment_account`; นอกนั้นใช้ chain เดิม. cost center ไม่เปลี่ยน
- [ ] **Step 2:** `loadContraCodes`: อ่าน `gl_setting` ผ่าน logic เดียวกับ `GlPostingService.getSetting()` (`gl/gl-posting/gl-posting.service.ts:190` — ดึงออกมาเป็น helper ที่ใช้ร่วม ห้าม copy), แปลง uuid → code ด้วย query `tb_chart_of_accounts` ครั้งเดียว (`id IN (...) AND deleted_at IS NULL AND is_active`) — uuid ที่หาไม่เจอ = null (จึงขึ้น issue)
- [ ] **Step 3:** ส่ง contra เข้า `ResolveInput` ทั้งใน `hydrate` และ `resolveVirtual`; ใน list/hydrate ไม่มี vendor → `vendor: null`
- [ ] **Step 4:** `statusCte`: `resolved_account` = `CASE WHEN mapping_type='AP' THEN COALESCE(override, ${buDefaultApCode}) WHEN movement='adjustment' THEN COALESCE(override, at_coa.code) ELSE <chain เดิม> END` โดย `${buDefaultApCode}` เป็น parameter ที่ service คำนวณก่อน และ join `tb_adjustment_type` → `tb_chart_of_accounts` สำหรับ adjustment
- [ ] **Step 5:** `movementsSql('GL')` เพิ่ม `'grn'`, `'cn'` (adjustment_type_id NULL)
- [ ] **Step 6:** ขยาย enum source/issue ใน gateway serializer; `MappingKeySchema` เพิ่ม `vendor_id: z.string().uuid().optional()` ทั้ง micro และ gateway resolve dto
- [ ] **Step 7:** แก้ expectation spec เดิมที่พังจาก type ใหม่ แล้ว `bunx jest apps/micro-business/src/master/account-mapping apps/backend-gateway/src/common/dto/account-mapping` ผ่านทั้งหมด
- [ ] **Step 8 (parity check):** กับ dev BU ที่ migrate แล้ว: generate → เรียก list ด้วย filter incomplete และ resolve key เดียวกัน; จำนวน incomplete จาก CTE ต้องเท่ากับนับจาก TS resolver (ทำสคริปต์ชั่วคราวใน scratchpad ไม่ commit) — รวมเคส AP ที่ BU ไม่มี `ap_control_account_id` และ adjustment type ที่ไม่มีบัญชี
- [ ] **Step 9:** Commit `feat(account-mapping): resolve บัญชีเจ้าหนี้/adjustment จาก vendor, gl_setting, adjustment type และเพิ่มแถว GL grn/cn`

### Task 4: FE — หน้า mapping แสดงแหล่งบัญชีใหม่และแถว GL grn/cn

**Files:**
- Modify: `types/chart-of-account-mapping.ts` (`MappingMovement` :12, `AccountSource` :20, `AccountIssue` :22)
- Modify: `routes/config/chart-of-account-mapping/coam-cells.tsx` (labels :21, `sourceHref` :51-103, `SourceBadge` :66)
- Modify: `routes/config/chart-of-account-mapping/coam-filter-fields.ts` (ตัวเลือก movement ตาม mapping_type ถ้ามี)
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: Task 3 enums

- [ ] **Step 1:** เพิ่ม union ให้ตรง Task 3; `sourceHref`: `vendor` → ไม่มีลิงก์ (แถว list ไม่มี vendor), `bu_default` → `/system-admin/interface/accounting/external`, `adjustment_type` → `/config/adjustment-type`
- [ ] **Step 2:** i18n คีย์ใหม่ทั้ง en/th (ห้ามมี `{{`/`}}` ในข้อความ — ICU พัง)
- [ ] **Step 3:** `bun run typecheck` + `bunx eslint` ไฟล์ที่แก้ + `bun test:run routes/config/chart-of-account-mapping` ผ่าน
- [ ] **Step 4:** Commit `feat(coam): แสดงแหล่งบัญชี vendor/BU/adjustment type และแถว GL grn/cn`

### Task 5: FE — ช่องบัญชีเจ้าหนี้ใน vendor และบัญชีใน adjustment type

**Files:**
- Modify: `types/vendor.ts` (`Vendor` :35, `CreateVendorDto` :67) — `ap_chart_of_accounts_id?: string | null`
- Modify: `routes/vendor-management/vendor/{vendor-form-schema.ts:52-74,114,190, vendor-form.tsx:153, vendor-general.tsx}`
- Modify: `types/adjustment-type.ts` (:16, :33) — `chart_of_accounts_id?: string | null`
- Modify: `routes/config/adjustment-type/adjustment-type-dialog.tsx`
- Modify: `messages/{en,th}.json`

**Interfaces:**
- Consumes: `LookupChartOfAccount` (`components/lookup/lookup-chart-of-account.tsx:302`) — value เป็น **code**; เก็บ uuid จาก `onValueChange(code, account)` → `account?.id`

- [ ] **Step 1:** ฟอร์ม vendor: ช่อง "บัญชีเจ้าหนี้" ในแท็บ general; state ฟอร์มถือ uuid แต่ต้องแสดง code ที่ picker → เก็บคู่ `{id, code}` หรือ resolve code จาก uuid ตอนโหลด (เลือกทางที่ไม่ต้องเรียก API เพิ่มถ้า response ของ vendor มี code; ถ้าไม่มี ใช้ข้อมูล lookup ที่โหลดอยู่แล้ว)
- [ ] **Step 2:** dialog adjustment type: ช่อง "บัญชี" แบบเดียวกัน
- [ ] **Step 3:** ตรวจว่า Discard/reset ของ vendor form คืนค่าช่องใหม่ได้ (กับดัก RHF reset + keepFieldsRef — memory PR #152)
- [ ] **Step 4:** typecheck + eslint + `bun test:run routes/vendor-management/vendor routes/config/adjustment-type` ผ่าน
- [ ] **Step 5:** Commit `feat(vendor,adjustment-type): เพิ่มช่องเลือกบัญชีเจ้าหนี้และบัญชีของ adjustment type`

### Task 6: FE — ฟอร์ม External + ส่วนบัญชีตั้งต้น (`gl_setting`)

**Files:**
- Create: `routes/system-admin/interface/external-interface-form.tsx`
- Create: `routes/system-admin/interface/external-gl-defaults-section.tsx`
- Modify: `routes/system-admin/interface/interface-registry.ts` (:53 — แบรนด์ `external` ได้ `form: lazy(() => import("./external-interface-form"))` ตามแบบ `carmen_gl` :47-52)
- Modify: `messages/{en,th}.json` (`systemAdmin.interface.accounting.external.*`)

**Interfaces:**
- Consumes: `useAppConfigByKey`, `useUpsertAppConfig` (`hooks/use-app-config.ts:28,70`), `InterfacePageLayout`, `SettingSection`, `LookupChartOfAccount`
- Produces: `ExternalInterfaceForm` ที่ช่วง 2 จะเพิ่มส่วน API Access เข้าไป; `ExternalGlDefaultsSection` (ไม่มี props)

- [ ] **Step 1:** `ExternalInterfaceForm` คงพฤติกรรมฟอร์ม external เดิม (config `interface_accounting_external` — ดูฟอร์ม accounting ของ category ที่ใช้อยู่ตอนนี้แล้วย้ายฟิลด์เดิมมาครบ) + render `ExternalGlDefaultsSection`
- [ ] **Step 2:** `ExternalGlDefaultsSection`: อ่าน `gl_setting` (404 = ว่าง), สองช่อง "บัญชีเจ้าหนี้ตั้งต้น" (`ap_control_account_id`) และ "บัญชีภาษีซื้อ" (`input_vat_account_id`); save = `{...currentValue, ap_control_account_id, input_vat_account_id}` — **ห้ามส่งเฉพาะสองฟิลด์**
- [ ] **Step 3:** สถานะ license expired → อ่านอย่างเดียว ตาม `writeDisabledReason` เดิมของ `InterfacePageLayout`
- [ ] **Step 4:** typecheck + eslint + `bun test:run routes/system-admin/interface` ผ่าน
- [ ] **Step 5:** ตรวจในเบราว์เซอร์ (dev :4000): ตั้งสองบัญชี → save → reload ค่าอยู่; GET `gl_setting` ผ่าน curl ฟิลด์อื่นยังอยู่ครบ; หน้า mapping แถว AP แสดง source `bu_default`
- [ ] **Step 6:** Commit `feat(interface): ฟอร์ม External พร้อมตั้งบัญชีเจ้าหนี้และภาษีซื้อตั้งต้น`

### ลำดับ deploy ของช่วงนี้

migration ทุก BU (backup ก่อน) → BE → FE. ไม่มี api_name ใหม่ในช่วงนี้ (ใช้ endpoint เดิมทั้งหมด) — ตรวจซ้ำตอนจบ ถ้ามีต้องเติม allowlist ก่อน FE
