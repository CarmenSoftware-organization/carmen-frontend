---
title: "BE publish-packages workflow never succeeded until PR #988 (3 Nov 2026)"
author: Thammanoon
date: 2026-11-09
id: l-5d710785
scope: repo
status: active
touches:
  - bun.lock
---

## Decided
Before BE PR #988 (merged 3 Nov 2026), `publish-packages.yml` had failed on every run. setup-bun fell back to `packageManager` bun@1.2.5, which can't read `bun.lock`. Version bumps of `packages/*` were never published from CI. The fix uses `bun-version: latest`, and the first run then published file-contract 1.1.0.

**Why:** the auto-mode classifier blocks a local `bun run publish:packages`, so CI is the path that works for me.

## Watch out
bump the package version in the PR. After merge, check the run and `gh api /orgs/CarmenSoftware-organization/packages/npm/<name>/versions` before switching a consumer repo off its `file:` link. Locally, the "dist has N file(s) with no source" error needs `bun run build:package --force` (turbo cache replays stale dist). Related: document-trace-bulk-delete.

_From Claude Code's memory of this repo, last updated Nov 2._
