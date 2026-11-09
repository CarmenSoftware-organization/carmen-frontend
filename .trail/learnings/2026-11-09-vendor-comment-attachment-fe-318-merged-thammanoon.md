---
title: "Vendor comment+attachment (FE #318) merged 2026-10-15, not deployed"
author: Thammanoon
date: 2026-11-09
id: l-c2735028
scope: repo
status: active
touches:
  - "components/share/form-toolbar.tsx#FormToolbar"
  - "vitest.setup.ts#makeMemoryStorage.length"
---

## Decided
FE PR #318 (merged 2026-10-15, merge commit e5520ac9) adds Comment button + EntityCommentSheet to the vendor page. Backend `config_vendor-comments` already existed — no BE change. `FormToolbar` now has an optional `onComment` prop that other config pages can reuse (many config entities have BE comment endpoints but no FE).

**Why:** AppIdGuard `vendorComment.*` (6 names) passed on local/dev, but UAT/prod were not checked — if missing, users get logged out when opening the sheet (see new-api-name-401-logs-users-out).

## Watch out
before deploying FE to UAT/prod, confirm allow_all or the 6 api_names. Follow-up FE #319 (merged 2026-10-15, not deployed) fixed both shared comment-sheet issues: ALLOWED_TYPES now mirrors backend ALLOWED_MIME_TYPES (jpeg/png/webp/gif/pdf — keep them in sync if BE changes), and fetchAllComments() pages through at perpage 100 because the gateway rejects perpage=-1. Paging beyond 100 comments has not been tested on real data.
…

_From Claude Code's memory of this repo, last updated Oct 15._
