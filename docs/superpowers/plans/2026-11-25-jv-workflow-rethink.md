# JV Workflow Rethink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **User preference (overrides TDD):** do not write new `*.spec.ts` / `*.test.ts` files. Each task = implement → typecheck + lint → run the **existing** suites it touches (update existing expectations that the spec deliberately changes) → commit. Manual verification is in Task 10.

**Goal:** Make JV approval follow the same rules as AP/AR (reject = void, send back to a chosen stage, creator cannot self-approve, `DRAFT-` numbers) and replace the "no overlap at all" scope rule with a 4-tier "narrowest wins" rule.

**Architecture:** Backend `micro-business` reuses `common/workflow/accounting-doc-workflow.ts` helpers inside `GlJvService`; the scope resolver/overlap check in `gl-jv-workflow-scope.ts` becomes tier-aware. Real JV numbers move from create time to "first leaves draft" (enter review or post). Frontend JV detail switches to backend `allowed_actions` and reuses the AP send-back UI.

**Tech Stack:** NestJS + Prisma (micro-business, backend-gateway, `packages/rpc-contract`, `packages/error-catalog`), React 19 + React Router 7 + TanStack Query (carmen-frontend).

**Spec:** `docs/superpowers/specs/2026-11-25-jv-workflow-rethink-design.md` (carmen-frontend) — read it before each task.

**Branches:** `feature/jv-workflow-rethink` in both `carmen-turborepo-backend` (tasks 1–5) and `carmen-frontend` (tasks 6–9). Base = `main`. Commit messages in Thai.

## Global Constraints

- Workflow sources eligible for JV workflow stay exactly: `manual`, `recurring`, `allocation`, `amortize`, `reversal`, `closing` (`JV_WORKFLOW_SOURCES`).
- Creator-approve BU key: `gl.jv.allow-creator-approve`, boolean, default `false`.
- Draft number format: `DRAFT-` + 8-digit zero-padded counter via `nextDraftNo(tx, 'gl_jv_running_no', userId)`.
- Real number = `generateJvNo({ prisma: tx, buCode, prefixCode, jvDate })` using the voucher's `jv_date` at the moment it leaves draft, inside the same transaction that changes status.
- A voucher that already holds a real number never gets a new one (`isDraftNo(jv_no) === false` → no-op), including after send back / unschedule.
- Tier order: 1 (prefix+source) < 2 (prefix only) < 3 (source only) < 4 (catch-all). Lowest tier number wins.
- Overlap forbidden only within the same tier; tier 4 max one active per BU.
- Reject reason required; reject sets `jv_status = void` + `void_at/void_by_id/void_reason`, never touches `tb_gl_balance`.
- Existing numbered drafts keep their numbers (no data migration).
- No new migrations; no change to how AP/AR/inventory/asset/interface JVs are routed (they never enter workflow).
- Module boundary (FE): code shared by two features of `routes/accounting/` goes in `routes/accounting/shared/`.

## Review Focus

1. **Subledger / auto-reverse JVs** (created and posted in one flow) must end `posted` with a real number — no `posted` row with `jv_no LIKE 'DRAFT-%'`. Pinned in Task 2 (`postInTx` issues the number) and checked by SQL in Task 10.
2. **Rejecting a manual reversal** leaves the original `posted`, `reversed_by_jv_id` null, and reversible again. Task 3 + Task 10 manual check.
3. **Rejecting a template-generated draft** frees `tb_gl_jv_template_run` so generating the same template+period succeeds. Task 3 + Task 10.
4. **Old numbered draft** (created before deploy): delete refused with 409, void-draft works, FE shows Void not Delete. Task 2/3/7 + Task 10.
5. **Draft number display**: nowhere renders `<prefix>DRAFT-…` (list, detail header, export, print, activity sheet). Task 7 + Task 10.

---

### Task 1: Tiered JV workflow scope (backend)

**Files:**
- Modify: `apps/micro-business/src/gl/gl-jv/workflow/gl-jv-workflow-scope.ts` (`scopesOverlap`, `resolveJvWorkflowId`)
- Modify: `apps/micro-business/src/master/workflows/workflows.service.ts:527-560` (`findOverlappingJvWorkflow`)
- Existing tests to keep green: any `*.spec.ts` beside those two files

**Interfaces:**
- Produces: `export type JvScopeTier = 1 | 2 | 3 | 4;` · `export function scopeTier(scope: JvScope): JvScopeTier` · `export function scopesConflict(a: JvScope, b: JvScope): boolean` (same tier AND `scopesOverlap`; tier 4 vs tier 4 → always true) · `resolveJvWorkflowId(db, key)` unchanged signature, now returns the matching workflow with the lowest tier (ties → oldest `created_at`, kept only as a defensive fallback).

- [ ] **Step 1:** Implement `scopeTier` (prefix_ids non-empty & sources non-empty → 1; prefix only → 2; sources only → 3; both empty → 4) and `scopesConflict`. Keep `scopesOverlap` exported (used by `scopesConflict`).
- [ ] **Step 2:** Change `resolveJvWorkflowId` to collect all matching workflows and return the one with min `scopeTier`; keep the parse-failure `logger.warn` skip.
- [ ] **Step 3:** In `findOverlappingJvWorkflow` replace `scopesOverlap(scope, otherScope.value)` with `scopesConflict(...)`. Keep the advisory lock and the existing error (`workflow` name in payload) unchanged.
- [ ] **Step 4:** `bun run typecheck` and lint for micro-business; run existing jest specs for `gl-jv-workflow-scope` and `workflows.service` — update only the expectations the spec changes (e.g. "empty scope overlaps everything" becomes "conflicts only with another catch-all").
- [ ] **Step 5:** Commit `feat(gl-jv): ขอบเขต workflow JV แบบลำดับชั้น ตัวที่แคบกว่าชนะ`

### Task 2: JV `DRAFT-` numbers, real number on leaving draft (backend)

**Files:**
- Modify: `apps/micro-business/src/gl/gl-jv/gl-jv.running-code.ts` (add constant + helper)
- Modify: `apps/micro-business/src/gl/gl-jv/gl-jv.service.ts:146-236` (`createInternal`), `:498` (`delete`), `:542` (`submit`)
- Modify: `apps/micro-business/src/gl/gl-posting/gl-posting.service.ts` — `postInTx` (~L422), `createReversalDraft` (~L960), closing voucher create (~L1290), reverse→review path (~L794)
- Modify: `packages/error-catalog` — add `GL_JV_NUMBERED_DRAFT_NOT_DELETABLE` (409, EN+TH message: numbered draft cannot be deleted, void it instead)

**Interfaces:**
- Produces: `export const GL_JV_DRAFT_RUNNING_NO_KEY = 'gl_jv_running_no';` · `export async function ensureRealJvNo(tx: Prisma.TransactionClient, header: { id: string; jv_no: string; prefix_code: string; jv_date: Date }, buCode: string): Promise<string>` — returns current `jv_no` if not draft; else generates via `generateJvNo`, writes `tb_gl_jv_header.jv_no`, returns it.

- [ ] **Step 1:** `createInternal`, `createReversalDraft`, closing create: replace `generateJvNo(...)` with `nextDraftNo(tx, GL_JV_DRAFT_RUNNING_NO_KEY, this.userId)`. (Subledger vouchers go through `createInternal` too; Step 2 gives them a real number when they post in the same flow.)
- [ ] **Step 2:** `postInTx`: call `ensureRealJvNo` first (after the row/year lock, before anything reads `jv_no`) and use the returned number on the in-memory header.
- [ ] **Step 3:** Enter-review paths (`GlJvService.submit` in_review branch and the gl-posting reverse→review branch): call `ensureRealJvNo` in the same transaction as the status update — convert `submit`'s bare `update` into `runAtomic` if needed. The direct-post branch is covered by Step 2.
- [ ] **Step 4:** `delete`: if `!isDraftNo(existing.jv_no)` → `Result.errorFromCatalog(ERROR_CATALOG.GL_JV_NUMBERED_DRAFT_NOT_DELETABLE)`; select `jv_no`.
- [ ] **Step 5:** Grep `jv_no` across micro-business + gateway for logic that sorts/searches/parses it (not just display) and make it tolerate `DRAFT-`; list findings in the commit body.
- [ ] **Step 6:** Rebuild error-catalog package, typecheck + lint, run existing gl-jv / gl-posting / gl-subledger-posting / gl-jv-template specs; fix expectations that assert a real number on a fresh draft.
- [ ] **Step 7:** Commit `feat(gl-jv): ใบร่าง JV ใช้เลข DRAFT- ออกเลขจริงตอนเข้า review หรือ post`

### Task 3: Void without ledger effect; reject = void (backend)

**Files:**
- Modify: `apps/micro-business/src/gl/gl-jv/gl-jv.service.ts:727` (`reject`), add `voidUnposted`, `voidDraft`
- Modify: `apps/micro-business/src/gl/gl-jv/gl-jv.controller.ts` + `packages/rpc-contract/src/contracts/gl-jv.ts` (new `voidDraft` pattern `gl-jv.void-draft`, REST `POST /gl-jv/:id/void-draft`)
- Modify: `apps/backend-gateway/src/application/gl-jv/gl-jv.controller.ts`, `gl-jv.service.ts`, `swagger/request.ts` (`GlJvRejectRequestDto.reason` required, non-blank; new `GlJvVoidDraftRequestDto { reason: string }`)

**Interfaces:**
- Consumes: `withRejectReason(workflow, reason)` from `@/common/workflow/accounting-doc-workflow`.
- Produces: `private async voidUnposted(tx: Prisma.TransactionClient, header: { id: string }, reason: string): Promise<void>` — sets `jv_status: void`, `void_at`, `void_by_id`, `void_reason`, bumps `doc_version`, and `tb_gl_jv_template_run.deleteMany({ where: { jv_header_id } })`. · `async voidDraft(id: string, data: { reason: string }): Promise<Result<unknown>>` — only `draft` with a real number (`!isDraftNo`), else `GL_JV_IMMUTABLE`; empty reason → `GL_JV_VOID_REASON_REQUIRED`. · Gateway route `POST :gl_jv_id/void-draft`, `AppIdGuard('gl-jv.void-draft')`, `@Permission({ [GL_RESOURCE]: ['void'] })` (same as posted void).

- [ ] **Step 1:** Implement `voidUnposted`. Do not call `GlPostingService.voidJv` (posted-only, backs out balances). Trigger `gl_jv_posted_guard` only guards OLD status posted/void, so draft/in_review → void is allowed.
- [ ] **Step 2:** `reject`: require trimmed reason (`GL_JV_VOID_REASON_REQUIRED` when blank); inside `runAtomic`: write the reject workflow header with `withRejectReason(workflow, reason)` **without** touching `note`, then `voidUnposted`. Return `{ id, jv_status: 'void' }`.
- [ ] **Step 3:** Confirm for a rejected reversal that nothing marks the original reversed (`reversed_by_jv_id` is only written in `postReversal`) — note result in commit body.
- [ ] **Step 4:** Add `voidDraft` (MB service + controller + rpc contract + gateway route/DTO + swagger).
- [ ] **Step 5:** Typecheck + lint both apps; run existing gl-jv specs (reject expectations change from draft → void).
- [ ] **Step 6:** Commit `feat(gl-jv): reject = void ทั้งใบ และ void ใบร่างที่มีเลขจริงได้`

### Task 4: Shared act check, creator rule, `allowed_actions` (backend)

**Files:**
- Modify: `apps/micro-business/src/gl/gl-jv/gl-jv.service.ts` — `approve` (:646), `reject`, `findOne` (:60), remove `refuseUnlessStageApprover` (:834)
- Modify: `apps/micro-business/src/common/workflow/accounting-doc-workflow.ts` (add key constant)
- Modify: gateway `gl-jv` findOne response serializer/swagger (`allowed_actions: ('approve'|'reject'|'sendback')[]`)

**Interfaces:**
- Produces: `export const GL_JV_ALLOW_CREATOR_APPROVE_KEY = 'gl.jv.allow-creator-approve';` · `private actCtx(): AccountingActContext` · `findOne` payload gains `allowed_actions: StageActionKey[]` (always present; `[]` unless `in_review`) — mirror `ap-invoice.service.ts:189` + `:1480`.

- [ ] **Step 1:** Replace `refuseUnlessStageApprover(header, document, action)` with `assertCanActOnDocument(this.actCtx(), { workflowDoc: document, userAction: header.user_action, createdById: header.created_by_id }, action)` in approve/reject (and Task 5 review). Delete the old method.
- [ ] **Step 2:** `findOne`: add `allowed_actions` via `computeAllowedActionsFor(header.jv_status === 'in_review', (a) => assertCanActOnDocument(...), onError→logger.warn)`.
- [ ] **Step 3:** Make sure the gateway serializer passes `allowed_actions` through (see memory: new fields need both micro + gateway serializers).
- [ ] **Step 4:** Typecheck + lint + existing specs. Commit `feat(gl-jv): ตรวจสิทธิ์อนุมัติด้วย helper กลาง ห้ามผู้สร้างอนุมัติเอง และคืน allowed_actions`

### Task 5: Send back + previous stages (backend)

**Files:**
- Modify: `apps/micro-business/src/gl/gl-jv/gl-jv.service.ts` (add `review`, `previousStages`), `gl-jv.controller.ts`
- Modify: `packages/rpc-contract/src/contracts/gl-jv.ts` (`review`: `gl-jv.review` `POST /gl-jv/:id/review`; `previousStages`: `gl-jv.previous-stages` `GET /gl-jv/:id/previous-stages`)
- Modify: gateway `gl-jv.controller.ts`, `gl-jv.service.ts`, `swagger/request.ts` (`GlJvReviewRequestDto { stage: string; reason?: string | null }`)

**Interfaces:**
- Consumes: `planSendBack(ctx, { workflowDoc, workflowId, currentStage }, stage)`, `assertCanActOnDocument(..., 'sendback')`, `withRejectReason`.
- Produces: `async review(id: string, data: { stage: string; reason?: string | null }): Promise<Result<unknown>>` → `{ id, jv_status: 'draft' | 'in_review' }`; `async previousStages(id: string): Promise<Result<Record<string, string>>>` (same shape AP returns). Gateway: `POST :gl_jv_id/review` `AppIdGuard('gl-jv.review')`; `GET :gl_jv_id/previous-stages` `AppIdGuard('gl-jv.previous-stages')` — copy AP Invoice controller's structure (`ap-invoice.controller.ts:181`, `:495`).

- [ ] **Step 1:** Implement `review` mirroring `ap-invoice.service.ts:1016`: in_review only; act check; `planSendBack`; write header (+ reason via `withRejectReason`); `toDraft` → `jv_status = draft` (keeps the real number; leave `workflow_id` as is — `submit` always re-runs `resolveJvWorkflowId` from draft, which satisfies the spec's "resolve again on resubmit").
- [ ] **Step 2:** Implement `previousStages` via `workflowOrchestrator.getPreviousStages(workflow_id, workflow_current_stage, userId, buCode)`.
- [ ] **Step 3:** Wire controller, rpc contract, gateway routes + swagger.
- [ ] **Step 4:** Typecheck + lint + existing specs. Commit `feat(gl-jv): ส่งกลับ JV ไปขั้นก่อนหน้าได้`
- [ ] **Step 5:** Push branch, open BE PR (English body) listing deploy order: MB+GW together → rebuild error-catalog → allowlist `gl-jv.review`, `gl-jv.previous-stages`, `gl-jv.void-draft` on every env.

### Task 6: Default Setting key (frontend)

**Files:**
- Modify: `routes/system-admin/company-profile/company-profile-config-registry.ts` (GL/accounting section — add one if none; follow the `ap`/`ar` sections at ~L213–253)
- Modify: message files (EN + TH) for `config.glJvAllowCreatorApprove`
- Existing test: `company-profile-config-registry.test.ts` must stay green

**Interfaces:**
- Produces: registry item `{ key: "gl.jv.allow-creator-approve", datatype: "boolean", defaultValue: "false", label: "Allow the creator to approve their own journal voucher", labelKey: "config.glJvAllowCreatorApprove" }`.

- [ ] **Step 1:** Add item (+ section strings if a new section). Messages must not contain `{}` or `<word>` (ICU).
- [ ] **Step 2:** `bun run typecheck`, lint, `bun test:run routes/system-admin/company-profile`. Commit `feat(default-setting): เพิ่มสวิตช์ให้ผู้สร้างอนุมัติ JV ของตัวเอง`

### Task 7: JV data layer — allowed_actions, new actions, numbers (frontend)

**Files:**
- Modify: `constant/api-endpoints.ts` (add `GL_JV_PREVIOUS_STAGES(buCode, id)`; `review` / `void-draft` go through the existing `JOURNAL_VOUCHER_ACTION`-style `/${action}` builder at ~L160)
- Modify: `constant/query-keys.ts` (`GL_JV_PREVIOUS_STAGES: "gl-jv-previous-stages"`)
- Modify: `routes/accounting/journal-voucher/journal-voucher-http-repository.ts`, `use-journal-voucher.ts`, `journal-voucher-source.ts` (`journalVoucherCapabilities`), `types/journal-voucher.ts` (or wherever `JournalVoucher` / `JournalVoucherCommand` / `JournalVoucherCapabilities` live)
- Create: `routes/accounting/journal-voucher/use-jv-previous-stages.ts`

**Interfaces:**
- Produces: `JournalVoucherCommand` gains `"review" | "void-draft"`; `JournalVoucher.allowed_actions?: ("approve" | "reject" | "sendback")[]`; `JournalVoucherCapabilities` gains `can_send_back: boolean`, `can_delete: boolean`, `can_void_draft: boolean`; `useJvPreviousStages(id: string | undefined, enabled: boolean)` returns `UseQueryResult<ApPreviousStage[]>` (same mapping as `use-ap-previous-stages.ts`). · `export function formatJvNo(prefix: string | null, jvNo: string): string` — returns `jvNo` unchanged when `isDraftDocNo(jvNo)`, else the existing prefix+number format.

- [ ] **Step 1:** Capabilities: `can_approve/can_reject/can_send_back` = `allowed_actions` includes `approve`/`reject`/`sendback` (drop the role + stage_actions derivation); `can_delete` = draft && `isDraftDocNo(jv_no)`; `can_void_draft` = draft && !`isDraftDocNo(jv_no)` && !generated-from-subledger; posted `can_void` unchanged. Keep `can_submit` etc.
- [ ] **Step 2:** Replace every place that composes prefix + `jv_no` for display (repository mapping ~L236–252/L406, list, detail header, export, print, activity sheet title) with `formatJvNo`.
- [ ] **Step 3:** Add `useJvPreviousStages`, endpoint, query key.
- [ ] **Step 4:** typecheck, lint, `bun test:run routes/accounting/journal-voucher routes/accounting/documents`. Commit `feat(jv): ใช้ allowed_actions จาก backend และรองรับเลข DRAFT-`

### Task 8: JV detail actions — reject reason, send back, void draft (frontend)

**Files:**
- Move: `routes/accounting/accounts-payable/shared/ap-send-back-fields.tsx` → `routes/accounting/shared/send-back-fields.tsx` (rename export `ApSendBackFields` → `SendBackFields`; update AP + AR imports). Move `ApPreviousStage` type with it as `PreviousStage`.
- Modify: `routes/accounting/documents/accounting-document-detail.tsx` (~L286–296 hooks, ~L1170–1215 handlers, ~L1275–1320 action bar)
- Modify: `routes/accounting/documents/jv-reject-dialog.tsx` (reason required, copy says the voucher will be voided)
- Create: `routes/accounting/documents/jv-send-back-dialog.tsx`
- Modify: `routes/accounting/documents/jv-void-dialog.tsx` (support draft void → `void-draft` command) · message files EN+TH

**Interfaces:**
- Consumes: Task 7 capabilities, `useJournalVoucherAction("review" | "void-draft" | "reject")`, `useJvPreviousStages`, `SendBackFields` (pass `labels`).
- Produces: `JvSendBackDialog({ open, onOpenChange, journalId, onConfirm(stage: string, reason: string) })`.

- [ ] **Step 1:** Move the send-back fields file, fix AP/AR imports, typecheck.
- [ ] **Step 2:** Reject dialog: submit disabled until reason non-blank; toast on success "voided".
- [ ] **Step 3:** Send back dialog + button (shown when `can_send_back`), payload `{ stage, reason }`; after success refetch.
- [ ] **Step 4:** Draft action bar: Delete when `can_delete`, Void when `can_void_draft` (void dialog posts `void-draft`). Follow the one-primary-button rule (`form-primary-one-button-rule`) and the view-flag rule for view-mode text.
- [ ] **Step 5:** Surface `GL_JV_NUMBERED_DRAFT_NOT_DELETABLE` and `WORKFLOW_CREATOR_CANNOT_APPROVE` through the existing error-catalog toast path (add FE catalog messages if the FE maps codes).
- [ ] **Step 6:** typecheck, lint, `bun test:run routes/accounting`. Commit `feat(jv): ปุ่มส่งกลับ ปฏิเสธ=void และ void ใบร่างที่มีเลขแล้ว`

### Task 9: Workflow scope form — show tier (frontend)

**Files:**
- Modify: `routes/system-admin/workflow/wf-jv-scope.tsx`, `wf-scope-line.tsx` (if the summary line lives there) · message files EN+TH
- Create: `routes/system-admin/workflow/jv-scope-tier.ts`

**Interfaces:**
- Produces: `export function jvScopeTier(scope: { prefix_ids: string[]; sources: string[] }): 1 | 2 | 3 | 4` (same rule as backend Task 1).

- [ ] **Step 1:** Show a one-line tier label under the scope fields: tier 4 = "Catch-all — receives vouchers no other workflow covers"; 1–3 = which dimension it narrows; plus one hint line "A narrower workflow wins over a broader one". Use `docs/DESIGN.md` tokens; readable in dark mode.
- [ ] **Step 2:** Update the overlap error copy (if FE has its own) to say the clash is with a workflow of the same level.
- [ ] **Step 3:** typecheck, lint, `bun test:run routes/system-admin/workflow`. Commit `feat(workflow): แสดงระดับขอบเขตของ workflow JV`
- [ ] **Step 4:** `trail check`, push, open FE PR (English) stating BE PR must deploy first.

### Task 10: Verification (manual — the user verifies this way)

On a local backend pointed at a **throwaway** BU / documents only (dev DB is shared — never reject or void a real document):

- [ ] Create workflows: catch-all W4, prefix-only W2 (e.g. AJ), source-only W3 (closing), both W1 (AJ+closing). Saving a second catch-all → refused naming W4; a second AJ-only → refused naming W2; W2 + W3 together → allowed.
- [ ] Submit: GJ manual → W4; AJ manual → W2; GJ closing → W3; AJ closing → W1.
- [ ] New manual JV shows `DRAFT-0000000N` (no prefix glued on) in list/detail/export/print; submit gives the real `<prefix><yyyymm…>` number; send back to first stage keeps that number; resubmit keeps it.
- [ ] Creator approve refused (`WORKFLOW_CREATOR_CANNOT_APPROVE`); toggle `gl.jv.allow-creator-approve` on → allowed.
- [ ] Reject without reason → 400; with reason → `void`, reason in workflow history, `note` unchanged, `tb_gl_balance` unchanged.
- [ ] Reject a manual reversal → original still `posted`, reverse again succeeds.
- [ ] Reject a template-generated draft → generate same template+period again succeeds.
- [ ] Old numbered draft: DELETE → 409 `GL_JV_NUMBERED_DRAFT_NOT_DELETABLE`; Void draft works; UI shows Void not Delete.
- [ ] Post an AP invoice / GRN on the test BU, then SQL: `SELECT count(*) FROM tb_gl_jv_header WHERE jv_status='posted' AND jv_no LIKE 'DRAFT-%'` → 0.
- [ ] Record deploy notes in memory (`jv-workflow-by-type` → updated): BE (MB+GW) → error-catalog rebuild → allowlist `gl-jv.review`, `gl-jv.previous-stages`, `gl-jv.void-draft` → FE `vercel --prod`.
