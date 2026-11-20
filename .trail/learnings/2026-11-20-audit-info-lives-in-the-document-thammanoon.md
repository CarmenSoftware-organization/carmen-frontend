---
title: "Audit info lives in the document header card, not under the item list"
author: Thammanoon
date: 2026-11-20
standing: true
id: l-46680720
scope: repo
status: active
src: init-review
touches:
  - components/share/doc-audit-line.tsx
  - "components/share/doc-audit-line.tsx#DocAuditButton"
  - "components/share/doc-audit-line.tsx#DocAuditLine"
---

## Tried and ruled out
- A first attempt placed a created/updated strip under the items (#678), then the team moved it into the header as a small table and dropped the earlier version. Revision also moved from the badge into that table.
- In the code: Use `DocAuditLine` in `components/share/doc-audit-line.tsx`, bottom-right of `DOC_HEADER_CARD`, view mode only. On mobile use the `DocAuditButton` info icon. Do not recreate `doc-audit-card`. Keep text at full `text-muted-foreground` for contrast, since /70 fails WCAG AA.

_From PRs #682, #679 here, Nov 18._
