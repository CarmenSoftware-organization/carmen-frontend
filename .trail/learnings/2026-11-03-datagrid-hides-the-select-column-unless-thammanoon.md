---
title: "DataGrid hides the select column unless tableLayout.checkbox is set, and flex cell content needs data-slot"
author: Thammanoon
date: 2026-11-03
branch: main
cost: { minutes: 9, tokens: 184276 }
id: l-1bdc53c4
scope: repo
status: active
src: agent
touches:
  - messages/en.json
  - routes/system-admin/document/document-component.tsx
  - routes/system-admin/document/document-reference-labels.ts
  - routes/system-admin/document/use-document-table.tsx
  - components/ui/data-grid/data-grid-table.tsx
---

## Decided
`routes/system-admin/document/document-component.tsx`: pass `tableLayout={{ headerSticky: true, checkbox: true }}`. `components/ui/data-grid/data-grid-table.tsx` (isColumnVisible) drops the column with id `select` whenever `tableLayout.checkbox` is falsy, so adding `selectColumn()` to the columns is not enough on its own.

## Watch out
- PR #472 shipped bulk delete with `selectColumn()` but no `checkbox: true`. There was no error, the checkbox column just never rendered, so the selection bar and "Delete selected" could not be reached on desktop until #475.
- The DataGrid cell wrapper applies `line-clamp-2` to every child that has no `data-slot`, which overrides `display:flex` (icon + label end up on separate lines). Give flex cell content `data-slot="cell-icon"` / `"cell-stack"` like the location / PO / SR tables do.
