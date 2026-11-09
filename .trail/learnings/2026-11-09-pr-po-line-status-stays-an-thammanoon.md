---
title: "PR/PO line status stays an icon dot, not a text badge; the fix was contrast, not form"
author: Thammanoon
date: 2026-11-09
branch: feature/pr-detail-design-direction
cost: { minutes: 2, tokens: 13178 }
id: l-950622fc
scope: repo
status: active
src: agent
touches:
  - components/share/item-status-dot.tsx
---

## Decided
The status of each PR/PO line (pending/approved/rejected/review) stays a 16px round dot with an icon, and its name lives in the tooltip. The user confirmed this on 2026-11-10, matching the original reasoning: rows are dense and scanned dozens at a time, and a text badge is louder than the numbers people are looking for. The real problem was that the dot was hard to read: a black icon on a solid mid-blue `--info` fill looked like one solid blob. Now the dot uses a soft fill (`bg-*/15`), a thin ring (`ring-*/50`) and an icon in the `*-ink` color, which reads in both light and dark themes.

## Tried and ruled out
- A text badge per line (the first design-review proposal). Rejected: it contradicts the documented dense-row decision, and PO shares the same component.

## Watch out
- The page footer SummaryBar (Grand Total stands out by weight, not size) and the muted Edition label next to the PR number were also reviewed and kept as they are. They are deliberate.

In the code: components/share/item-status-dot.tsx STATUS_STYLE (+ `ring-1 ring-inset`)
