---
title: Dialog header and footer are pinned by the primitive only for dialogs that keep the default padding
author: Thammanoon
date: 2026-11-26
branch: fix/dialog-sticky-footer
cost: { minutes: 17, tokens: 62493 }
id: l-047c3cf3
scope: repo
status: active
replaces: l-c84987b9
src: agent
touches:
  - routes/config/dimension/dimension-dialog.tsx
  - components/ui/dialog.tsx
  - routes/config/dimension/dimension-values-table.tsx
---

## Decided
2026-11-26: the user asked for the header and the Cancel/Save buttons to stay pinned in every dialog. With 94 DialogContent call sites, the fix lives in the primitive. DialogContent caps its height at the screen and scrolls. DialogHeader sticks to the top and DialogFooter sticks to the bottom, with a top border, both bleeding to the edges. This applies only when the caller does not set its own padding. A dialog passing p-0/px-/pb-… builds its own header/body/footer (dimension, category, email-template), so it is marked data-layout="custom" and left alone.

The X close button moved into DialogHeader. As an absolute child of the scrolling DialogContent, it scrolled away and slid under the sticky header. DialogHeader registers through context, and DialogContent renders its own X only when no header is present.

## Watch out
- A sticky edge is measured from the scroll container's padding box, inside p-6. Header and footer therefore use -top-6/-mt-6 and -bottom-6/-mb-6. With plain top-0/bottom-0 they float 24px from the edge.
- With X first in the DOM, Radix autofocused the X instead of the first field. DialogContent's onOpenAutoFocus skips [data-slot=dialog-close]. The check keys on the layout mode, not on header registration, because the header registers in a layout effect after Radix has already fired autofocus.
- AlertDialog is not covered.

In the code: components/ui/dialog.tsx (ownsLayout, HeaderCloseContext, DialogCloseX, group-data-[layout=default]/dialog:* on DialogHeader/DialogFooter)
