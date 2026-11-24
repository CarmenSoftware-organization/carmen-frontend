# AR Receipt (ใบรับเงิน) — Design DRAFT

**Date:** 2026-11-25 · **Status:** DRAFT — not approved. Posting rules and the decisions in the last
section need product-owner / accounting sign-off before a plan is written.
**Repos:** `carmen-turborepo-backend` (prisma tenant schema, micro-business, backend-gateway), `carmen-frontend`

## Intent

Replace the frontend-only AR Receipt mock with a real document: persisted per BU, allocated against
AR invoices (reducing their outstanding), posted to GL, voidable with a reversal, and — in a second
phase — approved through the same workflow rules just built for AP Invoice.

## Current state

**Frontend mock (everything below is localStorage only, no API call):**
- Storage: `readReceipts/saveReceipt/deleteReceipt/voidReceipt`, key `carmen.ar.receipt-mock.v1.<bu>`
  (`routes/accounting/accounts-receivable/ar-receipt-model.ts:337`, functions from ~L380; void at L275 of
  the second slice, i.e. `voidReceipt`). Statuses are only `draft | void` (`receiptSchema.status`, ~L50).
  `number` is `""` until saved; there is no real running number.
- Shape (`ar-receipt-model.ts` ~L10-80): customer (id/code/name), `currency` + `rate`, `creditDays`,
  `source` (`manual|copy|invoice`) + `sourceDoc`, `description`, **tax-invoice block** (`taxInvoice`,
  `taxInvoiceNo`, `taxDate`, `taxEntity` snapshot of registered name/tax id/branch/address),
  **WHT** (`whtEnabled`, `whtAmount`, `whtCertificate`, `whtService` code 01-05), `defaultPaymentType`,
  `allocations[]` and `payments[]`.
- **Allocations** = one row per AR invoice (not per invoice line): `id`, `number`, `outstanding`, `amount`,
  `netAmount/vatAmount/totalAmount` (used to pro-rate VAT/WHT base, `receiptAllocationTax`, `suggestedReceiptWht`).
- **Payments** = multiple tender lines per receipt: `type` (`bank_transfer|cash|cheque|credit_card`), date,
  amount, reference, bank/branch/bankAccount, `chequeNo/chequeDate`, `cardLast4`, `accountId/accountLabel`
  (GL account), `costCenterId`. One receipt can mix several methods.
- Rules in the mock (`receiptValidation`, ~L267): customer required; no duplicate invoice; allocation <=
  outstanding; WHT <= allocated; tax id 13 digits / branch 5 digits when tax invoice. `receiptTotals`:
  settlement = received + wht, **unapplied = received + wht - allocated** (unapplied is allowed in the UI).
- UI: `ar-receipt-list.route.tsx` (status filter L59-64), `ar-receipt-detail.route.tsx` (1081 lines),
  `ar-receipt-dialogs.tsx`. Entry from an invoice via `newReceiptFromInvoice`. WHT hard-codes rates 3/5/2/1/3%
  (`suggestedReceiptWht`). No contract / folio link anywhere in the receipt files (grep clean).
- Related mock: `ar-advance-deposit-*` (separate localStorage module) — deposits are NOT part of the receipt UI.

**Backend (schema only, no service):**
- `tb_ar_receipt` (schema.prisma L7913): `doc_no` ARRC{YY}{MM}{0000}, `doc_status` (`draft|in_review|posted|void`),
  `receipt_date` (GL date), `received_date` (value date), customer snapshot, `payer_name`, **one** `bank_account_id`
  + **one** `receipt_method` (`bank_transfer|cheque|cash|credit_card|promptpay`), `cheque_no/date`, `is_tax_invoice`,
  currency/`exchange_rate`/base currency, totals (applied, wht, charge, net_received + base_*),
  `realized_fx_amount`, `gl_jv_id/no`, `posted_at/by`, `void_*` + `void_gl_jv_id`, full `workflow_*` columns,
  `user_action`, `last_action*`, `attachments`, `info`, audit + `deleted_at`, `payment_type_id`.
  Unique `(doc_no, deleted_at)`.
- `tb_ar_receipt_detail` (L8002): allocation **per AR invoice line** (`ar_invoice_detail_id`), `applied_amount`,
  `invoice_exchange_rate`, `base_applied_at_invoice_rate`, `base_applied_at_receipt_rate`, `realized_fx_amount`;
  unique `(receipt, invoice_detail)`. Mirrors `tb_ap_payment_detail`.
- `tb_ar_receipt_wht` (L8026): 50 ทวิ certificate(s) received, `chart_of_accounts_id` = WHT receivable
  (comment says `gl_setting.wht_receivable_account_id`). `tb_ar_tax_invoice` already has `ar_receipt_id` (TXRC).
- Nothing in `apps/micro-business/src` or the gateway references `ar_receipt`; `enum_workflow_type` =
  `purchase_request, store_requisition, purchase_order, gl_jv, ap_invoice, ap_payment, ar_invoice` (L245) — no `ar_receipt`.

**Outstanding tracking today (AR Invoice):** `tb_ar_invoice.outstanding_amount` = Σ `tb_ar_invoice_detail.unpaid_amount`
(`ar-invoice.posting.ts` `recomputeOutstanding` ~L272-286), `base_unpaid_amount` per line; credit-note
references already reduce it (L560-653). Receipt allocation would reduce the same two line columns. AP Payment does
exactly this via `adjustUnpaid(tx, ..., 'reduce' | 'restore')` (`ap-payment.posting.ts` L216-251, void L272-310).

**AP Payment pattern to copy** (`apps/micro-business/src/ap/ap-payment`): `create/submit/approve/review/reject/void/delete`
in `ap-payment.service.ts`; `postInTx` = period open check -> row-lock invoice lines -> `recheckAllocations` ->
`buildJvLines` -> `subledger.postFromSource` (source_ref_type/id = the payment) -> `adjustUnpaid(reduce)` -> `markPosted`;
`voidPostedInTx` = period check -> lock -> `subledger.reverseBySource` -> `adjustUnpaid(restore)` using the **stored**
`applied_amount` / `base_applied_at_invoice_rate` -> status void + `void_gl_jv_id`. Realized FX books once, base currency
rate 1, balancing the JV (`ap-payment.logic.ts` ~L335-372). Workflow helpers are duplicated there (`workflowColumns`,
`resolveWorkflowId`) — the shared accounting-doc helper from the AP Invoice work should replace them.

## Proposed scope split

### Phase A — real backend (no approval workflow)
1. Migration (see gaps) + generated Prisma client.
2. `apps/micro-business/src/ar/ar-receipt/` modelled on ap-payment: controller, service, logic, validation,
   writer, posting, running-code (ARRC) — `create` (draft), `update`, `delete` (soft), `submit` (= post when no
   workflow), `void` (draft void or posted reversal), list/detail/outstanding-invoices lookup.
3. Allocation against AR invoices: lock lines, re-check outstanding at post, reduce `unpaid_amount`/`base_unpaid_amount`,
   recompute `outstanding_amount`, restore on void. Unapplied cash policy per Decision 3.
4. GL posting via `subledger.postFromSource` (source `ar`) + reversal on void. TXRC tax invoice when `is_tax_invoice`.
5. Gateway endpoints (`ar-receipts` CRUD + submit/void + invoice lookup) with new `api_name`s -> allowlist.
6. FE: replace `readReceipts/saveReceipt/...` with data hooks (`routes/accounting/accounts-receivable/use-ar-receipt.ts`),
   map the mock shape to the API (payments[] collapse — Decision 2), drop localStorage; FE error catalog entries.
7. Behaviour with no workflow = post directly on submit (identical to AR Invoice/AP Payment today).

### Phase B — workflow (same rules as AP Invoice spec)
Depends on Phase A + the shared accounting-doc workflow helper.
- `enum_workflow_type` += `ar_receipt` (ALTER TYPE ADD VALUE migration), FE `WORKFLOW_TYPE`/labels/i18n/type option;
  gateway `GET config/workflows/ar-receipt` (`workflow.findAllArReceipt`).
- One active workflow per BU (advisory lock `hashtext('tb_workflow:ar_receipt')`, `WORKFLOW_SINGLE_ACTIVE_EXISTS`).
- Human-created only: `manual|copy|invoice` enter the workflow; any future `interface`/auto source posts directly.
- Actions enforced server-side (stage role + `available_actions`): **Approve** (final approval posts),
  **Reject = void whole receipt** (reason required, terminal), **Send back** to a chosen previous stage
  (create stage -> `draft`, else `in_review`); send-back target validated against `getPreviousStages` (the security
  finding fixed on AP Invoice); `previous-stages` endpoint `ar-receipts/:id/previous-stages` (new api_name).
- Creator cannot approve unless BU key **`ar.receipt.allow-creator-approve`** (new "AR" registry section if
  `ar.invoice...` has not created it yet; default `false`).
- `DRAFT-########` placeholder number from `nextDraftNo` while draft; real ARRC number reserved on submit; soft-delete
  only for never-numbered drafts, void for numbered drafts/in_review/posted. Receipt rows in the workflow keep their
  stored `workflow_id` if the workflow is later deactivated; drafts re-resolve on submit.
- Reject must leave no residue: no open TXRC tax record, no reserved allocation (allocations are only applied at post,
  so none by design), no held cheque reservation.

## Data model gaps (what the FE expects vs. the schema)

| # | FE mock | Prisma today | Gap / proposed change |
|---|---|---|---|
| 1 | `payments[]` multiple tender lines (type, bank, cheque, card last4, GL account, cost centre) | one `bank_account_id` + `receipt_method` + one cheque on the header | **Structural.** Either UI drops to one tender (Decision 2) or new `tb_ar_receipt_payment` child table |
| 2 | `cardLast4`, `bank`, `branch`, `reference` per tender | no columns (`reference_no` header only) | add to child table, or `info` json |
| 3 | `costCenterId` per tender | none | add on child table / detail; check line-dimension rules (`LINE_DIMENSIONS` config per BU) |
| 4 | allocation per **invoice** | per **invoice line** (`ar_invoice_detail_id`) | FE must expand an invoice amount to lines (pro-rata or oldest-first), as AP Payment's writer does. Rule needed |
| 5 | `status` draft/void | `draft/in_review/posted/void` | none; FE statuses + chips + i18n to add (`in_review`, `posted`) |
| 6 | `promptpay` not in FE method list | enum has `promptpay` | add to FE `RECEIPT_PAY_TYPES` (or leave out on purpose) |
| 7 | `whtEnabled/whtAmount/whtCertificate/whtService` (single cert, code 01-05, hard-coded rates) | `tb_ar_receipt_wht[]` (profile, rate, pnd_form, income_type, cert no/date) + `total_wht_amount` | map one cert -> one row; replace hard-coded rates with tax profiles (`tb_tax_profile` WHT) |
| 8 | `creditDays` | none | drop (meaningless on a receipt) or keep in `info` |
| 9 | `source` manual/copy/invoice + `sourceDoc` | no source column | **add `source` enum/varchar** (needed for Phase B eligibility); `sourceDoc` -> `info` or reference_no |
| 10 | tax-invoice block (`taxEntity` snapshot, `taxDate`) | `is_tax_invoice` + `tb_ar_tax_invoice` (customer snapshot columns, TXRC) | map to tax invoice row at submit; confirm column parity with `taxEntitySchema` |
| 11 | service charge / short pay | `total_charge_amount` | FE has **no** charge field — add or hide (Decision 5) |
| 12 | `unapplied` (overpayment) | no field / no account | schema + GL rule needed (Decision 3) |
| 13 | contract / folio links (asked in brief) | none | **not present in FE or BE** — out of scope unless the owner says otherwise |
| 14 | `payer_name`, `received_date`, `reference_no`, `attachments` | exist | FE has no inputs for payer/value date — add or leave null |
| 15 | workflow type | `ar_receipt` missing from `enum_workflow_type` | `ALTER TYPE enum_workflow_type ADD VALUE 'ar_receipt'` (own migration, cannot run in the same tx as use) |
| 16 | GL account config | WHT receivable cited as `gl_setting.wht_receivable_account_id`, AR control on customer (`ar_chart_of_accounts_id`, L7590), bank account has `chart_of_accounts_id` | **verify** `gl_setting` really has a WHT-receivable, FX gain/loss, bank-charge and unapplied/deposit-liability account; add keys if not |
| 17 | running number | ARRC{YY}{MM}{0000} commented | add `ar_receipt` running-code type + `ar_receipt_running_no` draft counter key (as `ap_invoice_running_no`) |

## Posting rules — PROPOSAL (needs accounting sign-off)

Posted once at `posted` (final approval, or submit when no workflow). JV `source = ar`, ref = the receipt.
Document currency = receipt currency; all legs also carry base amounts.

| Leg | Dr | Cr | Amount |
|---|---|---|---|
| Money received | Bank/cash account of the tender (`tb_bank_account.chart_of_accounts_id`; cash/card clearing per method — Decision 4) | | `net_received_amount` |
| WHT withheld by customer | WHT receivable (`tb_ar_receipt_wht.chart_of_accounts_id`) | | `total_wht_amount` |
| Bank charge / write-off | Bank-charge expense (new setting) | | `total_charge_amount` |
| Settle invoices | | AR control (customer `ar_chart_of_accounts_id` -> gl_setting fallback, grouped by account) | Σ `applied_amount` at **invoice** rate for invoice/debit-note/deposit lines |
| Settle credit notes | Dr AR (separate Dr group, never netted — same grouping rule as ap-payment) | | |abs(applied)| for credit-note lines |
| Realised FX | loss: Dr FX loss / gain: Cr FX gain, base currency, rate 1 | | `base_applied_at_receipt_rate − base_applied_at_invoice_rate` per line, summed |
| Unapplied | | Customer advance / deposit liability | `received + wht − applied` (only if Decision 3 allows) |

- Check: Dr (bank + wht + charge [+ FX loss]) = Cr (AR [+ unapplied + FX gain]) in base by construction, as in AP payment.
- **Rounding:** `round2` per line at the document-currency and base level, base = `round2(applied × rate)`; line rounding
  differences land in the realised-FX leg (AP payment convention) — never a separate rounding account.
- **FX:** each line stores `invoice_exchange_rate` (from the invoice) and receipt rate; AR is credited at the invoice rate
  (so the AR sub-ledger clears exactly), difference to FX gain/loss. Receipt currency must equal invoice currency
  (as AP payment enforces currency match; confirm).
- **WHT:** customer deducts WHT -> we receive less cash; WHT is an asset (prepaid tax) until the 50 ทวิ is claimed.
  Cert number may be unknown at post time (FE field is free text, optional).
- **Output VAT:** assumed already recognised at invoice posting (accrual); the receipt does NOT post VAT, except the
  **TXRC** tax invoice for service BUs (`is_tax_invoice`) which would move VAT from "deferred/undue output VAT" to "output VAT".
  This needs a rule — see Decision 6 — because AR Invoice posting must show how VAT is booked first (not verified here).
- **Void (posted):** `reverseBySource` (reversal JV dated at void time, period must be open), restore `unpaid_amount`/
  `base_unpaid_amount` from the stored per-line amounts, void TXRC, status `void`, `void_gl_jv_id`; cheque/clearing status
  untouched. **Void (draft/in_review):** bookkeeping only, no JV.
- Edge: invoice voided or credited after the receipt was saved as draft -> `recheckAllocations` at post fails with a catalog error.

## Decisions needed from the user

1. **Scope of "real": one tender or many per receipt?** (a) Header-level single method/bank (matches the existing Prisma
   model; FE drops `payments[]` to one line). (b) New `tb_ar_receipt_payment` child table keeping the FE's multi-tender UI
   (cash + cheque in one receipt). Trade-off: (a) is cheap and matches AP Payment; (b) costs a migration and per-tender
   JV legs but keeps current UX. **Recommend (a)** unless the hotel/restaurant use case really mixes tenders on one receipt.
2. **Overpayment / unapplied amount.** The mock lets `received + wht > allocated`. Options: (a) block — receipt must equal
   allocations (simplest, no new account); (b) allow and post to a customer advance/deposit liability, creating a usable
   credit; (c) allow only as a draft, block at post. **Recommend (a) for Phase A**, revisit with `ar-advance-deposit`.
3. **Relation to Advance Deposit.** `enum_ar_invoice_doc_type` has `deposit` (AR invoice-side deposit docs) and the FE has a
   separate deposit mock. Should a receipt be able to settle a `deposit` line, and should deposit receipts be built here
   or in the deposit module? **Recommend:** receipt may settle `invoice|debit_note|credit_note|deposit` lines (schema already
   allows); building the deposit module itself stays out of scope.
4. **GL accounts per method.** Cash, cheque (undeposited/PDC), credit card (clearing) and promptpay: post straight to the bank
   account's COA account, or via a clearing account per method? (a) straight to `tb_bank_account.chart_of_accounts_id`
   (simple; cheques count as cash immediately); (b) clearing accounts per method in `gl_setting` + a later "clear/deposit" step.
   **Recommend (a)** now; (b) is a separate feature (cheque lifecycle).
5. **WHT, bank charge, FX defaults.** Keep the mock's 5 hard-coded WHT codes (3/5/2/1/3%) or switch to WHT tax profiles
   (`tb_ar_receipt_wht`)? Add a "bank charge / short-pay write-off" field (column exists, FE has none) and which expense
   account? Realised FX allowed at all, or force same currency as invoice and rate = invoice rate? **Recommend:** tax profiles for
   WHT, charge field added with a `gl_setting` account, same-currency only with FX leg supported by schema but
   UI-limited until accounting confirms.
6. **TXRC (tax invoice at receipt) and VAT timing.** Does a receipt ever recognise output VAT (service BUs: VAT due on
   receipt) or is VAT always booked at the AR invoice? This decides whether `is_tax_invoice` posts extra JV legs and whether
   TXRC is Phase A at all. **Recommend:** Phase A posts no VAT legs and keeps `is_tax_invoice` as a document-only flag
   (TXRC row created, no GL), until accounting provides the VAT rule.
7. **Allocation granularity.** FE allocates per invoice; DB allocates per invoice line. Pro-rata across lines, oldest line
   first, or let the user pick lines? **Recommend pro-rata by line unpaid** (deterministic, no new UI), allow line-level edit later.
8. **Workflow Phase B go/no-go and key naming.** Same rules as AP Invoice confirmed? (reject = void, send back by stage,
   creator-cannot-approve key `ar.receipt.allow-creator-approve`, one workflow per BU, DRAFT- numbers, soft-delete only
   never-numbered drafts.) Should receipts of small amounts or cash receipts skip approval (amount threshold via routing)?
   **Recommend:** exactly the AP Invoice rules, routing by total only, no cash exemption.
9. **Sequencing with deploys.** Phase A needs: migration (all tenant schemas) -> BE micro-business + gateway together ->
   allowlist the new `ar-receipts.*` api_names on every non-allow_all env -> FE. Existing localStorage mock data on users'
   browsers is discarded (no migration of mock receipts). OK to lose mock drafts? **Recommend:** yes, announce in What's New.
10. **License gating.** Does AR Receipt need a license feature key (`licenseFeature`) now? With `LICENSE_ENFORCEMENT`
    live, a new key locks the page on deploy until seeded and assigned. **Recommend:** reuse the existing AR leaf's key; no new key.

## Left to the builder
File/function names, DTO shapes, error code names, i18n wording, whether Phase A and B ship as one release, how line allocation
is stored for credit-note lines (negative `applied_amount` per AP Payment convention).

## Unverified (read before building)
`gl_setting` account columns (WHT receivable, FX, bank charge); AR Invoice VAT posting; whether `tb_customer.ar_chart_of_accounts_id`
is the account used by AR invoice posting; AP Payment currency-match rule; cheque handling in the bank/COA setup.
