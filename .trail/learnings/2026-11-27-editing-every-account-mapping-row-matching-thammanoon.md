---
title: "Editing every account-mapping row matching the filter skips the per-row conflict check, by the user's choice"
author: Thammanoon
date: 2026-11-27
branch: feature/coam-batch-update-by-filter
cost: { minutes: 16, tokens: 187944 }
id: l-5cc55bb7
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/plans/2026-11-27-coam-batch-update-by-filter.md
  - docs/superpowers/specs/2026-11-27-coam-batch-update-by-filter-design.md
  - messages/en.json
  - messages/th.json
  - routes/config/chart-of-account-mapping/coam-batch-edit-sheet.test.tsx
  - routes/config/chart-of-account-mapping/coam-batch-edit-sheet.tsx
  - routes/config/chart-of-account-mapping/coam-component.tsx
  - routes/config/chart-of-account-mapping/use-account-mapping.ts
---

## Decided
2026-11-27: on the Chart of Account Mapping page, "select all matching" + "Edit selected" sets cost center / account for every row matching the current filters in one request (new endpoint batch-update-by-filter, modeled on review-by-filter). The user accepted that this mode does NOT check doc_version per row: a row someone edits meanwhile is overwritten. The only guard is expected_count: if the matching count changed, 409 ACCOUNT_MAPPING_SCOPE_CHANGED and nothing changes.

## Tried and ruled out
- FE loads every page and calls batch-update in chunks of 100: thousands of rows = dozens of requests, half-applied on failure.
- Raising batch-update's 100 cap: still needs every page loaded, still a ceiling.

## Watch out
- The UPDATE is raw SQL, which bypasses the Prisma client extension that bumps doc_version. It bumps `doc_version = m.doc_version + 1` by hand; drop that and an open single-row edit sheet silently overwrites the batch result instead of getting 409.
- New api_name account-mapping.batchUpdateByFilter: allowlist it on non-allow_all envs before shipping the FE. Deploy order BE → allowlist → FE.
- Backend typecheck fails with "batchUpdateByFilter does not exist" until packages/rpc-contract is rebuilt (`bun run build:package`, there is no `build` script). micro-business tests run with jest (`npx jest`), not `bun test`.

In the code:
- BE: apps/micro-business/src/master/account-mapping/account-mapping.service.ts batchUpdateByFilter(); gateway controller @Post('batch-update-by-filter')
- FE: routes/config/chart-of-account-mapping/coam-batch-edit-sheet.tsx `filter` prop; coam-component.tsx openBatch()/matchFilter()
