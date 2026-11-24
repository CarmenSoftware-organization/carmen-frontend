# AP Payment Workflow — Design

**Date:** 2026-11-25 · **Repos:** `carmen-turborepo-backend` (micro-business + backend-gateway), `carmen-frontend`
**Status:** draft for review · by analogy with `2026-11-24-ap-invoice-workflow-design.md` (approved, built)
**Depends on:** AP Invoice workflow (`feature/ap-invoice-workflow` — shared helper, error codes, FE caps) and the
draft number standard (`nextDraftNo` / `isDraftNo`)

## Intent

BUs want AP payment vouchers keyed in by people to be approved before money is posted to GL and the
invoices' outstanding amounts are reduced. The approval chain is configured in
`/system-admin/workflow` like PR/PO/SR/JV/AP Invoice. This is the second of the accounting documents
(AP Invoice → **AP Payment** → AR Invoice → AR Receipt). Rules are **identical** to the AP Invoice
design (user decision: "Do the same for AP Payment and AR Invoice"); this document only restates them
briefly and records what is specific to a payment voucher. Where this text is silent, the AP Invoice
spec governs.

## Goals

1. `/system-admin/workflow` can create, edit, activate and deactivate an **AP Payment** workflow.
2. **One active workflow per BU** for AP Payment (race on create/activate included). Users never pick
   a workflow on the voucher.
3. Only **human-created** vouchers enter the workflow. `tb_ap_payment` has **no `doc_source` column**
   and `ApPaymentService.create` is the only writer (verified), so every voucher is human-created: the
   source gate is trivially "always eligible". No new column.
4. Approvers have exactly three actions, enforced server-side by stage role and the stage's
   `available_actions`:
   - **Approve** — next stage; the final approval posts (existing behaviour). The creator cannot approve
     their own voucher unless the BU key allows it.
   - **Reject** — **void the whole voucher**, terminal, reason required.
   - **Send back** — approver picks a previous stage (validated against `getPreviousStages` →
     `WORKFLOW_SENDBACK_STAGE_INVALID`). Destination = first (create) stage → `doc_status = draft`;
     otherwise stays `in_review` at that stage.
5. **Batch approve** (`/accounting/accounts-payable/payment-approvals`, `canBatchApprovePayment`) goes
   through the same server-side enforcement — it calls the same `approve` endpoint, so nothing new is
   needed in the backend; the FE must handle per-document refusals (see below).

## Non-goals

- AR Invoice (own spec), AR Receipt.
- Workflow scope (prefix/source) like JV; a payment-method or bank-account routing rule. Stage routing
  keeps reading `base_net_paid_amount`.
- Changing JV / AP Invoice behaviour (AP Invoice code is refactored onto shared helpers with no
  behaviour change).
- Changing the real numbering series (`AP-PV` → `APPV{YY}{MM}{0000}`).

## Anti-goals

- Any path where a voucher reaches `posted` without passing the workflow while an AP Payment workflow
  is active (including via batch approve or direct API).
- Reject / void leaving residue: a rejected voucher must keep no reservation on invoice lines (its
  allocations must stop counting against `available_amount`), no GL, no changed outstanding.
- Two active AP Payment workflows in one BU.
- Final approval posting a JV / description carrying `DRAFT-…` instead of the real number.

## Current state (verified 2026-11-25, branch `feature/ap-invoice-workflow` = base)

Backend `micro-business/src/ap/ap-payment/`:
- Enums: `enum_ap_payment_status` = `draft | in_review | posted | void` (has both); `enum_workflow_type`
  already has `ap_payment`. No source enum.
- `ap-payment.service.ts` (L numbers approximate): `create` L217 numbers the voucher **immediately**
  (`generateApPaymentNo`, type `AP-PV`, series `tb_ap_payment.doc_no`, date = `payment_date`) inside
  `runAtomic`; `update` L247 / `delete` L286 (soft delete header + **hard delete allocation rows**
  `tb_ap_payment_detail`, guarded on `draft`); `submit` L451 → `in_review` when
  `resolveWorkflowId()` (L853, "first active by created_at") returns an id, else `postDocument`;
  `approve` L486 posts on the final stage; `review` L523 and `reject` L570 **both** set `draft`;
  `void` L611 → `voidDraft` L784 (draft only) / `voidPosted` L823.
- **Gap (same as AP Invoice):** none of approve / review / reject calls
  `checkStageActionAllowed` / `checkStageActorAllowed`; `review` accepts any `stage` (forward jump
  skips approvers).
- Allocation reservation: `reservedByLine` (L868) sums `tb_ap_payment_detail.applied_amount` of
  vouchers with `doc_status IN (draft, in_review)` and `deleted_at IS NULL`. **A `void` voucher does not
  reserve** — so reject = void frees the invoice lines with no extra work, and soft-delete frees them
  too (rows are also removed).
- Posting (`ap-payment.posting.ts`): `postInTx` (L216) re-checks period + allocations, builds the JV
  (`description: ${pv.doc_no} ${pv.vendor_name}` L233), reduces invoice outstanding (`adjustUnpaid`),
  marks posted. **Nothing is written to invoices, WHT rows or GL before `postInTx`** — `sendToReview`
  only locks and re-checks availability. `voidPostedInTx` (L272) reverses the JV and restores
  outstanding; unchanged.
- WHT: `tb_ap_payment_wht` / `tb_ap_payment_expense` are child rows of the voucher; no certificate
  table or number is issued at post (grep: none) — nothing extra to void on reject.
- `workflows.service.ts` already lists in-review `ap_payment` vouchers for the structure lock
  (L721) — keep.
- Gateway `application/ap-payment/ap-payment.controller.ts`: routes + `AppIdGuard` api_names
  `ap-payment.{findAll,findOne,create,update,delete,submit,approve,review,reject,void,...}`; no
  previous-stages route; no `findAllApPayment` in `config_workflows.controller.ts`.
- rpc-contract `contracts/ap-payment.ts`: has `review`, no `previousStages`.

Frontend (`routes/accounting/accounts-payable/payment/`, `shared/`):
- `ap-payment-detail.tsx` already shows approve / send back / reject (`actions.includes(...)`, L643-675)
  via `apActions(doc, userId)` (`shared/ap-status.ts`) which offers all three to anyone in
  `user_action.execute`; the send-back dialog is **reason only, no stage picker** (L1049-1095). Draft →
  `["submit","delete"]` always.
- Batch approve: `ap-payment-approvals.route.tsx` renders `ApPaymentList approvalQueue`;
  `canBatchApprovePayment` (`ap-payment-approval.ts`) = `in_review` + `doc_version` + user is in
  `user_action.execute`; `approveBatch` (`ap-payment-list.tsx` L234) loops `approve` and swallows
  per-row errors (partial toast `approvalPartial`).
- AP Invoice round already built (FE worktree `feature/ap-invoice-workflow`): `WORKFLOW_CAPS`,
  `useApInvoicePreviousStages`, send-back dialog + required-reason reject in `ap-invoice-detail.tsx`,
  `apInvoiceActions`, `isDraftDocNo` in `lib/draft-doc-no.ts`, AP section in the registry.

## Approaches

Same decision as AP Invoice: **shared accounting-document helper** (picked). Because AP Invoice kept
`assertCanAct`, `computeAllowedActions`, `realDocNoPatch` and the send-back stage validation as
**private methods** of `ApInvoiceService`, this round first **extracts them into
`common/workflow/accounting-doc-workflow.ts`** (AP Invoice refactored onto them, behaviour unchanged),
then wires AP Payment — and AR Invoice reuses them with no copy. Rejected: copy-pasting the methods
into each service (three divergent copies of a security rule).

## Design

### Backend — micro-business

- **Shared helper additions** (`common/workflow/accounting-doc-workflow.ts`; names are the builder's call):
  - `AP_PAYMENT_ALLOW_CREATOR_APPROVE_KEY = 'ap.payment.allow-creator-approve'`
    (`AR_INVOICE_…` is added by the AR round).
  - `assertCanActOnDocument(ctx, { doc, wfDoc }, action)` — stage actor/action check
    (`workflowOrchestrator.checkStageActorAllowed`), then for `approve` the creator rule using the key
    in `ctx`. Returns `Result<null> | null` (error Result, never throw).
  - `computeAllowedActions(ctx, inReview, check)` — `[]` unless `in_review`; each of
    `approve|reject|sendback` included iff the check returns null; a throwing check = not allowed and
    logged.
  - `planSendBack(orchestrator, {...}, stage)` — validates the stage against `getPreviousStages`
    (`WORKFLOW_SENDBACK_STAGE_INVALID`), calls `buildReviewWorkflow`, then
    `orchestrator.isFirstStage(workflowId, header.workflow_current_stage, userId, buCode)` →
    `{ header, toDraft }`. **`buildReviewWorkflow` keeps returning a plain `WorkflowHeader`** (adding a
    field leaks into PR/SR/PO prisma updates — AP Invoice ruling).
  - `withRealDocNo`-style generic: `realDocNoPatch(docNo, generate: () => Promise<string>)` →
    `{ doc_no }` when `isDraftNo(docNo)` else `{}`.
  - `withRejectReason(workflow, reason)` — the three identical private `withReason` copies
    (`ap-invoice`, `ap-payment`, `ar-invoice` services) become one export.
- **Eligibility:** AP Payment has no source — no `isWorkflowEligibleSource` call (see Goals 3).
- **AP payment service:**
  - `submit`: workflow id = `resolveWorkflowId()` (re-resolved; a draft sent back keeps no stale id —
    `workflow_id: workflowId` is already written by `sendToReview`). No workflow → `postDocument`.
  - `approve` / `review` / `reject`: `assertCanActOnDocument` right after `loadForAction`; return its
    error Result.
  - `review`: stage required from the UI (API fallback to `workflow_previous_stage` stays), validated by
    `planSendBack`; status per `toDraft`; returns the resulting status.
  - `reject`: reason required (`AP_PAYMENT_REJECT_REASON_REQUIRED`); from `in_review`, one guarded
    update: `doc_status = void`, `void_at/by/reason`, workflow columns
    (`buildRejectWorkflow` + reason). Refactor `voidDraft` to take `from` + `extra` columns (as AP
    Invoice). **No** allocation delete — a void voucher no longer reserves (see Current state), and
    keeping the rows preserves the record of what was proposed.
  - `previous-stages` handler (`getPreviousStages(id)`), `allowed_actions` on `findOne` (MB serializer
    **and** gateway `@Serialize` schema).
- **Single workflow per BU:** generalise `findOtherActiveWorkflow`'s call sites in
  `workflows.service.ts` (create and update) from "type === ap_invoice" to a
  `SINGLE_ACTIVE_WORKFLOW_TYPES` set containing `ap_invoice` and `ap_payment` (AR round adds
  `ar_invoice`). Same advisory lock + `WORKFLOW_SINGLE_ACTIVE_EXISTS`.

### Backend — gateway

- `GET config/:bu_code/workflows/ap-payment` → `findAllApPayment` (`AppIdGuard('workflow.findAllApPayment')`).
- `GET :bu/ap-payment/:ap_payment_id/previous-stages` (guard `ap-payment.findOne` → no new api_name).
- `reject` DTO: `reason` required (trim, min 1). Swagger text for `review`/`reject` updated (currently
  "back to draft").
- Error codes in the catalog (below).

### Document number at submit, placeholder while draft

Today the real `APPV…` number is consumed at **create**. Change (same rule as AP Invoice):
- Create → `nextDraftNo(tx, 'ap_payment_running_no', userId)` → `DRAFT-00000001…`; no real number
  consumed. The counter never decreases; a deleted draft's number is not reused.
- **Submit** reserves the real number with `generateApPaymentNo({ prisma: tx, buCode, docDate })`
  (`docDate = payment_date` **as of submit**), inside the transaction that moves the voucher out of
  draft — `sendToReview` **and** `postDocument` (draft → posted direct) — only when
  `isDraftNo(doc_no)`. A voucher that already holds a real number (sent back to draft, pre-existing
  data) keeps it.
- Order inside the transaction: guarded lock first (a lost lock is a *returned* error and `runAtomic`
  **commits** it — AP Invoice ruling — so reserving before the lock could burn a number), then patch
  `doc_no`, **then** `loadFull` / `postInTx` so the JV description and everything downstream carry the
  real number.
- Approving from `in_review` never reserves (the number was reserved at submit).
- No migration (`doc_no` stays NOT NULL, unique with `deleted_at`). Existing drafts already hold real
  numbers — no backfill.

### Ending a document

| State | How it ends |
|---|---|
| `draft`, `DRAFT-…` (never submitted) | **Delete = soft-delete** (existing; allocations removed) |
| `draft`, real number (sent back to create stage, or pre-existing) | **Void only** (`void` endpoint, reason required); delete → `AP_PAYMENT_NUMBERED_VOID_ONLY` |
| `in_review` | Approver's **Reject** = void whole voucher; cannot be deleted |
| `posted` | **Void** = reversal JV + restore outstanding, unchanged |

### Creator cannot approve their own voucher (configurable)

Default blocked (`created_by_id` via `document-ownership.helper`). New BU key
**`ap.payment.allow-creator-approve`** in the **existing `ap` section** of
`company-profile-config-registry.ts` (second item), `boolean`, default `"false"`, en/th i18n, per
skill `add-business-setting-config`. Reject and send back are not blocked. Enforced in the shared
helper; FE hides Approve when `allowed_actions` lacks it; backend is the real guard.

### Batch approve

`approveBatch` keeps calling `approve` per document, so **enforcement is automatic**: a voucher the
user created (flag off), or one whose stage the user isn't assigned to, is refused by the backend.
FE changes: (a) keep `canBatchApprovePayment` as the cheap client gate; (b) the partial-success toast
must say *why* the first failure happened (show the backend error message of the first failed row)
instead of only counts; (c) rows are removed from the selection after the attempt (existing). The list
endpoint does **not** return `allowed_actions` (computing it per row costs an RPC + BU-config read per
voucher) — see open question 1.

### Workflow changes while vouchers are in flight

Same as AP Invoice: an `in_review` voucher keeps acting on its stored `workflow_id`; approve / reject /
send back / `previous-stages` resolve stages from `doc.workflow_id`. A draft re-resolves the current
active workflow on submit; none active → posts directly.

### Notifications

Existing per-stage Notifications tab; seed `ap_payment` notification templates only if the existing seed
does not cover the type (verify, as AP Invoice).

### Frontend

- `WORKFLOW_TYPE.AP_PAYMENT = "ap_payment"`, `WF_ROW_TYPE`, labels/i18n, type option,
  `WORKFLOW_CAPS[AP_PAYMENT] = { hasProducts:false, hasJvScope:false, totalOnlyRouting:true, canHidePrice:false }`,
  `wf-role-colors` (`create`/`approve`), structure-lock notice
  (`/accounting/accounts-payable/payment`, `doc_status = in_review`), `useApPaymentWorkflows`,
  menu entry `workflowApPayment` → `/system-admin/workflow/ap-payment` (same licenseFeature/permission
  as AP Invoice), new-workflow form blocks a second active one (backend is the real guard).
- AP section in Default Setting gains the `ap.payment.allow-creator-approve` item.
- Payment page: `apPaymentActions(doc, userId)` mirrors `apInvoiceActions` — `in_review` → backend
  `allowed_actions` (old rule only when the field is absent); `draft` → `isDraftDocNo(doc_no)` ?
  `["submit","delete"]` : `["submit","void"]`. The send-back dialog in `ap-invoice-detail.tsx` is
  **extracted** into a shared AP component (stage `Select` fed by previous-stages + optional note) and
  used by both pages; the previous-stages hook becomes `useApPreviousStages(kind, id, enabled)`
  (`kind: "invoice" | "payment"`). Reject dialog: required reason, copy says the voucher will be voided
  and cannot be reopened. `needsReason` true for `void` and `reject`.

### Deploy order

**Preflight (each env):** per BU schema count active `ap_payment` workflows (must be ≤ 1; deactivate
extras) and `tb_ap_payment` rows in `in_review` (they keep their stored workflow; their next
reject now voids instead of returning to draft — tell the BU). BE micro-business + gateway together →
allowlist `workflow.findAllApPayment` on every env that isn't allow_all (a missing api_name logs users
out) → FE (`vercel --prod`). No migration.

## Open questions for the user (recommended defaults — not blocking)

1. **Batch approve vs creator rule.** The list has no `allowed_actions`; the batch button can be
   enabled for a selection that includes the user's own vouchers and the backend will refuse those rows.
   *Default:* backend refuses, toast shows the first error message. *Alternative:* also add
   `created_by_id` to the list payload and grey out own rows client-side (but the FE can't know the BU
   flag without a config read).
2. **No source gate for payments.** Every voucher enters the workflow when one is active (no
   `doc_source` exists). *Default:* accept. (If bank-import / interface payments are planned, they will
   need a source column first.)
3. **Real number date.** The real `APPV{YY}{MM}` segment follows `payment_date` at submit, so a draft
   dated last month and submitted this month gets last month's series (same as today at create).
   *Default:* keep (period of the payment date).
4. **Reject keeps allocation rows** on the voided voucher (reservation is status-based). *Default:* keep
   for audit; soft-delete (placeholder drafts only) still removes them as today.
5. **Final approval can fail** (allocated invoice voided/paid meanwhile, period closed): the approval
   rolls back and the voucher stays `in_review`, the approver sees the error (existing behaviour).
   *Default:* unchanged; no auto-reject.
6. **Error-code naming:** per-type `AP_PAYMENT_REJECT_REASON_REQUIRED` / `AP_PAYMENT_NUMBERED_VOID_ONLY`
   (matches AP Invoice) vs one generic code. *Default:* per-type.
7. **Void of a numbered draft** requires a reason (existing `void` defaults to `'void'` when empty for
   payments). *Default:* FE requires a reason; backend default stays.

## Left to the builder

Helper function names/signatures, whether the shared send-back dialog sits in
`routes/accounting/accounts-payable/shared/`, i18n wording, `ap_payment` notification template seed.
