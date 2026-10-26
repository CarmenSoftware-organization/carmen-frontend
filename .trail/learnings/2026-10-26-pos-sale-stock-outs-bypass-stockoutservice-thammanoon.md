---
title: POS sale stock-outs bypass StockOutService; void resets POS lines inline
author: Thammanoon
date: 2026-10-26
branch: feature/sales-consumption
cost: { minutes: 30, tokens: 192351 }
id: l-f596dfcf
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/plans/2026-10-26-sales-consumption.md
  - docs/superpowers/specs/2026-10-26-sales-consumption-design.md
---

## Decided
- Sales Consumption (spec/plan 2026-10-26) reuses the POS posting path, not StockOutService.create/commit: BE pos-sale-confirm.service.ts writes tb_stock_out + details itself and posts via InventoryTransactionService.executeAdjustmentOut. Plan extracts that into pos-sale/stock-out-poster.ts.

## Watch out
- StockOutService.voidStockOut (BE stock-out.service.ts ~1639) resets tb_pos_sale_line.stock_out_id inline in its own transaction — any new "void via document" flow must split it (voidStockOutInTx) instead of calling it from another tx.
- voidStockOut has no period check; callers must assertDateInCurrentPeriod themselves.
- There is no system user: SFTP pull imports are attributed to the user_id configured on the micro-cronjobs job.
- Adjustment type SALE is only a constant; nothing seeds it — confirm/post fails with POS_SALE_ADJUSTMENT_TYPE_MISSING until seeded per BU.
