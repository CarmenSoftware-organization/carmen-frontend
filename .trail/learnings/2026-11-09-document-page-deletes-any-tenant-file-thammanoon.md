---
title: Document page deletes any tenant file + file_delete activity
author: Thammanoon
date: 2026-11-09
id: l-56a3611b
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-11-03-document-delete-any-file-design.md
---

## Decided
Merged 2026-11-03: BE #989, micro-file #13, FE #482 (spec `docs/superpowers/specs/2026-11-03-document-delete-any-file-design.md`). Admins delete every tenant file from /system-admin/document; tombstone soft-deletes product/recipe/step image rows, NULLs image/signature columns, writes `tb_activity` action `file_delete` per owner in the same tenant tx. Platform files (avatar, user signature, BU/cluster logo, news, note attachments) stay refused — managed in carmen-backstage (carmen-platform-renamed-backstage).

**Why:** user decided "admin page ⇒ every file deletable, but log who/when on the owning record".

## Watch out
- The new raw SQL was **never executed** before merge (user chose to merge anyway). First real run = verify soft-delete + primary promotion + one activity row per owner.
- Deploy order: tenant migration `20261103140000_add_activity_action_file_delete` (and every other pending tenant migration — a missing attachment table breaks tombstone/findUsages for that BU) → micro-file → micro-business → gateway → FE. BE main auto-deploys dev on push (backend-ci-blocked-by-billing), so dev may already run it unmigrated (fails safe: TOMBSTONE_FAILED).
…

_From Claude Code's memory of this repo, last updated Nov 3._
