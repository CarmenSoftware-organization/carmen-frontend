# AP Invoice Workflow — Design

**Date:** 2026-11-24 · **Repos:** `carmen-turborepo-backend` (micro-business + backend-gateway), `carmen-frontend`
**Status:** approved 2026-11-24 · depends on project 1 (draft number standard)

## Intent

BUs want AP invoices keyed in by people to be approved before they post to GL. The approval
chain is configured in `/system-admin/workflow` like PR/PO/SR/JV. This is the first of four
accounting document types (then AP Payment, AR Invoice, AR Receipt); the shared pieces built
here should make the next ones a wiring job.

## Goals

1. `/system-admin/workflow` can create, edit, activate and deactivate an **AP Invoice** workflow.
2. **One workflow per BU** for AP Invoice. Users never pick a workflow on the document (unlike
   PR); the BU's single active workflow applies automatically.
3. Only **human-created** invoices enter the workflow: source ∈ `manual`, `grn`, `copy`,
   `excel`, `ai`. Sources `grn_auto` and `interface` post directly on submit, as today when a
   BU has no workflow.
4. Approvers have exactly three actions, each enforced server-side by stage role and the
   stage's `available_actions`:
   - **Approve** — move to the next stage; the final approval posts (existing behaviour).
     The creator cannot approve their own invoice unless the workflow allows it (see below).
   - **Reject** — **void the whole invoice**. Terminal; the invoice cannot be reopened. Reason
     required.
   - **Send back** — the approver picks a previous stage. Destination = create (first) stage
     → `doc_status = draft`, creator edits and resubmits from stage 1. Destination = an
     approval stage → stays `in_review` at that stage.

## Non-goals

- AP Payment, AR Invoice, AR Receipt workflows (next rounds; AR Receipt has no backend yet).
- Workflow scope (prefix / source selection) like JV — single workflow, fixed source rule.
- A "My pending AP invoices" queue / batch approve page.
- Changing JV workflow behaviour.
- Changing numbering for AP Payment / other doc types (they adopt the same rule in their own round).

## Anti-goals (would make this a failure even if it works)

- Any path where a human-created invoice reaches `posted` without passing the workflow while
  an AP workflow is active.
- Reject leaving residue: a rejected invoice must not keep an open tax record, outstanding
  amount, or a GRN source reservation that blocks invoicing the GRN again.
- Two active AP Invoice workflows in one BU (race on create/activate included).

## Current state (verified 2026-11-24)

Backend already has most of the plumbing:
- `enum_workflow_type` includes `ap_invoice` (also `ap_payment`, `ar_invoice`; **no** `ar_receipt`).
- `ap-invoice.service.ts`: `submit` (L893) → `in_review` when `resolveWorkflowId()` (L1341,
  "first active by created_at") returns an id, else posts. `approve` (L929) posts on final
  approval. `review` (L975, = send back) and `reject` (L1018) **both** set `doc_status = draft`.
  `voidDraft` does the void bookkeeping (void_at/by/reason, outstanding 0, tax → void) but
  only from `draft`.
- **Gap:** AP invoice never calls `workflowOrchestrator.checkStageActionAllowed` /
  `checkStageActorAllowed` — anyone can approve/reject/send back via the API, and unticked
  stage actions have no effect. PO (`purchase-order.logic.ts:447`) and JV
  (`gl-jv.service.ts:858`) do call it.
- `buildReviewWorkflow` (orchestrator L250) already detects whether the destination is the
  create stage (`isCreateStage`) and sets `user_action` accordingly.
- Gateway `config_workflows.controller.ts` has `findAll<Type>` only for PR/PO/SR/JV.
- No `previous-stages` endpoint for AP (PR/PO/SR have one, e.g.
  `purchase-requests/:id/previous-stages`).
- AP payment service duplicates the same workflow helpers (`workflowColumns` L688,
  `resolveWorkflowId` L855) — evidence for the shared helper.

Frontend:
- `types/workflows.ts` `WORKFLOW_TYPE` and `constant/workflow.ts` list PR/SR/PO/JV only.
  JV-specific branches exist in `wf-detail`, `wf-routing` (totals only), `wf-role-colors`
  (`create`/`approve`), `wf-structure-lock-notice`, `wf-insights*`, `wf-stage-general`.
- AP document page already shows approve / "return" / reject for users in
  `user_action.execute` (`ap-status.ts:50`); "return" calls backend `review`
  (`use-accounts-payable.ts:34`). No stage picker.

## Approaches

1. **Inline in AP Invoice** — patch `ap-invoice.service.ts` directly following the JV pattern.
   Fastest, smallest blast radius, but the same rules get rewritten for AP Payment and
   AR Invoice.
2. **Shared accounting-document workflow helper, wired to AP Invoice only** — *(picked)*.
   A helper in `micro-business/src/common/workflow/` owns the rules every accounting doc
   shares: source eligibility, single-workflow resolution, send-back status decision,
   reject-as-void workflow history, and the stage enforcement call. AP Invoice uses it now;
   AP Payment / AR Invoice plug in later. Slightly more work now; next rounds are wiring.
   Chosen because three more types are planned and AP Payment already has the duplicate code.

## Design

### Backend — micro-business

- **Helper** (`common/workflow/accounting-doc-workflow.ts`, name is the builder's call):
  - `isWorkflowEligibleSource(source)` → true for `manual|grn|copy|excel|ai`.
  - `resolveSingleWorkflowId(type)` → the BU's active workflow of that type, or null.
  - `sendBackTarget(nav result)` → `{ doc_status: 'draft' | 'in_review' }` from whether the
    destination is the create stage (reuse the orchestrator's `isCreateStage` logic; expose it
    rather than re-deriving).
  - Thin wrapper around `checkStageActionAllowed` / `checkStageActorAllowed` per action.
- **AP invoice service:**
  - `submit`: if source not eligible **or** no active workflow → post directly (unchanged path).
  - `approve` / `review` / `reject`: run stage enforcement first; return its error Result
    (not throw — logic-layer throws become 503).
  - `review` (send back): `stage` becomes **required** from the UI (fallback to previous stage
    stays for API compatibility); status per `sendBackTarget`.
  - `reject`: requires non-empty `reason`; from `in_review`, in one `runAtomic`: workflow
    columns (via `buildRejectWorkflow` + reason) **and** the `voidDraft` bookkeeping
    (`doc_status = void`, void_at/by/reason, outstanding 0, tax → void). Refactor `voidDraft`
    to accept the expected status rather than duplicating it.
  - Verify the GRN source of a voided invoice is released for re-invoicing (check how GRN
    eligibility filters AP invoice status; void should already be excluded).
  - Add a `previous-stages` handler for AP invoice (mirror PR's).
- **Single workflow per BU:** on create and on activate of an `ap_invoice` workflow, reject if
  another active one exists. Same pattern as JV's overlap check: advisory lock
  (`hashtext('tb_workflow:ap_invoice')`) + check + write in one transaction. New catalog error
  (e.g. `WORKFLOW_SINGLE_ACTIVE_EXISTS`), registered in the FE error catalog.
- **Structure lock / linked documents:** `workflows.service.ts` L666 already finds in_review
  AP invoices for a workflow — keep.

### Backend — gateway

- `GET config/workflows/ap-invoice` → `findAllApInvoice` (`AppIdGuard('workflow.findAllApInvoice')`).
- `GET :bu/ap-invoices/:id/previous-stages` (new api_name → allowlist).
- `reject` DTO: `reason` required (min length 1 after trim).
- Error codes surfaced through the gateway catalog.

### Frontend

- `WORKFLOW_TYPE.AP_INVOICE = "ap_invoice"`, `WF_ROW_TYPE`, labels + i18n (en/th), type option.
- Workflow admin for AP Invoice behaves like JV where JV differs from PR: routing on total
  only, roles `create`/`approve`, no products tab, structure-lock notice mapping (`in_review`).
  Prefer a per-type capability map over adding more `=== JV || === AP_INVOICE` checks.
- New workflow: when an active AP Invoice workflow exists, the type option is disabled with a
  hint pointing to the existing one; backend error is the real guard.
- AP invoice page: rename **Return → Send back**; send-back dialog with a stage picker fed by
  `previous-stages` (pattern from PR/SR dialogs). Reject dialog: required reason, copy says the
  invoice will be voided and cannot be reopened. Button visibility respects
  `available_actions` the same way PO does.
- Invoices with ineligible source never show approval buttons (they never reach `in_review`).

### Document number at submit, placeholder while draft (user decision)

Today `createDraft` → `writeDraftInTx` reserves the real running number on first save
(`ap-invoice.service.ts:287`, `generateApDocNo`). Change:

- **Create / save as draft** writes a placeholder from the shared helper
  `nextDraftNo(tx, 'ap_invoice_running_no', userId)` → `DRAFT-00000001`, `DRAFT-00000002`, …
  (user decision: "DRAFT- +1, 8 digits"). The helper's format and prefix are standardised by
  **project 1** (`2026-11-24-draft-number-standard-design.md`), which must ship first. One counter
  per BU shared by the four AP doc types; the counter never decreases, so a deleted draft's
  number is never reused. No real running number is consumed.
- **Submit** reserves the real number with `generateApDocNo` (same `doc_date`, same series lock)
  inside the transaction that moves the invoice out of draft — whether it goes to `in_review`
  or posts directly (no workflow / ineligible source). A doc that already has a real number
  (e.g. sent back to draft) keeps it on resubmit.
- `grn_auto` invoices are created and posted in one step → real number immediately, as today.
- Verify `reserveDocumentNumbers` derives the next number from the series prefix (e.g.
  `APIV2609%`) so `DRAFT-…` rows never affect it.
- Existing drafts already hold real numbers — no backfill; they follow the "has a number" rule.
- No migration (`doc_no` stays NOT NULL).

### Ending a document: soft-delete only without a running number (user decision)

| State | How it ends |
|---|---|
| `draft` with placeholder `DRAFT-…` (never submitted) | **Delete = soft-delete** (existing `ApInvoiceService.delete`: header + lines `deleted_at`/`deleted_by_id`, tax → void) |
| `draft` with a real number (sent back to the create stage, or pre-existing data) | **Void only** (`voidDraft`); delete returns `AP_INVOICE_IMMUTABLE` (or a new specific code) |
| `in_review` | Approver's **Reject** = void whole invoice; cannot be deleted |
| `posted` | **Void** = reversal, unchanged |

Backend `delete` must check the placeholder (`startsWith(DRAFT_NO_PREFIX)` from the shared helper), not
just `doc_status`. FE shows Delete only for placeholder drafts and Void for numbered drafts;
list and detail render the placeholder as-is (the placeholder is readable, show it as-is). No hard delete anywhere.

### Creator cannot approve their own invoice (configurable)

- **Default: blocked.** The invoice's creator (`created_by_id`, reuse
  `common/helpers/document-ownership.helper.ts`) cannot **approve** it, even if they are in the
  stage's assigned users. New catalog error (e.g. `WORKFLOW_CREATOR_CANNOT_APPROVE`). Reject
  and send back are not blocked by this rule — only approve. *(design call: the risk is money
  going out without a second person; rejecting/sending back your own invoice is harmless.)*
- **Setting:** a BU-level boolean on **`/system-admin/default-setting`**, grouped by module.
  New registry section **`ap`** ("AP") in
  `routes/system-admin/company-profile/company-profile-config-registry.ts` with key
  **`ap.invoice.allow-creator-approve`** ("Allow the creator to approve their own AP invoice"),
  `datatype: boolean`, `defaultValue: "false"`. Follow skill `add-business-setting-config`
  (registry + en/th i18n + registry test; no component changes). Stored in backstage
  `tb_business_unit.config`; backend reads it with `tenantService.getBuConfig(tenant_id, key,
  false)` and accepts `true` / `'true'` — same as `po.group-by-pr-comment`
  (`purchase-order.service.ts` `isGroupByPrComment`). Absent = blocked.
  *(user decision: one BU-level page, separated by module. Key naming per document is my call so
  later rounds add `ap.payment.allow-creator-approve` to the same AP section and
  `ar.invoice.allow-creator-approve` to a new AR section.)*
- The helper takes the config key as a parameter, so each document type passes its own.
- Enforced in the shared helper, so AP Payment / AR Invoice inherit it. FE hides Approve for
  the creator when blocked; backend is the real guard. Not applied to PR/PO/SR/JV in this round.

### Workflow changes while invoices are in flight *(design call)*

- An invoice `in_review` keeps acting on its stored `workflow_id` even if that workflow is later
  deactivated — approve / reject / send back / `previous-stages` all resolve stages from
  `doc.workflow_id`, never from `resolveSingleWorkflowId`.
- A draft (new, or sent back to the create stage) re-resolves the **current** active workflow
  on submit (`resolveSingleWorkflowId`), replacing any stale `workflow_id`. If none is active,
  or the source is ineligible, it posts directly.

### Notifications *(design call)*

Reject and send back notify through the existing per-stage Notifications tab (recipients per
action), same as PR/PO/SR/JV — no new mechanism. Seed `ap_invoice` notification templates if
the existing seed does not cover the type.

### Deploy order

**Preflight (each env):** count active `ap_invoice` workflows per BU schema and AP invoices in
`in_review`. Expected zero (the FE could never create one). If any BU has ≥2 active, deactivate
the extras before deploying.

BE micro-business + gateway together → allowlist `workflow.findAllApInvoice` and the
previous-stages api_name on every env that isn't allow_all (missing api_name logs users out)
→ FE (`vercel --prod`). No migration.

## Left to the builder

File/function names, helper's exact API, i18n wording, whether the type-capability map lives in
`constant/workflow.ts` or the workflow route folder, notification template seed for
`ap_invoice` (check whether the seed covers it; add if missing).
