# Draft Number Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **User preference (overrides TDD):** skip "write the failing test / run to see it fail" steps and do not create new `*.spec.ts` files. Do update **existing** specs that hard-code the old `draft-` format so the suites still pass. Always run type-check + the touched spec files.

**Goal:** Every draft PR/SR/GRN/PO carries `DRAFT-%08d` (e.g. `DRAFT-00000013`); real numbers are reserved only when a doc leaves draft.

**Architecture:** Change the single shared helper `nextDraftNo` and its prefix constant; route every prefix check through it; rewrite existing `draft-N` rows with a tenant SQL migration; switch manual PO create to a draft placeholder and reserve the real PO number at submit.

**Tech Stack:** NestJS micro-business, Prisma (tenant schema, raw-SQL migration), Jest, Playwright (e2e repo).

**Spec:** `docs/superpowers/specs/2026-11-24-draft-number-standard-design.md` (in `carmen-frontend`)

**Repos / branches:** backend `carmen-turborepo-backend` → branch `feature/draft-number-standard` off `main`; e2e `carmen-frontend-e2e` → branch `feature/draft-number-standard` off `main`. Commit messages in Thai (repo convention).

## Global Constraints

- Format: `'DRAFT-' + String(n).padStart(8, '0')`; prefix constant `DRAFT_NO_PREFIX = 'DRAFT-'` (uppercase, case-sensitive).
- Counter keys and values unchanged (`pr_running_no`, `sr_running_no`, `grn_running_no`, value `{ last_no }`); new key for PO: `po_running_no`. Never reset.
- PO must never get two real numbers; a real number is reserved at most once per PO.
- Historical denormalised text (activity log, comments, notifications, JV descriptions) is not rewritten.
- No FE change, no gateway change unless the Task 2 grep finds a prefix check there.

## Review Focus

1. **Old `draft-N` row still present when new code runs** (migration not yet applied on an env) — period-end must not count it as numbered. Mitigated by deploy order; Task 3 notes call this out.
2. **Send-back PO resubmitted** — already holds a real number; submit must keep it (`isDraftNo` false → no reservation). Test in Task 4.
3. **Pre-existing PO draft with a real number** submitted after deploy — keeps its number. Same test as 2.
4. **Concurrent PO creates** — `nextDraftNo` advisory lock + `@@unique([po_no, deleted_at])` backstop; both get distinct `DRAFT-` numbers.
5. **Real-number generator sees `DRAFT-…` rows** — `readRunningNo` must reject them, as it rejects `draft-12` today. Test in Task 1.

---

### Task 1: Helper format + shared predicate

**Files:**
- Modify: `apps/micro-business/src/common/helpers/draft-running-no.helper.ts`
- Modify (existing specs): `apps/micro-business/src/common/helpers/running-code-shape.helper.spec.ts:162`, `apps/micro-business/src/common/helpers/document-number.helper.spec.ts:111`

**Interfaces:**
- Produces: `export const DRAFT_NO_PREFIX = 'DRAFT-'`; `export function isDraftNo(no: string | null | undefined): boolean` (true iff `no?.startsWith(DRAFT_NO_PREFIX)`); `nextDraftNo(tx, key, user_id): Promise<string>` returning `DRAFT-%08d`. Update its JSDoc (EN/TH) to the new format.

- [ ] **Step 1:** Implement the constant, `isDraftNo`, and the padded return in `nextDraftNo` (counter logic unchanged).
- [ ] **Step 2:** In the two existing specs, change the draft-placeholder fixtures to the new format (`'DRAFT-00000012'`, `{ code: 'DRAFT-26100099' }`) keeping the old ones too as extra rows/cases (both must be rejected/ignored — covers Review Focus 5).
- [ ] **Step 3:** Run `cd apps/micro-business && bunx tsc --noEmit && bunx jest src/common/helpers` → 0 type errors, all pass.
- [ ] **Step 4:** Commit `feat(draft-no): เลข draft เป็น DRAFT- + 8 หลัก และเพิ่ม isDraftNo`.

### Task 2: Route every prefix check through the helper (PR · SR · GRN · period-end)

**Files:**
- Modify: `apps/micro-business/src/inventory/good-received-note/good-received-note.service.ts:136,2795` (drop `GRN_DRAFT_NO_PREFIX`, use `isDraftNo`)
- Modify: `apps/micro-business/src/inventory/period-end/period-end.validate.ts:192` (delete local constant, import `DRAFT_NO_PREFIX`)
- Modify: comments mentioning `draft-{seq}` in `purchase-request.service.ts:2480`, `store-requisition.service.ts:73`, `good-received-note.service.ts:2763`, `good-received-note.logic.ts:137` → `DRAFT-{8 digits}`
- Modify (existing specs with `draft-` fixtures): `purchase-request.service.spec.ts`, `purchase-request.controller.spec.ts`, `store-requisition.service.spec.ts`, `good-received-note.service.spec.ts`, `good-received-note.logic.spec.ts`, `period-end.validate.spec.ts`, `credit-note.logic.spec.ts`

**Interfaces:** Consumes Task 1 `DRAFT_NO_PREFIX`, `isDraftNo`.

- [ ] **Step 1:** Run `grep -rnE "['\"\`]draft-|draft-%|startsWith\('draft" apps packages --include='*.ts'` in the backend and `grep -rn "draft-" ../carmen-mobile --include='*.ts' --include='*.tsx' --include='*.dart'` (if the repo exists). Every code hit (not spec, not unrelated words like `draft-ingredient`) switches to the shared constant/predicate. Record mobile hits in the PR description (do not edit mobile).
- [ ] **Step 2:** Apply the file changes above.
- [ ] **Step 3:** Update the listed specs' fixtures from `draft-N` to `DRAFT-%08d` (assert the exact padded value where a spec asserts the generated number).
- [ ] **Step 4:** Run `bunx tsc --noEmit && bunx jest src/inventory src/procurement/purchase-request src/procurement/credit-note` → pass.
- [ ] **Step 5:** Commit `refactor(draft-no): ทุกจุดที่ตรวจเลข draft ใช้ค่าคงที่กลางตัวเดียว`.

### Task 3: Tenant migration rewriting existing draft numbers

**Files:**
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261124100000_draft_no_standard/migration.sql`

- [ ] **Step 1:** Write DML-only SQL, header comment in the style of `20261116110000_reset_dimension_json` (idempotent; safe to re-run), one statement per column:
  ```sql
  UPDATE "tb_purchase_request" SET "pr_no" = 'DRAFT-' || lpad(substring("pr_no" from 7), 8, '0')
  WHERE "pr_no" LIKE 'draft-%' AND substring("pr_no" from 7) ~ '^[0-9]+$';
  ```
  Same for `"tb_store_requisition"."sr_no"` and `"tb_good_received_note"."grn_no"`. No `deleted_at` filter (soft-deleted rows included). Verify table/column names against `schema.prisma` first.
- [ ] **Step 2:** Add a comment block listing the preflight query to run per schema before deploy and expecting 0:
  `SELECT count(*) FROM <table> WHERE <col> LIKE 'draft-%' AND substring(<col> from 7) !~ '^[0-9]+$';`
- [ ] **Step 3:** Apply on a local/throwaway schema only (`bun run db:deploy` with a local `DATABASE_URL`). **Do not run against the shared dev DB without the user's go-ahead.** Expected: migration applies; a seeded `draft-7` becomes `DRAFT-00000007`; re-applying the UPDATE changes 0 rows.
- [ ] **Step 4:** Commit `feat(db): migration แปลงเลข draft- เดิมเป็น DRAFT- 8 หลัก (PR/SR/GRN)`.

### Task 4: PO — draft placeholder on create, real number on submit

**Files:**
- Modify: `apps/micro-business/src/procurement/purchase-order/purchase-order.service.ts` — `create` (L2079, number at L2164), `submit` (L3312; comment L3343; status write inside the `runAtomic` that follows)
- Modify (existing spec): `apps/micro-business/src/procurement/purchase-order/purchase-order.service.spec.ts` (create/submit cases)

**Interfaces:**
- Consumes: Task 1 `nextDraftNo`, `isDraftNo`; existing `private reservePONos(orderDate: string, tx, count = 1): Promise<string[]>`.
- Produces: `const PO_RUNNING_NO_KEY = 'po_running_no'` (module constant beside the service, like PR's).

- [ ] **Step 1:** `create`: replace `reservePONos` with `await nextDraftNo(prismatx, PO_RUNNING_NO_KEY, this.userId)`. `confirmPrToPo` (L4764) is **not** changed.
- [ ] **Step 2:** `submit`: inside the existing `runAtomic`, before the header update, `const poNo = isDraftNo(purchaseOrder.po_no) ? (await this.reservePONos((purchaseOrder.order_date ?? new Date()).toISOString(), tx))[0] : purchaseOrder.po_no;` and write `po_no: poNo` in the same header update. Use `poNo` wherever `newPoNo` was used afterwards (response, notifications). Rewrite the L3343 comment: drafts hold a placeholder; the real number is reserved once, at the first submit; a sent-back PO keeps it.
- [ ] **Step 3:** Update existing spec cases: create now expects `DRAFT-00000001`-shaped `po_no` and does not call `reservePONos`; add assertions to the existing submit test(s) for (a) draft placeholder → `reservePONos` called once and the real number written, (b) PO already holding a real number (send-back resubmit) → `reservePONos` not called, number unchanged (Review Focus 2/3). Extend existing `it` blocks / `describe` in the same file; no new spec file.
- [ ] **Step 4:** Run `bunx tsc --noEmit && bunx jest src/procurement/purchase-order` → pass.
- [ ] **Step 5:** Commit `feat(po): PO ที่สร้างเองถือเลข DRAFT- จนกว่าจะ submit จึงออกเลขจริง`.

### Task 5: Full backend check + PR

- [ ] **Step 1:** From the backend root: `bun run check-types` and `cd apps/micro-business && bunx jest` → no new failures versus `main` (known-failing gateway suites are pre-existing; compare counts, don't fix them here).
- [ ] **Step 2:** Push branch, open PR (English body) with: summary, deploy order (migration on every env → micro-business), preflight query, mobile grep result, note that PO numbering moved to submit.

### Task 6: e2e repo

**Files (carmen-frontend-e2e):** `tests/302-pr-creator-journey.spec.ts:403`, `tests/701-sr.spec.ts:114`, `tests/501-grn.spec.ts:137,140,253,295,315,317`, `tests/720-stock-issue.spec.ts:16` (comment), `tests/312-pr-lifecycle.spec.ts:253`, `tests/404-po-lifecycle.spec.ts:289`, `tests/502-grn-lifecycle.spec.ts:339`, `tests/702-sr-lifecycle.spec.ts:266`; plus any data-reset fixture seeding `draft-N` (`grep -rn "draft-" src fixtures scripts tests`).

- [ ] **Step 1:** `/draft-\d+/i` → `/DRAFT-\d{8}/`; `"draft-4"` → `"DRAFT-00000004"`; `/^draft/` → `/^draft/i`; fixtures to the new format.
- [ ] **Step 2:** If a PO e2e asserts the number right after manual create is a real `PO…` number, change it to expect `DRAFT-\d{8}` before submit and a real number after.
- [ ] **Step 3:** `bunx tsc --noEmit` (or the repo's lint/typecheck script) → pass. Live run only after the backend + migration are on dev (user decides when).
- [ ] **Step 4:** Commit `test(e2e): เลข draft รูปแบบใหม่ DRAFT- 8 หลัก`, push, PR noting it must merge after the backend deploy.

## Manual verification (after deploy to dev, user-driven)

curl or browser: create a PR / SR / GRN / PO draft → number `DRAFT-%08d`, list sorts drafts in creation order; submit the PO → real `PO…` number; send it back and resubmit → same number; run period-end validation on a period containing a draft → draft not counted as numbered.
