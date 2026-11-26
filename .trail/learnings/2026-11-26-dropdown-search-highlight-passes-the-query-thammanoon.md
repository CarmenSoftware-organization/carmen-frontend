---
title: Dropdown search highlight passes the query into each custom row renderer instead of auto-highlighting the DOM
author: Thammanoon
date: 2026-11-26
branch: feature/lookup-search-highlight
cost: { minutes: 3, tokens: 88428 }
id: l-f5bd01af
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-26-lookup-search-highlight-design.md
  - components/lookup/lookup-combobox.tsx
  - components/ui/highlight-text.tsx
  - routes/product-management/category/category-report-dialog.tsx
  - routes/report/list/report-param-dialog.tsx
---

## Decided
2026-11-26 user chose to highlight the search term in every searchable dropdown, including the ones that draw their own rows. The combobox hands the debounced query to the row renderer as a second argument; each caller wraps code + name with the existing yellow highlight component. Highlight follows the debounced term (the one that actually filtered), not every keystroke.

## Tried and ruled out
- React context + a self-reading highlight component: same number of file edits, but hides where the query comes from and silently does nothing outside the combobox.
- CSS Custom Highlight API over rendered rows: no caller edits, but cannot bold (mismatches table highlight), must recompute on every virtual-list scroll, and would mark labels that should not be highlighted (location type, account category).

## Watch out
- Custom row renderers exist outside components/lookup too (2 in routes/) — grep the whole tree, not just the lookup folder.
- Server-side search may match fields not shown; such rows appear with no highlight. Accepted.

In the code: components/lookup/lookup-combobox.tsx (renderItem signature, debouncedSearch), components/ui/highlight-text.tsx, routes/product-management/category/category-report-dialog.tsx, routes/report/list/report-param-dialog.tsx; spec docs/superpowers/specs/2026-11-26-lookup-search-highlight-design.md
