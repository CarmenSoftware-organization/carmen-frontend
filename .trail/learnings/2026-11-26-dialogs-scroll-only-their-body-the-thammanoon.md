---
title: "Dialogs scroll only their body: the primitive splits header, body and footer itself"
author: Thammanoon
date: 2026-11-26
branch: fix/dialog-sticky-footer
cost: { minutes: 6, tokens: 44395 }
id: l-2ef45c88
scope: repo
status: active
replaces: l-047c3cf3
src: agent
touches:
  - components/ui/dialog.tsx
---

## Decided
2026-11-26: the user wanted each dialog's header and Cancel/Save always visible, with the scrollbar only on the middle section, like the Dimension dialog. There are 63 default-padding dialogs, so DialogContent splits its own children instead of each call site adding a body wrapper. Direct DialogHeader/DialogFooter children (Fragments are flattened) go to the top and bottom. Everything else is wrapped in a DialogBody, the only scroller. A <form> that holds the DialogFooter (6 dialogs) is cloned as a flex column: its body is wrapped and its footer stays inside the form, so submit still works. Its header is lifted out. The dialog is marked data-layout="split".

## Tried and ruled out
- Whole-dialog scroll with sticky header and footer (first version, same day). It worked, but the scrollbar spanned the full dialog height, including the header and footer.

## Watch out
- Structures it can't split fall back to the sticky layout (data-layout="default"): a footer wrapped in another component, two forms, or loose items next to a form that holds the footer. A sticky edge is measured inside the p-6 padding, so that fallback needs -top-6/-bottom-6 with matching negative margins.
- Dialogs that set their own padding (p-0…) are data-layout="custom" and untouched.
- The X close button lives inside DialogHeader so it never scrolls away. DialogContent's onOpenAutoFocus skips it, because Radix would otherwise focus X first. The check keys on the layout mode, since the header registers in a layout effect after Radix fires autofocus.
- AlertDialog is not covered.

In the code: components/ui/dialog.tsx (splitDialogChildren, DialogBody, HeaderCloseContext, group-data-[layout=split|default]/dialog:*)
