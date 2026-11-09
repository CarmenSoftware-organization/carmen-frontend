---
title: "Product local names can contain NBSP, so compare names after collapsing whitespace"
author: Thammanoon
date: 2026-11-09
branch: feature/pr-detail-design-direction
cost: { minutes: 4, tokens: 89208 }
id: l-c8770cab
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-request/pr-item-cells/foc-cell.tsx
  - routes/procurement/purchase-request/pr-item-cells/product-cell.tsx
  - routes/procurement/purchase-request/pr-item-expand.tsx
  - routes/procurement/purchase-request/use-pr-item-table.tsx
  - components/share/on-hand-dialog.tsx
---

## Decided
Some product master records store local_name with non-breaking spaces (U+00A0) instead of normal spaces. The text looks identical to product name, but `!==` says the two differ. To hide a "secondary name that duplicates the primary", collapse whitespace first: `v.replace(/\s+/g, " ").trim()` (JS `\s` matches NBSP).

## Tried and ruled out
- A plain `local_name !== name` compare. Example: "ATTA (Wheat Flour) 5kg" on T02 still showed twice.
- Widening the PR line Amount column in edit mode to 190px. On a ~1500px content width the whole item table overflowed and the delete button at the end of the row was cut off. 175px fits "1,000.00".

## Watch out
- on-hand-dialog / on-order-dialog and the Price List detail view still use a plain `!==` and can show the same name twice.
- The PR status dot, SummaryBar weight-not-size emphasis and the muted Edition label are deliberate, documented choices. Read the comments before "fixing" them.

In the code: routes/procurement/purchase-request/pr-item-cells/product-cell.tsx (squashSpaces), use-pr-item-table.tsx amount `size: isDisabled ? 160 : 175`, components/share/on-hand-dialog.tsx:176, on-order-dialog.tsx:211
