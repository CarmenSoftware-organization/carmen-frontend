# AR Receipt (ใบรับเงิน) — Design

**Date:** 2026-11-25 · **Repos:** `carmen-turborepo-backend` (prisma tenant schema, micro-business, backend-gateway, rpc-contract, error-catalog), `carmen-frontend`
**Status:** approved by the user's decisions below (supersedes `2026-11-25-ar-receipt-design-draft.md`, which is deleted). Posting rules are final;
items that still need accounting sign-off are listed under **Open items for accounting** and do not block the build.
**Depends on:** AP Invoice / AP Payment / AR Invoice workflow rounds (all merged to `main` in both repos: shared helper
`common/workflow/accounting-doc-workflow.ts`, `nextDraftNo` / `isDraftNo`, FE `WORKFLOW_CAPS`, `isDraftDocNo`, `ap-send-back-fields.tsx`, `arInvoiceActions`).
**Plan:** `docs/superpowers/plans/2026-11-25-ar-receipt.md`

## Intent

Replace the frontend-only AR Receipt mock (localStorage) with a real document: persisted per BU, allocated against posted AR documents
(reducing their outstanding), posted to GL, voidable with a reversal. **Phase A** = real backend + GL posting (post directly on submit).
**Phase B** = the BU's single approval workflow with the same rules as AP Invoice / AP Payment / AR Invoice.

## User decisions (binding)

1. **One tender per receipt.** Header `bank_account_id` + `receipt_method` (+ cheque fields). The FE collapses `payments[]` to one line.
2. **Overpayment is allowed.** `received + WHT + charge − applied > 0` posts the excess as a **credit to a customer advance / deposit liability
   account** and is recorded as `total_unapplied_amount` on the receipt. Consuming that credit against later invoices is **out of scope this round**
   (see "Overpayment").
3. **No VAT legs at receipt.** `is_tax_invoice` is a document flag: a TXRC `tb_ar_tax_invoice` row is created, no GL effect.
4. Everything else = the draft's recommendations: receipts may settle `invoice | debit_note | credit_note | deposit` lines; post straight to the
   bank account's COA (no clearing account, cheques count as cash); WHT via tax profiles (`tb_ar_receipt_wht`) + a bank-charge field with a
   `gl_setting` expense account; same currency as the invoice (FX leg supported by schema, UI-limited); allocation pro-rata by line unpaid;
   workflow rules identical to AP Invoice / AP Payment / AR Invoice (reject = void whole document with required reason; send back to a validated
   previous stage; creator cannot approve unless BU key `ar.receipt.allow-creator-approve`; one active workflow per BU; `DRAFT-%08d` placeholder with
   the real `ARRC` number at submit; soft-delete only never-numbered drafts; send-back note stored on the history entry); no cash exemption from
   approval; localStorage mock data is discarded (What's New note); the existing AR menu license key is reused (no new key).

## Goals

1. Create / edit / delete (draft) / submit / void a receipt through real endpoints; list + detail from the backend.
2. Allocation against posted AR invoice, debit-note and credit-note lines; reduces `unpaid_amount` / `base_unpaid_amount` and recomputes the
   invoice header `outstanding_amount`; restored on void.
3. GL posting through `subledger.postFromSource` (JV `source = ar`, ref type `ar_receipt`); reversal on void.
4. WHT from tax profiles, bank charge, overpayment to a customer advance account, realised FX leg.
5. Phase B: AR Receipt workflow type in `/system-admin/workflow`, one active per BU, server-enforced approve / reject / send back, creator rule,
   approval UI on the receipt page.

## Non-goals

- Multiple tenders per receipt; clearing / PDC / undeposited-funds accounts; cheque lifecycle (`cheque-reconciliation` page stays as is).
- Consuming a customer advance credit against future invoices; building the advance-deposit module (`ar-advance-deposit-*` mock stays untouched).
- Receipt-time VAT recognition (VAT is booked at the AR invoice — verified below).
- Contract / folio links on receipts (none in FE or BE).
- `tb_payment_type` COA override of the bank account (AP Payment honours it; AR Receipt does not this round — open item).
- Migrating localStorage mock receipts; a "my pending receipts" queue; changing AP / AR Invoice behaviour.

## Anti-goals

- A receipt that reaches `posted` with the `DRAFT-…` number, or with an unbalanced JV.
- Over-collecting a line: two drafts, or a draft and a posted receipt, together exceeding an invoice line's unpaid amount.
- Reject / delete leaving residue: allocations are applied only at post and the TXRC row only at post, so a non-posted receipt holds nothing.
- Booking the WHT receivable to a profile's WHT **payable** account (see "WHT").
- Two active AR Receipt workflows in one BU (Phase B).

## Verification of the draft's "Unverified" list (read 2026-11-25, backend `main` @ `99f3cd061`)

| Question | Finding | Evidence |
|---|---|---|
| **gl_setting account columns** | `gl_setting` is a JSON value in `tb_application_config` (key `gl_setting`), validated by a Zod schema and typed by an interface — **not** a table. Present: `ar_control_account_id`, `output_vat_account_id`, `ar_jv_prefix_id`, `advance_deposit_account_id` (AP-side vendor advance), `realized_fx_gain_account_id`, `realized_fx_loss_account_id`, `wht_payable_account_id`, `reversal_prefix_id`. **Missing for AR Receipt: WHT receivable, bank charge expense, customer advance / deposit liability.** The schema comment on `tb_ar_receipt_wht.chart_of_accounts_id` (`gl_setting.wht_receivable_account_id`) cites a key that does not exist. | `apps/micro-business/src/app-config/app-config.service.ts:129-151` (Zod), `apps/micro-business/src/gl/gl-posting/gl-posting.service.ts:92-112` (interface), `packages/prisma-shared-schema-tenant/prisma/schema.prisma:8039` |
| How AR Invoice books VAT | At **invoice** posting, per line: Dr AR (total) / Cr revenue (net) / Cr output VAT (`vat_chart_of_accounts_id`: line → tax profile → `gl_setting.output_vat_account_id`) / Cr tax-2. Output VAT is recognised on the invoice (accrual); a receipt has nothing to move. Decision 3 stands. | `apps/micro-business/src/ar/ar-invoice/ar-invoice.logic.ts:186-224` (VAT leg at 219), `ar-invoice.posting.ts:472-488` |
| Which AR control account AR Invoice uses | Per **line**: `tb_ar_invoice_detail.dr_chart_of_accounts_id`, defaulted at create from `tb_customer.ar_chart_of_accounts_id` → `gl_setting.ar_control_account_id` (`GL_SETTING_ACCOUNT_MISSING key=ar_control_account_id` when neither). The receipt therefore credits **each settled line's own `dr_chart_of_accounts_id`** (+ its `dr_cost_center_id`), not the customer account — this clears the sub-ledger exactly even when a line was overridden. AR legs carry no dimensions. | `ar-invoice.service.ts:1018-1040`, `ar-invoice.logic.ts:197-206`, schema `tb_ar_invoice_detail` |
| AP Payment currency-match rule | (a) every allocated line must belong to one vendor **and one currency** (`AP_VENDOR_CURRENCY_MISMATCH`); the payment takes that currency; (b) the bank account's own currency must equal the payment currency **or** the BU base currency (`AP_PAYMENT_BANK_CURRENCY_MISMATCH`). AR Receipt copies both: customer + currency uniform across lines (existing `AR_CUSTOMER_CURRENCY_MISMATCH`), bank currency ∈ {receipt, base}. | `apps/micro-business/src/ap/ap-payment/ap-payment.validation.ts:293-298`, `:362-430` |
| `enum_workflow_type` | `purchase_request, store_requisition, purchase_order, gl_jv, ap_invoice, ap_payment, ar_invoice` — **no `ar_receipt`**. `ALTER TYPE … ADD VALUE` must be its own migration (precedent `20260930180414_accounting_ar_service_enums`). | `schema.prisma:245-253` |
| Running-code types for ARRC | **None.** Presets exist for `AR-IV/DN/CN` and `TX-IV/DN/CN` only, in two mirrored constants. Need `AR-RC` (`ARRC` + `yyMM` + 4-digit running) and `TX-RC` (`TXRC`, matches the `tb_ar_tax_invoice.tax_prefix` comment). Draft counter key `ar_receipt_running_no` follows `nextDraftNo`. | `master/running-code/const/running-code.const.ts:129-134`, `procurement/const/procurement.const.ts:83-88`, `ar/ar-invoice/ar-invoice.writer.ts:24`, `schema.prisma:7875` |
| Schema of `tb_ar_receipt` / `_detail` / `_wht` | Header with one bank account/method, per-**invoice-line** detail mirroring `tb_ap_payment_detail`, WHT certificate rows. `net_received_amount`'s comment says "applied − wht − charge" — **redefined** below. No `doc_source`, no `source_doc_ref`, no unapplied columns. `tb_ar_tax_invoice.ar_receipt_id` (unique) exists and its customer-snapshot columns match the FE `taxEntitySchema` 1:1 (name, tax id 13, branch 5, address ×2, province, postal). | `schema.prisma:7913-8036`, `:7872-7911` |
| `source` column | Absent on `tb_ar_receipt` → add `doc_source` (new enum) + `source_doc_ref` (precedent: `tb_ar_invoice.doc_source`, `source_doc_ref VarChar(100)`). | `schema.prisma:7656-7659` |
| AR Invoice already protects posted receipts | Posted-invoice void is refused while any **non-void** receipt (draft / in_review / posted) holds a line of it (`AR_INVOICE_HAS_RECEIPT`) — drafts already act as a soft reservation against invoice void. | `ar-invoice.posting.ts:692-705` |
| Nothing else reads `ar_receipt` | Only the generated enrichment map, attachment-table map and payment-type usage counts reference it. | `common/enrichment/enrichment.map.generated.ts:271-277`, `common/attachments/attachment-table-map.ts:249`, `master/payment-type/payment-type.service.ts:420` |
| `SubledgerSourceRefType` | `'ap_invoice' \| 'ap_payment' \| 'ar_invoice'` — must add `'ar_receipt'`. | `gl/gl-subledger-posting/interface/gl-subledger-posting.interface.ts:8` |

## Current state

**Frontend mock (localStorage only, no API call):** `routes/accounting/accounts-receivable/ar-receipt-model.ts` (424 lines: zod schemas,
`readReceipts / saveReceipt / deleteReceipt / voidReceipt`, key `carmen.ar.receipt-mock.v1.<bu>`, statuses `draft | void`, `number` empty until saved),
`ar-receipt-list.route.tsx` (342), `ar-receipt-detail.route.tsx` (1081), `ar-receipt-dialogs.tsx` (424: payment dialog + invoice picker); existing tests
`ar-receipt-model.test.ts`, `ar-receipt-ui.test.tsx`, `ar-receipt-payment-dialog.test.tsx`. Shape: customer, `currency`/`rate`, tax-invoice block,
WHT (`whtEnabled/whtAmount/whtCertificate/whtService` code 01-05, hard-coded 3/5/2/1/3 %), `allocations[]` (one row per **invoice**), `payments[]`
(multi-tender), `receiptTotals` where unapplied = received + wht − allocated is already allowed. Entry from an invoice via `newReceiptFromInvoice`.

**Backend:** schema only. No service, controller, contract, gateway route, error code, running code or `gl_setting` key. AP Payment
(`apps/micro-business/src/ap/ap-payment/`) is the template: `postInTx` (period check → row-lock lines → `recheckAllocations` → `buildJvLines` →
`subledger.postFromSource` → `adjustUnpaid(reduce)` → `markPosted`, `ap-payment.posting.ts:216-251`), `voidPostedInTx` (`:272-310`), `loadAllocationLines`
with draft/in-review reservations (`ap-payment.validation.ts:208-300`), `buildPaymentJvLines` (`ap-payment.logic.ts:383-463`).

## Design

### Data model (tenant schema) — migrations `ar_receipt_foundation` (Phase A) and `ar_receipt_workflow_type` (Phase B)

`tb_ar_receipt` (additive):
- `doc_source enum_ar_receipt_source NOT NULL DEFAULT 'manual'` with new `enum enum_ar_receipt_source { manual copy interface }`. `manual` and `copy` enter the
  workflow (both are in the shared `ACCOUNTING_WORKFLOW_SOURCES`); `interface` (future automated import) posts directly. The FE's `source = invoice`
  (receipt started from an invoice) is stored as `manual` — it is human-keyed.
- `source_doc_ref VarChar(100) NULL` (FE `sourceDoc`, e.g. the invoice number it was started from).
- `total_unapplied_amount Decimal(20,5) DEFAULT 0`, `base_total_unapplied_amount Decimal(20,5) DEFAULT 0`.
- Column comments updated: `net_received_amount` = **bank amount** (what the money-in line debits) and now equals `applied + unapplied − wht − charge`.
- Tender extras with no column (`card_last4`, bank name/branch text) go in `info.tender` (JSON); `reference_no`, `payer_name`, `received_date`, cheque fields use
  existing columns. The tax-entity snapshot (`taxEntitySchema`) goes in `info.tax_entity`; it is copied to the TXRC row at post.
- `creditDays` is dropped (meaningless on a receipt). `payment_type_id` stays null (open item).

`tb_ar_receipt_detail`: unchanged (line-level; credit-note lines carry a **negative** `applied_amount`, as `tb_ap_payment_detail`).
`tb_ar_receipt_wht`: unchanged; `chart_of_accounts_id` is filled with `gl_setting.wht_receivable_account_id` (not the profile's account).
`tb_ar_tax_invoice`: unchanged (`ar_receipt_id`, `tax_prefix = 'TXRC'`).

Phase B migration (separate file; it must not share a transaction with any statement that uses the new value):
`ALTER TYPE "enum_workflow_type" ADD VALUE 'ar_receipt';`

New `gl_setting` keys (JSON, **no migration**; optional uuids in the Zod schema and the `GlSetting` interface, editable on `/accounting/settings`):
`wht_receivable_account_id`, `bank_charge_account_id`, `customer_advance_account_id`. Each is required only when its leg is non-zero
(`subledger.requireSettingAccount` → `GL_SETTING_ACCOUNT_MISSING key=…`), exactly like the FX accounts.

### Document model and allocation

- **API shape:** header (customer, `receipt_date` GL date, `received_date`, currency, `exchange_rate`, `bank_account_id`, `receipt_method`, cheque no/date,
  `reference_no`, `payer_name`, `description`, `is_tax_invoice`, `source_doc_ref`, `info`), `net_received_amount` (the money received into the bank),
  `charge_amount`, `wht[]` (`wht_tax_profile_id`, `base_amount`, optional `wht_amount` override, certificate no/date), and **`allocations[]` at invoice level**:
  `{ ar_invoice_id, applied_amount }` (positive magnitude; the backend signs credit notes negative).
- **Line split (decision: pro-rata by line unpaid):** for each allocation the writer spreads `applied_amount` over that document's posted lines,
  proportional to each line's *available* amount (`unpaid − reservations by other draft/in_review receipts`), `round2` per line, the **last line (by
  `sequence_no`) takes the remainder**, every line ≤ its available amount. The result is stored per line in `tb_ar_receipt_detail`; edits replace all child
  rows. A pure function (`allocateProRata`); the FE only handles invoice-level amounts.
- **Eligibility per line:** header `doc_status = posted`, same customer, same currency across all lines (`AR_CUSTOMER_CURRENCY_MISMATCH`), available amount ≥
  |applied|, sign rule (credit note → negative, others → positive), credit-note **header** reservation ≤ header `outstanding_amount` (copies
  `ap-payment.validation.ts:208-300`, including the draft/in_review reservation sums and `excludeReceiptId`). `deposit`-type lines pass the rule, but
  `checkArHeader` cannot create deposit documents today, so none exist yet.
- **Totals (document currency; base = `round2(× receipt rate)` except where stated):**
  `total_applied = Σ signed applied` · `total_wht = Σ wht_amount` · `total_charge = charge_amount` · `net_received = bank amount` ·
  `settlement = net_received + wht + charge` · **`unapplied = settlement − total_applied`**.
  Validation: `unapplied ≥ 0` (else `AR_RECEIPT_OVER_ALLOCATED`), `total_applied ≥ 0`, `net_received ≥ 0`, `wht ≥ 0`, `charge ≥ 0`,
  `wht ≤ Σ positive applied` (`AR_RECEIPT_WHT_INVALID`), and the document is not empty — no allocations **and** `settlement = 0` → `AR_RECEIPT_EMPTY`.
  A receipt with **no allocations and settlement > 0** is a pure advance (everything unapplied); the same rule produces it, so it is allowed (open item).
- **Base amounts and the FX plug (mirrors `ap-payment.logic.ts:193-228`):** `baseAtInvoice = Σ baseAtInvoiceRate(line)` (taking a whole line takes its whole
  `base_unpaid_amount`, so a settled line ends at 0.00 base), `baseAtReceipt = Σ round2(applied × receipt rate)`, `advance_base = round2(unapplied × receipt rate)`,
  `base_net_received = baseAtReceipt + advance_base − base_wht − base_charge` (the bank leg's base is the plug), **`realized_fx_amount = baseAtReceipt −
  baseAtInvoice`** (> 0 = gain, Cr). All rounding differences therefore land in the FX leg — never a separate rounding account. With `net_received = 0` the
  bank leg is skipped and conversion rounding moves into the FX figure (AP's "zero payment" rule).
- **Currency:** receipt currency = the allocated lines' currency; with no allocations, the request's currency (default customer currency, else base). Bank
  account currency ∈ {receipt currency, base currency} (`AR_RECEIPT_BANK_CURRENCY_MISMATCH`). Each line's invoice rate comes from its header
  (`invoice_exchange_rate`); the receipt rate defaults to the rate resolved for `receipt_date` (as AR Invoice's `resolveRate`). FX is therefore supported by the
  model, but the **FE shows the rate read-only** (UI-limited until accounting confirms).
- **Drafts reserve, posting re-checks:** drafts and in-review receipts reduce a line's available amount for other receipts (reservation sums), and `postInTx`
  re-locks the lines and re-validates, failing with `AR_RECEIPT_IMMUTABLE` if the invoice rate / base drifted or `AR_RECEIPT_OVER_ALLOCATED` if the line was
  consumed meanwhile.

### Posting rules (final) — JV `source = ar`, `source_ref_type = 'ar_receipt'`, description `${doc_no} ${customer_name}`, `jv_date = receipt_date`

Posted once, when the document reaches `posted` (Phase A: at submit; Phase B: at the final approval, or at submit when there is no workflow / source is
`interface`). Document currency on every leg except FX (base currency, rate 1); every leg also carries its base amount.

| # | Leg | Dr | Cr | Amount (doc currency) | Base amount |
|---|---|---|---|---|---|
| 1 | Money received | `tb_bank_account.chart_of_accounts_id` of the header bank account (no clearing; cheque/card/promptpay = cash) | | `net_received_amount` (skipped when 0) | `base_net_received_amount` (plug) |
| 2 | WHT withheld by customer | `gl_setting.wht_receivable_account_id` | | `total_wht_amount` | `Σ round2(wht × rate)` |
| 3 | Bank charge | `gl_setting.bank_charge_account_id` | | `total_charge_amount` | `round2(charge × rate)` |
| 4 | Settle invoice / debit-note / deposit lines | | each line's `dr_chart_of_accounts_id` + `dr_cost_center_id`, **grouped** by (account, cost centre) | Σ applied | `baseAtInvoiceRate` (invoice rate) |
| 5 | Settle credit-note lines | each credit-note line's `dr_chart_of_accounts_id` + cost centre, grouped, **never netted** with leg 4 | | Σ \|applied\| | `\|baseAtInvoiceRate\|` |
| 6 | Overpayment | | `gl_setting.customer_advance_account_id` | `unapplied` (> 0 only) | `round2(unapplied × rate)` |
| 7 | Realised FX | loss (`realized_fx_amount < 0`): `realized_fx_loss_account_id` | gain (`> 0`): `realized_fx_gain_account_id` | — (base currency, rate 1) | `\|realized_fx_amount\|` |

Balance in document currency: `bank + wht + charge + Σ|CN| = Σ invoices + unapplied` (because `net + wht + charge = applied + unapplied`). In base it
balances by construction: leg 1's base is the plug and leg 7 absorbs `baseAtReceipt − baseAtInvoice`. Legs are emitted AR-Dr first (AP convention) and omitted
when zero. The FX sign is the **mirror of AP**: AR gain when receipt base > invoice base.

- **No VAT legs.** If `is_tax_invoice`, post also issues a TXRC row (below); the JV is unchanged.
- **TXRC (document only):** inside the posting transaction, a `tb_ar_tax_invoice` row with `ar_receipt_id`, `tax_prefix = 'TXRC'`, number from running-code
  `TX-RC` (same shape as `generateArTaxInvoiceNo`; unique violation → abort `AR_TAX_INVOICE_NO_CONFLICT`, as AR Invoice does), date = the request's tax date
  (default `receipt_date`), customer snapshot from `info.tax_entity` (tax id 13 digits / branch 5 digits validated at submit, as the mock does),
  `base_amount = base_total_applied_amount`, `vat_rate = 0`, `vat_amount = 0`, `total_amount = base_amount`, filing month/year from the tax date.
  The amounts on this row are an open item.
- **WHT:** the customer deducts WHT, so we receive less cash and hold a prepaid-tax asset until the 50 ทวิ is claimed. Rate and amount come from the WHT
  **tax profile** (`tb_tax_profile`, `tax_type = wht`): `wht_rate = profile.tax_rate`, `wht_amount = round2(base × rate / 100)` unless the request carries an
  override amount (`is_override = true`), `pnd_form = profile.wht_pnd_form`, `income_type = profile.wht_income_type`. The profile's own `chart_of_accounts_id`
  is the **payable** account used on AP, so AR **ignores it** and always books `gl_setting.wht_receivable_account_id` (`GL_SETTING_ACCOUNT_MISSING
  key=wht_receivable_account_id` when WHT ≠ 0). Certificate number/date are optional free text and may be unknown at post. The FE computes the suggested base
  (pro-rata net of the allocated documents, existing `receiptAllocationTax`) and the rate from the profile list; the hard-coded 3/5/2/1/3 % table is removed.
- **Period:** `receipt_date` must fall in an open regular GL period at submit **and** at post (`GL_PERIOD_NOT_OPEN`).
- **Void (posted):** period check on today's date → row-lock the lines → `reverseBySource` (reversal JV dated now, with the reason) → `adjustUnpaid(restore)` from the
  **stored** `applied_amount` / `base_applied_at_invoice_rate` of each detail row (credit-note rows use `abs`) → recompute each touched invoice's
  `outstanding_amount` → TXRC row `tax_status = void` → `doc_status = void`, `void_at/by/reason`, `void_gl_jv_id`. Voiding a `draft`/`in_review` receipt is
  bookkeeping only (no JV). The reason is required (`AR_RECEIPT_VOID_REASON_REQUIRED`). Invoice void stays blocked while a live receipt holds its lines.

### Overpayment (Decision 2)

Leg 6 books the excess into the BU's **customer advance / deposit liability** account (new key `customer_advance_account_id`), and the receipt keeps
`total_unapplied_amount` as its own record. **Using the credit later is out of scope this round:** there is no per-customer credit balance, no "apply credit"
action on invoices, and no link to the `ar-advance-deposit` module. Until a follow-up round, accounting moves the balance with a manual journal (Dr customer
advance / Cr AR). The receipt page shows the unapplied amount with a hint saying so. Voiding the receipt reverses the leg.

### Numbering and lifecycle (built in Phase A so Phase B needs no rework)

- Create → `nextDraftNo(tx, 'ar_receipt_running_no', userId)` (`DRAFT-%08d`, one counter per BU). **Submit** reserves the real `ARRC` number
  (`reserveDocumentNumbers`, type `AR-RC`, series `tb_ar_receipt.doc_no`, date = `receipt_date`) inside the transaction that moves the document out of draft —
  only when `isDraftNo(doc_no)`, after the guarded lock succeeds and before `loadFull` / validation / `postInTx`, so the JV description and every later read
  see the real number (same rule as the AR Invoice plan, Task 3).
- `delete` (soft, header + children) only for `draft` **and** `isDraftNo(doc_no)`; a numbered draft (possible in Phase B after a send-back to the create stage)
  can only be voided (`AR_RECEIPT_NUMBERED_VOID_ONLY`).
- Statuses `draft → in_review → posted | void` (Phase A uses `draft → posted | void`). Optimistic locking with `doc_version` and guarded updates as in AP Payment.

### Phase B — workflow (same rules as AR Invoice / AP Payment)

- **Type:** `enum_workflow_type.ar_receipt` (own migration); one active `ar_receipt` workflow per BU (add to `SINGLE_ACTIVE_WORKFLOW_TYPES`, advisory lock
  `hashtext('tb_workflow:ar_receipt')`, `WORKFLOW_SINGLE_ACTIVE_EXISTS`); users never pick a workflow on a receipt.
- **Eligibility:** `isWorkflowEligibleSource(doc_source)` (shared helper, unchanged): `manual|copy` go through the workflow, `interface` posts directly. Submit with
  no active workflow posts directly (Phase A behaviour). An `in_review` receipt keeps acting on its stored `workflow_id`; a draft re-resolves on submit.
- **Actions**, enforced server-side by `assertCanActOnDocument` (stage actor + `available_actions`) through the shared helpers: **Approve** (final approval
  posts); **Reject = void the whole receipt** from `in_review` (terminal; reason required, non-empty after trim, `AR_RECEIPT_REJECT_REASON_REQUIRED`; stored in
  `void_reason` and on the `rejected` history entry); **Send back** to a previous stage chosen by the approver, validated against `getPreviousStages`
  (`WORKFLOW_SENDBACK_STAGE_INVALID`) — first (create) stage → `draft`, otherwise stays `in_review`; the optional note is stored on the history entry (`planSendBack`).
- **Creator cannot approve** their own receipt unless BU config `ar.receipt.allow-creator-approve` is `true`/`'true'` (absent = false); reject / send back are
  unaffected. The key goes in the **existing `ar` section** of Default Setting (created by the AR Invoice round).
- **No residue on reject:** nothing is written outside the header before `postInTx` (allocations, JV, TXRC are all post-time), so reject = status + workflow
  columns + `void_*`. The implementer re-confirms by reading the posting code (Task 22).
- **Routing amount:** the workflow mapper passes `base_net_received_amount` as `navigation_request_data.total_amount` (AP Payment passes
  `base_net_paid_amount`); workflow routing is total-only.
- Gateway: `GET config/:bu_code/workflows/ar-receipt` → `findAllArReceipt`; `GET :bu/ar-receipt/:id/previous-stages` (guard `ar-receipt.findOne` → no new
  api_name); `allowed_actions` on `findOne` (MB serializer **and** gateway `@Serialize` schema — a field missing from the gateway schema is silently dropped).
- FE: workflow admin type + `WORKFLOW_CAPS[AR_RECEIPT] = { hasProducts:false, hasJvScope:false, totalOnlyRouting:true, canHidePrice:false }`, structure-lock notice
  for `/accounting/accounts-receivable/receipt` with `doc_status = in_review`, menu `workflowArReceipt`, Default Setting item, and the action bar on the receipt
  page driven by backend `allowed_actions` (reusing `arInvoiceActions`, `ap-send-back-fields.tsx` and the generalised previous-stages hook).

### Backend modules (Phase A)

`apps/micro-business/src/ar/ar-receipt/` (mirrors `ap-payment/`): `ar-receipt.controller.ts`, `.service.ts`, `.logic.ts` (allocation split, totals, JV lines — pure),
`.validation.ts` (allocation lines + reservations, header refs, WHT), `.writer.ts` (header + children), `.posting.ts` (`postInTx`, `voidPostedInTx`,
`adjustUnpaid`, TXRC), `.running-code.ts`, `.module.ts`, `dto/ar-receipt.serializer.ts`, `interface/ar-receipt.interface.ts`. Gateway `application/ar-receipt/`.
Contract `packages/rpc-contract/src/contracts/ar-receipt.ts`. Endpoints (api_name = `ar-receipt.<name>`): `findAll`, `findOne`, `create`, `update`, `delete`, `submit`,
`void`, `outstandingInvoices` (posted invoice/DN/CN lines of a customer with available amounts and currency — the FE invoice picker). No WHT-preview endpoint:
the FE computes the suggestion from the tax-profile rate; the backend recomputes and validates.

### Frontend (Phase A)

- New `routes/accounting/accounts-receivable/use-ar-receipt.ts` (list / detail / create / update / delete / action / outstanding-invoices hooks) + `API_ENDPOINTS` /
  `QUERY_KEYS`, modelled on `use-ar-register.ts`. `ar-receipt-model.ts` loses all localStorage code and the multi-payment schema; it keeps pure helpers (form schema,
  totals incl. unapplied, validation, payload mapping, WHT suggestion from the profile rate).
- Detail page: single **Tender** section (bank account, method, cheque no/date, reference, payer, value date; `promptpay` added to `RECEIPT_PAY_TYPES`), bank-charge
  field, WHT section (profile picker, base, rate, amount, certificate), allocations table with the invoice picker backed by `outstandingInvoices`, totals bar showing
  applied / WHT / charge / **unapplied** with the advance-credit hint, read-only exchange rate. Statuses `draft | in_review | posted | void` with chips/i18n;
  `DRAFT-…` numbers; Delete only for placeholder drafts, Void for numbered drafts and posted. "Copy" / "from invoice" entry keeps working through `source_doc_ref`.
- Journal tab (JV lines) as `ar-invoice-journal.tsx` does via `useJournalVoucher(gl_jv_id)`.
- Accounting settings form (`routes/accounting/settings/`): three new account fields (WHT receivable, bank charge, customer advance) in the Accounts Receivable section;
  `GL_UUID_FIELDS` grows from 13 to 16.
- The mock's localStorage records are ignored (key left untouched, no migration). The changelog is generated from commit messages, so the FE commit/PR must say
  that saved mock receipts are not carried over (What's New).
- License: reuse `licenseFeature: "accounting.ar"` of the existing `arReceipt` leaf (`constant/module-list.ts:285-289`); no new key (skill `license-gating`).

### Deploy order

Preflight on each env: nothing to clean (no receipt data exists). **Phase A:** migrations (all tenant schemas) → BE micro-business + gateway together → allowlist
every new api_name on each non-`allow_all` env → set the three new `gl_setting` accounts per BU that will post receipts → FE (`vercel --prod`).
**Phase B:** migration (`ar_receipt` enum value) → BE micro-business + gateway together → allowlist → FE. New api_names — Phase A: `ar-receipt.findAll`,
`ar-receipt.findOne`, `ar-receipt.create`, `ar-receipt.update`, `ar-receipt.delete`, `ar-receipt.submit`, `ar-receipt.void`, `ar-receipt.outstandingInvoices`;
Phase B: `ar-receipt.approve`, `ar-receipt.review`, `ar-receipt.reject`, `workflow.findAllArReceipt`. An api_name missing from the allowlist logs users out — list them in
both PR bodies.

## Open items for accounting (not blockers — the defaults below are what the plan builds)

1. **Customer advance account** — default: a liability account configured per BU (`customer_advance_account_id`); consuming the credit is a later round. Confirm the
   account class and whether it should be sub-ledgered per customer.
2. **TXRC amounts** — default: `vat_rate 0`, `vat_amount 0`, `total = base applied`. Confirm what a receipt-time tax invoice must show for service BUs.
3. **WHT master** — default: tax profiles. AP moved to WHT form / service-type masters on 2026-11-18; confirm whether AR should follow. Clearing the WHT receivable
   when the 50 ทวิ is claimed is a manual journal.
4. **Cheque / card / promptpay** — default: debit the bank account's COA immediately. Confirm no undeposited-funds / PDC account is wanted yet.
5. **Zero-allocation (pure advance) receipts** — default: allowed.
6. **Payment-type COA override** — default: ignored (AP honours `tb_payment_type`).
7. **Mandatory dimension rules** on the bank, WHT-receivable, bank-charge or advance accounts make the GL facade refuse the JV; BUs with such rules need dimensions on
   those legs (not built).
8. **FX** — default: schema + posting support a receipt rate ≠ invoice rate; the UI shows the rate read-only. Confirm before exposing the rate input.
9. **Draft receipts block invoice void** (existing `AR_INVOICE_HAS_RECEIPT` counts draft / in_review). Confirm that is desired for receipts that sit in draft.

## Left to the builder

File / function / DTO names beyond those fixed here, error-code ids, i18n wording, the `outstandingInvoices` response shape (must expose per-document currency, rate,
outstanding and per-line available amounts), where the shared stage picker lives if ESLint blocks the cross-folder import (move to `components/share/`), whether Phase A
and B ship as one release.
