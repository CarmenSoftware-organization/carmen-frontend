# Category tree: confirm before overwriting children (deviation + account codes)

Date: 2026-10-20 · Repos: carmen-turborepo-backend-v2, carmen-inventory-frontend-react
Page: `/product-management/category`

## Intent

Editing a node in the product category tree (Category → Sub-category → Item Group →
Product) can push its values down to every node beneath it. Today:

- **Sub-category / Item Group** push **silently on every save**. The form sends
  `cascade_deviation: selectedNode?.cascade_deviation ?? true` (`category-form.tsx:83`, no UI
  control); the tree copies that flag from the API, which has no such column, so it is
  `undefined` → `true`. The backend then overwrites `price_deviation_limit` /
  `qty_deviation_limit` on every item group **and product** below, even when the user only
  renamed the node (`product-sub-category.service.ts:447`, `product-item-group.service.ts:473`).
- **Category** never pushes from this UI: `use-category-tree.ts:110` hard-codes
  `cascade_deviation: false` on every Category node, so the backend's category cascade
  (`product-category.service.ts:370`) never runs. **The user confirmed (2026-10-20) that
  Category edits should start cascading, behind the confirmation.** This is new behavior for
  Category — call it out in the release note and in manual verification.

The user wants:

1. A confirmation message box **before** saving whenever the save would overwrite children,
   so nobody wipes per-child settings by accident.
2. The overwrite to also cover **Inventory Account** and **Direct Account**, not just the
   two deviation limits — copied down as real rows on every level, because reports are easier
   to build when every row carries its own account code rather than resolving inheritance.

## Behavior

### What cascades

Four values: `price_deviation_limit`, `qty_deviation_limit`, inventory account, direct account.

Only the values **the user changed in this edit** cascade. *(Builder's-call by Claude — see
"Calls" below.)* Unchanged values on children are left alone, so changing a deviation limit
does not wipe a child's custom account code and vice versa.

### Which levels

| Edited node  | Overwritten                                  |
|--------------|----------------------------------------------|
| Category     | its Sub-categories, Item Groups, Products    |
| Sub-category | its Item Groups, Products (never the Category above) |
| Item Group   | its Products *(Claude's guess; matches today's backend)* |

Products are included for all four values (user decision; products already receive the
deviation overwrite today and own account-code rows in `tb_product_account_code_mapping`).

### Account codes: copy, not inherit (user decision: option B)

Account codes normally inherit: a level without its own mapping row resolves to the nearest
ancestor's (`resolveEffectiveAccountCodes`, `account-code.helper.ts`). The user chose to
**copy** the code onto every level below instead:

- **Value set / changed** → every descendant gets its own row for that `account_type`
  with the new `account_code` (+ `account_name` from the edited node's row): update the
  existing live row, or create one if none exists.
- **Value cleared** (user empties the field so the node inherits from above) → soft-delete
  every descendant's row for that `account_type`, so the whole subtree goes back to
  inheriting. This also requires the confirmation (user decision). Note for the message
  text: for a Category there is nothing above, so the subtree ends up with **no** account
  for that type.

Accepted consequence of B: after a cascade, later edits of the parent no longer flow down
by inheritance — they only reach children through another confirmed cascade.

### The confirmation message box

Shown **only in edit mode** and **only when at least one of the four values changed**.
Editing only name/description/tax/etc. saves straight away with no cascade.

Content:
- Which values changed, old → new (cleared account shows as "inherit from above" / "none").
- Which levels will be overwritten (per the table), with the counts of sub-categories /
  item groups taken from the tree already in memory. Products are described as "all products
  under …" with no count *(Claude's call — no product count is available client-side and a
  new count endpoint isn't worth it)*.
- Extra warning line when an account is being cleared (subtree reverts to inheriting).

Buttons:
- **Overwrite children** → save with cascade.
- **Save this item only** → save the node, no cascade at all.
- **Cancel** → back to the form, nothing saved.

*(Three buttons and "changed-only" trigger are Claude's proposal; the user did not object.)*

The existing "Recipe / Sold Directly flags may affect child items" confirm
(`category-form.tsx:138`, `DeleteDialog` at `:422`) must not stack a second dialog: when
both apply, show the new dialog with that warning as an extra line. When only the flags
changed, keep the existing dialog as is. *(Claude's call.)* (Backend does not actually
cascade those flags; leaving that message's wording alone is out of scope.)

## API contract

Keep `cascade_deviation` (gateway + micro DTOs default it to `true`; other clients such as
mobile may rely on that default — do not change the default).

Add to the update DTO of all three entities (gateway `common/dto/product-{category,sub-category,item-group}/*.dto.ts`
**and** micro-business `master/*/dto/*.dto.ts` — gateway zod strips unknown keys):

```
cascade_account_codes?: ("inventory" | "direct")[]   // default: [] → no account cascade
```

FE sends:
- "Overwrite children" → `cascade_deviation: true` only if a deviation value changed, else
  `false`; `cascade_account_codes` = the account types that changed (set or cleared).
- "Save this item only" or nothing relevant changed → `cascade_deviation: false`,
  `cascade_account_codes` omitted.

When cascading, FE **omits the unchanged deviation key** from the payload. The backend
cascade already writes only keys that are `!== undefined`, and the node keeps its stored
value for the omitted key — so a change to price deviation alone never overwrites
children's qty deviation.

## Backend

In each of the three `update()` methods:

1. After `applyAccountCodesWrite` for the node, for each type in `cascade_account_codes`:
   read the node's live row for that type (after the write). Row exists → upsert that code
   on every descendant; no row → soft-delete descendants' rows of that type. Descendants:
   - Category: sub-categories (`product_category_id`), item groups (via sub-category),
     products (via item group → sub-category).
   - Sub-category: item groups, products.
   - Item group: products.
   Filter `deleted_at: null` at every level, as the deviation cascade does.
   Soft-delete must respect the `(owner, account_type, deleted_at)` unique constraint — reuse
   the `bucketRowsByDuplicateKey` approach from `applyAccountCodesWrite` (distinct
   `deleted_at` per duplicate key).
2. Move the existing deviation cascade **and** the new account cascade **inside** the same
   `$transaction` as the node update. Today the deviation cascade runs after the transaction
   commits; a failure there leaves the node saved and children half-updated.

Size: a category can hold many products — use `updateMany` / `createMany` set operations,
not per-row loops.

Activity log: no new requirement; whatever the existing update path records stays.

## Frontend

- `use-category-tree.ts` / `types/category.ts`: drop `cascade_deviation` from `CategoryNode`
  and the DTO types — it is not a stored property; the per-save choice replaces it.
- `category-form.tsx`: remove the `cascade_deviation` default; compute "changed"
  for the four values against the loaded node (`selectedNode` + its fresh `account_codes`);
  decide whether to open the new dialog; pass the user's choice up with the form values.
- `category-component.tsx` `handleFormSubmit`: build `cascade_deviation` /
  `cascade_account_codes` from that choice.
- New dialog component beside the form (feature-local, `routes/product-management/category/`),
  built from `components/ui/alert-dialog.tsx` (the existing `ConfirmDialog` has a single
  confirm action; this needs two).
- i18n keys in `messages/en.json` + `messages/th.json` (no `{{}}` or `<word>` in messages —
  ICU breaks the page).
- Must read correctly in light and dark mode.

## Non-goals

- Cascading tax profile, Used in recipe, Sold directly, or the other account types
  (cogs / revenue / purchase).
- Cascading upward, or on create (add mode).
- A preview of exactly which children differ.
- Changing other clients (mobile, platform).

## Deploy order

Backend before frontend. New FE against old backend: `cascade_account_codes` is stripped by
the gateway and account cascade silently does nothing (deviation still works). Old FE
against new backend: behaves exactly as today (always cascades deviation, never accounts).

## Calls Claude made (user to check)

1. Only **changed** values cascade, not all four whenever the dialog is confirmed.
2. Item Group edits get the same dialog and cascade to products.
3. Dialog appears only when one of the four values changed; three buttons
   (overwrite / this item only / cancel).
4. No product count in the dialog.
5. Merge with the existing Recipe/Sold-directly confirm instead of two dialogs in a row.
6. Cascades move inside the node's transaction.

## Settled by the builder check (no user input needed)

- Duplicate live account rows can exist (NULL `deleted_at` is distinct in the unique index;
  see `account-mapping.service.ts:106`). Cascade updates **every** live row of that type on
  a descendant and creates one only where none exists.
- Inactive children are treated like the existing deviation cascade: only `deleted_at: null`
  filters.
- Children's `doc_version` is not bumped and no activity-log entry is added, matching the
  existing deviation cascade.
- Copied rows agree with the export resolver (item group → sub-category → category) and the
  AP-invoice resolver (product → item group); clearing on a Category leaves "none" for both.
- Large categories may need a raised interactive-transaction timeout once the cascade moves
  inside `$transaction`.
