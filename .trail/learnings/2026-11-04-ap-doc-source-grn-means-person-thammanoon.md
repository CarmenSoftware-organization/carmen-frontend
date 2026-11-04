---
title: "AP doc_source grn means person-made from GRN; grn_auto is the system-made, locked one"
author: Thammanoon
date: 2026-11-04
branch: main
cost: { minutes: 82, tokens: 185183 }
id: l-2184c817
scope: repo
status: active
src: agent
touches:
  - package.json
  - messages/en.json
  - messages/th.json
  - routes/procurement/goods-receive-note/grn-journal-tab.tsx
  - routes/procurement/goods-receive-note/use-grn-journal-vouchers.ts
  - constant/api-endpoints.ts
  - routes/procurement/goods-receive-note/grn-form.tsx
  - types/goods-receive-note.ts
  - routes/accounting/settings/accounting-settings-form.tsx
  - routes/accounting/settings/gl-setting-value.ts
---

## Decided
- 2026-11-04 (BE PR #1002, FE PR #502): system-created AP invoices from a GRN commit use the new `enum_ap_invoice_source.grn_auto` plus `tb_ap_invoice.source_grn_id`. The older `grn` value was already written by the person-driven `createFromGrn`, so it can't mark "auto". The AP-side lock and the GRN header-edit void+reissue apply to `grn_auto` only.
- Auto AP dates use `businessDay()` (the BU timezone), the same derivation as the GRN open-period check. The JV must land in the same period as the stock posting.

## Tried and ruled out
- Finding voided auto invoices by vendor + description "GRN <no>": void deletes `tb_ap_invoice_detail_source` link rows, and matching on description is fragile. Use `source_grn_id`.

## Watch out
- The backend "Deploy Dev" workflow (build.yml) runs on every push to main and does NOT run migrations. A merge that adds a column the Prisma client selects breaks every query on that table on the shared dev DB until someone migrates.
- GRN FE dates are local midnight sent as UTC ISO (date-picker toISOString). Never take `.toISOString().slice(0,10)` of grn_date/invoice_date for accounting dates.
