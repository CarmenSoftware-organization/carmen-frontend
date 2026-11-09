---
title: "Product local names can contain NBSP, so compare names after collapsing whitespace"
author: Thammanoon
date: 2026-11-09
branch: fix/nbsp-name-compare-type-ladder
cost: { minutes: 2, tokens: 16371 }
id: l-676a0cf0
scope: repo
status: active
replaces: l-c8770cab
src: agent
touches:
  - routes/profile/mcp-token-scope-picker.tsx
  - routes/profile/mcp-tokens-section.tsx
  - components/share/on-hand-dialog.tsx
  - components/share/on-order-dialog.tsx
  - lib/distinct-local-name.ts
  - routes/procurement/purchase-request/pr-item-cells/product-cell.tsx
  - routes/vendor-management/price-list/pl-item-cells.tsx
---

## Decided
Some product master records store local_name with non-breaking spaces (U+00A0) instead of normal spaces. The text looks identical to product name, but `!==` says the two differ, so the same name shows twice. Any place that hides a local name duplicating the primary name goes through `distinctLocalName(primary, local)`. It collapses whitespace before comparing (JS `\s` matches NBSP) and returns `undefined` when the name is empty or a duplicate.

## Tried and ruled out
- A plain `local_name !== name` compare. Example: "ATTA (Wheat Flour) 5kg" on T02 still showed twice.
- Widening the PR line Amount column in edit mode to 190px. On a ~1500px content width the whole item table overflowed and the delete button at the end of the row was cut off. 175px fits "1,000.00".

## Watch out
- A new "name + local name" display should use the helper, not `!==`.
- The PR status dot, SummaryBar weight-not-size emphasis and the muted Edition label are deliberate, documented choices.

In the code: lib/distinct-local-name.ts, used by routes/procurement/purchase-request/pr-item-cells/product-cell.tsx, routes/vendor-management/price-list/pl-item-cells.tsx, components/share/on-hand-dialog.tsx, components/share/on-order-dialog.tsx
