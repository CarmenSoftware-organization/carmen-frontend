---
title: Draft JV lines can be edited via PATCH details.replace
author: Thammanoon
date: 2026-11-20
id: l-c65454d2
scope: repo
status: active
touches:
  - "lib/app-status-store.ts#replace"
  - "routes/accounting/journal-voucher/journal-voucher-mock-repository.ts#replace"
---

## Decided
Before this work, the JV PATCH changed only the header. Line edits made on the edit page were silently dropped on save, and dimensions were locked after create.
- BE PR #1079 (carmen-turborepo-backend) adds `details.replace`, which replaces the whole line set inside runAtomic, for **manual drafts only** (otherwise 409 GL_JV_IMMUTABLE).
- FE PR #617 sends the lines only when `source_type === "manual"`. Template drafts (recurring/allocation/…) still update only the header, so line edits on those are still silently ignored. This was not fixed and is left as a follow-up.
- Not yet tested against a real DB, and not yet opened in a browser in edit mode (the session had expired).

**Why:** The user asked for "everything in a line to be editable" (option ก) and chose the replace-all approach (option 1).

## Watch out
Deploy order is BE → FE (no migration). After BE is on dev, test with a throwaway manual draft JV, never a real document. Related: line-dimensions-hidden-switch

_From Claude Code's memory of this repo, last updated Nov 17._
