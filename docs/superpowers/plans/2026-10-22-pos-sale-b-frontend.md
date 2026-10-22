# POS Sale Interface — แผน B: Frontend (Simphony) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้าจอ POS ใต้ `/system-admin/interface/pos/<brand>` — ตั้งค่า Simphony, อัปโหลดไฟล์, ประวัติการนำเข้า, ผูก Outlet/เมนู, ตรวจและยืนยันตัดสต็อกต่อ Outlet — บน API ของแผน A

**Architecture:** แบรนด์ `micros` ใน registry ถูกแทนด้วย `simphony` และ `micros3700` ซึ่งถือฟอร์มของตัวเอง ฟอร์มใช้ `InterfacePageLayout` เดิม (ส่วนตั้งค่าอยู่ในฟอร์ม) และวางแท็บงาน (ประวัติ / ผูก Outlet / ผูกเมนู) ไว้ในช่อง `afterForm` ส่วนหน้าตรวจและยืนยันเป็น route แยก `interface/pos/:brand/imports/:importId` โค้ด POS ทั้งหมดอยู่ในโฟลเดอร์ย่อย `routes/system-admin/interface/pos/` และ hook อยู่ข้างฟีเจอร์ ส่วนงาน BE เล็ก ๆ หนึ่ง task (schema ค่าตั้งต่อแบรนด์ + secret SFTP + ตัวนับการยืนยันใน list) ทำใน BE worktree ของแผน A

**Tech Stack:** Vite + React 19 + React Router 7, TanStack Query/Table (`DataGrid`), react-hook-form + zod, use-intl, NestJS (BE task)

**Spec:** `docs/superpowers/specs/2026-10-22-pos-sale-interface-design.md` (§4.2 แบรนด์, §5.1 config, §5.3 ยืนยัน, §5.5 หน้าจอ, §5.6 สิทธิ์) · แผน A: `docs/superpowers/plans/2026-10-22-pos-sale-a-backend-core.md`

## Global Constraints

- สื่อสาร/commit message ภาษาไทย; identifier อังกฤษ
- **ไม่เขียน test ใหม่** (ความต้องการของ user) — แต่ test เดิมที่อ้าง `micros` ต้องแก้ให้ผ่าน และทุก task จบด้วย `bun run typecheck` + `bunx eslint <ไฟล์ที่แตะ>` สะอาด
- FE repo: ทำบน branch `feature/pos-sale-interface` ใน checkout หลัก `carmen-inventory-frontend-react` · BE: worktree `../carmen-turborepo-backend-v2-pos-sale` branch `feature/pos-sale-interface`
- import ข้ามโมดูลห้าม (`routes/<A>` → `routes/<B>`); ของใช้ร่วมอยู่ใน `components/` `hooks/` `lib/` `types/` — `LookupLocation`/`LookupRecipe` จาก `components/lookup/` ใช้ได้
- ข้อความทุกคำผ่าน i18n ทั้ง `messages/en.json` และ `messages/th.json` (คีย์ต้องตรงกัน — `i18n-key-parity.test.ts`); **ห้ามมี `{` `}` นอกจาก ICU param และห้าม `<คำ>`** ในไฟล์แปล
- สีสถานะเป็นข้อความต้องใช้ `text-success-ink` / `text-warning-ink` / `text-destructive` — ห้าม `text-success`; ไม่มี `bg-status-*`; ห้ามขนาดตัวอักษรนอก ladder; อ่านออกทั้ง light/dark (`docs/DESIGN.md`)
- ปุ่มหลัก (variant default) ไม่เกินหนึ่งปุ่มต่อหน้า — ปุ่มยืนยันต่อ Outlet / อัปโหลด / ยกเลิก เป็น `variant="outline"`
- list ใช้ perpage ≤ 100 เสมอ ห้าม `perpage=-1`; lookup เป็น lazy (`LookupLocation`/`LookupRecipe` เดิม)
- หน้าที่มี `DataGrid` + เปลี่ยนหน้า ใส่ `"use no memo";` บรรทัดแรกของคอมโพเนนต์หน้า (`routes/CLAUDE.md`)
- BE: logic layer ห้าม throw — คืน `Result`; schema ฟิลด์ใหม่ใช้ `.optional()` ห้าม `.default()`; ฟิลด์ใหม่ใน response ต้องเติมทั้ง micro และ gateway serializer/DTO
- BE: หลัง `gen:rpc-contract` ให้ revert การเปลี่ยนของ `business.ts` / `pricelists.ts` ที่ไม่เกี่ยว (drift ที่เจอในแผน A)
- API base: `/api/proxy/api/${buCode}/pos-sales/...` (gateway `@Controller('api/:bu_code/pos-sales')`)
- ลิงก์ Stock Out: `/inventory-management/inventory-adjustment/<stock_out_id>?type=stock-out`
- สิทธิ์ยืนยัน: `PERMISSIONS.inventory_management.stock_out.create` (`constant/permissions.ts:101`) ผ่าน `useCan().can()`

## Review Focus

1. **ยืนยันแล้วของไม่พอ** (`POS_SALE_INSUFFICIENT_STOCK`, `ApiError.details.shortages`) → ผู้ใช้ต้องเห็นรายการสินค้าที่ขาด (ชื่อ, ต้องการ, คงเหลือ) ไม่ใช่ toast ทั่วไป — Task 7
2. **อัปโหลดได้ 201 แต่ status ≠ `success`** (duplicate / missing GLID / multi-day / format error) → ต้องแสดงเป็นการปฏิเสธพร้อมเหตุ ไม่ใช่ "สำเร็จ"; `success` + `legacy_export_version` → แสดงคำเตือน — Task 5
3. **รหัส SFTP เป็น mask `***ENCRYPTED***`** → กด Save โดยไม่แตะ ต้องส่ง mask เดิมกลับ (BE คืนค่าเดิม) และ GET ไม่คืนรหัสจริง — Task 1 + Task 4
4. **กดยืนยันซ้ำ / สองแท็บพร้อมกัน** → ปุ่มปิดระหว่าง pending; 409 `POS_SALE_CONFIRM_CONFLICT` แสดงข้อความแล้ว refetch preview + import — Task 7
5. **เมนูหลายพันรายการ** → ตารางผูกเมนูแบ่งหน้าที่ server (perpage 50) กรอง "ยังไม่ผูก" ที่ server; ผูกแล้วแถวหายจากมุมมองกรองหลัง refetch ไม่ใช่ค้าง — Task 6

ทั้ง 5 ข้อพิสูจน์ด้วยการตรวจมือในเบราว์เซอร์ (Task 8) ไม่ใช่ test อัตโนมัติ ตามความต้องการของ user

---

### Task 1: BE — config ต่อแบรนด์ + secret SFTP + ตัวนับการยืนยันในประวัติ

**Files (BE worktree):**
- Modify: `apps/micro-business/src/app-config/app-config.service.ts` (schemas ~ln 60, `secretPathsFor` ~ln 206, `validateValue` ~ln 555)
- Modify: `apps/micro-business/src/inventory/pos-sale/pos-sale-import.service.ts` (`findAllImports` ~ln 183–213)
- Modify: `apps/backend-gateway/src/application/pos-sales/swagger/response.ts` (`PosSaleImportListItemDto`) + serializer/zod response ของ gateway ถ้ามี (ดู `pos-sales.service.ts`)
- Modify: spec เดิมที่แดงเพราะการเปลี่ยนนี้เท่านั้น (`app-config.service.spec.ts`)

**Interfaces:**
- Produces (config): คีย์ `interface_pos_simphony` = `{ enabled: boolean, sftp_host: string, sftp_port: number, sftp_username: string, sftp_password: string, remote_folder_path: string, file_pattern: string, schedule_time: string }` (schedule_time รูป `HH:mm` regex `^([01]\d|2[0-3]):[0-5]\d$`, sftp_port int 1–65535) — secret path `[['sftp_password']]`; คีย์ `interface_pos_micros3700` = `{ enabled: boolean }`
- Produces (list): ทุกแถวของ `GET imports` มี `line_count: number` และ `confirmed_line_count: number` (บรรทัดที่ `stock_out_id IS NOT NULL`)

- [ ] **Step 1:** เพิ่ม `InterfacePosSimphonySchema` และ `InterfacePosMicros3700Schema` ใน `validateValue` ให้ตรวจคีย์ตรงตัวก่อน pattern `/^interface_pos(_.+)?$/` (ลำดับเดียวกับ `interface_accounting_carmen_gl`) — infrasys/square ยังใช้ `InterfacePosSchema` เดิม
- [ ] **Step 2:** `secretPathsFor('interface_pos_simphony')` คืน `[['sftp_password']]` ตรวจก่อน pattern `interface_(pos|pms)` (ไม่งั้นได้ `api_key`); micros3700 ไม่มี secret → คืน `undefined` ก่อน pattern ด้วย
- [ ] **Step 3:** `findAllImports` — หลังได้ rows ของหน้า ใช้ `tb_pos_sale_line.groupBy({ by: ['import_id'], where: { import_id: { in: ids } }, _count: { _all: true } })` และอีกครั้งที่ `stock_out_id: { not: null }` แล้ว map เป็น `line_count` / `confirmed_line_count` (0 เมื่อไม่มี) — 2 query ต่อหน้า ไม่ใช่ต่อแถว
- [ ] **Step 4:** เติมสองฟิลด์ใน `PosSaleImportListItemDto` + ตัว serialize ของ gateway (ถ้า gateway กรองฟิลด์) — ถ้า rpc-contract มี type ของ list ให้ `bun run gen:rpc-contract` แล้ว revert drift ที่ไม่เกี่ยว
- [ ] **Step 5:** `bun run check-types` (ทั้ง repo) + `bunx jest apps/micro-business/src/app-config apps/backend-gateway/src/application/pos-sales` ผ่าน
- [ ] **Step 6:** commit `feat(pos): schema ค่าตั้ง Simphony/Micros 3700 + เข้ารหัสรหัส SFTP + จำนวนบรรทัดที่ยืนยันในประวัติ`

---

### Task 2: FE — ย้ายแบรนด์ `micros` → `simphony` + `micros3700`

**Files:**
- Modify: `routes/system-admin/interface/interface-registry.ts` (pos brands)
- Modify: `routes/system-admin/interface/interface-list.tsx:45-50` (`connectionTarget`)
- Modify: `constant/__fixtures__/license-catalog.ts` (generated — ห้ามแก้มือ)
- Modify: `messages/en.json`, `messages/th.json` (`systemAdmin.interface.pos.brand`, ~ln 2733)
- Modify tests เดิม: `interface-registry.test.ts`, `interface-list.test.tsx`, `hooks/__tests__/use-interface-entitlement.test.ts`, `routes/system-admin/interface/use-interface-config.ts` (JSDoc ตัวอย่างคีย์), `types/profile.ts:52` (JSDoc)

**Interfaces:**
- Produces: `findBrand("pos","simphony").configKey === "interface_pos_simphony"`, `findBrand("pos","micros3700").configKey === "interface_pos_micros3700"`; brand ทั้งสองมี `form` ของตัวเอง (`lazy(() => import("./pos/pos-simphony-form"))`, `lazy(() => import("./pos/pos-micros3700-form"))` — ไฟล์สร้างใน Task 4; ใน task นี้สร้างเป็น stub `export default function … { return null }` ให้ build ผ่าน)

- [ ] **Step 1:** registry pos = `[{simphony, form}, {micros3700, form}, ...brands("pos", ["infrasys","square"])]`, category `form` เดิม (`pos-interface-form`) ยังเป็นค่าตั้งต้นของ infrasys/square
- [ ] **Step 2:** `connectionTarget` อ่าน `value?.endpoint ?? value?.api_server ?? value?.sftp_host`
- [ ] **Step 3:** i18n brand: ลบ `micros`; เพิ่ม `simphony: "Oracle Simphony"`, `micros3700: "Oracle Micros 3700"` (ทั้งสองภาษาใช้ชื่อเดียวกัน)
- [ ] **Step 4:** `BACKEND_REPO=../carmen-turborepo-backend-v2-pos-sale bun run gen:license-fixture` → diff ต้องมี `-interface.pos.micros`, `+interface.pos.micros3700`, `+interface.pos.simphony` (ไม่มีคีย์อื่นหาย ถ้ามี = หยุดรายงาน)
- [ ] **Step 5:** แก้ test เดิมที่อ้าง `micros` → `simphony` (ความหมายคงเดิม) แล้ว `bun test:run routes/system-admin/interface hooks/__tests__/use-interface-entitlement.test.ts constant` ผ่าน
- [ ] **Step 6:** typecheck + eslint สะอาด → commit `feat(interface): แยกแบรนด์ POS เป็น Oracle Simphony และ Micros 3700`

---

### Task 3: FE — ชั้น API ของ POS Sale (types, endpoints, hooks, ข้อความ error)

**Files:**
- Create: `routes/system-admin/interface/pos/pos-sale-types.ts`
- Create: `routes/system-admin/interface/pos/use-pos-sale.ts`
- Modify: `constant/api-endpoints.ts` (เรียงตามตัวอักษรใกล้ `PRICE_LIST*`/`PROFILE*`), `constant/query-keys.ts`
- Modify: `messages/{en,th}.json` → `errors.byCode` 13 รหัส `POS_SALE_*`

**Interfaces — Produces:**
- types (ตรงกับ `swagger/response.ts` ของ gateway): `PosBrand = "simphony" | "micros3700"`, `PosImportStatus` (6 ค่า), `PosImportSummary`, `PosImportListItem` (+ `line_count`, `confirmed_line_count` จาก Task 1), `PosImportDetail`, `PosImportOutlet`, `PosImportLine`, `PosStore`, `PosOutlet`, `PosItem`, `PosPreview`, `PosOutletPreview`, `PosIngredientPreview`, `PosUnresolved`, `PosBlockReason` (7 ค่า), `PosConfirmResult`, `PosShortage = { product_code: string; product_name: string; requested: number; available: number }`
- endpoints: `POS_SALE_IMPORTS(bu)`, `POS_SALE_IMPORT_SIMPHONY(bu)`, `POS_SALE_IMPORT(bu,id)`, `POS_SALE_IMPORT_PREVIEW(bu,id)`, `POS_SALE_IMPORT_CANCEL(bu,id)`, `POS_SALE_OUTLET_CONFIRM(bu,importId,outletId)`, `POS_SALE_STORES(bu)`, `POS_SALE_OUTLETS(bu)`, `POS_SALE_OUTLET(bu,id)`, `POS_SALE_ITEMS(bu)`, `POS_SALE_ITEM(bu,id)`
- query keys: `POS_SALE_IMPORTS`, `POS_SALE_IMPORT`, `POS_SALE_PREVIEW`, `POS_SALE_STORES`, `POS_SALE_OUTLETS`, `POS_SALE_ITEMS`
- hooks:
  - `usePosImports(params: ParamsDto | undefined, brand: PosBrand, options?)` → `PaginatedResponse<PosImportListItem>` (shape ที่ `useGridPagination` รับ)
  - `usePosImport(id)`, `usePosImportPreview(id)`
  - `usePosStores(brand)` → `PosStore[]` (กรอง brand ฝั่ง client — endpoint ไม่มี filter)
  - `usePosOutlets(storeId?)`, `usePosItems(params, { storeId?, unmapped? })` (paginated)
  - mutations: `useUploadSimphony()` (FormData field `file`) → `PosImportSummary`; `useCancelPosImport()`; `useConfirmPosOutlet()` → `PosConfirmResult`; `useUpdatePosOutlet()` (`{ location_id: string | null }`); `useUpdatePosItem()` (`{ recipe_id: string | null }`)
  - `shortagesOf(err: unknown): PosShortage[]` — อ่าน `ApiError.details.shortages` เมื่อ `appCode === "POS_SALE_INSUFFICIENT_STOCK"` ไม่งั้น `[]`

- [ ] **Step 1:** types + endpoints + query keys
- [ ] **Step 2:** hooks ตามแบบ `use-bu-api-key.ts` (`httpClient` + `ApiError.from` + `useBuCode`); mutation ใช้ `useApiMutation` ถ้ารูปตรง ไม่งั้น `useMutation` — การ invalidate: upload/cancel → `POS_SALE_IMPORTS`, `POS_SALE_STORES`; confirm → `POS_SALE_IMPORT`, `POS_SALE_PREVIEW`, `POS_SALE_IMPORTS` ของ id นั้น (ทั้ง success **และ error** เพื่อให้ preview สด); update outlet/item → `POS_SALE_OUTLETS`/`POS_SALE_ITEMS` + `POS_SALE_PREVIEW`
- [ ] **Step 3:** `errors.byCode` 13 รหัส — แปลจาก `message_en`/`message_th` ใน `packages/error-catalog/src/catalog.ts` (BE ~ln 3920–4045) ใช้ param ชื่อเดิม (`{status}` `{count}` `{outlet}` `{code}` `{location}` `{date}`)
- [ ] **Step 4:** typecheck + eslint + `bun test:run i18n-key-parity` → commit `feat(pos): ชั้น API นำเข้ายอดขาย POS และข้อความ error`

---

### Task 4: FE — ฟอร์มตั้งค่า Simphony / Micros 3700 + โครงแท็บงาน

**Files:**
- Create: `routes/system-admin/interface/pos/pos-simphony-form.tsx` (แทน stub)
- Create: `routes/system-admin/interface/pos/pos-micros3700-form.tsx` (แทน stub)
- Create: `routes/system-admin/interface/pos/pos-operations.tsx`
- Modify: `messages/{en,th}.json` → namespace ใหม่ `systemAdmin.interface.posSale`

**Interfaces:**
- Consumes: `useInterfaceConfig`, `InterfacePageLayout` (`afterForm`), `TextField`/`ToggleField` จาก `interface-fields.tsx`
- Produces: `simphonySchema` (zod ตรงกับ Task 1, `sftp_port: z.coerce.number().int().min(1).max(65535)`), `EMPTY_SIMPHONY = { enabled:false, sftp_host:"", sftp_port:22, sftp_username:"", sftp_password:"", remote_folder_path:"/export/", file_pattern:"GLExport_*.txt", schedule_time:"03:00" }`, `toSimphonyFormValues(value)` (รูปแบบ `toFormValues` เดิม — mask ถูกเก็บไว้ตามเดิม); `PosOperations({ brand }: { brand: PosBrand })`
- `PosOperations` = `Tabs` ค่า `history | outlets | items` ผูกกับ query `?tab=` (ค่าเริ่ม `history`) → render `PosImportHistory` (Task 5), `PosOutletMapping`, `PosItemMapping` (Task 6) — ใน task นี้วาง placeholder `null` ไว้ให้ task หลังแทน

- [ ] **Step 1:** Simphony form: section "การเชื่อมต่อ SFTP" (enabled, host, port, username, password `type="password"` + `revealLabels` + hint ว่าเว้นไว้ = ใช้รหัสเดิม) และ section "รอบดึงไฟล์" (remote_folder_path, file_pattern, schedule_time) — คำอธิบาย section บอกว่า "การดึงอัตโนมัติเปิดใช้ในรุ่นถัดไป" (SFTP pull เป็นแผน D) · Save → `toast.success` แล้ว**อยู่หน้าเดิม** (ไม่ navigate กลับ list เหมือน `pos-interface-form` เพราะแท็บงานอยู่หน้านี้)
- [ ] **Step 2:** Micros 3700 form: ToggleField `enabled` อย่างเดียว + ข้อความว่าการอัปโหลด PDF จะมาในรุ่นถัดไป
- [ ] **Step 3:** ทั้งสองฟอร์มส่ง `afterForm={<PosOperations brand=… />}`
- [ ] **Step 4:** typecheck + eslint → commit `feat(pos): หน้าตั้งค่า Simphony / Micros 3700 และแท็บงาน POS`

---

### Task 5: FE — ประวัติการนำเข้า + อัปโหลด Simphony + ยกเลิก

**Files:**
- Create: `routes/system-admin/interface/pos/pos-import-history.tsx`
- Create: `routes/system-admin/interface/pos/pos-simphony-upload-button.tsx`
- Create: `routes/system-admin/interface/pos/pos-import-status.ts` (ฟังก์ชันล้วน)
- Modify: `pos-operations.tsx` (แทน placeholder history), `messages/{en,th}.json`

**Interfaces:**
- Produces (`pos-import-status.ts`):
  - `importStatusTone(status: PosImportStatus): "success" | "warning" | "destructive"` — success → success, rejected_duplicate → warning, อื่น → destructive
  - `confirmationState(row: { status; cancelled_at; line_count; confirmed_line_count }): "cancelled" | "not_applicable" | "pending" | "partial" | "confirmed"` — cancelled_at ≠ null → cancelled; status ≠ success → not_applicable; confirmed 0 → pending; confirmed < line_count → partial; else confirmed
- คอลัมน์: วันขาย (`doc_date`), ร้าน (`store_name`), Source, ไฟล์, ช่องทาง (manual/sftp), สถานะ (badge + ไอคอนเตือนถ้า `warnings` มี `legacy_export_version`, tooltip = `error_message` เมื่อถูกปฏิเสธ), บรรทัด (`total_records`), ยอดขาย (`total_sales_amount` ผ่าน `use-number-formatter`), การยืนยัน (`confirmationState`), action: "ตรวจ" (ลิงก์ไป `interface/pos/<brand>/imports/<id>` เมื่อ status = success) และ "ยกเลิก" (เมื่อ `confirmationState === "pending"`)

- [ ] **Step 1:** `pos-import-status.ts`
- [ ] **Step 2:** ตาราง `DataGrid` + `useGridPagination({ useListHook: (p,o)=>usePosImports(p,brand,o), params:{perpage:20}, enabled:true })` เรียงล่าสุดก่อน (server เรียงให้แล้ว); `"use no memo";`
- [ ] **Step 3:** ปุ่มยกเลิก → `AlertDialog` ยืนยัน ("ยกเลิกแล้วนำเข้าไฟล์วันเดียวกันใหม่ได้") → `useCancelPosImport`; error 409 `POS_SALE_IMPORT_HAS_CONFIRMED_LINES` แสดงผ่าน `getUserErrorMessage`
- [ ] **Step 4:** upload button (เฉพาะ `brand === "simphony"`, ใน toolbar ของแท็บ, `variant="outline"`): `<input type="file" accept=".txt,text/plain">` ซ่อน; ไฟล์ > 10 MB ตัดที่ FE ด้วยข้อความ; ผล: `success` ไม่มี warning → toast success ("นำเข้า N บรรทัด ยอด X"); `success` + `legacy_export_version` → `toast.warning`; status อื่น → `toast.error` ด้วยข้อความต่อสถานะ (i18n `posSale.importStatus.<status>`) + `error_message` ถ้ามี; ทุกกรณี refetch ประวัติ; ปุ่มปิดระหว่าง pending และ reset ค่า input หลังเลือก (เลือกไฟล์เดิมซ้ำได้)
- [ ] **Step 5:** typecheck + eslint → commit `feat(pos): ประวัติการนำเข้า อัปโหลดไฟล์ Simphony และยกเลิกการนำเข้า`

---

### Task 6: FE — ผูก Outlet → location และ เมนู → recipe

**Files:**
- Create: `routes/system-admin/interface/pos/pos-store-filter.tsx` (Select ร้านของแบรนด์ จาก `usePosStores(brand)`; ร้านเดียว = เลือกให้อัตโนมัติ; ไม่มีร้าน = Empty "ยังไม่มีร้าน — นำเข้าไฟล์ครั้งแรกเพื่อสร้าง")
- Create: `routes/system-admin/interface/pos/pos-outlet-mapping.tsx`
- Create: `routes/system-admin/interface/pos/pos-item-mapping.tsx`
- Modify: `pos-operations.tsx`, `messages/{en,th}.json`

**Interfaces:**
- Consumes: `LookupLocation`, `LookupRecipe` (`components/lookup/`) — ส่ง `defaultLabel` = `code · name` ของค่าปัจจุบัน
- ร้านที่เลือกเก็บใน query `?store=<id>` (แชร์ระหว่างสองแท็บ)

- [ ] **Step 1:** Outlet: ตาราง (ไม่แบ่งหน้า — outlet ต่อร้านมีหลักสิบ) คอลัมน์ code, name, location (`LookupLocation` ในแถว + ปุ่มล้าง) → เปลี่ยนค่า = `useUpdatePosOutlet` ทันที + toast; แถวที่ไม่ผูก ไฮไลต์ด้วย `text-warning-ink` "ยังไม่ผูก"
- [ ] **Step 2:** Item: `DataGrid` paginated ที่ server (`perpage: 50`, search ส่ง `search`) + สวิตช์ "เฉพาะที่ยังไม่ผูก" (ค่าเริ่ม เปิด → ส่ง `unmapped=true`) คอลัมน์ code, desc1, desc2, department_code, recipe (`LookupRecipe` + ล้าง) → `useUpdatePosItem`; recipe ที่ `is_active === false` แสดงป้าย "สูตรปิดใช้" `text-destructive`; `"use no memo";`
- [ ] **Step 3:** typecheck + eslint → commit `feat(pos): ผูก Outlet กับ Location และเมนู POS กับสูตร`

---

### Task 7: FE — หน้าตรวจและยืนยันตัดสต็อก

**Files:**
- Create: `routes/system-admin/interface/pos/pos-import-review.route.tsx` (`export function Component`)
- Create: `routes/system-admin/interface/pos/pos-import-review.tsx`
- Create: `routes/system-admin/interface/pos/pos-outlet-review-card.tsx`
- Create: `routes/system-admin/interface/pos/pos-confirm-dialog.tsx`
- Modify: `routes/router.tsx` (เพิ่ม `path: "interface/pos/:brand/imports/:importId"` **ก่อน** `interface/:category/:brand`), `messages/{en,th}.json`

**Interfaces:**
- Consumes: `usePosImport(id)`, `usePosImportPreview(id)`, `useConfirmPosOutlet`, `shortagesOf`, `useInterfaceEntitlement().entitlementOf("pos", brand)` (ไม่ใช่ `entitled` → `ErrorState notFound` แบบ `interface-detail.route.tsx`), `useCan().can(PERMISSIONS.inventory_management.stock_out.create)`
- route ต้องตรวจ `brand ∈ {"simphony","micros3700"}` และ `detail.brand === brand` ไม่งั้น `ErrorState`

- [ ] **Step 1:** หัวหน้า (ตาม mockup ที่ user ดูแล้ว): ลิงก์กลับ `interface/pos/<brand>?tab=history`, วันขาย · Source, ไฟล์ · ช่องทาง · version · บรรทัด · ยอดขาย, badge สถานะ + คำเตือน `legacy_export_version`; ถูกยกเลิก → แถบแจ้ง; `preview.is_in_open_period === false` → แถบเตือน "วันขายไม่อยู่ในงวดคลังที่เปิด ยืนยันไม่ได้"
- [ ] **Step 2:** การ์ดสรุป 3 ใบ: Outlet (ผูกแล้ว / ค้าง), เมนู (ผูกแล้ว / ค้าง — นับจาก `unmapped_items` ทุก outlet), วัตถุดิบ (จำนวน product, จำนวนที่ `is_short`)
- [ ] **Step 3:** หนึ่ง `PosOutletReviewCard` ต่อ outlet (จาก `preview.outlets` จับคู่ `detail.outlets` ด้วย id): หัวการ์ด = code · name → location, ความคืบหน้า `confirmed_line_count / line_count`, ลิงก์ Stock Out ทุกใบใน `stock_out_ids`, ปุ่ม "ยืนยันตัดสต็อก" (`variant="outline"`) disabled เมื่อ `!can_confirm` หรือไม่มีสิทธิ์ หรือ mutation pending — เหตุผลจาก `block_reasons` แสดงเป็นรายการ (i18n `posSale.blockReason.<reason>`) ใต้ปุ่ม; แท็บในการ์ด: **ยอดขาย** (บรรทัดของ outlet: item code/desc, qty, unit_price, total, สถานะ ตัดแล้ว/รอ), **วัตถุดิบที่จะตัด** (product, qty + unit, คงเหลือ, `is_short` → แถว `text-destructive`, มาจากเมนู = `sources` แบบย่อ "ชื่อ ×qty" สูงสุด 2 แล้ว "+n"), **ค้างผูก** (`unmapped_items` + `unresolved` พร้อมเหตุผล i18n `posSale.unresolvedReason.<reason>` และลิงก์ไปแท็บ items ของแบรนด์)
- [ ] **Step 4:** `PosConfirmDialog`: สรุป location, วันที่ (= doc_date), จำนวนวัตถุดิบ → ยืนยัน → `useConfirmPosOutlet`; สำเร็จ → toast พร้อม `so_no` + ลิงก์ Stock Out; `POS_SALE_INSUFFICIENT_STOCK` → **ค้าง dialog เปลี่ยนเป็นตารางสินค้าที่ขาด** จาก `shortagesOf(err)` (product, ต้องการ, คงเหลือ); error อื่น → `getUserErrorMessage` (รวม 409 CONFLICT) แล้วปิด dialog; ทุกกรณี preview ถูก invalidate (Task 3)
- [ ] **Step 5:** router entry + typecheck + eslint → commit `feat(pos): หน้าตรวจวัตถุดิบและยืนยันตัดสต็อกต่อ Outlet`

---

### Task 8: ตรวจรวม + เช็กลิสต์ตรวจมือ

**Files:** ไม่มีโค้ดใหม่ (แก้เฉพาะที่ตรวจเจอ)

- [ ] **Step 1:** FE `bun run typecheck && bun run lint && bun test:run` ผ่านทั้งชุด (test เดิมทั้งหมด) · BE `bun run check-types` ผ่าน
- [ ] **Step 2:** `rg "interface_pos_micros\b|\"micros\"" --glob '!docs/**' --glob '!graft/**'` ใน FE ไม่เหลือ (ยกเว้น `micros3700`)
- [ ] **Step 3:** เขียนเช็กลิสต์ตรวจมือลง scratchpad (`pos-sale/plan-b-browser-checklist.md`) ครอบ Review Focus 1–5 + ไฟล์ตัวอย่าง `../interface/POS/symphony/20260918/*.txt` — **ไม่รันกับ dev DB เอง** (ต้องลง migration ของแผน A ก่อน = ต้องได้อนุญาตจาก user)
- [ ] **Step 4:** commit ถ้ามีแก้

---

## ลำดับ deploy (เพิ่มจากแผน A)
FE PR นี้ merge ก่อน BE (ให้ `audit:fe-license-fixture` เขียว) แต่ **deploy FE หลัง BE** — FE ก่อน BE = แท็บ POS ยิง 404, ฟอร์ม Simphony save 400 (schema POS เดิม) · Task 1 อยู่ใน branch BE เดียวกับแผน A
