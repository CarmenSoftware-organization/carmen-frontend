# AP Invoice Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **User preference (overrides TDD):** skip "write the failing test / run to see it fail"; do not create new `*.spec.ts` / `*.test.ts(x)` files. Do update **existing** specs/tests broken by the change. Every task runs type-check (+ lint where cheap) and the existing tests of the touched folders. Manual verification (curl/browser) is listed at the end for the user.

**Goal:** AP Invoice can go through a BU's single approval workflow (approve / reject = void / send back to a chosen stage), with creator-cannot-approve (BU-configurable), draft placeholder numbers, and soft-delete only for never-numbered drafts.

**Architecture:** Backend reuses `WorkflowOrchestratorService` and adds a small shared helper for accounting documents; `ApInvoiceService` gains enforcement and the new status rules; workflows service guards one active `ap_invoice` workflow per BU. Frontend adds the workflow type to `/system-admin/workflow`, an AP section in Default Setting, and drives the AP invoice buttons from a backend-computed `allowed_actions`.

**Tech Stack:** NestJS micro-business + backend-gateway, Prisma, `@repo/error-catalog`, `@repo/rpc-contract`; React 19 + React Router 7 + TanStack Query + use-intl (FE).

**Spec:** `docs/superpowers/specs/2026-11-24-ap-invoice-workflow-design.md` (carmen-frontend). Facts gathered for this plan: `scratchpad/ap-wf-recon.md` is session-local — everything needed is restated below.

**Repos / branches**
- Backend `carmen-turborepo-backend`: branch `feature/ap-invoice-workflow` **off `feature/draft-number-standard`** (PR #1108 — needs its `nextDraftNo` / `isDraftNo`). PR base = `feature/draft-number-standard` until #1108 merges, then retarget to `main`. Never `--delete-branch` #1108 while this PR is stacked on it.
- Frontend `carmen-frontend`: branch `feature/ap-invoice-workflow` off `main`.
- Commit messages in Thai; PR bodies in English.

## Global Constraints

- Workflow-eligible `doc_source`: `manual`, `grn`, `copy`, `excel`, `ai`. Not eligible (post directly on submit): `grn_auto`, `interface`.
- One active `ap_invoice` workflow per BU; documents never choose a workflow.
- Reject = **void the whole invoice** from `in_review` (terminal); `reason` required (non-empty after trim), stored in `void_reason` and on the `rejected` workflow-history entry.
- Send back: approver picks a previous stage. Destination = first (create) stage → `doc_status = draft`; destination = an approval stage → stays `in_review` at that stage.
- Creator (`created_by_id`) cannot **approve** unless BU config key **`ap.invoice.allow-creator-approve`** is true (`true` or `'true'`; absent = false). Reject/send back are not affected.
- Draft number: `nextDraftNo(tx, 'ap_invoice_running_no', userId)` → `DRAFT-%08d`; the real number (`generateApDocNo`) is reserved at the first submit, in the transaction that moves the doc out of draft, only when `isDraftNo(doc_no)`. `grn_auto` keeps a real number at creation.
- Delete (soft) only when `doc_status = draft` **and** `isDraftNo(doc_no)`; a numbered draft can only be voided.
- An `in_review` invoice keeps acting on its stored `workflow_id`; a draft re-resolves the current active workflow on submit.
- New gateway routes reuse existing api_names where possible; any new api_name must be listed in the PR's deploy notes (allowlist, else users get logged out).
- No migration (AP Invoice). Deploy: BE (micro-business + gateway together) → allowlist `workflow.findAllApInvoice` → FE.

## Review Focus

1. **Final approval posts with the placeholder number** — a draft submitted with no workflow posts directly; the GL JV / tax record / description must carry the real number reserved in that same transaction, not `DRAFT-…`. Owned by Task 3 (verify by reading posting code + curl).
2. **Creator is also the only approver of a stage** with the BU flag off — approve must be refused with the catalog error, and `allowed_actions` must not contain `approve` (no dead button). Task 4 + Task 5.
3. **Send back to an approval stage, then that approver approves** — doc stays `in_review`, `user_action` points at that stage's users, approve proceeds normally. Task 4.
4. **Reject when the invoice already has a GRN source** — after void the GRN quantity is invoiceable again (`matchedQtyByItem` excludes void — confirm no other reservation table holds it). Task 4.
5. **Two admins activate an AP workflow at the same time** — exactly one succeeds; the other gets the single-active error. Task 2.

---

## Backend (`carmen-turborepo-backend`, MB = `apps/micro-business/src`, GW = `apps/backend-gateway/src`)

### Task 1: Error codes + accounting-doc workflow helper

**Files:**
- Modify: `packages/error-catalog/src/catalog.ts` (WORKFLOW module, next free ids after `makeId(MODULE.WORKFLOW, 10)` — verify), rebuild the package (`bun run build` in `packages/error-catalog`) so `dist/` matches
- Create: `MB/common/workflow/accounting-doc-workflow.ts`
- Modify: `MB/common/workflow/workflow-orchestrator.service.ts` (`buildReviewWorkflow` :250, local `isCreateStage` :286-288)
- Modify (existing spec): `MB/common/workflow/workflow-orchestrator.service.spec.ts` if the return-type change breaks it

**Interfaces — Produces:**
- Catalog codes (http 422 unless noted, EN+TH messages):
  - `WORKFLOW_SINGLE_ACTIVE_EXISTS` — params `{ workflow }` — "Another active workflow of this type already exists: {workflow}"
  - `WORKFLOW_CREATOR_CANNOT_APPROVE` — 403 — "The creator of this document cannot approve it"
  - `AP_INVOICE_REJECT_REASON_REQUIRED` — "A reason is required to reject this invoice"
  - `AP_INVOICE_NUMBERED_VOID_ONLY` — "This invoice already has a document number and can only be voided"
- `export const ACCOUNTING_WORKFLOW_SOURCES = ['manual','grn','copy','excel','ai'] as const`
- `export function isWorkflowEligibleSource(source: string | null | undefined): boolean`
- `export async function allowsCreatorApprove(tenantService: TenantService, userId: string, buCode: string, key: string): Promise<boolean>` — `getdb_connection(userId, buCode)` → `getBuConfig<unknown>(connection.tenant_id, key, false)` → `=== true || === 'true'` (same as `purchase-order.service.ts` `isGroupByPrComment`)
- `export const AP_INVOICE_ALLOW_CREATOR_APPROVE_KEY = 'ap.invoice.allow-creator-approve'`
- Orchestrator: `buildReviewWorkflow(...)` now resolves to `WorkflowHeader & { is_create_stage: boolean }` (expose the existing local; existing callers ignore the extra field).

- [ ] **Step 1:** Add the catalog entries, rebuild the package.
- [ ] **Step 2:** Create the helper file (bilingual JSDoc).
- [ ] **Step 3:** Expose `is_create_stage` from `buildReviewWorkflow`.
- [ ] **Step 4:** `bunx tsc --noEmit` in micro-business and backend-gateway; `bunx jest src/common/workflow` → pass.
- [ ] **Step 5:** Commit `feat(workflow): error code และ helper กลางของ workflow เอกสารบัญชี`.

### Task 2: One active AP Invoice workflow per BU + gateway list endpoint

**Files:**
- Modify: `MB/master/workflows/workflows.service.ts` — `create` :559-632 (JV branch :594-614 is the pattern), `update` :1348-1490 (JV recheck :1446-1470)
- Modify: `GW/config/config_workflows/config_workflows.controller.ts` — add handler after `findAllJournalVoucher` (:355-403), before any `:workflow_id` route
- Modify: `GW/backstage/applications/app-api-catalog.generated.ts` via `bun run scripts/generate-app-api-catalog/run.ts`; check `packages/prisma-shared-schema-backstage/prisma/seed.application-api.data.ts` for where `workflow.findAllJournalVoucher` is granted and add the AP one alongside
- Modify (existing spec): `MB/master/workflows/workflows.service.spec.ts` cases for create/update if mocks need `$executeRaw`

**Interfaces — Produces:**
- `private async findOtherActiveWorkflow(tx, type: enum_workflow_type, excludeId: string | null): Promise<string | null>` — first `SELECT pg_advisory_xact_lock(hashtext('tb_workflow:' || type))`, then `findFirst` active, not deleted, same type, `id ≠ excludeId`; returns its `name`.
- Create (type `ap_invoice`, `is_active ?? true`) and update (type `ap_invoice` and `updateFields.is_active === true`) run check + write in one `$transaction`; conflict → `WORKFLOW_SINGLE_ACTIVE_EXISTS { workflow: name }`.
- GW `GET config/:bu_code/workflows/ap-invoice` → `findAllApInvoice`, `AppIdGuard('workflow.findAllApInvoice')`, `findAllByType(enum_workflow_type.ap_invoice, …)`, operationId `configWorkflows_findAllApInvoice`; decorators identical to the JV handler.

- [ ] **Step 1:** Implement the guard on create and update.
- [ ] **Step 2:** Add the gateway handler; regenerate the api catalog; add the seed grant if JV's exists there.
- [ ] **Step 3:** `bunx tsc --noEmit` (MB + GW); `bunx jest src/master/workflows` (MB); `bun run audit:app-api-catalog-drift` if present → pass.
- [ ] **Step 4:** Commit `feat(workflow): AP Invoice มี workflow ที่ active ได้เส้นเดียวต่อ BU และ endpoint รายการ`.

### Task 3: AP Invoice numbering — placeholder on create, real number at submit, delete rule

**Files:**
- Modify: `MB/ap/ap-invoice/ap-invoice.service.ts` — `writeDraftInTx` :282-298, `submit` :893-916, `postDocument` :1166-1198, `sendToReview` :1200-1240, `delete` :555

**Interfaces:**
- Consumes: `nextDraftNo`, `isDraftNo` (`MB/common/helpers/draft-running-no.helper.ts`, from #1108); existing `generateApDocNo({ prisma: tx, buCode, docType, docDate })`.
- Produces: module const `AP_INVOICE_RUNNING_NO_KEY = 'ap_invoice_running_no'`; `private async realDocNoPatch(tx, doc: { doc_no: string; doc_type; doc_date }): Promise<{ doc_no?: string }>` — returns `{ doc_no: await generateApDocNo(...) }` when `isDraftNo(doc.doc_no)`, else `{}`.

- [ ] **Step 1:** `writeDraftInTx`: placeholder via `nextDraftNo(tx, AP_INVOICE_RUNNING_NO_KEY, this.userId)`. Verify `createFromGrn` (:687, source `grn`) goes through it (placeholder) and `createAndPostFromGrnInTx` (:329, `grn_auto`) does **not** (keeps `generateApDocNo`).
- [ ] **Step 2:** Inside the transactions of `sendToReview` and `postDocument`, merge `realDocNoPatch` into the header update **before** anything downstream (tax record, GL posting, JV description) reads `doc_no`; make the posting read the patched number (Review Focus 1 — trace `this.posting.*` to see whether it re-reads the row or takes the passed doc).
- [ ] **Step 3:** `delete`: after the draft check, if `!isDraftNo(existing.doc_no)` → `AP_INVOICE_NUMBERED_VOID_ONLY` (select `doc_no` too).
- [ ] **Step 4:** Update return values that expose `doc_no` (submit/post results) to the real number.
- [ ] **Step 5:** `bunx tsc --noEmit`; `bunx jest src/ap` → pass.
- [ ] **Step 6:** Commit `feat(ap-invoice): ฉบับร่างถือเลข DRAFT- ออกเลขจริงตอน submit และลบได้เฉพาะใบที่ยังไม่มีเลข`.

### Task 4: AP Invoice actions — eligibility, enforcement, creator rule, reject = void, send back by stage

**Files:**
- Modify: `MB/ap/ap-invoice/ap-invoice.service.ts` — `submit`, `approve` :929-962, `review` :971-1007, `reject` :1018-1049, `voidDraft` :1242-1288, `resolveWorkflowId` :1341-1348; constructor (inject `TenantService`; `ap-invoice.module.ts` already imports `TenantModule`)
- Modify: `GW/application/ap-invoice/ap-invoice.controller.ts` — `@ApiOperation`/`@ApiBody` text for reject (:497-508, currently "back to draft") and review

**Interfaces:**
- Consumes: Task 1 helper + codes + `is_create_stage`; `workflowOrchestrator.checkStageActorAllowed(document, userAction, action: StageActionKey, userId, buCode): Promise<Result<null> | null>`; `isDocumentOwner(doc, userId)` (`MB/common/helpers/document-ownership.helper.ts`) — use `created_by_id` only.
- Produces: `private async assertCanAct(doc: ApInvoiceFull, action: StageActionKey): Promise<Result<null> | null>` — stage actor/action check, then for `approve` the creator rule (`WORKFLOW_CREATOR_CANNOT_APPROVE` when `doc.created_by_id === this.userId` and `!allowsCreatorApprove(...)`).

- [ ] **Step 1:** `submit`: if `!isWorkflowEligibleSource(doc.doc_source)` or no active workflow → `postDocument` path. Use the active workflow id (re-resolved), not a stale `doc.workflow_id`.
- [ ] **Step 2:** `approve` / `review` / `reject`: call `assertCanAct` right after `loadForAction`; return its error (never throw).
- [ ] **Step 3:** `review`: use `is_create_stage` from `buildReviewWorkflow` → `doc_status: draft` when true, keep `in_review` otherwise; return the resulting status. Keep `stage` optional at the API (fallback `workflow_previous_stage`).
- [ ] **Step 4:** `voidDraft` gains `from: enum_ap_invoice_status` and an optional extra update patch; `reject` requires `reason?.trim()` (`AP_INVOICE_REJECT_REASON_REQUIRED`) and calls it with `from = in_review`, `void_reason = reason`, plus `workflowColumns(withReason(buildRejectWorkflow(...), reason))` in the **same** guarded update; returns `{ id, doc_status: void }`. `void` endpoint keeps calling it with `draft`.
- [ ] **Step 5:** Confirm (read-only) that a voided invoice frees its GRN quantity: `matchedQtyByItem` (:656-685) excludes `void`; grep for any other table keyed on `ap_invoice_id` that reserves GRN qty. Note result in the report.
- [ ] **Step 6:** Update the gateway Swagger texts.
- [ ] **Step 7:** `bunx tsc --noEmit` (MB + GW); `bunx jest src/ap src/common/workflow` → pass.
- [ ] **Step 8:** Commit `feat(ap-invoice): workflow บังคับสิทธิ์ตาม stage, reject = void ทั้งใบ, send back ตาม stage และกันผู้สร้างอนุมัติเอง`.

### Task 5: Previous stages + `allowed_actions` on the invoice

**Files:**
- Modify: `packages/rpc-contract/src/contracts/<the AP invoice contract the gateway service uses — ap-invoice.ts or ap-invoices.ts; check GW/application/ap-invoice/ap-invoice.service.ts>` — add `previousStages: rpc('ap-invoice.previous-stages','micro-business').restTodo()`
- Modify: MB AP invoice controller (`@MessagePattern` handler, pattern from `purchase-request.controller.ts:396`) + service method
- Modify: `GW/application/ap-invoice/ap-invoice.controller.ts` + its service — `GET ':ap_invoice_id/previous-stages'`, `AppIdGuard('ap-invoice.findOne')` (reuse → no allowlist change), ParseUUIDPipe
- Modify: MB `findOne` of AP invoice + GW response serializer schema (both layers — a field missing from the gateway `@Serialize` schema is silently dropped)

**Interfaces — Produces:**
- MB `getPreviousStages(id: string): Promise<Result<Record<string, string>>>` — not found → `AP_INVOICE_NOT_FOUND`; no workflow/stage → `Result.ok({})`; else `workflowOrchestrator.getPreviousStages(workflow_id, workflow_current_stage, userId, buCode)` (map `"1" → stageName`).
- `findOne` response gains `allowed_actions: ('approve' | 'reject' | 'sendback')[]` — empty unless `doc_status = in_review`; each action included iff `assertCanAct(doc, action)` returns null. Compute once per findOne.

- [ ] **Step 1:** Contract + MB handler + GW route.
- [ ] **Step 2:** `allowed_actions` in MB findOne and the GW serializer schema.
- [ ] **Step 3:** `bunx tsc --noEmit` (MB + GW + rpc-contract build if it has one); `bunx jest src/ap` → pass.
- [ ] **Step 4:** Commit `feat(ap-invoice): endpoint stage ก่อนหน้า และ allowed_actions ของผู้ใช้ปัจจุบัน`.

### Task 6: Backend check + PR

- [ ] **Step 1:** Root `bun run check-types`; `cd apps/micro-business && bunx jest`; gateway jest — compare against the base branch's failure list (gateway has known pre-existing failures), no new failures.
- [ ] **Step 2:** **Ask the user before pushing.** PR (English) base `feature/draft-number-standard`: summary, deploy order (BE MB+GW together → allowlist `workflow.findAllApInvoice` → FE), new error codes, BU key `ap.invoice.allow-creator-approve`, stacked-PR note.

## Frontend (`carmen-frontend`)

### Task 7: Workflow admin supports AP Invoice

**Files:**
- Modify: `types/workflows.ts` (`AP_INVOICE = "ap_invoice"`), `constant/workflow.ts` (`workflowTypeField`, `WF_ROW_TYPE`, `WORKFLOW_TYPES`, `WF_TYPE_I18N_KEY`)
- Create in `constant/workflow.ts`: `export const WORKFLOW_CAPS: Record<WORKFLOW_TYPE, { hasProducts: boolean; hasJvScope: boolean; totalOnlyRouting: boolean; canHidePrice: boolean }>` — PR/PO `{true,false,false,true}`, SR `{true,false,false,false}`, JV `{false,true,true,false}`, AP_INVOICE `{false,false,true,false}`
- Modify (replace `=== WORKFLOW_TYPE.JV` checks with `WORKFLOW_CAPS`): `routes/system-admin/workflow/wf-detail.tsx:148,279,355`, `wf-routing.tsx:378-381`, `wf-stage-general.tsx:80-84`, `wf-insights-utils.ts:88-92`, `wf-insights.tsx:119,157`, `wf-scope-line.tsx:23`
- Modify: `wf-role-colors.ts:26-30` (AP `["create","approve"]`), `wf-structure-lock-notice.tsx:15-35` (AP `{ path: <AP invoice list route — check routes/router.tsx>, status: "doc_status", value: "in_review" }`)
- Modify: `hooks/use-workflow.ts` (`WORKFLOW_DOC_TYPES` + `"ap-invoice"`, `WORKFLOW_TYPE_BY_DOC_TYPE`, a `useApInvoiceWorkflows` like `useJournalVoucherWorkflows` :85-88, `WORKFLOW_LIST_HOOKS`), `routes/system-admin/workflow/wf-component.tsx:40-46` (`titleApInvoice`), `constant/module-list.ts` (~:903-907, entry `workflowApInvoice` → `/system-admin/workflow/ap-invoice`, same licenseFeature/permission as JV), the System Admin landing card if the landing lists workflow types
- Modify: `routes/system-admin/workflow/wf-new-form.tsx:165-196` — AP option `disabled` with hint when an active AP workflow exists (from `useApInvoiceWorkflows`); on the locked slug route `/workflow/ap-invoice/new` show the same hint and block submit
- Modify: `messages/en.json` + `messages/th.json` — `systemAdmin.workflow.typeApInvoice`, `titleApInvoice`, `apInvoiceSingleActiveHint`, menu `workflowApInvoice`, `errors.byCode.WORKFLOW_SINGLE_ACTIVE_EXISTS` (ICU: no `{{ }}` / `<word>`; use `{workflow}`)
- Modify (existing tests): `routes/system-admin/workflow/wf-menu.test.ts` and any test enumerating workflow types

- [ ] **Step 1:** Types/constants/caps; swap JV checks for caps (behaviour for PR/PO/SR/JV unchanged).
- [ ] **Step 2:** Hooks, slug, menu, titles, landing, new-form guard, i18n.
- [ ] **Step 3:** `bun run typecheck`; `bun test:run routes/system-admin/workflow hooks` → pass.
- [ ] **Step 4:** Commit `feat(workflow): ตั้ง workflow ของ AP Invoice ได้ (เส้นเดียวต่อ BU)`.

### Task 8: Default Setting — AP section

Follow skill `add-business-setting-config`.

**Files:** `routes/system-admin/company-profile/company-profile-config-registry.ts` (append section after `general`), `messages/en.json` + `th.json`, existing `company-profile-config-registry.test.ts` (add a describe block in the existing file — allowed, not a new file).

- Section `{ id: "ap", titleKey: "sections.ap", descKey: "sections.apDesc", items: [{ key: "ap.invoice.allow-creator-approve", datatype: "boolean", defaultValue: "false", label: "Allow the creator to approve their own AP invoice", labelKey: "config.apInvoiceAllowCreatorApprove" }] }`
- i18n en: `"AP"`, `"Accounts Payable settings for this business unit."`, label as above · th: `"AP"`, `"การตั้งค่า Accounts Payable ของหน่วยธุรกิจนี้"`, `"อนุญาตให้ผู้สร้างอนุมัติ AP Invoice ของตัวเอง"`

- [ ] **Step 1:** Registry + i18n + registry test block.
- [ ] **Step 2:** `bun run typecheck`; `bun test:run routes/system-admin/company-profile` → pass.
- [ ] **Step 3:** Commit `feat(default-setting): หมวด AP ตั้งค่าให้ผู้สร้างอนุมัติ AP Invoice ของตัวเองได้`.

### Task 9: AP Invoice page — buttons from `allowed_actions`, send-back stage picker, reject = void, delete vs void

**Files:**
- Modify: `types/accounts-payable.ts` (`ApInvoice.allowed_actions?: ("approve"|"reject"|"sendback")[]`; rename UI action `"return"` → `"sendback"` in `ApUiAction`)
- Modify: `routes/accounting/accounts-payable/shared/ap-http-repository.ts:144` (map `allowed_actions`, default `[]`), `shared/ap-status.ts:50-62` (`apActions`: in_review → map `allowed_actions` to UI actions, fall back to the current `userCanExecute` rule only when the field is absent; draft → `isDraftNo(doc_no)` ? `["submit","delete"]` : `["submit","void"]`), `shared/use-accounts-payable.ts:34-37` (`toApCommand`: `sendback` → `review`)
- Create hook in the AP shared folder: `useApInvoicePreviousStages(id: string | undefined, enabled: boolean)` mirroring `useSrPreviousStages` (`routes/store-operation/store-requisition/use-sr.ts:23`) → `{ key, name }[]` from `Object.entries(json.data ?? {})`; add `API_ENDPOINTS.AP_INVOICE_PREVIOUS_STAGES(bu, id)` → `/api/proxy/api/${bu}/ap-invoice/${id}/previous-stages` and `QUERY_KEYS.AP_INVOICE_PREVIOUS_STAGES`
- FE draft check: add `isDraftDocNo(no?: string | null): boolean` (`startsWith("DRAFT-")`) in `lib/` (shared layer)
- Modify: `routes/accounting/accounts-payable/invoice/ap-invoice-detail.tsx` — Return button (:425-434) → **Send back** opening a dialog with a required stage `Select` (pattern `sr-action-dialog.tsx`) + optional note, calling `runAction("sendback", reason, stage)`; Reject (:436-445) → required reason, copy says the invoice will be voided and cannot be reopened; `needsReason` (:336) true for `void` and `reject`
- Modify: `messages/en.json` + `th.json` — `accountsPayable.invoice.detail.actions.sendBack`, `reasonDialog.sendback.*`, `reasonDialog.reject.*` (void wording), `errors.byCode` for `WORKFLOW_CREATOR_CANNOT_APPROVE`, `AP_INVOICE_REJECT_REASON_REQUIRED`, `AP_INVOICE_NUMBERED_VOID_ONLY`
- Modify (existing tests): any `ap-status` / AP detail tests asserting `"return"` or draft actions

- [ ] **Step 1:** Types, repository mapping, `apActions`, command map, FE draft check.
- [ ] **Step 2:** Previous-stages endpoint/key/hook; send-back dialog; reject dialog copy + required reason.
- [ ] **Step 3:** i18n (ICU-safe).
- [ ] **Step 4:** `bun run typecheck`; `bun test:run routes/accounting/accounts-payable` → pass; `bunx eslint` on touched files.
- [ ] **Step 5:** Commit `feat(ap-invoice): ปุ่มตาม allowed_actions, send back เลือก stage, reject = void และลบได้เฉพาะใบ DRAFT`.

### Task 10: Frontend check + PR

- [ ] **Step 1:** `bun run typecheck`; `bun test:run` → no new failures vs `main`.
- [ ] **Step 2:** **Ask the user before pushing.** PR (English): depends on the backend PR; deploy order; allowlist `workflow.findAllApInvoice`.

## Manual verification (user-driven, after BE on dev)

On a test BU: create the AP Invoice workflow (2 approval stages) → creating a second active one is refused → new manual invoice shows `DRAFT-…`, can be deleted → another one submitted gets `APIV…` and enters review → creator (flag off) has no Approve → approver at stage 2 sends back to stage 1 approver → stays in review → stage 1 approves, stage 2 approves → posted with real number on JV/tax → reject on another invoice requires reason, becomes void, its GRN is invoiceable again → flip `ap.invoice.allow-creator-approve` on → creator can approve → `grn_auto` / `interface` invoices post directly.
