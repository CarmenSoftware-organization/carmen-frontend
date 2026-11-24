# AR Invoice Workflow — Design

**Date:** 2026-11-25 · **Repos:** `carmen-turborepo-backend` (micro-business + backend-gateway), `carmen-frontend`
**Status:** draft for review · by analogy with `2026-11-24-ap-invoice-workflow-design.md` (approved, built) and
`2026-11-25-ap-payment-workflow-design.md`
**Depends on:** AP Invoice workflow, **AP Payment workflow** (it extracts the shared helpers and the FE send-back
component this round reuses) and the draft number standard

## Intent

BUs want AR invoices keyed in by people to be approved before they post to GL (and before a tax invoice
is issued). Same rules as AP Invoice (user decision: "Do the same for AP Payment and AR Invoice");
this document restates them briefly and records what is specific to AR. Where this text is silent, the
AP Invoice spec governs. The config is `/system-admin/workflow` → **AR Invoice**.

## Goals

1. `/system-admin/workflow` can create, edit, activate and deactivate an **AR Invoice** workflow.
2. **One active workflow per BU** for AR Invoice. **One workflow covers all AR document types in
   `tb_ar_invoice`** — invoice, debit note, credit note (they share the table, the service and the
   status machine; no per-type workflow). Users never pick a workflow on the document.
3. Only **human-created** documents enter the workflow. Source ∈ `manual`, `copy`, `ai` go through the
   workflow; `pms_folio` (system-generated from PMS folios, no GL) posts directly on submit. Today
   `checkArHeader` accepts only `manual` (`AR_SOURCE_NOT_SUPPORTED` otherwise) and rejects the `deposit`
   doc type, so in practice every creatable document is eligible; the rule is kept so later sources
   behave correctly. The shared `isWorkflowEligibleSource` already returns true for `manual|copy|ai` and
   false for `pms_folio` — **no change to the helper**.
4. Approvers have exactly three actions, enforced server-side by stage role and the stage's
   `available_actions`:
   - **Approve** — next stage; the final approval posts (existing behaviour: JV, tax invoice, credit-note
     references). The creator cannot approve their own document unless the BU key allows it.
   - **Reject** — **void the whole document**, terminal, reason required.
   - **Send back** — approver picks a previous stage (validated against `getPreviousStages` →
     `WORKFLOW_SENDBACK_STAGE_INVALID`). First (create) stage → `doc_status = draft`; otherwise stays
     `in_review` at that stage.
5. The AR invoice page gets a full approval UI — it has **none today** (see Current state).

## Non-goals

- AR Receipt (no backend; separate round). Workflow scope like JV. A "my pending AR invoices" queue.
- Changing JV / AP Invoice / AP Payment behaviour.
- Changing the real numbering series (`AR-IV|AR-DN|AR-CN`, tax invoice `TX-*`).
- PMS folio posting, deposit documents, advance deposit / contract pages.

## Anti-goals

- Any path where a human-created AR document reaches `posted` without passing the workflow while an AR
  Invoice workflow is active.
- Reject leaving residue. Verified: **nothing is written outside the header before `postInTx`** — the
  tax invoice (`tb_ar_tax_invoice`, number `TX…`) is issued **at post**, credit-note references are
  applied (`reference_applied_amount`) **at post**, and no receipt can allocate a non-posted invoice. So
  reject = status change + workflow columns + `outstanding_amount = 0`, nothing else.
- Two active AR Invoice workflows in one BU.
- A posted invoice/JV/tax record carrying `DRAFT-…` instead of the real number.

## Current state (verified 2026-11-25, backend branch `feature/ap-invoice-workflow` as base)

Backend `micro-business/src/ar/ar-invoice/`:
- Enums: `enum_ar_invoice_status` = `draft | in_review | posted | void`; `enum_ar_invoice_source` =
  `manual | pms_folio | copy | ai`; `enum_ar_invoice_doc_type` = `invoice | debit_note | credit_note |
  deposit`; `enum_workflow_type` has `ar_invoice`.
- `ar-invoice.writer.ts` `createHeader` (~L100-125) numbers the document **at creation**
  (`generateArDocNo`, series per doc type, `tb_ar_invoice.doc_no`, date = `doc_date`); the service's
  `create` (L196) only calls the writer. `update` (L223, replaces details/references; `doc_type` and
  source are fixed after create — `mergeUpdate` hardcodes `doc_source: manual`) never changes `doc_no`.
- `ar-invoice.service.ts` (approximate lines): `delete` L258 (soft-delete header + lines, guarded on
  `draft`); `submit` L340 (`checkSubmittable`: period open, total > 0, one VAT rate on a tax invoice,
  credit-note references) → `in_review` when `resolveWorkflowId()` (L773, first active by
  `created_at`) returns an id, else `postDocument` L645; `approve` L376 posts on the final stage;
  `review` L418 and `reject` L459 **both** set `draft`; `void` L500 → `voidDraft` L709 (draft, a plain
  guarded update, **not** in `runAtomic`) / `voidPosted` L743; void requires a reason (error is
  `AR_INVOICE_LINE_INVALID` with a "void reason is required" text).
- **Gap (same as AP):** no approve/review/reject calls `checkStageActionAllowed` /
  `checkStageActorAllowed`; `review` accepts any stage; `reject` takes an optional reason.
- Posting (`ar-invoice.posting.ts`): `postInTx` re-checks period and references, plans both sides of each
  credit-note reference, builds the JV (`description: ${doc.doc_no} ${customer_name}` L191, source rows
  carry `doc_no` L324/335), issues the tax invoice (`generateArTaxInvoiceNo`, L539), applies references,
  marks posted. `voidPostedInTx` guards against live receipts (`AR_INVOICE_HAS_RECEIPT`), reverses,
  releases CN references, voids the tax invoice — unchanged.
- `workflows.service.ts` already lists in-review `ar_invoice` documents for the structure lock (L726).
- Gateway `application/ar-invoice/ar-invoice.controller.ts`: api_names `ar-invoice.{findAll,findOne,
  referenceCandidates,create,update,delete,submit,approve,review,reject,void}`; no previous-stages route;
  no `findAllArInvoice` in `config_workflows.controller.ts`. rpc-contract `contracts/ar-invoice.ts` has
  `review`, no `previousStages`. MB serializer already exposes `workflow_*` and `user_action`
  (`ar-invoice.serializer.ts` L148-154).

Frontend (`routes/accounting/accounts-receivable/`):
- `ar-invoice-detail.route.tsx` (`RegisterDetail`): only **submit** (draft), **void** (any status except
  `void` — including `in_review`, which the backend refuses) and **delete** (every draft). No approve /
  send back / reject, no stage display, no `user_action` / `allowed_actions` in
  `ArRegisterDocument` (`use-ar-register.ts`). `ArInvoiceAction` already includes `approve | review |
  reject` and a `stage` body field, but nothing calls them.
- Edit is allowed for any non-`deposit`, non-PMS draft.
- The AP Payment round (built first) provides: `WORKFLOW_CAPS` entries + `SINGLE_ACTIVE_WORKFLOW_TYPES`
  precedent, `isDraftDocNo`, the shared stage-picker component (`shared/ap-send-back-fields.tsx` in the
  AP routes), the generalised previous-stages hook, the `ap` config section.

## Approaches

Same as AP Invoice: **shared accounting-document helper** (picked). The AP Payment round already
extracted `assertCanActOnDocument`, `computeAllowedActionsFor`, `planSendBack`, `realDocNoPatch` and
`withRejectReason` into `common/workflow/accounting-doc-workflow.ts`; this round is wiring plus the FE
approval UI. A module boundary rule applies on the FE: the stage-picker component lives under
`routes/accounting/accounts-payable/` and `routes/<A>/` ↛ `routes/<B>/` imports are lint-blocked only
across *modules* (`accounting` is one module) — if ESLint still blocks the cross-folder import, move the
component to `components/share/` (builder's call; no `index.ts` barrels).

## Design

### Backend — micro-business

- **Shared:** add `AR_INVOICE_ALLOW_CREATOR_APPROVE_KEY = 'ar.invoice.allow-creator-approve'` to the
  helper file. Add `ar_invoice` to `SINGLE_ACTIVE_WORKFLOW_TYPES` (`workflows.service.ts`).
- **AR invoice service:**
  - `submit`: after `checkSubmittable`, if `!isWorkflowEligibleSource(doc.doc_source)` **or** no active
    workflow → `postDocument` (unchanged direct path); else `buildSubmitWorkflow` + `sendToReview` with
    the re-resolved workflow id (not a stale `doc.workflow_id`).
  - `approve` / `review` / `reject`: `assertCanActOnDocument` first (error Result, never throw).
  - `review`: stage per `planSendBack`; `doc_status = toDraft ? draft : in_review`; returns the status.
  - `reject`: reason required (`AR_INVOICE_REJECT_REASON_REQUIRED`); one guarded update from `in_review`:
    `doc_status = void`, `void_at/by/reason`, `outstanding_amount = 0`, workflow columns
    (`buildRejectWorkflow` + `withRejectReason`). Refactor `voidDraft` to take `from` + `extra` (as AP
    Invoice) — it stays a single guarded update.
  - `previous-stages` handler; `allowed_actions` on `findOne` (MB serializer **and** gateway schema).
- **Single workflow per BU:** `SINGLE_ACTIVE_WORKFLOW_TYPES` → `WORKFLOW_SINGLE_ACTIVE_EXISTS`, advisory
  lock `hashtext('tb_workflow:ar_invoice')`.

### Backend — gateway

- `GET config/:bu_code/workflows/ar-invoice` → `findAllArInvoice` (`AppIdGuard('workflow.findAllArInvoice')`).
- `GET :bu/ar-invoice/:ar_invoice_id/previous-stages` (guard `ar-invoice.findOne` → no new api_name).
- `reject` DTO: `reason` required. Swagger text for `review`/`reject` updated.

### Document number at submit, placeholder while draft

Today the real `ARIV|ARDN|ARCN…` number is consumed at **create** (writer). Change:
- Create → `nextDraftNo(tx, 'ar_invoice_running_no', userId)` in `ArInvoiceWriter.createHeader`; one
  counter per BU shared by invoice / debit note / credit note placeholders (their real series stay
  separate). No real number consumed.
- **Submit** reserves the real number with `generateArDocNo({ prisma: tx, buCode, docType: doc.doc_type,
  docDate: doc.doc_date })` inside the transaction that moves the document out of draft — `sendToReview`
  **and** `postDocument` (draft → posted direct, incl. `pms_folio`) — only when `isDraftNo(doc_no)`,
  after the guarded lock succeeds, before `loadFull`/`validateArLines`/`postInTx` so the JV description,
  source rows and anything else read the real number. A document that already holds a real number keeps
  it. Approving from `in_review` never reserves.
- The tax invoice number (`TX…`) is untouched: still issued at post by `generateArTaxInvoiceNo`.
- No migration; no backfill; `reserveDocumentNumbers` derives from the series prefix so `DRAFT-…` rows
  don't interfere (verify).

### Ending a document

| State | How it ends |
|---|---|
| `draft`, `DRAFT-…` | **Delete = soft-delete** (existing; header + lines) |
| `draft`, real number (sent back to create stage, pre-existing) | **Void only** (reason required); delete → `AR_INVOICE_NUMBERED_VOID_ONLY` |
| `in_review` | Approver's **Reject** = void; cannot be deleted; the plain `void` endpoint stays draft/posted only |
| `posted` | **Void** = reversal (guards unchanged, incl. `AR_INVOICE_HAS_RECEIPT`) |

### Creator cannot approve their own document (configurable)

Default blocked. New BU key **`ar.invoice.allow-creator-approve`** in a **new `ar` section** ("AR") of
`company-profile-config-registry.ts`, `boolean`, default `"false"`, en/th i18n, per skill
`add-business-setting-config`. Reject / send back not blocked. Enforced in the shared helper; FE hides
Approve via `allowed_actions`.

### Workflow changes while documents are in flight / Notifications

Same as AP Invoice: in-review documents act on their stored `workflow_id`; drafts re-resolve on submit;
existing per-stage Notifications tab, seed `ar_invoice` templates only if missing (verify).

### Frontend

- Workflow admin: `WORKFLOW_TYPE.AR_INVOICE = "ar_invoice"` + `WORKFLOW_CAPS[AR_INVOICE] = { hasProducts:false,
  hasJvScope:false, totalOnlyRouting:true, canHidePrice:false }` (routing on `base_total_amount`), role
  colours, structure-lock notice (`/accounting/accounts-receivable/invoice`, `doc_status = in_review`),
  `useArInvoiceWorkflows`, menu `workflowArInvoice` → `/system-admin/workflow/ar-invoice`, new-form
  single-active guard, labels/i18n.
- Default Setting: new `ar` section with `ar.invoice.allow-creator-approve`.
- AR invoice detail (`ar-invoice-detail.route.tsx`): extend `ArRegisterDocument` with
  `allowed_actions`, `user_action`, `workflow_name`, `workflow_current_stage`. Action bar driven by one
  pure function `arInvoiceActions(doc, canWrite)` (new, in a model file beside the route):
  `draft` → `isDraftDocNo(doc_no) ? ["submit","delete"] : ["submit","void"]` (Edit unchanged);
  `in_review` → backend `allowed_actions` (`approve | sendback | reject`); `posted` → `["void"]`;
  `void` → none. All gated by `canWrite` as today. Show the current stage next to the status (as the AP
  page does) when `in_review`.
- Dialogs: **Approve** (confirm), **Send back** (stage picker via the shared component + previous-stages
  hook for `ar-invoice` + optional note → `review` with `stage`), **Reject** (required reason, copy says
  the document will be voided and cannot be reopened). Existing void dialog stays for posted / numbered
  drafts. Existing `useArInvoiceAction` already accepts `approve | review | reject` and `stage`.
- i18n under `accounting.arRegister.*` (en/th), error catalog keys for the two new AR codes and the
  shared workflow codes if missing (ICU-safe).

### Deploy order

**Preflight (each env):** per BU schema, active `ar_invoice` workflows (≤ 1; deactivate extras) and
`tb_ar_invoice` rows in `in_review` (keep their stored workflow; the next reject now voids). BE
micro-business + gateway together → allowlist `workflow.findAllArInvoice` on every env that isn't
allow_all → FE (`vercel --prod`). No migration.

## Open questions for the user (recommended defaults — not blocking)

1. **One workflow for invoice + debit note + credit note.** *Default:* yes (one `ar_invoice` workflow
   type, routing on `base_total_amount`, no per-doc-type workflow). Alternative: a doc-type scope like JV.
2. **Credit notes need approval too?** A credit note reduces a receivable. *Default:* yes, same workflow.
3. **Void of an `in_review` AR invoice from the UI is removed** (today the button shows but the backend
   refuses). *Default:* the creator can't pull back their own in-review document except by an approver
   sending it back to the create stage. Alternative: a "withdraw" action (out of scope).
4. **AR invoice FE had no approval UI at all** — this round builds the whole action bar. *Default:*
   minimal (approve / send back / reject + stage display), no workflow-history timeline.
5. **Order of build:** the AR round assumes the AP Payment round's shared-helper extraction and the FE
   stage-picker component exist (branches stacked AP Invoice → AP Payment → AR Invoice). If AP Payment
   is not built first, do its Task 1 (extraction) and the FE component extraction here first.
6. **AR void keeps `AR_INVOICE_LINE_INVALID` for "reason required"** (existing quirk). *Default:*
   untouched for `void`; the new reject path uses the proper `AR_INVOICE_REJECT_REASON_REQUIRED`.
7. **`pms_folio` direct post** — unreachable through the API today; rule documented, not exercised in
   manual verification.
8. **Real number date:** the series segment follows `doc_date` at submit (as today at create).
   *Default:* keep.

## Left to the builder

Helper wiring details, where the stage-picker component lives (see Approaches), i18n wording,
`ar_invoice` notification template seed, whether `arInvoiceActions` sits in a new model file or an
existing one (no new test files either way).
