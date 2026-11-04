---
title: "Dev BU T02 cannot create AP invoices or payments: no ap_control_account_id and no bank accounts"
author: Thammanoon
date: 2026-11-04
branch: feature/ap-pages-real-backend
cost: { minutes: 9, tokens: 304716 }
id: l-993e27ad
scope: repo
status: active
src: agent
---

## Watch out
- On the shared dev DB (local gateway :4000 → dev), BU T02 has no `gl_setting.ap_control_account_id`. Vendor A001 has no `ap_chart_of_accounts_id` either. So POST ap-invoice fails with "gl_setting.ap_control_account_id is not configured". The CR account is resolved at create: micro-business ap-invoice.service.ts ~L1409 uses `vendor.ap_chart_of_accounts_id ?? setting.ap_control_account_id`.
- T02 also has no bank accounts (/config/bank-account is empty). The AP payment bank dropdown is therefore empty, and the page shows no hint about why.
- A browser test of the AP create, submit and post flow needs a BU with both of these configured. Otherwise set them first; that is a write to the shared dev DB, so ask the user before doing it.

## Decided
- The backend fix for wht-preview counting the edited draft's own reservations is on carmen-turborepo-backend branch fix/ap-wht-preview-exclude-self (5e4f97750). It must deploy together with FE feature/ap-pages-real-backend.
