---
title: "AR receipts take one payment method, post overpayment as a customer advance, and book no VAT"
author: Thammanoon
date: 2026-11-24
branch: docs/ar-receipt-spec-plan
id: l-323b35cf
scope: repo
status: active
src: agent
touches:
  - routes/accounting/accounts-receivable/ar-receipt-model.ts
---

## Decided
The user decided how AR Receipt becomes a real document (24 Nov). Each receipt has one payment method and one bank account on the header. If the customer pays more than the invoices settled, the excess posts to a customer advance (deposit liability) account. A receipt posts no VAT. The tax-invoice flag only creates a TXRC record with no GL effect. Everything else follows the draft recommendations: it can settle invoice, debit note, credit note and deposit lines; it posts straight to the bank account's GL account; WHT comes from tax profiles, with a bank-charge field; currency must match the invoice; allocation is pro-rata by each line's unpaid amount; approval rules are the same as AP Invoice, AP Payment and AR Invoice (key `ar.receipt.allow-creator-approve`, no cash exemption); the old localStorage mock data is discarded; the existing AR licence key is reused. The real backend (Phase A) ships before the approval workflow (Phase B).

## Tried and ruled out
- Several payment methods on one receipt: ruled out. It needs a new child table and per-method JV legs, and AP Payment also uses a single method.
- Refusing receipts that don't exactly match the settled amount (the draft's recommendation): the user rejected it in favour of a customer advance.
- Booking output VAT at receipt: deferred until accounting gives the VAT rule.

## Watch out
The customer advance needs a GL account that may not exist in the GL settings yet; check before building. Using that credit later is a separate feature.

In the code: spec docs/superpowers/specs/2026-11-25-ar-receipt-design.md (replaces the -design-draft.md file); plan docs/superpowers/plans/2026-11-25-ar-receipt.md; FE mock routes/accounting/accounts-receivable/ar-receipt-model.ts.
