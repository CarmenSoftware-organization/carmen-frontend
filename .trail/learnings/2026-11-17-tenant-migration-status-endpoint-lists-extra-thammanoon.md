---
title: Tenant migration status endpoint lists extra pending names; read the raw output before firing
author: Thammanoon
date: 2026-11-17
branch: main
cost: { minutes: 317, tokens: 2088797 }
id: l-a4aae161
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-17-inventory-line-dimension-frontend-design.md
  - docs/superpowers/plans/2026-11-17-inventory-line-dimension-frontend.md
---

## Decided
On 2026-11-17 the dev deploy of #1074/#1076 checked all 11 BUs with `GET /api-system/tenant/migrations/:bu_id/status` before firing `/deploy`. The `pending` array is not reliable. Read `data.raw` (Prisma's own text) to see what is really pending.

`has_pending` is correct. The `pending` list is not. It collects every migration-looking name in the Prisma output, so it also includes:
- the "last common migration" line;
- migrations recorded in the BU's `_prisma_migrations` table but missing from the repo ("not found locally"). Old renamed or rolled-back ones exist on BL_AVG, BL_FIFO, ZEBRA_AVG (T02) and ZEBRA_FIFO (T03).

In that run BL_AVG reported 3 pending and T02 reported 4. Only one, `20261115090000_accounting_payment_wht_masters`, was really pending. `/deploy` then succeeded on all 11 BUs. The "not found locally" entries do not block `migrate deploy`.

## Watch out
- Don't treat a long `pending` list as "this BU is far behind". Also don't add a `migrate resolve` step for those names: they are already applied in the DB.
- The deploy progress stream counts its total with the same parser, so its totals are inflated the same way.
- The migration files are read from disk when the command runs. To apply a new migration through the old running service, update the checkout first (no build, no restart). Fire `/deploy` per BU, then install, build and restart. This is safe only when the migration is additive, so the old code keeps working against the new columns.

In the code:
- apps/micro-business/src/authen/tenant_migration/tenant_migration.service.ts — `parseMigrationNames` used at ~L332 (status), ~L480 (stream total) and ~L829 (all-BU status). `has_pending` comes from the regex `/not yet been applied/`.
- The real pending names are only the lines under "have not yet been applied:" in `data.raw`.
