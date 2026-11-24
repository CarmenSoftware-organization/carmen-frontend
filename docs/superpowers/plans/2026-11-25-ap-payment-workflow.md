# AP Payment Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **User preference (overrides TDD):** skip "write the failing test / run to see it fail"; do not create new `*.spec.ts` / `*.test.ts(x)` files. Do update **existing** specs/tests broken by the change. Every task runs type-check (+ lint where cheap) and the existing tests of the touched folders. Manual verification (curl/browser) is listed at the end for the user. Tell every implementer subagent this explicitly (they do not inherit it).

**Goal:** AP Payment can go through a BU's single approval workflow (approve / reject = void / send back to a chosen stage), with creator-cannot-approve (BU-configurable), draft placeholder numbers, soft-delete only for never-numbered drafts, and batch approve going through the same enforcement. Shared logic that AP Invoice kept private is extracted so AR Invoice can reuse it.

**Architecture:** Extract `assertCanAct` / `computeAllowedActions` / send-back planning / real-number patch / reject-reason helper from `ApInvoiceService` into `common/workflow/accounting-doc-workflow.ts` (AP Invoice refactored, behaviour unchanged); wire `ApPaymentService` onto them; generalise the single-active-workflow guard; frontend adds the type to `/system-admin/workflow`, a second item in the Default Setting AP section, and drives the payment page + batch-approve page from backend-computed `allowed_actions`.

**Tech Stack:** NestJS micro-business + backend-gateway, Prisma, `@repo/error-catalog`, `@repo/rpc-contract`; React 19 + React Router 7 + TanStack Query + use-intl (FE).

**Spec:** `docs/superpowers/specs/2026-11-25-ap-payment-workflow-design.md` (carmen-frontend). Template round: `…/2026-11-24-ap-invoice-workflow-design.md` + plan; its build log `wt-ap-invoice-workflow/.superpowers/sdd/2026-11-24-ap-invoice-workflow/progress.md` holds the rulings below.

**Repos / branches**
- Backend `carmen-turborepo-backend`: branch `feature/ap-payment-workflow` **off `feature/ap-invoice-workflow`** (stacked; that branch is itself stacked on `feature/draft-number-standard` / PR #1108). PR base = `feature/ap-invoice-workflow` until it merges, then retarget. Never `--delete-branch` a base while a PR is stacked on it.
- Frontend `carmen-frontend`: branch `feature/ap-payment-workflow` **off FE `feature/ap-invoice-workflow`** (needs `WORKFLOW_CAPS`, `isDraftDocNo`, the AP registry section, the send-back dialog).
- Commit messages in Thai; PR bodies in English. **No push / PR without asking the user first.**

## Global Constraints

- AP Payment has **no `doc_source`**: every voucher is human-created and enters the workflow when one is active. No eligibility gate, no new column.
- One active `ap_payment` workflow per BU; documents never choose a workflow.
- Reject = **void the whole voucher** from `in_review` (terminal); `reason` required (non-empty after trim), stored in `void_reason` and on the `rejected` workflow-history entry. Allocation rows are kept (a `void` voucher does not reserve invoice lines — `reservedByLine` counts only draft/in_review).
- Send back: approver picks a previous stage; the stage **must** be validated against `getPreviousStages` (`WORKFLOW_SENDBACK_STAGE_INVALID`) — a forward jump skips approvers. Destination = first stage → `draft`; approval stage → stays `in_review`. Use `workflowOrchestrator.isFirstStage(workflowId, stageName, userId, buCode)`; **`buildReviewWorkflow` must NOT gain return fields** (they leak into PR/SR/PO prisma updates).
- Creator (`created_by_id`) cannot **approve** unless BU config key **`ap.payment.allow-creator-approve`** is `true`/`'true'` (absent = false). Reject/send back unaffected.
- Draft number: `nextDraftNo(tx, 'ap_payment_running_no', userId)` → `DRAFT-%08d`; the real number (`generateApPaymentNo`) is reserved at the first submit, in the transaction that moves the voucher out of draft, only when `isDraftNo(doc_no)`, **after** the guarded lock succeeds and **before** `loadFull`/`postInTx`.
- `runAtomic` **commits** a transaction whose callback *returns* an error Result and rolls back only on `abortWith`/throw. A lost guarded lock is returned (nothing written) — fine; any error after the number is reserved or after other writes must `abortWith`.
- Delete (soft) only when `doc_status = draft` **and** `isDraftNo(doc_no)`; a numbered draft can only be voided.
- An `in_review` voucher keeps acting on its stored `workflow_id`; a draft re-resolves the current active workflow on submit.
- Logic-layer errors are returned as `Result`, never thrown (throws become 503).
- Any new gateway api_name must be in the PR's deploy notes (allowlist, else users get logged out). Only `workflow.findAllApPayment` is new here; previous-stages reuses `ap-payment.findOne`.
- No migration. Deploy: BE (micro-business + gateway together) → allowlist `workflow.findAllApPayment` → FE.

## Review Focus

1. **Final approval posts with the placeholder number** — draft submitted with no workflow posts directly; `postInTx`'s JV `description` (`${pv.doc_no} …`) must carry the real number reserved in the same transaction. Task 3.
2. **Creator is also the only approver of a stage** with the flag off — approve refused with `WORKFLOW_CREATOR_CANNOT_APPROVE`, `allowed_actions` lacks `approve`, **and batch approve reports the refusal instead of silently skipping**. Tasks 4, 5, 9.
3. **Send back to an approval stage, then that approver approves**; **send back to a *later* stage is refused**. Task 4.
4. **Reject frees the invoice lines** — after void, `outstandingDocuments`/`reservedByLine` for those invoice lines no longer subtract the voided voucher (status filter). Task 4 (read-only confirm).
5. **Two admins activate an AP Payment workflow at once** — exactly one wins. Task 2.
6. **AP Invoice behaviour unchanged by the extraction** — same errors, same `allowed_actions`, same numbering. Task 1.

---

## Backend (`carmen-turborepo-backend`, MB = `apps/micro-business/src`, GW = `apps/backend-gateway/src`)

### Task 1: Extract shared helpers + AP Payment error codes

**Files:**
- Modify: `MB/common/workflow/accounting-doc-workflow.ts` (currently: `ACCOUNTING_WORKFLOW_SOURCES`, `AP_INVOICE_ALLOW_CREATOR_APPROVE_KEY`, `isWorkflowEligibleSource`, `allowsCreatorApprove`)
- Modify: `MB/ap/ap-invoice/ap-invoice.service.ts` — replace private `assertCanAct` (~L1509), `computeAllowedActions` (~L1476), `realDocNoPatch` (~L1259), the stage-validation + `buildReviewWorkflow` + `isFirstStage` block in `review` (~L1017-1050) and the local `withReason` (~L1915) with calls to the shared helpers; **behaviour must not change**
- Modify: `packages/error-catalog/src/catalog.ts` (next free ids in `MODULE.AP_PAYMENT` — verify), rebuild (`bun run build` in `packages/error-catalog`) so `dist/` and `reference/error-codes.*` match

**Interfaces — Produces** (exact names are the builder's call; keep the shapes):
- `export const AP_PAYMENT_ALLOW_CREATOR_APPROVE_KEY = 'ap.payment.allow-creator-approve'`
- `export interface AccountingActContext { orchestrator: WorkflowOrchestratorService; tenantService: TenantService; userId: string; buCode: string; creatorApproveKey: string }`
- `export async function assertCanActOnDocument(ctx, input: { workflowDoc: WorkflowDocument; userAction: unknown; createdById: string | null }, action: StageActionKey): Promise<Result<null> | null>` — `checkStageActorAllowed`, then for `approve` + creator: `allowsCreatorApprove(...)` else `WORKFLOW_CREATOR_CANNOT_APPROVE`
- `export async function computeAllowedActionsFor(inReview: boolean, check: (a: StageActionKey) => Promise<Result<null> | null>, onError: (action: StageActionKey, err: unknown) => void): Promise<StageActionKey[]>` — `[]` unless `inReview`; throwing check = not allowed (logged via `onError`)
- `export async function planSendBack(ctx, doc: { workflowDoc: WorkflowDocument; workflowId: string | null; currentStage: string | null }, stage: string): Promise<Result<{ header: WorkflowHeader; toDraft: boolean }>>` — `getPreviousStages(workflowId, currentStage, …)` must contain `stage` else `WORKFLOW_SENDBACK_STAGE_INVALID { stage }`; then `buildReviewWorkflow`; then `isFirstStage(workflowId, header.workflow_current_stage, …)`
- `export async function realDocNoPatch(docNo: string, generate: () => Promise<string>): Promise<{ doc_no?: string }>` — `{}` unless `isDraftNo(docNo)`
- `export function withRejectReason(workflow: WorkflowHeader, reason: string | null | undefined): WorkflowHeader`
- Catalog codes (http 422, EN+TH): `AP_PAYMENT_REJECT_REASON_REQUIRED` — "A reason is required to reject this payment voucher" / "ต้องระบุเหตุผลในการปฏิเสธใบจ่ายเงินนี้"; `AP_PAYMENT_NUMBERED_VOID_ONLY` — "This payment voucher already has a document number and can only be voided" / "ใบจ่ายเงินนี้ออกเลขที่เอกสารแล้ว จึงทำได้เพียงยกเลิก (void) เท่านั้น"

- [ ] **Step 1:** Add the shared helpers (bilingual JSDoc, same style as the existing file). Do not touch `buildReviewWorkflow`.
- [ ] **Step 2:** Refactor `ApInvoiceService` onto them. `ApInvoiceService.assertCanAct` may remain as a thin private wrapper that builds the context.
- [ ] **Step 3:** Add the two catalog codes; rebuild the package.
- [ ] **Step 4:** `bunx tsc --noEmit` in micro-business and backend-gateway; `bunx jest src/ap src/common/workflow` → pass (AP Invoice suites prove no regression).
- [ ] **Step 5:** Commit `refactor(workflow): แยก helper กลางของ workflow เอกสารบัญชีออกจาก AP Invoice และเพิ่ม error code ของ AP Payment`.

### Task 2: One active AP Payment workflow per BU + gateway list endpoint

**Files:**
- Modify: `MB/master/workflows/workflows.service.ts` — the `ap_invoice` branch of `create` (~L643) and of `update` (~L1518) become `SINGLE_ACTIVE_WORKFLOW_TYPES.has(type)` where `const SINGLE_ACTIVE_WORKFLOW_TYPES = new Set([enum_workflow_type.ap_invoice, enum_workflow_type.ap_payment])`; `findOtherActiveWorkflow` (~L562) is already type-parameterised
- Modify: `GW/config/config_workflows/config_workflows.controller.ts` — add `findAllApPayment` after `findAllApInvoice` (`@Get('ap-payment')`, before any `:workflow_id` route)
- Modify: `GW/backstage/applications/app-api-catalog.generated.ts` via `bun run scripts/generate-app-api-catalog/run.ts`; check `packages/prisma-shared-schema-backstage/prisma/seed.application-api.data.ts` for where `workflow.findAllApInvoice` is granted and add the payment one alongside
- Modify (existing spec): `MB/master/workflows/workflows.service.spec.ts` only if mocks break

**Interfaces — Produces:**
- Create (type `ap_payment`, `is_active ?? true`) and update (`updateFields.is_active === true`) run check + write in one `$transaction` under `pg_advisory_xact_lock(hashtext('tb_workflow:ap_payment'))`; conflict → `WORKFLOW_SINGLE_ACTIVE_EXISTS { workflow: name }`.
- GW `GET config/:bu_code/workflows/ap-payment` → `findAllApPayment`, `AppIdGuard('workflow.findAllApPayment')`, `findAllByType(enum_workflow_type.ap_payment, …)`, operationId `configWorkflows_findAllApPayment`; decorators identical to the AP Invoice handler.

- [ ] **Step 1:** Generalise the guard (create + update).
- [ ] **Step 2:** Gateway handler; regenerate the api catalog; seed grant.
- [ ] **Step 3:** `bunx tsc --noEmit` (MB + GW); `bunx jest src/master/workflows`; `bun run audit:app-api-catalog-drift` if present → pass.
- [ ] **Step 4:** Commit `feat(workflow): AP Payment มี workflow ที่ active ได้เส้นเดียวต่อ BU และ endpoint รายการ`.

### Task 3: AP Payment numbering — placeholder on create, real number at submit, delete rule

**Files:**
- Modify: `MB/ap/ap-payment/ap-payment.service.ts` — `create` (~L217-240), `postDocument` (~L717), `sendToReview` (~L750), `delete` (~L286)

**Interfaces:**
- Consumes: `nextDraftNo`, `isDraftNo` (`MB/common/helpers/draft-running-no.helper.ts`); `realDocNoPatch` (Task 1); existing `generateApPaymentNo({ prisma: tx, buCode, docDate })`.
- Produces: module const `AP_PAYMENT_RUNNING_NO_KEY = 'ap_payment_running_no'`; private `withRealDocNo(tx, id): Promise<ApPaymentFull>` — `loadFull`, then if `isDraftNo(doc_no)` persist `generateApPaymentNo({ prisma: tx, buCode: this.bu_code, docDate: new Date(pv.payment_date) })` and return the row carrying it (abort `AP_PAYMENT_NOT_FOUND` when missing).

- [ ] **Step 1:** `create`: replace `generateApPaymentNo` with `nextDraftNo(tx, AP_PAYMENT_RUNNING_NO_KEY, this.userId)`; the write context keeps `doc_no`. The create result's `doc_no` is the placeholder.
- [ ] **Step 2:** `postDocument` and `sendToReview`: after `guardedUpdate` succeeds, replace the `loadFull(tx, id)` with `withRealDocNo(tx, id)` so `posting.postInTx` (JV description, Review Focus 1) and the in-review recheck see the real number. Approve-from-`in_review` goes through `postDocument` too — it must be a no-op there (number already real) because `isDraftNo` is false. Make `sendToReview`/`submit` results include `doc_no`.
- [ ] **Step 3:** `delete`: select `doc_no`; after the draft check, `!isDraftNo(doc_no)` → `AP_PAYMENT_NUMBERED_VOID_ONLY`.
- [ ] **Step 4:** Read-only checks, note in the report: (a) `reserveDocumentNumbers` derives the next number from the series prefix (`APPV26…`) so `DRAFT-…` rows never affect it (same check as AP Invoice); (b) `ap-payment.writer.ts` update path never touches `doc_no`; (c) grep `period-end` and report-side queries for `tb_ap_payment.doc_no` assumptions about format.
- [ ] **Step 5:** `bunx tsc --noEmit`; `bunx jest src/ap` → pass.
- [ ] **Step 6:** Commit `feat(ap-payment): ฉบับร่างถือเลข DRAFT- ออกเลขจริงตอน submit และลบได้เฉพาะใบที่ยังไม่มีเลข`.

### Task 4: AP Payment actions — enforcement, creator rule, reject = void, send back by stage

**Files:**
- Modify: `MB/ap/ap-payment/ap-payment.service.ts` — `submit` (~L451), `approve` (~L486), `review` (~L523), `reject` (~L570), `voidDraft` (~L784), local `withReason` (~L1183, delete — use `withRejectReason`); constructor (inject `TenantService`; check `ap-payment.module.ts` imports `TenantModule`, add if not)
- Modify: `GW/application/ap-payment/ap-payment.controller.ts` — `@ApiOperation`/`@ApiBody` text for `review` (~L495) and `reject` (~L543, currently "back to draft"); `GW/application/ap-payment/swagger/request.ts` reject DTO: `reason` required

**Interfaces:**
- Consumes: Task 1 helpers/codes; `workflowOrchestrator.isFirstStage`.
- Produces: private `assertCanAct(pv: ApPaymentFull, action: StageActionKey)` → thin wrapper over `assertCanActOnDocument` with `AP_PAYMENT_ALLOW_CREATOR_APPROVE_KEY`.

- [ ] **Step 1:** `submit`: keep "no workflow → `postDocument`"; with a workflow use the re-resolved id (already `workflow_id: workflowId` in the `sendToReview` data). No source gate.
- [ ] **Step 2:** `approve` / `review` / `reject`: `assertCanAct` right after `loadForAction`; return its error (never throw). `approve` also stays correct for batch approve (same endpoint).
- [ ] **Step 3:** `review`: stage = `data.stage || pv.workflow_previous_stage` (API compatibility); `planSendBack` validates + builds; `doc_status = toDraft ? draft : in_review`; return the resulting status.
- [ ] **Step 4:** `voidDraft` gains `from: enum_ap_payment_status` (default `draft`) and an optional `extra` patch (as AP Invoice's). `reject`: `reason?.trim()` required → `AP_PAYMENT_REJECT_REASON_REQUIRED`; call `voidDraft(id, pv.doc_version, reason, in_review, workflowColumns(withRejectReason(buildRejectWorkflow(...), reason)))` — **one** guarded update (void + workflow columns). Returns `{ id, doc_status: void }`. The `void` endpoint keeps calling it with `draft`.
- [ ] **Step 5:** Read-only confirm (Review Focus 4): `reservedByLine` and `outstandingDocuments` exclude `void` vouchers; grep for any other table/query that treats an `in_review`-then-void voucher as reserving. Note in the report.
- [ ] **Step 6:** Update the gateway Swagger texts and the reject DTO.
- [ ] **Step 7:** `bunx tsc --noEmit` (MB + GW); `bunx jest src/ap src/common/workflow` → pass.
- [ ] **Step 8:** Commit `feat(ap-payment): workflow บังคับสิทธิ์ตาม stage, reject = void ทั้งใบ, send back ตาม stage และกันผู้สร้างอนุมัติเอง`.

### Task 5: Previous stages + `allowed_actions` on the voucher

**Files:**
- Modify: `packages/rpc-contract/src/contracts/ap-payment.ts` — add `previousStages: rpc('ap-payment.previous-stages','micro-business').restTodo()` (same as AP Invoice's); rebuild if the package has a build
- Modify: `MB/ap/ap-payment/ap-payment.controller.ts` (`@MessagePattern(ApPayment.previousStages.pattern)`) + service method
- Modify: `GW/application/ap-payment/ap-payment.controller.ts` + its service — `GET ':ap_payment_id/previous-stages'`, `AppIdGuard('ap-payment.findOne')` (reuse → no allowlist change), `ParseUUIDPipe`; declare it **before** any conflicting `:ap_payment_id/...` route if ordering matters
- Modify: MB `findOne` (~L132) + `MB/ap/ap-payment/dto/ap-payment.serializer.ts` + GW `swagger/response.ts` (a field missing from the gateway `@Serialize` schema is silently dropped — both layers)

**Interfaces — Produces:**
- MB `getPreviousStages(id): Promise<Result<Record<string, string>>>` — not found → `AP_PAYMENT_NOT_FOUND`; no workflow/stage → `Result.ok({})`; else `workflowOrchestrator.getPreviousStages(workflow_id, workflow_current_stage, userId, buCode)`.
- `findOne` response gains `allowed_actions: ('approve'|'reject'|'sendback')[]` via `computeAllowedActionsFor` — empty unless `in_review`; computed once per `findOne`. `findAll` does **not** compute it (see spec open question 1).

- [ ] **Step 1:** Contract + MB handler + GW route.
- [ ] **Step 2:** `allowed_actions` in MB `findOne` + both serializer schemas.
- [ ] **Step 3:** `bunx tsc --noEmit` (MB + GW); `bunx jest src/ap` → pass.
- [ ] **Step 4:** Commit `feat(ap-payment): endpoint stage ก่อนหน้า และ allowed_actions ของผู้ใช้ปัจจุบัน`.

### Task 6: Backend check + PR

- [ ] **Step 1:** Root `bun run check-types`; `cd apps/micro-business && bunx jest`; gateway jest — compare with the base branch failure list (gateway has known pre-existing failures, e.g. `dashboard-lab.controller.spec`), no new failures.
- [ ] **Step 2:** **Ask the user before pushing.** PR (English), base `feature/ap-invoice-workflow`: summary, deploy order (BE MB+GW together → allowlist `workflow.findAllApPayment` → FE), new error codes, BU key `ap.payment.allow-creator-approve`, the shared-helper extraction note, stacked-PR note, preflight SQL (active `ap_payment` workflows per BU, `in_review` vouchers).

## Frontend (`carmen-frontend`)

### Task 7: Workflow admin supports AP Payment

**Files:**
- Modify: `types/workflows.ts` (`AP_PAYMENT = "ap_payment"`), `constant/workflow.ts` (`WORKFLOW_CAPS[AP_PAYMENT] = { hasProducts:false, hasJvScope:false, totalOnlyRouting:true, canHidePrice:false }`, `workflowTypeField`, `WF_ROW_TYPE`, `WORKFLOW_TYPES`, `WF_TYPE_I18N_KEY`)
- Modify: `routes/system-admin/workflow/wf-role-colors.ts` (`["create","approve"]`), `wf-structure-lock-notice.tsx` (`{ path: "/accounting/accounts-payable/payment", status: "doc_status", value: "in_review" }` — check `routes/router.tsx`), `wf-new-form.tsx` (AP Payment option disabled + hint when an active one exists, locked-slug route `/workflow/ap-payment/new` blocks submit — follow the AP Invoice code), `wf-component.tsx` (`titleApPayment`)
- Modify: `hooks/use-workflow.ts` (`WORKFLOW_DOC_TYPES` + `"ap-payment"`, `WORKFLOW_TYPE_BY_DOC_TYPE`, `useApPaymentWorkflows`, `WORKFLOW_LIST_HOOKS`), `constant/module-list.ts` (~:910 area, `workflowApPayment` → `/system-admin/workflow/ap-payment`, same licenseFeature/permission as AP Invoice — see skill `license-gating`: reuse the **existing** key, do not invent a new feature key), System Admin landing card if it lists workflow types
- Modify: `messages/en.json` + `messages/th.json` — `systemAdmin.workflow.typeApPayment`, `titleApPayment`, `apPaymentSingleActiveHint` (ICU-safe: no `{{ }}` / `<word>`; use `{workflow}`), menu `workflowApPayment`
- Modify (existing tests): `routes/system-admin/workflow/wf-menu.test.ts` and any test enumerating workflow types

- [ ] **Step 1:** Types/constants/caps; confirm no `=== WORKFLOW_TYPE.JV || AP_INVOICE` pair remains that needs an `AP_PAYMENT` arm (grep `WORKFLOW_TYPE.AP_INVOICE` — each hit gets a payment sibling, preferring `WORKFLOW_CAPS`).
- [ ] **Step 2:** Hooks, slug, menu, titles, landing, new-form guard, i18n.
- [ ] **Step 3:** `bun run typecheck`; `bun test:run routes/system-admin/workflow hooks` → pass.
- [ ] **Step 4:** Commit `feat(workflow): ตั้ง workflow ของ AP Payment ได้ (เส้นเดียวต่อ BU)`.

### Task 8: Default Setting — creator-approve key for AP Payment

Follow skill `add-business-setting-config`.

**Files:** `routes/system-admin/company-profile/company-profile-config-registry.ts` (append a **second item** to the existing `ap` section), `messages/en.json` + `th.json`, existing `company-profile-config-registry.test.ts` (extend the existing describe — allowed, not a new file).

- Item `{ key: "ap.payment.allow-creator-approve", datatype: "boolean", defaultValue: "false", label: "Allow the creator to approve their own AP payment", labelKey: "config.apPaymentAllowCreatorApprove" }`
- i18n en: label as above · th: `"อนุญาตให้ผู้สร้างอนุมัติใบจ่ายเงิน AP ของตัวเอง"`

- [ ] **Step 1:** Registry + i18n + registry test.
- [ ] **Step 2:** `bun run typecheck`; `bun test:run routes/system-admin/company-profile` → pass.
- [ ] **Step 3:** Commit `feat(default-setting): ตั้งค่าให้ผู้สร้างอนุมัติใบจ่ายเงิน AP ของตัวเองได้`.

### Task 9: AP Payment page + batch approve — buttons from `allowed_actions`, send-back stage picker, reject = void, delete vs void

**Files:**
- Modify: `types/accounts-payable.ts` (`ApPayment.allowed_actions?: ("approve"|"reject"|"sendback")[]`)
- Modify: `routes/accounting/accounts-payable/shared/ap-http-repository.ts` (`mapPayment` ~L232: map `allowed_actions`, default `[]`; `doc_no` already mapped), `shared/ap-status.ts` (add `apPaymentActions(doc, userId)` mirroring `apInvoiceActions`: draft → `isDraftDocNo(doc_no) ? ["submit","delete"] : ["submit","void"]`; `in_review` → `allowed_actions` when present else the existing `userCanExecute` rule; posted → `["void"]`; **remove the now-unused payment branch of `apActions`** if nothing else calls it — grep first)
- Modify: previous-stages hook → rename/generalise `shared/use-ap-invoice-previous-stages.ts` to `useApPreviousStages(kind: "invoice" | "payment", id, enabled)`; add `API_ENDPOINTS.AP_PAYMENT_PREVIOUS_STAGES(bu, id)` → `/api/proxy/api/${bu}/ap-payment/${id}/previous-stages` and `QUERY_KEYS.AP_PAYMENT_PREVIOUS_STAGES`; update the invoice page import
- Create (component, not a test): extract the send-back stage `Select` block of `invoice/ap-invoice-detail.tsx` (~L748-800: stage select, loading/error/no-stages states, required stage) into `shared/ap-send-back-fields.tsx`; both detail pages render it
- Modify: `payment/ap-payment-detail.tsx` — `apPaymentActions`; Send back opens the dialog with the stage picker and calls `runAction("sendback", note, stage)` (extend `runAction` to pass `stage`; `use-accounts-payable.ts` `toApCommand`/`useApPaymentAction` already map `sendback` → `review` — add `stage` to the body); Reject dialog: required reason, copy says the voucher will be voided and cannot be reopened; `needsReason = void || reject` (L577 currently `void` only)
- Modify: `payment/ap-payment-list.tsx` `approveBatch` (~L234): keep `canBatchApprovePayment`, but collect the **first failed row's server message** (`ApiError` message) and show it in the partial-success toast (new key `approvalPartialWithReason`, ICU-safe); do not swallow silently
- Modify: `messages/en.json` + `th.json` — `accountsPayable.payment.detail.actions.sendback` wording check, `reasonDialog.sendback.*` / `reasonDialog.reject.*` (void wording) for payments, `errors.byCode` for `AP_PAYMENT_REJECT_REASON_REQUIRED`, `AP_PAYMENT_NUMBERED_VOID_ONLY` (`WORKFLOW_CREATOR_CANNOT_APPROVE` / `WORKFLOW_SENDBACK_STAGE_INVALID` already exist from the AP Invoice round — verify)
- Modify (existing tests): `payment/ap-payment-approval.test.ts`, `shared/ap-document-ui.test.tsx` and any test asserting payment actions / draft actions

- [ ] **Step 1:** Types, repository mapping, `apPaymentActions`, previous-stages generalisation, extracted component.
- [ ] **Step 2:** Payment detail: send-back dialog with stage, reject dialog copy + required reason, draft Delete vs Void, `stage` in the action body.
- [ ] **Step 3:** Batch approve toast with the first error message; confirm the approval-queue tabs still read `doc_status|string:in_review` / posted+approved (no change expected).
- [ ] **Step 4:** i18n (ICU-safe).
- [ ] **Step 5:** `bun run typecheck`; `bun test:run routes/accounting/accounts-payable` → pass; `bunx eslint` on touched files.
- [ ] **Step 6:** Commit `feat(ap-payment): ปุ่มตาม allowed_actions, send back เลือก stage, reject = void, ลบได้เฉพาะใบ DRAFT และ batch approve แจ้งเหตุผลที่ถูกปฏิเสธ`.

### Task 10: Frontend check + PR

- [ ] **Step 1:** `bun run typecheck`; `bun test:run` → no new failures vs `main`; `SKIP_VERSION_BUMP=1 bun run build`.
- [ ] **Step 2:** **Ask the user before pushing.** PR (English), base FE `feature/ap-invoice-workflow`: depends on the backend PR; deploy order; allowlist `workflow.findAllApPayment`.

## Manual verification (user-driven, after BE on dev)

On a test BU: create the AP Payment workflow (2 approval stages) → a second active one is refused → new payment shows `DRAFT-…`, can be deleted → another submitted gets `APPV…` and enters review → creator (flag off) has no Approve (detail **and** batch page reports the refusal) → approver at stage 2 sends back to stage 1 approver → stays in review; picking a later stage via curl is refused → stage 1 + stage 2 approve → posted, JV description carries the real number, invoice outstanding reduced → reject on another voucher requires a reason, becomes void, its invoice lines are payable again → send a voucher back to the create stage (keeps real number): Delete is gone, Void is offered → flip `ap.payment.allow-creator-approve` on → creator can approve → no active workflow: submit posts directly with a real number.
