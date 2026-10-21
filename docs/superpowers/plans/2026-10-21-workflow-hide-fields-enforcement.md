# Workflow Hide Fields Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the workflow stage "Hide Fields" checkboxes real for PR and PO: the backend nulls price data for users who belong to the document's current stage, ignores price input from them, and the FE shows a "Hidden" badge in place of the number.

**Architecture:** One resolver in micro-business (`WorkflowOrchestratorService.resolveHiddenPriceFields`) decides `hidden_fields` per (document, user). Per-doc-type mask helpers null the price keys at the RPC boundary (never inside `findById`, which internal logic and routing reuse). PR approve/save strips price/source keys from hidden users and recomputes line amounts server-side with the existing `getCalculatePriceInfo`. FE reads `hidden_fields` (never infers from `null`) and renders one shared `<HiddenValue />`.

**Tech Stack:** NestJS microservices + Prisma + Zod (`carmen-turborepo-backend-v2`: `apps/micro-business`, `apps/backend-gateway`); React 19 + React Router + RHF + Zod + next-intl (`carmen-inventory-frontend-react`).

**Spec:** `docs/superpowers/specs/2026-10-21-workflow-hide-fields-enforcement-design.md` (FE repo) — read it first; this plan does not repeat its rationale.

## Global Constraints

- Test steps are skipped on purpose (user preference): implement → `typecheck` → `lint` → commit. Existing test suites that break must be fixed, not deleted. Manual curl/browser verification is in Task 12.
- Branch `feature/workflow-hide-fields` in **both** repos, off `main`. Commit messages in Thai, conventional prefix (`feat(workflow): …`). No squash merge.
- `HiddenPriceField = 'price_per_unit' | 'total_price'` — exact strings, same in BE and FE.
- Response contract: hidden price keys are present with value `null`; document/row carries `hidden_fields: HiddenPriceField[]` (`[]` = nothing hidden). FE decides from `hidden_fields` only.
- Never hidden: draft docs, docs with no workflow/stage, stage role `create` or `purchase`, users not in `user_action.execute`. No admin bypass.
- Config source: the workflow's **current** `data.stages[]` entry whose `name === workflow_current_stage`.
- Field groups (spec table): `price_per_unit` → per-unit price, pricelist, last price; `total_price` → sub_total, tax_amount, discount_amount, net, total, header totals, `base_*`. Never hide `tax_rate`, `discount_rate`, `exchange_rate`, currency, quantities.
- Print shows `***`; export shows an empty cell; PO send-email by a hidden user → 422.
- BE backend-v2 error handling: logic handlers return `Result` errors, never throw `AppError` (a throw becomes 503).
- Deploy order: BE before FE.

## Review Focus

1. **PR approve by a hidden HOD who changed `approved_qty`** — DB line amounts and header `total_amount` must equal what `getCalculatePriceInfo` gives for stored price × new qty, and routing must see the new total (Task 4 step "verify routing order").
2. **Hidden user on a page mixing rows from different stages** (PR list, PO list, unified my-pending) — only rows whose current stage hides for that user are masked (Tasks 3, 5, 6).
3. **A real `null` price (not yet priced) for a non-hidden user** — FE must show the normal empty/0 rendering, not the Hidden badge (Tasks 8–10 key off `hidden_fields`).
4. **FE recompute effects on a hidden PR line** — `pr-item-expand.tsx:104-138` and `PoItemComputedSync` must not write `0` back into the form when price is `null`, or the next save sends zeros (Tasks 9, 10).
5. **Activity log for a `purchase_request_detail` entity** — masking keys off the parent PR's stage, batched per page (Task 7).

---

## Backend (`carmen-turborepo-backend-v2`)

Paths below are relative to `apps/micro-business/src` unless they start with `apps/`.

### Task 1: Hidden-field resolver

**Files:**
- Modify: `common/workflow/workflow.types.ts` (add types near `StageActionFlags` :190)
- Modify: `common/workflow/workflow-orchestrator.service.ts` (`fetchStageDetail` :457 return type; new public method after `resolveStageActionFlags` :488)

**Interfaces:**
- Produces:
  - `export type HiddenPriceField = 'price_per_unit' | 'total_price'`
  - `export function hiddenFieldsForStage(stage: { role?: enum_stage_role; hide_fields?: { price_per_unit?: boolean; total_price?: boolean } } | null): HiddenPriceField[]` — `[]` for null stage or role `create`/`purchase`; otherwise each key whose value is `=== true`, in order `price_per_unit`, `total_price`.
  - `WorkflowOrchestratorService.resolveHiddenPriceFields(isDraft: boolean, workflowId: string | null, currentStage: string | null, userAction: any, userId: string, buCode: string, cache?: Map<string, HiddenPriceField[]>): Promise<HiddenPriceField[]>` — `[]` when draft, no workflow/stage, or `userId` not in `userAction.execute` (same id extraction as `resolveUserRole` :414-418); else `hiddenFieldsForStage(await fetchStageDetail(...))`, memoized by `${workflowId}|${currentStage}` (cache the stage result, not the per-user result). RPC failure → `[]`.

- [ ] **Step 1:** Add the type + pure function to `workflow.types.ts`; widen `fetchStageDetail`'s return type with `hide_fields?: { price_per_unit?: boolean; total_price?: boolean }` (the RPC `Workflows.getWorkflowStageDetail` already returns the full `Stage`, `workflows.controller.ts:354-375`).
- [ ] **Step 2:** Add `resolveHiddenPriceFields` to the orchestrator with bilingual JSDoc in the file's existing style. Extract the `user_action.execute` id list into a private helper shared with `resolveUserRole`.
- [ ] **Step 3:** `cd apps/micro-business && bunx tsc --noEmit -p .` → no errors; `bunx eslint src/common/workflow --quiet` → clean.
- [ ] **Step 4:** Commit `feat(workflow): resolver หา hidden_fields ของผู้ใช้ ณ stage ปัจจุบัน`.

### Task 2: PR mask helpers + response schemas

**Files:**
- Create: `procurement/purchase-request/pr-price-mask.ts`
- Modify: `procurement/purchase-request/dto/purchase-request.serializer.ts` (detail schema :7-90, list :184)
- Modify: `apps/backend-gateway/src/common/dto/purchase-request/purchase-request.serializer.ts` (detail + list item schemas; `stage_actions` is at :164 — add `hidden_fields` beside it)

**Interfaces:**
- Consumes: `HiddenPriceField` (Task 1)
- Produces (all pure, return new objects):
  - `PR_LINE_PRICE_KEYS: Record<HiddenPriceField, readonly string[]>` — `price_per_unit`: `pricelist_price`, `last_price`, `pricelist_no`, `base_price` (if present); `total_price`: `sub_total_price`, `net_amount`, `total_price`, `tax_amount`, `discount_amount`, every `base_*` amount column on the line.
  - `PR_HEADER_PRICE_KEYS: readonly string[]` — `base_net_amount`, `base_total_amount` (+ any header amount the detail serializer exposes) — masked under `total_price`.
  - `PR_SOURCE_KEYS: readonly string[]` — `vendor_id`, `pricelist_detail_id`, `pricelist_no`, `pricelist_type`, `currency_id`, `tax_profile_id`, `tax_rate`, `discount_rate`, `is_tax_adjustment`, `is_discount_adjustment` (used by Task 4).
  - `maskPrDetail<T extends { hidden_fields?: HiddenPriceField[]; purchase_request_detail?: any[] }>(doc: T): T` — nulls keys per `doc.hidden_fields` on header and every line; no-op when empty.
  - `maskPrListRow<T>(row: T, hidden: HiddenPriceField[]): T & { hidden_fields: HiddenPriceField[] }`.
  - `maskPrLine<T>(line: T, hidden: HiddenPriceField[]): T` — used by history/calculate endpoints.

- [ ] **Step 1:** Write `pr-price-mask.ts`. Before finalizing the key lists, read both serializers and include every money key they expose (spec: "ถ้าเจอฟิลด์ราคาอื่น … จัดเข้ากลุ่มตามความหมาย แล้วจดไว้ใน PR").
- [ ] **Step 2:** In both serializers: add `hidden_fields: z.array(z.enum(['price_per_unit','total_price'])).default([])` to the detail schema and the list-item schema; make every key in the lists above `.nullable()` (keep existing coercion for non-null values).
- [ ] **Step 3:** Typecheck micro-business and backend-gateway (`bunx tsc --noEmit -p .` in each) + eslint on changed files.
- [ ] **Step 4:** Commit `feat(pr): helper ซ่อนราคาใบขอซื้อ + เพิ่ม hidden_fields ใน schema`.

### Task 3: PR read paths

**Files:**
- Modify: `procurement/purchase-request/purchase-request.service.ts` — `findById` :106 (role/stage_actions block :241-266), `findAll` :281 (row loop :406-440), `findAllMyPending`, `findHistoryByDetailId` :3115, `findCalculatePriceInfoByDetailId` :3170
- Modify: `procurement/purchase-request/purchase-request.controller.ts` — `findOne` :39 (and any other handler returning `findById` to the client)

**Interfaces:**
- Consumes: `resolveHiddenPriceFields` (Task 1), `maskPrDetail`/`maskPrListRow`/`maskPrLine` (Task 2)
- Produces: `findById` result now carries **unmasked** prices plus `hidden_fields` — Task 4 reads `purchaseRequestData.hidden_fields` from it.

- [ ] **Step 1:** `findById`: compute `hidden_fields` with `resolveHiddenPriceFields(res.pr_status === draft, res.workflow_id, res.workflow_current_stage, res.user_action, this.userId, this.bu_code)` and add it to the object before `PurchaseRequestDetailResponseSchema.parse`. Do **not** mask here.
- [ ] **Step 2:** Controller `findOne` handler: apply `maskPrDetail` to the successful result value before returning. Check the gateway my-pending PR detail route (`apps/backend-gateway/src/application/my-pending/…purchase-request…` ~:192) calls the same MB pattern; if it calls a different one, mask there too.
- [ ] **Step 3:** `findAll` and `findAllMyPending`: in the per-row loop, call the resolver with one shared `Map` cache per request and `maskPrListRow`. `findAllMyPending` currently may not resolve role per row — add the resolver call the same way.
- [ ] **Step 4:** `findHistoryByDetailId` / `findCalculatePriceInfoByDetailId`: load the parent PR (`workflow_id`, `workflow_current_stage`, `user_action`, `pr_status`) by the detail's `purchase_request_id`, resolve, then `maskPrLine` the returned entries / null every amount in the calculate result when the matching group is hidden.
- [ ] **Step 5:** `for-po` (gateway `:122`) lists PRs ready for PO (post-approval, no active stage) → confirm by reading its query; if it can return in-stage PRs, mask rows like Step 3, else leave a one-line comment why it is safe.
- [ ] **Step 6:** Typecheck + eslint; run existing PR specs `bunx jest src/procurement/purchase-request` and fix any that assert the old response shape.
- [ ] **Step 7:** Commit `feat(pr): ซ่อนราคาใน detail/list/my-pending/history ตาม hide_fields`.

### Task 4: PR write guard (approve / save / reject / review)

**Files:**
- Create: `procurement/purchase-request/pr-hidden-price-guard.ts`
- Modify: `procurement/purchase-request/logic/purchase-request.logic.ts` — approve (findById :619, `mergeDetailsForNavigation` :626-632), save approve/purchase branch (:276-290), reject and review handlers

**Interfaces:**
- Consumes: `PR_LINE_PRICE_KEYS`, `PR_SOURCE_KEYS` (Task 2); `findById(...).value.hidden_fields` (Task 3); `getCalculatePriceInfo` from `common/pricing/calculate-price-info.logic.ts:15`
- Produces: `applyHiddenPriceGuard<T extends { id: string }>(details: T[], storedById: Map<string, StoredPrLine>, hidden: HiddenPriceField[]): T[]` — returns input unchanged when `hidden` is empty; otherwise for each line: delete **all** keys in both `PR_LINE_PRICE_KEYS` groups and `PR_SOURCE_KEYS`; if `approved_qty` (or `approved_unit_id`/`foc_qty`) is present, set the amount keys from `getCalculatePriceInfo(qtyUsed, stored.pricelist_price, stored.exchange_rate, stored.tax_rate, stored.is_tax_adjustment, stored.tax_amount, stored.discount_rate, stored.is_discount_adjustment, stored.discount_amount)` mapped onto the line's columns (`sub_total_price`, `discount_amount`, `net_amount`, `tax_amount`, `total_price` and their `base_*`). `StoredPrLine` = the Prisma row shape of `tb_purchase_request_detail` (pick the columns used).
  - `qtyUsed` must follow the FE rule `resolveApprovedQty` (`carmen-inventory-frontend-react/routes/procurement/purchase-request/pr-form-schema.ts:539`) — read it and port the same rule, including unit conversion if it applies, so BE and FE agree.

- [ ] **Step 1:** Write the guard. Lines with a missing stored row are left untouched except the key deletion.
- [ ] **Step 2:** Approve: right after `findById` (:619), if `purchaseRequestData.hidden_fields.length`, load stored lines for the payload ids and run the guard on `updatePRDetail` **before** `mergeDetailsForNavigation` (:629) — this is the "verify routing order" point: navigation must see recomputed amounts. Header totals already recompute via `recalculatePurchaseRequestTotals` (`purchase-request.service.ts:2018`).
- [ ] **Step 3:** Save (approve/purchase branch :276-290): call `findById(id)` once to get `hidden_fields`, run the guard on `updatePRDetail` before `purchaseRequestService.update`. Confirm `update` recalculates header totals (it does at :1120/:1358 — verify the path used).
- [ ] **Step 4:** Reject / review: read their payload types; if they can carry price or source keys, run the guard (no recompute needed); if not, note it in the commit body.
- [ ] **Step 5:** Check the line-amount validator (`purchase-request.logic.spec.ts:398` "passes a line whose amounts match what its own inputs recalculate to") — find the validator it tests and make sure guarded lines pass it (amounts come from the same formula).
- [ ] **Step 6:** Typecheck + eslint + `bunx jest src/procurement/purchase-request`.
- [ ] **Step 7:** Commit `feat(pr): ทิ้งราคาจากผู้ใช้ที่ถูกซ่อน และคำนวณยอดใหม่ฝั่ง BE`.

### Task 5: PO mask, reads and write guard

**Files:**
- Create: `procurement/purchase-order/po-price-mask.ts`
- Modify: `procurement/purchase-order/dto/purchase-order.serializer.ts` (line :53-68, header :138-141, list :188-194, nested `pr_details` :6)
- Modify: `apps/backend-gateway/src/common/dto/purchase-order/purchase-order.serializer.ts` (`stage_actions` :196 — add `hidden_fields` beside it)
- Modify: `procurement/purchase-order/purchase-order.service.ts` — findById :344 (role block :569-592), `findAll` :1706, my-pending find-all, `findHistoryByDetailId` :5651, detail find-one / find-all
- Modify: `procurement/purchase-order/purchase-order.controller.ts` — `findOne` :39, `purchaseOrderDetailFindOne` :426, `purchaseOrderDetailFindAll` :442, `findHistoryByDetailId` :463, my-pending :494
- Modify: `procurement/purchase-order/purchase-order.logic.ts` — save/approve paths

**Interfaces:**
- Consumes: Task 1 resolver
- Produces: `PO_LINE_PRICE_KEYS`, `PO_HEADER_PRICE_KEYS`, `PO_SOURCE_KEYS`, `maskPoDetail`, `maskPoListRow`, `maskPoLine` — same shapes as Task 2 but for PO keys (spec table). `price_per_unit`: `price`, `unit_price`, `base_price`; `total_price`: line `sub_total_price`, `net_amount`, `total_price`, `tax_amount`, `discount_amount`, `base_*`; header `sub_total`, `discount_amount`, `tax_amount`, `total_amount`; list `total_price`, `total_tax`, `net_amount`, `total_amount`, `base_*`. Nested `pr_details` money keys follow the PR groups.

- [ ] **Step 1:** Mask helpers + both serializers (same approach as Task 2).
- [ ] **Step 2:** findById attaches unmasked `hidden_fields` (draft flag = PO draft status); controller handlers mask.
- [ ] **Step 3:** `findAll` has no per-row role today — add a per-row resolver loop with a shared cache, then `maskPoListRow`. Same for PO my-pending.
- [ ] **Step 4:** Detail endpoints + history: resolve from the parent PO and `maskPoLine`.
- [ ] **Step 5:** Save / approve logic: when the caller is hidden, delete `PO_LINE_PRICE_KEYS` + `PO_SOURCE_KEYS` from incoming lines (no recompute — PO approvers cannot change qty; `purchase-order.logic.ts:344-358`).
- [ ] **Step 6:** GRN endpoints (`purchase-orders.controller.ts:142-321` gateway): read what they return; GRN is built from approved POs (no active stage) — if confirmed, leave a comment; else mask.
- [ ] **Step 7:** Typecheck (micro-business + gateway) + eslint + `bunx jest src/procurement/purchase-order`.
- [ ] **Step 8:** Commit `feat(po): ซ่อนราคาใบสั่งซื้อตาม hide_fields`.

### Task 6: Print, export, send-email, unified my-pending

**Files:**
- Modify: `procurement/purchase-request/purchase-request.service.ts` — `printToReport` :3270 (payload :3333-3341), `printToPdf`, `exportToExcel`
- Modify: `procurement/purchase-order/purchase-order.service.ts` — `printToReport` :6869 (payload :6727-6843), print, export, `sendEmailToVendor`
- Modify: `my-pending/my-pending.service.ts` — `findAllUnified` :109; `my-pending/my-pending.serializer.ts` :34-35

**Interfaces:**
- Consumes: Tasks 1, 2, 5. `this.userId` is available via the request context in all of these (`common/tenant-scoped.service.ts:64`).

- [ ] **Step 1:** Print (PR + PO, both report-viewer and PDF paths): resolve `hidden_fields` for the doc; replace each hidden money value in the report payload with the string `'***'` (if the template field is numeric-typed, check `micro-report` handles a string; if not, send `null` and note it). Map payload keys (`NetAmount`, `SubTotal`, `TaxAmount`, `GrandTotal`, `UnitPrice`, …) to the two groups by meaning.
- [ ] **Step 2:** Export (PR + PO single-doc Excel): hidden cells empty.
- [ ] **Step 3:** `sendEmailToVendor`: if the caller's `hidden_fields` is non-empty, return a `Result` error (422). Add a catalog entry `PO_SEND_EMAIL_PRICE_HIDDEN` following how `WORKFLOW_STAGE_ACTION_DISABLED` is declared, plus its FE i18n message in Task 11.
- [ ] **Step 4:** `findAllUnified`: rows come from `sys_v_my_pending`; read `my-pending.sql.ts` to confirm each row has doc type, `workflow_id`, current stage and `user_action` (or can be joined). For PR/PO rows, resolve with a shared cache and null `net_amount`/`total_amount` when `total_price` is hidden; add `hidden_fields` to the serializer. SR rows → `[]`.
- [ ] **Step 5:** Typecheck + eslint + jest for touched folders.
- [ ] **Step 6:** Commit `feat(workflow): ซ่อนราคาใน print/export/my-pending และบล็อกส่งอีเมล PO`.

### Task 7: Activity log

**Files:**
- Modify: `log/activity-log/activity-log.service.ts` — `findAll` :73, `findByEntity` :160, `findByEntityId` :249, `findOneDetail` :309, `findOne` :335 (full `old_data`/`new_data` + `changes` at :324)
- Create: `log/activity-log/activity-price-mask.ts`

**Interfaces:**
- Consumes: Task 1 resolver; key lists from Tasks 2 and 5.
- Produces: `maskActivityRows(rows: ActivityRow[], userId: string, buCode: string): Promise<ActivityRow[]>` — for rows with `entity_type` in PR/PR-detail/PO/PO-detail (use the exact entity_type strings found in the table), batch-load parent docs (detail rows → parent via `purchase_request_id` / `purchase_order_id` in the row data), resolve once per parent, then remove hidden keys from `old_data`, `new_data` and drop `changes[]` entries whose `field` is a hidden key.

- [ ] **Step 1:** Write `maskActivityRows`; one query per doc type per page (no N+1).
- [ ] **Step 2:** Apply it in every read method above before returning.
- [ ] **Step 3:** Typecheck + eslint + `bunx jest src/log/activity-log`.
- [ ] **Step 4:** Commit `feat(activity-log): ซ่อนฟิลด์ราคาใน log ของ PR/PO ตาม hide_fields`.

---

## Frontend (`carmen-inventory-frontend-react`)

Run after each FE task: `bun run typecheck` and `bunx eslint <changed files> --quiet`.

### Task 8: Shared types, badge, i18n

**Files:**
- Modify: `types/workflows.ts` (near `HideFields` :82)
- Modify: `types/purchase-request.ts` (`PurchaseRequest` :146, zod `purchaseRequestSchema` :175-180)
- Modify: `types/purchase-order.ts` (`PurchaseOrder` :189)
- Modify: `types/approval.ts` (`ApprovalItem` :5, `RawApprovalUnified` :45)
- Modify: `routes/procurement/my-approval/use-approval.ts` (`normalizeApproval` :25-41)
- Create: `components/share/hidden-value.tsx`
- Modify: `messages/en.json`, `messages/th.json` (`common` namespace, en.json:534)

**Interfaces:**
- Produces:
  - `export type HiddenPriceField = "price_per_unit" | "total_price"` and `export function isPriceHidden(hidden: readonly HiddenPriceField[] | undefined, field: HiddenPriceField): boolean` in `types/workflows.ts`.
  - `hidden_fields?: HiddenPriceField[]` on `PurchaseRequest`, `PurchaseOrder`, `ApprovalItem`, `RawApprovalUnified`.
  - `<HiddenValue className?: string />` — small muted badge with a lock icon (lucide `LockKeyhole`), text `t("common.hiddenValue")`, tooltip `t("common.hiddenValueHint")`. Use existing `Badge`/`Tooltip` primitives and tokens; must read in light and dark.
  - i18n: `common.hiddenValue` = "Hidden" / "ซ่อน"; `common.hiddenValueHint` = "Hidden by the workflow at this stage" / "ซ่อนตามการตั้งค่า workflow ของขั้นตอนนี้" (no `{}` or `<…>` in messages).

- [ ] **Step 1:** Types + helper. In the PR zod schema make `price`/`total_price` (and other money keys there) `.nullable()`.
- [ ] **Step 2:** `normalizeApproval`: keep `total_amount` as `null` when `hidden_fields` includes `total_price` (stop the `?? 0` at :41 for that case) and pass `hidden_fields` through; widen `ApprovalItem.total_amount` to `number | null`.
- [ ] **Step 3:** `HiddenValue` component + messages.
- [ ] **Step 4:** typecheck + lint; commit `feat(workflow): type hidden_fields + badge ซ่อนราคา`.

### Task 9: PR detail form

**Files (all under `routes/procurement/purchase-request/`):**
- Modify: `use-pr-item-table.tsx` (:209-214 compare, :221 expand disabled, :359-388 amount column)
- Modify: `pr-item-expand.tsx` (fields :193-468, recompute effect :104-138)
- Modify: `pr-item-cells/amount-cell.tsx`, `pr-item-summary.tsx` (:27-47), `pr-last-receiving-info.tsx`, `pr-pricelist-compare.tsx`, `pr-item-fields.tsx` (~:509 AI menu price)
- Modify: `workflow/pr-footer-action.tsx` (:90, :144-171)
- Modify: `pr-form-schema.ts` (`prepareApproveDetails` :559-596)
- Modify: `use-pr-form-actions.ts` (`buildSaveDetails` :236-252)

**Interfaces:**
- Consumes: `isPriceHidden`, `HiddenValue`, `purchaseRequest.hidden_fields` (Task 8)
- Produces: `prepareApproveDetails(items, purchaseRequestId?, hidden?: readonly HiddenPriceField[])` — when `hidden` is non-empty, omit every price and source key (`vendor_id`, `pricelist_*`, `currency_id`, `tax_*`, `discount_*`, `is_*_adjustment`, `net_amount`, `total_price`); keep id, stage fields, `approved_qty`, `approved_unit_id`, `foc_*`, `delivery_*`, `location_id`, `comment`.

- [ ] **Step 1:** Thread `hidden_fields` from the loaded PR into the item table / expand / footer (prop or existing context — follow how `role` is threaded).
- [ ] **Step 2:** Render `<HiddenValue />` instead of the number: unit price + pricelist no + last price/last receiving under `price_per_unit`; subtotal, discount amount, net, tax amount, total, base summary, amount column, footer totals under `total_price`. Rates stay visible.
- [ ] **Step 3:** When anything is hidden: vendor, pricelist, tax profile, discount/tax inputs and override checkboxes render as plain text (not inputs); hide the pricelist-compare button and the AI menu price.
- [ ] **Step 4:** Recompute effect in `pr-item-expand.tsx:104-138`: skip entirely when anything is hidden.
- [ ] **Step 5:** Pass `purchaseRequest.hidden_fields` into `prepareApproveDetails` from `buildSaveDetails` (approve branch) and `handleApprove` (:558).
- [ ] **Step 6:** typecheck + lint + `bun test:run routes/procurement/purchase-request` (fix existing tests broken by the new parameter); commit `feat(pr): แสดง badge ซ่อนราคาและไม่ส่งราคาเมื่อ stage ซ่อน`.

### Task 10: PO detail form

**Files (under `routes/procurement/purchase-order/`):**
- Modify: `use-po-item-table.tsx` (:265-339), `po-item-cells/price-cell.tsx`, `po-item-cells/row-pricing-cells.tsx`, `po-item-cells/pricing-cell.tsx` (`PoItemComputedSync` :39-68), `po-footer-action.tsx` (:82-99, :172-199), `po-form.tsx` (thread `hidden_fields`)
- Modify: send-email UI handler — show the catalog error message from Task 6 (no special UI beyond the existing error toast path)

**Interfaces:**
- Consumes: Task 8.

- [ ] **Step 1:** Thread `hidden_fields`; render `<HiddenValue />` in price, subtotal, discount amount, net, tax amount, total cells and footer totals per group.
- [ ] **Step 2:** `PoItemComputedSync`: do nothing when anything is hidden.
- [ ] **Step 3:** typecheck + lint + `bun test:run routes/procurement/purchase-order`; commit `feat(po): แสดง badge ซ่อนราคาใน PO`.

### Task 11: Lists, my-approval, workflow config

**Files:**
- Modify: `routes/procurement/purchase-request/use-pr-table.tsx` (:225-246), `pr-card.tsx` (:40, :117), `pr-export-columns.ts` (:40)
- Modify: `routes/procurement/purchase-order/use-po-table.tsx` (:227-241), `po-card.tsx` (:46-84), `po-component.tsx` (:303 export)
- Modify: `routes/procurement/my-approval/approve-queue-list.tsx` (:183-208)
- Modify: `routes/system-admin/workflow/wf-stage-general.tsx` (view :110-113/:166-167, edit :399-418), `wf-insights-utils.ts` (:139-142)
- Modify: `messages/*.json` — error catalog message for `PO_SEND_EMAIL_PRICE_HIDDEN` (wherever existing catalog codes like `WORKFLOW_STAGE_ACTION_DISABLED` live)

- [ ] **Step 1:** Each list amount cell/card: per row, `isPriceHidden(row.hidden_fields, "total_price")` → `<HiddenValue />`. Excel export: empty cell for hidden rows.
- [ ] **Step 2:** my-approval queue: same per row.
- [ ] **Step 3:** `wf-stage-general.tsx`: render neither the view summary nor the edit checkboxes when `workflowType === "store_requisition"` or stage `role` is `create` or `purchase` (values already available at :63-64). `wf-insights-utils.ts`: exclude stages with role `create`/`purchase` from the counts.
- [ ] **Step 4:** Add the catalog error message (en + th).
- [ ] **Step 5:** typecheck + lint + `bun test:run routes/system-admin/workflow routes/procurement`; commit `feat(workflow): badge ซ่อนราคาใน list/my-approval และซ่อน checkbox ที่ไม่มีผล`.

### Task 12: Manual verification (both repos running locally)

Gateway `:4000` points at the shared dev DB — use a test workflow/document, not real tenant data, and restore any config you change.

- [ ] **Step 1:** In `/system-admin/workflow/<PR workflow>`: tick both Hide Fields on an approve stage (e.g. HOD). Confirm the block is gone on SR workflows and on create/purchase stages.
- [ ] **Step 2:** Submit a PR into that stage. As a user in that stage: curl `GET /api/<bu>/purchase-request/<id>` → price keys `null`, `hidden_fields` = `["price_per_unit","total_price"]`; as purchasing (not in stage) → numbers, `hidden_fields: []`.
- [ ] **Step 3:** As the stage user in the browser: detail shows Hidden badges, vendor/pricelist/tax read-only; list, my-approval, print (`***`), export (empty cells), activity sheet all hide prices.
- [ ] **Step 4:** Change `approved_qty` on one line and approve. Check DB/curl as purchasing: line amounts = stored price × new qty with the same tax/discount rates; header `base_total_amount` updated; next stage matches a routing rule keyed on total, if the test workflow has one.
- [ ] **Step 5:** Repeat Step 2–3 for a PO; try send-email as the hidden user → 422 with the translated message.
- [ ] **Step 6:** Before prod: query tenants for workflows with any `hide_fields` true on an approve stage and tell the user which tenants will change behavior on deploy.
