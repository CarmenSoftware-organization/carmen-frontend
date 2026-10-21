---
name: accounting-detail-shell
description: Use when creating, changing, or reviewing accounting document detail pages in Carmen Blue, especially JV, AP Invoice/Payment, AR Invoice/Receipt, and Asset, to keep their header, borderless form, actions, and summary footer consistent.
---

# Accounting detail shell

Use Journal Voucher detail (`/accounting/journal-voucher/new`) as the live layout reference. Keep each document's domain fields and workflow, but match these shell rules:

1. Put Back, document number, badges, and top actions in `DocFormHeader` on the page background. Use its default inset; do not add a card or separate toolbar around the header.
2. Keep the general information form frameless. A divider between form and lines is fine; an outer `Card` border, background, radius, or shadow is not. Approval stepper belongs below the header without a surrounding card. Place its actions in `DocFormHeader.actions`.
3. Match JV action placement by mode: view actions (Edit, Void when allowed, More) at the top; edit/create Cancel and Save at the top; Submit at the right of `SummaryFooterBar` below the line table. Preserve disabled states and actual business capabilities.
4. Use `SummaryFooterBar` for totals below the table and keep it visible at the bottom of the document viewport as JV does. Fill the available parent height and let the table or tabs area take the remaining space; avoid a viewport-based minimum height that adds an outer scrollbar when there are few lines. Do not override the footer with `static!`, move totals above the table, or place Submit in the top toolbar.
5. Inspect the live JV reference and every affected page in **view, create, and edit** states before reporting completion. Check desktop and narrow viewport: Back alignment, no form card, action placement, footer position, wrapping, and disabled controls. A source-only review is insufficient.

Current consumers to check when this shell changes: `routes/accounting/documents/accounting-document-detail.tsx` (JV, AR Receipt, Asset Register/Disposal), `routes/accounting/accounts-payable/invoice/ap-invoice-detail.tsx`, `routes/accounting/accounts-payable/payment/ap-payment-detail.tsx`, and `routes/accounting/accounts-receivable/ar-invoice-detail.tsx`. AP and AR Invoice have their own routes; checking the generic document component alone does not cover them.

Reuse `carmen-ui-consistency` for broader design system choices. Keep this skill focused on accounting detail placement; do not change posting or approval rules to make pages look alike.
