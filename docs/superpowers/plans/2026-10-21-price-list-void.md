# Price List Void Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน "ลบ" price list เป็น Void (มีเหตุผล, กู้คืนเป็น draft ได้) และให้ admin hard delete ได้ ใบที่เคยถูกลบกลับมาเป็น voided

**Architecture:** BE เพิ่มสถานะ `voided` + คอลัมน์ void_* ใน tenant schema, เพิ่ม RPC/endpoint `void`/`restore`, เปลี่ยน `DELETE` เป็น hard delete ที่ตรวจ BU role admin ใน gateway · FE ใช้ `VoidDialog` ที่มีอยู่, เพิ่ม hooks void/restore, กรองแท็บ list ด้วย status

**Tech Stack:** NestJS + Prisma (carmen-turborepo-backend-v2) · Vite + React Router + TanStack Query + use-intl (carmen-inventory-frontend-react)

**Spec:** `docs/superpowers/specs/2026-10-21-price-list-void-design.md`

## Global Constraints

- **ข้ามขั้นเขียน/รันเทสต์** (ความต้องการของ user) — ทุก task จบด้วย typecheck + lint + commit; ห้ามสร้าง `*.spec.ts`/`*.test.ts` ใหม่ เทสต์เดิมต้องไม่แดงเพิ่ม (BE ใช้ jest ห้าม `bun test`)
- commit message ภาษาไทย, PR ภาษาอังกฤษ; branch `feature/pl-void` ทั้งสองรีโป
- ไม่เพิ่ม permission key ใหม่ — FE ใช้ `useDeleteGate()` (`vendor_management.price_list.delete`) สำหรับ void/restore
- ไม่ใส่ `{{}}` หรือ `<คำ>` ในไฟล์แปล
- reason: trim แล้วต้องไม่ว่าง, ยาวไม่เกิน 500
- restore → `draft` เสมอ
- hard delete: BU role `admin` เท่านั้น ตรวจที่ gateway (header `x-bu-datas`, แบบเดียวกับ `config_app-config.controller.ts` ~272–292)
- ข้อเท็จจริงที่พบตอนวางแผน: gateway ของ pricelist **ไม่มีการตรวจ permission ราย route** (มีแค่ `AppIdGuard`) — void/restore จึงคุมด้วย FE gate เท่ากับปุ่มลบเดิม ไม่ใช่ช่องโหว่ใหม่ แต่ hard delete ต้องตรวจ admin ฝั่ง BE

## Review Focus

1. ใบ voided หลุดเข้า compare / active-by-vendor / findAllByVendorAndDate — ทุก query ที่ดึงใบไปใช้ต้องกรอง `status = active` (ตรวจใน Task 2 Step 5)
2. PATCH ใบ voided หรือส่ง `status: "voided"` มากับ PATCH — ต้อง 409/400 ไม่ใช่แก้สำเร็จ (Task 2)
3. Hard delete ใบที่ PR/PO อ้าง → ต้องได้ 409 พร้อมเลขเอกสาร ไม่ใช่ 500 จาก FK (Task 2 + ตรวจมือ Task 7)
4. แท็บ "ยังมีผล"/"หมดช่วงแล้ว" ยังโชว์ใบ voided ถ้าผู้ใช้เลือก status filter เองร่วมด้วย — filter ของแท็บต้องรวมกับ status filter ของผู้ใช้แบบ AND (Task 5)
5. non-admin ยิง `DELETE` ตรง → 403 (Task 3 + ตรวจมือ Task 7)

---

## Backend — `carmen-turborepo-backend-v2`

### Task 1: Schema, migrations, error catalog

**Files:**
- Modify: `packages/prisma-shared-schema-tenant/prisma/schema.prisma` (`enum enum_pricelist_status` ~5293, `model tb_pricelist` ~5308)
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261021120000_pricelist_voided_status/migration.sql`
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261021120100_pricelist_convert_deleted_to_voided/migration.sql`
- Modify: `packages/error-catalog/src/catalog.ts` (ต่อจาก `makeId(MODULE.PRICE_LIST, 7)` ~1128)

**Interfaces:**
- Produces: enum value `voided`; columns `void_reason String? @db.VarChar(500)`, `voided_at DateTime? @db.Timestamptz(6)`, `voided_by_id String? @db.Uuid`; catalog keys `PRICE_LIST_ALREADY_VOIDED` (409), `PRICE_LIST_NOT_VOIDED` (409), `PRICE_LIST_VOIDED_READONLY` (409), `PRICE_LIST_VOID_REASON_REQUIRED` (400), `PRICE_LIST_IN_USE` (409, message มี `{documents}`), `PRICE_LIST_ADMIN_ONLY` (403)

- [ ] **Step 1:** enum เพิ่ม `voided // โมฆะ` และแก้คอมเมนต์ `inactive` เป็น `// พักใช้ชั่วคราว`; model เพิ่ม 3 คอลัมน์ข้างบน
- [ ] **Step 2:** migration แรก: `ALTER TYPE "enum_pricelist_status" ADD VALUE IF NOT EXISTS 'voided';` + `ALTER TABLE "tb_pricelist" ADD COLUMN ...` ×3 — **ห้าม UPDATE ใช้ค่า `voided` ในไฟล์เดียวกัน** (Postgres: "unsafe use of new value" ใน transaction เดียวกัน)
- [ ] **Step 3:** migration ที่สอง (แปลงข้อมูลเก่า):

```sql
UPDATE "tb_pricelist"
SET status = 'voided',
    voided_at = deleted_at,
    voided_by_id = COALESCE(deleted_by_id, updated_by_id),
    void_reason = NULL,
    deleted_at = NULL,
    deleted_by_id = NULL
WHERE deleted_at IS NOT NULL;
```
ไม่แตะ `tb_pricelist_detail` (บรรทัดของใบไม่ได้ถูก soft delete ตอนลบหัว — ยืนยันด้วย `SELECT` บน dev ก่อนรันจริง; ถ้ามี detail ที่ deleted_at ตรงกับหัว ให้ล้างด้วยในไฟล์นี้)
- [ ] **Step 4:** เพิ่ม 6 catalog entries (id 8–13, message_en/message_th) — `PRICE_LIST_IN_USE.message_th`: `ลบไม่ได้ เพราะเอกสารเหล่านี้อ้างถึงใบนี้อยู่: {documents}`
- [ ] **Step 5:** build ที่ต้องใช้: `bun run --filter @repo/prisma-shared-schema-tenant build` (หรือ generate + dist ตามที่ repo ทำ) และ build `packages/error-catalog`; รัน `bunx tsc --noEmit -p apps/micro-business` ผ่าน
- [ ] **Step 6:** commit `feat(price-list): เพิ่มสถานะ voided + คอลัมน์ void_* และแปลงใบที่ถูกลบเป็น voided`

### Task 2: micro-business — void / restore / hard delete

**Files:**
- Modify: `apps/micro-business/src/master/price-list/price-list.service.ts` (`select` ~53–63, mapper ~150–170, `update()` ~1163, `remove()` ~1394)
- Modify: `apps/micro-business/src/master/price-list/price-list.controller.ts` (~175)
- Modify (generated): `packages/rpc-contract/src/contracts/pricelists.ts` ผ่าน `bun run gen:rpc-contract`

**Interfaces:**
- Consumes: Task 1 enum/columns/catalog
- Produces:
  - `void(id: string, reason: string): Promise<Result<{ id: string }>>`
  - `restore(id: string): Promise<Result<{ id: string }>>`
  - `remove(id: string): Promise<Result<{ id: string }>>` — **ความหมายใหม่ = hard delete**
  - RPC `Pricelists.void` (`pricelists.void`, payload `{ id, data: { reason } }`), `Pricelists.restore` (`pricelists.restore`, payload `{ id }`); `Pricelists.delete` คงชื่อเดิม
  - response findOne/findAll เพิ่ม `void_reason`, `voided_at`, `voided_by_id`

- [ ] **Step 1:** `void()` — reason `trim()` ว่าง → `PRICE_LIST_VOID_REASON_REQUIRED`; ไม่พบ → `PRICE_LIST_NOT_FOUND`; status เป็น `voided` แล้ว → `PRICE_LIST_ALREADY_VOIDED`; อื่น ๆ ทุกสถานะ → update `status=voided, void_reason, voided_at=now, voided_by_id=this.userId, updated_by_id`
- [ ] **Step 2:** `restore()` — ไม่ใช่ voided → `PRICE_LIST_NOT_VOIDED`; อื่น ๆ → `status=draft` + จัดการ `submitted_at` เหมือนกิ่ง `data.status === draft` ใน `update()` (~1206–1215 อ่านก่อน) · **ไม่ล้าง** void_*
- [ ] **Step 3:** `update()` — ใบปัจจุบันเป็น `voided` → `PRICE_LIST_VOIDED_READONLY`; `data.status === 'voided'` → `PRICE_LIST_VOIDED_READONLY` (ต้องผ่าน endpoint void)
- [ ] **Step 4:** `remove()` hard delete — ใน `$transaction`: หา detail ids ของใบ (รวม soft-deleted ใช้ `INCLUDE_SOFT_DELETED`) → ตรวจตารางที่อ้าง `tb_pricelist.id` / `tb_pricelist_detail.id` (schema ~461, ~2687, ~5233; ~5358/~5392 คือ comment ของใบเอง) โดย query **รวมแถว soft-deleted**; ถ้ามี → `Result.errorFromCatalog(PRICE_LIST_IN_USE, { documents })` โดย `documents` = เลขเอกสารสูงสุด 5 ตัว คั่น `, ` ต่อท้าย `(ลบแล้ว)`/`(deleted)` ให้ตัวที่ deleted_at ไม่ว่าง และ `+N` ถ้าเกิน · ถ้าไม่มี → `deleteMany` detail comments → detail → pricelist comments → `delete` หัว (ใช้ raw `delete` ไม่ใช่ soft-delete extension)
- [ ] **Step 5:** ไล่ทุก query ที่ส่งใบไปใช้ภายนอก (`priceCompare`, `findActiveVendors`, `findAllByVendorAndDate`, `findUsableWorkflowProductIds`) ยืนยันว่ากรอง `status: active` — ถ้ามีจุดไหนไม่กรอง ให้เพิ่ม `status: { not: voided }`
- [ ] **Step 6:** select/mapper เพิ่ม 3 ฟิลด์; controller เพิ่ม handler `void`/`restore` ตามขั้นตอนในหัวไฟล์ contract (literal ชั่วคราว → `bun run gen:rpc-contract` → แทนด้วย reference) และแก้คอมเมนต์ `remove` เป็น hard delete
- [ ] **Step 7:** `bunx tsc --noEmit -p apps/micro-business` + `bunx eslint` ไฟล์ที่แก้ + jest ของ price-list (ถ้ามี) ไม่แดงเพิ่ม
- [ ] **Step 8:** commit `feat(price-list): void/restore และเปลี่ยน remove เป็น hard delete`

### Task 3: gateway — endpoints, admin check, serializer, catalog

**Files:**
- Modify: `apps/backend-gateway/src/config/config_pricelists/config_pricelists.controller.ts` (`@Delete` ~501)
- Modify: `apps/backend-gateway/src/config/config_pricelists/config_pricelists.service.ts` (`remove` ~185)
- Modify: `apps/backend-gateway/src/config/config_pricelists/swagger/request.ts` (body void)
- Modify: `apps/backend-gateway/src/common/dto/pricelist/*` (response/serializer schema ที่ `@Serialize` ของ findOne/findAll ใช้)
- Modify (generated): `apps/backend-gateway/src/platform/applications/app-api-catalog.generated.ts` ผ่าน `scripts/generate-app-api-catalog/run.ts`

**Interfaces:**
- Consumes: RPC `Pricelists.void`, `Pricelists.restore`, `Pricelists.delete` (Task 2)
- Produces (HTTP, FE ใช้):
  - `POST api/config/:bu_code/pricelists/:pricelist_id/void` body `{ reason: string }` → `{ id }` · AppIdGuard `pricelist.void`
  - `POST api/config/:bu_code/pricelists/:pricelist_id/restore` → `{ id }` · AppIdGuard `pricelist.restore`
  - `DELETE api/config/:bu_code/pricelists/:pricelist_id` → hard delete, non-admin → 403 `PRICE_LIST_ADMIN_ONLY`
  - findOne/findAll ส่ง `void_reason`, `voided_at`, `voided_by_id` (+ ชื่อผู้ void ถ้า enrich ทำได้ด้วย pattern เดียวกับ audit; ถ้าไม่ได้ FE แสดงแค่เวลา)

- [ ] **Step 1:** void body DTO: zod/class-validator `reason` string, trim min 1, max 500
- [ ] **Step 2:** ใน `remove` handler ก่อนเรียก service: อ่าน `x-bu-datas` หา entry ที่ `bu_code` ตรง, `role !== 'admin'` → respond 403 จาก catalog `PRICE_LIST_ADMIN_ONLY` (แยกเป็น private method `isBuAdmin(req, bu_code): boolean` ในคอนโทรลเลอร์นี้; ไม่ต้องย้ายของ app-config)
- [ ] **Step 3:** เพิ่ม handlers void/restore + service methods ตาม pattern `remove`; swagger operationId `configPricelist_void` / `configPricelist_restore`; แก้ description ของ delete เป็น "Permanently deletes … BU admin only"
- [ ] **Step 4:** response schema เพิ่ม 3 ฟิลด์ (memory: ถ้าไม่เติม gateway schema GET จะตัดทิ้ง)
- [ ] **Step 5:** regenerate app-api-catalog แล้ว `bun run audit:app-api-catalog-drift` ผ่าน
- [ ] **Step 6:** `bunx tsc --noEmit -p apps/backend-gateway` + eslint ไฟล์ที่แก้
- [ ] **Step 7:** curl บน local (gateway :4000 — **DB ร่วมกับ dev ให้ใช้ใบทดสอบเท่านั้น**): void ไม่มี reason → 400; void → 200 และ findOne เห็น void_*; void ซ้ำ → 409; PATCH ใบ voided → 409; restore → draft; DELETE ด้วย user non-admin → 403
- [ ] **Step 8:** commit `feat(gateway): endpoint void/restore ของ price list และจำกัด hard delete ให้ BU admin` · push + เปิด PR (อังกฤษ) ระบุลำดับ deploy: allowlist `pricelist.void`/`pricelist.restore` → migration ทุก BU → BE → FE

---

## Frontend — `carmen-inventory-frontend-react`

### Task 4: types, constants, i18n, hooks

**Files:**
- Modify: `types/price-list.ts:4` และ interface ที่มี `status` (~44, ~61)
- Modify: `constant/price-list.ts` (`PL_STATUS_TONE`, `PRICE_LIST_STATUS_OPTIONS`, `PL_STATUS_CONFIG`)
- Modify: `constant/api-endpoints.ts` (เพิ่ม `PRICE_LIST_VOID(buCode, id)`, `PRICE_LIST_RESTORE(buCode, id)`)
- Modify: `hooks/use-price-list.ts`
- Modify: `messages/en.json`, `messages/th.json` (namespace ของหน้า price list + `status`)
- Modify: ทุกที่ที่ cast `as "draft" | "submitted" | "active" | "inactive"` (`pl-card.tsx:34`, `pl-component.tsx:226`, `use-pl-table.tsx:134`, `pl-form.tsx:158`, `pl-general-card.tsx:21`) → ใช้ `PriceListStatus` ที่ export

**Interfaces:**
- Produces:
  - `export type PriceListStatus = "draft" | "submitted" | "active" | "inactive" | "voided"`
  - `PriceList` เพิ่ม `void_reason?: string | null; voided_at?: string | null; voided_by_id?: string | null; voided_by?: { name?: string } | null`
  - `PL_STATUS_TONE.voided = "neutral"`
  - `useVoidPriceList(): UseMutationResult<unknown, ApiError, { id: string; reason: string }>`
  - `useRestorePriceList(): UseMutationResult<unknown, ApiError, string>` (id)
  - ทั้งสอง invalidate `QUERY_KEYS.PRICE_LISTS` (list + byId)
  - i18n keys: `status.voided` ("Voided"/"โมฆะ"), `voidTitle`, `voidConfirm` (มี `{name}`), `voidSuccess`, `restore`, `restoreTitle`, `restoreConfirm`, `restoreSuccess`, `voidedBanner` (`{by}`, `{at}`), `voidReasonLabel`, `hardDeleteTitle`, `hardDeleteConfirm` (`{name}` — ระบุว่าเลขเอกสารหายถาวร), ปุ่ม `void` = "Void"/"ยกเลิก (โมฆะ)"

- [ ] **Step 1:** แก้ types/constants ตามข้างบน (`inactive` ในฟอร์มยังเลือกได้; **`voided` ไม่อยู่ใน `PRICE_LIST_STATUS_OPTIONS` ของฟอร์ม** และ zod `pl-form-schema.ts:31` ไม่เพิ่ม voided)
- [ ] **Step 2:** hooks — ใช้ `httpClient` + `useMutation` แบบเดียวกับไฟล์ ไม่แก้ `createConfigCrud`; `useDeletePriceList` คงเดิม (ตอนนี้ = hard delete)
- [ ] **Step 3:** i18n en/th
- [ ] **Step 4:** `bun run typecheck` + `bun run lint`
- [ ] **Step 5:** commit `feat(price-list): type/hook/ข้อความของสถานะ voided`

### Task 5: List — แท็บ, ป้าย, ปุ่ม Void

**Files:**
- Modify: `routes/vendor-management/price-list/pl-component.tsx` (tab filter ~60–70, `statusOptions` ~108–112, `DeleteDialog` ~364)
- Modify: `routes/vendor-management/price-list/use-pl-table.tsx` (~156 `actionColumn`)
- Modify: `routes/vendor-management/price-list/pl-card.tsx`
- Modify: `components/ui/data-grid/columns.tsx` + `DataGridRowActions` (เพิ่ม prop เสริม `deleteLabel?: string` ใช้เป็น tooltip/aria-label ของปุ่มถังขยะ; default เดิมไม่เปลี่ยน)

**Interfaces:**
- Consumes: Task 4 hooks/types/i18n

- [ ] **Step 1:** แท็บ "ยังมีผล"/"หมดช่วงแล้ว" เพิ่ม `status|string:draft,submitted,active,inactive` คู่กับ date_range เดิม; แท็บ "ทั้งหมด" ไม่กรอง status — ตรวจว่า filter ของแท็บรวมกับ status filter ที่ผู้ใช้เลือกแบบ AND (ถ้าคีย์ `status` ชนกันใน params ให้ตัดค่า voided ออกจากที่ผู้ใช้เลือกแทนการทับ)
- [ ] **Step 2:** `statusOptions` เพิ่ม `voided`; ป้ายใช้ `PL_STATUS_TONE` (เทา) ทั้งตาราง การ์ด และ Excel export
- [ ] **Step 3:** ปุ่มถังขยะในแถว/การ์ดเปิด `VoidDialog` (`components/share/void-dialog.tsx`) แทน `DeleteDialog`; `deleteLabel = t("void")`; `deleteDisabledTitle` คืนข้อความเมื่อ `status === "voided"`; onConfirm → `useVoidPriceList` → toast `voidSuccess`
- [ ] **Step 4:** typecheck + lint
- [ ] **Step 5:** commit `feat(price-list): list ใช้ void แทนลบ และแสดงใบโมฆะในแท็บทั้งหมด`

### Task 6: Form/view — Void, Restore, Hard delete, แถบโมฆะ

**Files:**
- Modify: `routes/vendor-management/price-list/pl-form.tsx` (~52–53, ~146–175, ~234–245)
- Create (ถ้าเกิน ~40 บรรทัด): `routes/vendor-management/price-list/pl-void-banner.tsx`

**Interfaces:**
- Consumes: Task 4 hooks/i18n; `useCan().isAdmin`; `FormToolbar` (`onDelete`, `children`, `onEdit`)

- [ ] **Step 1:** ใบไม่ใช่ voided: ปุ่ม Void ใน toolbar (`children`, ซ่อนเมื่อ `useDeleteGate().deleteDenied` หรือ `writeDisabled`) → `VoidDialog`
- [ ] **Step 2:** ใบ voided: ไม่ส่ง `onEdit`, ปุ่ม Restore (gate เดียวกัน) → confirm dialog → `useRestorePriceList` → toast + refetch; แถบแจ้ง `voidedBanner` + เหตุผล (ไม่มี → "—") ใช้ component แจ้งเตือนที่มีใน `components/ui/` อ่านออกทั้ง light/dark
- [ ] **Step 3:** `onDelete` ของ `FormToolbar` ส่งเฉพาะ `isAdmin` → `DeleteDialog` ด้วย `hardDeleteTitle`/`hardDeleteConfirm`; error 409 แสดง `message` จาก catalog ที่ backend ส่ง (ทางเดียวกับ catalog error อื่นของแอป) ไม่ใช่ข้อความกลาง
- [ ] **Step 4:** ตรวจ activity sheet: void/restore ขึ้นชื่อ action อ่านออก — ถ้า BE บันทึกเป็น `update` ก็พอ, ถ้าเป็นค่าใหม่ให้เติม `ACTION_TITLE_KEY` (ดู skill `activity-sheet`)
- [ ] **Step 5:** typecheck + lint + `bun test:run routes/vendor-management/price-list` (เทสต์เดิมต้องผ่าน)
- [ ] **Step 6:** commit `feat(price-list): ปุ่ม void/กู้คืน/ลบถาวร (admin) ในหน้าเอกสาร`

### Task 7: ตรวจมือ + PR

- [ ] **Step 1:** รัน migration บน dev ทีละ BU (backup `tb_pricelist` ก่อน — DB ร่วม) → BE local → `VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev`
- [ ] **Step 2:** เบราว์เซอร์ (`/vendor-management/price-list`): void ใบทดสอบ → อยู่แท็บ "ทั้งหมด" ป้ายโมฆะ, ไม่อยู่สองแท็บแรก → เปิดใบเห็นแถบ + ไม่มี Edit → ไม่ขึ้นใน price compare ของ PR → restore → draft → admin ลบใบที่ไม่มีใครอ้างได้ → ใบที่ PR/PO อ้าง ได้ 409 พร้อมเลข → user non-admin ไม่เห็นปุ่มลบถาวร และ curl DELETE ได้ 403 → ใบเก่าที่เคยถูกลบโผล่เป็นโมฆะ → dark mode อ่านออก
- [ ] **Step 3:** push + เปิด PR FE (อังกฤษ) อ้าง PR BE และลำดับ deploy; **ไม่ merge/deploy จนกว่า user สั่ง**
