---
title: "Pick list columns by measured box width, not screen size"
author: Thammanoon
date: 2026-11-20
standing: true
id: l-5fd0880a
scope: repo
status: active
src: init-review
---

## Decided
- Many list pages (recipe, product, inventory adjustment, equipment) had overlapping or truncated columns at iPad and HD widths. The sidebar changes available space, so screen breakpoints misjudge it.
- In the code: Use `useElementWidth` plus `columnTier` in the list hook (see `use-recipe-table.tsx`, `use-ia-table.tsx`, product list). Hidden columns move to secondary lines under the name. Put the step sums in a comment above `columnTier`. Keep one grow column and fixed px for the rest. Never hide the `#` column.

_From PRs #700, #670 here, Nov 19._
