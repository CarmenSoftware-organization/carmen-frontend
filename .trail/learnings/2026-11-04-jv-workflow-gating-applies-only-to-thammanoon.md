---
title: JV workflow gating applies only to manual/template/reversal/closing sources; subledger JVs post directly
author: Thammanoon
date: 2026-11-04
branch: feature/jv-workflow-by-type
cost: { minutes: 12, tokens: 67517 }
id: l-88cd0563
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-04-jv-workflow-by-type-design.md
  - routes/accounting/documents/accounting-document-detail.tsx
---

## Decided
- Only JVs with source manual, recurring, allocation, amortize, reversal, closing can go through a gl_jv workflow (spec docs/superpowers/specs/2026-11-04-jv-workflow-by-type-design.md). Workflow scope = prefix set AND source set, scopes must not overlap, no match = post immediately.
- A manual reversal matches scope by the ORIGINAL voucher's prefix, not the reversal_prefix_id from GL settings that the reversal uses for numbering. Scheduled auto-reverse skips workflow.

## Tried and ruled out
- Gating AP/AR/inventory/asset/interface JVs: gl-subledger-posting expects those vouchers to already be `posted`, and their source documents have their own workflow types (ap_invoice/ap_payment/ar_invoice), so this would mean double approval plus a rewrite of subledger posting.

## Watch out
- Backend `resolveJvWorkflowId()` (micro-business gl-jv.service.ts) currently picks the oldest active gl_jv workflow for every voucher, with no scoping.
- The approval stage strip in routes/accounting/documents/accounting-document-detail.tsx (~L1740) is hardcoded mock, not real workflow data.
- `reversed_by_jv_id` is only written in postReversal. A reversal waiting in workflow needs its own double-reversal guard.
