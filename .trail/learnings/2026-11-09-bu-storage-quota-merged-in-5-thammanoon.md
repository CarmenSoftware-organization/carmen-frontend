---
title: "BU storage quota merged in 5 repos 2026-11-03 (BE #990, micro-file #14, cron #17,…"
author: Thammanoon
date: 2026-11-09
id: l-437e44ad
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-11-03-bu-storage-quota-design.md
  - docs/superpowers/plans/2026-11-03-bu-storage-quota.md
  - ".superpowers/sdd/2026-11-03-bu-storage-quota/progress.md"
---

## Decided
Spec `docs/superpowers/specs/2026-11-03-bu-storage-quota-design.md` + plan `docs/superpowers/plans/2026-11-03-bu-storage-quota.md` (FE branch `feature/bu-storage-quota`). Executed subagent-driven; ledger = `.superpowers/sdd/2026-11-03-bu-storage-quota/progress.md` (source of truth for which tasks are done, rulings, deferred minors). Code lives in worktrees under `../worktrees/*-bu-storage-quota` (BE, micro-file, micro-cronjobs, backstage), all branch `feature/bu-storage-quota`, nothing pushed.

User decisions: two quotas, warn 20/10/5/3 % remaining, 7-day grace, then block **growth only** (uploads + creates), yellow banner for BU admins, red for everyone in grace, email to our team, DB bloat → backstage "Reclaim space" (VACUUM FULL).

**Why:** cost control — some BUs grow DB, others attachments.

## Watch out
- Separate `storage_quota.enforce` switch (default off); grace clocks start only while it is on. Existing BUs may already be over 5 GB.
- storage-quota api-system routes are fleet-wide only (BackstageWidePermissionGuard) — security review flagged cross-cluster IDOR.
- Before deploy: backstage allowlist `storageQuota.findOne/update/measure/findAll`; FE allowlist `storageUsage.get/measure` (see new-api-name-401-logs-users-out); `db:seed.backstage-permission` + `db:seed.backstage-role-permission` (keys `storage_quota.read/.manage`); file-contract publish 1.2.0 (gateway inlines BACKSTAGE_REFERENCE
…

_From Claude Code's memory of this repo, last updated Nov 3._
