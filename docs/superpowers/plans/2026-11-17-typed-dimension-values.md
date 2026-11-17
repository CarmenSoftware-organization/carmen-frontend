# Dimension ชนิด Text/Number/Date/Boolean บนบรรทัดเอกสาร — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนชื่อ `gl_dimension*` เป็น `dimension*` ทั้งระบบ แล้วให้ dimension ทุกชนิดกรอกและเก็บค่าได้บนบรรทัดของ 10 เอกสาร (12 ตาราง `*_dimension`) และค่าส่งต่อเข้า JV ตอนลงบัญชี

**Architecture:** เพิ่มคอลัมน์ตามชนิด + check constraint ในทุกตาราง `*_dimension` แล้วรวมการแปลง/ตรวจค่าตามชนิดไว้ในโมดูลเดียว
(`master/dimension/line-dimension/typed-value.ts`) ที่ตัวตรวจทั้งสองชุด (`gl-dimension.validator.ts` สำหรับ JV/AP/AR และ
`line-dimension/validate-line-dimension-values.ts` สำหรับเอกสารซื้อ/คลัง) และ writer ทุกตัวเรียกใช้ ฝั่ง FE ใช้คอมโพเนนต์กลาง
`DimensionValueInput` ทุกจุด

**Tech Stack:** Prisma + PostgreSQL (tenant schema), NestJS micro-business + gateway, React 19 FE

**Spec:** `carmen-frontend/docs/superpowers/specs/2026-11-17-typed-dimension-values-design.md`

## Global Constraints

- ข้ามขั้นเขียนเทสต์ใหม่ (CLAUDE.md ของ user) — รัน typecheck + lint + เทสต์เดิมต้องผ่าน (spec เดิมที่ตรึงพฤติกรรมเก่าให้ปรับตามพฤติกรรมใหม่)
- BE branch `feature/typed-dimension-values` แตกจาก `main` ของ carmen-turborepo-backend · FE ใช้ branch ชื่อเดียวกัน (มีแล้ว)
- คอลัมน์: `value_text varchar(20)`, `value_number decimal(20,5)`, `value_date date`, `value_boolean boolean` · `dimension_value_id` nullable
- check: มีค่าใน `dimension_value_id`/`value_text`/`value_number`/`value_date`/`value_boolean` พอดี 1 ช่อง (`NOT VALID` แล้ว `VALIDATE`)
- `value_code` ของชนิดใหม่: text ตามที่กรอก (trim) · number รูปแบบกลางไม่มีตัวคั่นหลักพัน ตัดศูนย์ท้าย · date `YYYY-MM-DD` · boolean `true`/`false`
- request ต่อ ref: `{ dimension_id, dimension_value_id?: uuid|null, value?: string|number|boolean|null }` · client เดิมที่ส่งแค่ value_id ต้องทำงานเหมือนเดิม
- error catalog ใหม่: `GL_DIMENSION_VALUE_TYPE_MISMATCH` (422, param `dimension_code`), `GL_DIMENSION_TYPE_IN_USE` (422, param `dimension_code`)
- หลัง Task 0 ใช้ชื่อใหม่ทุกที่: `tb_dimension`, `tb_dimension_value`, `dimension_id`, `dimension_value_id` (ทุกชื่อในแผนนี้เขียนตามชื่อใหม่แล้ว)
- ห้ามกด Save บน dev DB ร่วม · commit message ภาษาไทย · ไม่ merge / deploy เอง

## Review Focus

- แถวเดิม (ค่าแบบรายการ) ต้องอ่าน/แสดง/แก้ได้เหมือนเดิมทุกเอกสารหลัง migration
- key รวมบรรทัด (`build-dimension-signature.ts`) — สองบรรทัดที่ค่าพิมพ์ต่างกันต้องไม่ถูกรวม
- ผู้อ่านที่ include/join `tb_dimension_value` ผ่าน `*_dimension` ต้องไม่ทิ้งแถวชนิดใหม่ หรือ throw เมื่อ value_id เป็น null
- dimension ที่ชนิดเปลี่ยนไปแล้ว (Channel บน dev): ส่ง value_id เดิมของบรรทัดกลับมาต้องผ่าน ส่งค่ารายการใหม่ต้องได้ `GL_DIMENSION_VALUE_TYPE_MISMATCH`
- AP/AR/procurement posting → JV: ค่าชนิดใหม่ต้องไปถึง `tb_gl_jv_detail_dimension` ครบ

---

### Task 0: เปลี่ยนชื่อ `gl_dimension` → `dimension` (DB + Prisma + โค้ด + API)

user สั่ง: ทั้งระบบใช้ชื่อเดียวกัน · BE กับ FE ต้อง deploy พร้อมกัน (key ใน JSON เปลี่ยน)

**Files (BE):** migration ใหม่ `..._rename_gl_dimension` (ก่อน migration ของ Task 1) · `schema.prisma` · ทุกไฟล์ใน `apps/` ที่ grep `gl_dimension` เจอ (~98 ไฟล์ ไม่นับ node_modules/dist/generated) **Files (FE):** ~38 ไฟล์ที่ grep `gl_dimension` เจอใน `routes components hooks lib types`

- [ ] Step 1: migration.sql: `ALTER TABLE tb_gl_dimension RENAME TO tb_dimension` · `tb_gl_dimension_value` → `tb_dimension_value` · ทุกคอลัมน์ `gl_dimension_id` → `dimension_id` และ `gl_dimension_value_id` → `dimension_value_id` ในทุกตารางที่มี (ใช้รายการจาก schema.prisma) · ชื่อ index/constraint/FK ที่ map ไว้ (`map: "..."`) ไม่ต้องเปลี่ยน
- [ ] Step 2: schema.prisma: เปลี่ยนชื่อ model, field และ relation field (`tb_gl_dimension` → `tb_dimension`, `tb_gl_dimension_value` → `tb_dimension_value`) ให้ตรงกับ DB โดยไม่ใช้ `@map` · **ไม่เปลี่ยน** `tb_gl_account_dimension_rule*`, `tb_gl_jv_detail_dimension`, รหัส error `GL_DIMENSION_*`, path ของ API, ชื่อไฟล์/โฟลเดอร์ `gl-dimension`
- [ ] Step 3: generate Prisma แล้วแก้โค้ด BE ทั้งหมดตาม `check-types` (prisma delegate `tb_gl_dimension*`, field, zod schema, DTO, swagger, serializer, ข้อความใน error params) · grep `gl_dimension` ซ้ำต้องเหลือเฉพาะใน migration เก่า, ชื่อ catalog `GL_DIMENSION_*` และ comment ที่อธิบายประวัติ
- [ ] Step 4: FE: แทน key `gl_dimension_id`/`gl_dimension_value_id` ใน type, payload builder, response mapping และ mock ทั้งหมด · `typecheck` + `test:run`
- [ ] Step 5: BE `check-types` (micro-business + gateway) + eslint โฟลเดอร์ที่แตะ + jest micro-business ทั้งชุด ผ่าน · commit แยกต่อรีโป `refactor(dimension): เปลี่ยนชื่อ gl_dimension เป็น dimension ทั้ง DB/Prisma/API`
- [ ] ลำดับ deploy ของทั้งงาน: migration ทุก BU → micro-business + gateway → FE **ในหน้าต่างเวลาเดียวกัน** (ช่วงที่ BE ใหม่ขึ้นแล้ว FE ยังเก่า การบันทึก/แสดง dimension จะพัง)

### Task 1: Migration 12 ตาราง

**Files (BE):** Create `packages/prisma-shared-schema-tenant/prisma/migrations/2026111716xxxx_dimension_typed_values/migration.sql` · Modify `schema.prisma` (12 model)
ตาราง: `tb_purchase_request_detail_dimension`, `tb_purchase_order_detail_dimension`, `tb_good_received_note_detail_dimension`,
`tb_store_requisition_detail_dimension`, `tb_stock_in_detail_dimension`, `tb_stock_out_detail_dimension`, `tb_ap_invoice_detail_dimension`,
`tb_ar_invoice_detail_dimension`, `tb_gl_jv_detail_dimension`, `tb_payment_type_dimension`, `tb_wht_form_dimension`
(+ ตารางที่ 12 ที่ grep `dimension_value_id String @db.Uuid` เจอนอกเหนือจาก `tb_gl_account_dimension_rule*` — ยืนยันรายชื่อก่อนเขียน)

- [ ] Step 1: schema.prisma: `dimension_value_id String? @db.Uuid`, relation เป็น optional, เพิ่ม 4 คอลัมน์
- [ ] Step 2: migration.sql เขียนมือ: `ALTER COLUMN ... DROP NOT NULL`, `ADD COLUMN` ×4, `ADD CONSTRAINT <table>_one_value_chk CHECK (num_nonnulls(dimension_value_id, value_text, value_number, value_date, value_boolean) = 1) NOT VALID`, `VALIDATE CONSTRAINT`
- [ ] Step 3: `bun run --filter @repo/prisma-shared-schema-tenant generate` (หรือคำสั่ง generate ของ package) แล้ว `check-types` ของ micro-business ต้องมี error เฉพาะจุดที่ value_id กลายเป็น nullable (เก็บรายการไว้เป็น checklist ของ Task 2–4)
- [ ] Step 4: commit `feat(dimension): migration คอลัมน์ค่าตามชนิดใน *_dimension 12 ตาราง`

### Task 2: แกนกลาง — แปลง/ตรวจค่าตามชนิด

**Files (BE):**
- Create `apps/micro-business/src/master/dimension/line-dimension/typed-value.ts`
- Modify `master/dimension/interface/dimension.interface.ts` (`IDimensionRef`, `IResolvedDimensionValue`)
- Modify `gl/gl-dimension/gl-dimension.validator.ts`, `master/dimension/line-dimension/validate-line-dimension-values.ts`, `line-dimensions.schema.ts`
- Modify `master/dimension/line-dimension/build-dimension-signature.ts`, `replace-line-dimensions.ts`, `attach-line-dimensions.ts`, `resolved-from-stored-rows.ts`, `to-line-dimension-response.ts`, `line-dimension-response.schema.ts`
- Modify `packages/error-catalog/src/catalog.ts` (+ spec ของ catalog ถ้านับจำนวน)

**Interfaces (Produces):**
```ts
type DimensionDataType = 'lookup' | 'string' | 'number' | 'date' | 'boolean';
interface IDimensionRef { dimension_id: string; dimension_value_id?: string | null; value?: string | number | boolean | null }
interface ITypedDimensionColumns { dimension_value_id: string | null; value_text: string | null; value_number: Prisma.Decimal | null; value_date: Date | null; value_boolean: boolean | null }
interface IResolvedDimensionValue { dimension_id: string; dimension_code: string; value_code: string; columns: ITypedDimensionColumns }
function normalizeTypedValue(dataType: Exclude<DimensionDataType,'lookup'>, raw: unknown): Result<{ columns: ITypedDimensionColumns; value_code: string }>
function dimensionRowKey(ref: IDimensionRef): string // 'v:<value_id>' หรือ 't:<value_code ที่ normalize แล้ว>'
```
- [ ] Step 1: `typed-value.ts` — `normalizeTypedValue` ตามกฎใน spec §3 (string trim 1–20, number finite ≤15 หลักหน้า/≤5 หลังจุด, date `YYYY-MM-DD` วันจริง, boolean จริงเท่านั้น) ผิด = `Result` error `GL_DIMENSION_VALUE_TYPE_MISMATCH`
- [ ] Step 2: ตัวตรวจทั้งสองชุด: โหลด `info.data_type` ของ dimension ที่ส่งมา (ไม่มี = lookup) แยกเส้น lookup (ตรวจเดิม) กับชนิดอื่น (`normalizeTypedValue`) · lookup dimension แต่ส่ง `value` หรือ typed dimension แต่ส่ง value_id ใหม่ = MISMATCH · ข้อยกเว้น: typed dimension ที่ส่ง value_id ซึ่งเป็นค่าเดิมของบรรทัดนั้น (รับ `existingValueIdsByLine?: Map<lineKey, Set<valueId>>` เป็นพารามิเตอร์เสริม) ให้ผ่านแบบ lookup เดิม · key ของผลลัพธ์ resolved เปลี่ยนเป็น `dimensionRowKey`
- [ ] Step 3: zod `line-dimensions.schema.ts` รับ `value` และ value_id optional (ต้องมีอย่างใดอย่างหนึ่ง)
- [ ] Step 4: signature/replace/attach/resolved-from-stored-rows/to-response ใช้ `columns` + `dimensionRowKey` · response คืน 4 คอลัมน์ + `data_type`
- [ ] Step 5: catalog 2 รหัส (EN/TH) · `check-types` + eslint ของ micro-business (error ที่เหลือควรอยู่แค่ใน writer เฉพาะเอกสาร = Task 3)
- [ ] Step 6: commit `feat(dimension): แกนกลางแปลงและตรวจค่า dimension ตามชนิด`

### Task 3: Writer + posting ทุกเอกสาร + gateway

**Files (BE):** writer/service/serializer/dto ของ PR, PO, GRN, SR, stock-in, stock-out (`procurement/*`, `inventory/*`), AP (`ap-invoice.writer.ts`, `.posting.ts`, serializer), AR (เหมือน AP), JV (`gl-jv.service.ts` `writeLineDimensions`, serializer), `gl/gl-posting/gl-posting.service.ts`, payment-type, wht-form (service/reader/dto/interface) · gateway: `common/dto/dimension/line-dimensions.dto.ts`, `line-dimension-response.schema.ts`, `line-dimension.swagger.ts` และ swagger request/response ของ ap-invoice, ar-invoice, gl-jv, good-received-notes, payment-types, wht-forms

- [ ] Step 1: ทุก writer สร้างแถวจาก `resolved.get(dimensionRowKey(ref)).columns` + `dimension_code`/`value_code` (ไม่อ่าน `dimension_value_id` จาก ref ตรง ๆ อีก)
- [ ] Step 2: posting (gl-posting, ap/ar posting) copy 4 คอลัมน์ + value_code ไป JV และส่ง ref แบบ `value` สำหรับชนิดใหม่
- [ ] Step 3: serializer/response ทุกเอกสารคืนฟิลด์ใหม่ · gateway DTO/swagger รับ `value` และคืนฟิลด์ใหม่
- [ ] Step 4: `check-types` micro-business + gateway ต้องสะอาด · eslint โฟลเดอร์ที่แตะ · `bunx jest` micro-business ทั้งชุดต้องผ่าน (ปรับ spec ที่ตรึง shape เดิม)
- [ ] Step 5: commit `feat(dimension): writer และการลงบัญชีทุกเอกสารเก็บค่า dimension ตามชนิด`

### Task 4: ผู้อ่านอื่น + กันเปลี่ยนชนิด

**Files (BE):** `master/dimension/dimension.service.ts` (`countUsage` ครบ 12 ตาราง + guard), `dimension-value.service.ts`, `dimension-config.read.ts`/`.write.ts`, `account-dimension-rule.service.ts`, `chart-of-accounts/chart-of-accounts-links.plan.ts`, `accounting-master/accounting-master-mapping.ts`, `gl/gl-dimension/gl-dimension.defaults.ts`, gateway `config_dimension-values.controller.ts`

- [ ] Step 1: `update()` ของ dimension: เปลี่ยน `data_type` (ทุกทิศทาง) ขณะ `countUsage > 0` → `GL_DIMENSION_TYPE_IN_USE` · `countUsage` นับทั้ง 12 ตาราง ไม่กรองสถานะ
- [ ] Step 2: ไล่ทุกผู้อ่านในรายการ ให้รับ value_id null (กรอง null ก่อน `in: [...]`, ไม่ใช้ relation include ที่บังคับ) — grep `dimension_value_id` ซ้ำแล้วต้องไม่มีจุดที่ assume non-null
- [ ] Step 3: micro-report (Go): grep query ที่ join `*_dimension` กับ `tb_dimension_value` ถ้ามีให้เปลี่ยนเป็น LEFT JOIN + ใช้ `value_code` (ถ้าไม่มี บันทึกใน ledger ว่าไม่ต้องแก้)
- [ ] Step 4: `check-types` + eslint + jest micro-business · commit `feat(dimension): ห้ามเปลี่ยนชนิดเมื่อมีค่าในเอกสาร และผู้อ่านรับค่า dimension แบบพิมพ์เอง`

### Task 5: Frontend

**Files (FE):**
- Create `components/dimension/dimension-value-input.tsx`
- Modify `types/gl-dimension.ts` (`DimensionRef`), `types/journal-voucher.ts`, `types/accounts-payable.ts`, `types/accounting-master.ts`, `lib/dimension-payload.ts`
- Modify `components/dimension/line-dimension-fields.tsx` (+ `line-dimension-popover.tsx` ถ้ามีบน main), `routes/accounting/accounts-payable/invoice/ap-invoice-lines.tsx` + `ap-invoice-form.ts`, `routes/accounting/accounts-receivable/ar-invoice-line-dialog.tsx` + `ar-invoice-draft-model.ts`, `routes/accounting/documents/accounting-document-detail.tsx`, `routes/accounting/journal-voucher/journal-voucher-http-repository.ts`, `routes/config/payment-type/payment-type-dialog.tsx`, `routes/config/wht-form/wht-form-dialog.tsx`, `routes/config/shared/ap-master-account-fields.tsx` + `ap-master-form-schema.ts`, form schema ของ PR/PO/GRN/SR/IA

**Interfaces:**
```ts
interface DimensionRef { dimension_id: string; dimension_value_id?: string | null; value?: string | number | boolean | null;
  value_text?: string | null; value_number?: string | number | null; value_date?: string | null; value_boolean?: boolean | null;
  dimension_code?: string; value_code?: string; dimension_name?: string; value_name?: string; data_type?: DimensionDataType }
function DimensionValueInput(props: { dimension: DimensionMaster; value: DimensionRef | undefined; onChange: (next: DimensionRef | null) => void; disabled?: boolean; size?: "xs" | "sm" }): JSX.Element
function formatDimensionValue(ref: DimensionRef, dimension?: DimensionMaster): string // แสดงตามชนิด/date_format
```
- [ ] Step 1: `DimensionValueInput` — lookup = Select เดิม · string = Input maxLength 20 · number = Input ตัวเลข · date = date picker ของแอป (`components/ui`) แสดงตาม `date_format` ส่งค่า `YYYY-MM-DD` · boolean = Select ว่าง/Yes/No · ใช้ token/ขนาดตาม `docs/DESIGN.md` · i18n ข้อความใหม่ใน `messages/en.json` + `th.json`
- [ ] Step 2: แทนช่องเลือก dimension ทุกจุดในรายการ Files ด้วย `DimensionValueInput` และโหมดดูใช้ `formatDimensionValue`
- [ ] Step 3: payload builder ทุกตัว: lookup ส่ง `dimension_value_id`, ชนิดอื่นส่ง `value` · ค่าที่อ่านจาก response แปลงกลับเป็น `DimensionRef` (เก็บ value_id เดิมไว้ถ้ามี เพื่อส่งกลับตามข้อยกเว้นใน spec §5)
- [ ] Step 4: `bun run typecheck && bun run lint && bun test:run` ผ่าน
- [ ] Step 5: commit `feat(dimension): กรอกค่า dimension ตามชนิด (Text/Number/Date/Boolean) ทุกเอกสาร`

### Task 6: ตรวจมือ + PR

- [ ] เบราว์เซอร์ (ไม่กด Save): JV `f36fc74a-…` โหมด Edit — Channel (Text) ต้องเป็นช่องพิมพ์ · ลองตั้ง dimension ชนิด Number/Date/Boolean ไม่ได้บน dev ร่วมโดยไม่ถาม user → ข้าม และรายงาน
- [ ] curl กับ backend ในเครื่องถ้ามี micro-business ที่ชี้ DB ทดสอบ ไม่งั้นรายงานว่ายังไม่ได้ทดสอบ end-to-end
- [ ] PR 2 ใบ (BE ก่อน FE) body ระบุลำดับ: tenant migration ทุก BU → micro-business + gateway → FE · **ไม่ merge**
