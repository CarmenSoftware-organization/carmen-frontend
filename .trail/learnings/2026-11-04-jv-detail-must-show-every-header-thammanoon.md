---
title: "JV detail must show every header field from the v2.14 mockup, even when empty; don't hide them to match PO"
author: Thammanoon
date: 2026-11-04
branch: main
cost: { minutes: 1, tokens: 1413 }
id: l-b6e0da59
scope: repo
status: active
src: agent
touches:
  - routes/accounting/documents/accounting-document-detail.tsx
---

## Decided
The JV detail page (`routes/accounting/documents/accounting-document-detail.tsx`, JV branch) follows the PR/PO/GRN layout: badges next to the doc no, the workflow track under the title, Approve/Reject in the summary footer. But which fields appear comes from the mockup `CarmenBLUE/Accounting/GL/Journal Voucher/carmen_cloud_journal_voucher_fast_entry_v2_14.html` (shared drive): Schedule Post · Auto-Reverse │ Source │ Ref. Doc │ Status are always on screen, in every mode. An empty value shows "—".

## Tried and ruled out
Hiding the options strip in view mode when Schedule Post/Auto-Reverse are off and there is no source link, and moving Source into the header badges, made the layout look like PO. The user rejected it ("source หายไป"): reviewers have to see that a field is empty, not have it disappear.

## Watch out
When you take a layout pattern from another module, take its look but never drop a field the mockup lists. Gate JV-only changes on `isJournalVoucher`, because the other accounting document kinds share this component.
