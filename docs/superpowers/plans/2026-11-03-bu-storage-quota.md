# BU Storage Quota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **User preference (overrides TDD):** do not write `*.spec.ts` / `*.test.ts` files and skip
> "write failing test / run test" steps. Every task ends with type-check + lint + the manual
> verification listed. Existing suites must still pass before merge. Tell implementer subagents this.

**Goal:** Two per-BU storage quotas (database, attachments) that are measured nightly, warn at
20/10/5/3 % remaining, give a 7-day grace at 100 %, then block growth (uploads + creates), with a
backstage "Reclaim space" action for database bloat.

**Architecture:** Usage is measured per BU by the gateway (`StorageQuotaService`) from two
sources — micro-file's `Files.summary` for attachments and a new micro-business RPC for schema
size — and stored in the backstage DB. A micro-cronjobs job triggers it nightly. Enforcement is a
check inside the existing global `LicenseInterceptor`. FE and backstage read the stored rows.

**Tech Stack:** NestJS + Prisma (gateway, micro-business, micro-cluster, micro-file), Go
(micro-cronjobs), React (carmen-frontend, carmen-backstage).

**Spec:** `docs/superpowers/specs/2026-11-03-bu-storage-quota-design.md` (carmen-frontend repo)

Repos (all under `~/GitHub/carmensoftware-organize/`): `carmen-turborepo-backend` (BE),
`micro-file`, `micro-cronjobs`, `carmen-backstage`, `carmen-frontend` (FE). Branch
`feature/bu-storage-quota` in each repo. Paths below are relative to each repo root;
`GW` = `apps/backend-gateway/src`.

## Global Constraints

- Default quotas: database **5 GB**, attachments **15 GB**. GB = 1024³ bytes (`5368709120`, `16106127360`).
- Warning steps: **20, 10, 5, 3 % remaining**; full = used ≥ quota. Grace = **7 days**.
- Block = **POST/PUT/PATCH that upload a file (multipart) or that are on the reviewed "create" list**. DELETE, approve/submit/void/post, login/auth/profile/notifications, `api-system/*`, `api/internal/*` are never blocked.
- Block applies when enforce switch is on **and** BU not exempt **and** BU not flagged (shared/null schema) **and** any quota has `exceeded_at` ≤ now − 7 days **and** still used ≥ quota.
- Grace clocks (`exceeded_at`) are set only while the enforce switch is on.
- Fail open: any lookup error in the enforcement path = do not block (same rule as seat/BU quota).
- Database copy says "ติดต่อทีม Carmen"; attachments copy says "ลบไฟล์ที่ไม่ใช้".
- Every new api_name used by carmen-frontend must be in the app allowlist on every env **before** FE deploys (missing row ⇒ 401 ⇒ logout).
- FE: both themes; status text uses `text-warning-ink` / `text-destructive` tokens, never `text-warning`; i18n th + en; no `{}` or `<word>` in message strings.
- Commit messages in Thai.

## Review Focus

Manual checks (curl / browser) that must be run because no automated test covers them:

1. BU deletes files while in grace → after "Re-measure" the red banner disappears and `exceeded_at` is null (Task 4, 8).
2. Blocked BU can still DELETE a file, approve a PR and post a GRN; a new PR create and a comment upload get 403 `STORAGE_QUOTA_EXCEEDED` (Task 7).
3. Enforce switch off → measuring runs and team emails are sent but no BU ever gets `exceeded_at`, no banner, no 403 (Task 4, 7, 8).
4. Measurement of one BU failing (bad pool creds, null schema) does not stop the nightly job for the other BUs, and never blocks that BU (Task 3, 5).
5. BU over quota in both kinds shows one red banner naming both, and the dialog names the right kind (Task 8).

---

## Phase 1 — Measure only (shippable alone; no banners, no block)

### Task 1: micro-file — fix phantom size, exclude backstage uploads from summary

**Files:**
- Modify: `micro-file/src/files/files.service.ts` (`deleteFile` ~450-475, `summarizeFiles` ~909)
- Modify: `micro-file/src/files/files.controller.ts:785` (pass new param)
- Modify (BE): `packages/file-contract` schema for `Files.summary` payload, bump version + publish per repo practice

**Interfaces:**
- Produces: `summarizeFiles(params: { bu_code?: string; exclude_reference_types?: string[] })` — same return shape.
- Produces: constant `BACKSTAGE_REFERENCE_TYPES: readonly string[]` exported from `@repo/file-contract`.

- [ ] **Step 1:** In `deleteFile`'s prefix-fallback branch, call `this.softDeleteRegistryRow(fileToken)` after `removeObject`, same as the other two branches.
- [ ] **Step 2:** Enumerate the `reference_type` values written by backstage uploads (grep gateway for `backstage_` upload callers + `SELECT DISTINCT reference_type FROM tb_file_tag` on dev). Put them in `BACKSTAGE_REFERENCE_TYPES`.
- [ ] **Step 3:** Add `reference_type IS NULL OR reference_type NOT IN (...)` to `summarizeFiles` when `exclude_reference_types` is non-empty (use `Prisma.join`).
- [ ] **Step 4:** `bun run check-types` + lint in micro-file and BE. Manual: on dev, curl `GET /api/T02/documents/summary` still returns a numeric `data.total_size`.
- [ ] **Step 5:** Commit (both repos).

### Task 2: Backstage schema — quota, usage, config namespace

**Files:**
- Modify: `packages/prisma-shared-schema-backstage/prisma/schema.prisma` (near `tb_business_unit_license` ~1502)
- Create: `packages/prisma-shared-schema-backstage/prisma/migrations/20261104090000_add_bu_storage_quota/migration.sql`
- Modify: `apps/micro-cluster/src/cluster/backstage-config/backstage-config.schema.ts:297` (`BACKSTAGE_CONFIG_REGISTRY`)

**Interfaces — Produces:**
```prisma
enum enum_storage_kind { database attachment }

model tb_business_unit_storage_quota {   // one row per BU, all nullable = use default
  bu_id            String  @id @db.Uuid    // FK tb_business_unit.id
  db_quota_bytes   BigInt?
  file_quota_bytes BigInt?
  exempt           Boolean @default(false)
  note             String?
  updated_at / updated_by_id               // usual audit columns
}

model tb_business_unit_storage_usage {   // one row per BU per kind
  bu_id         String  @db.Uuid
  kind          enum_storage_kind
  used_bytes    BigInt
  quota_bytes   BigInt               // effective quota at measurement time
  measured_at   DateTime @db.Timestamptz
  exceeded_at   DateTime? @db.Timestamptz  // grace start; null = not full or enforce off
  warned_step   Int?                 // last step emailed: 20|10|5|3|0 (0 = full)
  blocked_notified_at DateTime? @db.Timestamptz // team emailed that the block started; null when not blocking
  flag          String?              // 'shared_schema' | 'null_schema' | 'measure_failed'
  @@id([bu_id, kind])
}
```
Config namespace `storage_quota` (zod schema + default):
`{ default_db_bytes: 5368709120, default_file_bytes: 16106127360, team_emails: [], enforce: false, grace_days: 7 }`.

- [ ] **Step 1:** Add models/enum + migration SQL. Generate client (`bun run db:generate` in the package).
- [ ] **Step 2:** Add `storage_quota` entry to `BACKSTAGE_CONFIG_REGISTRY` with zod schema (`team_emails: z.array(z.string().email())`).
- [ ] **Step 3:** Type-check BE. Manual: apply migration on local DB, `\d tb_business_unit_storage_usage`.
- [ ] **Step 4:** Commit.

### Task 3: micro-business — measure schema size

**Files:**
- Create: `apps/micro-business/src/storage-usage/storage-usage.{module,controller,service}.ts`
- Modify: `apps/micro-business/src/app.module.ts` (register module)
- Generated: `packages/rpc-contract/src/contracts/storage-usage.ts` (via `bun run gen:rpc-contract`)

**Interfaces:**
- Consumes: `TenantService.getdb_connection_for_external(bu_code, 'storage-usage')` pattern for a tenant client (`apps/micro-business/src/tenant/tenant.service.ts:519`).
- Produces RPC `StorageUsage.measureDb` payload `{ bu_code: string }` → `{ bytes: number; flag: 'shared_schema' | 'null_schema' | null }`.

- [ ] **Step 1:** Service `measureDb(bu_code)`: read BU (`db_schema`, `database_pool_id`). `db_schema` null → `{bytes: 0, flag: 'null_schema'}` without querying. Count other BUs with same pool + schema → `flag: 'shared_schema'` (still measure).
- [ ] **Step 2:** Query (parameterised schema, bigint → Number):
  `SELECT COALESCE(sum(pg_total_relation_size(c.oid)),0)::bigint FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind IN ('r','m')`
  (`pg_total_relation_size` already includes indexes + TOAST; restricting to `r`/`m` avoids double-counting).
- [ ] **Step 3:** Handler with temporary `@MessagePattern` literal → `gen:rpc-contract` → replace with `StorageUsage.measureDb.pattern`.
- [ ] **Step 4:** Type-check. Manual: call RPC for T02 on local, compare with `SELECT pg_size_pretty(...)` in psql.
- [ ] **Step 5:** Commit.

### Task 4: Gateway — StorageQuotaService + internal measure endpoint + team email

**Files:**
- Create: `GW/storage-quota/storage-quota.module.ts`
- Create: `GW/storage-quota/storage-quota.service.ts`
- Create: `GW/storage-quota/storage-step.ts` (pure functions)
- Create: `GW/storage-quota/storage-quota-internal.controller.ts` (`api/internal/storage`, `InternalJobGuard`, copy `GW/application/gl-jv/gl-jv-internal.controller.ts`)
- Modify: `GW/app.module.ts`

**Interfaces — Produces:**
```ts
// storage-step.ts
export type StorageStep = 20 | 10 | 5 | 3 | 0 | null;   // 0 = full, null = fine
export function computeStep(used: number, quota: number): StorageStep;
export function isBlocking(row: { used_bytes: number; quota_bytes: number; exceeded_at: Date | null },
                           graceDays: number, now: Date): boolean;
export function graceEndsAt(exceededAt: Date, graceDays: number): Date;

// storage-quota.service.ts
export interface StorageKindUsage {
  kind: 'database' | 'attachment';
  used_bytes: number; quota_bytes: number; remaining_pct: number;
  step: StorageStep; exceeded_at: string | null; grace_ends_at: string | null;
  blocking: boolean; flag: string | null; measured_at: string;
}
export interface BuStorageUsage { bu_code: string; exempt: boolean; enforce: boolean; kinds: StorageKindUsage[];
  by_reference_type: { reference_type: string | null; size: number; count: number }[]; }
class StorageQuotaService {
  measure(bu_code: string): Promise<BuStorageUsage>;          // measures + persists + emails
  getUsage(bu_code: string): Promise<BuStorageUsage>;         // reads stored rows only
  resolveBlockingCached(buIds: string[]): Promise<Record<string, ('database'|'attachment')[]>>; // 60 s cache, used by Task 7
}
```
Step rule: remaining = (quota − used)/quota·100; used ≥ quota → 0; ≤3 → 3; ≤5 → 5; ≤10 → 10; ≤20 → 20; else null.

- [ ] **Step 1:** `storage-step.ts` with the three functions above.
- [ ] **Step 2:** `measure()`:
  1. load config `storage_quota` (fallback to registry default) + quota row + BU id;
  2. attachments = `Files.summary` with `exclude_reference_types: BACKSTAGE_REFERENCE_TYPES`; database = `StorageUsage.measureDb`. A failure in one kind writes that row with `flag: 'measure_failed'`, keeps previous `used_bytes`, and does not throw for the other kind;
  3. per kind: `exceeded_at` = keep existing if still full; set `now` if full and `enforce` and was null; null if not full or `enforce` false;
  4. if `step` is more severe than `warned_step` → email `team_emails` (subject `[Carmen] <BU> storage <kind> <n>% remaining` / `... full — blocks on <date>`), then store `warned_step`; if `step` null → reset `warned_step` null;
     if `isBlocking(...)` is true and `blocked_notified_at` is null → email "<BU> storage <kind> is now blocked" and set it; not blocking → reset to null;
  5. upsert rows, invalidate the 60 s cache for that BU.
  Use whatever path the gateway already uses to send platform email via micro-notification (find how password-reset / invitation emails are sent and reuse it).
- [ ] **Step 3:** Internal controller `POST api/internal/storage/measure` body `{ bu_code }` → `measure()`; and `GET api/internal/storage/bu-codes` → active BU codes (for the cron).
- [ ] **Step 4:** Type-check + lint. Manual: `curl -X POST -H 'x-internal-token: …' localhost:4000/api/internal/storage/measure -d '{"bu_code":"T02"}'` → JSON with two kinds, numeric bytes; rows present in DB.
- [ ] **Step 5:** Commit.

### Task 5: micro-cronjobs — nightly `storage_measure` job

**Files:**
- Create: `micro-cronjobs/internal/executor/storage_measure.go` (copy shape of `gl_run_due.go`)
- Modify: `micro-cronjobs/internal/executor/executor.go` (`dispatch` switch + constructor wiring)
- Create: migration/seed for the job row (follow how `gl_run_due` job row is created), cron `0 2 * * *` Asia/Bangkok

**Interfaces:**
- Consumes: Task 4 `POST /api/internal/storage/measure`, `GET /api/internal/storage/bu-codes`.
- Produces: job type `"storage_measure"`.

- [ ] **Step 1:** Executor: fetch BU codes, loop sequentially, one failure is logged and the loop continues; return aggregated error count only after all BUs.
- [ ] **Step 2:** Wire in `dispatch` as `case "storage_measure"`.
- [ ] **Step 3:** `go build ./... && go vet ./...`. Manual: run once against local gateway, check rows for every BU.
- [ ] **Step 4:** Commit.

### Task 6: Backstage — quota editing, usage view, config

**Files (BE):**
- Create: `GW/storage-quota/storage-quota-system.controller.ts` (`api-system/...`, backstage permission guard like other `api-system` license endpoints)
  - `GET api-system/business-units/:id/storage-quota` → quota row + `BuStorageUsage`
  - `PUT api-system/business-units/:id/storage-quota` body `{ db_quota_bytes?: number|null; file_quota_bytes?: number|null; exempt?: boolean; note?: string }`
  - `POST api-system/business-units/:id/storage-quota/measure`
  - `GET api-system/storage-usage` → all BUs sorted by max(used/quota) desc
- Add the new permission key(s) per `check.backstage-permission-drift.ts` conventions.

**Files (carmen-backstage):**
- Create: `src/pages/clusterAdmin/businessUnitForm/BuStorageQuotaCard.tsx` (pattern: `BuSeatLicensesCard.tsx`, reuse `SeatMeter.tsx` look for two bars)
- Modify: `src/pages/BusinessUnitEdit.tsx` (~207, `licenses` tab: add card)
- Create: `src/pages/licenses/StorageUsageList.tsx` + route/menu entry
- Backstage Config page picks up `storage_quota` from the registry; add its card fields (defaults in GB, team emails, enforce switch, grace days).

- [ ] **Step 1:** BE endpoints + permission keys. Type-check.
- [ ] **Step 2:** `BuStorageQuotaCard`: two bars (used / quota / %), flag badge, exempt toggle, quota inputs in GB (null = "default 5 GB"/"default 15 GB"), "Measure now" button.
- [ ] **Step 3:** `StorageUsageList` page + config card.
- [ ] **Step 4:** Type-check + lint both repos. Manual (browser): set T02 file quota to 1 GB, Measure now, bar shows > 100 %, row shows `exceeded_at` empty (enforce off).
- [ ] **Step 5:** Commit.

**Phase 1 ships here.** Deploy: migration → micro-file → BE → cron job → backstage. Team reviews the list and sets quotas.

---

## Phase 2 — Enforce

### Task 7: Gateway — growth block in `LicenseInterceptor`

**Files:**
- Create: `GW/storage-quota/storage-growth-routes.ts`
- Modify: `GW/license/license.interceptor.ts:50-60` (new check **before** `if (!match) return next.handle()` — storage applies to all BU routes, not only license-mapped ones)
- Modify: `GW/license/license.types.ts:131` (`LicenseErrorCode` += `'STORAGE_QUOTA_EXCEEDED'`)
- Modify: `packages/error-catalog` (add `STORAGE_QUOTA_EXCEEDED`, th + en)

**Interfaces:**
- Consumes: `StorageQuotaService.resolveBlockingCached` (Task 4).
- Produces: `export function isStorageGrowthRequest(method: string, url: string, contentType: string | undefined): boolean;`
  `export const STORAGE_GROWTH_ROUTES: readonly { method: 'POST' | 'PUT'; pattern: RegExp; label: string }[];`
- 403 body: `{ code: 'STORAGE_QUOTA_EXCEEDED', kinds: ('database'|'attachment')[], bu_codes, bu_names }`.

- [ ] **Step 1:** `isStorageGrowthRequest`: false for anything not under `^/api/(config/)?[^/]+/` or under `/api/internal/`; true if method ∈ POST/PUT/PATCH and `content-type` starts with `multipart/form-data`; true if `(method, url)` matches `STORAGE_GROWTH_ROUTES`; else false.
- [ ] **Step 2:** Build `STORAGE_GROWTH_ROUTES`: walk every gateway controller under `GW/application/**` and `GW/config/**` and list each `@Post`/`@Put` that **creates a new top-level record** (PR, PO, GRN, SR, products, vendors, recipes, comments, …). Exclude action endpoints (`approve`, `reject`, `submit`, `void`, `cancel`, `post`, `commit`, `review`, `send`, search/list-as-POST, dry-run, bulk delete). Put a `label` on each. **Stop and hand the list to the user for review before Task 7 merges.**
- [ ] **Step 3:** In the interceptor: if `isStorageGrowthRequest` and `buDatas` non-empty → `resolveBlockingCached` (try/catch → fail open + log) → throw `ForbiddenException` with the body above when any BU blocks. Inside `resolveBlockingCached`: enforce off ⇒ empty result; skip BUs with `exempt = true` or any usage row `flag` in (`shared_schema`, `null_schema`); `measure_failed` uses the previous stored bytes. Do not touch the existing `isWrite` seat/bu-quota logic.
- [ ] **Step 4:** Type-check + lint + run existing `license.interceptor.spec.ts` (must still pass). Manual on local with T02 forced blocked (quota 1 GB, enforce on, `exceeded_at` back-dated 8 days in SQL): Review Focus #2 checks.
- [ ] **Step 5:** Commit.

### Task 8: Gateway BU endpoints + FE banner, page, dialog

**Files (BE):**
- Create: `GW/storage-quota/storage-quota.controller.ts`:
  - `GET api/:bu_code/storage-usage` — `AppIdGuard('storageUsage.get')`, any BU user (banner needs it) → `BuStorageUsage` minus `by_reference_type` unless caller has `system_admin.view`
  - `POST api/:bu_code/storage-usage/measure` — `AppIdGuard('storageUsage.measure')`, `system_admin.view`; 429 if last `measured_at` < 10 min ago

**Files (FE, carmen-frontend):**
- Modify: `constant/api-endpoints.ts` (`STORAGE_USAGE`, `STORAGE_USAGE_MEASURE`)
- Create: `hooks/use-storage-usage.ts` (cross-cutting: banner + page) — TanStack Query, `staleTime` 5 min, refetch on window focus
- Create: `components/storage-quota-banner.tsx` (`StorageQuotaBannerHost`, pattern `components/seat-quota-banner.tsx`)
- Modify: `routes/root-layout.tsx:55` (mount after `<SeatQuotaBannerHost />`)
- Create: `routes/system-admin/storage/storage.route.tsx` + `storage-usage-card.tsx`
- Modify: `routes/router.tsx` (system-admin children), `constant/module-list.ts` (~908: leaf `storage`, `licenseFeature: "system_admin.document"`, `permission: PERMISSIONS.system_admin.view`, icon `HardDrive`)
- Modify: `lib/api-error.ts:183` (`STORAGE_QUOTA_EXCEEDED`), `lib/http-client.ts:313` (→ reason `"storage"`, pass `kinds`), `components/permission-denied-dialog.tsx:32` (`DeniedReason` += `"storage"`)
- Modify: `messages/th.json`, `messages/en.json`

**Interfaces:**
- Consumes: `BuStorageUsage` shape (Task 4) — mirror as `types/storage-usage.ts`.
- Produces: `useStorageUsage(): { data?: BuStorageUsage; isLoading: boolean }`, `useMeasureStorage(): UseMutationResult`.

Banner rules (only when `enforce` is true):
- any kind `blocking` or `step === 0` → red, everyone, not dismissible: grace → "พื้นที่<kind>เต็มโควตา · จะหยุดการสร้างเอกสารใหม่และแนบไฟล์ในอีก N วัน (วันที่)"; blocking → "…หยุดการสร้างเอกสารใหม่และแนบไฟล์แล้ว"; database adds "ติดต่อทีม Carmen", attachments adds "ลบไฟล์ที่ไม่ใช้" + link to `/system-admin/storage`.
- else highest step 20/10/5/3 → yellow, only `system_admin.view` users, dismissible; dismissal key `storage-banner:<bu>:<kind>:<step>` in localStorage (try/catch).
Dialog `"storage"`: title "สร้างเอกสารใหม่หรือแนบไฟล์ไม่ได้ — พื้นที่เก็บข้อมูลเต็ม", body "ดูและแก้ไขเอกสารเดิมได้ตามปกติ กรุณาติดต่อผู้ดูแลระบบของคุณ".
Page: two bars, `measured_at`, "วัดใหม่" button (disabled + tooltip on 429), attachments breakdown table, link to `/system-admin/document`.

- [ ] **Step 1:** BE controller; type-check; **add `storageUsage.get` and `storageUsage.measure` to the app allowlist on dev** (ask the user — shared DB) and curl both with the inventory `x-app-id` → 200.
- [ ] **Step 2:** FE types + endpoints + hook.
- [ ] **Step 3:** Banner host + mount.
- [ ] **Step 4:** Storage page + route + menu leaf.
- [ ] **Step 5:** Error code → dialog wiring + i18n.
- [ ] **Step 6:** `bun run typecheck && bun run lint && bun test:run` (existing suites incl. `module-list.*.test.ts`, `type-ladder`, `status-ink-contrast` must pass). Manual (browser, both themes): Review Focus #1, #3, #5.
- [ ] **Step 7:** Commit.

Deploy: BE → allowlist on every env → FE → team flips `storage_quota.enforce`.

---

## Phase 3 — Database reclaim

### Task 9: `VACUUM FULL` reclaim from backstage

**Files:**
- Modify: `apps/micro-business/src/storage-usage/storage-usage.service.ts` (+ controller, regen rpc-contract)
- Modify: `GW/storage-quota/storage-quota-system.controller.ts` (`POST api-system/business-units/:id/storage-quota/reclaim`, `GET .../reclaim`)
- Modify: backstage schema — add `tb_storage_reclaim_job { id, bu_id, status: 'queued'|'running'|'done'|'failed', started_at, finished_at, bytes_before, bytes_after, error, created_by_id }` + migration
- Modify: `carmen-backstage/.../BuStorageQuotaCard.tsx` (button + confirm + status)

**Interfaces — Produces:** RPC `StorageUsage.reclaimDb { bu_code, job_id }` (returns immediately, runs in background); `GET .../reclaim` → latest job row.

- [ ] **Step 1:** micro-business: refuse if another job is `running` on the same pool (one per pool); refuse if BU `flag` is `shared_schema`/`null_schema`. Loop the schema's tables (`relkind='r'`) and run `VACUUM FULL <quoteIdent(schema)>.<quoteIdent(table)>` one at a time on a dedicated connection (VACUUM cannot run inside a transaction). Update job row; on finish call gateway measure for that BU (or return bytes_after and let gateway re-measure).
- [ ] **Step 2:** Gateway endpoints + backstage permission key.
- [ ] **Step 3:** Backstage button "Reclaim space" → confirm dialog text: "VACUUM FULL จะล็อกตารางของ BU นี้ระหว่างทำงาน ผู้ใช้ของ BU จะใช้งานไม่ได้ชั่วคราว และต้องมีพื้นที่ดิสก์ว่างเท่ากับตารางที่ใหญ่ที่สุด แนะนำให้ทำนอกเวลาทำงาน"; show status + before/after size.
- [ ] **Step 4:** Type-check + lint. Manual on **local DB only**: bloat a T02 table (insert + delete 100k rows), measure, reclaim, measure → bytes drop.
- [ ] **Step 5:** Commit.
