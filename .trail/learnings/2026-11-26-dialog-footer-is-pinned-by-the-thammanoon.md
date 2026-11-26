---
title: Dialog footer is pinned by the primitive only for dialogs that keep the default padding
author: Thammanoon
date: 2026-11-26
branch: main
cost: { minutes: 15, tokens: 185613 }
id: l-c84987b9
scope: repo
status: active
src: agent
touches:
  - components/ui/dialog.tsx
---

## Decided
2026-11-26: the user asked for Cancel/Save to stay pinned at the bottom of every dialog. With 94 DialogContent call sites, the fix lives in the primitive, not in each dialog. DialogContent caps its height at the screen and scrolls; DialogFooter becomes sticky with a top border and bleeds to the edges. This applies only when the caller does not set its own padding. A dialog that passes p-0/px-/pb-… already builds its own header/body/footer (dimension, category, email-template), so it is marked data-layout="custom" and left alone.

## Watch out
- Sticky bottom-0 left a 24px gap under the footer. Chrome measures the sticky edge from the scroll container's padding box, inside the p-6. The footer therefore uses -bottom-6 together with -mb-6.
- The header and X button scroll away with the content. Only the footer is pinned, because the X is absolute inside the scrolling box.
- AlertDialog is not covered (short confirm dialogs).

In the code: components/ui/dialog.tsx (ownsLayout regex, group/dialog, group-data-[layout=default]/dialog:* on DialogFooter)
