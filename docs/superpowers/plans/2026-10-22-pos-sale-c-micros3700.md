# POS Sale — แผน C: นำเข้า PDF Micros 3700 + เขียนทับต่อ Outlet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ผู้ใช้เลือก PDF รายงาน RVC Menu Item Sales Detail (`MI_R001.RPT v5.6.100`) ในเบราว์เซอร์ → เห็นสรุปต่อ Outlet + footing → เลือกเขียนทับ/ข้าม Outlet ที่เคยนำเข้าแล้ว → ได้การนำเข้าที่ "รอยืนยัน" ซึ่งใช้หน้าตรวจและยืนยันของแผน A/B ต่อได้ทันที — PDF ไม่ขึ้นเซิร์ฟเวอร์

**Architecture:** FE ใช้ pdf.js (bundle + worker, lazy-load) ดึง **ข้อความเป็นบรรทัด** (จัดด้วย Y-tolerance ≤ 4 แยกเป็นช่วงตามระยะห่างแกน X) แล้วส่ง JSON ของบรรทัดขึ้น BE — **ตัวอ่านกติกาของรายงานมีที่เดียวที่ BE** (`micros3700.parser.ts` ฟังก์ชันบริสุทธิ์) จึงไม่มีสองตัวอ่านที่เพี้ยนกัน; BE มีสอง endpoint: `check` (อ่าน+ตรวจ+หา Outlet ซ้ำ ไม่เขียนอะไรนอกจากแถวประวัติของไฟล์ที่ถูกปฏิเสธ) และ `import` (อ่าน+ตรวจซ้ำทั้งหมด แล้วเขียนทีละ Outlet) · **หนึ่ง PDF = หนึ่ง `tb_pos_sale_import` ต่อ Outlet** ผูกกันด้วย `batch_id` — การยกเลิก/preview/ยืนยัน/void ของแผน A ทำงานระดับ import อยู่แล้ว จึงกลายเป็นระดับ Outlet โดยไม่ต้องแก้สักบรรทัด และเขียนทับ = void Stock Out เดิม (ถ้ามี) → ยกเลิก import เดิมของ Outlet นั้น → สร้าง import ใหม่ ในทรานแซกชันของ Outlet นั้นเอง

**Tech Stack:** `pdfjs-dist@4.10.38`, Vite + React 19, TanStack Query, use-intl · NestJS, Prisma (tenant), Zod/nestjs-zod, `@repo/rpc-contract`, `@repo/error-catalog`, bun

**Spec:** `docs/superpowers/specs/2026-10-22-pos-sale-interface-design.md` (§2, §4.2, §4.4, §5.1, §5.4, §5.5, §6, §7 ข้อ 5) · แผน A `2026-10-22-pos-sale-a-backend-core.md` · แผน B `2026-10-22-pos-sale-b-frontend.md` · FRD + PDF ตัวอย่าง `../interface/POS/Micros 3700/` (path นับจาก `carmensoftware-organize/`)

**รีโป:** BE = worktree `../carmen-turborepo-backend-v2-pos-sale` (Task 1–6) · FE = `carmen-inventory-frontend-react` (Task 7–11) — branch `feature/pos-sale-interface` ทั้งคู่

## ที่ผมตัดสินเอง (แย้งได้)

1. **โมเดลข้อมูล: หนึ่งแถว `tb_pos_sale_import` ต่อ (PDF, Outlet)** + `batch_id` ร่วมกันทั้งไฟล์ — เหตุผล: ยกเลิก/preview/ยืนยัน/void ของแผน A ผูกกับ import ทั้งหมด ถ้าเก็บหนึ่งแถวต่อ PDF ต้องเพิ่มสถานะ "ยกเลิกระดับ Outlet" แทรกเข้าทุกจุด (preview, confirm, cancel, detail, list, ตัวนับ, race ของ confirm กับการเขียนทับ) ส่วน Source ของ FRD (`... - OutletCode`) ก็เป็นรายต่อ Outlet อยู่แล้ว · ราคาที่จ่าย: ประวัติขึ้น N แถวต่อ PDF (ตัวอย่างมี 6 Outlet) และเปิดหน้าตรวจทีละ Outlet — ชดเชยด้วยลิงก์ "Outlet อื่นจากไฟล์เดียวกัน" บนหน้าตรวจ · ขัดถ้อยคำ spec §5.1 "log ต่อไฟล์" (ไฟล์ที่ถูกปฏิเสธยังเป็นหนึ่งแถวต่อไฟล์)
2. **แก้ migration `20261022130000_pos_sale` ตรง ๆ ไม่สร้าง migration ใหม่** — ยังไม่เคย apply ที่ไหนเลย การมี migration ที่สองที่แก้ของที่เพิ่งสร้างคือเสียงรบกวนถาวร; เพิ่ม `outlet_id` `batch_id` `replaced_by_id` + partial unique index ของ Micros 3700 + ขยาย `tb_pos_department.code` / `tb_pos_item.department_code` เป็น `VarChar(100)` (FRD ให้ Code = `"DEP-" + ชื่อ` แต่ระบุ String(20) ขัดกันเอง — ตัวอย่างจริงยาวถึง 30: `DEP-Inter-Continental Favories`) · ถ้าก่อนเริ่ม Task 1 พบว่า migration นี้ถูก apply แล้วที่ BU ใด (ถาม user — ห้าม query DB เอง) → หยุด แล้วเปลี่ยนเป็น migration ใหม่ `20261023090000_pos_sale_micros3700`
3. **FE ไม่ตีความรายงาน** — ส่งบรรทัดข้อความ (`string[][]` = บรรทัด → ช่วงข้อความ) ขึ้น BE; สรุปต่อ Outlet/footing ที่ผู้ใช้เห็นก่อนกดนำเข้ามาจาก `check` ของ BE (spec §5.4 เขียนว่า FE สรุปเอง — ผลที่ผู้ใช้เห็นเหมือนกัน แต่กติกามีที่เดียว)
4. **Hotel Name = ช่วงข้อความแรก (ซ้ายสุด) ของบรรทัดที่อยู่ก่อนบรรทัด `Period From:` แรก** — บรรทัดนั้นในไฟล์จริงคือ `The TwinTower - Hotel` (x≈342) + `Umthong, Chatchai` (x≈674 = ชื่อผู้พิมพ์รายงาน) ถ้ารวมทั้งบรรทัดเป็นคีย์ร้าน คนพิมพ์คนใหม่ = ร้านใหม่ = mapping หาย (POC hardcode ชื่อโรงแรมไว้ จึงไม่เคยเจอ) · แยกช่วงเมื่อช่องว่างระหว่างชิ้นข้อความ > 20 หน่วย
5. **Footing เทียบกับคอลัมน์ Net Sales ของบรรทัด `Grand Total`** (ก่อน `- Other Discount`) — `Net Sales` บรรทัดถัดไปหัก Other Discount ระดับบิลแล้ว (Viewer20: 481,377.65 vs 481,293.11) ซึ่งไม่อยู่ในบรรทัดสินค้า · ตรวจต่อ Outlet กับบรรทัด `<ชื่อ Outlet> Total` ด้วยทั้งยอด (≤ 0.05) และจำนวนชิ้น (ต้องเท่ากัน) — ทั้ง 11 ไฟล์ตัวอย่างตรงเป๊ะ
6. **บรรทัดสินค้าต้องมีโทเคนลงท้าย `%` ครบ 5 ตัวพอดี** (ทั้ง 1,476 บรรทัดในตัวอย่างมี 5) — ชื่อเมนูที่มี `%` ติดมาจะเลื่อน anchor แล้วได้ Qty ผิดเงียบ ๆ จึงให้เป็น `format_error` ระบุเลขบรรทัดแทน
7. **dialog ค่าเริ่มต้นของ Outlet ที่ซ้ำ = "ข้าม"** — เขียนทับต้องเลือกเอง (เขียนทับที่ยืนยันแล้ว = void Stock Out)
8. **เขียนทับที่ต้อง void ต้องมีสิทธิ์ `inventory_management.stock_out.delete`** (ไม่มี action `void` ใน `seed.permission.data.ts`; gateway void ใช้ api_name `stockOut.delete`) · admin ของ BU ผ่านเสมอแบบ `PermissionGuard`
9. **ตรวจงวดก่อน void เฉพาะทางเขียนทับ** — `voidStockOut` เดิม **ไม่ตรวจงวดเลย** (void ย้อนเข้างวดปิดได้) ถ้าไม่ตรวจเอง กติกา spec "void ไม่ได้เพราะงวดปิด → ล้มเฉพาะ Outlet" จะไม่มีวันเกิด; ไม่แก้ `voidStockOut` ส่วนกลางในแผนนี้ (กระทบทุกหน้า — แจ้ง user แยก)
10. **ไฟล์ที่ถูกปฏิเสธบันทึกประวัติตอน `check`** (เป็นจุดเดียวที่ไฟล์นั้นไปถึง) · PDF ที่ pdf.js เปิดไม่ได้ (เสีย/มีรหัสผ่าน) ไม่ถึง BE จึงไม่มีแถวประวัติ — FE แจ้งข้อความเอง · PDF ภาพสแกน (ไม่มีข้อความ) ยังส่งไป BE และได้ `format_error`
11. `detected_version` = `v5.6.100` จาก footer; รุ่นอื่นรับได้ถ้าโครงตรง (ไม่มี warning — enum ไม่มีค่าให้ใช้และ FRD ตัดสินจากโครงสร้าง)
12. `pdfjs-dist@4.10.38` (ทดลองดึงข้อความจากไฟล์ตัวอย่างทั้ง 11 ไฟล์ด้วยรุ่นนี้แล้ว) โหลดแบบ dynamic import ตอนกดอัปโหลด ไม่เข้า chunk หลัก · CSP เดิม `worker-src 'self' blob:` + `script-src 'self'` พอแล้ว ไม่ต้องแก้ header ทั้ง 4 ไฟล์

## Global Constraints

- **ไม่เขียน test ใหม่** (ความต้องการของ user) — ทุก task จบด้วย static check + commit; test เดิมที่โดนแตะต้องยังผ่าน; ตรวจจริงด้วย curl/เบราว์เซอร์ใน Task 6 และ Task 11 · **ไม่รันอะไรกับ DB** จนกว่า user อนุญาต (migration ยังไม่เคยลง)
- BE: `bun run check-types --filter=micro-business --filter=backend-gateway` · lint `npx eslint --no-fix <ไฟล์ที่แตะ>` (**ห้าม** `bun run lint`) · JSDoc สองภาษา (EN แล้ว TH) บน public class/method/exported function/Zod schema · one export per file · method ≤ 20 statements · logic layer ห้าม throw ดิบ — คืน `Result`; throw `AppError` ได้เฉพาะใน `$transaction` เพื่อ rollback · หลัง `bun run gen:rpc-contract` revert drift ของ `business.ts` / `pricelists.ts` ที่ไม่เกี่ยว · route ใหม่มี `new AppIdGuard('posSale.<x>')` + regenerate app-api catalog + เติม `seed.application-api.data.ts` (api_name ที่ไม่อยู่ใน allowlist = ผู้ใช้โดน logout)
- FE: `bun run typecheck` + `bunx eslint <ไฟล์ที่แตะ>` · ข้อความผ่าน i18n ทั้ง `messages/en.json` และ `th.json` คีย์ตรงกัน ห้าม `{}` นอก ICU param และห้าม `<คำ>` · สีข้อความสถานะใช้ `text-*-ink` / `text-destructive` · ปุ่มนอก dialog เป็น `variant="outline"` (ปุ่มหลักหนึ่งปุ่มต่อหน้า) · import ข้ามโมดูลห้าม · commit message ภาษาไทย
- **PDF ไม่ออกจากเบราว์เซอร์** — FE ส่งเฉพาะบรรทัดข้อความ; BE ห้าม log `lines` (log แค่ `file_name`, จำนวนบรรทัด) และไม่เก็บ `lines` ลงตารางใด
- ค่าที่ spec ตรึง: DocDate = `Period From` (`MM/DD/YYYY` → `YYYY-MM-DD`); From ≠ To → `rejected_multi_day`; Source = `` `Micros 3700 PDF - ${hotel} - ${outletCode}` ``; Description = `` `Daily POS Sales Import - ${hotel} (${docDate})` ``; Outlet Code/Desc จาก `1 - Gold Teak`; Department Code = `"DEP-" + ชื่อ`, Desc1 = Desc2 = ชื่อ; Item Desc2 = `""` (เก็บเป็น `null` ตามแผน A); หักกลบตาม Outlet + Item; UnitPrice = Total/Qty (Qty = 0 → 0); footing ≤ 0.05; ไม่ตรงเทมเพลต/ไม่มีบรรทัดสินค้า → `format_error`; บรรทัดสรุป (`Total`/`Subtotal`) ไม่ใช่สินค้า
- Stock Out ของแผน A ไม่เปลี่ยน: ยืนยันต่อ Outlet = ต่อ import ของ Micros 3700 (`POST imports/:import_id/outlets/:outlet_id/confirm` เดิม)

## Review Focus

1. **เขียนทับ Outlet ที่ยืนยันแล้ว แต่ void ล้มกลางทาง/งวดปิด** → Outlet นั้นล้มพร้อมเหตุผล ไม่มี Stock Out ซ้อน, ชุดเก่ายังเป็นชุดที่ live (ใบที่ void ไปแล้วบรรทัดกลับเป็นรอยืนยันเอง), Outlet อื่นในไฟล์ไม่กระทบ และกดเขียนทับซ้ำได้ — Task 4 Step 3 + Task 6 ข้อ 6–7
2. **ไฟล์วันเดียวกันถูกนำเข้าระหว่าง `check` กับ `import`** (สองคน/สองแท็บ) → ห้ามได้สองชุด live ของ Outlet/วันเดียวกัน; `import` ตอบ `needs_resolution` ให้เลือกใหม่ หรือ Outlet นั้นล้ม `POS_SALE_OUTLET_ALREADY_IMPORTED` เมื่อชนกันใน DB — Task 1 index + Task 4 Step 2 + Task 6 ข้อ 5
3. **คนพิมพ์รายงานเปลี่ยน / ชื่อมีช่องว่างเกิน** → คีย์ร้านต้องยังเป็น `The TwinTower - Hotel` (mapping Outlet/เมนูไม่หาย) — Task 7 แยกช่วง + Task 11 ตรวจ 11 ไฟล์ได้ร้านเดียว
4. **PDF ผิดรายงาน / ภาพสแกน / มีรหัสผ่าน / เสีย** → ต้องไม่ออกมาเป็น "สำเร็จ 0 บรรทัด": โครงไม่ตรงหรือไม่มีข้อความ → `format_error` ในประวัติ; เปิดไม่ได้ → ข้อความที่ FE ไม่ใช่ toast ทั่วไป — Task 3 + Task 9 + Task 11
5. **ชื่อเมนู/หมวดที่มีตัวเลข จุด หรือเครื่องหมาย** (`.Steam Rice`, `B/F Lunch 550`, `Total Happy Hour 1 Free 1`, `4 - 88 Bar`, `88 Bar Total 70 …`) → ชื่อและตัวเลขถูก ไม่หลุดเป็นสินค้า ไม่ตกเป็น Outlet — Task 3 กติกา + Task 6 ข้อ 2 ตรวจยอดของ 88 Bar

ไม่มี test อัตโนมัติ — ทุกข้อพิสูจน์ด้วย curl (Task 6) และเบราว์เซอร์ (Task 11)

---

### Task 1: BE — schema + migration (แก้ของเดิม) + error catalog

**Files:**
- Modify: `packages/prisma-shared-schema-tenant/prisma/schema.prisma` (`tb_pos_sale_import`, `tb_pos_department`, `tb_pos_item`, back-relation ที่ `tb_pos_outlet`)
- Modify: `packages/prisma-shared-schema-tenant/prisma/migrations/20261022130000_pos_sale/migration.sql`
- Modify: `packages/error-catalog/src/catalog.ts` + regenerate `reference/error-codes.{json,md}`

**Interfaces — Produces:**
- `tb_pos_sale_import` เพิ่ม `outlet_id Uuid? → tb_pos_outlet (onDelete: NoAction)` (ตั้งเฉพาะ Micros 3700 ที่ success), `batch_id Uuid?` (ทุกแถวจาก PDF เดียวกันค่าเดียวกัน รวมแถวที่ถูกปฏิเสธ), `replaced_by_id Uuid?` (id ของ import ที่เขียนทับแถวนี้ — คอลัมน์เปล่าไม่มี FK) · `@@index([batch_id])`
- `tb_pos_department.code` และ `tb_pos_item.department_code` → `VarChar(100)`
- catalog ต่อจาก id 13 (`makeId(MODULE.POS_SALE, 14…)`):
  | KEY | http | params |
  |---|---|---|
  | `POS_SALE_OVERWRITE_VOID_FORBIDDEN` | 403 | `{outlet}` |
  | `POS_SALE_OVERWRITE_CONFLICT` | 409 | `{outlet}` |
  | `POS_SALE_OUTLET_ALREADY_IMPORTED` | 409 | `{outlet}`, `{date}` |

- [ ] **Step 1:** แก้ schema + SQL ในไฟล์ migration เดิม (`ALTER` ไม่ได้ — แก้ `CREATE TABLE` ตรง ๆ, FK + index ใหม่ต่อท้ายแบบเดียวกับของเดิม) แล้วเพิ่ม index พร้อมคอมเมนต์ไทยแบบ index ของ Simphony:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS "pos_sale_import_live_outlet_u"
      ON "tb_pos_sale_import" ("outlet_id", "doc_date")
      WHERE "status" = 'success' AND "cancelled_at" IS NULL AND "brand" = 'micros3700';
  ```
  คอมเมนต์บอก: หนึ่ง Outlet ต่อวันมีชุด live ได้ชุดเดียว · เขียนทับต้องยกเลิกชุดเดิมก่อนสร้างชุดใหม่ในทรานแซกชันเดียวกัน · แก้ index เดิมของ Simphony ไม่ได้ (ยังคง `brand = 'simphony'`) และแก้คอมเมนต์เดิมที่บอกว่า Micros "จะมีกฎกันซ้ำของตัวเองภายหลัง" ให้ชี้มาที่ index นี้
- [ ] **Step 2:** `cd packages/prisma-shared-schema-tenant && bun run db:generate && bun run build:package` — Expected: สำเร็จ · แล้วเทียบ SQL กับ schema ด้วยตาทีละคอลัมน์ใหม่ (ชนิด, nullable, FK, index) — **ห้ามใช้ `prisma migrate diff --from-migrations`** เพราะต้องมี shadow DB จริง
- [ ] **Step 3:** เพิ่ม 3 entries (message_th ภาษาไทยธรรมชาติ) → `cd packages/error-catalog && bun run gen:reference && bunx jest src/catalog.spec.ts` — Expected: PASS
- [ ] **Step 4:** `bun run check-types` — Expected: ผ่าน (Simphony parser ยังจำกัดรหัส department ที่ 20 — ปล่อยไว้ เข้มกว่าคอลัมน์ไม่ผิด)
- [ ] **Step 5: Commit** — `feat(pos-sale): คอลัมน์ batch/outlet/replaced_by และกันซ้ำต่อ Outlet ของ Micros 3700`

### Task 2: BE — แยกตัวเขียนผลนำเข้าออกจาก `PosSaleImportService` (refactor ไม่เปลี่ยนพฤติกรรม)

**Files:**
- Create: `apps/micro-business/src/inventory/pos-sale/import-writer/pos-sale-master-upsert.ts`, `import-writer/to-import-summary.ts`, `import-writer/to-db-date.ts`
- Modify: `apps/micro-business/src/inventory/pos-sale/pos-sale-import.service.ts`

**Interfaces — Produces** (ฟังก์ชันอิสระ ไม่ผูก `this` — ส่ง `userId` เข้ามา):
- `resolveStore(prisma: PrismaClient, brand: enum_pos_brand, storeKey: string, storeName: string, userId: string): Promise<string>` (รวมการกู้ P2002 เดิม)
- `upsertOutlets(tx: Tx, storeId: string, outlets: ParsedPosDocument['outlets'], userId: string): Promise<Map<string, string>>`
- `upsertDepartments(tx, storeId, departments, userId): Promise<void>` · `upsertItems(tx, storeId, items, userId): Promise<Map<string, string>>` · `collectDepartments(doc: ParsedPosDocument)`
- `toImportSummary(row: ImportRow): PosSaleImportSummary` · `toDbDate(isoDate: string | null): Date | null`

- [ ] **Step 1:** ย้ายเนื้อเมธอด private เดิมไปเป็นฟังก์ชันข้างบนแบบตัวอักษรต่อตัวอักษร (เปลี่ยนแค่ `this.userId` → พารามิเตอร์, `this.prismaService` → พารามิเตอร์) แล้วให้ `PosSaleImportService` เรียกผ่านฟังก์ชันเหล่านั้น
- [ ] **Step 2:** check-types + eslint scoped + `cd apps/micro-business && bunx jest src/inventory/pos-sale` (ถ้ามี spec) — Expected: ผ่าน
- [ ] **Step 3: Commit** — `refactor(pos-sale): แยกตัวบันทึกข้อมูลหลักและสรุปผลนำเข้าเป็นฟังก์ชันใช้ร่วม`

### Task 3: BE — ตัวอ่านรายงาน Micros 3700 (ฟังก์ชันบริสุทธิ์)

**Files:**
- Create: `apps/micro-business/src/inventory/pos-sale/parsers/micros3700.parser.ts`
- Create: `apps/micro-business/src/inventory/pos-sale/parsers/micros3700-footing.ts` (type)
- Create: `apps/micro-business/src/inventory/pos-sale/parsers/split-by-outlet.ts`

**Interfaces — Produces:**
```ts
interface Micros3700Footing {
  computed_total: number; reported_total: number;
  outlets: { code: string; computed_total: number; computed_qty: number;
             reported_total: number | null; reported_qty: number | null }[];
}
export function parseMicros3700Report(lines: string[][]): { outcome: ParseOutcome; footing: Micros3700Footing | null }
export function splitByOutlet(doc: ParsedPosDocument): ParsedPosDocument[]   // หนึ่งเอกสารต่อ Outlet
```
`doc` ที่ได้: `brand: micros3700`, `store_key = store_name = hotel`, `source = "Micros 3700 PDF - " + hotel` (ระดับไฟล์ — ใช้กับแถวที่ถูกปฏิเสธ), `detected_version`, `warnings: []` · `splitByOutlet` คืนเอกสารที่มี `outlets` ตัวเดียว, `sales`/`items`/`departments` เฉพาะที่ Outlet นั้นใช้, `source` แบบมีรหัส Outlet ตาม Global Constraints

- [ ] **Step 1: เขียน `parseMicros3700Report`** — ต่อบรรทัด: `text = segments.join(' ')` ยุบช่องว่าง trim, ข้ามบรรทัดว่าง; เลขบรรทัดใน error = index + 1 ตามลำดับที่ FE ส่ง กติกาตามลำดับ (ตรวจกับข้อความจริงของ Viewer20–30 แล้ว):
  1. **เทมเพลต**: ต้องมีบรรทัด `RVC Menu Item Sales Detail`, บรรทัดที่ match `/Period\s+From:\s*(\d{2})\/(\d{2})\/(\d{4})\s+To:\s*(\d{2})\/(\d{2})\/(\d{4})/i` และบรรทัด footer `/^MI_R001\.RPT\b/` — ขาดตัวใด → `format_error` ("not an MI_R001.RPT RVC Menu Item Sales Detail report"); ไม่มีบรรทัดเลย → `format_error` ("the PDF has no text — scanned image?"); `detected_version` = `/MI_R001\.RPT\s+(v[\d.]+)/`
  2. **วันที่**: ใช้ Period บรรทัดแรก; วันที่ไม่จริง → `format_error`; From ≠ To → `rejected_multi_day` (คืน doc_date = From); Period ของหน้าอื่นไม่ตรงบรรทัดแรก → `format_error` (PDF ต่อกันหลายรายงาน)
  3. **Hotel**: `segments[0]` ของบรรทัดก่อน Period บรรทัดแรก (trim) — ว่าง หรือเท่ากับ `Subtotal By Family Group` / `RVC Menu Item Sales Detail` → `format_error`
  4. **ข้าม**: บรรทัดหัวกระดาษซ้ำทุกหน้า (ข้อความเท่ากับบรรทัด title / `Subtotal By Family Group` / บรรทัด hotel ทั้งบรรทัด / Period), หัวคอลัมน์ `/\bMLVL\b/`, footer, `/^- Other Discount\b/`, `/^Net Sales\b/`, `/^Daily Total\b/`
  5. **Grand Total**: `/^Grand Total\b/` → `reported_total` = โทเคนตัวเลขตัวสุดท้าย
  6. **หัว Outlet**: `/^(\d{1,3})\s*-\s*(.+)$/` และไม่มี `%` → Outlet ปัจจุบัน (รหัสซ้ำ = ต่อ Outlet เดิม) · รหัส > 20 ตัว → `format_error`
  7. **ยอด Outlet**: ขึ้นต้นด้วย `<ชื่อ Outlet ปัจจุบัน> Total ` → `reported_qty` = โทเคนก่อน `%` ตัวแรก, `reported_total` = โทเคนก่อน `%` ตัวสุดท้าย
  8. **Family Group**: `/^Total\s/` → ชื่อ = โทเคนระหว่าง `Total` กับโทเคนก่อน `%` ตัวแรก (`Total Happy Hour 1 Free 1 18 25.71% …` → `Happy Hour 1 Free 1`) → department `DEP-<ชื่อ>` (≤ 100 ตัว ไม่งั้น `format_error`) และตั้งให้ทุก item ของ Outlet นี้ที่สะสมไว้ตั้งแต่ Family Group ก่อนหน้าแล้วยังไม่มี department (หัวหมวดอยู่ **หลัง** รายการ ไม่ใช่ก่อน)
  9. **สินค้า**: `/^\d/` ∧ มี `%` ∧ ไม่มี `/\bTotal\b/` ∧ ไม่มี `/\bSubtotal\b/` · `tokens = text.split(' ')`, `pct` = index ของโทเคนที่ลงท้าย `%` — ต้องมี **5 ตัวพอดี**; `code = tokens[0]` (`/^\d{1,20}$/`); price = `tokens[pct[0]-2]` ต้องเป็นตัวเลข; `qty = num(tokens[pct[0]-1])`; `net = num(tokens[pct[4]-1])`; ชื่อ = `tokens.slice(1, pct[0]-3).join(' ')` (ตัด MLVL `Price`/`Standard` และราคา) ว่าง → ใช้ code; ไม่มี Outlet ปัจจุบัน → `format_error` · `num()` ตัด `,` แล้วต้อง match `/^-?\d+(\.\d+)?$/` ไม่งั้น `format_error` พร้อมเลขบรรทัด
  10. **หักกลบ** ตาม `outlet_code|item_code` (บวก qty, total) → ปัด total 2 / qty 5 → `unit_price = qty !== 0 ? round(total/qty, 5) : 0` (เหมือน `netSales` ของ Simphony) · item master: ชื่อจากบรรทัดแรกที่เจอ, department ตัวแรกที่ได้
  11. ไม่มีบรรทัดสินค้าเลย หรือไม่มี Grand Total → `format_error`
  12. **Footing**: `|Σ total ทุก Outlet − Grand Total| > 0.05` → `format_error` ("footing mismatch: computed X, report Y"); ต่อ Outlet ที่มีบรรทัด Total: ยอดต่าง > 0.05 หรือ qty ไม่เท่า → `format_error` ระบุ Outlet · คืน `footing` ทุกครั้งที่ไปถึงขั้นนี้
- [ ] **Step 2: `splitByOutlet`** ตาม Interfaces (ลำดับตามรหัส Outlet แบบตัวเลข)
- [ ] **Step 3: ลองกับไฟล์จริง** — ใน scratchpad (ไม่ commit): `mkdir pdfx && cd pdfx && echo '{}' > package.json && bun add pdfjs-dist@4.10.38` แล้วเขียน `extract.mjs` ที่ทำอัลกอริทึมเดียวกับ Task 7 Step 2 (ใช้ `pdfjs-dist/legacy/build/pdf.mjs`) พิมพ์ JSON `string[][]` ต่อไฟล์ → รัน parser ด้วย `bunx tsx` (หรือ `ts-node -r tsconfig-paths/register` ใน `apps/micro-business`) กับ `Viewer20–30.pdf` — Expected ทุกไฟล์ `is_ok: true`, ร้าน `The TwinTower - Hotel`, `detected_version: v5.6.100`, 6 Outlet (`1` Gold Teak, `2` Room Service, `3` h.a.f, `4` 88 Bar, `5` Fu Marn Lau, `7` Banquet), footing ต่าง 0.00; Viewer20: doc_date `2026-09-20`, Grand Total 481,377.65, Gold Teak 47 บรรทัด 2,062 ชิ้น 110,321.51, 88 Bar 37 บรรทัด 70 ชิ้น 5,106.20, `10101` qty 8 total 1699.20 unit_price 212.4, `53` (Guest Food) qty 559 total 0 unit_price 0; Viewer22: Fu Marn Lau `105` qty −1 total −84.96 · ลองแก้ JSON ให้ To = 09/21 → `rejected_multi_day`; ลบบรรทัด Grand Total → `format_error`; แก้ net ของ `10101` +1.00 → `format_error` footing
- [ ] **Step 4:** check-types + eslint scoped
- [ ] **Step 5: Commit** — `feat(pos-sale): ตัวอ่านรายงาน Micros 3700 จากบรรทัดข้อความ PDF`

### Task 4: BE — check / import ของ Micros 3700 + เขียนทับต่อ Outlet (micro-business)

**Files:**
- Create: `apps/micro-business/src/inventory/pos-sale/pos-sale-micros3700.service.ts`
- Create: `apps/micro-business/src/inventory/pos-sale/interface/pos-sale-micros3700.interface.ts`
- Modify: `pos-sale.controller.ts`, `pos-sale.module.ts` (เพิ่ม `StockOutModule` ใน imports), `pos-sale-import.service.ts` (`findAllImports` filter `batch_id` + ฟิลด์ใหม่ใน list/detail)

**Interfaces:**
- Consumes: Task 2 ฟังก์ชัน, Task 3 parser, `StockOutService.voidStockOut(id, reason, user_id, tenant_id)`, `assertDateInCurrentPeriod(prisma, date, ERROR_CATALOG.STOCK_OUT_DATE_NOT_CURRENT_PERIOD, ERROR_CATALOG.STOCK_OUT_NO_OPEN_PERIOD)`
- Produces:
  ```ts
  interface IPosMicros3700Input { file_name: string; extract_ms?: number; lines: string[][] }
  interface IPosMicros3700ImportInput extends IPosMicros3700Input {
    overwrite_outlet_codes: string[]; skip_outlet_codes: string[]; can_void_stock_out: boolean }
  interface PosMicros3700Existing { import_id: string; line_count: number; total: number;
    confirmed_line_count: number; stock_out_ids: string[]; created_at: Date | null }
  interface PosMicros3700OutletCheck { code: string; name: string; line_count: number; qty: number;
    total: number; reported_total: number | null; existing: PosMicros3700Existing | null }
  type PosMicros3700CheckResult =
    | { kind: 'rejected'; import: PosSaleImportSummary }
    | { kind: 'ready'; doc_date: string; store_name: string; detected_version: string | null;
        footing: Micros3700Footing; outlets: PosMicros3700OutletCheck[] }
  interface PosMicros3700OutletResult { code: string; name: string;
    action: 'imported' | 'overwritten' | 'skipped' | 'failed'; import_id: string | null;
    voided_stock_out_ids: string[];
    error: { app_code: string | null; message: string; params: Record<string, string | number> } | null }
  type PosMicros3700ImportResult =
    | { kind: 'rejected'; import: PosSaleImportSummary }
    | { kind: 'needs_resolution'; outlets: PosMicros3700OutletCheck[] }
    | { kind: 'imported'; batch_id: string; doc_date: string; outlets: PosMicros3700OutletResult[] }
  // PosMicros3700Service extends TenantScopedService, @TryCatch ทุก public
  checkMicros3700(input: IPosMicros3700Input): Promise<Result<PosMicros3700CheckResult>>
  importMicros3700(input: IPosMicros3700ImportInput): Promise<Result<PosMicros3700ImportResult>>
  ```
- list item + detail ของ import เพิ่ม `batch_id`, `outlet_id`, `replaced_by_id`; `IPosSaleImportListFilter` เพิ่ม `batch_id?: string`
- RPC cmds: `pos-sale.check-micros3700`, `pos-sale.import-micros3700`

- [ ] **Step 1: `prepare()` (private, ใช้ทั้งสองทาง)** — parse; ปฏิเสธ → สร้างแถว import แบบ `recordRejection` ของแผน A (store จาก hotel ถ้าอ่านได้, `batch_id` ใหม่ `randomUUID()`, `processing_ms` = `extract_ms` + เวลาฝั่ง BE) → `kind: 'rejected'`; ผ่าน → `resolveStore` → หา Outlet master ที่มีอยู่ตามรหัส → หา import live ของ `brand micros3700, outlet_id IN (…), doc_date, status success, cancelled_at null` พร้อมจำนวนบรรทัด, ยอด, บรรทัดที่ `stock_out_id` ไม่ว่าง และ `stock_out_ids` แบบ distinct (นับด้วย groupBy ครั้งเดียวต่อคำขอ ไม่ใช่ต่อ Outlet) → ประกอบ `PosMicros3700OutletCheck[]`; `checkMicros3700` คืน `ready` (ไม่เขียนอะไรอีก)
- [ ] **Step 2: `importMicros3700`** — `prepare()` ใหม่ทั้งหมด (ไม่เชื่อผล `check`); Outlet ที่ `existing` ไม่ว่างแต่ไม่อยู่ใน `overwrite_outlet_codes`/`skip_outlet_codes` → คืน `needs_resolution` **โดยไม่เขียนอะไรเลย**; ไม่งั้น `batch_id` ใหม่ แล้ววนทีละ Outlet ตามลำดับรหัส (Outlet หนึ่งล้มไม่หยุด Outlet อื่น — ห่อแต่ละ Outlet ด้วย try/catch ที่แปลง `AppError` เป็น `failed` + `error`; error อื่นโยนต่อ):
  - ข้าม → `skipped`
  - ใหม่ → `$transaction(IMPORT_TX_OPTIONS)`: `upsertOutlets/Departments/Items` เฉพาะของ Outlet นี้ (`splitByOutlet`), สร้าง import (`status success`, `outlet_id`, `batch_id`, source/description ต่อ Outlet, `total_records` = จำนวนบรรทัด, `total_sales_amount`, `processing_ms`, `ingest_method manual`) + `createMany` บรรทัด → `imported`; ชน P2002 ของ `pos_sale_import_live_outlet_u` → `failed` `POS_SALE_OUTLET_ALREADY_IMPORTED {outlet, date}`
- [ ] **Step 3: เขียนทับ** (`overwriteOutlet`, private) ตามลำดับนี้เท่านั้น:
  1. `existing.stock_out_ids` ไม่ว่าง: `can_void_stock_out` false → `failed` `POS_SALE_OVERWRITE_VOID_FORBIDDEN`; `assertDateInCurrentPeriod(this.prismaService, doc_date, …)` โยน → `failed` ด้วย error นั้น (งวดปิด); แล้ว `voidStockOut(id, \`POS Micros 3700 overwrite (batch ${batchId})\`, this.userId, this.bu_code)` ทีละใบ — ใบใดไม่ ok → `failed` ด้วย error ของมัน พร้อม `voided_stock_out_ids` ที่ void ไปแล้ว (บรรทัดของใบที่ void แล้วกลับเป็นรอยืนยันเองจากแผน A Task 10; ชุดเก่ายัง live → กดเขียนทับซ้ำได้) — ใส่คอมเมนต์ไทยอธิบายว่าทำไมไม่ rollback void ได้ (แต่ละใบเป็นทรานแซกชันของ `StockOutService` เอง) และทำไมยังปลอดภัย (ไม่มีวันตัดซ้ำ)
  2. `$transaction`: `updateMany({ where: { id: existing.import_id, cancelled_at: null, status: success } , data: { updated_at, updated_by_id } })` count 0 → throw `POS_SALE_OVERWRITE_CONFLICT`; นับบรรทัด `stock_out_id` ไม่ว่าง (statement แยกหลังล็อก — เหตุผลเดียวกับคอมเมนต์ใน `cancelImport`) > 0 → throw `POS_SALE_OVERWRITE_CONFLICT` (มีคนยืนยันแทรกหลัง void); `newId = randomUUID()`; ตั้ง `cancelled_at/by_id`, `replaced_by_id = newId` ให้แถวเดิม; แล้วเขียนชุดใหม่แบบ Step 2 ด้วย `id: newId` → `overwritten`
- [ ] **Step 4:** `findAllImports` รับ `batch_id` (filter ตรงตัว) และ list/detail คืน `batch_id`, `outlet_id`, `replaced_by_id` (เติม interface + `toImportSummary` ไม่ต้องแก้)
- [ ] **Step 5:** handler ใน `pos-sale.controller.ts` (log แค่ `file_name` + `lines?.length`; check ตอบ `HttpStatus.OK`, import ตอบ `HttpStatus.CREATED`) → `bun run gen:rpc-contract` → แทน literal ด้วย `PosSale.checkMicros3700.pattern` / `PosSale.importMicros3700.pattern` → revert drift ที่ไม่เกี่ยว → `bun run audit:tcp-drift`
- [ ] **Step 6:** check-types + eslint scoped + `cd apps/micro-business && bunx jest src/inventory/stock-out` (ยังผ่าน)
- [ ] **Step 7: Commit** — `feat(pos-sale): ตรวจและนำเข้ารายงาน Micros 3700 พร้อมเขียนทับต่อ Outlet`

### Task 5: BE — gateway endpoints + สิทธิ์ void + registry

**Files:**
- Modify: `apps/backend-gateway/src/application/pos-sales/{pos-sales.controller.ts, pos-sales.service.ts, pos-sales.module.ts, swagger/request.ts, swagger/response.ts}`
- Modify: `apps/backend-gateway/src/common/dto/pos-sale/pos-sale.dto.ts` (+ export ผ่าน `@/common`)
- Regenerate: app-api catalog, `seed.application-api.data.ts`, (license catalog ไม่เปลี่ยน — `app:pos-sales` = `interface` อยู่แล้ว)

**Interfaces — Produces:**
| method path | api_name | body | ตอบ |
|---|---|---|---|
| `POST imports/micros3700/check` | `posSale.checkMicros3700` | `PosSaleMicros3700CheckDto` | 200 `PosMicros3700CheckResult` |
| `POST imports/micros3700` | `posSale.importMicros3700` | `PosSaleMicros3700ImportDto` | 201 `PosMicros3700ImportResult` |
| `GET imports` (เดิม) | — | query เพิ่ม `batch_id` (uuid, optional) | |
- Zod: `PosSaleMicros3700CheckDto = { file_name: z.string().trim().min(1).max(255), extract_ms: z.number().int().min(0).max(600000).optional(), lines: z.array(z.array(z.string().max(500)).max(50)).max(20000) }` · `PosSaleMicros3700ImportDto` = check + `overwrite_outlet_codes: z.array(z.string().min(1).max(20)).max(200).default([])`, `skip_outlet_codes` แบบเดียวกัน, `.refine` ห้ามรหัสเดียวอยู่ทั้งสองชุด (ใช้ `.default([])` ได้ที่นี่ — กฎห้าม `.default()` เป็นของ schema app-config)

- [ ] **Step 1:** service สองเมธอด — ทั้งคู่เรียก `assertBrandEntitled(bu_code, enum_pos_brand.micros3700)` ก่อน; ตรวจ status ตอบกลับ (`OK` / `CREATED`) แบบ `importSimphony`
- [ ] **Step 2:** `canVoidStockOut(req, bu_code): boolean` (private ใน controller) — อ่าน `x-bu-datas` แบบ `store-requisitions.controller.ts:205` หา entry ของ `bu_code`; `role === enum_user_business_unit_role.admin` → true; ไม่งั้น `permissionService.hasAllPermissions(entry.permissions, { 'inventory_management.stock_out': ['delete'] })` (inject `PermissionService` ที่ module มีอยู่แล้วผ่าน `PermissionGuard` — ดูคอมเมนต์ใน `ap-invoice.module.ts:9`) — header พัง/ไม่มี entry → false · ส่งเป็น `can_void_stock_out` ใน `data` ของ RPC (FE ส่งค่านี้เองไม่ได้ — DTO ไม่มีฟิลด์นี้)
- [ ] **Step 3:** controller สอง route (`@HttpCode`, `@ApiOperation` operationId `posSales_checkMicros3700` / `posSales_importMicros3700` คำอธิบายสองภาษาบอกว่า PDF ไม่ขึ้นเซิร์ฟเวอร์, ไฟล์ที่ถูกปฏิเสธบันทึกตอน check, `needs_resolution` ไม่เขียนอะไร) + Swagger response DTO ตาม Task 4; query `batch_id` ใน `PosSaleImportListQueryDto`; list/detail DTO เพิ่ม `batch_id` `outlet_id` `replaced_by_id`
- [ ] **Step 4:** `bun run scripts/generate-app-api-catalog/run.ts && bun run audit:app-api-catalog-drift`; เติม 2 api_name ลง `seed.application-api.data.ts` → `check.application-api-drift.ts`; `check.endpoint-permission-coverage.ts` ทำตามที่มันบอกแบบที่แผน A Task 5 ทำ
- [ ] **Step 5:** check-types ทั้งสองแอป + eslint scoped + `bunx jest apps/backend-gateway/src/application/pos-sales` (ถ้ามี spec เดิม)
- [ ] **Step 6: Commit** — `feat(pos-sale): endpoint ตรวจและนำเข้ารายงาน Micros 3700 ฝั่ง gateway`

### Task 6: BE — ตรวจครบวงจรด้วย curl (ต้องได้อนุญาตจาก user ก่อนลง migration)

**Files:** ไม่มีโค้ดใหม่ (แก้ใน task เจ้าของเมื่อเจอ)

- [ ] **Step 1:** ถาม user ว่าลง migration ที่ BU ทดสอบตัวไหน (ผ่าน `POST /api-system/tenant/migrations/:bu_id/deploy`, `SELECT current_database(), current_schema()` ก่อน) + seed `pos-sale-adjustment-type` → `bun run boot-check backend-gateway micro-business`
- [ ] **Step 2: ยิงจริง** ด้วย JSON บรรทัดจาก Task 3 Step 3 (`curl -H "Content-Type: application/json" --data @viewer20.json …`):
  1. `check` Viewer20 → `ready`, 6 outlets `existing: null`, footing 481377.65/481377.65
  2. `import` Viewer20 → `imported` 6 Outlet; `GET imports?batch_id=<id>` ได้ 6 แถว source `Micros 3700 PDF - The TwinTower - Hotel - 4` ฯลฯ; แถว `4` total_records 37, total_sales_amount 5106.20 (Review Focus #5)
  3. `check` ไฟล์ที่ To = 09/21 → `rejected` `rejected_multi_day` และมีแถวในประวัติ; ไฟล์ที่ไม่มี Grand Total → `format_error`; `lines: []` → `format_error`
  4. `import` Viewer20 อีกครั้งโดยไม่ส่ง resolution → `needs_resolution` และ `GET imports` ไม่มีแถวเพิ่ม
  5. ยิง `import` Viewer21 สองคำสั่งพร้อมกัน (`&`) → หนึ่ง `imported` อีกหนึ่ง `needs_resolution` หรือ Outlet `failed POS_SALE_OUTLET_ALREADY_IMPORTED` — ไม่มี Outlet ใดมีสองชุด live (Review Focus #2)
  6. ผูก Outlet `1` + เมนูสองสามตัว → confirm Outlet `1` ของ Viewer20 → `import` Viewer20 ด้วย `overwrite_outlet_codes: ["1"]`, `skip_outlet_codes` = ที่เหลือ → `overwritten` + `voided_stock_out_ids` 1 ใบ; ใบเดิม `voided`; import เดิม `cancelled_at` + `replaced_by_id`; import ใหม่รอยืนยัน; Outlet อื่น `skipped` ไม่ถูกแตะ
  7. ผู้ใช้ที่ไม่มี `stock_out.delete` เขียนทับ Outlet ที่ยืนยันแล้ว → `failed POS_SALE_OVERWRITE_VOID_FORBIDDEN`; ปิดงวดของ doc_date (หรือใช้ BU ที่งวดปัจจุบันไม่ครอบ 2026-09-20) → `failed STOCK_OUT_DATE_NOT_CURRENT_PERIOD` และ Stock Out เดิมยังอยู่ (Review Focus #1)
  8. ยืนยัน Outlet ของ import ที่ถูกเขียนทับไปแล้ว → `POS_SALE_IMPORT_CANCELLED`
- [ ] **Step 3:** รายงานผลรายข้อ (ผ่าน/ไม่ผ่าน + response จริง) ให้ user

### Task 7: FE — pdf.js ใน bundle + ตัวดึงบรรทัดข้อความ

**Files:**
- Modify: `package.json`, `bun.lock` (`bun add pdfjs-dist@4.10.38` — pin ตรงตัว ไม่ใส่ `^`)
- Create: `routes/system-admin/interface/pos/micros3700-pdf.ts`

**Interfaces — Produces:**
- `extractMicros3700Lines(file: File): Promise<{ lines: string[][]; page_count: number; extract_ms: number }>` — โยน `Micros3700PdfError` (`kind: "password" | "unreadable"`) เมื่อ pdf.js เปิดไม่ได้
- `class Micros3700PdfError extends Error { kind }` (ไฟล์เดียวกันได้ — เป็น type ของฟังก์ชันนี้)

- [ ] **Step 1:** โหลดแบบ lazy ภายในฟังก์ชัน: `const pdfjs = await import("pdfjs-dist")` + `const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url")` → `pdfjs.GlobalWorkerOptions.workerSrc = workerUrl` (worker ถูก emit เป็น asset ของเรา = `worker-src 'self'` ผ่าน) · `getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false })` · `PasswordException` → `kind: "password"`, error อื่นตอนเปิด → `"unreadable"` · `page.cleanup()` ทุกหน้าและ `pdf.destroy()` ใน finally (FRD: ล้างของในหน่วยความจำ)
- [ ] **Step 2: จัดบรรทัด** (อัลกอริทึมที่ signature ไม่บอก — ทำตามนี้):
  ```ts
  // ต่อหน้า: เก็บเฉพาะ item ที่มี "str" และ str.trim() ไม่ว่าง
  // หา line ที่ |line.y - item.transform[5]| <= 4 (y ของ line = y ของ item แรก) ไม่เจอ = line ใหม่
  // เรียง line ตาม y มาก→น้อย, ใน line เรียง x = transform[4] น้อย→มาก
  // ช่วง (segment): ต่อ item เข้าช่วงเดิมเมื่อ x - (prev.x + prev.width) <= 20 ไม่งั้นเปิดช่วงใหม่
  // ข้อความช่วง = str ที่ trim แล้ว join(" ") ยุบช่องว่าง; line = string[] ของช่วง
  ```
  `extract_ms` = `performance.now()` ครอบทั้งฟังก์ชัน
- [ ] **Step 3:** `bun run build` แล้วดู `dist/assets/` — Expected: มี `pdf.worker.min-*.mjs` แยกไฟล์ และ chunk หลัก (`index-*.js`) ไม่มี pdf.js (ค้น `GlobalWorkerOptions` ใน chunk ที่โหลดตอน boot ต้องไม่เจอ) · ถ้า build พังเรื่อง top-level await ให้หยุดรายงาน (ห้ามเปลี่ยน `build.target` เอง) · `bun test:run lib/__tests__/security-headers.test.ts` ผ่าน (ไม่แตะ header)
- [ ] **Step 4:** typecheck + eslint → commit `feat(pos): อ่านข้อความ PDF Micros 3700 ในเบราว์เซอร์ด้วย pdf.js`

### Task 8: FE — ชั้น API ของ Micros 3700

**Files:**
- Modify: `routes/system-admin/interface/pos/pos-sale-types.ts`, `use-pos-sale.ts`, `constant/api-endpoints.ts`, `messages/{en,th}.json` (`errors.byCode`)

**Interfaces — Produces:**
- types ตรงกับ Task 4: `PosMicros3700Footing`, `PosMicros3700Existing`, `PosMicros3700OutletCheck`, `PosMicros3700CheckResult`, `PosMicros3700OutletAction`, `PosMicros3700OutletResult`, `PosMicros3700ImportResult`; `PosImportListItem` และ `PosImportDetail` เพิ่ม `batch_id: string | null`, `outlet_id: string | null`, `replaced_by_id: string | null`
- endpoints `POS_SALE_IMPORT_MICROS3700_CHECK(bu)` → `/api/proxy/api/${bu}/pos-sales/imports/micros3700/check`, `POS_SALE_IMPORT_MICROS3700(bu)`
- hooks: `useCheckMicros3700()` (`{ file_name, lines, extract_ms }` → `PosMicros3700CheckResult`; invalidate `POS_SALE_IMPORTS`) · `useImportMicros3700()` (+ `overwrite_outlet_codes`, `skip_outlet_codes` → `PosMicros3700ImportResult`; invalidate `POS_SALE_IMPORTS`, `POS_SALE_IMPORT`, `POS_SALE_PREVIEW`, `POS_SALE_STORES`, `POS_SALE_OUTLETS`, `POS_SALE_ITEMS`) · `usePosBatchImports(batchId: string | null | undefined)` → `PosImportListItem[]` (`GET imports?batch_id&perpage=50&brand=micros3700`, ปิดเมื่อไม่มี batchId) — ทั้งหมดผ่าน `usePosMutation` / รูปแบบ query เดิมในไฟล์
- `outletErrorMessage(error: PosMicros3700OutletResult["error"], t: TranslationFn): string` — `t.has("byCode." + app_code)` → แปลพร้อม `params`, ไม่งั้น `message`
- `errors.byCode`: `POS_SALE_OVERWRITE_VOID_FORBIDDEN`, `POS_SALE_OVERWRITE_CONFLICT`, `POS_SALE_OUTLET_ALREADY_IMPORTED`, `STOCK_OUT_DATE_NOT_CURRENT_PERIOD` (`{period}` `{start}` `{end}`), `STOCK_OUT_NO_OPEN_PERIOD`, `STOCK_OUT_ALREADY_VOIDED` — แปลจาก message ใน `packages/error-catalog/src/catalog.ts` ของ BE ใช้ param ชื่อเดิม

- [ ] **Step 1:** types + endpoints + hooks + `outletErrorMessage`
- [ ] **Step 2:** typecheck + eslint + `bun test:run i18n-key-parity` → commit `feat(pos): ชั้น API ตรวจและนำเข้ารายงาน Micros 3700`

### Task 9: FE — ปุ่มอัปโหลด PDF + dialog สรุป/เขียนทับ/ผล

**Files:**
- Create: `routes/system-admin/interface/pos/pos-micros3700-upload-button.tsx`
- Create: `routes/system-admin/interface/pos/pos-micros3700-import-dialog.tsx`
- Modify: `pos-import-history.tsx` (แสดงปุ่มเมื่อ `brand === "micros3700" && canWrite`), `messages/{en,th}.json` → namespace `systemAdmin.interface.posSale.micros3700Upload`

**Interfaces:**
- Consumes: Task 7 `extractMicros3700Lines`, Task 8 hooks/types, `useCan().can(PERMISSIONS.inventory_management.stock_out.delete)`, `importStatusLabel` (`pos-import-status.ts`), `useAmountFormatter`
- Produces: `PosMicros3700UploadButton()`; `PosMicros3700ImportDialog({ open, onOpenChange, payload, check }: { open: boolean; onOpenChange: (v: boolean) => void; payload: { file_name: string; lines: string[][]; extract_ms: number; page_count: number }; check: Extract<PosMicros3700CheckResult, { kind: "ready" }> })`

- [ ] **Step 1: ปุ่ม** (แบบ `pos-simphony-upload-button.tsx`): `accept="application/pdf,.pdf"`, > 20 MB ตัดที่ FE, reset input ทุกครั้ง; สถานะปุ่ม "กำลังอ่าน PDF…" → "กำลังตรวจ…"; `Micros3700PdfError` → `toast.error` ข้อความต่อ `kind` (มีรหัสผ่าน / ไฟล์เสียหรือไม่ใช่ PDF); `check` → `rejected`: `toast.error(importStatusLabel(tStatus, import.status), { description: import.error_message ?? file.name })`; `ready` → เปิด dialog โดยถือ `payload` ไว้ใน state ของปุ่ม — ล้างทิ้งเมื่อ dialog ปิด
- [ ] **Step 2: dialog — มุมมองสรุป**: หัว = วันขาย · ร้าน · ไฟล์ · จำนวนหน้า · `detected_version`; แถบ footing "ยอดรวมตรงกับรายงาน (ต่าง X)" `text-success-ink`; ตาราง Outlet: รหัส·ชื่อ, รายการ, ชิ้น, ยอด, ยอดในรายงาน, สถานะ — `existing === null` → "ใหม่"; ไม่ null → "มีอยู่แล้ว" + ยอดเดิม + "ยืนยันแล้ว x/y บรรทัด" และ ToggleGroup/RadioGroup "ข้าม | เขียนทับ" (ค่าเริ่ม ข้าม); เลือกเขียนทับเมื่อ `stock_out_ids.length > 0` → บรรทัดเตือน `text-warning-ink` "จะยกเลิก Stock Out เดิม n ใบ แล้วรอยืนยันใหม่" และ disable ตัวเลือกเขียนทับพร้อม tooltip เมื่อไม่มีสิทธิ์ `stock_out.delete`; ปุ่มท้าย: "ยกเลิก" (`outline`) + "นำเข้า" (ปุ่มหลักของ dialog แบบ `pos-confirm-dialog.tsx`) ปิดระหว่าง pending
- [ ] **Step 3: กดนำเข้า** → `useImportMicros3700` ด้วยรหัสที่เลือก: `needs_resolution` → แทนตาราง Outlet ด้วยชุดใหม่ + `toast.warning` "มีข้อมูลเดิมเพิ่มระหว่างนี้ เลือกใหม่อีกครั้ง"; `rejected` → `toast.error` แล้วปิด; `imported` → **มุมมองผล**: ต่อ Outlet ป้าย action (`imported`/`overwritten` = success, `skipped` = muted, `failed` = destructive) + `outletErrorMessage` + ลิงก์ "ตรวจและยืนยัน" ไป `interface/pos/micros3700/imports/<import_id>` เมื่อมี `import_id` + จำนวน Stock Out ที่ถูก void; ปุ่ม "ปิด" อย่างเดียว · error HTTP (403 license ฯลฯ) → `getUserErrorMessage`
- [ ] **Step 4:** typecheck + eslint → commit `feat(pos): อัปโหลด PDF Micros 3700 พร้อมสรุปต่อ Outlet และเลือกเขียนทับ`

### Task 10: FE — ประวัติ/หน้าตรวจรู้จักชุดที่ถูกเขียนทับ + Outlet จากไฟล์เดียวกัน

**Files:**
- Modify: `routes/system-admin/interface/pos/pos-import-status.ts`, `pos-import-history.tsx`, `pos-import-review.tsx`, `pos-micros3700-form.tsx`, `messages/{en,th}.json`

**Interfaces — Produces:**
- `ConfirmationState` เพิ่ม `"replaced"`; `confirmationState(row)` รับ `replaced_by_id` ด้วย — `cancelled_at !== null && replaced_by_id !== null` → `replaced` (ตรวจก่อน `cancelled`)

- [ ] **Step 1:** ประวัติ: คอลัมน์การยืนยันแสดง "ถูกเขียนทับ" (muted) สำหรับ `replaced`; ปุ่มยกเลิกยังตามกติกาเดิม (`pending` เท่านั้น)
- [ ] **Step 2:** หน้าตรวจ: `detail.replaced_by_id` → แถบแจ้ง "ชุดนี้ถูกเขียนทับแล้ว" + ลิงก์ไป import ใหม่ (แทนแถบ "ถูกยกเลิก" เดิม); `detail.brand === "micros3700" && detail.batch_id` → แถว chip "Outlet อื่นจากไฟล์เดียวกัน" จาก `usePosBatchImports(batch_id)` (ตัด id ตัวเอง, chip = รหัส Outlet ท้าย source + สถานะการยืนยัน, คลิกไปหน้าตรวจของแถวนั้น; ไม่แสดงแถวที่ status ≠ success)
- [ ] **Step 3:** ฟอร์ม Micros 3700: ลบข้อความ "การอัปโหลด PDF จะมาในรุ่นถัดไป" ใน `generalDesc` (ทั้งสองภาษา) → บอกว่าอัปโหลด PDF ได้ที่แท็บประวัติ และไฟล์ไม่ถูกส่งขึ้นเซิร์ฟเวอร์
- [ ] **Step 4:** typecheck + eslint + `bun test:run routes/system-admin/interface` (test เดิมของ `pos-import-status` ถ้ามี ต้องผ่าน — แก้ fixture ให้มี `replaced_by_id: null` ได้ ไม่เขียน test ใหม่) → commit `feat(pos): แสดงชุดที่ถูกเขียนทับและ Outlet อื่นจากไฟล์ PDF เดียวกัน`

### Task 11: ตรวจรวม + เช็กลิสต์ตรวจมือ

**Files:** ไม่มีโค้ดใหม่ (แก้เฉพาะที่ตรวจเจอ)

- [ ] **Step 1:** FE `bun run typecheck && bun run lint && bun test:run` ผ่านทั้งชุด · BE `bun run check-types` ผ่าน
- [ ] **Step 2:** `rg -n "lines" apps/micro-business/src/inventory/pos-sale apps/backend-gateway/src/application/pos-sales | rg -i "logger|log\("` ใน BE — Expected: ไม่มีการ log เนื้อ `lines`
- [ ] **Step 3:** เขียนเช็กลิสต์ลง scratchpad (`pos-sale/plan-c-browser-checklist.md`) ครอบ Review Focus 1–5 + spec §6 ฝั่ง Micros: ไฟล์ `Viewer20–30.pdf` ทั้ง 11 ไฟล์นำเข้าได้ ยอดตรง และได้ร้านเดียว `The TwinTower - Hotel` (#3); แท็บ Network ไม่มีคำขอที่ส่งไฟล์ PDF/multipart (TC-MIC-008); เวลา `extract_ms` ของ Viewer20 (10 หน้า) ใน DevTools ≤ 500 ms บนเครื่องปกติ (TC-MIC-007 — บันทึกค่าจริง ไม่ผ่านให้รายงาน ไม่ใช่ปรับเกณฑ์); PDF ที่มีรหัสผ่าน / ไฟล์ .pdf ที่จริงเป็นรูป / PDF รายงานอื่น (#4); dark mode ของ dialog; Console ไม่มี CSP violation ตอนโหลด worker (`bun run build && bun run preview` กับ header ของ `vercel.json`) — **ไม่รันกับ dev DB เอง** ก่อน user อนุญาต
- [ ] **Step 4:** commit ถ้ามีแก้

---

## ลำดับ deploy (เพิ่มจากแผน A/B)

1. tenant migration `20261022130000_pos_sale` (ฉบับที่แก้ในแผนนี้) ต่อ BU — ยังเป็น migration ตัวแรกของ POS จึงลงพร้อมแผน A ได้เลย
2. deploy BE 3 แอปพร้อมกัน + error catalog + platform seed application-api (เพิ่ม `posSale.checkMicros3700`, `posSale.importMicros3700` — แอปที่ไม่ใช่ `allow_all` ต้องเติมเอง)
3. license `interface.pos.micros3700` assign ให้ BU ที่ใช้ (มีจากแผน A Task 11 แล้ว)
4. deploy FE — FE ก่อน BE = ปุ่มอัปโหลดยิง 404

หมายเหตุให้ user (นอกขอบเขตแผนนี้): `voidStockOut` ไม่ตรวจงวด และ `stock-outs.controller.ts` ไม่มี `PermissionGuard` — void Stock Out จากหน้าปกติย้อนเข้างวดปิดได้และไม่ตรวจสิทธิ์ที่ gateway
