# AR Receipt Implementation Plan (Phase A real backend + GL posting, Phase B approval workflow)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **User preference (overrides TDD):** skip "write the failing test / run to see it fail"; do not create new `*.spec.ts` / `*.test.ts(x)` files. Do update **existing** specs/tests broken by the change (and delete an existing test only when the thing it tests is removed by this plan, saying so in the report). Every task runs type-check (+ lint where cheap) and the existing tests of the touched folders. Manual verification (curl/browser) is listed at the end for the user. Tell every implementer subagent this explicitly (they do not inherit it).

**Goal:** Replace the localStorage AR Receipt mock with a real, persisted, GL-posting document: allocation against posted AR invoice / debit-note / credit-note lines, WHT from tax profiles, bank charge, overpayment booked to a customer advance account, realised FX, posted JV + reversal on void (Phase A). Then route human-created receipts through the BU's single approval workflow with the AP Invoice / AP Payment / AR Invoice rules (Phase B).

**Architecture:** New backend module `apps/micro-business/src/ar/ar-receipt/` modelled file-for-file on `ap/ap-payment/` (controller, service, logic, validation, writer, posting, running-code), using the existing `tb_ar_receipt*` tables with a small additive migration; GL posting through `subledger.postFromSource` (new ref type `ar_receipt`); three new `gl_setting` keys (JSON, no migration). Phase B reuses the shared helpers in `common/workflow/accounting-doc-workflow.ts` — no duplicate workflow code. Frontend adds data hooks + payload mapping, rewrites the receipt model/pages onto them (one tender), adds the gl_setting fields, then (Phase B) the workflow admin type, Default Setting key and the approval action bar.

**Tech Stack:** NestJS micro-business + backend-gateway, Prisma (tenant schema), `@repo/error-catalog`, `@repo/rpc-contract`; React 19 + React Router 7 + TanStack Query + use-intl + zod (FE).

**Spec:** `docs/superpowers/specs/2026-11-25-ar-receipt-design.md` (carmen-frontend). Templates: `…/plans/2026-11-25-ar-invoice-workflow.md`, the AP Payment plan, and the code in `apps/micro-business/src/ap/ap-payment/` (read it before each backend task — the AR code mirrors it with the differences listed in the spec).

**Repos / branches**
- Backend `carmen-turborepo-backend`: branch `feature/ar-receipt` **off `main`** (main already contains AP Invoice, AP Payment and AR Invoice workflows and the shared helper). Phase A and Phase B are commits on the same branch; if the user wants two releases, cut the PR after Task 12 (Phase A) and open a second PR for Phase B.
- Frontend `carmen-frontend`: branch `feature/ar-receipt` **off `main`**.
- Commit messages in Thai; PR bodies in English. **No push / PR without asking the user first.**

## Global Constraints

- **Statuses:** `enum_ar_receipt_status` = `draft | in_review | posted | void`. Phase A: `draft → posted | void` (submit posts directly). Phase B adds `in_review`.
- **Source:** new `enum_ar_receipt_source { manual, copy, interface }`, column `doc_source` default `manual`; FE "from invoice" = `manual` + `source_doc_ref`. Workflow-eligible = shared `isWorkflowEligibleSource` (`manual`, `copy`); `interface` posts directly.
- **Totals (document currency):** `total_applied = Σ signed applied` (credit-note lines negative); `settlement = net_received + wht + charge`; **`unapplied = settlement − total_applied`**; reject when `unapplied < 0` (`AR_RECEIPT_OVER_ALLOCATED`), `total_applied < 0`, `net_received < 0`, `wht < 0`, `charge < 0`, `wht > Σ positive applied` (`AR_RECEIPT_WHT_INVALID`), or (no allocations **and** `settlement = 0`) (`AR_RECEIPT_EMPTY`). `net_received_amount` = bank amount.
- **Base / FX:** `baseAtInvoice = Σ baseAtInvoiceRate(line)` (whole-line take takes the whole `base_unpaid_amount`; copy `ap-payment.logic.ts:63`), `baseAtReceipt = Σ round2(applied × receipt rate)`, `advance_base = round2(unapplied × rate)`, `base_net_received = baseAtReceipt + advance_base − base_wht − base_charge` (plug), `realized_fx_amount = baseAtReceipt − baseAtInvoice` (> 0 gain = Cr). With `net_received = 0` skip the bank leg and move conversion rounding into FX (AP zero-payment rule). No rounding account.
- **JV** (`source = ar`, `source_ref_type = 'ar_receipt'`, description `${doc_no} ${customer_name}`, `jv_date = receipt_date`), legs in this order, each omitted when zero: AR-Dr groups (credit-note lines: Dr each line's `dr_chart_of_accounts_id` + `dr_cost_center_id`, grouped, never netted) → Dr bank (`tb_bank_account.chart_of_accounts_id`, `net_received_amount`) → Dr WHT receivable (`gl_setting.wht_receivable_account_id`) → Dr bank charge (`gl_setting.bank_charge_account_id`) → Cr AR groups (invoice / debit-note / deposit lines at the **invoice** rate, each line's `dr_chart_of_accounts_id`) → Cr customer advance (`gl_setting.customer_advance_account_id`, `unapplied`) → FX leg in base currency rate 1 (`realized_fx_loss_account_id` Dr when `< 0`, `realized_fx_gain_account_id` Cr when `> 0`). A missing setting account → `GL_SETTING_ACCOUNT_MISSING { key }` only when its leg is non-zero. **No VAT legs.** WHT never uses the tax profile's own account.
- **Allocation:** API takes invoice-level `{ ar_invoice_id, applied_amount }` (positive magnitude); writer splits per line pro-rata by *available* unpaid (`unpaid − reservations by other draft/in_review receipts`), `round2` per line, the last line by `sequence_no` takes the remainder, each ≤ available. Eligible lines: header `posted`, one customer and one currency across lines (`AR_CUSTOMER_CURRENCY_MISMATCH`), sign rule (CN negative), CN header reservation ≤ header `outstanding_amount`. Bank account currency ∈ {receipt currency, base} (`AR_RECEIPT_BANK_CURRENCY_MISMATCH`). Post re-locks lines (invoice header ids sorted, then detail ids) and re-validates.
- **Post order** (copy `ap-payment.posting.ts:216-251`): period open (`receipt_date`, regular period) → lock lines → `recheckAllocations` → build JV → `subledger.postFromSource` → `adjustUnpaid(reduce)` on `tb_ar_invoice_detail.unpaid_amount` / `base_unpaid_amount` (credit-note lines reduce by `abs`) + recompute each invoice's `outstanding_amount` via `ArInvoicePosting.recomputeOutstanding` → TXRC row when `is_tax_invoice` → mark posted. Void: period (now) → lock → `reverseBySource` → `adjustUnpaid(restore)` from the stored detail amounts → recompute outstanding → TXRC `tax_status = void` → status void + `void_gl_jv_id`. `runAtomic` **commits** a returned error Result; use `abortWith` for any failure after a write.
- **TXRC:** `tb_ar_tax_invoice` with `ar_receipt_id`, `tax_prefix 'TXRC'`, number via running-code `TX-RC`, customer snapshot from `info.tax_entity` (tax id 13 digits, branch 5 digits validated at submit), `base_amount = base_total_applied_amount`, `vat_rate 0`, `vat_amount 0`, `total_amount = base_amount`, filing month/year from the tax date; unique violation → abort `AR_TAX_INVOICE_NO_CONFLICT`.
- **Numbering:** create → `nextDraftNo(tx, 'ar_receipt_running_no', userId)` (`AR_RECEIPT_RUNNING_NO_KEY`); the real number (`AR-RC`, `ARRC` + `yyMM` + 4-digit running, series `tb_ar_receipt.doc_no`, date `receipt_date`) is reserved at the first submit, in the transaction that moves the document out of draft, only when `isDraftNo(doc_no)`, **after** the guarded lock succeeds and **before** `loadFull` / validation / `postInTx`. Soft-delete only when `draft` **and** `isDraftNo(doc_no)`; numbered draft → `AR_RECEIPT_NUMBERED_VOID_ONLY`. Draft void / posted void need a reason (`AR_RECEIPT_VOID_REASON_REQUIRED`).
- **Phase B rules:** one active `ar_receipt` workflow per BU (advisory lock `hashtext('tb_workflow:ar_receipt')`, `WORKFLOW_SINGLE_ACTIVE_EXISTS`); reject = void whole receipt from `in_review` (reason required non-empty after trim → `AR_RECEIPT_REJECT_REASON_REQUIRED`, stored in `void_reason` and on the `rejected` history entry); send back validated against `getPreviousStages` (`WORKFLOW_SENDBACK_STAGE_INVALID`), first stage → `draft`, else `in_review`, note on the history entry; creator cannot approve unless BU key **`ar.receipt.allow-creator-approve`** is `true`/`'true'` (absent = false), reject / send back unaffected; submit re-resolves the active workflow (not a stale `doc.workflow_id`); an `in_review` receipt acts on its stored `workflow_id`; `buildReviewWorkflow` must NOT gain return fields; routing amount = `base_net_received_amount`; no cash exemption.
- Logic-layer errors are returned as `Result`, never thrown. A field missing from the gateway `@Serialize` schema is silently dropped — add every new response field to **both** the MB serializer and the gateway schema.
- **New gl_setting keys:** `wht_receivable_account_id`, `bank_charge_account_id`, `customer_advance_account_id` (optional uuid; JSON, no migration).
- **New catalog codes** (module `AR_RECEIPT = 627`, EN+TH, http in parentheses): `AR_RECEIPT_NOT_FOUND` (404) "Receipt not found" / "ไม่พบใบรับเงิน"; `AR_RECEIPT_IMMUTABLE` (409) "Receipt cannot be changed in its current status" / "ใบรับเงินแก้ไขไม่ได้ในสถานะปัจจุบัน"; `AR_RECEIPT_OVER_ALLOCATED` (422) "Applied amount exceeds the available amount on {doc_no}, or allocations exceed what was received" / "ยอดที่ตัดเกินยอดคงเหลือของ {doc_no} หรือยอดตัดเกินยอดที่รับ"; `AR_RECEIPT_EMPTY` (422) "Receipt has nothing to settle or receive" / "ใบรับเงินไม่มียอดให้ตัดหรือรับ"; `AR_RECEIPT_BANK_CURRENCY_MISMATCH` (422) "Bank account currency must match the receipt or base currency" / "สกุลเงินบัญชีธนาคารต้องตรงกับใบรับเงินหรือสกุลฐาน"; `AR_RECEIPT_INVOICE_NOT_POSTED` (422) "{doc_no} is not posted" / "{doc_no} ยังไม่ได้ post"; `AR_RECEIPT_WHT_INVALID` (422) "Withholding tax exceeds the amount settled or its profile is invalid" / "ภาษีหัก ณ ที่จ่ายเกินยอดที่ตัดหรือ profile ไม่ถูกต้อง"; `AR_RECEIPT_VOID_REASON_REQUIRED` (422) "A reason is required to void this receipt" / "ต้องระบุเหตุผลในการยกเลิกใบรับเงิน"; `AR_RECEIPT_NUMBERED_VOID_ONLY` (422) "This receipt already has a document number and can only be voided" / "ใบรับเงินนี้ออกเลขที่เอกสารแล้ว จึงทำได้เพียงยกเลิก (void) เท่านั้น"; Phase B adds `AR_RECEIPT_REJECT_REASON_REQUIRED` (422) "A reason is required to reject this document" / "ต้องระบุเหตุผลในการปฏิเสธเอกสารนี้". Reused as-is: `AR_CUSTOMER_CURRENCY_MISMATCH`, `AR_TAX_INVOICE_NO_CONFLICT`, `GL_SETTING_ACCOUNT_MISSING`, `GL_PERIOD_NOT_OPEN`, `BANK_ACCOUNT_NOT_FOUND`, `AR_ACCOUNT_NOT_POSTABLE`, `WORKFLOW_*`.
- **api_names** (allowlist, else users get logged out). Phase A: `ar-receipt.findAll`, `ar-receipt.findOne`, `ar-receipt.create`, `ar-receipt.update`, `ar-receipt.delete`, `ar-receipt.submit`, `ar-receipt.void`, `ar-receipt.outstandingInvoices`. Phase B: `ar-receipt.approve`, `ar-receipt.review`, `ar-receipt.reject`, `workflow.findAllArReceipt` (previous-stages reuses `ar-receipt.findOne`).
- **Migrations:** Phase A `ar_receipt_foundation` (one file); Phase B `ar_receipt_workflow_type` (`ALTER TYPE "enum_workflow_type" ADD VALUE 'ar_receipt';` alone in its own file). Timestamps after `20261124100000_draft_no_standard`.
- **Deploy order:** migrations (all tenant schemas) → BE micro-business + gateway together → allowlist every new api_name above → set the three new gl_setting accounts per BU → FE.
- FE: Thai UI strings through i18n (en + th), ICU messages must not contain `{{ }}` or `<word>`; module boundary and design-system rules in `CLAUDE.md` apply (UI primitives from `components/ui/`, status-ink tokens, both themes); the mock's localStorage key `carmen.ar.receipt-mock.v1.<bu>` is simply no longer read; license: reuse `accounting.ar`, no new key.

## Review Focus

1. **Balance of the JV** in document and base currency for every mix: invoice + CN + WHT + charge + overpayment + FX (same currency, different rate); the bank-leg base plug; zero-bank (CN-netting) receipt. Tasks 5, 8.
2. **Pro-rata split** sums exactly to the invoice-level amount, never exceeds a line's available amount, handles credit-note sign and a one-line / many-line document. Task 5.
3. **Over-collection race**: two receipts (drafts or one posted) on the same line; reservation sums exclude the receipt being edited; post re-locks and re-validates. Tasks 6, 8.
4. **Posted with the placeholder number** — a draft submitted directly must have the real `ARRC` number on the JV description, TXRC source and every response. Task 9.
5. **Void restores exactly** the stored per-line amounts (incl. credit-note rows and `base_applied_at_invoice_rate`) and the invoice `outstanding_amount`; void is refused when the period is closed. Task 8.
6. **WHT account** is `gl_setting.wht_receivable_account_id`, never the tax profile's payable account. Tasks 6, 7.
7. **Gateway serializer parity** (`allowed_actions`, `total_unapplied_amount`, `doc_source`). Tasks 9, 11, 22.
8. **Creator is the only approver of a stage** with the flag off → refused with `WORKFLOW_CREATOR_CANNOT_APPROVE`, `allowed_actions` lacks `approve`, page shows no Approve. Tasks 22, 27.
9. **Send back to an approval stage, then that approver approves**; a later stage is refused. Task 22.
10. **Two admins activate an AR Receipt workflow at once** — exactly one wins. Task 21.

---

# Phase A — real backend + GL posting

## Backend (`carmen-turborepo-backend`, MB = `apps/micro-business/src`, GW = `apps/backend-gateway/src`)

### Task 1: Schema — receipt source, unapplied columns, migration

**Files:**
- Modify: `packages/prisma-shared-schema-tenant/prisma/schema.prisma` (`tb_ar_receipt` ~L7913: add `doc_source`, `source_doc_ref`, `total_unapplied_amount`, `base_total_unapplied_amount`; new `enum_ar_receipt_source`; fix the `net_received_amount` and `tb_ar_receipt_wht.chart_of_accounts_id` comments)
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261125100000_ar_receipt_foundation/migration.sql`

**Interfaces — Produces:**
- `enum enum_ar_receipt_source { manual copy interface }`; `tb_ar_receipt.doc_source enum_ar_receipt_source @default(manual)`, `source_doc_ref String? @db.VarChar(100)`, `total_unapplied_amount Decimal @default(0) @db.Decimal(20, 5)`, `base_total_unapplied_amount Decimal @default(0) @db.Decimal(20, 5)`.
- Migration SQL: `CREATE TYPE "enum_ar_receipt_source" AS ENUM (...)`, `ALTER TABLE "tb_ar_receipt" ADD COLUMN …` (use the same schema-qualification / style as `20261124100000_draft_no_standard` and the neighbouring tenant migrations; no data backfill — the table is empty).

- [ ] **Step 1:** Read the two latest tenant migrations for the per-tenant-schema style; write the schema edits and the migration.
- [ ] **Step 2:** `cd packages/prisma-shared-schema-tenant && bunx prisma format && bunx prisma validate`; regenerate the client the way the package documents (`bun run build` / `bunx prisma generate` — see its `package.json`; prisma `dist` must be rebuilt so apps see the new fields).
- [ ] **Step 3:** Root `bun run check-types` (only the new fields can break existing code — `tb_ar_receipt` has no users except enrichment/payment-type counts).
- [ ] **Step 4:** Commit `feat(ar-receipt): migration เพิ่ม doc_source, source_doc_ref และยอดเกิน (unapplied) ของใบรับเงิน`.

### Task 2: gl_setting keys + subledger ref type

**Files:**
- Modify: `MB/app-config/app-config.service.ts` (`GlSettingSchema` ~L129-151: add three `z.string().uuid().optional()` keys under an "AR receipt accounts" comment)
- Modify: `MB/gl/gl-posting/gl-posting.service.ts` (`GlSetting` interface ~L92-112: same three optional strings)
- Modify: `MB/gl/gl-subledger-posting/interface/gl-subledger-posting.interface.ts` (`SubledgerSourceRefType` += `'ar_receipt'`)

**Interfaces — Produces:** `GlSetting.wht_receivable_account_id | bank_charge_account_id | customer_advance_account_id`; `SubledgerSourceRefType` includes `'ar_receipt'`.

- [ ] **Step 1:** Add the keys/type. grep `source_ref_type` / `SubledgerSourceRefType` for any exhaustive switch or `Record<SubledgerSourceRefType, …>` that the new member would break and update it (note in report).
- [ ] **Step 2:** `bunx tsc --noEmit` (MB); `bunx jest src/app-config src/gl` → pass (update an existing app-config spec only if it enumerates the keys).
- [ ] **Step 3:** Commit `feat(gl-setting): คีย์บัญชีของใบรับเงิน (WHT receivable, ค่าธรรมเนียมธนาคาร, เงินรับล่วงหน้าลูกค้า)`.

### Task 3: Error codes

**Files:**
- Modify: `packages/error-catalog/src/module.ts` (`AR_RECEIPT: 627`; verify 627 is free)
- Modify: `packages/error-catalog/src/catalog.ts` (new `// ---- AR receipt ----` block after the AR invoice block, ids `makeId(MODULE.AR_RECEIPT, n)` in the order listed in Global Constraints; **Phase A codes only** — `AR_RECEIPT_REJECT_REASON_REQUIRED` comes in Task 20); rebuild (`bun run build` in `packages/error-catalog`) so `dist/` and `reference/error-codes.*` match

**Interfaces — Produces:** the nine Phase A catalog codes with the EN/TH text and http statuses from Global Constraints.

- [ ] **Step 1:** Add module + codes (messages verbatim, `{doc_no}` placeholders).
- [ ] **Step 2:** Rebuild the package; `bunx tsc --noEmit` (MB + GW).
- [ ] **Step 3:** Commit `feat(error-catalog): error code ของใบรับเงิน AR`.

### Task 4: Running codes — ARRC / TXRC and numbering helpers

**Files:**
- Modify: `MB/master/running-code/const/running-code.const.ts` and `MB/procurement/const/procurement.const.ts` (mirrored presets: `'AR-RC': { config: { A: 'ARRC', B: date('yyMM'), C: running(4,'0'), format: '{A}{B}{C}' } }`, `'TX-RC'` with `TXRC` — copy the exact object style of `'AR-IV'` / `'TX-IV'`)
- Create: `MB/ar/ar-receipt/ar-receipt.running-code.ts`

**Interfaces — Produces:**
- `export const AR_RECEIPT_RUNNING_NO_KEY = 'ar_receipt_running_no'`
- `generateArReceiptNo(params: { prisma: Prisma.TransactionClient; buCode: string; docDate: Date }): Promise<string>` — `reserveDocumentNumbers({ tx, type: 'AR-RC', docDate, series: { table: 'tb_ar_receipt', column: 'doc_no' }, bu_code })` (copy `ap-payment.running-code.ts`).
- `generateTxrcNo(params: same): Promise<string>` — type `TX-RC`, series `{ table: 'tb_ar_tax_invoice', column: 'tax_invoice_no' }` (copy `generateArTaxInvoiceNo`).

- [ ] **Step 1:** Presets in both constants (they must carry identical keys — see the comment in `procurement.const.ts`); the helper file.
- [ ] **Step 2:** Read-only check, note in report: `CommonLogic.getRunningPattern` falls back to the constant when the running-code service has no row; confirm no seed/migration is needed for a new type (compare with how `AR-IV` was added in commit `1b7d01c28`).
- [ ] **Step 3:** `bunx tsc --noEmit` (MB); `bunx jest src/master/running-code` → pass.
- [ ] **Step 4:** Commit `feat(ar-receipt): running code ARRC และ TXRC`.

### Task 5: Pure logic — allocation split, totals, JV lines

**Files:**
- Create: `MB/ar/ar-receipt/ar-receipt.logic.ts`
- Create: `MB/ar/ar-receipt/interface/ar-receipt.interface.ts` (input DTO types: `ICreateArReceipt`, `IUpdateArReceipt`, `IArReceiptAllocationInput`, `IArReceiptWhtInput`, `IArReceiptOutstandingLine`)

**Interfaces:**
- Consumes: pattern of `ap-payment.logic.ts` (`IAllocationLine`, `baseAtInvoiceRate`, `computePaymentTotals`, `buildPaymentJvLines`); `round2`; `ISubledgerPostingLine`.
- Produces (all pure, no DB):
  - `interface IReceiptLine { ar_invoice_id; ar_invoice_detail_id; doc_no; doc_type; sequence_no; dr_chart_of_accounts_id; dr_cost_center_id; invoice_exchange_rate; unpaid_amount; base_unpaid_amount; available_amount; applied_amount /* signed */ }`
  - `baseAtInvoiceRate(l: IReceiptLine): Decimal` (copy of the AP function incl. the whole-line rule)
  - `allocateProRata(lines: { id; available: Decimal; sequence_no: number }[], amount: Decimal): Map<string, Decimal> | null` — null when `amount > Σ available`; `round2` per line, remainder to the highest `sequence_no`, no line above its available amount (redistribute a clipped remainder to earlier lines, deterministic)
  - `computeReceiptTotals(lines, wht: { wht_amount }[], chargeAmount, netReceived, rate): IReceiptTotals { total_applied, base_applied_at_invoice, base_applied_at_receipt, total_wht, base_total_wht, total_charge, base_total_charge, net_received, base_net_received, total_unapplied, base_total_unapplied, realized_fx_amount }` implementing the Global Constraints formulas
  - `buildReceiptJvLines(ctx: { currency_id; exchange_rate; base_currency_id; bank_account_coa_id; wht_receivable_account_id; bank_charge_account_id; customer_advance_account_id; fx_gain_account_id; fx_loss_account_id }, lines, totals): ISubledgerPostingLine[]` — leg order and rules from Global Constraints; descriptions `AR settlement`, `AR settlement (credit note)`, `Bank`, `WHT`, `Bank charge`, `Customer advance`, `Realized FX on receipt`.

- [ ] **Step 1:** Types + `allocateProRata` + `baseAtInvoiceRate` + totals.
- [ ] **Step 2:** `buildReceiptJvLines`. Self-check by reasoning (no new test file): Σ debit = Σ credit in document and in base for (a) one invoice, exact; (b) invoice + CN + WHT + charge; (c) overpayment; (d) rate differs from invoice rate (gain and loss); (e) `net_received = 0`. Note the cases checked in the report.
- [ ] **Step 3:** `bunx tsc --noEmit` (MB); lint the two files (`bunx eslint`).
- [ ] **Step 4:** Commit `feat(ar-receipt): logic ตัดยอดตามสัดส่วนบรรทัด ยอดรวม และบรรทัด JV ของใบรับเงิน`.

### Task 6: Validation — allocation lines, header refs, WHT

**Files:**
- Create: `MB/ar/ar-receipt/ar-receipt.validation.ts`

**Interfaces:**
- Consumes: Task 5 types; copy structure of `ap-payment.validation.ts` (`loadAllocationLines` L208-308, `validateApPaymentRefs` L404-430); catalog codes from Task 3.
- Produces:
  - `loadReceiptLines(db, allocations: IArReceiptAllocationInput[], excludeReceiptId: string | null): Promise<Result<IReceiptLine[]>>` — loads the **posted** lines of each `ar_invoice_id` (include header: `doc_no, doc_type, doc_status, customer_id, currency_id, exchange_rate, outstanding_amount`), reservation sums (`tb_ar_receipt_detail` groupBy line where receipt `doc_status in (draft, in_review)`, `deleted_at null`, excluding `excludeReceiptId`; CN header-level reservation sum), errors `AR_RECEIPT_INVOICE_NOT_POSTED`, `AR_RECEIPT_OVER_ALLOCATED`, `AR_CUSTOMER_CURRENCY_MISMATCH` (customer/currency not uniform), duplicate invoice ids; then splits each allocation with `allocateProRata` into lines (sign by doc type); empty allocations → `Result.ok([])`.
  - `validateReceiptTotals(totals): Result<true>` — the Global Constraints rejections (`AR_RECEIPT_OVER_ALLOCATED` for `unapplied < 0` / negative applied, `AR_RECEIPT_EMPTY`, `AR_RECEIPT_WHT_INVALID` for wht > Σ positive applied).
  - `validateReceiptRefs(db, { customer_id, bank_account_id, currency_id, base_currency_id, wht: IArReceiptWhtInput[] }): Promise<Result<{ customer; bankAccount; whtProfiles: Map }>>` — customer active; bank account active (`BANK_ACCOUNT_NOT_FOUND`), currency ∈ {receipt, base} (`AR_RECEIPT_BANK_CURRENCY_MISMATCH`); every WHT profile exists, active, `tax_type = wht` (`AR_RECEIPT_WHT_INVALID`); tax-entity digits (13 / 5) when `is_tax_invoice` is validated by the service (Task 9), not here.

- [ ] **Step 1:** `loadReceiptLines` (the biggest piece — copy the AP reservation logic, adapting field names `ap_*` → `ar_*`, `cr_*` → `dr_*`).
- [ ] **Step 2:** `validateReceiptTotals`, `validateReceiptRefs`.
- [ ] **Step 3:** `bunx tsc --noEmit` (MB); `bunx eslint` on the file.
- [ ] **Step 4:** Commit `feat(ar-receipt): ตรวจบรรทัดที่ตัด การจองยอด ธนาคาร และ WHT ของใบรับเงิน`.

### Task 7: Writer + serializer

**Files:**
- Create: `MB/ar/ar-receipt/ar-receipt.writer.ts`
- Create: `MB/ar/ar-receipt/dto/ar-receipt.serializer.ts`

**Interfaces:**
- Consumes: Tasks 4-6; pattern of `ap-payment.writer.ts` (`writeDocument`, `headerData`, `createHeader`, `replaceHeader`, `buildPaymentChildRows`) and `dto/ap-payment.serializer.ts`.
- Produces:
  - `class ArReceiptWriter { writeDocument(tx, ctx: IWriteReceiptContext, input): Promise<Result<{ id; doc_no }>> }` — create: header with `doc_no = await nextDraftNo(tx, AR_RECEIPT_RUNNING_NO_KEY, userId)`, `doc_status draft`, `doc_source`, customer + bank snapshots (code/name), currency + base currency snapshot, totals (incl. `total_unapplied_amount`, `base_*`), `info` (`tender`, `tax_entity`); update: guarded replace of header + **all** child rows (`tb_ar_receipt_detail`, `tb_ar_receipt_wht`) in one transaction; detail rows carry `doc_type`, signed `applied_amount`, `invoice_exchange_rate`, `base_applied_at_invoice_rate`, `base_applied_at_receipt_rate = round2(applied × rate)`, per-line `realized_fx_amount` (`base_applied_at_receipt_rate − base_applied_at_invoice_rate`); WHT rows: profile snapshot (name, `pnd_form`, `income_type`), `wht_rate = profile.tax_rate`, `wht_amount` (computed or override → `is_override`), `chart_of_accounts_id = gl_setting.wht_receivable_account_id` (error `GL_SETTING_ACCOUNT_MISSING` at **post**, so at write time store the setting value when present and re-resolve at post — mirror the AP writer's "cannot be written without an account" comment and choose the same behaviour the AP writer has for a missing default).
  - `ArReceiptSerializer` zod schema: all header fields incl. `doc_source`, `source_doc_ref`, `total_unapplied_amount`, `base_total_unapplied_amount`, `info`, `workflow_*`, `user_action`, `gl_jv_id/no`, `void_*`; `tb_ar_receipt_detail[]`, `tb_ar_receipt_wht[]`, `tb_ar_tax_invoice` (id, number, status); `allowed_actions` is added in Task 23.

- [ ] **Step 1:** Writer (create + replace); WHT row builder.
- [ ] **Step 2:** Serializer.
- [ ] **Step 3:** `bunx tsc --noEmit` (MB); `bunx eslint` on both files.
- [ ] **Step 4:** Commit `feat(ar-receipt): writer และ serializer ของใบรับเงิน (เลข DRAFT ตอนสร้าง)`.

### Task 8: Posting — post, void, TXRC, unpaid adjustment

**Files:**
- Create: `MB/ar/ar-receipt/ar-receipt.posting.ts`

**Interfaces:**
- Consumes: Tasks 2-7; `GlSubledgerPostingService.postFromSource` / `reverseBySource` / `requireSettingAccount`; `GlPostingService.getSetting`; `ArInvoicePosting.recomputeOutstanding` (verify `ArInvoiceModule` exports it, add to `exports` if not); `tenantTableRef`; `abortWith`; template `ap-payment.posting.ts` (whole file).
- Produces: `class ArReceiptPosting extends TenantScopedService` with
  - `isPeriodOpen(db, date): Promise<boolean>` (copy)
  - `lockLines(tx, refs)` — invoice headers then detail rows, ids sorted, `FOR UPDATE` via `tenantTableRef(this.prismaService, …)`
  - `recheckLines(tx, receipt): Promise<Result<IReceiptLine[]>>` — lock → `loadReceiptLines(tx, allocations rebuilt from stored detail, receipt.id)` → drift check on `invoice_exchange_rate` / `baseAtInvoiceRate` vs stored → `AR_RECEIPT_IMMUTABLE`
  - `postInTx(tx, receipt: ArReceiptFull, userId): Promise<Result<{ id; doc_status; gl_jv_no }>>` — post order from Global Constraints; JV context accounts via `requireSettingAccount` only for non-zero legs; header totals must equal recomputed totals else `AR_RECEIPT_IMMUTABLE`; TXRC via private `issueTxrc` (snapshot from `receipt.info.tax_entity`)
  - `voidPostedInTx(tx, receipt, reason, userId): Promise<Result<{ id; doc_status }>>` — Global Constraints void order
  - private `adjustUnpaid(tx, settlements, 'reduce' | 'restore', userId)`, `markPosted`.
  - `ArReceiptFull` type + `AR_RECEIPT_FULL_INCLUDE` live in the service (Task 9); import the type from there or define a shared `interface` — avoid a circular import by putting both in `ar-receipt.interface.ts`.

- [ ] **Step 1:** Port `ap-payment.posting.ts` to AR (rename, `dr_*`, sign mirrors, TXRC, void).
- [ ] **Step 2:** Re-read the file once asking: after the first write inside `postInTx`, is every failure an `abortWith`? Is the lock order invoice → detail → GL advisory lock the same in post and void? Note the answers in the report (Review Focus 3, 5).
- [ ] **Step 3:** `bunx tsc --noEmit` (MB); `bunx eslint` on the file.
- [ ] **Step 4:** Commit `feat(ar-receipt): post/void ใบรับเงิน — JV, ลดยอดค้าง invoice, ใบกำกับ TXRC`.

### Task 9: Service — CRUD, submit, void, outstanding invoices, numbering

**Files:**
- Create: `MB/ar/ar-receipt/ar-receipt.service.ts`
- Create: `MB/ar/ar-receipt/ar-receipt.module.ts`
- Modify: `MB/app.module.ts` (import + register `ArReceiptModule` next to `ArInvoiceModule`, ~L127 / L446)
- Modify (if needed): `MB/ar/ar-invoice/ar-invoice.module.ts` (export `ArInvoicePosting`)

**Interfaces:**
- Consumes: Tasks 4-8; template `ap-payment.service.ts` (`findOne/findAll/create/update/delete/submit/void/loadForAction/guardedUpdate/postDocument/withRealDocNo/voidDraft/voidPosted/buildContext/resolveBaseCurrency/resolveRate` — read all, copy structure); `nextDraftNo`/`isDraftNo`; `ArInvoice` `resolveRate` approach for the default rate.
- Produces: `export const AR_RECEIPT_FULL_INCLUDE`, `ArReceiptFull`, `class ArReceiptService` (`findOne(id)`, `findAll(paginate)` incl. `doc_status`/customer/date filters + search on `doc_no`/`customer_name`, `create(data)`, `update(id, data)`, `delete(id)`, `submit(id, { doc_version })`, `void(id, { reason, doc_version })`, `outstandingInvoices(customerId, currencyId?)`).
  - `create`/`update`: only `draft`; resolve refs (Task 6), customer/bank/currency/base currency, rate (`data.exchange_rate` else the rate for `receipt_date`), lines via `loadReceiptLines`, totals via `computeReceiptTotals`, `validateReceiptTotals`, tax-entity digit check when `is_tax_invoice`; writer writes; return `{ id, doc_no }` (placeholder).
  - `submit`: draft only → period open → `postDocument` (Phase A: always direct). `postDocument` = `runAtomic`: `guardedUpdate` lock → **`withRealDocNo(tx, id)`** (loadFull; when `isDraftNo(doc_no)` persist `generateArReceiptNo({ prisma: tx, buCode, docDate: receipt_date })`) → `posting.postInTx` — number reserved after the lock succeeded and before validation/post (Global Constraints). Result includes `doc_no`.
  - `delete`: `draft` and `isDraftNo(doc_no)` else `AR_RECEIPT_NUMBERED_VOID_ONLY` (numbered draft) / `AR_RECEIPT_IMMUTABLE`.
  - `void`: reason required (`AR_RECEIPT_VOID_REASON_REQUIRED`); `draft` → bookkeeping void (guarded single update, no JV); `posted` → `voidPostedInTx`; other → `AR_RECEIPT_IMMUTABLE`.
  - `outstandingInvoices`: posted invoice/DN/CN headers of the customer with `outstanding_amount > 0` and per-line `available_amount` (unpaid − draft/in_review reservations), `doc_no`, `doc_type`, `doc_date`, `currency`, `exchange_rate`, header totals (net/vat/total for the FE WHT suggestion), sorted by date.

- [ ] **Step 1:** Skeleton, include, `findOne`/`findAll`/`outstandingInvoices`.
- [ ] **Step 2:** `create`/`update`/`delete` with header resolution and validation.
- [ ] **Step 3:** `submit`/`postDocument`/`withRealDocNo`/`void`/`voidDraft`/`voidPosted`.
- [ ] **Step 4:** Read-only checks, note in report: (a) `reserveDocumentNumbers` derives from the `ARRC…` prefix so `DRAFT-…` rows never affect the series; (b) nothing else (report queries, period-end, AR invoice code) assumes `tb_ar_receipt.doc_no` format; (c) the invoice-void guard `checkNoLiveReceipt` still sees the new rows.
- [ ] **Step 5:** `bunx tsc --noEmit` (MB); `bunx jest src/ar src/ap/ap-payment` → pass; `bunx eslint` on the new files.
- [ ] **Step 6:** Commit `feat(ar-receipt): service ใบรับเงิน — สร้าง/แก้/ลบ/submit/void, เลข ARRC ตอน submit และรายการ invoice ค้างรับ`.

### Task 10: Micro-business controller + RPC contract

**Files:**
- Create: `MB/ar/ar-receipt/ar-receipt.controller.ts`
- Create: `packages/rpc-contract/src/contracts/ar-receipt.ts` (generated — follow the 3-step process in the header of an existing contract file; rebuild `rpc-contract` if the package has a build)
- Modify: `packages/rpc-contract/src/index.ts` or registry file if contracts are listed there (check how `ArInvoice`/`ApPayment` are exported)

**Interfaces — Produces:** contract `ArReceipt = defineService('ar-receipt', { create, delete, findAll, findOne, outstandingInvoices, submit, update, void })` → patterns `ar-receipt.create`, … ; `.rest('POST', '/ar-receipt')` etc. for the CRUD/action routes and `.restTodo()` for `outstandingInvoices` (as `ApPayment`); MB controller `@MessagePattern(ArReceipt.<x>.pattern)` handlers passing `user_id`/`bu_code` to the tenant-scoped service exactly like `ap-payment.controller.ts`.

- [ ] **Step 1:** Write handlers with temporary `@MessagePattern({ cmd, service })` literals; run `bun run gen:rpc-contract`; replace literals with the generated references.
- [ ] **Step 2:** `bunx tsc --noEmit` (MB, rpc-contract).
- [ ] **Step 3:** Commit `feat(ar-receipt): controller micro-business และ rpc contract ของใบรับเงิน`.

### Task 11: Gateway — REST endpoints, swagger, module, api catalog

**Files:**
- Create: `GW/application/ar-receipt/ar-receipt.controller.ts`, `ar-receipt.service.ts`, `ar-receipt.module.ts`, `swagger/request.ts`, `swagger/response.ts` (templates: `GW/application/ap-payment/*`)
- Modify: `GW/application/route-application.ts` (import + register `ArReceiptModule` next to `ArInvoiceModule`)
- Modify: `GW/backstage/applications/app-api-catalog.generated.ts` via `bun run scripts/generate-app-api-catalog/run.ts`; if a seed-grant file in `packages/prisma-shared-schema-backstage/prisma/` lists api_names (check where `ar-invoice.findAll` is seeded — the AR invoice PR is the precedent), add the eight names there too

**Interfaces — Produces:** routes under the same prefix as ap-payment (`:bu_code/ar-receipt`): `GET outstanding-invoices?customer_id&currency_id` (`AppIdGuard('ar-receipt.outstandingInvoices')`, declared **before** `:ar_receipt_id`), `GET` list (`findAll`), `GET :ar_receipt_id` (`findOne`), `POST` (`create`), `PUT :ar_receipt_id` (`update`), `DELETE :ar_receipt_id` (`delete`), `POST :ar_receipt_id/submit` (`submit`), `POST :ar_receipt_id/void` (`void`, body `{ reason, doc_version }`). Request DTO zod: header fields, `allocations[]`, `wht[]`, `net_received_amount`, `charge_amount`, `info`, `doc_source` (`manual|copy` only from API; `interface` is not client-settable). Response schema = `ArReceiptSerializer` plus list shape; `ParseUUIDPipe` on ids; decorators identical to the AP payment handlers.

- [ ] **Step 1:** Controller/service/module/swagger.
- [ ] **Step 2:** Register module; regenerate the api catalog; seed grants if applicable.
- [ ] **Step 3:** `bunx tsc --noEmit` (GW); `bunx jest src/application/ar-receipt` (only if specs exist) and `bun run audit:app-api-catalog-drift` → pass.
- [ ] **Step 4:** Commit `feat(ar-receipt): endpoint gateway ของใบรับเงิน และ api catalog`.

### Task 12: Backend check + PR (Phase A)

- [ ] **Step 1:** Root `bun run check-types`; `cd apps/micro-business && bunx jest`; gateway jest — compare with the base failure list (gateway has known pre-existing failures), no new failures.
- [ ] **Step 2:** **Ask the user before pushing.** PR (English), base `main`: summary, deploy order (migration → BE MB+GW together → allowlist the eight Phase A api_names → set `wht_receivable_account_id` / `bank_charge_account_id` / `customer_advance_account_id` per BU → FE), new error codes, the three gl_setting keys, `net_received_amount` redefinition, note that no workflow exists yet (submit posts directly), preflight SQL (none needed — no receipt rows exist).

## Frontend (`carmen-frontend`)

### Task 13: Receipt data layer — endpoints, query keys, hooks

**Files:**
- Modify: `constant/api-endpoints.ts` (`AR_RECEIPT_LIST(bu)`, `AR_RECEIPT_OUTSTANDING_INVOICES(bu)`; detail/actions are built from the list URL like `AR_INVOICE_LIST` — check how), `constant/query-keys.ts` or wherever `QUERY_KEYS.AR_INVOICE_*` live
- Create: `routes/accounting/accounts-receivable/use-ar-receipt.ts`

**Interfaces — Produces:**
- Types `ArReceiptRow`, `ArReceiptDocument` (header + `tb_ar_receipt_detail[]`, `tb_ar_receipt_wht[]`, `tb_ar_tax_invoice`, `total_unapplied_amount`, `doc_source`, `source_doc_ref`, `allowed_actions?` (optional until Phase B), `workflow_*`), `ArReceiptPayload` (matches the gateway request DTO: header, `net_received_amount`, `charge_amount`, `wht[]`, `allocations[{ ar_invoice_id, applied_amount }]`, `info`), `OutstandingInvoice` (+ per-line available).
- Hooks (copy `use-ar-register.ts` patterns): `useArReceipts(params)`, `useArReceiptDocument(id)`, `useCreateArReceipt()`, `useUpdateArReceipt()`, `useDeleteArReceipt()`, `useArReceiptAction()` (`submit | void` now; Phase B adds `approve | review | reject`), `useArOutstandingInvoices(customerId, currencyId?)`; invalidate list + detail + `AR_INVOICE_*` queries after submit/void (invoice outstanding changes).
- Constant `AR_RECEIPT_STATUS = ["draft","in_review","posted","void"] as const`.

- [ ] **Step 1:** Endpoints/keys; types; hooks.
- [ ] **Step 2:** `bun run typecheck`; `bun test:run constant hooks` (only existing) → pass.
- [ ] **Step 3:** Commit `feat(ar-receipt): hook เรียก API ใบรับเงินจริง`.

### Task 14: Receipt model — drop mock storage and multi-payment, add API mapping

**Files:**
- Modify: `routes/accounting/accounts-receivable/ar-receipt-model.ts` (remove `readReceipts / saveReceipt / deleteReceipt / voidReceipt / sampleReceipts` and the localStorage key; `paymentSchema` → single `tender`; remove `creditDays`; `RECEIPT_PAY_TYPES` += `"promptpay"`; statuses from `AR_RECEIPT_STATUS`; keep/adapt `receiptTotals` → `{ applied, wht, charge, settlement, received, unapplied }`, `receiptValidation` (customer required, no duplicate invoice, allocation ≤ outstanding, WHT ≤ allocated, `unapplied ≥ 0`, tax id 13 / branch 5 when tax invoice), `suggestedReceiptWht(profileRate, …)` replacing the hard-coded 3/5/2/1/3 table, `receiptAllocationTax`; new `toArReceiptPayload(form)` and `receiptFromDocument(doc)`)
- Modify (existing test): `routes/accounting/accounts-receivable/ar-receipt-model.test.ts` (rewrite the assertions that touch removed storage / multi-payment; keep the totals/validation ones — edit, do not add a new file)

**Interfaces:** Consumes Task 13 types. Produces the helpers above; `newReceipt(date, currency)` / `newReceiptFromInvoice(...)` return the form shape with `source: "manual"` and `sourceDoc`.

- [ ] **Step 1:** Rewrite the model; keep exported names the pages still use where possible to limit churn in Tasks 15-17.
- [ ] **Step 2:** Update `ar-receipt-model.test.ts`.
- [ ] **Step 3:** `bun run typecheck` (pages will not compile until Tasks 15-17 — if so, do Tasks 14-17 as one working session and run the check at the end of Task 17; say so in the report); `bun test:run routes/accounting/accounts-receivable/ar-receipt-model` → pass.
- [ ] **Step 4:** Commit `refactor(ar-receipt): model ใบรับเงินเลิกใช้ localStorage และหลาย payment, แปลง payload ↔ API`.

### Task 15: Receipt detail page — one tender, WHT profiles, charge, unapplied, real save

**Files:**
- Modify: `routes/accounting/accounts-receivable/ar-receipt-detail.route.tsx` (replace storage calls with `useArReceiptDocument` / create / update / delete / action hooks; form sections: header, **Tender** (bank account picker from the existing bank-account lookup used by AP payment, method, cheque no/date shown for `cheque`, reference, payer name, value date), bank-charge field, WHT (profile picker via `use-tax-profile.ts` filtered to WHT, base, rate read-only from profile, amount editable → override, certificate no/date), allocations table, totals bar with **unapplied** and the "credit is held as customer advance; apply by journal until the follow-up" hint, read-only rate; toolbar: Submit / Delete (only `isDraftDocNo`) / Void (numbered draft, posted); `DRAFT-…` number display; journal tab via `useJournalVoucher(gl_jv_id)` as `ar-invoice-journal.tsx`)
- Modify: `routes/accounting/accounts-receivable/ar-receipt-dialogs.tsx` only for call-site renames needed here (full rework is Task 16)
- Create (component file, not a test): `routes/accounting/accounts-receivable/ar-receipt-journal.tsx` if the journal tab is split out (mirror `ar-invoice-journal.tsx`, ≤ 80 lines)
- Modify: `messages/en.json` + `messages/th.json` (`accounting.arReceipt.*`: tender, charge, unapplied, unappliedHint, wht section labels, statuses `inReview`/`posted`, submit/void/delete confirmations, `rateReadOnlyHint`; `errors.byCode` for the nine Phase A codes + `GL_SETTING_ACCOUNT_MISSING` if absent) — ICU-safe

- [ ] **Step 1:** Wire data hooks and the single-tender form (use `routes/accounting/accounts-payable/payment/ap-payment-header.tsx` / `ap-payment-wht.tsx` as UI reference; do not import across if ESLint blocks — copy the pattern).
- [ ] **Step 2:** Totals/unapplied display, charge, WHT editing, actions and gating (`&& canWrite`), journal tab.
- [ ] **Step 3:** i18n en+th (ICU-safe), both themes, mobile width (no horizontal scroll) — follow skill `carmen-blue-ui-design`; keep the one-primary-button rule.
- [ ] **Step 4:** `bun run typecheck`; `bun test:run routes/accounting/accounts-receivable` (update existing `ar-receipt-ui.test.tsx` assertions broken by the one-tender change — edit only); `bunx eslint` on touched files.
- [ ] **Step 5:** Commit `feat(ar-receipt): หน้าใบรับเงินใช้ API จริง — tender เดียว, WHT จาก tax profile, ค่าธรรมเนียม, ยอดเกิน`.

### Task 16: Invoice picker dialog on the backend lookup; remove the payment dialog

**Files:**
- Modify: `routes/accounting/accounts-receivable/ar-receipt-dialogs.tsx` (keep `ReceiptInvoiceDialog` backed by `useArOutstandingInvoices`: shows doc no/type/date/outstanding/available, multi-select, amount per invoice default = available, currency/customer mismatch blocked client-side too; **delete `ReceiptPaymentDialog`** — replaced by the Tender section)
- Delete: `routes/accounting/accounts-receivable/ar-receipt-payment-dialog.test.tsx` (tests the removed dialog — existing test removed with its subject; state this in the report)
- Modify: `messages/en.json` + `messages/th.json` (picker labels; drop unused payment-dialog keys only if nothing else references them — grep first)

**Interfaces:** Consumes `OutstandingInvoice` (Task 13). Produces `ReceiptInvoiceDialog({ customerId, currency, selectedIds, onAdd })` returning `{ ar_invoice_id, doc_no, doc_type, outstanding, net, vat, total, applied_amount }[]`.

- [ ] **Step 1:** Rework the invoice dialog; remove the payment dialog and its test.
- [ ] **Step 2:** `bun run typecheck`; `bun test:run routes/accounting/accounts-receivable` → pass; eslint.
- [ ] **Step 3:** Commit `feat(ar-receipt): เลือก invoice ที่ค้างรับจาก backend และเอา dialog payment หลายรายการออก`.

### Task 17: Receipt list page on the backend

**Files:**
- Modify: `routes/accounting/accounts-receivable/ar-receipt-list.route.tsx` (use `useArReceipts`; status filter now `draft | in_review | posted | void` with chips; server-side search/sort/pagination like `ar-invoice-list.route.tsx`; `DRAFT-…` numbers; "New" and "New from invoice" entries unchanged; remove localStorage reads)
- Modify: `messages/en.json` + `messages/th.json` (status labels if not added in Task 15)
- Modify (existing tests): `ar-receipt-ui.test.tsx` / `ar-staging-ui.test.tsx` if they assert list behaviour

- [ ] **Step 1:** List on the hook (copy the AR invoice list structure incl. audit columns if present there).
- [ ] **Step 2:** `bun run typecheck`; `bun test:run routes/accounting/accounts-receivable` → pass; eslint.
- [ ] **Step 3:** Commit `feat(ar-receipt): หน้ารายการใบรับเงินดึงจาก backend พร้อมสถานะ in_review/posted`.

### Task 18: Accounting settings — three new GL accounts

**Files:**
- Modify: `routes/accounting/settings/gl-setting-value.ts` (`GL_UUID_FIELDS` += `wht_receivable_account_id`, `bank_charge_account_id`, `customer_advance_account_id`; update the "13" comment to 16)
- Modify: `routes/accounting/settings/accounting-settings-form.tsx` (three `AccountField`s in the "Accounts Receivable" `SettingSection` after `output_vat_account_id`)
- Modify: `messages/en.json` + `messages/th.json` (`fields.whtReceivableAccount`, `fields.bankChargeAccount`, `fields.customerAdvanceAccount`)
- Modify (existing test): any test asserting `GL_UUID_FIELDS` length / the form's field list (grep `gl-setting-value`)

- [ ] **Step 1:** Fields + i18n; the form schema/serialization already iterates `GL_UUID_FIELDS` (verify `toGlSettingValue` / default-form code handles new keys, including clearing = omit key).
- [ ] **Step 2:** `bun run typecheck`; `bun test:run routes/accounting/settings` → pass.
- [ ] **Step 3:** Commit `feat(accounting-settings): ตั้งบัญชี WHT receivable, ค่าธรรมเนียมธนาคาร และเงินรับล่วงหน้าลูกค้า`.

### Task 19: Frontend check + PR (Phase A)

- [ ] **Step 1:** `bun run typecheck`; `bun test:run` → no new failures vs `main`; `SKIP_VERSION_BUMP=1 bun run build`.
- [ ] **Step 2:** **Ask the user before pushing.** PR (English), base `main`: depends on the backend PR; deploy order; the eight allowlist api_names; the three gl_setting accounts must be set per BU before posting; **saved mock receipts (localStorage) are not carried over** — put that sentence in the PR title/body and the commit that feeds What's New (the changelog is generated from commit messages; skill `release-and-deploy`; no squash-merge).

---

# Phase B — approval workflow

## Backend

### Task 20: Workflow type migration, reject code, creator-approve key

**Files:**
- Modify: `packages/prisma-shared-schema-tenant/prisma/schema.prisma` (`enum_workflow_type` += `ar_receipt`)
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261125110000_ar_receipt_workflow_type/migration.sql` — exactly `-- AlterEnum` + `ALTER TYPE "enum_workflow_type" ADD VALUE 'ar_receipt';` and nothing else (cannot share a transaction with statements using the value)
- Modify: `packages/error-catalog/src/catalog.ts` (`AR_RECEIPT_REJECT_REASON_REQUIRED`, next id in `MODULE.AR_RECEIPT`), rebuild package
- Modify: `MB/common/workflow/accounting-doc-workflow.ts` (add `export const AR_RECEIPT_ALLOW_CREATOR_APPROVE_KEY = 'ar.receipt.allow-creator-approve'`)

**Interfaces — Produces:** `enum_workflow_type.ar_receipt`; const `AR_RECEIPT_ALLOW_CREATOR_APPROVE_KEY`; catalog code from Global Constraints.

- [ ] **Step 1:** Edits; regenerate the Prisma client; rebuild error-catalog.
- [ ] **Step 2:** grep for exhaustive `Record<enum_workflow_type, …>` / switches over the enum in MB and GW and extend them (note in report); `bunx tsc --noEmit` (MB + GW); `bunx jest src/common/workflow` → pass.
- [ ] **Step 3:** Commit `feat(workflow): ชนิด workflow ar_receipt, error code และ key ผู้สร้างอนุมัติของใบรับเงิน`.

### Task 21: One active AR Receipt workflow per BU + gateway list endpoint

**Files:**
- Modify: `MB/master/workflows/workflows.service.ts` (add `enum_workflow_type.ar_receipt` to `SINGLE_ACTIVE_WORKFLOW_TYPES`; verify the `create` and `update` branches use the set; also check the structure-lock lookup near L726 lists in-review `ar_receipt` documents — add the case analogous to `ar_invoice`)
- Modify: `GW/config/config_workflows/config_workflows.controller.ts` (`findAllArReceipt` after `findAllArInvoice`: `@Get('ar-receipt')` before any `:workflow_id` route, `AppIdGuard('workflow.findAllArReceipt')`, `findAllByType(enum_workflow_type.ar_receipt, …)`, operationId `configWorkflows_findAllArReceipt`)
- Modify: `GW/backstage/applications/app-api-catalog.generated.ts` via `bun run scripts/generate-app-api-catalog/run.ts` (+ seed grant file if Task 11 found one)
- Modify (existing spec): `MB/master/workflows/workflows.service.spec.ts` only if mocks break

**Interfaces — Produces:** create/activate of an `ar_receipt` workflow checks + writes under `pg_advisory_xact_lock(hashtext('tb_workflow:ar_receipt'))`, conflict → `WORKFLOW_SINGLE_ACTIVE_EXISTS { workflow }`; GW `GET config/:bu_code/workflows/ar-receipt`.

- [ ] **Step 1:** Set + structure lock; gateway handler; regenerate catalog.
- [ ] **Step 2:** `bunx tsc --noEmit` (MB + GW); `bunx jest src/master/workflows`; `bun run audit:app-api-catalog-drift` → pass.
- [ ] **Step 3:** Commit `feat(workflow): ใบรับเงิน AR มี workflow ที่ active ได้เส้นเดียวต่อ BU และ endpoint รายการ`.

### Task 22: Receipt actions — workflow mapper, eligibility, enforcement, reject = void, send back

**Files:**
- Create: `MB/ar/ar-receipt/workflow/ar-receipt-workflow.mapper.ts` (copy `ap-payment-workflow.mapper.ts`; `total_amount = Number(base_net_received_amount ?? 0)`)
- Modify: `MB/ar/ar-receipt/ar-receipt.service.ts` — `submit`, new `approve` / `review` / `reject`, `voidDraft` (gains `from` + `extra`), constructor (inject `TenantService`, `WorkflowOrchestratorService`; `ar-receipt.module.ts` must provide/import them — template `ap-payment.module.ts`), private `assertCanAct(receipt, action)` over `assertCanActOnDocument` with `AR_RECEIPT_ALLOW_CREATOR_APPROVE_KEY`, private `resolveWorkflowId()` (first active `ar_receipt` workflow by `created_at`, as AP Payment), `workflowColumns()` only if the shared helper does not already provide it (prefer the shared helpers; do **not** copy the AP service's duplicated ones)
- Modify: `MB/ar/ar-receipt/ar-receipt.module.ts`

**Interfaces:**
- Consumes: shared helpers `assertCanActOnDocument`, `planSendBack`, `realDocNoPatch`, `withRejectReason`, `isWorkflowEligibleSource`; `workflowOrchestrator.buildSubmitWorkflow / buildApproveWorkflow / buildRejectWorkflow / buildReviewWorkflow / isFirstStage`; template `ap-payment.service.ts:467-640`.
- Produces: `submit`: after the period check, `workflowId = isWorkflowEligibleSource(doc.doc_source) ? await resolveWorkflowId() : null`; null → `postDocument` (direct, Phase A path); else `buildSubmitWorkflow` + `sendToReview` reserving the real number in the same transaction as the move out of draft (`withRealDocNo`, only when `isDraftNo`, after the guarded lock, before validation) and `doc_status = in_review` with the re-resolved workflow id. `approve`/`review`/`reject`: `assertCanAct` right after `loadForAction`. `review`: `stage = data.stage || doc.workflow_previous_stage`, `planSendBack` validates against `getPreviousStages` and builds the history entry with the note; `doc_status = toDraft ? draft : in_review`. `reject`: `reason?.trim()` required (`AR_RECEIPT_REJECT_REASON_REQUIRED`), one guarded update from `in_review` → `void` with `void_at/by/reason` + workflow columns via `withRejectReason(buildRejectWorkflow(...), reason)`, returns `{ id, doc_status: void }`; plain `void` endpoint stays draft/posted only. Final approval posts via `postDocument`.

- [ ] **Step 1:** Mapper + module providers + constructor injection.
- [ ] **Step 2:** `submit` branch and `sendToReview`; `approve` (final approval posts).
- [ ] **Step 3:** `review` (send back) and `reject` (void) with `voidDraft(from, extra)`.
- [ ] **Step 4:** Read-only confirm (Review Focus: no residue): reading `ar-receipt.posting.ts`, no detail/WHT-driven change to any invoice, no JV and no TXRC is written before `postInTx`, so reject needs no extra cleanup; note the result in the report.
- [ ] **Step 5:** `bunx tsc --noEmit` (MB); `bunx jest src/ar src/common/workflow` → pass; eslint on touched files.
- [ ] **Step 6:** Commit `feat(ar-receipt): workflow บังคับสิทธิ์ตาม stage, reject = void ทั้งใบ, send back ตาม stage และกันผู้สร้างอนุมัติเอง`.

### Task 23: Controller + gateway endpoints for approve / review / reject / previous-stages / allowed_actions

**Files:**
- Modify: `packages/rpc-contract/src/contracts/ar-receipt.ts` (add `approve`, `review`, `reject`, `previousStages` (`restTodo`); run `bun run gen:rpc-contract`)
- Modify: `MB/ar/ar-receipt/ar-receipt.controller.ts` (handlers for the four patterns) and `ar-receipt.service.ts` (`getPreviousStages(id)`, `computeAllowedActions`; `findOne` adds `allowed_actions`)
- Modify: `MB/ar/ar-receipt/dto/ar-receipt.serializer.ts` + `GW/application/ar-receipt/swagger/response.ts` (`allowed_actions: ('approve'|'reject'|'sendback')[]` in **both**)
- Modify: `GW/application/ar-receipt/ar-receipt.controller.ts`, `ar-receipt.service.ts`, `swagger/request.ts` (`POST :ar_receipt_id/approve` guard `ar-receipt.approve`, `POST :ar_receipt_id/review` guard `ar-receipt.review` body `{ stage?, reason?, doc_version }`, `POST :ar_receipt_id/reject` guard `ar-receipt.reject` body `{ reason (required), doc_version }`, `GET :ar_receipt_id/previous-stages` guard `ar-receipt.findOne` (reuse → no allowlist change; mind route order vs `outstanding-invoices`))
- Modify: `GW/backstage/applications/app-api-catalog.generated.ts` via the generator

**Interfaces — Produces:** MB `getPreviousStages(id): Promise<Result<Record<string,string>>>` — not found → `AR_RECEIPT_NOT_FOUND`; no workflow/stage → `Result.ok({})`; else `workflowOrchestrator.getPreviousStages(workflow_id, workflow_current_stage, userId, buCode)`. `findOne.allowed_actions` via `computeAllowedActionsFor` — empty unless `in_review`; computed once per `findOne`. The Swagger text of review/reject states "send back to a previous stage" / "void the receipt".

- [ ] **Step 1:** Contract + MB handlers + service methods; `allowed_actions` in both serializers.
- [ ] **Step 2:** Gateway routes + DTOs; regenerate the api catalog.
- [ ] **Step 3:** `bunx tsc --noEmit` (MB + GW); `bunx jest src/ar`; `bun run audit:app-api-catalog-drift` → pass.
- [ ] **Step 4:** Commit `feat(ar-receipt): endpoint approve/review/reject, stage ก่อนหน้า และ allowed_actions`.

### Task 24: Backend check + PR (Phase B)

- [ ] **Step 1:** Root `bun run check-types`; `cd apps/micro-business && bunx jest`; gateway jest — compare with base failures, no new failures.
- [ ] **Step 2:** **Ask the user before pushing.** PR (English), base `main` (or the Phase A branch if it is still unmerged — then retarget after it merges; never `--delete-branch` a base while a PR is stacked on it): summary, deploy order (migration `ar_receipt_workflow_type` → BE MB+GW together → allowlist `ar-receipt.approve`, `ar-receipt.review`, `ar-receipt.reject`, `workflow.findAllArReceipt` → FE), new error code, BU key `ar.receipt.allow-creator-approve`, preflight SQL (active `ar_receipt` workflows per BU ≤ 1 — none exist before this; `in_review` receipts — none).

## Frontend

### Task 25: Workflow admin supports AR Receipt

**Files:**
- Modify: `types/workflows.ts` (`AR_RECEIPT = "ar_receipt"`), `constant/workflow.ts` (`WORKFLOW_CAPS[AR_RECEIPT] = { hasProducts:false, hasJvScope:false, totalOnlyRouting:true, canHidePrice:false }`, `workflowTypeField`, `WF_ROW_TYPE`, `WORKFLOW_TYPES` (`{ label: "AR Receipt", value: WORKFLOW_TYPE.AR_RECEIPT }`), `WF_TYPE_I18N_KEY` → `typeArReceipt`)
- Modify: `routes/system-admin/workflow/wf-role-colors.ts` (`["create","approve"]`), `wf-structure-lock-notice.tsx` (`{ path: "/accounting/accounts-receivable/receipt", status: "doc_status", value: "in_review" }`), `wf-new-form.tsx` (option disabled + hint when an active one exists; locked-slug route `/workflow/ar-receipt/new` blocks submit — follow the AR invoice code), `wf-component.tsx` (`titleArReceipt`)
- Modify: `hooks/use-workflow.ts` (`WORKFLOW_DOC_TYPES` + `"ar-receipt"`, `WORKFLOW_TYPE_BY_DOC_TYPE`, `useArReceiptWorkflows`, `WORKFLOW_LIST_HOOKS`), `constant/module-list.ts` (`workflowArReceipt` → `/system-admin/workflow/ar-receipt`, same `licenseFeature`/permission as `workflowArInvoice` — skill `license-gating`: reuse the existing key, never invent one), System Admin landing card if it lists workflow types
- Modify: `messages/en.json` + `messages/th.json` — `systemAdmin.workflow.typeArReceipt`, `titleArReceipt`, `arReceiptSingleActiveHint` (use `{workflow}`), menu `workflowArReceipt`
- Modify (existing tests): `routes/system-admin/workflow/wf-menu.test.ts` and any test enumerating workflow types

- [ ] **Step 1:** Types/constants/caps; grep every `WORKFLOW_TYPE.AR_INVOICE` hit and add the AR Receipt sibling.
- [ ] **Step 2:** Hooks, slug, menu, titles, landing, new-form guard, i18n.
- [ ] **Step 3:** `bun run typecheck`; `bun test:run routes/system-admin/workflow hooks` → pass.
- [ ] **Step 4:** Commit `feat(workflow): ตั้ง workflow ของใบรับเงิน AR ได้ (เส้นเดียวต่อ BU)`.

### Task 26: Default Setting — creator-approve key for receipts

Follow skill `add-business-setting-config`.

**Files:** `routes/system-admin/company-profile/company-profile-config-registry.ts` (add the item to the **existing** `ar` section next to `ar.invoice.allow-creator-approve`), `messages/en.json` + `th.json`, existing `company-profile-config-registry.test.ts` (extend the existing describe — allowed, not a new file).

- Item `{ key: "ar.receipt.allow-creator-approve", datatype: "boolean", defaultValue: "false", label: "Allow the creator to approve their own AR receipt", labelKey: "config.arReceiptAllowCreatorApprove" }`
- i18n en: label as above · th: `"อนุญาตให้ผู้สร้างอนุมัติใบรับเงิน AR ของตัวเอง"`

- [ ] **Step 1:** Registry + i18n + registry test.
- [ ] **Step 2:** `bun run typecheck`; `bun test:run routes/system-admin/company-profile` → pass.
- [ ] **Step 3:** Commit `feat(default-setting): ตั้งให้ผู้สร้างอนุมัติใบรับเงิน AR ของตัวเองได้`.

### Task 27: Receipt page — action bar from `allowed_actions`, send-back stage picker, reject = void

**Files:**
- Modify: `routes/accounting/accounts-receivable/use-ar-receipt.ts` — `ArReceiptDocument.allowed_actions` required type, `useArReceiptAction` accepts `approve | review | reject`, add `useArReceiptPreviousStages(id, enabled)` (reuse the generalised AP/AR previous-stages hook with `kind: "ar-receipt"` if it generalises cleanly) + `API_ENDPOINTS.AR_RECEIPT_PREVIOUS_STAGES(bu, id)` and its query key
- Modify: `routes/accounting/accounts-receivable/ar-receipt-detail.route.tsx` — gating through the existing pure `arInvoiceActions(doc)` (it only reads `doc_status`, `doc_no`, `allowed_actions`; if its name misleads, rename to a neutral `arDocActions` and update the invoice page imports — one commit, no behaviour change): draft → `["submit","delete"]` for `DRAFT-…` else `["submit","void"]`; `in_review` → backend `allowed_actions`; `posted` → `["void"]`; Approve (confirm), Send back (shared stage picker `routes/accounting/accounts-payable/shared/ap-send-back-fields.tsx` — move to `components/share/` and update the AP/AR invoice pages if ESLint blocks the import — required stage + optional note → `action: "review"`), Reject (required reason; copy: the receipt will be voided and cannot be reopened → `action: "reject"`); show `workflow_current_stage` next to the status badge when `in_review`; creator-cannot-approve hint like `creatorCannotApproveHint` on the AP page
- Modify: `messages/en.json` + `th.json` — `accounting.arReceipt.*`: `approve`, `approveTitle`, `approveConfirm`, `sendBack`, `sendBackTitle`, `sendBackStage`, `sendBackStagePlaceholder`, `sendBackNoStages`, `sendBackStagesError`, `reject`, `rejectTitle`, `rejectConfirm`, `rejectReasonRequired`, `stageLabel`, `creatorCannotApproveHint` (mention `ar.receipt.allow-creator-approve`); `errors.byCode` for `AR_RECEIPT_REJECT_REASON_REQUIRED` (`WORKFLOW_CREATOR_CANNOT_APPROVE` / `WORKFLOW_SENDBACK_STAGE_INVALID` exist — verify). ICU-safe.
- Modify (existing tests): any test asserting the Phase A action gating (`ar-receipt-ui.test.tsx`, `ar-invoice-*` tests if the helper is renamed)

- [ ] **Step 1:** Types, hook, endpoint/key; action gating via the pure helper.
- [ ] **Step 2:** Approve / send back / reject dialogs; stage next to status; Delete only for placeholder drafts, Void for numbered drafts and posted, none for `in_review`.
- [ ] **Step 3:** i18n (ICU-safe), both themes, mobile width — follow skill `carmen-blue-ui-design` for the toolbar.
- [ ] **Step 4:** `bun run typecheck`; `bun test:run routes/accounting` → pass; `bunx eslint` on touched files.
- [ ] **Step 5:** Commit `feat(ar-receipt): ปุ่มตาม allowed_actions, approve / send back เลือก stage / reject = void และลบได้เฉพาะใบ DRAFT`.

### Task 28: Frontend check + PR (Phase B)

- [ ] **Step 1:** `bun run typecheck`; `bun test:run` → no new failures vs `main`; `SKIP_VERSION_BUMP=1 bun run build`.
- [ ] **Step 2:** **Ask the user before pushing.** PR (English): depends on the Phase B backend PR; deploy order; allowlist `ar-receipt.approve`, `ar-receipt.review`, `ar-receipt.reject`, `workflow.findAllArReceipt`.

---

## Manual verification (user-driven, after BE on dev)

**Phase A** (test BU with the three new gl_setting accounts, an AR invoice posted for customer C with 2 lines and a posted credit note):
1. Set `wht_receivable_account_id`, `bank_charge_account_id`, `customer_advance_account_id` on `/accounting/settings` → saved, reload shows them.
2. New receipt for C → number shows `DRAFT-…`; pick the invoice (and the CN) from the picker, bank account + method, WHT profile, bank charge → totals bar shows applied / WHT / charge / unapplied; delete the draft works (soft).
3. New receipt, invoice fully paid, no WHT → Submit → number becomes `ARRC…`, status posted, journal tab shows Dr bank / Cr AR (per line account) balanced, invoice `outstanding_amount` = 0.
4. Receipt with WHT 3 % + bank charge → JV has Dr WHT receivable and Dr bank charge accounts; with the CN allocated → Dr AR line for the CN (not netted); with received > applied → Cr customer advance line and the page shows the unapplied amount; with the gl_setting account removed → Submit refused naming the key.
5. Over-allocate a line (second receipt for the same invoice while the first is still draft) → refused; submit the first, then edit the second above the remainder → refused at save and at post.
6. `is_tax_invoice` receipt → TXRC row visible via API; void of a posted receipt → reversal JV, invoice outstanding restored to the stored amounts, TXRC void; invoice void is refused while a live receipt holds it, allowed after the receipt is void.
7. Numbered draft (after Phase B send back) can only be voided (reason required); period closed → submit/void refused.

**Phase B** (after the migration, BE and FE are on dev): create the AR Receipt workflow (2 approval stages) → a second active one is refused → new receipt shows `DRAFT-…`, deletable → another submitted gets `ARRC…` and enters review → creator (flag off) has no Approve → approver at stage 2 sends back to the stage 1 approver → stays in review (page shows the stage); a later stage via curl is refused → stage 1 + stage 2 approve → posted with the real number on the JV, TXRC issued, invoice outstanding reduced → reject on another receipt requires a reason, becomes void, invoice lines untouched → send back to the create stage (keeps real number): Delete is gone, Void is offered → flip `ar.receipt.allow-creator-approve` on → creator can approve → deactivate the workflow: submit posts directly with a real number.
