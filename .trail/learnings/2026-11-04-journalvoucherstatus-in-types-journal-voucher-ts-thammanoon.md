---
title: JournalVoucherStatus in types/journal-voucher.ts does not match the backend jv_status enum
author: Thammanoon
date: 2026-11-04
branch: main
cost: { minutes: 21, tokens: 345634 }
id: l-a053548d
scope: repo
status: active
src: agent
touches:
  - components/ui/data-grid/use-config-table.ts
  - components/ui/status-icon-label.tsx
  - constant/list-page-keys.ts
  - constant/status-config.ts
  - messages/en.json
  - messages/th.json
  - routes/accounting/journal-voucher/journal-voucher-http-repository.ts
  - routes/accounting/journal-voucher/journal-voucher-list.tsx
  - routes/accounting/journal-voucher/journal-voucher-mock-repository.ts
  - routes/accounting/journal-voucher/journal-voucher-repository.ts
---

## Decided
The JV list (`routes/accounting/journal-voucher/jv-status.ts`, PR #490) filters and labels by the real backend enum `enum_jv_status` = draft / in_review / scheduled / posted / void, NOT by `JournalVoucherStatus` in `types/journal-voucher.ts` (submitted / posting / post_failed / voided / reversal_scheduled / reversed …). Filtering with the FE union values returns an empty list because the backend never stores them.

## Watch out
- `journal-voucher-source.ts` `journalVoucherCapabilities` still checks `"submitted"`, `"post_failed"` etc., so on the detail page approve/return/reject/retry likely never enable for real data (backend sends `in_review`). Fixing it means aligning the type + capabilities with `enum_jv_status` (schema in carmen-turborepo-backend `packages/prisma-shared-schema-tenant/prisma/schema.prisma`).
- The JV list endpoint reads `perpage` / `filter` / `sort` via the shared `PaginateQuery`; the old repository sent `limit`, which is silently ignored (backend default perpage applies).
- List rows show `display_no` = `prefix_code` + `jv_no` (e.g. `JV-20261100001`) while the detail header shows bare `jv_no` — pre-existing mapping in `journal-voucher-http-repository.ts`.
