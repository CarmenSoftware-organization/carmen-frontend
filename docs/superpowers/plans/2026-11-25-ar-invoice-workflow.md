# AR Invoice Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **User preference (overrides TDD):** skip "write the failing test / run to see it fail"; do not create new `*.spec.ts` / `*.test.ts(x)` files. Do update **existing** specs/tests broken by the change. Every task runs type-check (+ lint where cheap) and the existing tests of the touched folders. Manual verification (curl/browser) is listed at the end for the user. Tell every implementer subagent this explicitly (they do not inherit it).

**Goal:** AR Invoice (invoice / debit note / credit note) can go through a BU's single approval workflow (approve / reject = void / send back to a chosen stage), with creator-cannot-approve (BU-configurable), draft placeholder numbers, soft-delete only for never-numbered drafts, and — new for AR — a full approval UI on the invoice page.

**Architecture:** Reuse the shared helpers the AP Payment round extracted into `common/workflow/accounting-doc-workflow.ts` (`assertCanActOnDocument`, `computeAllowedActionsFor`, `planSendBack`, `realDocNoPatch`, `withRejectReason`); `ArInvoiceService` gains enforcement and the new status rules; the single-active guard gets `ar_invoice`; the writer issues the placeholder number. Frontend adds the type to `/system-admin/workflow`, a new AR section in Default Setting, and an action bar + dialogs on the AR invoice detail page driven by backend `allowed_actions`.

**Tech Stack:** NestJS micro-business + backend-gateway, Prisma, `@repo/error-catalog`, `@repo/rpc-contract`; React 19 + React Router 7 + TanStack Query + use-intl (FE).

**Spec:** `docs/superpowers/specs/2026-11-25-ar-invoice-workflow-design.md` (carmen-frontend). Templates: `…/2026-11-24-ap-invoice-workflow-design.md` and `…/2026-11-25-ap-payment-workflow-design.md` + plans. The AP Invoice build log (`wt-ap-invoice-workflow/.superpowers/sdd/2026-11-24-ap-invoice-workflow/progress.md`) holds the rulings restated in Global Constraints.

**Repos / branches**
- Backend `carmen-turborepo-backend`: branch `feature/ar-invoice-workflow` **off `feature/ap-payment-workflow`** (which is off `feature/ap-invoice-workflow` → `feature/draft-number-standard` / PR #1108). **Precondition:** `common/workflow/accounting-doc-workflow.ts` already exports the shared helpers listed above. If AP Payment has not been built, do AP Payment plan Task 1 (extraction) first and branch off that. PR base = the previous branch until it merges, then retarget. Never `--delete-branch` a base while a PR is stacked on it.
- Frontend `carmen-frontend`: branch `feature/ar-invoice-workflow` **off FE `feature/ap-payment-workflow`** (needs `WORKFLOW_CAPS`, `isDraftDocNo`, the shared stage-picker component, the generalised previous-stages hook).
- Commit messages in Thai; PR bodies in English. **No push / PR without asking the user first.**

## Global Constraints

- Workflow-eligible `doc_source`: `manual`, `copy`, `ai` (via the existing shared `isWorkflowEligibleSource` — unchanged). `pms_folio` posts directly on submit. All AR doc types in `tb_ar_invoice` (invoice, debit_note, credit_note) share **one** `ar_invoice` workflow.
- One active `ar_invoice` workflow per BU; documents never choose a workflow.
- Reject = **void the whole document** from `in_review` (terminal); `reason` required (non-empty after trim), stored in `void_reason` and on the `rejected` workflow-history entry; `outstanding_amount = 0`. No tax-invoice/reference/receipt cleanup is needed — those are only written at post (verified).
- Send back: approver picks a previous stage; **validate against `getPreviousStages`** (`WORKFLOW_SENDBACK_STAGE_INVALID`) — forward jumps skip approvers. First stage → `draft`; approval stage → stays `in_review`. Use `workflowOrchestrator.isFirstStage(workflowId, stageName, userId, buCode)`; **`buildReviewWorkflow` must NOT gain return fields**.
- Creator (`created_by_id`) cannot **approve** unless BU config key **`ar.invoice.allow-creator-approve`** is `true`/`'true'` (absent = false). Reject/send back unaffected.
- Draft number: `nextDraftNo(tx, 'ar_invoice_running_no', userId)` → `DRAFT-%08d` (one counter for invoice/DN/CN); the real number (`generateArDocNo({ docType, docDate })`) is reserved at the first submit, in the transaction that moves the document out of draft, only when `isDraftNo(doc_no)`, **after** the guarded lock succeeds and **before** `loadFull`/`validateArLines`/`postInTx`. The tax invoice number is untouched.
- `runAtomic` **commits** a callback that *returns* an error Result and rolls back only on `abortWith`/throw. A lost guarded lock is returned (nothing written); anything after the number is reserved must `abortWith`.
- Delete (soft) only when `doc_status = draft` **and** `isDraftNo(doc_no)`; a numbered draft can only be voided (reason required, existing).
- An `in_review` document keeps acting on its stored `workflow_id`; a draft re-resolves the current active workflow on submit.
- Logic-layer errors are returned as `Result`, never thrown.
- Only `workflow.findAllArInvoice` is a new api_name (previous-stages reuses `ar-invoice.findOne`) — list it in the PR deploy notes (allowlist, else users get logged out).
- No migration. Deploy: BE (micro-business + gateway together) → allowlist `workflow.findAllArInvoice` → FE.
- FE: Thai UI strings through i18n (en + th), ICU messages must not contain `{{ }}` or `<word>`; module boundary and design-system rules in `CLAUDE.md` apply (UI primitives from `components/ui/`, status-ink tokens, both themes).

## Review Focus

1. **Posted with the placeholder number** — draft submitted with no workflow (or a `pms_folio`) posts directly; JV description (`${doc.doc_no} …`), the posting source rows (`doc_no`, posting.ts ~L324/335) and `validateArLines` must see the real number reserved in the same transaction; the tax invoice is still issued at post. Task 3.
2. **Real number uses the right series** — a credit note gets `ARCN…`, a debit note `ARDN…`, an invoice `ARIV…`, all from one `DRAFT-` counter. Task 3.
3. **Creator is the only approver of a stage** with the flag off → refused with `WORKFLOW_CREATOR_CANNOT_APPROVE`; `allowed_actions` lacks `approve`; the page shows no Approve button. Tasks 4, 5, 9.
4. **Send back to an approval stage, then that approver approves**; **a later stage is refused**. Task 4.
5. **Reject on an invoice that references credit notes** — references are only applied at post, so reject must leave every referenced CN's `reference_applied_amount` and the invoice's `tb_ar_invoice_reference` rows untouched (and the CN still available). Task 4 (read-only confirm + manual).
6. **Two admins activate an AR Invoice workflow at once** — exactly one wins. Task 2.

---

## Backend (`carmen-turborepo-backend`, MB = `apps/micro-business/src`, GW = `apps/backend-gateway/src`)

### Task 1: AR error codes + creator-approve key

**Files:**
- Modify: `packages/error-catalog/src/catalog.ts` (next free ids in `MODULE.AR_INVOICE` — verify), rebuild (`bun run build` in `packages/error-catalog`) so `dist/` and `reference/error-codes.*` match
- Modify: `MB/common/workflow/accounting-doc-workflow.ts` — add the key const only

**Interfaces — Produces:**
- `export const AR_INVOICE_ALLOW_CREATOR_APPROVE_KEY = 'ar.invoice.allow-creator-approve'`
- Catalog codes (http 422, EN+TH): `AR_INVOICE_REJECT_REASON_REQUIRED` — "A reason is required to reject this document" / "ต้องระบุเหตุผลในการปฏิเสธเอกสารนี้"; `AR_INVOICE_NUMBERED_VOID_ONLY` — "This document already has a document number and can only be voided" / "เอกสารนี้ออกเลขที่เอกสารแล้ว จึงทำได้เพียงยกเลิก (void) เท่านั้น"

- [ ] **Step 1:** Precondition check — the shared helpers from the AP Payment round exist (`grep -n "assertCanActOnDocument\|planSendBack\|realDocNoPatch\|withRejectReason\|computeAllowedActionsFor" MB/common/workflow/accounting-doc-workflow.ts`); if not, stop and do the AP Payment plan's Task 1 first.
- [ ] **Step 2:** Add the key + the two codes; rebuild the package.
- [ ] **Step 3:** `bunx tsc --noEmit` (MB + GW); `bunx jest src/common/workflow` → pass.
- [ ] **Step 4:** Commit `feat(workflow): error code และ key ของ workflow AR Invoice`.

### Task 2: One active AR Invoice workflow per BU + gateway list endpoint

**Files:**
- Modify: `MB/master/workflows/workflows.service.ts` — add `enum_workflow_type.ar_invoice` to `SINGLE_ACTIVE_WORKFLOW_TYPES` (introduced by the AP Payment round; `create` and `update` branches already use it)
- Modify: `GW/config/config_workflows/config_workflows.controller.ts` — add `findAllArInvoice` after `findAllApPayment` (`@Get('ar-invoice')`, before any `:workflow_id` route)
- Modify: `GW/backstage/applications/app-api-catalog.generated.ts` via `bun run scripts/generate-app-api-catalog/run.ts`; add the seed grant next to `workflow.findAllApPayment` in `packages/prisma-shared-schema-backstage/prisma/seed.application-api.data.ts`
- Modify (existing spec): `MB/master/workflows/workflows.service.spec.ts` only if mocks break

**Interfaces — Produces:**
- Create/activate of an `ar_invoice` workflow checks + writes in one `$transaction` under `pg_advisory_xact_lock(hashtext('tb_workflow:ar_invoice'))`; conflict → `WORKFLOW_SINGLE_ACTIVE_EXISTS { workflow: name }`.
- GW `GET config/:bu_code/workflows/ar-invoice` → `findAllArInvoice`, `AppIdGuard('workflow.findAllArInvoice')`, `findAllByType(enum_workflow_type.ar_invoice, …)`, operationId `configWorkflows_findAllArInvoice`; decorators identical to the AP Payment handler.

- [ ] **Step 1:** Extend the set; verify (read) that `create` really uses the set for the new type.
- [ ] **Step 2:** Gateway handler; regenerate the api catalog; seed grant.
- [ ] **Step 3:** `bunx tsc --noEmit` (MB + GW); `bunx jest src/master/workflows`; `bun run audit:app-api-catalog-drift` if present → pass.
- [ ] **Step 4:** Commit `feat(workflow): AR Invoice มี workflow ที่ active ได้เส้นเดียวต่อ BU และ endpoint รายการ`.

### Task 3: AR Invoice numbering — placeholder on create, real number at submit, delete rule

**Files:**
- Modify: `MB/ar/ar-invoice/ar-invoice.writer.ts` — `createHeader` (~L100-125: replace `generateArDocNo` with `nextDraftNo`)
- Modify: `MB/ar/ar-invoice/ar-invoice.service.ts` — `create` (~L196, result `doc_no`), `postDocument` (~L645), `sendToReview` (~L675), `delete` (~L258)

**Interfaces:**
- Consumes: `nextDraftNo`, `isDraftNo` (`MB/common/helpers/draft-running-no.helper.ts`); `realDocNoPatch` (shared); existing `generateArDocNo({ prisma: tx, buCode, docType, docDate })` (`ArDocType` excludes `deposit`).
- Produces: const `AR_INVOICE_RUNNING_NO_KEY = 'ar_invoice_running_no'` (export from the writer or `ar-invoice.running-code.ts`; one place); private `withRealDocNo(tx, id): Promise<ArInvoiceFull>` — `loadFull`, and when `isDraftNo(doc_no)` persist `generateArDocNo({ prisma: tx, buCode: this.bu_code, docType: doc.doc_type as ArDocType, docDate: new Date(doc.doc_date) })` and return the row carrying it (abort `AR_INVOICE_NOT_FOUND` when missing).

- [ ] **Step 1:** `createHeader`: placeholder via `nextDraftNo(tx, AR_INVOICE_RUNNING_NO_KEY, ctx.user_id)`; `create` still returns `{ id, doc_no }` (placeholder). Update the existing `ar-invoice.running-code.spec.ts` only if it breaks.
- [ ] **Step 2:** `postDocument` and `sendToReview`: after `guardedUpdate` succeeds replace `loadFull(tx, id)` with `withRealDocNo(tx, id)` so `validateArLines`, `postInTx` (JV description, source rows) see the real number. Approve-from-`in_review` goes through `postDocument` too — a no-op for the number. `submit` results include `doc_no`.
- [ ] **Step 3:** `delete`: select `doc_no`; `!isDraftNo(doc_no)` → `AR_INVOICE_NUMBERED_VOID_ONLY`.
- [ ] **Step 4:** Read-only checks, note in the report: (a) `reserveDocumentNumbers` derives from the series prefix (`ARIV26…`) so `DRAFT-…` rows never affect it; (b) the three doc types still get distinct series; (c) the tax-invoice reference/`original_tax_invoice_no` logic never reads the draft number; (d) grep AR receipt / period-end / report queries for assumptions about `tb_ar_invoice.doc_no` format.
- [ ] **Step 5:** `bunx tsc --noEmit`; `bunx jest src/ar` → pass.
- [ ] **Step 6:** Commit `feat(ar-invoice): ฉบับร่างถือเลข DRAFT- ออกเลขจริงตอน submit และลบได้เฉพาะใบที่ยังไม่มีเลข`.

### Task 4: AR Invoice actions — eligibility, enforcement, creator rule, reject = void, send back by stage

**Files:**
- Modify: `MB/ar/ar-invoice/ar-invoice.service.ts` — `submit` (~L340), `approve` (~L376), `review` (~L418), `reject` (~L459), `voidDraft` (~L709), local `withReason` (~L1145, delete → `withRejectReason`); constructor (inject `TenantService`; check `ar-invoice.module.ts` imports `TenantModule`, add if not)
- Modify: `GW/application/ar-invoice/ar-invoice.controller.ts` — `@ApiOperation`/`@ApiBody` text for `review` (~L443) and `reject` (~L491, currently "back to draft"); `GW/application/ar-invoice/swagger/request.ts` reject DTO: `reason` required

**Interfaces:**
- Consumes: Task 1 key + codes; shared helpers; `isWorkflowEligibleSource`; `workflowOrchestrator.isFirstStage`.
- Produces: private `assertCanAct(doc: ArInvoiceFull, action: StageActionKey)` → thin wrapper over `assertCanActOnDocument` with `AR_INVOICE_ALLOW_CREATOR_APPROVE_KEY`.

- [ ] **Step 1:** `submit`: after `checkSubmittable`, `workflowId = isWorkflowEligibleSource(doc.doc_source) ? await this.resolveWorkflowId() : null`; null → `postDocument` (direct); else `buildSubmitWorkflow` + `sendToReview` with that id (re-resolved, not `doc.workflow_id`).
- [ ] **Step 2:** `approve` / `review` / `reject`: `assertCanAct` right after `loadForAction`; return its error.
- [ ] **Step 3:** `review`: `stage = data.stage || doc.workflow_previous_stage` (API compatibility, missing → `AR_INVOICE_IMMUTABLE` as today); `planSendBack` validates + builds; `doc_status = toDraft ? draft : in_review`; return the status.
- [ ] **Step 4:** `voidDraft` gains `from: enum_ar_invoice_status` (default `draft`) and optional `extra` patch (stays a single guarded update). `reject`: `reason?.trim()` required → `AR_INVOICE_REJECT_REASON_REQUIRED`; call `voidDraft(id, doc.doc_version, reason, in_review, workflowColumns(withRejectReason(buildRejectWorkflow(...), reason)))`; return `{ id, doc_status: void }`. The `void` endpoint keeps calling it with `draft` and its existing reason rule.
- [ ] **Step 5:** Read-only confirm (Review Focus 5): reading `ar-invoice.posting.ts`, no CN reference / tax invoice / receipt row is written before `postInTx`; so reject needs no extra cleanup. Note the result in the report.
- [ ] **Step 6:** Update the gateway Swagger texts and the reject DTO.
- [ ] **Step 7:** `bunx tsc --noEmit` (MB + GW); `bunx jest src/ar src/common/workflow` → pass.
- [ ] **Step 8:** Commit `feat(ar-invoice): workflow บังคับสิทธิ์ตาม stage, reject = void ทั้งใบ, send back ตาม stage และกันผู้สร้างอนุมัติเอง`.

### Task 5: Previous stages + `allowed_actions` on the document

**Files:**
- Modify: `packages/rpc-contract/src/contracts/ar-invoice.ts` — add `previousStages: rpc('ar-invoice.previous-stages','micro-business').restTodo()`; rebuild if the package has a build
- Modify: `MB/ar/ar-invoice/ar-invoice.controller.ts` (`@MessagePattern(ArInvoice.previousStages.pattern)`) + service method
- Modify: `GW/application/ar-invoice/ar-invoice.controller.ts` + its service — `GET ':ar_invoice_id/previous-stages'`, `AppIdGuard('ar-invoice.findOne')` (reuse → no allowlist change), `ParseUUIDPipe`; mind route ordering against `:ar_invoice_id/reference-candidates`
- Modify: MB `findOne` (~L133) + `MB/ar/ar-invoice/dto/ar-invoice.serializer.ts` + GW `swagger/response.ts` (both layers — a field missing from the gateway `@Serialize` schema is silently dropped)

**Interfaces — Produces:**
- MB `getPreviousStages(id): Promise<Result<Record<string, string>>>` — not found → `AR_INVOICE_NOT_FOUND`; no workflow/stage → `Result.ok({})`; else `workflowOrchestrator.getPreviousStages(workflow_id, workflow_current_stage, userId, buCode)`.
- `findOne` response gains `allowed_actions: ('approve'|'reject'|'sendback')[]` via `computeAllowedActionsFor` — empty unless `in_review`; computed once per `findOne`.

- [ ] **Step 1:** Contract + MB handler + GW route.
- [ ] **Step 2:** `allowed_actions` in MB `findOne` + both serializer schemas.
- [ ] **Step 3:** `bunx tsc --noEmit` (MB + GW); `bunx jest src/ar` → pass.
- [ ] **Step 4:** Commit `feat(ar-invoice): endpoint stage ก่อนหน้า และ allowed_actions ของผู้ใช้ปัจจุบัน`.

### Task 6: Backend check + PR

- [ ] **Step 1:** Root `bun run check-types`; `cd apps/micro-business && bunx jest`; gateway jest — compare with the base branch failure list (gateway has known pre-existing failures), no new failures.
- [ ] **Step 2:** **Ask the user before pushing.** PR (English), base `feature/ap-payment-workflow`: summary, deploy order (BE MB+GW together → allowlist `workflow.findAllArInvoice` → FE), new error codes, BU key `ar.invoice.allow-creator-approve`, stacked-PR note, preflight SQL (active `ar_invoice` workflows per BU, `in_review` documents).

## Frontend (`carmen-frontend`)

### Task 7: Workflow admin supports AR Invoice

**Files:**
- Modify: `types/workflows.ts` (`AR_INVOICE = "ar_invoice"`), `constant/workflow.ts` (`WORKFLOW_CAPS[AR_INVOICE] = { hasProducts:false, hasJvScope:false, totalOnlyRouting:true, canHidePrice:false }`, `workflowTypeField`, `WF_ROW_TYPE`, `WORKFLOW_TYPES`, `WF_TYPE_I18N_KEY`)
- Modify: `routes/system-admin/workflow/wf-role-colors.ts` (`["create","approve"]`), `wf-structure-lock-notice.tsx` (`{ path: "/accounting/accounts-receivable/invoice", status: "doc_status", value: "in_review" }` — check `routes/router.tsx`), `wf-new-form.tsx` (option disabled + hint when an active one exists; locked-slug route `/workflow/ar-invoice/new` blocks submit — follow the AP code), `wf-component.tsx` (`titleArInvoice`)
- Modify: `hooks/use-workflow.ts` (`WORKFLOW_DOC_TYPES` + `"ar-invoice"`, `WORKFLOW_TYPE_BY_DOC_TYPE`, `useArInvoiceWorkflows`, `WORKFLOW_LIST_HOOKS`), `constant/module-list.ts` (`workflowArInvoice` → `/system-admin/workflow/ar-invoice`, same licenseFeature/permission as AP Invoice/Payment — skill `license-gating`: reuse the existing key, do not invent a feature key), System Admin landing card if it lists workflow types
- Modify: `messages/en.json` + `messages/th.json` — `systemAdmin.workflow.typeArInvoice`, `titleArInvoice`, `arInvoiceSingleActiveHint` (use `{workflow}`), menu `workflowArInvoice`
- Modify (existing tests): `routes/system-admin/workflow/wf-menu.test.ts` and any test enumerating workflow types

- [ ] **Step 1:** Types/constants/caps; grep every `WORKFLOW_TYPE.AP_PAYMENT` hit and add the AR sibling (prefer `WORKFLOW_CAPS`).
- [ ] **Step 2:** Hooks, slug, menu, titles, landing, new-form guard, i18n.
- [ ] **Step 3:** `bun run typecheck`; `bun test:run routes/system-admin/workflow hooks` → pass.
- [ ] **Step 4:** Commit `feat(workflow): ตั้ง workflow ของ AR Invoice ได้ (เส้นเดียวต่อ BU)`.

### Task 8: Default Setting — new AR section

Follow skill `add-business-setting-config`.

**Files:** `routes/system-admin/company-profile/company-profile-config-registry.ts` (new section after `ap`), `messages/en.json` + `th.json`, existing `company-profile-config-registry.test.ts` (extend the existing describe — allowed, not a new file).

- Section `{ id: "ar", titleKey: "sections.ar", descKey: "sections.arDesc", items: [{ key: "ar.invoice.allow-creator-approve", datatype: "boolean", defaultValue: "false", label: "Allow the creator to approve their own AR invoice", labelKey: "config.arInvoiceAllowCreatorApprove" }] }`
- i18n en: `"AR"`, `"Accounts Receivable settings for this business unit."`, label as above · th: `"AR"`, `"การตั้งค่า Accounts Receivable ของหน่วยธุรกิจนี้"`, `"อนุญาตให้ผู้สร้างอนุมัติ AR Invoice ของตัวเอง"`

- [ ] **Step 1:** Registry + i18n + registry test.
- [ ] **Step 2:** `bun run typecheck`; `bun test:run routes/system-admin/company-profile` → pass.
- [ ] **Step 3:** Commit `feat(default-setting): หมวด AR ตั้งค่าให้ผู้สร้างอนุมัติ AR Invoice ของตัวเองได้`.

### Task 9: AR Invoice page — action bar from `allowed_actions`, send-back stage picker, reject = void, delete vs void

**Files:**
- Modify: `routes/accounting/accounts-receivable/use-ar-register.ts` — `ArRegisterDocument` gains `allowed_actions?: ("approve"|"reject"|"sendback")[]`, `user_action?`, `workflow_name?: string | null` (`workflow_current_stage` exists); `ArInvoiceAction` already has `approve | review | reject` — keep (UI "sendback" → `review`); add `useArInvoicePreviousStages(id, enabled)` (or reuse the generalised AP hook with a new `kind: "ar-invoice"` if it generalises cleanly) + `API_ENDPOINTS.AR_INVOICE_PREVIOUS_STAGES(bu, id)` → `/api/proxy/api/${bu}/ar-invoice/${id}/previous-stages` and `QUERY_KEYS.AR_INVOICE_PREVIOUS_STAGES` (check `constant/api-endpoints.ts` for how `AR_INVOICE_LIST` is built)
- Create (model file, not a test): `routes/accounting/accounts-receivable/ar-invoice-actions.ts` — `arInvoiceActions(doc: Pick<ArRegisterDocument, "doc_status"|"doc_no"|"allowed_actions">): ("submit"|"delete"|"void"|"approve"|"sendback"|"reject")[]`: draft → `isDraftDocNo(doc_no) ? ["submit","delete"] : ["submit","void"]`; in_review → `allowed_actions ?? []`; posted → `["void"]`; void → `[]`
- Modify: `routes/accounting/accounts-receivable/ar-invoice-detail.route.tsx` — replace the ad-hoc `voidDocument` / `remove` / `submit` gating with `arInvoiceActions` (still `&& canWrite`); `InvoiceView` toolbar/footer gains Approve / Send back / Reject buttons; confirmation dialog state grows from `"submit" | "void"` to `"submit" | "void" | "approve" | "sendback" | "reject"`; **Send back** renders the shared stage picker (`routes/accounting/accounts-payable/shared/ap-send-back-fields.tsx` from the AP Payment round — if ESLint blocks the cross-folder import, move it to `components/share/` and update the AP pages) with a required stage and optional note → `action.mutate({ id, action: "review", stage, reason: note, doc_version })`; **Reject** requires a reason (copy: the document will be voided and cannot be reopened) → `action: "reject"`; **Approve** is a confirm → `action: "approve"`; void dialog unchanged; show the current stage (`workflow_current_stage`) beside the status badge when `in_review`
- Modify: `messages/en.json` + `th.json` — `accounting.arRegister.*`: `approve`, `approveTitle`, `approveConfirm`, `sendBack`, `sendBackTitle`, `sendBackStage`, `sendBackStagePlaceholder`, `sendBackNoStages`, `sendBackStagesError`, `reject`, `rejectTitle`, `rejectConfirm` (void wording), `rejectReasonRequired`, `stageLabel`; `errors.byCode` for `AR_INVOICE_REJECT_REASON_REQUIRED`, `AR_INVOICE_NUMBERED_VOID_ONLY` (`WORKFLOW_CREATOR_CANNOT_APPROVE` / `WORKFLOW_SENDBACK_STAGE_INVALID` exist from earlier rounds — verify). ICU-safe.
- Modify (existing tests): any AR test asserting the old void/delete/submit gating — `ar-staging-ui.test.tsx`, `ar-receipt-ui.test.tsx`, `ar-invoice-draft-form.test.tsx`, `use-ar-register.test.tsx` (check each for detail-page assertions)

- [ ] **Step 1:** Types, `arInvoiceActions`, previous-stages hook/endpoint/key.
- [ ] **Step 2:** Detail page: gating through `arInvoiceActions`; approve / send back / reject dialogs; stage next to status; Delete only for placeholder drafts, Void for numbered drafts and posted, none for `in_review`.
- [ ] **Step 3:** i18n (ICU-safe), both themes, mobile width check (no horizontal scroll) — follow skill `carmen-blue-ui-design` for the toolbar.
- [ ] **Step 4:** `bun run typecheck`; `bun test:run routes/accounting/accounts-receivable` → pass; `bunx eslint` on touched files.
- [ ] **Step 5:** Commit `feat(ar-invoice): ปุ่มตาม allowed_actions, approve / send back เลือก stage / reject = void และลบได้เฉพาะใบ DRAFT`.

### Task 10: Frontend check + PR

- [ ] **Step 1:** `bun run typecheck`; `bun test:run` → no new failures vs `main`; `SKIP_VERSION_BUMP=1 bun run build`.
- [ ] **Step 2:** **Ask the user before pushing.** PR (English), base FE `feature/ap-payment-workflow`: depends on the backend PR; deploy order; allowlist `workflow.findAllArInvoice`.

## Manual verification (user-driven, after BE on dev)

On a test BU: create the AR Invoice workflow (2 approval stages) → a second active one is refused → new invoice shows `DRAFT-…`, can be deleted → another submitted gets `ARIV…` (a credit note `ARCN…`, a debit note `ARDN…`) and enters review → creator (flag off) has no Approve → approver at stage 2 sends back to stage 1 approver → stays in review (page shows the stage); a later stage via curl is refused → stage 1 + stage 2 approve → posted with the real number on JV, tax invoice issued, referenced CN consumed → reject on another invoice requires a reason, becomes void, its referenced CN is still available → send back to the create stage (keeps real number): Delete is gone, Void is offered → flip `ar.invoice.allow-creator-approve` on → creator can approve → no active workflow: submit posts directly with a real number.
