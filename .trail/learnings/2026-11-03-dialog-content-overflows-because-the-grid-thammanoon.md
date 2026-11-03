---
title: "Dialog content overflows because the grid's implicit auto column grows to children's min-content"
author: Thammanoon
date: 2026-11-03
branch: main
cost: { minutes: 18, tokens: 110230 }
id: l-8ca03d5d
scope: repo
status: active
src: agent
touches:
  - components/ui/alert-dialog.tsx
  - components/ui/delete-dialog.tsx
  - components/ui/dialog.tsx
  - messages/en.json
  - messages/th.json
  - routes/profile/mcp-token-reveal-panel.tsx
---

## Decided
`components/ui/dialog.tsx` and `components/ui/alert-dialog.tsx` set `grid-cols-[minmax(0,1fr)]` on the Content (PR #474). The implicit `auto` grid column sizes to the min-content of its children, so an unbroken string (mojibake file name in Delete Document) or a `<pre>` code block (MCP token reveal) pushed text AND the footer buttons past the dialog edge. `overflow-x-auto` / `break-all` on the inner element does not help, because the grid item wrapping it still reports the wide min-content.

## Tried and ruled out
Fixing only `DeleteDialog` locally — the same bug appeared in the MCP token dialog minutes later, so the fix moved to the primitives.

## Watch out
Do not remove `grid-cols-[minmax(0,1fr)]` from the primitives. A dialog that needs several columns can override it via className (tailwind-merge replaces it). ICU messages: put shell `${VAR}` text in as an argument (`t("snippetHint", { envVar: "${CARMEN_MCP_TOKEN}" })`), never literally in messages/*.json, or the raw key renders.
