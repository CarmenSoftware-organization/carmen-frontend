# POS Sale — แผน A: BE แกนกลาง + Simphony (อัปโหลด) + ตรวจและยืนยันตัดสต็อก

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** นำเข้าไฟล์ Simphony Standard Export เป็นยอดขาย POS รายวันใน tenant DB, ให้ผูก Outlet→location และ Item→recipe, แล้วยืนยันทีละ Outlet เป็น Stock Out ที่ตัดวัตถุดิบตามสูตร — ทดสอบครบวงจรได้ด้วย curl

**Architecture:** โมดูลใหม่ `inventory/pos-sale/` ใน `micro-business` (parser บริสุทธิ์ + 3 service: import / mapping / confirm) ต่อ RPC contract-first ไปที่ controller ใหม่ `api/:bu_code/pos-sales` ใน `backend-gateway` การยืนยันเขียนตาราง stock out เองใน transaction เดียวตามแบบ wastage write-off (`wastage-reporting.logic.ts:91-337`) เพื่อให้ติดป้าย `stock_out_id` บนบรรทัดยอดขายได้ใน transaction เดียวกัน

**Tech Stack:** NestJS, Prisma (tenant schema), Zod/nestjs-zod, `@repo/rpc-contract`, `@repo/error-catalog`, bun

**Spec:** `docs/superpowers/specs/2026-10-22-pos-sale-interface-design.md` (รีโป FE) — อ่านคู่กับแผนนี้

**รีโป:** `carmen-turborepo-backend-v2` (path ด้านล่างนับจาก root ของรีโปนี้) · branch `feature/pos-sale-interface` แตกจาก `main`

## Global Constraints

- **ไม่เขียน test ใหม่** (ความต้องการของ user) — ข้ามขั้น "write failing test / run test"; ทุก task จบด้วย `check-types` + eslint scoped + commit; test เดิมที่โดนแตะต้องยังผ่าน (`bunx jest <spec ที่เกี่ยว>` ใน `apps/micro-business` เมื่อแก้ `stock-out.service.ts`)
- Type check: `bun run check-types --filter=micro-business --filter=backend-gateway` (หรือ `bunx tsc --noEmit` ในแต่ละแอป) · Lint: `npx eslint --no-fix <ไฟล์ที่แตะ>` — **ห้าม** `bun run lint` (มัน `--fix` ทั้งรีโป)
- JSDoc สองภาษา (EN บรรทัดแรก แล้ว TH) บน public class/method/exported function/Zod schema const — lint บังคับ
- naming: camelCase ใน TS, snake_case เฉพาะ key ที่ boundary DB/wire; one export per file; method ≤ 20 statements; boolean `is/has/can`
- enum มาจาก Prisma เท่านั้น — Zod ใช้ `z.nativeEnum(enum_X)`, Swagger `@ApiProperty({ enum, enumName })`
- logic/service ห้าม throw ออกนอก `@TryCatch` แบบดิบ — คืน `Result.ok` / `Result.errorFromCatalog`; throw `AppError` ได้เฉพาะภายใน `$transaction` เพื่อ rollback (`@TryCatch` ส่งผ่าน AppError ตามเดิม)
- RPC: handler ใหม่เขียน `@MessagePattern({ cmd, service })` ชั่วคราว → `bun run gen:rpc-contract` → แทนด้วย `PosSale.<x>.pattern`; ห้ามแก้ `packages/rpc-contract/src/contracts/*` ด้วยมือ; ตรวจ `bun run audit:tcp-drift`
- gateway route ใหม่ทุกตัวมี `new AppIdGuard('posSale.<action>')` → regenerate `bun run scripts/generate-app-api-catalog/run.ts` + `bun run audit:app-api-catalog-drift` (api_name ที่ไม่อยู่ใน allowlist = ผู้ใช้โดน 401/logout — ลง platform seed `seed.application-api.data.ts` ด้วย ตาม `check.application-api-drift.ts`)
- Simphony index นับ 1-based รวมช่องชนิดบรรทัด (`split('|')` แล้ว `fields[n-1]`) — ตรวจกับไฟล์จริงแล้ว: MID#2=RVC, #4=item, #5=name, #7=qty, #15=RVC name, #18=name2, #20=major name, #21=major no, #24=family name, #33=gross after discount; GLID#2=store number, #3=store name, #4=first business date (การตัดสินของผม — FRD ไม่ให้ index; ไฟล์ตัวอย่าง #4=#5), #5=last business date, #8=export version, #10=POS model, #11=POS version
- ค่าที่ spec ตรึง: Source = `GLID[10] + " " + GLID[11] + " " + GLID[3]`; Description = `"Daily POS Sales Import - " + GLID[3]`; Outlet name ว่าง → `"Outlet " + code`; MID < 40 ฟิลด์ → `format_error`; version < 1.17 → รับพร้อม warning `LEGACY_EXPORT_VERSION`; UnitPrice = Total/Qty (Qty = 0 → 0)
- tenant migration ไม่ถูก apply โดย CI — deploy ราย BU ผ่าน `POST /api-system/tenant/migrations/:bu_id/deploy` (skill `tenant-migrations`); ห้ามยิง DDL โดยไม่ `SELECT current_database(), current_schema()` ก่อน
- deploy 3 แอป (gateway, business, cluster) พร้อมกันเสมอ

## Review Focus

1. **ไฟล์จาก Windows (CRLF, BOM, บรรทัดว่างท้ายไฟล์)** — ต้อง parse ได้เหมือนไฟล์ LF ปกติ (Task 4 ตัด BOM + split `/\r?\n/` + ข้ามบรรทัดว่าง; Task 11 อัปโหลดไฟล์ตัวอย่างจริงทั้งสองไฟล์)
2. **อัปโหลดไฟล์เดียวกันพร้อมกันสองครั้ง** — ต้องได้ success หนึ่ง rejected_duplicate หนึ่ง ไม่ใช่ success สอง (Task 1 partial unique index + Task 5 จับ unique violation → บันทึกเป็น `rejected_duplicate`)
3. **recipe ที่ `base_yield` = 0 หรือแปลงหน่วยไม่ได้** — ต้องไม่หารศูนย์/ไม่ตัดเป็น NaN; Outlet นั้นยืนยันไม่ได้พร้อมบอกวัตถุดิบที่มีปัญหา (Task 7 + Task 8)
4. **กดยืนยัน Outlet เดียวกันสองครั้งพร้อมกัน** — ได้ Stock Out ใบเดียว อีกครั้งได้ `POS_SALE_CONFIRM_CONFLICT` (Task 9 updateMany นับแถว + Task 11 ยิง curl คู่ขนาน)
5. **void Stock Out จากหน้า Stock Out ปกติ (ไม่ใช่จากหน้า POS)** — บรรทัดยอดขายต้องกลับเป็นยังไม่ตัด (Task 10 แก้ใน `voidStockOut` ตัวเดียวที่ทุกทางเรียก)

ทุกข้อพิสูจน์ด้วยการยิงจริงใน Task 11 (ไม่มี test อัตโนมัติตามความต้องการของ user)

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `packages/prisma-shared-schema-tenant/prisma/schema.prisma` (เพิ่ม enum/model ใหม่ + back-relation ที่ `tb_location`, `tb_recipe`, `tb_stock_out`)
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261022130000_pos_sale/migration.sql`

**Interfaces:**
- Produces: enum `enum_pos_brand { simphony micros3700 }`, `enum_pos_sale_import_status { success rejected_duplicate missing_glid_header multi_day_glid_reject rejected_multi_day format_error }`, `enum_pos_ingest_method { manual sftp }`, `enum_pos_import_warning { legacy_export_version }`; models ด้านล่าง (ชื่อคอลัมน์ตามนี้ทุก task ใช้)

- [ ] **Step 1: เพิ่ม enum + model** — audit fields แบบเดียวกับ `tb_cost_center` (`created_at/by_id`, `updated_at/by_id`, `doc_version`), id `gen_random_uuid()`:
  - `tb_pos_store`: `brand enum_pos_brand`, `store_key VarChar`, `store_name VarChar` · `@@unique([brand, store_key])`
  - `tb_pos_outlet`: `store_id → tb_pos_store`, `code VarChar(20)`, `name VarChar`, `location_id Uuid? → tb_location (onDelete: SetNull)` · `@@unique([store_id, code])`
  - `tb_pos_department`: `store_id`, `code VarChar(20)`, `desc1`, `desc2 VarChar?` · `@@unique([store_id, code])`
  - `tb_pos_item`: `store_id`, `code VarChar(20)`, `desc1`, `desc2 VarChar?`, `department_code VarChar(20)?`, `recipe_id Uuid? → tb_recipe (onDelete: SetNull)` · `@@unique([store_id, code])`, `@@index([store_id, recipe_id])`
  - `tb_pos_sale_import`: `brand`, `store_id Uuid?` (null เมื่อปฏิเสธก่อนรู้ร้าน), `doc_date Date?`, `source VarChar?`, `description VarChar?`, `file_name VarChar`, `detected_version VarChar?`, `ingest_method enum_pos_ingest_method`, `status enum_pos_sale_import_status`, `warnings enum_pos_import_warning[] @default([])`, `error_message String?`, `total_records Int @default(0)`, `total_sales_amount Decimal(20,2) @default(0)`, `processing_ms Int?`, `cancelled_at Timestamptz?`, `cancelled_by_id Uuid?` · `@@index([doc_date, status])`
  - `tb_pos_sale_line`: `import_id → tb_pos_sale_import (onDelete: Cascade)`, `outlet_id → tb_pos_outlet`, `item_id → tb_pos_item`, `qty Decimal(20,5)`, `unit_price Decimal(20,5)`, `total Decimal(20,2)`, `stock_out_id Uuid? → tb_stock_out (onDelete: SetNull)` · `@@unique([import_id, outlet_id, item_id])`, `@@index([stock_out_id])`
- [ ] **Step 2: สร้าง migration** — `cd packages/prisma-shared-schema-tenant && DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" bunx prisma migrate dev --name pos_sale --create-only` แล้ว rename folder เป็น `20261022130000_pos_sale`; แก้ SQL ให้มี `IF NOT EXISTS` แบบ `20260904103000_add_cost_center` และเพิ่ม partial unique ที่ Prisma ประกาศไม่ได้ (กัน Review Focus #2):
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS "pos_sale_import_live_success_u"
    ON "tb_pos_sale_import" ("doc_date", "source")
    WHERE "status" = 'success' AND "cancelled_at" IS NULL;
  ```
  ใส่คอมเมนต์ภาษาไทยอธิบายว่าทำไม index นี้อยู่ใน SQL เท่านั้น
- [ ] **Step 3:** `bun run db:generate` แล้ว `bun run build:package` — Expected: สำเร็จ, `@repo/prisma-shared-schema-tenant` export enum ใหม่
- [ ] **Step 4:** `bun run check-types` — Expected: ผ่าน
- [ ] **Step 5: Commit** — `git add packages/prisma-shared-schema-tenant && git commit -m "feat(pos-sale): ตารางยอดขาย POS และ master ร้าน/Outlet/เมนู"`

### Task 2: Error catalog

**Files:**
- Modify: `packages/error-catalog/src/module.ts` (เพิ่ม `POS_SALE: 410`)
- Modify: `packages/error-catalog/src/catalog.ts`
- Regenerate: `packages/error-catalog/reference/error-codes.json`, `.md`

**Interfaces:**
- Produces (`ERROR_CATALOG.<KEY>`, id = `makeId(MODULE.POS_SALE, n)` เรียง 1…):
  | KEY | http | params ใน message |
  |---|---|---|
  | `POS_SALE_IMPORT_NOT_FOUND` | 404 | — |
  | `POS_SALE_OUTLET_NOT_FOUND` | 404 | — |
  | `POS_SALE_ITEM_NOT_FOUND` | 404 | — |
  | `POS_SALE_UNSUPPORTED_FILE` | 400 | — (ไฟล์ว่าง / ไม่ใช่ข้อความ) |
  | `POS_SALE_IMPORT_NOT_CONFIRMABLE` | 400 | `{status}` (import ไม่ใช่ success) |
  | `POS_SALE_IMPORT_CANCELLED` | 400 | — |
  | `POS_SALE_IMPORT_HAS_CONFIRMED_LINES` | 400 | `{count}` |
  | `POS_SALE_OUTLET_NOT_MAPPED` | 400 | `{outlet}` |
  | `POS_SALE_NOTHING_TO_CONFIRM` | 400 | `{outlet}` |
  | `POS_SALE_ADJUSTMENT_TYPE_MISSING` | 400 | `{code}` |
  | `POS_SALE_UNRESOLVED_INGREDIENTS` | 400 | `{count}` (แปลงหน่วยไม่ได้ / base_yield ≤ 0 / ลึกเกิน) |
  | `POS_SALE_INSUFFICIENT_STOCK` | 400 | `{count}`, `{location}`, `{date}` |
  | `POS_SALE_CONFIRM_CONFLICT` | 409 | — |
- ช่วงที่เหลือ reuse ของเดิม: `STOCK_OUT_DATE_NOT_CURRENT_PERIOD`, `STOCK_OUT_NO_OPEN_PERIOD`, `COMMON_NO_FILE_PROVIDED`, และ not-found ของ location/recipe ที่มีอยู่ (grep `LOCATION_NOT_FOUND` / `RECIPE_NOT_FOUND` ใน catalog แล้วใช้ตัวที่มี)
- รายการสินค้าที่ขาด/แปลงไม่ได้ ส่งเป็นฟิลด์เพิ่มใน params object (`shortages`, `ingredients`) แบบเดียวกับที่ `shortageError` (`stock-out.service.ts:710`) ส่ง `...shortage` — ตรวจว่า metadata ไหลถึง gateway ด้วย `Result.fromMicroserviceError`

- [ ] **Step 1:** เพิ่ม module + 13 entries (message_th เป็นภาษาไทยธรรมชาติ; ห้ามมี `{}` ที่ไม่ใช่ param)
- [ ] **Step 2:** `cd packages/error-catalog && bun run gen:reference && bunx jest src/catalog.spec.ts` — Expected: PASS (spec เดิมตรวจ code/id ซ้ำ)
- [ ] **Step 3: Commit** — `git commit -m "feat(pos-sale): error catalog ของการนำเข้าและยืนยันยอดขาย POS"`

### Task 3: Adjustment type `SALE` (seed ต่อ BU)

**Files:**
- Create: `apps/micro-business/src/authen/tenant_seed/seed-sets/pos-sale-adjustment-type.seed-set.ts`
- Modify: `apps/micro-business/src/authen/tenant_seed/seed-sets/index.ts` (ต่อท้าย `adjustmentTypeSeedSet`)
- Create: `apps/micro-business/src/inventory/pos-sale/pos-sale.constants.ts`

**Interfaces:**
- Produces: `export const POS_SALE_ADJUSTMENT_TYPE_CODE = 'SALE'` (ใน `pos-sale.constants.ts` — ไฟล์นี้ export ค่าคงที่ตัวเดียว)
- Produces: `posSaleAdjustmentTypeSeedSet: SeedSetDef` — `key: 'pos-sale-adjustment-type'`, แถว `{ code: 'SALE', name: 'Sale', type: enum_adjustment_type.stock_out, description: 'Ingredient consumption from POS sales (recipe-based)' }`

- [ ] **Step 1:** เขียน seed set ตามรูป `adjustment-type.seed-set.ts` แต่ `listMissing` ตรวจ **code อย่างเดียว** — เหตุผล (ใส่เป็นคอมเมนต์ไทย): set เดิมข้ามแถวเมื่อมี type ซ้ำ ซึ่งทุก BU มี stock_out type อยู่แล้ว แถวนี้จะไม่ถูกสร้างเลย
  — code `SALE` เป็นคำสามัญ BU อาจตั้งเองไว้แล้ว: ถ้ามีแถว `SALE` อยู่แล้ว seed ข้าม (unique `AT1_code_u`) และ confirm ใช้แถวนั้นเมื่อเป็น type `stock_out` ที่ active ไม่งั้นได้ `POS_SALE_ADJUSTMENT_TYPE_MISSING` — ก่อน deploy ให้ query ทุก BU หาแถว code `SALE` ที่ type ไม่ใช่ `stock_out` แล้วรายงาน user
- [ ] **Step 2:** ลงทะเบียนใน `seedSets` และตรวจว่า `TenantDb` ใน `seed-sets/types.ts` มี `tb_adjustment_type` แล้ว
- [ ] **Step 3:** check-types + eslint scoped — Expected: ผ่าน
- [ ] **Step 4: Commit** — `git commit -m "feat(pos-sale): seed adjustment type SALE ต่อ BU"`

### Task 4: Simphony parser (ฟังก์ชันบริสุทธิ์)

**Files:**
- Create: `apps/micro-business/src/inventory/pos-sale/parsers/parsed-pos-document.ts` (type `ParsedPosDocument`)
- Create: `apps/micro-business/src/inventory/pos-sale/parsers/parse-outcome.ts` (type `ParseOutcome`)
- Create: `apps/micro-business/src/inventory/pos-sale/parsers/simphony.parser.ts`

**Interfaces:**
- Produces:
  ```ts
  interface ParsedPosDocument {
    brand: enum_pos_brand;
    store_key: string; store_name: string;
    doc_date: string;            // YYYY-MM-DD
    source: string; description: string;
    detected_version: string | null;
    warnings: enum_pos_import_warning[];
    outlets: { code: string; name: string }[];
    departments: { code: string; desc1: string; desc2: string | null }[];
    items: { code: string; desc1: string; desc2: string | null; department_code: string | null }[];
    sales: { outlet_code: string; item_code: string; qty: number; total: number; unit_price: number }[]; // หักกลบแล้ว
  }
  type ParseOutcome =
    | { is_ok: true; doc: ParsedPosDocument }
    | { is_ok: false; status: enum_pos_sale_import_status; error_message: string;
        doc_date: string | null; source: string | null; store_key: string | null; store_name: string | null;
        detected_version: string | null };
  export function parseSimphonyExport(text: string): ParseOutcome
  ```
- [ ] **Step 1:** เขียน `parseSimphonyExport` — ตัด BOM, split `/\r?\n/`, ข้ามบรรทัดว่าง, `split('|')`; ตรวจตามลำดับ: ไม่มี GLID → `missing_glid_header`; วันที่ #4/#5 ไม่ใช่ `YYYYMMDD` → `format_error`; #4 ≠ #5 → `multi_day_glid_reject`; ไม่มี MID หรือ MID ใด < 40 ฟิลด์ หรือ #7/#33 ไม่ใช่ตัวเลข → `format_error` (error_message บอกเลขบรรทัด); version (#8 ผ่าน `parseFloat`) < 1.17 → push `legacy_export_version` (ไม่ปฏิเสธ); distinct outlet/department/item ตาม code (ชื่อจากบรรทัดแรกที่เจอ); หักกลบ sales ตาม `outlet_code+item_code` ด้วยการบวก qty และ total แล้วปัด total 2 ตำแหน่ง qty 5 ตำแหน่ง แล้วคำนวณ unit_price ทีหลัง; trim ทุกฟิลด์ข้อความ; ส่ง doc_date/source/store_key กลับมาด้วยแม้ถูกปฏิเสธ (ถ้าอ่านได้)
- [ ] **Step 2:** ลองรันด้วยไฟล์ตัวอย่างจริง: `bunx tsx -e "import {parseSimphonyExport} from './apps/micro-business/src/inventory/pos-sale/parsers/simphony.parser'; import {readFileSync} from 'fs'; for (const f of process.argv.slice(1)) { const r = parseSimphonyExport(readFileSync(f,'utf8')); console.log(f, r.is_ok ? [r.doc.source, r.doc.doc_date, r.doc.sales.length, r.doc.warnings] : r) }" ../interface/POS/symphony/20260918/*.txt` — Expected: ทั้งสองไฟล์ `is_ok: true`, warnings `['legacy_export_version']`, Sunway source `Simphony 19.9.2 THMY Sunway Velocity` doc_date `2026-06-15`, MGCC doc_date `2026-07-01` (ถ้า path alias `@/` ทำให้ tsx รันไม่ได้ ใช้ `bunx ts-node -r tsconfig-paths/register` ใน `apps/micro-business`)
- [ ] **Step 3:** check-types + eslint scoped
- [ ] **Step 4: Commit** — `git commit -m "feat(pos-sale): ตัวอ่านไฟล์ Simphony Standard Export"`

### Task 5: Import service + RPC + gateway (อัปโหลด / ประวัติ / รายละเอียด / ยกเลิก)

**Files:**
- Create: `apps/micro-business/src/inventory/pos-sale/pos-sale-import.service.ts`
- Create: `apps/micro-business/src/inventory/pos-sale/pos-sale.controller.ts`
- Create: `apps/micro-business/src/inventory/pos-sale/pos-sale.module.ts`
- Modify: `apps/micro-business/src/app.module.ts` (import + imports array ข้าง `StockOutModule`)
- Create: `apps/backend-gateway/src/application/pos-sales/{pos-sales.module.ts, pos-sales.controller.ts, pos-sales.service.ts, swagger/request.ts, swagger/response.ts}`
- Create: `apps/backend-gateway/src/common/dto/pos-sale/pos-sale.dto.ts` (+ export ผ่าน `@/common` แบบ cost-center)
- Modify: `apps/backend-gateway/src/application/route-application.ts` (ข้าง `StockOutsModule`)
- Modify: `packages/prisma-shared-schema-platform/prisma/permission.route-map.ts` (`LICENSE_ROUTE_OVERRIDES['app:pos-sales'] = 'interface'`)
- Regenerate: rpc-contract, app-api catalog, license catalog (`bun run generate:license-catalog`), platform seed `seed.application-api.data.ts`

**Interfaces:**
- Consumes: `parseSimphonyExport` (Task 4), models (Task 1), catalog (Task 2)
- Produces (`PosSaleImportService extends TenantScopedService`, ทุก method `@TryCatch`):
  - `importSimphony(input: { file_base64: string; file_name: string; ingest_method: enum_pos_ingest_method }): Promise<Result<PosSaleImportSummary>>`
  - `findAllImports(paginate: IPaginate, filter: { brand?: enum_pos_brand }): Promise<Result<...>>` (paginated)
  - `findOneImport(id: string): Promise<Result<PosSaleImportDetail>>`
  - `cancelImport(id: string): Promise<Result<{ id: string }>>`
  - `PosSaleImportSummary = { id; status; warnings; error_message; doc_date; source; total_records; total_sales_amount }`
  - `PosSaleImportDetail = PosSaleImportSummary & { brand; file_name; ingest_method; store: {id, store_key, store_name} | null; cancelled_at; created_at; outlets: { id; code; name; location: {id, code, name} | null; line_count; confirmed_line_count; total; stock_out_ids: string[] }[]; lines: { id; outlet_id; item: { id; code; desc1; desc2; recipe: {id, code, name} | null }; qty; unit_price; total; stock_out_id }[] }`
- RPC service `pos-sale`, cmds: `pos-sale.import-simphony`, `pos-sale.find-all-imports`, `pos-sale.find-one-import`, `pos-sale.cancel-import`
- Gateway `@Controller('api/:bu_code/pos-sales')` (class: `@ApiTags('POS Sale')`, `@ApiHeaderRequiredXAppId()`, `@UseGuards(KeycloakGuard, PermissionGuard)`, `@ApiBearerAuth()`, extends `BaseHttpController`):
  | method path | api_name |
  |---|---|
  | `POST imports/simphony` (multipart `file`, ≤ 10 MB) | `posSale.importSimphony` |
  | `GET imports` (`?page&perpage&brand`) | `posSale.findAllImports` |
  | `GET imports/:import_id` | `posSale.findOneImport` |
  | `POST imports/:import_id/cancel` | `posSale.cancelImport` |

- [ ] **Step 1: service `importSimphony`** — decode base64 → `utf8`; ว่าง/มี `\0` → `POS_SALE_UNSUPPORTED_FILE`; parse; ถ้า `is_ok: false` → สร้างแถว import ด้วย status นั้น (store_id null หรือ upsert ร้านถ้ามี store_key) แล้วคืน summary (HTTP 201 — การปฏิเสธเป็นผลการนำเข้า ไม่ใช่ error); ถ้า ok → ตรวจซ้ำ `doc_date+source` ที่ success และ `cancelled_at IS NULL` → แถว `rejected_duplicate`; ไม่ซ้ำ → ใน `$transaction` (`{ timeout: 25000, maxWait: 8000 }`): upsert store, upsert outlet/department/item (ชื่ออัปเดตตามไฟล์ล่าสุด, ไม่แตะ `location_id`/`recipe_id`), สร้าง import (`success`, totals = จำนวนบรรทัด sales + Σtotal, processing_ms), `createMany` sale lines; จับ unique violation (`P2002`) ของ partial index → บันทึกเป็น `rejected_duplicate` นอก transaction
- [ ] **Step 2: `findAllImports` / `findOneImport` / `cancelImport`** — cancel: ไม่ใช่ success → `POS_SALE_IMPORT_NOT_CONFIRMABLE`; ยกเลิกแล้ว → `POS_SALE_IMPORT_CANCELLED`; มีบรรทัด `stock_out_id` ไม่ null → `POS_SALE_IMPORT_HAS_CONFIRMED_LINES {count}`; ไม่งั้นตั้ง `cancelled_at/by_id`
- [ ] **Step 3: controller + module** ตามรูป `CostCenterController` (`TenantContextRunner.run`, `handleResult(..., HttpStatus.CREATED)` สำหรับ import, `handlePaginatedResult` สำหรับ list); module `imports: [TenantModule, CommonModule]` (Task 9 จะเพิ่ม `InventoryTransactionModule`); ลงทะเบียนใน `app.module.ts`
- [ ] **Step 4: gen contract** — `bun run gen:rpc-contract` แล้วแทน literal ด้วย `PosSale.<x>.pattern`; `bun run audit:tcp-drift` — Expected: ไม่มี drift
- [ ] **Step 5: gateway** — upload ตาม `config_chart-of-accounts.controller.ts:477-480` (FileInterceptor limits `10 * 1024 * 1024`, `files: 1`, ไม่มีไฟล์ → `COMMON_NO_FILE_PROVIDED`) ส่ง `{ file_base64, file_name: file.originalname, ingest_method: 'manual' }`; service ใช้ `this.rpc.send(PosSale.importSimphony, { data, user_id, bu_code, version })` แล้วตรวจ `status !== HttpStatus.CREATED`; Swagger request/response + operationId `posSales_<action>`; Zod DTO สำหรับ query `brand: z.nativeEnum(enum_pos_brand).optional()`
- [ ] **Step 6: registry** — เพิ่ม `LICENSE_ROUTE_OVERRIDES['app:pos-sales'] = 'interface'`; `bun run generate:license-catalog && bun run audit:license-catalog`; `bun run scripts/generate-app-api-catalog/run.ts && bun run audit:app-api-catalog-drift`; เติม api_name ลง `seed.application-api.data.ts` แล้วรัน `check.application-api-drift.ts`; รัน `check.endpoint-permission-coverage.ts` — ถ้ามันบังคับให้ segment ใหม่มี resource ให้ทำตามที่มันบอกสำหรับ route ที่เป็น license-only (แบบ `config:app-config/interface_*`) และบันทึกสิ่งที่ทำลง commit message
- [ ] **Step 7:** check-types ทั้งสองแอป + eslint scoped — Expected: ผ่าน
- [ ] **Step 8: Commit** — `git commit -m "feat(pos-sale): อัปโหลดไฟล์ Simphony ประวัติการนำเข้า และยกเลิกการนำเข้า"`

### Task 6: Mapping service + endpoint (ร้าน / Outlet → location / เมนู → recipe)

**Files:**
- Create: `apps/micro-business/src/inventory/pos-sale/pos-sale-mapping.service.ts`
- Modify: `pos-sale.controller.ts`, `pos-sale.module.ts`, gateway `pos-sales.controller.ts` / `.service.ts` / swagger / dto

**Interfaces:**
- Produces (`PosSaleMappingService extends TenantScopedService`):
  - `findAllStores(): Promise<Result<{ id; brand; store_key; store_name; outlet_count; item_count; unmapped_item_count }[]>>`
  - `findAllOutlets(filter: { store_id?: string }): Promise<Result<{ id; store_id; code; name; location: {id, code, name} | null }[]>>`
  - `updateOutlet(input: { id: string; location_id: string | null }): Promise<Result<{ id: string }>>` — location ต้องมีอยู่และไม่ถูกลบ
  - `findAllItems(paginate: IPaginate, filter: { store_id?: string; is_unmapped?: boolean }): Promise<Result<...>>` — แต่ละแถว `{ id; store_id; code; desc1; desc2; department_code; recipe: {id, code, name, is_active} | null }`
  - `updateItem(input: { id: string; recipe_id: string | null }): Promise<Result<{ id: string }>>` — recipe ต้องมีและไม่ถูกลบ
- RPC cmds: `pos-sale.find-all-stores`, `pos-sale.find-all-outlets`, `pos-sale.update-outlet`, `pos-sale.find-all-items`, `pos-sale.update-item`
- Gateway: `GET stores` (`posSale.findAllStores`), `GET outlets?store_id` (`posSale.findAllOutlets`), `PATCH outlets/:outlet_id` body `{ location_id: uuid | null }` (`posSale.updateOutlet`), `GET items?store_id&unmapped&page&perpage&search` (`posSale.findAllItems`), `PATCH items/:item_id` body `{ recipe_id: uuid | null }` (`posSale.updateItem`)

- [ ] **Step 1:** service + handler + gateway route ตามแบบ Task 5 (`search` ค้นใน code/desc1)
- [ ] **Step 2:** gen contract + audit drift + regenerate app-api catalog/seed ตาม Task 5 Step 6
- [ ] **Step 3:** check-types + eslint scoped
- [ ] **Step 4: Commit** — `git commit -m "feat(pos-sale): ผูก Outlet กับ location และเมนูกับ recipe"`

### Task 7: แตกสูตรเป็นวัตถุดิบ (recipe explosion)

**Files:**
- Create: `apps/micro-business/src/inventory/pos-sale/explosion/recipe-graph.ts` (type `RecipeGraph`)
- Create: `apps/micro-business/src/inventory/pos-sale/explosion/load-recipe-graph.ts`
- Create: `apps/micro-business/src/inventory/pos-sale/explosion/explode-sale-lines.ts`

**Interfaces:**
- Consumes: `resolveConversion` (`apps/micro-business/src/master/recipe/ingredients/recipe-ingredient-cost.ts:123`)
- Produces:
  ```ts
  type RecipeGraph = Map<string, { id; code; name; base_yield: number; base_yield_unit: string; is_usable: boolean;
    ingredients: { ingredient_type: enum_ingredient_type; product_id: string | null; sub_recipe_id: string | null;
      qty: number; ingredient_unit_id: string; inventory_qty: number | null; wastage_percentage: number }[] }>;
  export async function loadRecipeGraph(tx: Prisma.TransactionClient, rootRecipeIds: string[]): Promise<{ graph: RecipeGraph; products: Map<string, ExplosionProduct> }>
  // ExplosionProduct = product ref + conversions เท่าที่ resolveConversion ต้องการ + code/name/inventory_unit
  export function explodeSaleLines(input: {
    lines: { line_id: string; item_code: string; item_desc: string; recipe_id: string; qty: number }[];
    graph: RecipeGraph; products: Map<string, ExplosionProduct>;
  }): {
    requirements: Map<string, { qty: number; sources: { item_code: string; item_desc: string; sale_qty: number }[] }>; // key = product_id, qty หน่วยคลัง
    unresolved: { item_code: string; recipe_code: string; ingredient_name: string; reason: 'no_conversion' | 'zero_yield' | 'too_deep' | 'recipe_unusable' }[];
    resolved_line_ids: string[];      // บรรทัดที่แตกได้ครบทุกวัตถุดิบ
  }
  ```
- [ ] **Step 1: `loadRecipeGraph`** — BFS ทีละชั้น (หนึ่ง query ต่อชั้น แบบ `findCycle` ใน `ingredients/sub-recipe-graph.ts:15`) ลึกสุด 10 ชั้น; `is_usable = is_active && deleted_at == null`; โหลด product + conversions ของทุก product ingredient ในชั้นเดียว
- [ ] **Step 2: `explodeSaleLines`** — ต่อบรรทัด: factor = `sale_qty / recipe.base_yield` (`base_yield ≤ 0` → `zero_yield`); ต่อ ingredient: product → ปริมาณหน่วยคลังต่อหนึ่งชุดสูตร = `inventory_qty` ถ้าไม่ null ไม่งั้น `resolveConversion` (`qty × from_qty / to_qty`; null → `no_conversion`); sub-recipe → recurse ด้วย factor ของชั้นล่าง; คูณ `(1 + wastage_percentage/100)` และตีความปริมาณ sub-recipe กับ wastage **ให้ตรงกับ `costIngredients` (`recipe-ingredient-cost.ts:407`)** — อ่านฟังก์ชันนั้นก่อนแล้วใช้กติกาเดียวกัน เพื่อให้ยอดที่ตัดกับต้นทุนในหน้า recipe ไม่ขัดกัน; ถ้าเจอปัญหาใดในบรรทัด บรรทัดนั้นไม่เข้า `resolved_line_ids` และไม่บวกเข้า requirements เลย (ไม่ตัดครึ่งสูตร); ปัด qty 5 ตำแหน่งตอนรวมเสร็จ
- [ ] **Step 3:** check-types + eslint scoped
- [ ] **Step 4: Commit** — `git commit -m "feat(pos-sale): แตกสูตร recipe รวม sub-recipe เป็นวัตถุดิบหน่วยคลัง"`

### Task 8: Preview (หน้าตรวจ)

**Files:**
- Create: `apps/micro-business/src/inventory/pos-sale/pos-sale-confirm.service.ts` (preview ก่อน, confirm ใน Task 9)
- Modify: `pos-sale.controller.ts`, `pos-sale.module.ts` (เพิ่ม `InventoryTransactionModule` ใน imports), gateway controller/service/swagger

**Interfaces:**
- Consumes: `loadRecipeGraph`, `explodeSaleLines` (Task 7); `InventoryTransactionService.getDrawableQtyAsOf(client, productId, locationId, asOf, method)` + `getCalculationMethod(bu_code)`; `findCurrentOpenPeriod` / `isDateInPeriod` (`inventory/inventory-period.helper.ts`)
- Produces (`PosSaleConfirmService extends TenantScopedService`, inject `InventoryTransactionService`, `RpcClient`):
  - `previewImport(importId: string): Promise<Result<PosSalePreview>>`
  - `PosSalePreview = { import_id; doc_date; is_in_open_period: boolean; outlets: PosSaleOutletPreview[] }`
  - `PosSaleOutletPreview = { outlet_id; code; name; location: {id, code, name} | null; pending_line_count; unmapped_items: { item_id; code; desc1; qty }[]; unresolved: (explodeSaleLines['unresolved'][number])[]; ingredients: { product_id; product_code; product_name; inventory_unit; qty; available: number; is_short: boolean; sources: {...}[] }[]; can_confirm: boolean; block_reasons: ('location_not_mapped' | 'nothing_to_confirm' | 'insufficient_stock' | 'unresolved_ingredients' | 'period_closed' | 'import_cancelled')[] }`
- RPC cmd `pos-sale.preview-import` · Gateway `GET imports/:import_id/preview` (`posSale.previewImport`)

- [ ] **Step 1:** `buildOutletPlan(tx, importRow, outletId)` (private, ใช้ซ้ำใน Task 9) — คืน `{ outlet, pendingLines, unmappedItems, explosion }`; pending = `stock_out_id IS NULL AND qty > 0`; บรรทัดที่ item ไม่มี recipe → unmapped
- [ ] **Step 2:** `previewImport` — ต่อ Outlet เรียก plan แล้ว `getDrawableQtyAsOf(tx, product, location, doc_date, method)` ต่อวัตถุดิบ (`available + 1e-9 < qty` → short) ข้ามเมื่อไม่มี location; `unresolved` ไม่ว่าง = block `unresolved_ingredients` (บรรทัดที่แตกไม่ได้ทำให้ Outlet ยืนยันไม่ได้ — ไม่ใช่ข้ามไปเงียบ ๆ เพราะเป็นเมนูที่ผูกแล้วแต่สูตรใช้ไม่ได้); `is_in_open_period` จาก `findCurrentOpenPeriod` + `isDateInPeriod`
- [ ] **Step 3:** handler + gateway + gen contract + catalogs
- [ ] **Step 4:** check-types + eslint scoped
- [ ] **Step 5: Commit** — `git commit -m "feat(pos-sale): preview วัตถุดิบที่จะตัดและสต็อกคงเหลือต่อ Outlet"`

### Task 9: ยืนยันต่อ Outlet → Stock Out

**Files:**
- Modify: `apps/micro-business/src/inventory/pos-sale/pos-sale-confirm.service.ts`, controller, gateway

**Interfaces:**
- Consumes: Task 8 `buildOutletPlan`; `assertDateInCurrentPeriod(tx, date, ERROR_CATALOG.STOCK_OUT_DATE_NOT_CURRENT_PERIOD, ERROR_CATALOG.STOCK_OUT_NO_OPEN_PERIOD)`; `reserveStockDocumentNumbers`, `executeAdjustmentOut`, `getPostedCost` ตามที่ `wastage-reporting.logic.ts:91-337` ใช้; `POS_SALE_ADJUSTMENT_TYPE_CODE` (Task 3)
- Produces: `confirmOutlet(input: { import_id: string; outlet_id: string }): Promise<Result<{ stock_out_id: string; so_no: string; line_count: number }>>`
- RPC cmd `pos-sale.confirm-outlet` · Gateway `POST imports/:import_id/outlets/:outlet_id/confirm` (`posSale.confirmOutlet`) + `@Permission({ 'inventory_management.stock_out': ['create'] })`

- [ ] **Step 1: ตรวจก่อนเปิด transaction** (ลำดับ = ลำดับ error): import ไม่พบ → `POS_SALE_IMPORT_NOT_FOUND`; ไม่ใช่ success → `POS_SALE_IMPORT_NOT_CONFIRMABLE`; ยกเลิกแล้ว → `POS_SALE_IMPORT_CANCELLED`; outlet ไม่อยู่ในไฟล์นี้ → `POS_SALE_OUTLET_NOT_FOUND`; ไม่มี location → `POS_SALE_OUTLET_NOT_MAPPED`; period → assert; plan: ไม่มี resolved line → `POS_SALE_NOTHING_TO_CONFIRM`; unresolved ไม่ว่าง → `POS_SALE_UNRESOLVED_INGREDIENTS {count, ingredients}`; adjustment type `SALE` (active, type stock_out) ไม่มี → `POS_SALE_ADJUSTMENT_TYPE_MISSING {code}`; สต็อกขาดตัวใดตัวหนึ่ง → `POS_SALE_INSUFFICIENT_STOCK {count, location, date, shortages: [{product_code, product_name, requested, available}]}`
- [ ] **Step 2: transaction เดียว** (ทำตามแบบ wastage write-off ทีละขั้น): reserve เลขเอกสาร `STOCK-OUT` หนึ่งเลข → สร้าง `tb_stock_out` (`so_date` = doc_date, location ของ Outlet + code/name/type, adjustment type id/code, `description` = `` `POS ${source} · ${outlet.code} ${outlet.name}` ``, `info` = `{ pos_sale_import_id, pos_outlet_id }`, `doc_status: draft`) → detail หนึ่งแถวต่อ product (snapshot code/name/sku จาก `tb_product`) → `executeAdjustmentOut(tx, { ..., available_as_of: doc_date }, method)` + อัปเดต `inventory_transaction_id` และ posted cost → header `completed`, `doc_version: { increment: 1 }` → `tx.tb_pos_sale_line.updateMany({ where: { id: { in: resolved_line_ids }, stock_out_id: null }, data: { stock_out_id } })`; `count !== resolved_line_ids.length` → throw `AppError` จาก `POS_SALE_CONFIRM_CONFLICT` (rollback ทั้งก้อน — Review Focus #4); ใช้ `{ timeout: 25000, maxWait: 8000 }`
- [ ] **Step 3:** handler + gateway (+ `@Permission`) + gen contract + catalogs + permission coverage check
- [ ] **Step 4:** check-types + eslint scoped
- [ ] **Step 5: Commit** — `git commit -m "feat(pos-sale): ยืนยันยอดขายต่อ Outlet เป็น Stock Out ตามสูตร recipe"`

### Task 10: void Stock Out คืนบรรทัดยอดขาย

**Files:**
- Modify: `apps/micro-business/src/inventory/stock-out/stock-out.service.ts` (ใน transaction ของ `voidStockOut`, `:1526`)

- [ ] **Step 1:** ในบล็อก `$transaction` เดียวกับที่ตั้ง `voided` เพิ่ม `await tx.tb_pos_sale_line.updateMany({ where: { stock_out_id: id }, data: { stock_out_id: null } })` พร้อมคอมเมนต์ไทยว่าเป็นทางเดียวที่ void ทุกทางผ่าน จึงครอบทั้งหน้า POS และหน้า Stock Out (Review Focus #5)
- [ ] **Step 2:** `cd apps/micro-business && bunx jest src/inventory/stock-out/stock-out.service.spec.ts` — Expected: PASS (ถ้า mock prisma ของ spec ไม่มี `tb_pos_sale_line` ให้เพิ่ม `updateMany: jest.fn()` ใน mock เดิม — เป็นการแก้ fixture ไม่ใช่เขียน test ใหม่)
- [ ] **Step 3:** check-types + eslint scoped
- [ ] **Step 4: Commit** — `git commit -m "feat(pos-sale): void Stock Out แล้วคืนบรรทัดยอดขาย POS เป็นยังไม่ตัด"`

### Task 11: แยกแบรนด์ + ตรวจครบวงจรด้วย curl

**Files:**
- Modify: `packages/prisma-shared-schema-platform/prisma/permission.route-map.ts` — `LICENSE_ROUTE_OVERRIDES`: แทน `'config:app-config/interface_pos_micros'` ด้วย `..._pos_simphony` และ `..._pos_micros3700` (`'interface'`); `LICENSE_ONLY_RESOURCES`: แทน `['interface.pos.micros', 'Oracle Micros POS interface']` ด้วย `['interface.pos.simphony', 'Oracle Simphony POS interface']`, `['interface.pos.micros3700', 'Oracle Micros 3700 POS interface']`
- Regenerate: license catalog (+ platform seed `seed.license-feature.ts` ตามที่ generator บอก)

- [ ] **Step 1:** แก้ route map → `bun run generate:license-catalog && bun run audit:license-catalog` → check-types → commit `git commit -m "feat(pos-sale): แยกแบรนด์ POS เป็น simphony และ micros3700"` — **หมายเหตุ deploy:** ต้อง `db:seed.license-feature` และ assign feature ใหม่ให้ทุก BU ที่ carmen-platform ก่อน deploy FE แผน B (ไม่งั้นหน้าล็อก)
- [ ] **Step 2: ยิงจริง (local)** — migration ลง BU ทดสอบหนึ่งตัวผ่าน tenant-migrations, รัน seed `pos-sale-adjustment-type`, `bun run boot-check backend-gateway micro-business`, เปิด dev แล้วยิงตามลำดับ (token ของ admin ทดสอบ, `x-app-id` ตาม config):
  1. `POST /api/<bu>/pos-sales/imports/simphony -F file=@"../interface/POS/symphony/20260918/Sample Text file - GL_THMY_THMY Sunway Velocity_2026-06-15.txt"` — Expected: 201, `status: success`, `warnings: [legacy_export_version]`, `total_records` > 0
  2. ยิงข้อ 1 ซ้ำสองครั้งพร้อมกัน (`&` สองคำสั่ง) หลังยกเลิกของเดิม — Expected: success หนึ่ง `rejected_duplicate` หนึ่ง (Review Focus #2)
  3. ไฟล์ MGCC (CRLF ถ้ามี) — Expected: success (Review Focus #1); ไฟล์ที่ตัดบรรทัด GLID ออก → `missing_glid_header`; แก้ GLID#4 ให้ต่าง → `multi_day_glid_reject`
  4. `PATCH outlets/:id {location_id}` + `PATCH items/:id {recipe_id}` สองสามเมนู (มีหนึ่งตัวที่มี sub-recipe) → `GET imports/:id/preview` — Expected: ingredients รวมถูก, เมนูที่ไม่ผูกอยู่ใน `unmapped_items`
  5. ผูกเมนูกับ recipe ที่ base_yield 0 (หรือแปลงหน่วยไม่ได้) → preview block `unresolved_ingredients`; confirm → `POS_SALE_UNRESOLVED_INGREDIENTS` (Review Focus #3)
  6. confirm Outlet ที่สต็อกไม่พอ → `POS_SALE_INSUFFICIENT_STOCK` + `shortages`, ไม่มี Stock Out เกิด; ลงรับของแล้ว confirm สองคำสั่งพร้อมกัน → ใบเดียว + `POS_SALE_CONFIRM_CONFLICT` (Review Focus #4); ตรวจใบ: `so_date` = วันขาย, location ถูก, ยอดตามสูตร
  7. ผูกเมนูเพิ่ม → confirm อีก → ใบที่สองมีเฉพาะเมนูนั้น
  8. `cancel` import ที่มีบรรทัดยืนยันแล้ว → `POS_SALE_IMPORT_HAS_CONFIRMED_LINES`
  9. void ใบที่ 1 ผ่าน `DELETE /api/<bu>/stock-outs/:id/void` → `GET imports/:id` บรรทัดของใบนั้น `stock_out_id: null` (Review Focus #5)
- [ ] **Step 3:** รายงานผลแต่ละข้อ (ผ่าน/ไม่ผ่าน + response จริง) ให้ user — ข้อที่ไม่ผ่านแก้ใน task ที่เป็นเจ้าของแล้วยิงซ้ำ

## ลำดับ deploy ของแผนนี้
migration ราย BU (14 ตัว) → seed `pos-sale-adjustment-type` ทุก BU → BE 3 แอปพร้อมกัน (+ platform seed application-api / license-feature) → assign feature `interface.pos.simphony` / `interface.pos.micros3700` ทุก BU ที่ต้องใช้ — FE แผน B ตามหลัง
