# Category Cascade Confirm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editing a Category / Sub-category / Item Group asks before overwriting its descendants'
deviation limits and inventory/direct account codes, and only cascades what the user changed.

**Architecture:** Backend gets one new update field, `cascade_account_codes`, plus a shared helper
that copies (or clears) account-code rows onto descendants. Both cascades move inside the node's
`$transaction`. The frontend works out which of the four values changed, shows a three-button
dialog, and turns the choice into `cascade_deviation` / `cascade_account_codes`.

**Tech Stack:** NestJS + Prisma + zod (backend-v2: `backend-gateway`, `micro-business`) · React 19
+ react-hook-form + use-intl + shadcn AlertDialog (frontend).

**Spec:** `docs/superpowers/specs/2026-10-20-category-cascade-confirm-design.md`

## Global Constraints

- Repos and branches: `carmen-turborepo-backend-v2` and `carmen-inventory-frontend-react`, both on
  `feature/category-cascade-confirm` (FE branch exists; cut BE from `origin/main`).
- **No new test files and no TDD steps** (user preference). Run type-check + lint after every
  task. **Existing** suites touched by the change must stay green; fix them if the change breaks them.
- Backend tests use `jest` (never `bun test`). FE: `bun run typecheck`, `bunx eslint <files>`,
  `bun test:run <path>`.
- Commit messages in Thai, conventional prefix (`feat(category): …`). PRs in English.
- Keep `cascade_deviation` and its `default(true)` on every backend DTO — other clients rely on it.
- New field name exactly `cascade_account_codes`, type `("inventory" | "direct")[]`, optional;
  absent/empty = no account cascade.
- Cascades touch only `deleted_at: null` rows; no `doc_version` bump on children; no activity log.
- Account cascade = **copy** rows (option B); a cleared source = soft-delete descendants' rows of
  that type.
- i18n messages must not contain `{{…}}` or `<word>` (ICU breaks the page); plain `{name}` is fine.
- UI must read in light and dark mode; reuse `components/ui/` primitives, no raw colors/sizes.
- Deploy order: backend before frontend.

## Review Focus

1. **Only one deviation changed** → children's other deviation must stay untouched. FE omits the
   unchanged key (Task 4 `applyCascadeDecision`); verify in Task 7 step 3.
2. **Account cleared on a Category** → every descendant row of that type soft-deleted; subtree
   resolves to "none". Verify in Task 7 step 4.
3. **Descendant already has duplicate live rows of the same type** → all of them updated, none
   created (Task 2 algorithm).
4. **"Save this item only"** → payload carries `cascade_deviation: false` and no
   `cascade_account_codes`; children unchanged. Verify in Task 7 step 5.
5. **Rename only (no cascade value changed)** → no dialog, `cascade_deviation: false`. Today
   Sub-category/Item Group cascade on every save; this must stop. Verify in Task 7 step 2.

---

## Backend (`carmen-turborepo-backend-v2`)

### Task 1: `cascade_account_codes` on the update contract

**Files:**
- Modify: `apps/backend-gateway/src/common/dto/product-category/product-category.dto.ts:53`
- Modify: `apps/backend-gateway/src/common/dto/product-sub-category/product-sub-category.dto.ts:55`
- Modify: `apps/backend-gateway/src/common/dto/product-item-group/product-item-group.dto.ts:55`
- Modify: `apps/micro-business/src/master/product-category/dto/product-category.dto.ts:60`
- Modify: `apps/micro-business/src/master/product-sub-category/dto/product-sub-category.dto.ts:63`
- Modify: `apps/micro-business/src/master/product-item-group/dto/product-item-group.dto.ts:63`
- Modify: `apps/micro-business/src/master/{product-category,product-sub-category,product-item-group}/interface/*.interface.ts` (beside `cascade_deviation?: boolean`)

**Interfaces:**
- Produces: on each **update** schema, right after `cascade_deviation`:
  `cascade_account_codes: z.array(z.enum(['inventory', 'direct'])).optional()` (gateway: add a
  `.meta({ description: 'Account types to copy onto every descendant; source cleared → descendants cleared' })`
  like neighbouring fields). Interfaces: `cascade_account_codes?: ('inventory' | 'direct')[];`

- [ ] **Step 1:** `git fetch && git checkout -b feature/category-cascade-confirm origin/main`
- [ ] **Step 2:** Add the field to the 6 update schemas and 3 interfaces.
- [ ] **Step 3:** `cd apps/backend-gateway && bun run check-types` and `cd apps/micro-business && bun run check-types` → no errors.
- [ ] **Step 4:** Commit `feat(category): รับ cascade_account_codes ใน update ของ category/sub-category/item group`

### Task 2: `cascadeAccountCodes` helper

**Files:**
- Create: `apps/micro-business/src/common/account-code/account-code-cascade.helper.ts`

**Interfaces:**
- Consumes: `AccountCodeOwnerColumn` (`account-code.dto.ts:8`), `bucketRowsByDuplicateKey`
  (`common/helpers/soft-delete-bucket.helper.ts:12`).
- Produces:
  ```ts
  export async function cascadeAccountCodes(params: {
    tx: Prisma.TransactionClient;
    userId: string;
    source: { owner: AccountCodeOwnerColumn; ownerId: string };
    types: ('inventory' | 'direct')[];
    descendants: Partial<Record<AccountCodeOwnerColumn, string[]>>;
  }): Promise<void>
  ```

- [ ] **Step 1: Implement.** For each `type` in `types`:
  - `src` = `tx.tb_product_account_code_mapping.findFirst({ where: { [source.owner]: source.ownerId, account_type: type, deleted_at: null } })` — read **after** the node's own `applyAccountCodesWrite`.
  - For each `[col, ids]` in `descendants` with `ids.length`:
    - `src` exists → `updateMany({ where: { [col]: { in: ids }, account_type: type, deleted_at: null }, data: { account_code, account_name, updated_by_id, updated_at } })`;
      then `findMany` the same filter selecting `col`, and `createMany` one row
      (`[col]: id, account_type, account_code, account_name, created_by_id`) for each id with no live row.
    - `src` missing → `findMany` live rows `{ id, [col] }` of that type, soft-delete them using the
      same `bucketRowsByDuplicateKey` + per-bucket `deleted_at` offset as
      `applyAccountCodesWrite` (`account-code.helper.ts:73-94`) — key `[row[col], type]`.
  - Set operations only; no per-descendant loops except the per-bucket soft-delete.
  - JSDoc in the file's bilingual style (English / Thai), as in `account-code.helper.ts`.
- [ ] **Step 2:** `cd apps/micro-business && bun run check-types && bunx eslint src/common/account-code/account-code-cascade.helper.ts` → clean.
- [ ] **Step 3:** Commit `feat(category): helper คัดลอก/ล้างรหัสบัญชีลงชั้นล่าง`

### Task 3: Wire cascades into the three `update()` methods, inside the transaction

**Files:**
- Modify: `apps/micro-business/src/master/product-category/product-category.service.ts:344-412`
- Modify: `apps/micro-business/src/master/product-sub-category/product-sub-category.service.ts` (update(), cascade at `:447-477`)
- Modify: `apps/micro-business/src/master/product-item-group/product-item-group.service.ts:445-492`
- Modify (if they break): `product-category.service.spec.ts`, `product-sub-category.service.spec.ts` beside the services

**Interfaces:**
- Consumes: `cascadeAccountCodes` (Task 2); `cascade_account_codes` (Task 1).

- [ ] **Step 1:** In each `update()`: destructure `cascade_account_codes` out alongside
  `cascade_deviation` / `account_codes` so it never reaches `prisma.update`.
- [ ] **Step 2:** Move the existing deviation `updateMany` block **into** the `$transaction`
  callback, after `applyAccountCodesWrite`, switching `this.prismaService.` → `prisma.` (the tx
  client). Logic and filters unchanged.
- [ ] **Step 3:** When `cascade_account_codes?.length`, resolve descendant ids inside the tx and
  call `cascadeAccountCodes`:
  - Category: sub-category ids (`product_category_id = id`), item-group ids (`product_subcategory_id in subIds`), product ids (`product_item_group_id in igIds`) — all `deleted_at: null`.
    `source: { owner: 'product_category_id', ownerId: data.id }`.
  - Sub-category: item-group ids + product ids. Owner `'product_sub_category_id'`.
  - Item group: product ids. Owner `'product_item_group_id'`.
  - `descendants` keys: `product_sub_category_id`, `product_item_group_id`, `product_id`.
- [ ] **Step 4:** Pass `{ timeout: 30000, maxWait: 8000 }` as the second argument to these three
  `$transaction` calls (precedent: `preconfig-import.service.ts:63`).
- [ ] **Step 5:** `cd apps/micro-business && bun run check-types && bunx eslint <the 3 services>` → clean.
- [ ] **Step 6:** `cd apps/micro-business && bunx jest src/master/product-category src/master/product-sub-category src/master/product-item-group src/common/account-code` → all pass. If a spec mocked the cascade on `prismaService` outside the tx, move the mock onto the tx client; don't delete assertions.
- [ ] **Step 7:** Commit `feat(category): เขียนทับ deviation + รหัสบัญชีลงชั้นล่างใน transaction เดียวกัน`
- [ ] **Step 8:** Push, open PR (English) against `main`, body notes: Category edits now cascade from the UI (new behaviour), deploy BE before FE, `cascade_deviation` default kept.

---

## Frontend (`carmen-inventory-frontend-react`)

### Task 4: Change detection + payload builder; drop `cascade_deviation` as node state

**Files:**
- Create: `routes/product-management/category/cascade-changes.ts`
- Modify: `types/category.ts` (remove `cascade_deviation` from `CategoryNode`, `SubCategoryDto`, `ItemGroupDto`; keep any Create/Update DTO field only if a create path still needs it — it doesn't)
- Modify: `routes/product-management/category/use-category-tree.ts:58,87,110` (stop mapping it)
- Modify: `routes/product-management/category/category-form-schema.ts:28` (remove `cascade_deviation`)
- Modify: `routes/product-management/category/category-form.tsx:83` (remove default)
- Modify (fixtures only): `category-form.test.tsx:65`, `category-form-schema.test.ts:17`, `use-category-tree.test.ts:27,40`

**Interfaces:**
- Produces (all exported from `cascade-changes.ts`):
  ```ts
  export type CascadeAccountType = "inventory" | "direct";
  export interface ValueChange<T> { from: T; to: T }
  export interface CascadeChanges {
    price_deviation_limit?: ValueChange<number>;
    qty_deviation_limit?: ValueChange<number>;
    inventory?: ValueChange<string | null>;
    direct?: ValueChange<string | null>;
  }
  export type CascadeSource = Pick<CategoryFormValues,
    "price_deviation_limit" | "qty_deviation_limit" | "inventory_account_code" | "direct_account_code">;
  export function detectCascadeChanges(before: CascadeSource, after: CascadeSource): CascadeChanges;
  export function hasCascadeChanges(changes: CascadeChanges): boolean;
  export type CascadeChoice = "cascade" | "self";
  export interface CascadeDecision { choice: CascadeChoice; changes: CascadeChanges }
  export interface CascadePayload { cascade_deviation: boolean; cascade_account_codes?: CascadeAccountType[] }
  export function applyCascadeDecision<T extends Record<string, unknown>>(
    data: T, decision: CascadeDecision | undefined,
  ): Partial<T> & CascadePayload;
  export function countDescendants(node: CategoryNode): { subCategories: number; itemGroups: number };
  ```
- Rules:
  - `detectCascadeChanges`: deviations compared as `Number(x)`; accounts normalised `x || null`.
  - `applyCascadeDecision`: no decision or `"self"` → `cascade_deviation: false`, no
    `cascade_account_codes`, data unchanged. `"cascade"` → `cascade_deviation` = any deviation
    changed; if so, **delete the unchanged deviation key** from the result; `cascade_account_codes`
    = changed account types, key omitted when empty.
  - `countDescendants`: Category → `children.length` sub-categories + sum of their
    `children.length`; Sub-category → `{ subCategories: 0, itemGroups: children.length }`;
    Item Group → zeros.

- [ ] **Step 1:** Create `cascade-changes.ts` with the above (JSDoc in Thai, file's neighbours' style).
- [ ] **Step 2:** Remove `cascade_deviation` from types, tree mapping, schema, form defaults, and the three test fixtures.
- [ ] **Step 3:** `bun run typecheck` → clean (any remaining `cascade_deviation` reference is a miss — `grep -rn cascade_deviation routes types hooks` should return nothing).
- [ ] **Step 4:** `bun test:run routes/product-management/category` → pass.
- [ ] **Step 5:** Commit `refactor(category): ตรวจค่าที่เปลี่ยน + สร้าง payload cascade แทน cascade_deviation ตายตัว`

### Task 5: `CascadeConfirmDialog` + i18n

**Files:**
- Create: `routes/product-management/category/cascade-confirm-dialog.tsx`
- Modify: `messages/en.json`, `messages/th.json` (under `productManagement.category`, beside `confirmFlagsChange` ~line 4101)

**Interfaces:**
- Consumes: `CascadeChanges`, `CascadeChoice` (Task 4).
- Produces:
  ```ts
  interface CascadeConfirmDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly nodeType: CategoryNode["type"];
    readonly changes: CascadeChanges;
    readonly counts: { subCategories: number; itemGroups: number };
    readonly flagsChanged: boolean;
    readonly onChoose: (choice: CascadeChoice) => void;
  }
  export function CascadeConfirmDialog(props: CascadeConfirmDialogProps): JSX.Element
  ```

- [ ] **Step 1:** Add keys (en / th):
  | key | en | th |
  |---|---|---|
  | `cascadeTitle` | Apply changes to items below? | เขียนทับค่าลงรายการชั้นล่าง? |
  | `cascadeChangedLabel` | Changed values | ค่าที่เปลี่ยน |
  | `cascadeTargetsLabel` | Will be overwritten | จะถูกเขียนทับ |
  | `cascadeTargetsCategory` | {subCategories} sub-categories, {itemGroups} item groups and all their products | หมวดย่อย {subCategories} รายการ, Item Group {itemGroups} รายการ และสินค้าทั้งหมดภายใต้ |
  | `cascadeTargetsSubcategory` | {itemGroups} item groups and all their products | Item Group {itemGroups} รายการ และสินค้าทั้งหมดภายใต้ |
  | `cascadeTargetsItemGroup` | All products in this item group | สินค้าทั้งหมดใน Item Group นี้ |
  | `cascadeInherit` | Inherit from above | สืบทอดจากชั้นบน |
  | `cascadeNone` | None | ไม่มี |
  | `cascadeClearWarning` | Cleared accounts are removed from every item below, so they inherit again. | บัญชีที่ล้างค่าจะถูกลบออกจากทุกรายการชั้นล่าง ให้กลับไปสืบทอดจากชั้นบน |
  | `cascadeOverwrite` | Overwrite items below | เขียนทับลงชั้นล่าง |
  | `cascadeSelfOnly` | Save this item only | บันทึกเฉพาะรายการนี้ |
- [ ] **Step 2:** Build the dialog on `components/ui/alert-dialog.tsx`: title; list of changed values
  `label: from → to` (labels reuse the form's field label keys `priceDeviation` / `qtyDeviation` /
  inventory & direct account labels used in `category-form.tsx`); cleared account `to` shows
  `cascadeInherit` for Sub-category/Item Group, `cascadeNone` for Category; targets line by
  `nodeType`; `cascadeClearWarning` when any account `to` is `null`; `confirmFlagsChange` text
  when `flagsChanged`. Footer: Cancel (`common.cancel`, closes), `cascadeSelfOnly` (outline),
  `cascadeOverwrite` (default variant). Buttons call `onChoose` then the parent closes.
- [ ] **Step 3:** `bun run typecheck && bunx eslint routes/product-management/category/cascade-confirm-dialog.tsx` → clean; `bun test:run components/ui/type-ladder.test.ts lib/__tests__/status-ink-contrast.test.ts` → pass.
- [ ] **Step 4:** Commit `feat(category): dialog ยืนยันการเขียนทับลงชั้นล่าง`

### Task 6: Wire the dialog into the form and the submit path

**Files:**
- Modify: `routes/product-management/category/category-form.tsx:42,136-149,422-439`
- Modify: `routes/product-management/category/category-dialog.tsx` (`onSubmit` prop type)
- Modify: `routes/product-management/category/category-component.tsx:179-230` (`handleFormSubmit`)

**Interfaces:**
- Consumes: Task 4 functions, Task 5 dialog.
- Produces: `onSubmit: (data: CategoryFormValues, decision?: CascadeDecision) => void` on
  `CategoryForm` and `CategoryDialog`.

- [ ] **Step 1 (form):** In edit mode, `changes = detectCascadeChanges(defaultValues, data)`,
  `flagsChanged` = existing recipe/sold check.
  - `hasCascadeChanges(changes)` → stash payload + changes, open `CascadeConfirmDialog`
    (`counts = countDescendants(selectedNode)`, `flagsChanged`); `onChoose(choice)` →
    `onSubmit(pending, { choice, changes })`, close, clear.
  - else `flagsChanged` → existing `DeleteDialog` flow unchanged.
  - else `onSubmit(payload)`.
  Add mode never opens the cascade dialog.
- [ ] **Step 2 (component):** `handleFormSubmit(formData, decision)` — for **edit** only, wrap
  `data` with `applyCascadeDecision(data, decision)` before building `payload`; create paths
  unchanged.
- [ ] **Step 3:** `bun run typecheck && bunx eslint routes/product-management/category` → clean;
  `bun test:run routes/product-management/category` → pass.
- [ ] **Step 4:** Commit `feat(category): ถามก่อนเขียนทับค่าลงชั้นล่างเมื่อแก้ category/sub-category/item group`

### Task 7: Manual verification (browser, local backend) + PR

Run BE locally with Tasks 1–3 (`micro-business` + gateway on :4000), FE with
`VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev`. **:4000 is the shared dev DB** — use a
throwaway category tree (create Category → Sub-category → Item Group → 1–2 products), never real
data. Watch request payloads in DevTools.

- [ ] **Step 1:** Edit Category deviation → dialog lists the change and counts → "Overwrite" →
  children + products show the new value; payload has `cascade_deviation: true`.
- [ ] **Step 2:** Rename only → no dialog; payload `cascade_deviation: false`, no `cascade_account_codes`. Repeat on a Sub-category.
- [ ] **Step 3:** Change price deviation only → payload has no `qty_deviation_limit`; children's qty deviation unchanged.
- [ ] **Step 4:** Set inventory account on Category → Overwrite → every level has its own row
  (open each child's form: own value, not "inherited"). Then clear it → Overwrite → children show
  inherited/none; warning line appeared.
- [ ] **Step 5:** Change a value → "Save this item only" → children unchanged.
- [ ] **Step 6:** Change deviation + Recipe flag together → one dialog containing the flags line.
- [ ] **Step 7:** Light + dark mode screenshot of the dialog; mobile width.
- [ ] **Step 8:** Push FE branch, open PR (English) — note "deploy after backend PR #…", link it.
