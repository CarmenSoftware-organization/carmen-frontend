---
title: "Document header secondary actions stay inline, never collapsed into a ⋯ menu; Comment · Activity always close the bar"
author: Thammanoon
date: 2026-10-29
branch: main
cost: { minutes: 19, tokens: 171719 }
id: l-2c2bb61c
scope: repo
status: active
src: agent
touches:
  - components/share/doc-actions.tsx
  - components/share/form-toolbar.tsx
  - routes/accounting/documents/accounting-document-detail.tsx
  - routes/procurement/credit-note/cn-header.characterization.test.tsx
  - routes/procurement/credit-note/cn-header.tsx
  - routes/procurement/goods-receive-note/grn-header.characterization.test.tsx
  - routes/procurement/goods-receive-note/grn-header.tsx
  - routes/procurement/purchase-order/po-header.characterization.test.tsx
  - routes/procurement/purchase-order/po-header.tsx
---

## Decided
- The user explicitly reversed commit 34f0bc79, which had collapsed Duplicate/Comment/Activity/Print into a "⋯ More" dropdown (DocActionsMenu). They must stay visible buttons on every document page: `components/share/doc-actions.tsx` (`DocActions`, used by PR/PO/GRN/CN/SR/JV headers). PR #456.
- Order rule across the whole app: Edit/Cancel·Save → Delete → page-specific buttons → Duplicate → Print → Comment → Activity. Comment · Activity are always last. `components/share/form-toolbar.tsx` renders `children` before its own Comment/Activity for this reason, and every header places `<DocActions>` as the last child.

## Tried and ruled out
- The overflow that motivated the collapse is handled by width instead of hiding: below `xl` the label is `max-xl:sr-only` (icon + tooltip, still the accessible name). Showing labels at every width wraps the bar on narrow screens.

## Watch out
- Don't "fix" a long header by moving these back into a dropdown, and don't add a page button after Activity.
- `DocActions` wraps its own `TooltipProvider` (like `components/ui/field.tsx`); header characterization tests render without app providers and throw "Tooltip must be used within TooltipProvider" otherwise.
- Accounting non-JV documents still have their own separate "More" menu (New/Copy/Template/AI/Attachments/Log). It was left out of scope, not forgotten.
