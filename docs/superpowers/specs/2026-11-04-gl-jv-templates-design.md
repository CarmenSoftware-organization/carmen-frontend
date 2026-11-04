# GL JV Templates — Template / Recurring / Allocation Voucher pages on the real API

Date: 2026-11-04 · Repo: carmen-frontend (FE only — backend API already exists)

## Intent

`/accounting/template-voucher`, `/accounting/recurring-voucher` and
`/accounting/allocation-voucher` (plus their `/:id` detail routes) look like working
screens but render **fabricated data**: `routes/accounting/documents/accounting-document-list.tsx`
lists 8 rows from `documentsFor()` and `accounting-document-detail.tsx` (3,135 lines) edits
local state only. The backend already serves the real thing — `gl-jv-templates`
(`tb_gl_jv_template`), with three template types — and nothing in the FE calls it.

The user wants these pages to be real: list pages in the same style as the PO / Journal
Voucher lists (PR #490), and detail pages that create, edit, delete and **generate JVs**
from templates.

Success = an accountant can set up a recurring, allocation or amortize template, and on
period close press one button to generate every due JV, see what was created, and jump to
the templates that failed to fix them.

## Page semantics (decided by the user)

| Route | Shows | Can create |
|---|---|---|
| `/accounting/template-voucher` | **all** template types, with a Type filter | recurring, allocation, **amortize** (only home for amortize) |
| `/accounting/recurring-voucher` | `template_type = recurring` | recurring |
| `/accounting/allocation-voucher` | `template_type = allocation` | allocation |

Detail URLs stay under the page the user came from (`/accounting/recurring-voucher/:id`
etc.); a template opened from the all-types page uses `/accounting/template-voucher/:id`.

## Backend contract (verified in carmen-turborepo-backend, not to be changed)

Gateway `backend-gateway/src/application/gl-jv-templates/gl-jv-templates.controller.ts`,
base `/api/:bu_code/gl-jv-templates` (`API_ENDPOINTS.GL_JV_TEMPLATES`):

| Method / path | api_name | Notes |
|---|---|---|
| `GET /` | `gl-jv-templates.findAll` | shared `PaginateQuery`: `page`, `perpage`, `search` (code, name), `filter`, `sort` (default `code:asc`). Headers only, no lines |
| `GET /:id` | `.findOne` | header + `tb_gl_jv_template_detail[]` |
| `POST /` | `.create` | header + `details.add` (≥ 1 line) |
| `PATCH /:id` | `.update` | partial header, `doc_version` required; if `details` is sent, `details.add` **replaces all lines** |
| `DELETE /:id` | `.delete` | soft delete; **no check** for runs / generated JVs |
| `POST /:id/generate` | `.generate` | body `{gl_period_id}` → `{jv_id, jv_no, gl_period_id, amount_total}`; one JV for one period |
| `POST /generate-all-due` | `.generateAllDue` | body `{gl_period_id}` → `{generated[], skipped[{reason: already_run\|not_due}], failed[{code}]}`; one transaction per active template, keeps going on failure |

Header fields: `id, doc_version, template_type, code (≤50, unique), name, description,
is_active, prefix_id, from_fiscal_year, from_period_no, to_fiscal_year, to_period_no,
frequency_months, currency_id, exchange_rate, allocate_amount, allocate_unit,
amortize_type (day_in_month|monthly), start_date, end_date, total_amount, dimension, note,
info` + audit. Line fields: `id, sequence_no, chart_of_accounts_id, cost_center_id,
description, debit, credit, side (debit|credit), allocation_ratio, currency_id,
exchange_rate, dimension`.

Validation the backend enforces (FE should pre-validate the same rules so the user sees
them before saving):

- all: period no 1–12, years 1900–2200, from ≤ to, ≥ 1 line, unique `sequence_no`,
  active prefix, unique code, existing COA / cost centers
- **recurring**: `frequency_months ≥ 1`; each line exactly one of debit/credit > 0;
  Σdebit = Σcredit (`GL_JV_TEMPLATE_NOT_BALANCED`)
- **allocation**: `allocate_amount > 0`; every line has `side` + `allocation_ratio > 0`;
  ≥ 1 debit and ≥ 1 credit line; ratios per side sum to exactly 1
  (`GL_JV_TEMPLATE_RATIO_NOT_ONE`)
- **amortize**: `amortize_type`, `start_date`, `end_date ≥ start_date`, `total_amount > 0`;
  exactly 2 lines, one debit side and one credit side

Generate rejects: inactive template, period not open, period outside from..to
(`GL_JV_TEMPLATE_PERIOD_OUT_OF_RANGE`), not due (`GL_JV_TEMPLATE_NOT_DUE`), already run for
that period (`GL_JV_TEMPLATE_ALREADY_RUN`), amortize periods missing
(`PERIODS_INCOMPLETE`). Generated JVs are created as **draft** with `source` = template
type, `jv_date` = period start, description = template name.

## Goals

1. **List pages** — one shared list component parameterised by type, built exactly like
   `routes/accounting/journal-voucher/journal-voucher-list.tsx` (PR #490): `ListPageShell`
   + `ListToolbar` (search, filters, saved views, sort, column toggle, list/grid, refresh),
   URL state via `useDataGridState` + `useListFilters`, server pagination/sort, count,
   Excel export, loading/empty/error, `useGridPagination` cards on mobile, row + card
   delete with `DeleteDialog`.
   - Columns: Code (link), Name, Type (all-types page only), Period range
     (`from_fiscal_year/from_period_no – to…`), type-specific amount (recurring: — ·
     allocation: `allocate_amount` · amortize: `total_amount`), Frequency (recurring),
     Active.
   - Filters: Type (all-types page only), Active / Inactive. Each type page always sends
     its `template_type` clause, merged with the user's filters.
   - Each list gets its own `LIST_PAGE_KEYS` entry (saved views must not leak across pages).
2. **Detail page** — new, replaces the mock for these three kinds. Modes add / view / edit
   like other document forms (`FormPageShell` / form toolbar conventions used by the JV
   detail). Header: code, name, description, prefix (`GL_JV_PREFIXES`), period range,
   currency + rate, active toggle, note. Type-specific header fields and line grid:
   - recurring: frequency (months); lines = account, cost center, description, debit,
     credit; live debit/credit totals and balance check
   - allocation: amount to allocate; lines = account, cost center, description, side,
     ratio; live per-side ratio sums (must be 1) and a preview of the allocated amount per
     line
   - amortize: method (`day_in_month` / `monthly`), start / end date, total amount; exactly
     two lines (debit side, credit side) — the grid does not allow adding a third
   - Type is chosen at creation and **immutable** afterwards (backend update can't
     meaningfully change it without replacing lines; keep it read-only in edit).
   - Save sends all lines in `details.add` with `doc_version` (replace semantics).
3. **Generate one** — on the detail page (view mode, template active): "Generate JV"
   opens a dialog with a GL period picker (open periods from `useGlPeriods`); success
   toast with a link to the new JV (`/accounting/journal-voucher/:jv_id`); errors shown
   in readable words.
4. **Generate all due** — button on the list pages' header (all three pages; on a type
   page it still runs **all** due templates, since that's what the endpoint does — label
   it so). Dialog: pick GL period → run → result view in three groups:
   - **Created**: JV number links (open the JV), template name, amount
   - **Skipped**: template name + reason (already run for this period / not due yet)
   - **Failed**: template name linking to the template detail + readable error
   This is the period-close moment the user described: look at what was created, then go
   fix the failing templates (a failed run creates no JV, so the link goes to the
   template).
5. **Remove the mock** for these three kinds: routes point to the new list/detail; drop
   the three kinds from `accounting-document-model.ts` / the mock detail only where nothing
   else depends on them (the mock still serves other kinds such as AR / asset — leave those).
6. i18n en/th for all new text; status/active display with shared tokens (dark-mode safe).

## Access control (decided by the user)

- Backend gates every `gl-jv-templates` route on resource **`accounting.gl.jv_template`**
  (actions view / create / update / delete and a separate **generate**); it is also the
  license feature. Today only `templateVoucher` in `constant/module-list.ts` uses it —
  `recurringVoucher` and `allocationVoucher` use `accounting.gl`, so a BU with GL but
  without the template feature sees the menu and gets 403.
- **Decision:** move all three menu entries to `licenseFeature: "accounting.gl.jv_template"`
  (key already exists, so no seed step). Add a `PERMISSIONS` entry for the resource if
  the FE permission map needs it, and gate create/edit/delete/generate UI on the matching
  actions (see `license-gating` skill: `canWrite` points, `licenseFeature` ≠ permission
  key). Before deploy, confirm the BUs that use these pages have the feature assigned.

## Builder's calls already made (check while reading)

- **Type at creation:** "New" on the all-types page asks for the type first; on the
  recurring / allocation pages the type is preset and locked.
- **Generate dialog** lists only periods with `status === "open"` from `useGlPeriods`
  (`hooks/use-accounting-master.ts`, returns `status: open|closed|locked`).
- **Generate-all-due result:** every entry carries `template_id`
  (`generated{template_id, jv_id, jv_no}`, `skipped{template_id, reason}`,
  `failed{template_id, code}` — gl-jv-template.service.ts ~L875). Template names /
  links are resolved from those ids (one list fetch); failed entries link to the
  template detail under the page the dialog was opened from, falling back to
  `/accounting/template-voucher/:id`.
- **No amortize per-period preview** in v1; allocation shows `allocate_amount × ratio`
  per line.
- **Delete confirm** warns that JVs already generated from the template stay as they are.
- **Generate buttons hidden** without the `generate` permission action.
- **Allowlist** for the 7 api_names is a deploy gate (ops step on each env), not code.

## Non-goals

- Activity sheet, comments, attachments — backend has none for templates
  (`tb_gl_jv_template` not in the activity registry; no comment endpoints).
- Approval workflow on templates — templates have no status; the mock's "inline approval"
  for recurring/allocation goes away.
- Backend changes (e.g. blocking delete of a template that already generated JVs).
- A separate amortize page / menu entry.
- Scheduling generation automatically (cron) — manual buttons only.
- Fixing `JournalVoucherStatus` / JV detail capabilities (separate known issue, see trail
  learning 2026-11-04).

## Anti-goals (would be a failure even if it works)

- Any list or detail still showing fabricated rows for these three pages.
- A failed generate that silently looks like success, or a result view that only shows
  counts without letting the user reach the created JVs / failing templates.
- Saving a template that drops lines (forgetting replace semantics) or overwrites a newer
  version (must send `doc_version` and surface the conflict).
- Saved views or filters from one template page appearing on another.

## Constraints

- Module boundary rules (ESLint): code lives under `routes/accounting/…`; anything shared
  with other modules goes to `hooks/` / `components/` / `lib/` / `types/`.
- New api_names called by FE: `gl-jv-templates.findAll / findOne / create / update /
  delete / generate / generateAllDue`. **Each must be in the app allowlist of every
  environment before the FE deploys** — a missing row returns 401 and logs the user out.
  Merging to `main` auto-deploys dev; verify on dev first.
- Follow the existing list/table pitfalls: memoised columns where `useReactTable` is used
  directly, `"use no memo"` if a table freezes on page change (`routes/CLAUDE.md`),
  `tableLayout.checkbox` only if row selection is wanted.
- Per user preference: no new test files unless asked; typecheck + lint + existing suite
  must pass; manual browser verification on local (`:4000` is the shared dev DB — clean up
  any test templates/JVs created).
- Commit messages in Thai; PR text in English; merge commits, not squash.

## Left to the builder

- Exact component/file split (one list component taking a `templateType | "all"` prop is
  the expected shape); hook location per the "where a hook lives" rule.
- Line-grid implementation — reuse JV detail pieces (account / cost center pickers,
  dimension handling via `journal-line-dimensions.ts`) where they fit.
- Whether per-line `currency_id` / `exchange_rate` / `dimension` are exposed in the first
  version or defaulted from the header (backend accepts them; keep the UI no more complex
  than the JV detail).
- Readable messages for `GL_JV_TEMPLATE_*` error codes (FE has none today).
- How the "Generate all due" result dialog lays out on mobile.
