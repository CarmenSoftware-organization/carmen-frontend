---
title: MissingDepartmentDialog must reappear on every page load; do not persist its dismissal
author: Thammanoon
date: 2026-10-26
branch: feature/dashboard-empty-state-and-dept-notice
cost: { minutes: 1, tokens: 9949 }
id: l-cc22c5e9
scope: repo
status: active
src: agent
touches:
  - components/missing-department-dialog.tsx
---

## Decided
- components/missing-department-dialog.tsx shows on every load for a user with no department in their default BU; Close only hides it until the next reload (state only).
- Owner decision 2026-10-26: a user without a department can make workflow (department-based approval routing) behave wrongly, so the dialog is meant to pressure an admin into assigning one.

## Tried and ruled out
- Remembering the dismissal per BU in sessionStorage (commit aa8c8689) to stop it nagging on reload — reverted in 79d3d12d for the reason above.
