---
title: "Running Code list shows readable document names with the raw key on a second line, and the key line must fit in full"
author: Thammanoon
date: 2026-11-26
branch: feature/running-code-readable-list
cost: { minutes: 8, tokens: 255199 }
id: l-eb255ab7
scope: repo
status: active
src: agent
touches:
  - messages/en.json
  - messages/th.json
  - routes/system-admin/running-code/running-code-card.tsx
  - routes/system-admin/running-code/running-code-cells.tsx
  - routes/system-admin/running-code/running-code-config.ts
  - routes/system-admin/running-code/running-code-labels.ts
  - routes/system-admin/running-code/use-running-code-table.tsx
---

## Decided
2026-11-26: the Running Code list shows a readable document name (AP Credit Note) as the main line and the raw type key as a small second line. Example numbers are coloured by part (prefix / date / sequence / data token). The backend's identical "initialized by system default." note shows as a dash.

## Tried and ruled out
Letting the key line truncate inside a narrower Type column (170px): AP/AR keys share the long "ACCOUNTS-PAYABLE-" / "ACCOUNTS-RECEIVABLE-" prefix, so cutting the end removes the only part that tells them apart.

## Watch out
- The longest key, ACCOUNTS-RECEIVABLE-CREDIT-NOTE, measures 205px at 11px mono. tracking-tight brings it to ~197px, so Type is 222. Together with Example 210 that leaves Note (grow) a 53px minimum, to stay at 660 total for tablet.
- The name map is hand-maintained from the backend preset list. A new preset type without a label shows as its raw key.
- At 768px the page switches to cards. Tables appear from 820px, so measure widths in a same-origin iframe when the browser window can't be resized.

In the code:
- routes/system-admin/running-code/running-code-labels.ts: TYPE_LABEL_KEY, isDefaultNote
- routes/system-admin/running-code/running-code-cells.tsx: SEGMENT_CLASS, RunningCodeTypeText
- routes/system-admin/running-code/use-running-code-table.tsx: sizes 222/210/53
- messages/*.json: systemAdmin.runningCode.typeLabel
