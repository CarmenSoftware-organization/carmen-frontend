# Sales Consumption + Import POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ย้ายงาน POS รายวันมาไว้ใต้ Operational Planning — Import POS (raw transaction) + Sales Consumption (SC วันละใบ: mapping, verify on-hand, post เป็น Stock Out `SALE` ต่อ location, void)

**Architecture:** BE เพิ่มเอกสาร `tb_sales_consumption` ที่ sync อัตโนมัติจากการนำเข้า POS, override รายบรรทัดบน `tb_pos_sale_line`, และ service ใหม่ใน micro-business `inventory/sales-consumption/` ที่ใช้ explosion/ledger ของ pos-sale เดิม; gateway เปิด route ใต้ `api/:bu_code/pos-sales/...` (สืบ license `interface.pos`). FE ย้ายโค้ดจาก `routes/system-admin/interface/pos/` ไป `routes/operation-plan/{import-pos,sales-consumption,shared}/` และ gate เมนูด้วยสถานะ POS interface

**Tech Stack:** BE — NestJS gateway + micro-business (TCP RPC), Prisma tenant schema, zod DTO, error-catalog package · FE — Vite + React 19 + React Router 7, TanStack Query/Table, use-intl

**Spec:** `docs/superpowers/specs/2026-10-26-sales-consumption-design.md` (อ่านคู่กับ `docs/superpowers/specs/2026-10-22-pos-sale-interface-design.md`)

## Global Constraints

- **ไม่เขียน test ใหม่** (ความต้องการของ user): ทุก task = implement → `check-types`/`typecheck` + `lint` → commit; ตรวจด้วย curl + เบราว์เซอร์ · test เดิมที่โดนแตะต้องผ่าน
- สองรีโป: BE = `../carmen-turborepo-backend`, FE = repo นี้ — branch `feature/sales-consumption` ทั้งคู่ (ห้ามทำบน `main`/`prod`)
- commit message ภาษาไทย (conventional prefix ภาษาอังกฤษ) · PR ภาษาอังกฤษ
- logic layer ใน micro-business ห้าม throw ออกนอก `@TryCatch` — คืน `Result` / `Result.errorFromCatalog`; ใน `$transaction` ให้ `throw Result.errorFromCatalog(...).error`
- error ใหม่ทุกตัวเข้า `packages/error-catalog/src/catalog.ts` + `bun run gen:reference` + ข้อความ i18n FE
- endpoint ใหม่ทุกตัว: `new AppIdGuard('salesConsumption.<name>')` + regenerate `app-api-catalog.generated.ts` (api_name ใหม่ไม่อยู่ใน allowlist = user โดน logout)
- RPC ใหม่: เพิ่มใน `packages/rpc-contract/src/contracts/` + `bun run gen:rpc-contract`
- migration ใหม่ทำ partial unique ด้วย SQL มือ; ห้ามแก้ migration POS เดิมสองตัว (ตัดสิน: เพิ่ม migration ใหม่ — ง่ายต่อ review แม้ของเดิมยังไม่เคย apply)
- เวลาเป็น `Timestamptz` UTC; `sale_date` เป็น `@db.Date` (= `doc_date` ของ import)
- FE: module boundary — `routes/operation-plan/` ห้าม import `@/routes/system-admin/...` และกลับกัน; ของที่สองโมดูลใช้ → `types/` `hooks/` `components/` `lib/`
- FE: หน้าที่ห่อ `<DataGrid table={table}>` ใส่ `"use no memo";` บรรทัดแรกของ component · ไฟล์แปลห้ามมี `{}` ในข้อความ / `<คำ>` ที่ไม่ใช่แท็ก
- FE: ห้ามเพิ่ม license feature key ใหม่ — ใช้ `"interface.pos"` (มีใน catalog แล้วจาก `app:pos-sales`)
- ปุ่มหลักหนึ่งปุ่มต่อหน้า (Post เป็นหลัก, Verify/Void เป็นรอง); token สีจาก design system; อ่านออกทั้ง light/dark

## Review Focus

1. **บรรทัดเปลี่ยนหลัง verify** (แก้ override, แก้ master mapping จากแท็บ Mapping, มีไฟล์ใหม่เข้ามาเติมบรรทัด) → post ต้องถูกปฏิเสธ `SALES_CONSUMPTION_VERIFY_STALE` — signature ต้องคิดจากค่า *effective* ไม่ใช่แค่ override (Task A6)
2. **Post สองคนพร้อมกัน / กดซ้ำ** → Stock Out ชุดเดียว (lock SC `FOR UPDATE` + เช็ก `status='pending'` ใน tx) (Task A7)
3. **Void Stock Out ที่มาจาก SC ตรงจากหน้า Stock Out / Micros overwrite** → ต้องโดนบล็อก ไม่ใช่ void แล้ว SC ค้าง `posted` (Task A8)
4. **วันที่ไม่มี SC แต่มี import** (ยอด 0 ทั้งหมด) และ **SC pending ที่เหลือ 0 บรรทัด** → ปฏิทินต้องขึ้น "ไม่มียอดขาย" ไม่ใช่ "ไม่มีไฟล์" และไม่เหลือ SC ผี (Task A3, A5)
5. **BU ที่ไม่ได้เปิด POS** เข้า URL ตรง → หน้าแจ้ง ไม่ใช่ error/หน้าว่าง; endpoint SC ตอบ `SALES_CONSUMPTION_POS_NOT_ENABLED` (Task A9, B3)

---

# Part A — Backend (`../carmen-turborepo-backend`)

### Task A1: Schema + migration

**Files:**
- Modify: `packages/prisma-shared-schema-tenant/prisma/schema.prisma` (`tb_pos_item` ~8167, `tb_pos_sale_line` ~8236, `tb_stock_out` ~3502)
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261026120000_sales_consumption/migration.sql`

**Interfaces:**
- Produces: `enum_sales_consumption_status { pending posted voided }`; model `tb_sales_consumption { id uuid, sc_no String, sale_date DateTime @db.Date, status enum_sales_consumption_status, onhand_verified_at DateTime? @db.Timestamptz, onhand_verified_signature String?, onhand_verified_ok Boolean?, posted_at?, posted_by_id?, voided_at?, voided_by_id?, void_reason String?, doc_version Int @default(0), created_at, created_by_id?, updated_at, updated_by_id? }`
- `tb_pos_item.is_ignored Boolean @default(false)`
- `tb_pos_sale_line` + `location_id String? @db.Uuid` (→ `tb_location`, SetNull), `recipe_id String? @db.Uuid` (→ `tb_recipe`, SetNull), `is_ignored Boolean?`, `sales_consumption_id String? @db.Uuid` (→ `tb_sales_consumption`, SetNull) + `@@index([sales_consumption_id])`
- `tb_stock_out.sales_consumption_id String? @db.Uuid` (→ `tb_sales_consumption`, Restrict) + index

- [ ] **Step 1:** แก้ schema ตาม Interfaces
- [ ] **Step 2:** สร้าง migration ด้วย `bun run db:migrate -- --create-only --name sales_consumption` ใน package tenant แล้วต่อท้าย SQL มือ:
  - `CREATE UNIQUE INDEX sales_consumption_live_day_u ON tb_sales_consumption (sale_date) WHERE status <> 'voided';`
  - `CREATE UNIQUE INDEX sales_consumption_sc_no_u ON tb_sales_consumption (sc_no);`
  - `ALTER TABLE tb_pos_item ADD CONSTRAINT pos_item_ignored_no_recipe CHECK (NOT is_ignored OR recipe_id IS NULL);`
  - `ALTER TABLE tb_pos_sale_line ADD CONSTRAINT pos_sale_line_override_xor CHECK (NOT coalesce(is_ignored,false) OR recipe_id IS NULL);`
- [ ] **Step 3:** `bun run db:generate` แล้ว `bun run check-types` ที่ root → ผ่าน
- [ ] **Step 4:** commit `feat(pos-sale): schema tb_sales_consumption + override รายบรรทัด + is_ignored`

### Task A2: Error catalog + RPC contract

**Files:**
- Modify: `packages/error-catalog/src/catalog.ts` (ต่อท้ายบล็อก `POS_SALE_*` ~3960-4120; เพิ่ม `MODULE.SALES_CONSUMPTION` ถ้า enum `MODULE` ยังไม่มี)
- Create: `packages/rpc-contract/src/contracts/sales-consumption.ts`

**Interfaces:**
- Produces error codes (http, th/en ตามความหมาย): `SALES_CONSUMPTION_NOT_FOUND` 404 · `SALES_CONSUMPTION_NOT_PENDING` 409 · `SALES_CONSUMPTION_NOT_POSTED` 409 · `SALES_CONSUMPTION_HAS_UNRESOLVED_LINES` 422 (params `{count}`) · `SALES_CONSUMPTION_NOT_VERIFIED` 422 · `SALES_CONSUMPTION_VERIFY_STALE` 409 · `SALES_CONSUMPTION_VERIFY_FAILED` 422 (ผล verify ล่าสุดมีของขาด) · `SALES_CONSUMPTION_VOID_PERIOD_CLOSED` 422 · `SALES_CONSUMPTION_LINE_POSTED` 409 · `SALES_CONSUMPTION_POS_NOT_ENABLED` 403 · `STOCK_OUT_VOID_VIA_SALES_CONSUMPTION` 409 (params `{sc_no}`) · `POS_SALE_OUTLET_IN_POSTED_SC` 409 (Micros overwrite)
- Produces RPC object `SalesConsumption` patterns: `findAll`, `findOne`, `calendar`, `updateLines`, `verifyOnhand`, `post`, `void`, `posStatus` (prefix `sales-consumption.`)
- Remove from `PosSale` contract: `previewImport`, `confirmOutlet`

- [ ] **Step 1:** เพิ่ม entry ตาม Interfaces (เลข `makeId` ต่อจากตัวล่าสุดของ module) → `bun run gen:reference` ใน package error-catalog
- [ ] **Step 2:** เพิ่ม contract + ลบสองตัวของ PosSale → `bun run gen:rpc-contract`
- [ ] **Step 3:** `bun run check-types` → error เฉพาะจุดที่ยังอ้าง `previewImport`/`confirmOutlet` (แก้ใน A8); commit `feat(error-catalog): error ของ Sales Consumption + rpc contract`

### Task A3: SC sync (สร้าง/เติม/ลบ SC อัตโนมัติ)

**Files:**
- Create: `apps/micro-business/src/inventory/sales-consumption/sales-consumption-sync.ts`
- Modify: `pos-sale/pos-sale-import.service.ts` (`writeSuccess`, `cancelImport`), `pos-sale/pos-sale-micros3700.service.ts` (`writeOutletImport`, `replaceImport`)

**Interfaces:**
- Produces: `syncSalesConsumptionDay(tx: Prisma.TransactionClient, saleDate: Date, userId: string): Promise<void>`
  1. หา SC ไม่ voided ของวันนั้น
  2. ถ้าเป็น `posted` → ไม่ทำอะไร (บรรทัดใหม่ = late, ไม่ผูก)
  3. ถ้าไม่มีหรือ `pending`: บรรทัดของ import ที่ `status='success' ∧ cancelled_at IS NULL ∧ doc_date = saleDate ∧ stock_out_id IS NULL` → ผูกกับ SC pending (สร้างใหม่ถ้ายังไม่มีและมีบรรทัด qty > 0); บรรทัดของ import ที่ถูก cancel → ล้าง `sales_consumption_id`
  4. SC pending ที่ไม่เหลือบรรทัด qty > 0 → ลบ; ล้าง `onhand_verified_*` ทุกครั้งที่ชุดบรรทัดเปลี่ยน
- Produces: `nextScNo(tx, saleDate): Promise<string>` → `SC-YYYYMMDD-NN` (NN = จำนวนใบของวันนั้นทุกสถานะ + 1, เติม 0 สองหลัก)

- [ ] **Step 1:** implement ทั้งสองฟังก์ชัน
- [ ] **Step 2:** เรียก `syncSalesConsumptionDay` ในทุก tx ที่บันทึก/ยกเลิก/แทนที่ import (Simphony success, Micros outlet write, cancel, replace) หลังเขียนบรรทัด
- [ ] **Step 3:** `bun run check-types` + `bun run lint` ใน micro-business; commit `feat(sales-consumption): sync SC รายวันจากการนำเข้า POS`

### Task A4: resolve บรรทัด + ignore ระดับ item

**Files:**
- Create: `apps/micro-business/src/inventory/sales-consumption/resolve-line.ts`
- Modify: `pos-sale/pos-sale-mapping.service.ts` (`updateItem`, `findAllItems`), gateway `common/dto/pos-sale/pos-sale.dto.ts`

**Interfaces:**
- Produces: `type LineSource = 'master' | 'line'`; `interface ResolvedLine { line_id; location_id: string|null; location_source: LineSource; recipe_id: string|null; is_ignored: boolean; recipe_source: LineSource; state: 'ok'|'needs_location'|'needs_recipe'|'not_counted' }`
- Produces: `resolveLine(line: {qty; location_id; recipe_id; is_ignored}, outlet: {location_id}, item: {recipe_id; is_ignored}): ResolvedLine` — override ชนะ master; `qty <= 0` หรือ ignored → `not_counted`; location ว่าง → `needs_location`; recipe ว่าง → `needs_recipe`
- `updateItem` input → `{id, recipe_id?: string|null, is_ignored?: boolean}` (ตั้ง recipe ล้าง ignored; ตั้ง ignored ล้าง recipe)
- `findAllItems` filter → `{store_id?, status?: 'unmapped'|'mapped'|'ignored'}` (แทน `is_unmapped`)

- [ ] **Step 1–2:** implement + ปรับ DTO zod ใน gateway
- [ ] **Step 3:** `check-types` + `lint` ทั้ง micro-business และ gateway; commit `feat(pos-sale): ignore ระดับ item + resolve override รายบรรทัด`

### Task A5: อ่าน SC — list, detail, calendar, pos status

**Files:**
- Create: `apps/micro-business/src/inventory/sales-consumption/sales-consumption.service.ts`, `.controller.ts`, `.module.ts`, `interface/sales-consumption.interface.ts`
- Modify: `apps/micro-business/src/inventory/inventory.module.ts` (หรือ module ที่ register `PosSaleModule`) ให้ import `SalesConsumptionModule`

**Interfaces:**
- `findAll(paginate: IPaginate, filter: { date_from?: string; date_to?: string; status?: string }): Promise<Result<Paginated<ScListItem>>>` — `ScListItem { id, sc_no, sale_date, status, import_count, location_codes: string[], line_count, unresolved_count, total_cost: number|null, stock_outs: {id, so_no, location_code}[] }` (`total_cost` = ผลรวม Stock Out ถ้า posted, ไม่งั้น null)
- `findOne(id): Promise<Result<ScDetail>>` — `ScDetail { id, sc_no, sale_date, status, doc_version, imports: {id, brand, file_name, ingest_method, store_name}[], missing_stores: string[], sales_amount, lines: ScLine[], ingredients: ScIngredientGroup[], stock_outs, verification: {verified_at, ok, stale: boolean}|null, history: {at, action, user_name, text_params}[] }`
  - `ScLine { id, outlet: {id, code, name}, item: {id, code, desc1}, qty, total, location: {id, code, name}|null, location_source, recipe: {id, code, name}|null, is_ignored, recipe_source, state }`
  - `ScIngredientGroup { location: {id, code, name}, outlets: string[], products: {product_id, code, name, unit, qty, unit_cost, total_cost}[], total_cost, stock_out: {id, so_no}|null }` — pending: คำนวณด้วย `loadRecipeGraph` + `explodeSaleLines` แยกตาม location ของบรรทัด `ok`, `unit_cost` จาก cost ล่าสุดที่ระบบใช้กับ preview เดิม; posted/voided: อ่านจาก `tb_stock_out_detail`
  - `missing_stores` = store ที่มี import success ใน 7 วันก่อน `sale_date` แต่ไม่มีของวันนั้น
  - `history` = สร้างจาก created/imports/onhand verify/post/void ของ SC วันเดียวกันทุกใบ (รวมใบที่ voided)
- `calendar(month: 'YYYY-MM'): Promise<Result<ScCalendarDay[]>>` — `ScCalendarDay { date, status: 'posted'|'pending'|'no_sales'|'no_file'|'future'|'before_start', sc_id: string|null, unresolved_count, late_lines: number, missing_stores: number }`; "วันนี้/อนาคต" ตามวันของ BU (timezone เดียวกับที่ใช้ตัด DocDate); `before_start` = ก่อน import success วันแรกของ BU
- `posStatus(): Promise<Result<{ enabled_brands: ('simphony'|'micros3700')[] }>>` — อ่าน `tb_application_config` คีย์ `interface_pos_simphony` / `interface_pos_micros3700` ที่ `value.enabled === true`
- ทุกเมธอดยกเว้น `posStatus` เริ่มด้วย `assertPosEnabled()` → `SALES_CONSUMPTION_POS_NOT_ENABLED` ถ้า `enabled_brands` ว่าง

- [ ] **Step 1–3:** implement service/controller (`TenantContextRunner`, `handleResult`/`handlePaginatedResult`) ตาม pattern `pos-sale.controller.ts`
- [ ] **Step 4:** `check-types` + `lint`; commit `feat(sales-consumption): list/detail/calendar/pos status`

### Task A6: แก้บรรทัด + verify on-hand

**Files:**
- Modify: `sales-consumption.service.ts`; Create: `sales-consumption/line-signature.ts`

**Interfaces:**
- `updateLines(input: { id: string; line_ids: string[]; location_id?: string|null; recipe_id?: string|null; is_ignored?: boolean|null; set_item_default?: boolean }): Promise<Result<{ updated: number }>>`
  - SC ต้อง `pending` (`SALES_CONSUMPTION_NOT_PENDING`); บรรทัดต้อง `stock_out_id IS NULL` และอยู่ใน SC นี้ (`SALES_CONSUMPTION_LINE_POSTED`)
  - field ที่ส่ง `null` = ล้าง override กลับไปตาม master; `set_item_default` → เขียน `tb_pos_item.recipe_id/is_ignored` ของ item ของบรรทัดแล้วล้าง override ของบรรทัดนั้น
  - ล้าง `onhand_verified_*` ของ SC
- `lineSignature(resolved: ResolvedLine[], qtyById: Map<string, Decimal>): string` — sha256 ของรายการ `line_id|location_id|recipe_id|is_ignored|qty` เรียงตาม `line_id` (คิดจากค่า effective)
- `verifyOnhand(id): Promise<Result<ScVerifyResult>>` — `ScVerifyResult { ok: boolean; verified_at; groups: { location_id, products: { product_id, required, available, short }[] }[] }`
  - ต้องไม่มีบรรทัด `needs_*` (`SALES_CONSUMPTION_HAS_UNRESOLVED_LINES`)
  - คำนวณ requirement ต่อ location ด้วย explosion เดิม; `available` = `InventoryTransactionService.getDrawableQtyAsOf(tx, product, location, sale_date, method)`
  - บันทึก `onhand_verified_at = now`, `onhand_verified_ok = ok`, `onhand_verified_signature = lineSignature(...)`

- [ ] **Step 1–2:** implement
- [ ] **Step 3:** `check-types` + `lint`; commit `feat(sales-consumption): แก้ location/recipe รายบรรทัด + verify on-hand`

### Task A7: Post

**Files:**
- Create: `apps/micro-business/src/inventory/pos-sale/stock-out-poster.ts` (ย้ายตรรกะจาก `PosSaleConfirmService`: `createHeader`, `postLine`, `adjustOut`, `findSaleAdjustmentType`, `ledgerShortfall`)
- Modify: `sales-consumption.service.ts`

**Interfaces:**
- Produces: `postSaleStockOut(tx, args: { location: {id, code, name}; soNo: string; asOf: Date; adjustmentType: {id, code}; requirements: Map<string, {qty: Decimal}>; method: string; userId: string; description: string; salesConsumptionId: string; inventoryTx: InventoryTransactionService }): Promise<{ stock_out_id: string; so_no: string }>` — header `info: { sales_consumption_id }` + คอลัมน์ `sales_consumption_id`, สถานะ `completed`
- `post(id: string, doc_version: number): Promise<Result<{ stock_outs: {id, so_no, location_code}[] }>>` ใน `$transaction` (`timeout 25000, maxWait 8000`):
  1. `SELECT ... FOR UPDATE` SC; ต้อง `pending` และ `doc_version` ตรง
  2. `assertDateInCurrentPeriod(tx, sale_date, STOCK_OUT_DATE_NOT_CURRENT_PERIOD, STOCK_OUT_NO_OPEN_PERIOD)`
  3. resolve บรรทัด → มี `needs_*` = `SALES_CONSUMPTION_HAS_UNRESOLVED_LINES`
  4. ไม่เคย verify = `SALES_CONSUMPTION_NOT_VERIFIED`; `onhand_verified_ok=false` = `SALES_CONSUMPTION_VERIFY_FAILED`; signature ไม่ตรง = `SALES_CONSUMPTION_VERIFY_STALE`
  5. ตรวจคงเหลือซ้ำ (เหมือน `findShortages`) ขาด → `POS_SALE_INSUFFICIENT_STOCK` (รายการแยก location)
  6. `reserveStockDocumentNumbers({..., count: จำนวน location})` → `postSaleStockOut` ทีละ location → set `stock_out_id` ของบรรทัด (claim แบบมีเงื่อนไข `stock_out_id IS NULL` ไม่ครบ = `POS_SALE_CONFIRM_CONFLICT`)
  7. SC → `posted`, `posted_at/by`, `doc_version+1`

- [ ] **Step 1:** แยก `stock-out-poster.ts` (`PosSaleConfirmService` ยังคอมไพล์ได้จนกว่าจะลบใน A8)
- [ ] **Step 2:** implement `post`
- [ ] **Step 3:** `check-types` + `lint`; commit `feat(sales-consumption): post เป็น Stock Out SALE ต่อ location`

### Task A8: Void + กันทางอ้อม + ลบ confirm เดิม

**Files:**
- Modify: `inventory/stock-out/stock-out.service.ts` (`voidStockOut` ~1526), `pos-sale/pos-sale-micros3700.service.ts` (`overwriteOutlet`/`voidStockOuts`), `sales-consumption.service.ts`
- Delete: `pos-sale/pos-sale-confirm.service.ts` (+ เมธอด `previewImport`/`confirmOutlet` ใน controller/module)

**Interfaces:**
- แยก `voidStockOutInTx(tx, id: string, voidReason: string, userId: string, opts: { viaSalesConsumption: boolean }): Promise<void>` ออกจาก `voidStockOut` (ตัวเดิมเรียกตัวนี้ใน `$transaction` ของมันด้วย `viaSalesConsumption: false`) — ถ้า `sales_consumption_id` ไม่ว่าง ∧ `!viaSalesConsumption` → throw `STOCK_OUT_VOID_VIA_SALES_CONSUMPTION` `{sc_no}`; โค้ด reset `tb_pos_sale_line.stock_out_id` เดิม (~1639) คงไว้
- `void(id, void_reason: string, doc_version: number): Promise<Result<{ new_sc_id: string }>>` ใน tx เดียว: lock → ต้อง `posted` → `assertDateInCurrentPeriod(..., SALES_CONSUMPTION_VOID_PERIOD_CLOSED, STOCK_OUT_NO_OPEN_PERIOD)` → `voidStockOutInTx` ทุกใบของ SC → SC `voided` (+ `void_reason`) → ล้าง `sales_consumption_id` ของบรรทัด → `syncSalesConsumptionDay` (สร้างใบใหม่ pending รับบรรทัดเดิม + late)
- Micros overwrite ของ outlet ที่มีบรรทัด `stock_out_id` ไม่ว่าง → ผลของ outlet นั้น = `POS_SALE_OUTLET_IN_POSTED_SC` (ไม่ void เอง)

- [ ] **Step 1–3:** implement ตาม Interfaces + ลบ confirm service
- [ ] **Step 4:** `check-types` + `lint` ทั้ง micro-business; commit `feat(sales-consumption): void SC + กัน void Stock Out ตรง + ตัด confirm ราย outlet`

### Task A9: Gateway routes

**Files:**
- Modify: `apps/backend-gateway/src/application/pos-sales/pos-sales.controller.ts`, `pos-sales.service.ts`; Create DTOs ใน `common/dto/pos-sale/sales-consumption.dto.ts`
- Regenerate: `src/backstage/applications/app-api-catalog.generated.ts` (`BE/scripts/generate-app-api-catalog/run.ts`)

**Interfaces (ทั้งหมดใต้ `api/:bu_code/pos-sales`):**
| Method + path | api_name | `@Permission` |
|---|---|---|
| GET `status` | `salesConsumption.posStatus` | — |
| GET `sales-consumptions` (`?date_from&date_to&status&page&perpage`) | `salesConsumption.findAll` | `stock_out: view` |
| GET `sales-consumptions/calendar?month=YYYY-MM` | `salesConsumption.calendar` | `stock_out: view` |
| GET `sales-consumptions/:id` | `salesConsumption.findOne` | `stock_out: view` |
| PATCH `sales-consumptions/:id/lines` | `salesConsumption.updateLines` | `stock_out: create` |
| POST `sales-consumptions/:id/verify-onhand` | `salesConsumption.verifyOnhand` | `stock_out: create` |
| POST `sales-consumptions/:id/post` (`{doc_version}`) | `salesConsumption.post` | `stock_out: create` |
| POST `sales-consumptions/:id/void` (`{void_reason (1–256), doc_version}`) | `salesConsumption.void` | `stock_out: delete` |
- ใส่ `@Permission({ 'inventory_management.stock_out': ['create'] })` เพิ่มที่ PATCH `outlets/:outlet_id` และ PATCH `items/:item_id` (mapping ย้ายมาอยู่ใน SC); ลบ route `imports/:id/preview` และ `.../confirm`
- path `sales-consumptions` ต้องประกาศ **ก่อน** route ที่มี `:param` ตัวอื่นที่ชนได้; `calendar` ก่อน `:id`

- [ ] **Step 1–2:** controller + service (`rpc.call(SalesConsumption.x, {user_id, bu_code, version:'latest', data})`) + DTO zod
- [ ] **Step 3:** regenerate app-api catalog + รัน `audit-app-api-catalog-drift` ไม่มี drift
- [ ] **Step 4:** `check-types` + `lint` gateway; commit `feat(gateway): route Sales Consumption ใต้ pos-sales`
- [ ] **Step 5 (manual):** รัน local (`VITE_DEV_PROXY_TARGET` ฝั่ง FE ไม่ต้อง) — **ห้าม apply migration กับ dev DB ที่ใช้ร่วมโดยไม่ขอ user ก่อน**; ถ้า user อนุญาต: migrate → seed `SALE` → curl ทุก route ตามตาราง + ไล่ Review Focus 1–3, 5

---

# Part B — Frontend (repo นี้)

### Task B1: ย้ายโค้ด POS + ทำ Interface ให้เหลือตั้งค่า

**Files:**
- Move (git mv) จาก `routes/system-admin/interface/pos/` → `routes/operation-plan/import-pos/`: `pos-import-history.tsx`, `pos-simphony-upload-button.tsx`, `pos-micros3700-upload-button.tsx`, `pos-micros3700-import-dialog.tsx`, `micros3700-pdf.ts`, `pos-sftp-last-pull.tsx`, `pos-import-status.ts`
- Move → `routes/operation-plan/shared/`: `use-pos-sale.ts`, `use-pos-writable.ts`, `pos-store-filter.tsx`, `use-pos-store-filter.ts`, `pos-outlet-mapping.tsx`, `pos-item-mapping.tsx`
- Move → `types/pos-sale.ts`: `pos-sale-types.ts` (ลบ type ของ preview/confirm: `PosPreview`, `PosOutletPreview`, `PosIngredientPreview`, `PosIngredientSource`, `PosConfirmResult`, `PosBlockReason`, `PosUnresolved`, `PosUnmappedItem` ถ้าไม่มีผู้ใช้เหลือ)
- Delete: `pos-operations.tsx`, `pos-import-review.route.tsx`, `pos-import-review.tsx`, `pos-outlet-review-card.tsx`, `pos-confirm-dialog.tsx`; router entry `routes/router.tsx:824-827`; entry ใน `components/share/__tests__/form-page-shell.usage.test.ts:57`; `usePosImportPreview` + `useConfirmPosOutlet` + `shortagesOf` ใน `use-pos-sale.ts`; `POS_SALE_IMPORT_PREVIEW` / `POS_SALE_OUTLET_CONFIRM` ใน `constant/api-endpoints.ts`, `POS_SALE_PREVIEW` ใน `constant/query-keys.ts`
- Modify: `pos-simphony-form.tsx`, `pos-micros3700-form.tsx` — เอา `afterForm={<PosOperations/>}` และ `PosSftpLastPull` ออก ใส่ลิงก์ "ไปที่ Import POS" (`/operation-plan/import-pos`)
- i18n `messages/en.json` + `th.json`: ย้ายบล็อก `systemAdmin.interface.posSale` (~2849) ไป `operationPlan.posSale` ยกเว้นคีย์ที่ฟอร์มสองตัวยังใช้ (`simphony`, `micros3700`) ซึ่งคงไว้ที่เดิม; ลบคีย์ `review`, `blockReason`, `unresolvedReason`; แก้ `useTranslations("systemAdmin.interface.posSale…")` ในไฟล์ที่ย้ายเป็น `operationPlan.posSale…`

- [ ] **Step 1:** git mv + แก้ import path ทั้งหมด (ไฟล์ใน system-admin ต้องไม่ import `@/routes/operation-plan/...`)
- [ ] **Step 2:** ลบไฟล์/route/endpoint ตามรายการ, แก้ฟอร์ม
- [ ] **Step 3:** ย้ายคีย์ i18n ทั้งสองภาษา
- [ ] **Step 4:** `bun run typecheck` + `bun run lint` + `bun test:run components/share/__tests__ constant/` → ผ่าน; commit `refactor(pos): ย้ายโค้ด POS ไป operation-plan และให้หน้า Interface เหลือตั้งค่า`

### Task B2: API layer ของ Sales Consumption + POS status

**Files:**
- Modify: `constant/api-endpoints.ts` (ต่อจาก `POS_SALE_ITEM` ~336), `constant/query-keys.ts`, `types/pos-sale.ts`
- Create: `hooks/use-pos-status.ts`, `routes/operation-plan/sales-consumption/use-sales-consumption.ts`, `types/sales-consumption.ts`

**Interfaces:**
- endpoints: `POS_SALE_STATUS(bu)`, `SALES_CONSUMPTIONS(bu)`, `SALES_CONSUMPTION_CALENDAR(bu)`, `SALES_CONSUMPTION(bu, id)`, `SALES_CONSUMPTION_LINES(bu, id)`, `SALES_CONSUMPTION_VERIFY(bu, id)`, `SALES_CONSUMPTION_POST(bu, id)`, `SALES_CONSUMPTION_VOID(bu, id)` — path ตาม Task A9, id ผ่าน `encodeURIComponent`
- query keys: `POS_SALE_STATUS`, `SALES_CONSUMPTIONS`, `SALES_CONSUMPTION`, `SALES_CONSUMPTION_CALENDAR`
- `types/sales-consumption.ts`: ชนิดเดียวกับ `ScListItem`, `ScDetail`, `ScLine`, `ScIngredientGroup`, `ScCalendarDay`, `ScVerifyResult` ของ A5/A6
- `usePosStatus(): { enabledBrands: PosBrand[]; isEnabled: boolean; isLoading: boolean }` — ยิงเฉพาะเมื่อ `useInterfaceEntitlement().canReadConfig`; ไม่มีสิทธิ์อ่าน = `isEnabled:false`; `CACHE_STATIC`
- hooks: `useSalesConsumptions(params)`, `useSalesConsumptionCalendar(month: string)`, `useSalesConsumption(id)`, `useUpdateScLines(id)`, `useVerifyScOnhand(id)`, `usePostSalesConsumption(id)`, `useVoidSalesConsumption(id)` — mutation ผ่าน `useApiMutation` invalidate `SALES_CONSUMPTION`, `SALES_CONSUMPTIONS`, `SALES_CONSUMPTION_CALENDAR` (+ `POS_SALE_ITEMS` เมื่อ `set_item_default`)
- `usePosItems` filter เปลี่ยนจาก `is_unmapped` เป็น `status?: 'unmapped'|'mapped'|'ignored'`; `useUpdatePosItem` body รองรับ `is_ignored`

- [ ] **Step 1–2:** implement
- [ ] **Step 3:** `typecheck` + `lint`; commit `feat(sales-consumption): endpoint, type และ hook`

### Task B3: เมนู + gate ด้วย POS interface

**Files:**
- Modify: `constant/module-list.ts` (`operationPlan` ~488-529, `ModuleDto` ~71), `hooks/use-visible-modules.ts` (`annotate` ~19, `markAll` ~68), `components/route-guard.tsx`, `routes/router.tsx` (ท้าย children ของ `operation-plan` ~647), `messages/{en,th}.json` (`modules`)
- Create: `routes/operation-plan/shared/pos-not-enabled.tsx`

**Interfaces:**
- `ModuleDto.requiresPosInterface?: boolean`
- leaves ใหม่ (ต่อท้าย `operationEquipmentCategory`, `separatorBefore: true` ที่ตัวแรก):
  - `{ name: "importPos", path: "/operation-plan/import-pos", licenseFeature: "interface.pos", icon: FileUp, requiresPosInterface: true }` (ไม่มี `permission` — สิทธิ์จริงตรวจที่ BE)
  - `{ name: "salesConsumption", path: "/operation-plan/sales-consumption", licenseFeature: "interface.pos", icon: ClipboardList, requiresPosInterface: true, permission: PERMISSIONS.inventory_management.stock_out.view }`
- `useVisibleModules` ตัด leaf ที่ `requiresPosInterface && !usePosStatus().isEnabled` ออก (เหมือน hidden feature); `RouteGuard` แสดง `PosNotEnabled` แทนหน้าเมื่อเข้าทาง URL
- `PosNotEnabled()` — `ErrorState`-style ข้อความ "ยังไม่ได้เปิด POS interface" + ลิงก์ `/system-admin/interface` (แสดงลิงก์เมื่อ `canReadConfig`)
- routes: `import-pos` → `./operation-plan/import-pos/import-pos.route`; `sales-consumption` → `./operation-plan/sales-consumption/sales-consumption.route`; `sales-consumption/:id` → `./operation-plan/sales-consumption/sales-consumption-detail.route`
- i18n `modules.importPos` = "Import POS", `modules.salesConsumption` = "Sales Consumption" (th: "นำเข้ายอดขาย POS", "ตัดสต็อกจากยอดขาย")

- [ ] **Step 1–3:** implement (route file ชั่วคราว `export function Component() { return null }` จนถึง B4/B5)
- [ ] **Step 4:** `typecheck` + `lint` + `bun test:run constant/module-list` (license-feature + permission test) → ผ่าน; commit `feat(operation-plan): เมนู Import POS / Sales Consumption gate ด้วย POS interface`

### Task B4: หน้า Import POS

**Files:**
- Create: `routes/operation-plan/import-pos/import-pos.route.tsx`, `import-pos-page.tsx`, `pos-import-lines.tsx`
- Modify: `pos-import-history.tsx` (คอลัมน์ "Sales Consumption" ลิงก์ `/operation-plan/sales-consumption/:sc_id`, ปุ่ม "View lines" ตั้ง `?import=<id>`)

**Interfaces:**
- `ImportPosPage()` — `ListPageShell` title จาก `modules.importPos`; actions = ปุ่มอัปโหลดเฉพาะแบรนด์ใน `usePosStatus().enabledBrands`; การ์ด `PosSftpLastPull` เมื่อ simphony เปิด; `PosImportHistory brand=undefined` (ทุกแบรนด์ — ถ้า hook ต้องการ brand ให้ทำเป็น optional); `PosImportLines` ใต้ตารางเมื่อมี `?import`
- `PosImportLines({ importId }: { importId: string })` — DataGrid read-only จาก `usePosImport(importId)`: Store · Outlet · Department · Item code · Item · Qty · Unit price · Total, ค้นหาฝั่ง client; ไม่มีสถานะ mapping
- ต้องการให้ `PosImportListItem` มี `sales_consumption: {id, sc_no, status}|null` — ถ้า BE (A5) ยังไม่ส่ง ให้เพิ่มใน `findAllImports` ของ BE ใน task นี้ (micro-business `toImportSummary`)

- [ ] **Step 1–2:** implement
- [ ] **Step 3:** `typecheck` + `lint`; commit `feat(import-pos): หน้า Import POS แสดง raw transaction`

### Task B5: หน้า list Sales Consumption (ปฏิทิน / ตาราง / Mapping)

**Files:**
- Create: `routes/operation-plan/sales-consumption/sales-consumption.route.tsx`, `sc-list-page.tsx`, `sc-calendar.tsx`, `sc-table.tsx`, `sc-mapping.tsx`, `sc-summary.tsx`
- Modify: `routes/operation-plan/shared/pos-item-mapping.tsx` (ตัวกรอง 4 สถานะ + ปุ่ม Ignore/Unignore), `pos-outlet-mapping.tsx` (ไม่ต้องรับ `brand` — แสดงทุก store)

**Interfaces:**
- `ScListPage()` — `ListPageShell`; ตัวสลับมุมมอง `?view=calendar|list|mapping` (ค่าเริ่ม `calendar`) ผ่าน `useURL`; แถบเตือนเมื่อมี outlet ไม่มี location (ปุ่มไป `?view=mapping`)
- `ScSummary({ month })` — การ์ด 4 ใบ: Pending post, Lines need mapping, Posted (เดือน), Days without file — คำนวณจาก `useSalesConsumptionCalendar(month)`
- `ScCalendar({ month, onMonthChange })` — grid 7 คอลัมน์เริ่มจันทร์, ช่อง posted/pending เป็น `<Link>` ไป detail, ช่องอื่นเป็นข้อความ; สี: posted=`--success`/`text-success-ink`, pending=`--warning`/`text-warning-ink`, no_sales=muted, no_file=`--destructive`; เครื่องหมาย late / ไฟล์ไม่ครบ; ทุกช่องมีข้อความกำกับ (ไม่ใช้สีอย่างเดียว); `aria-label` = วันที่ + สถานะ
- `ScTable()` — DataGrid (`"use no memo"`): Document # · Sale date · Imports · Locations · Status (`StatusDotBadge`) · Lines · Need mapping · Total cost · Stock Out
- `ScMapping()` — แท็บย่อย Outlet → Location (`PosOutletMapping`) / POS item → Recipe (`PosItemMapping`); ข้อความ: master = ค่าเริ่มต้นของบรรทัดที่ยังไม่ post
- i18n ใต้ `operationPlan.salesConsumption.list.*`

- [ ] **Step 1–3:** implement
- [ ] **Step 4:** `typecheck` + `lint`; commit `feat(sales-consumption): หน้า list ปฏิทิน ตาราง และ mapping`

### Task B6: หน้า SC detail

**Files:**
- Create: `routes/operation-plan/sales-consumption/sales-consumption-detail.route.tsx`, `sc-detail-page.tsx`, `sc-detail-header.tsx`, `sc-sales-lines.tsx`, `sc-ingredients.tsx`, `sc-history.tsx`

**Interfaces:**
- `ScDetailPage({ id })` — `FormPageShell width="wide"`; header: back ลิงก์, `sc_no` + สถานะ, ช่องข้อมูล 4 ช่อง **Sale date · POS imports of the day · Sales amount · Stock Outs** (ไม่มี locations/outlets); แถวการ์ด Mapped / Ignored / Need mapping / Ingredient cost; แท็บ `?tab=sales|ingredients|history`
- ปุ่มที่หัว (pending): ข้อความสถานะ · `Verify on-hand` (รอง; disabled เมื่อ `unresolved_count > 0`; หลังกด → เปิดแท็บ ingredients; label "Re-verify on-hand" เมื่อเคยตรวจ) · `Post & deduct stock` (หลัก; enabled เมื่อ `unresolved=0 ∧ verification?.ok ∧ !verification.stale`); ลำดับข้อความสถานะ: ยังค้างผูก → ยังไม่ verify → ของขาด → พร้อม (N Stock Outs)
- ปุ่มที่หัว (posted): `Void` (รอง, `VoidDialog`) — ปิดพร้อมข้อความเมื่อ BE ตอบ `SALES_CONSUMPTION_VOID_PERIOD_CLOSED`; error ทุกตัวแสดงผ่าน error catalog i18n
- `ScSalesLines({ sc })` — DataGrid (`"use no memo"`) คอลัมน์ **Outlet · Location · POS item · Recipe · Net qty · Amount** ; Location = select (`LookupLocation` ตัวที่มีอยู่ใน `components/lookup/`) + บรรทัดเล็ก "from outlet mapping" / "changed on this line" / "outlet not mapped"; Recipe = select recipe (lazy lookup recipe ตัวที่มี) + ตัวเลือก Ignore + "from item mapping"/"changed on this line"/"item not mapped" + checkbox "Also set as item default" เมื่อค่าต่างจาก master; qty ≤ 0 แสดง "Not counted"; posted แสดงเป็นข้อความ; แต่ละการเปลี่ยน = `useUpdateScLines` (บรรทัดเดียว)
- `ScIngredients({ sc, verify })` — ข้อความสรุปผลตรวจ; กลุ่มละ location: หัว (ชื่อ location, outlets ที่มา, จำนวนสินค้า, มูลค่ารวม, ผลตรวจกลุ่ม "Can deduct"/"N short", เลข Stock Out หรือ "Stock Out on post"); ตาราง Product · Qty to deduct · Unit · Unit cost · **Total cost** · On hand (วันขาย) · Can deduct?; ก่อนตรวจ on-hand = "—"/"Not checked"; ผลตรวจหายเมื่อ `verification.stale`
- `ScHistory({ sc })` — รายการ `sc.history` ใหม่→เก่า
- i18n ใต้ `operationPlan.salesConsumption.detail.*`

- [ ] **Step 1–4:** implement header → sales lines → ingredients → history
- [ ] **Step 5:** `typecheck` + `lint`; commit `feat(sales-consumption): หน้า detail verify/post/void และแก้บรรทัด`
- [ ] **Step 6 (manual, ต่อ BE local หลัง user อนุญาต migrate):** `VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev` → ไล่ acceptance ของ spec §6 ทั้งหมดในเบราว์เซอร์ ทั้ง light/dark และความกว้างมือถือ; BU ที่ปิด POS → เมนูหาย + URL ตรงเห็น `PosNotEnabled`

---

## Deploy (หลัง merge ครบสองรีโป — ทำตาม skill `release-and-deploy`, ขอ user ก่อนทุกขั้น)

migration ราย BU (`scripts/migrate-tenants.sh`) + seed adjustment type `SALE` ทุก BU → BE (gateway + micro-business; env เดิมของ POS: `SECRET_ENCRYPTION_KEY`, `INTERNAL_JOB_*`, `POS_SFTP_DENY_CIDRS`) → allowlist `salesConsumption.*` + `posSale.*` ให้แอปที่ไม่ใช่ allow_all → micro-cronjobs → FE (`vercel --prod` จากเครื่อง). POS ยังไม่เคย deploy → ไม่มีข้อมูลเก่าต้องย้าย
