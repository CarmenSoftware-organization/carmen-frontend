---
title: "AP wht-preview counts the edited draft's own reservations; AP version conflicts arrive as *_IMMUTABLE 409s"
author: Thammanoon
date: 2026-11-04
branch: feature/ap-pages-real-backend
cost: { minutes: 62, tokens: 150023 }
id: l-5bac4acc
scope: repo
status: active
src: agent
touches:
  - routes/accounting/accounts-payable/payment/ap-payment-detail.tsx
  - constant/api-endpoints.ts
  - messages/en.json
  - messages/th.json
  - routes/accounting/accounts-payable/invoice/ap-invoice-detail.tsx
  - routes/accounting/accounts-payable/payment/ap-payment-allocations.tsx
  - routes/accounting/accounts-payable/payment/ap-payment-expenses.tsx
  - routes/accounting/accounts-payable/payment/ap-payment-wht.tsx
  - routes/accounting/accounts-payable/shared/ap-http-repository.ts
  - routes/accounting/accounts-payable/shared/ap-repository.ts
---

## Decided
- AP invoice/payment pages are on the real backend (branch feature/ap-pages-real-backend, 2026-11-05). The repository is routes/accounting/accounts-payable/shared/ap-http-repository.ts. Backend children (tb_ap_invoice_detail, tb_ap_payment_detail/_wht/_expense …) are mapped to lines/allocations/wht/expenses there.
- Payment detail blocks Save while WHT is stale (allocations signature ≠ last successful preview, or the preview failed). It also sends ap_payment_id in the wht-preview body. Until the backend honours it, zod strips it.
- Only credit_note allocations are negative. Deposits stay positive (micro-business ap-payment.validation.ts wrongSign), even though the plan text said otherwise.
- A bank is valid when its currency equals the payment currency OR the BU base currency (validation.ts ~L403).

## Watch out
- micro-business ap-payment.service.ts wht-preview calls loadAllocationLines(..., null). So when a draft is being edited, its own reservations are counted against it. A pay-full draft therefore 422s AP_PAYMENT_OVER_ALLOCATED on preview, and the FE guard blocks Save. Backend follow-up: pass body.ap_payment_id as excludePaymentId. outstanding-documents has the same double count; the FE adds the draft's own loaded allocation back into each line cap.
- A doc_version mismatch is never a bare 409. It is AP_INVOICE_IMMUTABLE / AP_PAYMENT_IMMUTABLE (409 + appCode). Handle conflicts by code; the en/th errors.byCode entries carry the "reloaded" text.
- PUT details.add / allocations / wht / expenses replace the whole set. Fields the UI does not model (line dimensions, sources, cr_*/vat_chart_*) must be carried through from the loaded row, or they are wiped.
- api_name allowlist uses the dash form (ap-invoice.findAll, ap-payment.whtPreview …), not apInvoice.*.
