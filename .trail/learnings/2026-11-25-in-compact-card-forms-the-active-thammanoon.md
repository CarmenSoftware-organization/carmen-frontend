---
title: "In compact card forms, the active switch is a plain field (label + switch + Active/Inactive), not the boxed status switch"
author: Thammanoon
date: 2026-11-25
branch: fix/workflow-new-compact-layout
cost: { minutes: 8, tokens: 237442 }
id: l-77fa55e2
scope: repo
status: active
src: agent
touches:
  - routes/system-admin/workflow/wf-new-form.tsx
  - messages/en.json
  - messages/th.json
  - routes/config/chart-of-accounts/coa-form.tsx
  - components/ui/status-switch.tsx
---

## Decided
2026-11-25: on the new-workflow page converted to the compact card layout, the active/inactive control sits as one cell of the General field grid, rendered as a field label, a switch and the word Active/Inactive at input height. This matches the edit-workflow page and the chart-of-accounts form.

## Tried and ruled out
- The shared boxed status switch inside the grid: it draws its own bordered box, giving a card inside the card, and its default description ("Enable or disable this record") only repeats the label. Hiding its badge still leaves the box, which sits taller than the inputs beside it.
- A separate Status section: a whole card for one switch takes more room than its content.

## Watch out
- Inputs in these grids should use the small control height so they line up with selects (which default to small).

In the code: routes/system-admin/workflow/wf-new-form.tsx (Controller name is_active → Field + Switch, min-h-8 row) · pattern source routes/config/chart-of-accounts/coa-form.tsx (coa-is-active) · components/ui/status-switch.tsx is the boxed one
