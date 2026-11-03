# BU storage quota license: database size + attachment storage, warn, grace, block

Date: 2026-11-03 · Repos: carmen-turborepo-backend (backend-gateway, prisma-shared-schema-backstage,
error-catalog) · micro-file · micro-cronjobs · carmen-backstage · carmen-frontend.
micro-notification is used (email + in-app) but should not need changes.

## Intent and why

Some customers / BUs use so much storage that it has become a real cost for us — sometimes the
tenant database, sometimes the attachment files. Today nobody sees how much a BU uses until the
cloud bill arrives. We want each BU to carry **two separate quotas** — database size and attachment
storage size — measured automatically, with early warnings, a grace period, and finally a write
block that pushes the customer (via our team) to either clean up or buy more.

The goal is **cost control**, not a sales tiering feature. Success = our team learns about a BU
growing toward its limit before it becomes a cost problem, and has a lever (the block) when a
customer ignores it.

## Goals

1. Each BU has two quotas: **database** (default **5 GB**) and **attachments** (default **15 GB**).
   Our team can override either per BU in carmen-backstage.
2. Usage of both is measured periodically per BU and stored.
3. Warnings at **20%, 10%, 5%, 3% remaining**, each quota independently.
4. At 100% of a quota: **7-day grace**, writes still allowed; then **block growth** (uploads and
   creating new documents) until usage drops below quota or the quota is raised.
5. Our team is emailed at each threshold step; BU admins see warnings in the app.

## Non-goals

- Not a sales/packaging feature (no plans, no self-service upgrade, no billing integration).
- Not real-time metering. Measurement is periodic; small overshoot is accepted.
- No per-user or per-module quotas.
- No automatic cleanup or deletion of customer data, ever.

## Anti-goals (would make this a failure even if it "works")

- A BU blocked so hard it cannot **delete** things to get back under quota.
- Blocking login, token refresh, cronjobs (POS import, GL run-due, notifications, activity log) —
  the block is for user-initiated creates/edits/uploads only.
- Many BUs blocked at once on the day this ships (see Rollout).
- Phantom usage: a BU stuck "full" because the numbers don't drop after it deletes files.
- Telling a customer to "delete data to free space" when deleting cannot shrink the number
  (database — see Database reclaim).
- Stopping hotel operations on existing documents (approve, void, stock posting, period close).

## Decided by the user

- Two separate quotas (database, attachments), not one combined number.
- Warning steps: 20 / 10 / 5 / 3 % remaining.
- At 100%: 7-day grace, then block writes. During block, our team talks to the customer.
- Warnings 20–3%: **BU admins** see a **yellow banner at the top of every page** (mockup option A),
  dismissible, reappears at the next step. Every step also **emails our team**.
- Grace period: a **red, non-dismissible banner for every user in the BU**, counting down days
  until the block.
- Blocked: user tries to create or upload → dialog "สร้างเอกสารใหม่หรือแนบไฟล์ไม่ได้ — พื้นที่เก็บข้อมูลเต็ม …ดูและแก้ไขเอกสารเดิมได้ตามปกติ…
  กรุณาติดต่อผู้ดูแลระบบของคุณ". Reading keeps working.
- Defaults when no quota is set for a BU: database 5 GB, attachments 15 GB.
- **Block = stop growth only** (user's choice over "stop all writes"): when blocked, the BU cannot
  **upload files** or **create new documents/records**. Editing, approving, rejecting, voiding,
  cancelling, stock posting, period close and deleting on existing records keep working.
- **Database reclaim (option c):** database usage is measured as real on-disk size
  (`pg_total_relation_size`, includes bloat). Deleting rows does not shrink it, so the in-app copy
  for a full **database** says "contact the Carmen team", never "delete data". Our team gets a
  **"Reclaim space" action in carmen-backstage** per BU that runs `VACUUM FULL` over that BU's
  schema and then re-measures. (Attachments copy still says "delete unused files" — deleting files
  does shrink that number.)

## Calls made by Claude (user has not explicitly confirmed — flag if wrong)

- **How "stop growth" is enforced:** in the gateway's `LicenseInterceptor` path, on BU routes
  (`/api/:bu_code/...`, `/api/config/:bu_code/...`), reject (a) every request that uploads a file
  and (b) every endpoint that **creates** a new record. Because many POSTs are actions on existing
  records (approve, submit, void, post), "create" must be an **explicit, reviewed list** of
  endpoints (e.g. a decorator or a route table), not "all POSTs". The builder produces that list
  and it is reviewed before enforcement is switched on. Everything not on the list passes. Login,
  auth, profile, notifications, `api-system/*`, `api/internal/*` (cron) are never blocked.
  Accepted gap: edits that add detail lines to an existing document still grow the DB.
- **Either quota full ⇒ the same growth block** (uploads + creates), regardless of which quota is
  full. Each quota tracks its own grace clock; the block applies when *any* quota's grace has expired.
- **Per-BU exemption:** a backstage flag "exempt from storage block" per BU (still measured,
  still warned, never blocked). Lets the team switch enforcement on without blocking a BU that is
  mid-negotiation.
- **"BU admin"** for the yellow banner and Storage page = users who already have the System Admin
  access used by `/system-admin/*` (no new permission key; verify the key against the DB first).
- **Shared schema / null `db_schema`:** such BUs are flagged in backstage, measured but
  **exempt from blocking** until the team fixes the data.
- **Backstage-uploaded files excluded:** the builder enumerates the `reference_type` values used
  by backstage uploads from code + real data; a wrong exclusion is low risk.
- **Grace reset:** if usage drops below 100% during grace or block, the clock clears and the block
  lifts at the next measurement (or a manual re-measure). Exceeding again later starts a fresh 7 days.
- **Measurement frequency:** nightly via micro-cronjobs, plus a **"วัดใหม่ / Re-measure" button**
  on the BU storage page so an admin who just cleaned up doesn't wait a day. Rate-limit it
  (e.g. once per 10 min per BU).
- **Storage usage page:** System Admin › Storage shows both bars (used / quota / %), the last
  measured time, and an attachments breakdown by `reference_type` (reuse the existing summary),
  linking to `/system-admin/document` to delete files. Admin only.
- **Team email:** one recipient address (or list) configured in carmen-backstage; one email per
  threshold step per quota per BU (not every night). Also an email on grace start and on block.
- **Rollout in two stages** (established BUs may already exceed 5 GB):
  1. *Measure-only:* measuring and team emails run; no banners, no block. Our team reviews which
     BUs are over and sets real quotas in backstage.
  2. *Enforce:* flip a switch; banners and block turn on.
  A separate switch from the existing `license.enforcement_enabled` (that one is already on
  everywhere). Grace clocks must **not** start during measure-only; they start from the moment
  enforcement is on.

## What exists today (from code exploration, 2026-11-03)

- **Attachments:** all uploads go through micro-file → MinIO, key `<bu_code>/<uuid>.<ext>`.
  `tb_file_tag.size` (Int) + `bu_code` + `deleted_at` per file, in micro-file's own DB.
  `files.summary` (micro-file `files.service.ts` `summarizeFiles()`) already sums size per BU
  grouped by `reference_type`; gateway `GET /api/:bu_code/documents/summary`. Deleting a file
  removes the MinIO object and soft-deletes the row.
  - **Known bug to fix as part of this:** the fallback prefix delete path (~`files.service.ts:473`)
    removes the object but does not soft-delete the row → phantom size.
  - Backstage-side uploads (BU logo, cluster/BU notes) carry a bu_code and would count. **Exclude
    them** (they're ours, not the customer's) — builder to identify them by `reference_type`.
- **Database:** one Postgres schema per BU (`tb_business_unit.db_schema`) inside shared databases
  (`tb_database_pool`, encrypted credentials). BU size = `sum(pg_total_relation_size)` over the
  schema's relations, measured against that pool. Nothing enforces one BU per schema; `db_schema`
  may be null (falls back to `public`). **Builder must check real data** — if two BUs share a
  schema, report it and count the schema once against each (or flag) rather than guess.
- **License model:** features carry no numeric values. The precedent for numeric limits is
  `tb_business_unit_license.licensed_users` (seat) with view `v_business_unit_seat`, evaluator
  `evaluateSeat`, `BuQuota` type and `SEAT_LIMIT_EXCEEDED` error code. Model storage quotas the
  same way. No grace concept exists yet.
- **Enforcement point:** `LicenseInterceptor` (global `APP_INTERCEPTOR`, gateway
  `license/license.interceptor.ts`), 60 s cached per-BU lookups, fails open on lookup errors.
  `isWriteMethod` currently treats DELETE as a write — the storage check needs its own method set.
- **Jobs / notify:** micro-cronjobs (Go, gocron + Redis lock) with per-BU precedent
  `GlRunDueExecutor` calling gateway `POST /api/internal/...` with `x-internal-token`.
  micro-notification provides in-app + email.
- **FE:** `lib/api-error.ts` + `components/permission-denied-dialog.tsx` already handle license
  403 codes — the blocked dialog should go through this path with a new code.

## Shape of the solution (builder may refine)

1. **Data (backstage schema):** per-BU quota override (db bytes, file bytes; null = default) and a
   usage record per BU per quota kind: measured bytes, measured_at, exceeded_at (grace start),
   last warning step sent. Defaults (5 GB / 15 GB), team email recipients and the
   measure-only/enforce switch live in backstage config.
2. **Measurement:** a gateway internal endpoint (or micro-cluster service) that, for a BU,
   gets file bytes from micro-file and schema bytes from the pool, writes the usage row, computes
   the step, sets/clears `exceeded_at`, and sends team email when the step advances. A new
   micro-cronjobs job type runs it nightly over all active BUs. Re-measure button calls the same
   path for one BU.
3. **Enforcement:** storage evaluator in `LicenseInterceptor`: if enforce switch on and any quota
   has `exceeded_at` older than 7 days and current usage ≥ quota → 403 with new code
   (e.g. `STORAGE_QUOTA_EXCEEDED`, carrying which quota) for POST/PUT/PATCH only. Add the code to
   error-catalog.
4. **Read endpoint for FE:** `GET /api/:bu_code/storage-usage` → both quotas, used, %, step,
   grace end date, blocked flag, measured_at. **Add its api_name to the app allowlist on every
   env before the FE ships** (a missing allowlist row logs users out).
5. **FE:** global banner in the protected shell (yellow for admins at warning steps, dismissal
   remembered per step; red for everyone during grace and block), System Admin › Storage page,
   blocked dialog wired to the new error code. Both themes, i18n th/en.
6. **Backstage:** per-BU quota fields, exemption flag, current usage and the **Reclaim space**
   action on the BU edit Licenses tab; a cluster-wide list of BUs sorted by % used; config for
   defaults, recipients, enforce switch.
7. **Database reclaim:** backstage → gateway `api-system` endpoint → runs `VACUUM FULL` table by
   table in the BU's schema on its pool, then re-measures. Constraints the builder must respect:
   `VACUUM FULL` takes an **ACCESS EXCLUSIVE lock** (the BU's tables are unusable while each runs)
   and needs free disk roughly equal to the table being rewritten on the shared database. So:
   confirm dialog that says this, recommended off-hours, one reclaim at a time per pool, runs as
   a background job with status shown in backstage, never triggered automatically.

## Deploy order

backend migration → gateway + micro-file fix → allowlist `storage-usage` api_name → micro-cronjobs
job (measure-only) → backstage → FE (banner reads endpoint but stays silent in measure-only) →
team sets quotas → flip enforce.

## Left to the builder

Table/column names, whether measurement lives in gateway or micro-cluster, exact SQL, cache TTLs,
banner component details (follow `docs/DESIGN.md` — use `text-warning-ink` etc.), how the cron job
is registered, test strategy.
