---
title: LicenseInterceptor skips unmapped routes and counts DELETE as a write; Postgres schema size does not drop after deletes
author: Thammanoon
date: 2026-11-03
branch: feature/bu-storage-quota
cost: { minutes: 12, tokens: 100792 }
id: l-b7c66869
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/plans/2026-11-03-bu-storage-quota.md
  - docs/superpowers/specs/2026-11-03-bu-storage-quota-design.md
  - ".superpowers/brainstorm/25803-1793695582/content/storage-warning.html"
  - ".superpowers/brainstorm/25803-1793695582/content/waiting.html"
---

## Decided
- BU storage quota (spec docs/superpowers/specs/2026-11-03-bu-storage-quota-design.md): when a BU is over quota, block only growth (multipart uploads plus a reviewed list of "create" endpoints). We do not block all POST/PUT/PATCH, because approve/void/post/GRN are POSTs and blocking them would stop hotel operations.
- Database usage is measured as pg_total_relation_size over the BU's schema (relkind r/m). Deleting rows does not shrink that number. Recovery is therefore "contact the Carmen team" or a backstage VACUUM FULL reclaim, never "delete data".

## Watch out
- In carmen-turborepo-backend, gateway license/license.interceptor.ts returns early when `!match` (the route is not in LICENSE_ROUTE_FEATURES). A check that must cover every /api/:bu_code route has to run before that line.
- isWriteMethod (license-route-resolver.ts) treats DELETE as a write. Seat and BU-quota blocks therefore also block deletes.
- micro-file files.service.ts deleteFile has a prefix-fallback branch that removes the MinIO object but never soft-deletes the tb_file_tag row. That leaves phantom size in files.summary.
- Nothing enforces one BU per tb_business_unit.db_schema, and db_schema may be null (falls back to public). Per-BU DB size is ambiguous for those BUs.
