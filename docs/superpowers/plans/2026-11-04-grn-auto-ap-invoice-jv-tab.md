# GRN Auto AP Invoice + JV Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **User preference (overrides TDD):** ไม่เขียน `*.spec.ts` / `*.test.ts` ใหม่ ไม่มีขั้น "write failing test" — implement → type-check → lint → commit · ชุด test ที่มีอยู่ต้องยังผ่าน (รันไฟล์ spec เดิมที่แตะ) · ตรวจมือด้วย curl/browser ตามขั้นที่ระบุ

**Goal:** เมื่อ BU เปิดสวิตช์ GRN `post_type = ap` ที่ commit แล้วจะได้ AP invoice (`doc_source = grn`) ที่ post แล้วพร้อม JV prefix AP ในทรานแซกชันเดียว และหน้า GRN มีแท็บ Journal Voucher

**Architecture:** เพิ่มเมธอด "in-tx" ใน `ApInvoiceService` (สร้าง+post / void) ที่รับ `tx` ของผู้เรียก แล้วให้ GRN commit/approve/update/endpoint ใหม่เรียกภายใน `prisma.$transaction` เดิมของ GRN; เปิด tenant context (`TenantContextRunner.run`) ใน handler ของ GRN ที่เกี่ยวข้อง เพราะ AP service เป็น `TenantScopedService` · ล็อกใบ auto ที่ RPC handler ของ AP · FE เพิ่มแท็บที่ดึง JV ผ่าน `GL_JV_DETAIL` ที่มีอยู่

**Tech Stack:** NestJS microservices + Prisma (tenant schema) + zod app-config · React 19 + React Router 7 + TanStack Query + next-intl-style i18n ใน FE

**Spec:** `docs/superpowers/specs/2026-11-04-grn-auto-ap-invoice-jv-tab-design.md`

## Global Constraints

- รีโป: backend `../carmen-turborepo-backend` (branch `feature/grn-auto-ap-invoice` ตัดจาก `main`), FE `carmen-frontend` (branch `feature/grn-auto-ap-invoice-jv-tab` มีอยู่แล้ว)
- commit message ภาษาไทย · PR ภาษาอังกฤษ · ห้าม squash-merge (changelog generator)
- logic layer ห้าม `throw` (throw = 503) → return `Result` · ภายใน tx ใช้ `abortWith` จาก `@/gl/gl-subledger-posting/tx-abort`
- สวิตช์: คีย์ `ap_auto_from_grn: z.boolean().optional()` ใน `GlSettingSchema` (`apps/micro-business/src/app-config/app-config.service.ts:130`) + `GlSetting` interface (`gl/gl-posting/gl-posting.service.ts:90`) · ไม่มี `.default()` · ไม่มีคีย์ = ปิด
- ทุก flow ของสเปกทำงานเฉพาะเมื่อ `ap_auto_from_grn === true` **และ** `post_type = ap` ยกเว้นการล็อกใบ `doc_source = grn` ฝั่ง AP ซึ่งทำงานเสมอ
- ฟิลด์ใหม่ใน response ต้องเพิ่มทั้ง serializer ของ micro **และ** gateway (`@Serialize`)
- api_name ใหม่ต้องเข้า allowlist ก่อน deploy FE (ไม่งั้น user โดน 401 → logout)
- ลำดับ deploy: backend + error-catalog → (BU ที่ใช้) ตั้ง `ap_jv_prefix_id` + `ap_control_account_id` → allowlist → FE → เปิดสวิตช์
- FE: i18n en/th ทุกข้อความ · ICU ห้ามมี `{{` `}}` หรือ `<คำ>` · light+dark · ใช้ primitive ใน `components/ui/` · ข้อความสถานะใช้ `text-*-ink`

## Review Focus

1. **GRN ที่ไม่ใช่ BU ที่เปิดสวิตช์** — commit ต้องเหมือนเดิมเป๊ะ (ไม่โหลด AP เลยถ้าปิด) → Task 2 Step "verify switch off"
2. **ยอด AP ≠ ยอด GRN** (ส่วนลดบรรทัด/ภาษี inclusive/extra cost) — ต้อง error ไม่ใช่ post ยอดผิด → Task 1 ด่าน `AP_GRN_TOTAL_MISMATCH`
3. **กด Create AP Invoice สองครั้งพร้อมกัน** — ต้องได้ใบเดียว → Task 3 ล็อกแถว GRN `SELECT … FOR UPDATE` ก่อนตรวจ
4. **แก้หัวใบ GRN ตอนมี AP payment draft** — ต้องล็อก ไม่ void → Task 2 ตรวจ payment ที่ไม่ void รวม draft
5. **ใบ auto ถูกแตะผ่านทางอื่น** (bulk delete ของ document trace, import) → Task 4 audit caller

---

### Task 1: AP service — สร้าง+post / void จาก GRN ภายใน tx ของผู้เรียก (backend)

**Files:**
- Modify: `apps/micro-business/src/ap/ap-invoice/ap-invoice.service.ts` (`createDraft` :206, `createFromGrn` :423, `grnLines` :469, `voidPosted` :1005)
- Modify: `packages/error-catalog/` (เพิ่มรหัสใหม่ตามรูปแบบไฟล์ AP เดิม)
- Modify: `apps/micro-business/src/app-config/app-config.service.ts:130`, `apps/micro-business/src/gl/gl-posting/gl-posting.service.ts:90`

**Interfaces:**
- Produces:
  - `ApInvoiceService.createAndPostFromGrnInTx(tx: Prisma.TransactionClient, grnId: string, opts: { onlyRemaining: boolean }): Promise<Result<{ id: string; doc_no: string; gl_jv_no: string } | null>>` — คืน `ok(null)` เมื่อไม่มีบรรทัดค้าง (ข้ามเงียบ) · ทุก error ใช้ `abortWith`
  - `ApInvoiceService.voidPostedFromGrnInTx(tx: Prisma.TransactionClient, invoiceId: string, reason: string): Promise<Result<unknown>>`
  - `ApInvoiceService.isAutoFromGrnEnabled(): Promise<boolean>` — อ่าน `gl_setting.ap_auto_from_grn`
  - error catalog: `AP_INVOICE_FROM_GRN_LOCKED`, `AP_GRN_TOTAL_MISMATCH` (`{ grn_no, grn_total, ap_total }`), `AP_AUTO_FROM_GRN_SETUP_INCOMPLETE` (`{ missing: string }`), `GRN_AP_PAID_NOT_EDITABLE` (`{ doc_nos }`)

- [ ] **Step 1:** เพิ่ม `ap_auto_from_grn` ใน `GlSettingSchema` และ `GlSetting`; เพิ่ม refine/ตรวจตอน **เขียน** `gl_setting`: ถ้า `ap_auto_from_grn === true` แต่ไม่มี `ap_jv_prefix_id` หรือ `ap_control_account_id` → `AP_AUTO_FROM_GRN_SETUP_INCOMPLETE` ระบุคีย์ที่ขาด (หาจุด validate ของ app-config write ที่ใช้ schema นี้ แล้ววางตรงนั้น)
- [ ] **Step 2:** แยก body ของ `createDraft` เป็น `private async writeDraftInTx(tx, ctx, data): Promise<Result<{ id; doc_no }>>` (เรียก `generateApDocNo` + `writer.writeDocument` บน `tx`) — `createDraft` เดิมเรียกผ่าน `runAtomic` เหมือนเดิม พฤติกรรม public ไม่เปลี่ยน
- [ ] **Step 3:** `createAndPostFromGrnInTx` — โหลด GRN + items บน `tx`; `onlyRemaining` = กรอง item ที่ `received_qty − matched > 0` ก่อนส่ง `grnLines` (กัน `AP_GRN_OVER_MATCHED` ของใบ manual บางส่วน); ไม่มี item เหลือ → `ok(null)`; header: `doc_type = invoice`, `doc_source = grn`, `doc_date = grn.grn_date`, `vendor_invoice_no = grn.invoice_no`, `invoice_date = grn.invoice_date ?? grn.grn_date`, `credit_term_days`, currency/rate จาก GRN, `description = "GRN " + grn_no`; `buildContext` → `writeDraftInTx` → `loadFull(tx, id)` → `posting.postInTx(tx, doc, this.userId)`
- [ ] **Step 4:** ด่านยอด — ก่อน `postInTx` เทียบ `total_amount` ของ AP (หลัง buildContext คำนวณ) กับยอดสุทธิของ GRN ส่วนที่ invoice (เมื่อ `onlyRemaining` และมีใบ manual อยู่ ให้เทียบเฉพาะกรณีไม่มี match เดิม — มี match เดิมให้ข้ามด่าน) · ต่างเกิน 0.01 → `AP_GRN_TOTAL_MISMATCH` · ถ้า `grnLines` ขาดส่วนลดบรรทัด/extra cost ให้เติมใน `grnLines` (ส่วนลด = `discount_amount` ต่อบรรทัด; extra cost เป็นบรรทัดแยก `dr` บัญชี mapping ของ extra cost type — ถ้าไม่มี mapping ใน DB ให้หยุดและรายงานแทนการเดา)
- [ ] **Step 5:** `voidPostedFromGrnInTx` — `guardedUpdate(tx, id, current doc_version, posted, {})` → `loadFull(tx)` → `posting.voidPostedInTx(tx, fresh, reason, this.userId)` (โยกส่วนร่วมจาก `voidPosted` ให้ใช้ด้วยกัน)
- [ ] **Step 6:** Run `bun run typecheck` และ `bun run lint` ใน `apps/micro-business` + `bun test ap-invoice` (spec เดิม) → PASS
- [ ] **Step 7:** Commit `feat(ap): สร้างและ post AP invoice จาก GRN ภายใน transaction ของผู้เรียก + สวิตช์ ap_auto_from_grn`

### Task 2: GRN commit / approve / update เรียก AP อัตโนมัติ (backend)

**Files:**
- Modify: `apps/micro-business/src/inventory/good-received-note/good-received-note.logic.ts` (`commit` :170, approve ~300, `postReceipt` ~240-290)
- Modify: `apps/micro-business/src/inventory/good-received-note/good-received-note.ap-link.ts` (`checkGrnUpdateAllowed`, `findActiveApInvoicesForGrn`)
- Modify: `apps/micro-business/src/inventory/good-received-note/good-received-note.service.ts` (`update` :1466)
- Modify: `apps/micro-business/src/inventory/good-received-note/good-received-note.controller.ts` (commit :335, approve :279, update :180)
- Modify: `apps/micro-business/src/inventory/good-received-note/good-received-note.module.ts` (import `ApInvoiceModule`)

**Interfaces:**
- Consumes: Task 1 `createAndPostFromGrnInTx`, `voidPostedFromGrnInTx`, `isAutoFromGrnEnabled`
- Produces: `GrnApInvoiceRef` ขยายเป็น `{ id; doc_no; doc_status; doc_source; gl_jv_id; gl_jv_no; void_gl_jv_id; has_live_payment: boolean }` และ `findActiveApInvoicesForGrn` คืนรูปนี้ · GET detail เพิ่ม `ap_auto_from_grn: boolean` (สถานะสวิตช์ของ BU)

- [ ] **Step 1:** module: import `ApInvoiceModule` (ตรวจว่าไม่เกิด circular import; ถ้าเกิดใช้ `forwardRef`) · controller handler `commit`, `approve`, `update` ห่อด้วย `this.ctx.run(payload, …)` ของ `TenantContextRunner` (ภายใน `runWithAuditContext` เดิม) ให้ AP service อ่าน bu_code/userId/prisma ได้
- [ ] **Step 2:** ใน `commit` และ approve: อ่าน `isAutoFromGrnEnabled()` **นอก** tx; ถ้า true และ `grn.post_type === 'ap'` เรียก `createAndPostFromGrnInTx(tx, id, { onlyRemaining: true })` ใน `prisma.$transaction` เดิม **หลัง** `postReceipt` และไม่ขึ้นกับ `alreadyPosted`/`held` · AP error → tx rollback ทั้งก้อน และ return error ตาม catalog (ไม่ใช่ 500) — ถ้า `$transaction` ของ GRN ใช้ client คนละตัวกับ `this.prismaService` ของ AP ให้ยืนยันว่าทุกการเขียนของ AP ไปที่ `tx` ที่ส่งเข้าไป
- [ ] **Step 3:** `findActiveApInvoicesForGrn` select เพิ่ม `doc_source, gl_jv_id, gl_jv_no, void_gl_jv_id` และคำนวณ `has_live_payment` = มี `tb_ap_payment_detail` ที่ payment ไม่ void/ไม่ลบ (รวม draft) อ้างใบนั้น · เพิ่มฟังก์ชัน `findVoidedAutoApInvoicesForGrn` (ใบ `doc_source = grn` ที่ void แล้ว พร้อม `gl_jv_id`, `void_gl_jv_id`) สำหรับแท็บ · GET detail ส่งทั้งสองชุด (`ap_invoices`, `ap_invoices_voided`) + `ap_auto_from_grn` — เพิ่มใน serializer micro + gateway
- [ ] **Step 4:** `checkGrnUpdateAllowed` สำหรับ committed + มีใบ live (สวิตช์เปิดเท่านั้น; สวิตช์ปิด = พฤติกรรมเดิม):
  - มีใบ `doc_source ≠ grn` (manual) หรือ `has_live_payment` → `GRN_AP_PAID_NOT_EDITABLE` (payment) / `GRN_AP_LINKED_NOT_EDITABLE` (manual) เหมือนเดิม
  - ใบ auto ล้วน ไม่มี payment → อนุญาตเฉพาะ `HEADER_EDITABLE_KEYS`, คืน `null` และให้ `update` ทำต่อ
- [ ] **Step 5:** ใน `update` (tx เดียวกับการเขียน GRN) เมื่อใบ committed + สวิตช์เปิด: คำนวณ diff ของ payload กับค่าเดิม
  - เปลี่ยนแค่ `description`/`note` → ไม่แตะ AP
  - เปลี่ยน `invoice_no|invoice_date|credit_term_*|payment_due_date` และ post_type ยังเป็น ap → `voidPostedFromGrnInTx(tx, old.id, "GRN header changed")` ทุกใบ auto แล้ว `createAndPostFromGrnInTx(tx, id, { onlyRemaining: true })` **หลัง** เขียนหัว GRN ใหม่
  - `post_type` ap → อื่น → void ทุกใบ auto ไม่สร้างใหม่ · อื่น → ap → สร้างใหม่
- [ ] **Step 6:** typecheck + lint + `bun test good-received-note` (spec เดิม ผ่าน; ถ้า spec เดิมของ ap-link พังเพราะรูป return ใหม่ ให้ปรับ fixture ไม่ใช่ตัด assertion)
- [ ] **Step 7 (verify switch off):** รัน micro local, BU ที่ไม่มี `ap_auto_from_grn` → commit GRN ap ผ่านเหมือนเดิม ไม่มี `tb_ap_invoice` ใหม่ (`curl` commit แล้ว query นับแถว)
- [ ] **Step 8:** Commit `feat(grn): commit/approve สร้าง AP invoice อัตโนมัติ และแก้หัวใบแล้ว void+สร้างใหม่`

### Task 3: Endpoint "Create AP Invoice" ย้อนหลัง (backend micro + rpc-contract + gateway)

**Files:**
- Modify: `packages/rpc-contract/src/contracts/` ไฟล์ของ GoodReceivedNotes (เพิ่ม pattern `createApInvoice`)
- Modify: `apps/micro-business/src/inventory/good-received-note/good-received-note.controller.ts`, `.logic.ts`
- Modify: `apps/backend-gateway/src/application/good-received-notes/` (controller + service ตามแบบ commit)

**Interfaces:**
- Consumes: Task 1 `createAndPostFromGrnInTx`, `isAutoFromGrnEnabled`
- Produces: `POST /api/:bu_code/good-received-notes/:id/ap-invoice` → `201 { data: { id, doc_no, gl_jv_no } }` · api_name ตามแบบ `goodReceivedNote.createApInvoice` (ตามรูปชื่อจริงของ commit) · permission เท่ากับ commit

- [ ] **Step 1:** `GoodReceivedNoteLogic.createApInvoice(id, user_id, tenant_id)`: สวิตช์ปิด → `AP_AUTO_FROM_GRN_SETUP_INCOMPLETE` (`missing: "ap_auto_from_grn"`) · ใน `$transaction`: `SELECT id FROM tb_good_received_note WHERE id = $1 FOR UPDATE` → ตรวจ `committed` + `post_type = ap` (ไม่ใช่ → error catalog เดิมที่ใกล้เคียงที่สุด หรือเพิ่ม `GRN_NOT_AP_POSTABLE`) → `createAndPostFromGrnInTx(tx, id, { onlyRemaining: true })` → ผล `null` = ไม่มีบรรทัดค้าง → `AP_GRN_OVER_MATCHED`
- [ ] **Step 2:** controller micro (ห่อ `ctx.run` + audit context) + contract + gateway route + permission guard เดียวกับ commit
- [ ] **Step 3:** typecheck + lint ทั้ง micro-business และ backend-gateway
- [ ] **Step 4:** ตรวจมือ: `curl -X POST …/good-received-notes/<committed-ap-grn>/ap-invoice` สองครั้งติดกัน → ครั้งแรก 201 ครั้งสองได้ error, `tb_ap_invoice` เพิ่ม 1 แถว, `tb_gl_jv_header` มี `source_ref_id` = id ใบนั้น
- [ ] **Step 5:** Commit `feat(grn): endpoint สร้าง AP invoice ย้อนหลังสำหรับ GRN ที่ commit แล้ว`

### Task 4: ล็อก AP invoice `doc_source = grn` ฝั่ง AP (backend)

**Files:**
- Modify: `apps/micro-business/src/ap/ap-invoice/ap-invoice.controller.ts` (update :72, delete :86, submit :98, approve :112, review :126, reject :140, void :154, createFromGrn :184)
- Modify: `apps/backend-gateway/src/application/ap-invoice/ap-invoice.controller.ts:89,329` (ปิด `grn-candidates`, `from-grn`)

**Interfaces:**
- Consumes: error `AP_INVOICE_FROM_GRN_LOCKED`
- Produces: `ApInvoiceService.assertNotAutoFromGrn(id: string): Promise<Result<void> | null>`

- [ ] **Step 1:** `assertNotAutoFromGrn` อ่าน `doc_source` — `grn` → `AP_INVOICE_FROM_GRN_LOCKED`; handler ทั้ง 7 ตัวเรียกก่อนเรียก service (ภายใน `ctx.run`) · `createFromGrn` handler ตอบ `AP_INVOICE_FROM_GRN_LOCKED` เสมอ · gateway ถอด route `grn-candidates` + `from-grn`
- [ ] **Step 2:** audit caller: `grep -rn "ApInvoiceService\|tb_ap_invoice\b.*\(update\|delete\)" apps/micro-business/src` — ทุกจุดที่แก้/ลบ AP invoice นอก flow GRN (bulk delete ของ document trace, import excel/ai/interface) ต้องข้ามหรือปฏิเสธใบ `doc_source = grn`; รายงานรายการจุดที่พบใน commit message/PR
- [ ] **Step 3:** typecheck + lint + `bun test ap-invoice`
- [ ] **Step 4:** ตรวจมือ: `curl -X PUT …/ap-invoice/<auto-id>` และ `POST …/void` → error `AP_INVOICE_FROM_GRN_LOCKED`; AP payment draft ที่อ้างใบ auto ยังสร้างได้
- [ ] **Step 5:** Commit `feat(ap): ล็อก AP invoice ที่มาจาก GRN ไม่ให้แก้/void/ลบผ่าน API ของ AP` · เปิด PR backend (อังกฤษ) ระบุ deploy order + allowlist + GL setting

### Task 5: สวิตช์ในหน้า Accounting Settings (FE)

**Files:**
- Modify: `routes/accounting/settings/gl-setting-value.ts` (`GlSettingForm`, `toGlSettingValue`, ตัวแปลงค่าตั้งต้น)
- Modify: `routes/accounting/settings/accounting-settings-form.tsx` (~:400-440 กลุ่ม AP)
- Modify: ไฟล์ i18n ของ accounting settings (en/th)

**Interfaces:**
- Produces: `GlSettingForm.ap_auto_from_grn: boolean` (ไม่มีค่า = false) · เขียนลง `gl_setting` เป็น boolean เสมอ

- [ ] **Step 1:** เพิ่มฟิลด์ใน type + ตัวแปลง (ค่าที่ไม่ใช่ boolean → false) แบบเดียวกับ `allow_post_to_closed_period`
- [ ] **Step 2:** switch ในกลุ่ม AP ใต้ `ap_jv_prefix_id` ป้าย "Create AP invoice automatically from GRN" / "สร้าง AP invoice อัตโนมัติจาก GRN" + คำอธิบายสั้น · disabled พร้อม hint เมื่อ `ap_jv_prefix_id` หรือ `ap_control_account_id` ว่างในฟอร์ม · error `AP_AUTO_FROM_GRN_SETUP_INCOMPLETE` จาก backend แสดงผ่าน error toast เดิม
- [ ] **Step 3:** `bun run typecheck` + `bun run lint` + `bun test:run routes/accounting/settings` → PASS
- [ ] **Step 4:** Commit `feat(accounting): สวิตช์สร้าง AP invoice อัตโนมัติจาก GRN ในหน้าตั้งค่าบัญชี`

### Task 6: แท็บ Journal Voucher + ปุ่ม Create AP Invoice ในหน้า GRN (FE)

**Files:**
- Modify: `types/goods-receive-note.ts:128` (`GrnApInvoiceRef`), :179 (`ap_invoices_voided?`, `ap_auto_from_grn?`)
- Modify: `constant/api-endpoints.ts` (เพิ่ม `GRN_CREATE_AP_INVOICE: (bu, id) => /api/proxy/api/${bu}/good-received-notes/${id}/ap-invoice`)
- Create: `routes/procurement/goods-receive-note/grn-journal-tab.tsx`
- Create: `routes/procurement/goods-receive-note/use-grn-journal-vouchers.ts`
- Modify: `routes/procurement/goods-receive-note/grn-form.tsx:261-302`
- Modify: i18n ของ GRN (en/th)

**Interfaces:**
- Consumes: GET GRN detail จาก Task 2 · `JournalVoucher` + `get(buCode, id)` จาก `routes/accounting/journal-voucher/journal-voucher-http-repository.ts:298` — **ข้ามโมดูลไม่ได้ (ESLint module boundary)** → ถ้าต้องใช้ ให้ย้าย type/fetch ที่จำเป็นไป `types/journal-voucher.ts` (มีอยู่แล้ว) + hook กลางใน `hooks/` หรือเรียก `httpClient.get(API_ENDPOINTS.GL_JV_DETAIL(...))` ตรงใน `use-grn-journal-vouchers.ts`
- Produces: `useGrnJournalVouchers(grn: GoodsReceiveNote | undefined): { active: GrnJvView[]; reversed: GrnJvView[]; isLoading: boolean }` โดย `GrnJvView = { jv: JournalVoucher; apInvoice: GrnApInvoiceRef; kind: "active" | "voided" | "reversal" }` · `useCreateGrnApInvoice(grnId)` mutation ที่ invalidate query ของ GRN detail

- [ ] **Step 1:** ขยาย type (optional ทุกฟิลด์ใหม่ — backend รุ่นก่อนไม่ส่ง) + endpoint
- [ ] **Step 2:** `use-grn-journal-vouchers.ts` — ใบ live: ดึง `gl_jv_id` → `active`; ใบ void: ดึง `gl_jv_id` (kind `voided`) และ `void_gl_jv_id` (kind `reversal`) → `reversed` · ใช้ `useQueries` ต่อ id, `enabled` เมื่อมี id
- [ ] **Step 3:** `grn-journal-tab.tsx` — สถานะว่างตามสเปก §5: ยังไม่ commit / post_type ≠ ap / committed+ap+ไม่มีใบ (+ ปุ่ม "Create AP Invoice" เมื่อ `ap_auto_from_grn` และผู้ใช้มีสิทธิ์ commit — ใช้ guard สิทธิ์เดียวกับปุ่ม commit ใน `grn-footer-action.tsx`) · มี JV: การ์ดหัว (jv_no, jv_date, jv_status, AP doc_no + ลิงก์ `/accounting/accounts-payable/invoice/<id>`, ลิงก์ JV `/accounting/journal-voucher/<id>`) + ตาราง Account / Description / Debit / Credit อ่านอย่างเดียว ตัวเลขผ่าน `use-number-formatter` · JV ใน `reversed` มี `Badge` "Reversed" · ปุ่ม Create → `useCreateGrnApInvoice` + toast สำเร็จ/ error ผ่าน handler เดิม
- [ ] **Step 4:** `grn-form.tsx` เพิ่ม `TabsTrigger value="journal"` ต่อจาก stock + `TabsContent` ที่ render `GrnJournalTab` (ไม่ render ในหน้าใหม่ที่ยังไม่มี `goodsReceiveNote`)
- [ ] **Step 5:** `bun run typecheck` + `bun run lint` + `bun test:run routes/procurement/goods-receive-note` → PASS (test เดิม)
- [ ] **Step 6:** ตรวจมือใน browser (`VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev`) ทั้ง light/dark: GRN draft → ข้อความ "JV จะถูกสร้างเมื่อ commit"; GRN committed เก่า → ปุ่ม Create → เห็น JV prefix AP; แก้ invoice no → เห็น JV ใหม่ + JV เดิม/กลับรายการพร้อม Reversed
- [ ] **Step 7:** Commit `feat(grn): แท็บ Journal Voucher และปุ่มสร้าง AP invoice ในหน้า GRN` · รัน `trail check` · เปิด PR FE (อังกฤษ) ระบุว่าต้อง deploy หลัง backend + allowlist
