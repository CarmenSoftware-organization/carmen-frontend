---
title: FE AP invoice/payment pages are still a localStorage mock; GRN→AP auto must be enforced in backend
author: Thammanoon
date: 2026-11-04
branch: feature/grn-auto-ap-invoice-jv-tab
cost: { minutes: 27, tokens: 154996 }
id: l-0c07fa88
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/plans/2026-11-04-grn-auto-ap-invoice-jv-tab.md
  - docs/superpowers/specs/2026-11-04-grn-auto-ap-invoice-jv-tab-design.md
  - routes/accounting/accounts-payable/shared/use-accounts-payable.ts
---

## Decided
- 2026-11-04: GRN→AP auto invoice (spec docs/superpowers/specs/2026-11-04-grn-auto-ap-invoice-jv-tab-design.md) is split from wiring the AP pages to the real backend. `routes/accounting/accounts-payable/shared/use-accounts-payable.ts` always uses `createApMockRepository` (localStorage), so auto invoices won't show in the FE AP pages until project 2.
- Locking `doc_source = grn` invoices lives in the backend AP RPC handlers, not the FE.
- Behind a per-BU `gl_setting.ap_auto_from_grn` switch, default off, so BUs with incomplete GL setup can still commit AP GRNs.

## Tried and ruled out
- Editing posted AP invoice / JV amounts in place on GRN edit: wrong accounting and blocked by `gl_jv_posted_guard`. We void and recreate instead.

## Watch out
- Committed GRNs are header-only editable (`HEADER_EDITABLE_KEYS` in backend good-received-note.ap-link.ts). Lines and prices never change after commit, so a price fix is a CN/DN at AP.
- The mock AP types differ heavily from the backend: 10 vs 4 statuses, per-line payments, a single payment method, and no dashboard or approvals-inbox endpoints. Gap analysis is needed before project 2.
- GRN logic is not in a tenant context (TenantContextRunner). AP services are TenantScopedService, so calling them from GRN needs `ctx.run`.
