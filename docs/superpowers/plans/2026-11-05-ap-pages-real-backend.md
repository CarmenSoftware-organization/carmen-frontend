# AP Invoice + AP Payment → Real Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **User preference (overrides TDD):** no new `*.spec.ts` / `*.test.ts`; implement → typecheck → lint → commit. Existing tests that only exercised the mock are deleted with it (named per task); other existing tests must pass. Manual browser check per task where noted.

**Goal:** หน้า `/accounting/accounts-payable/invoice` และ `/payment` ใช้ backend จริง (`api/:bu_code/ap-invoice`, `api/:bu_code/ap-payment`) แทน localStorage mock; ใบที่ `doc_source = grn_auto` แสดงป้าย "From GRN" และเปิดดูได้อย่างเดียว

**Architecture:** แทน `ApRepository` (mock-shaped) ด้วย HTTP repository แบบ buCode-first ตามแบบ `routes/accounting/journal-voucher/journal-voucher-http-repository.ts`; ปรับ `types/accounts-payable.ts` ให้เป็นรูปของ backend (ไม่ map กลับเป็นรูป mock); รื้อ UI ที่ผูกกับแนวคิดที่มีแต่ใน mock ออก (ซ่อน ไม่ใช่สร้าง backend เพิ่ม — user ตัดสิน 2026-11-05 "ข้ามคำถาม เริ่มเลย", controller เลือก "ต่อเฉพาะที่ backend มี")

**Tech Stack:** React 19 + React Router 7 + TanStack Query v5 + react-hook-form/zod + `components/lookup/*`

**Context:** โปรเจกต์ 1 (GRN → AP invoice `grn_auto` + JV tab) merge แล้ว (BE #1002, FE #502) · gap analysis เต็มอยู่ในประวัติ session 2026-11-04/05; ข้อเท็จจริงที่แผนพึ่งอยู่ในหัวข้อ "Backend contract" ด้านล่าง

## Global Constraints

- Module boundary (ESLint): `routes/accounting/` import จาก `routes/procurement/` ไม่ได้ และกลับกัน; ของกลางไป `components/` `hooks/` `lib/` `types/`
- i18n en/th ทุกข้อความ (หน้า AP ตอนนี้ hardcode อังกฤษ + ป้าย `mock` — ย้ายเข้า messages ระหว่างที่แตะ); ICU ห้าม `{{` `}}` หรือ `<คำ>`
- light+dark · `components/ui/` primitives · ข้อความสถานะ `text-*-ink` · ห้ามขนาดตัวอักษรนอก ladder · ตัวเลขผ่าน `use-number-formatter` · วันที่ผ่าน `formatDate(…, dateFormat)` จาก `useProfile()`
- DataGrid/useReactTable: อ่าน `routes/CLAUDE.md` (React Compiler freeze → `"use no memo";` หรือ memoize columns)
- เงินจาก backend เป็น **number** → แปลงเป็น `DecimalString` ที่ขอบ repository เท่านั้น (ใช้ `shared/ap-decimal.ts` ต่อ)
- ลบป้าย `mock` (`DocFormHeader mock`) เฉพาะหน้าที่ต่อจริงแล้ว — dashboard ยังเป็น mock (ไม่มี API) **คงป้ายไว้**
- License: ทุก leaf ใช้ `licenseFeature: "accounting.ap"` อยู่แล้ว ไม่เพิ่ม key ใหม่ · backend guard `accounting.ap: ['void']` เฉพาะ void
- api_name ใหม่ที่ FE จะเรียก (`apInvoice.*`, `apPayment.*` ตามชื่อใน backend app-api catalog) ต้องอยู่ใน allowlist ก่อน deploy FE — Task 6 รวบรายชื่อ
- commit ภาษาไทย · PR อังกฤษ · ไม่ squash

## Backend contract (ตรวจ 2026-11-05)

- Invoice: `GET/POST ap-invoice`, `GET/PUT/DELETE ap-invoice/:id`, `POST ap-invoice/:id/{submit,approve,review,reject,void}` (body `{doc_version?, reason?, stage?}`; FE "return" = `review`), `GET ap-invoice/:id/reference-candidates`
  - create body: required `doc_type` (invoice|debit_note|credit_note|deposit), `doc_date`, `vendor_id`, `vendor_invoice_no` (1–100), `invoice_date`, `details.add[]` (≥1); optional `credit_term_days` (**ไม่มี credit_term_id ขาเข้า**), `currency_id`, `exchange_rate`, `description`, `attachments`, `references[{ref_ap_invoice_id, applied_amount}]`; `doc_source` grn/grn_auto ถูกปฏิเสธ
  - line: required `sequence_no`, `quantity`, `unit_price`, `dr_chart_of_accounts_id`; optional `description`, `product_id/name`, `unit_id/name`, `discount_amount`, `dr_cost_center_id`, `vat_tax_profile_id`, `vat_amount`, `vat_is_override`, `wht_tax_profile_id`, `dimensions[{gl_dimension_id, gl_dimension_value_id}]`
  - update (`PUT`): create − {doc_type, doc_source, vendor_id, currency_id}, partial, + required `doc_version`; `details.add` แทนทั้งชุด
  - response: `doc_no`, `doc_status` (draft|in_review|posted|void), `doc_source`, `doc_type`, `vendor_*`, `currency_*`, `credit_term_*`, money (`sub_total_amount`, `discount_amount`, `net_amount`, `vat_amount`, `total_amount`, `wht_estimate_amount`, `outstanding_amount`, base_*), `gl_jv_id/no`, `void_gl_jv_id`, workflow (`user_action`, `workflow_*`, `last_action*`); **detail only:** `tb_ap_invoice_detail[]` (+ `tb_ap_invoice_detail_source[]` ต่อบรรทัด: `good_received_note_id`, `grn_no`, `matched_qty`…), `tb_ap_invoice_reference[]`, `tb_ap_invoice_tax`
  - grn_auto invoices: ทุก action/PUT/DELETE ตอบ `AP_INVOICE_FROM_GRN_LOCKED`
- Payment: `GET/POST ap-payment`, `GET/PUT/DELETE ap-payment/:id`, `POST ap-payment/:id/{submit,approve,review,reject,void}`, `GET ap-payment/outstanding-documents?vendor_id=`, `POST ap-payment/wht-preview`
  - create: required `vendor_id`, `payment_date`, `bank_account_id`, `allocations[{ap_invoice_detail_id, applied_amount}]` (≥1, **ต่อบรรทัด invoice**; CN/deposit เป็นค่าติดลบ); optional `paid_date`, `payment_method` (bank_transfer|cheque|cash|credit_card|promptpay), `cheque_no/date`, `reference_no`, `description`, `exchange_rate`, `attachments`, `wht[{wht_tax_profile_id, base_amount, wht_amount, is_override}]`, `expenses[{chart_of_accounts_id, cost_center_id, description, amount}]`
  - update: create − vendor_id, partial, + `doc_version`
- List: `QueryParams` (`page`, `perpage`, `search`, `filter` object of Prisma columns e.g. `doc_status`, `vendor_id`, `doc_type`, `doc_source`; `sort` "field:dir"); response `{ data, paginate }`; rows **ไม่มี lines**
- ไม่มี: dashboard/aging, approvals inbox, clarify, hold/reserve, release/execution, multi payment method, match status, journal preview ก่อน post

## Review Focus

1. ใบ `grn_auto` ต้องไม่มีทางกดแก้/ส่ง/void จาก UI (ปุ่มซ่อน + backend 422 เป็นตาข่าย) → Task 3
2. `doc_version` ส่งทุก PUT/action — 409/conflict แสดงข้อความ ไม่ทับเงียบ → Task 1 + 3 + 5
3. payment allocation ต่อบรรทัด: ยอดรวมต่อ invoice = ผลรวมบรรทัด, ไม่เกิน `available_amount` ของ outstanding-documents → Task 5
4. เงิน number↔DecimalString ไม่ปัดเพี้ยน (ใช้ ap-decimal) → Task 1
5. list ที่กรองสถานะใช้ค่า backend 4 ค่า; URL param เก่า (`lifecycle=submitted` จาก redirect `payment-approvals`) ต้องไม่ทำหน้าพัง → Task 2 + 4 + 6

---

### Task 1: Types + endpoints + HTTP repository + hooks

**Files:**
- Modify: `types/accounts-payable.ts` (แทนรูป mock ด้วยรูป backend; คง `DecimalString`)
- Modify: `constant/api-endpoints.ts` (เพิ่ม `AP_INVOICE_LIST`, `AP_INVOICE_DETAIL`, `AP_INVOICE_ACTION(bu,id,cmd)`, `AP_INVOICE_REFERENCE_CANDIDATES`, `AP_PAYMENT_LIST`, `AP_PAYMENT_DETAIL`, `AP_PAYMENT_ACTION`, `AP_PAYMENT_OUTSTANDING`, `AP_PAYMENT_WHT_PREVIEW` — รูปเดียวกับ `GL_JV_*`, ใช้ `toSafePathSegment`)
- Create: `routes/accounting/accounts-payable/shared/ap-repository.ts` (interface), `ap-http-repository.ts` (impl)
- Modify: `routes/accounting/accounts-payable/shared/use-accounts-payable.ts`

**Interfaces (Produces):**
- Types: `ApDocStatus = "draft"|"in_review"|"posted"|"void"`, `ApDocType`, `ApDocSource = "manual"|"grn"|"grn_auto"|"copy"|"excel"|"ai"|"interface"`, `ApInvoice` (header + `lines?: ApInvoiceLine[]` + `references?` + `tax?`), `ApInvoiceLine` (+ `sources: ApInvoiceLineSource[]`), `ApInvoiceInput`, `ApPayment` (+ `allocations`, `wht`, `expenses`, `tax_invoices`), `ApPaymentInput`, `ApOutstandingDocument`, `ApWhtPreview*`, `ApSettlement = "unpaid"|"partially_paid"|"paid"` (derived), `ApListParams` (= JV `ParamsDto`)
- Helpers in `shared/ap-status.ts`: `apSettlement(inv): ApSettlement` (outstanding vs total), `apCanEdit(doc)`, `apIsAutoFromGrn(inv) = inv.doc_source === "grn_auto"`, `apActions(doc): ("submit"|"approve"|"return"|"reject"|"void"|"delete")[]` — from `doc_status` + `user_action` + `apIsAutoFromGrn` (grn_auto → `[]`)
- Repository (buCode-first): `listInvoices(bu, params) → { data: ApInvoice[]; paginate }`, `getInvoice(bu,id)`, `createInvoice(bu,input)`, `updateInvoice(bu,id,docVersion,input)`, `deleteInvoice(bu,id)`, `invoiceAction(bu,id,cmd,{docVersion,reason?})`, `referenceCandidates(bu,id)`; same set for payments + `outstandingDocuments(bu,vendorId)`, `whtPreview(bu,body)`
- Hooks keep names where callers exist (`useApInvoices(params)`, `useApInvoice(id)`, `useSaveApInvoice`, `useApInvoiceAction`, `useApPayments`, `useApPayment`, `useSaveApPayment`, `useApPaymentAction`) + new `useDeleteApInvoice`, `useDeleteApPayment`, `useApOutstandingDocuments(vendorId)`, `useApWhtPreview`; `useApDashboard` stays on the mock (moved to `ap-dashboard` local import of the mock seed — see Task 6)

- [ ] Step 1: types + `ap-status.ts`
- [ ] Step 2: endpoints
- [ ] Step 3: `ap-http-repository.ts` — mirror JV http repo (`buildUrl`, `httpClient`, `ApiError.from`, tolerate `json.data`/`paginate`); number→DecimalString at the boundary; action "return" → `review`
- [ ] Step 4: hooks → HTTP repo, invalidate `AP_QUERY_KEYS.root(bu)` on mutations; `enabled: !!id && id !== "new"`
- [ ] Step 5: move the current mock-shaped types to `types/accounts-payable-mock.ts` and the mock repo/hooks keep importing from there, so pages not yet migrated still compile; each later task switches one page to the new hooks/types (new hooks live beside the old ones as `useApInvoicesHttp` etc. only if a name clash blocks compilation — rename back in Task 6)
- [ ] Step 6: typecheck + lint → commit `feat(ap): repository HTTP ของ AP invoice/payment + type ตาม backend`

### Task 2: AP invoice list

**Files:** Modify `routes/accounting/accounts-payable/invoice/ap-invoice-list.tsx`
- Filters → backend: status (4 ค่า), doc_type, vendor (`LookupVendor`), source (manual vs From GRN = `doc_source in (grn_auto)`; ถ้า filter object ไม่รองรับ in ให้ทำแค่ `doc_source = grn_auto` / ทั้งหมด), search; pagination ผ่าน `paginate`
- Columns: doc_no, doc_date, vendor, vendor_invoice_no, doc_type, total, outstanding, settlement (derived), status, **ป้าย "From GRN"** เมื่อ `grn_auto`
- ตัด: hold/reserved, due_bucket/as_of, match, tax filter (ไม่มีบน list), lifecycle เก่า — param เก่าที่ไม่รู้จักถูกละ ไม่ crash
- ปุ่ม New → `/invoice/new` (manual เท่านั้น)
- [ ] implement · typecheck · lint · ตรวจ browser (dev backend) · commit `feat(ap): หน้า list AP invoice ใช้ข้อมูลจริง + ป้าย From GRN`

### Task 3: AP invoice detail (manual edit + grn_auto read-only)

**Files:** Modify `invoice/ap-invoice-detail.tsx`, `invoice/ap-invoice-lines.tsx`
- Header: vendor `LookupVendor` (create only; update ห้ามเปลี่ยน), currency `LookupCurrency` + exchange_rate, credit term `LookupCreditTerm` → ส่ง `credit_term_days` จาก `value`, doc_type, doc_date, vendor_invoice_no, invoice_date, description
- Lines: product (optional `LookupProduct`), qty, unit, unit_price, discount, Dr account `LookupChartOfAccountById` (id), cost center `LookupCostCenter` (id), VAT tax profile `LookupTaxProfile`, WHT tax profile (ถ้า lookup แยกประเภทไม่ได้ ให้ใช้ตัวเดียวกันพร้อม label — รายงาน), dimensions: ตัดออกรอบนี้ (*controller call* — ไม่มี lookup component; backend optional)
- ตัด: 3-way-match dialog/override/acknowledge, journal preview (แทนด้วยลิงก์ `gl_jv_no` → `/accounting/journal-voucher/:gl_jv_id` เมื่อ posted), hardcoded department, workflow_enabled toggle, copy-from (คงได้ถ้า map ง่าย — ไม่งั้นตัด)
- Actions จาก `apActions()`; void ต้องมี reason; delete สำหรับ draft
- **grn_auto:** ทั้งฟอร์ม read-only, ไม่มีปุ่ม action, banner "สร้างอัตโนมัติจาก GRN — แก้ที่ GRN" + ลิงก์ไป `/procurement/goods-receive-note/<good_received_note_id>` จาก `lines[].sources[0]`; บรรทัดแสดง GRN no
- References (CN/deposit apply) ผ่าน `reference-candidates`: ทำเฉพาะถ้าเวลาพอ — ไม่งั้นแสดงอ่านอย่างเดียว (*controller call*)
- [ ] implement · typecheck · lint · ตรวจ browser: สร้าง manual draft → submit/approve (ถ้า BU ไม่มี workflow) → posted มี JV link; เปิดใบ grn_auto ต้องแก้ไม่ได้ · commit

### Task 4: AP payment list

**Files:** Modify `payment/ap-payment-list.tsx`
- Filters: status 4 ค่า, vendor, payment_method, search · columns: doc_no, payment_date, vendor, bank_account, method, net_paid, status
- ตัด: execution/release filter + columns, urgent, lifecycle เก่า
- [ ] implement · typecheck · lint · commit

### Task 5: AP payment detail

**Files:** Modify `payment/ap-payment-detail.tsx`, `payment/ap-payment-sections.tsx`, `payment/ap-payment-totals.ts`; Delete `payment/ap-payment-tax-allocation.tsx`
- Header: vendor (create only), payment_date, paid_date, bank account (`useBankAccounts`), single payment_method, cheque_no/date เมื่อ cheque, reference_no, description, exchange_rate
- Allocations: เลือก vendor → `useApOutstandingDocuments(vendorId)` แสดงเป็นกลุ่มต่อ invoice/บรรทัด พร้อม `available_amount`; ผู้ใช้ใส่ยอดต่อบรรทัด (ปุ่ม "จ่ายเต็ม" ต่อ invoice = เติมทุกบรรทัดเต็ม available); CN/deposit แสดงเป็นติดลบ; ห้ามเกิน available
- WHT: เรียก `wht-preview` จาก allocations แล้วให้แก้ override ได้ → `wht[]`
- Expenses: `LookupChartOfAccountById` + `LookupCostCenter` + amount → `expenses[]`
- Totals: ตาม response (`total_applied_amount`, `total_wht_amount`, `net_paid_amount`) และคำนวณ preview ฝั่ง client ด้วย `ap-payment-totals.ts` (ปรับให้เข้ารูปใหม่)
- ตัด: multi payment methods, deposit offsets section (deposit เป็นบรรทัดติดลบใน allocations แทน), tax allocation / tax invoice register แก้ไข (แสดง `tax_invoices` อ่านอย่างเดียว), clarify, release/execution, urgent, journal preview (ใช้ลิงก์ gl_jv แทน)
- Actions จาก `apActions()`; void reason
- Delete: `payment/ap-payment-detail.test.tsx` ถ้าทดสอบแต่ flow ที่ถูกตัด — ถ้ามี case ที่ยังใช้ได้ให้ปรับ mock ของ hook ให้ตรง signature ใหม่ (รายงาน)
- [ ] implement · typecheck · lint · `bun test:run routes/accounting/accounts-payable` · ตรวจ browser: payment จ่าย invoice manual ที่ posted + invoice grn_auto · commit

### Task 6: Cleanup + routing + allowlist list

- Delete: `shared/ap-mock-repository.ts`, `shared/ap-mock-repository.test.ts`, `types/accounts-payable-mock.ts` — ยกเว้น seed ที่ dashboard ใช้: ย้ายฟังก์ชันที่ `ap-dashboard.tsx` / `buildApDashboardSnapshot` ต้องการไป `routes/accounting/dashboard/` (ที่มันอยู่แล้ว) หรือ inline เป็น mock data ของ dashboard; `useApDashboard` ใช้ข้อมูล mock นั้นตรง ๆ (คงป้าย mock)
- `routes/router.tsx` redirect `payment-approvals` → `payment?status=in_review`
- i18n: เก็บข้อความอังกฤษ hardcode ที่เหลือในหน้า AP เข้า messages en/th
- รวบรายชื่อ api_name ที่ FE เรียก (จาก backend app-api catalog สำหรับ route ที่ใช้) ใส่ PR description เป็น deploy prerequisite
- [ ] typecheck · lint · `bun test:run` ทั้งชุด · `trail check` · commit `refactor(ap): ลบ mock repository ของ AP`
