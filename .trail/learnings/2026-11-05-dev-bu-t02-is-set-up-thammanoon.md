---
title: Dev BU T02 is set up for full AP testing; voided payments now link their reversal JV
author: Thammanoon
date: 2026-11-05
branch: docs/trail-t02-ap-learning
cost: { minutes: 19, tokens: 44222 }
id: l-11a904e3
scope: repo
status: active
replaces: l-5a9710de
src: agent
touches:
  - routes/accounting/accounts-payable/payment/ap-payment-detail.tsx
  - routes/accounting/accounts-payable/shared/ap-http-repository.ts
  - types/accounts-payable.ts
  - messages/en.json
  - messages/th.json
  - routes/accounting/accounts-payable/invoice/ap-invoice-detail.tsx
  - routes/accounting/accounts-payable/invoice/ap-invoice-header.tsx
  - routes/accounting/accounts-payable/payment/ap-payment-header.tsx
  - routes/accounting/accounts-payable/shared/ap-posting-banner.tsx
  - routes/accounting/accounts-payable/shared/ap-read-value.tsx
---

## Decided
- On 2026-11-05 (with the user's approval) BU T02 on the shared dev DB was configured so the AP invoice → payment flow runs end to end:
  - gl_setting: fiscal year start Jan, reversal prefix RV, AP JV prefix JV, AP control 2120005, Input VAT 1112008, WHT payable 2121002 (AP auto-from-GRN left off).
  - GL periods for fiscal year 2026 generated at /config/gl-period (13 periods, all open). Without them submit fails with "GL period is not open".
  - COA 1110012 category set to Assets; bank account CLTEST created with GL 1110012. The bank form's GL lookup only lists asset-category accounts, and every other T02 COA row still has a null category.
- Test documents left on dev: APIV26110001 (posted, JV 20261100003), APPV26110001 (void, JV 20261100004). Description/name "Claude browser test - ลบได้".
- Voided AP documents show the original JV, the reversal JV and the void reason through `routes/accounting/accounts-payable/shared/ap-posting-banner.tsx`. The payment's `void_gl_jv_id` comes from BE #1005 (added to micro-business ap-payment.serializer.ts); the AP gateway passes responses through, so a new AP field only needs the micro-business serializer.

## Watch out
- Submit on T02 posts directly (no in_review step), so a test submit creates a real JV on the shared dev DB.
- 2027 has no GL periods yet; a doc dated 2027 will fail the same way.
