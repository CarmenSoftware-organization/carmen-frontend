---
name: add-list-audit-columns
description: Use when adding Created/Updated (audit) columns — timestamp + author name, with sortable headers — to a module's list table (and grid card / Excel export) in carmen-frontend, e.g. "add created and updated columns with sort" to a vendor-management / procurement / config / operation-plan list page.
---

# Add Created/Updated audit columns to a list page

## Overview

The backend gateway already collapses `created_at`/`created_by_id` (+ updated) into a nested
`audit: { created: {at,id,name}, updated: {...} }` object on list responses, via the
`@EnrichAuditUsers()` controller decorator. So adding Created/Updated columns is **frontend-only**
whenever that decorator is present — reuse the shared `AuditCell` component. Sort is **server-side**
and works out of the box because the column's TanStack `id` is sent verbatim as `sort=<id>:asc|desc`
and the generic Prisma `orderBy` accepts any real column.

Shipped 5×: vendor (PR #64), price-list (#63), price-list-template, request-for-pricing (#65),
purchase-request (#67). The two columns are **hidden by default** and opt-in via the Toggle Columns
menu (see step 1b) — do NOT ship them visible-by-default.

## When to use

- Adding sortable **Created** / **Updated** columns (date-time + author) to a module list table
- Optionally: an "Updated" line on the grid/mobile card, and Created/Updated in the Excel export
- **NOT** when the module's gateway `findAll` lacks `@EnrichAuditUsers()` — then it needs a backend
  change first (out of scope for this skill; stop and flag it)

## Step 0 — Backend precondition (decides frontend-only vs needs-backend)

Verify ONCE in `carmen-turborepo-backend`. If all hold → frontend-only. If the decorator is
missing → the list response has NO `audit`; a backend change is required first (escalate).

- Gateway controller `findAll` for the module has `@EnrichAuditUsers()`
  (grep `apps/backend-gateway/src/**/<module>*.controller.ts`).
- The entity's table has `created_at`/`created_by_id`/`updated_at`/`updated_by_id`
  (real columns → sort works via the generic `order_by` helper; nothing to allowlist).

Enrichment is entity-agnostic (`common/enrichment/audit-shape.ts`) — you do NOT edit the backend
when the decorator is already there.

## Files you touch (frontend only)

| File | Change |
|---|---|
| `types/<module>.ts` | add `audit?: Audit` (import from `@/types/audit`) — see the type-mismatch gotcha |
| `routes/<section>/<module>/use-<x>-table.tsx` | two sortable columns via shared `AuditCell` |
| `routes/<section>/<module>/<x>-card.tsx` | (grid/mobile) an "Updated" line — else mobile users lose the feature |
| `routes/<section>/<module>/<x>-component.tsx` | (optional) Created/Updated in the xlsx export |

i18n keys `field.created` / `field.updated` **already exist** in `messages/{en,th}.json` — do NOT add keys.

## Recipe

### 1. Table columns (the invariant core — copy verbatim)

In the table hook: `import { AuditCell } from "@/components/share/audit-cell";` and pull
`const { dateTimeFormat } = useProfile();`. Append these two columns:

```tsx
{
  // id = the backend column name so sort sends sort=created_at:asc|desc — do NOT use "audit.created.at"
  id: "created_at",
  accessorFn: (row) => row.audit?.created?.at ?? "",
  header: ({ column }) => (
    <DataGridColumnHeader column={column} title={tfl("created")} />
  ),
  cell: ({ row }) => (
    <AuditCell entry={row.original.audit?.created} dateTimeFormat={dateTimeFormat} />
  ),
  size: 160,
  meta: { headerTitle: tfl("created"), skeleton: columnSkeletons.text },
},
{
  id: "updated_at",
  accessorFn: (row) => row.audit?.updated?.at ?? "",
  header: ({ column }) => (
    <DataGridColumnHeader column={column} title={tfl("updated")} />
  ),
  cell: ({ row }) => (
    <AuditCell entry={row.original.audit?.updated} dateTimeFormat={dateTimeFormat} />
  ),
  size: 160,
  meta: { headerTitle: tfl("updated"), skeleton: columnSkeletons.text },
},
```

Placement depends on how the hook builds its table:
- **`useConfigTable(..., { hideStatus: true })`** (e.g. vendor, rfp): append after your last data
  column; `useConfigTable` injects the action column last. If the module has a Status column, place
  `statusColumn<T>()` *before* created/updated (keep `hideStatus: true`) → `... → status → created → updated → actions`.
- **raw `useReactTable`** (e.g. price-list): put the two entries in the `dataColumns` array before
  the `actionColumn`.

`AuditCell` renders the BU-formatted date-time on top and the author name below; it shows `—` when
`entry?.at` is missing, so unguarded rows never crash.

### 1b. Hide the audit columns by default (REQUIRED)

Created/Updated ship **hidden by default** and opt-in via the **Toggle Columns** menu — else they
crowd the row on first load. Seed `columnVisibility` keyed by the two column **`id`s** (`created_at` /
`updated_at` — the same strings you set as `id:` above, NOT `accessorKey`):

- **raw `useReactTable`** (pr, price-list, price-list-template): add `initialState` to the call.
  It coexists with the controlled `state` from `...tableConfig` (which owns only pagination+sorting),
  so `columnVisibility` stays uncontrolled and the Toggle Columns menu can flip it:

  ```tsx
  return useReactTable({
    data,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    initialState: { columnVisibility: { created_at: false, updated_at: false } },
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
  ```

- **`useConfigTable`** (vendor, rfp): pass the same object as the `initialState` prop — the hook
  forwards it to `useReactTable` (added for this; `initialState?: InitialTableState` in its options):

  ```tsx
  return useConfigTable<T>({
    data, columns, totalRecords, params, tableConfig, onDelete, hideStatus: true,
    initialState: { columnVisibility: { created_at: false, updated_at: false } },
  });
  ```

The hidden columns still appear in `DataGridColumnVisibility` (it lists `getAllColumns()`, not just
visible ones), so users switch them on from the menu. This relies on each column having an
`accessorFn` **and** `meta.headerTitle` — both are already in the step-1 snippet, so the menu shows
"Created" / "Updated" and the toggle works.

### 2. Grid/mobile card — Updated line (mirror the sibling `<x>-card.tsx`)

Add a bottom row, guarded on `item.audit?.updated?.at`, using `formatDate(item.audit.updated.at,
dateTimeFormat)` (both from `useProfile()` + `@/lib/date-utils`) and a `Clock` icon. Match the
card's own existing row markup (config cards differ from vendor/pl cards) — don't blind-copy another
module's wrapper. Default is **Updated only**, not both.

### 3. Excel export (optional) — date only, no author

In the component's `handleExport` columns array, pull `dateTimeFormat` from `useProfile()` and append:

```tsx
{ header: tfl("created"), value: (r) => r.audit?.created?.at ? formatDate(r.audit.created.at, dateTimeFormat) : "", width: 18 },
{ header: tfl("updated"), value: (r) => r.audit?.updated?.at ? formatDate(r.audit.updated.at, dateTimeFormat) : "", width: 18 },
```

## Verify

```bash
bunx tsc --noEmit          # 0 errors
bun test:run               # existing suite stays green (skip writing new tests per project rule)
```

Then browser (local backend on :4000 — a shared dev DB, read-only here so safe):
- both columns are **hidden on first load**; open **Toggle Columns** → "Created"/"Updated" appear
  unchecked; tick one → the column renders (date-time + author name; `—` when absent)
- click each header asc→desc; Network shows `GET …?…&sort=created_at:asc|desc` / `sort=updated_at:…` → 200
- grid/mobile card shows the "Updated" line; Export (if done) has the two date columns; no console errors

## Gotchas

- **Type mismatch — the flat fields are a lie.** The gateway serializer `.omit()`s the raw
  `created_at`/`updated_at`/`*_by_id` and `.extend({ audit })`, so the **list** response has NO flat
  `created_at`/`updated_at` — only `audit`. If the module's TS type declares `created_at: string`
  and nothing else in the frontend reads it, **remove** the flat fields and add `audit?: Audit`
  (rfp did this). Only **keep** them (adding `audit?` alongside) if you grep and find another file
  actually uses `<Type>.created_at` (vendor's case). Don't copy another module's keep/remove choice —
  grep the target module's usages and decide.
- **Sort `id` must be the backend column name.** `id: "created_at"` / `"updated_at"`, NOT
  `"audit.created.at"` or `"createdAt"`. A wrong id silently no-ops the sort (Prisma `orderBy` has no
  allowlist to error on a typo).
- **Removing flat type fields breaks typed test fixtures.** If you remove `created_at`/`updated_at`
  from the type, any mock that's a typed literal (`const x: <Type> = {…}` / `<Type>[]`) still setting
  those fields fails `tsc` via the excess-property check. Grep the module's `__tests__` (and any
  `mock<Type>` fixture) for the removed fields and drop them from the mocks in the same change.
- **Don't skip the card.** Config/vendor list pages swap the table for a card in grid/mobile mode; if
  you only touch the table hook, mobile users see nothing and tsc/tests stay green — a silent half-feature.
- **`statusColumn` + `hideStatus`.** When placing an explicit `statusColumn<T>()`, keep
  `hideStatus: true` on `useConfigTable` or Status renders twice.
- **Author name needs `dateTimeFormat`, not `dateFormat`.** `AuditCell` takes `dateTimeFormat`
  (date+time); the period/effective-date columns use `dateFormat`. A hook may already destructure only
  `dateFormat` — add `dateTimeFormat`.
- **`columnVisibility` key = the column `id`, not `accessorKey`.** Hide-by-default (step 1b) keys on
  `created_at` / `updated_at` — the exact `id:` strings. A typo (e.g. `createdAt`) silently no-ops the
  hide and the column shows up anyway; tsc won't catch it (`columnVisibility` is `Record<string,bool>`).
  Verify in the browser that both are hidden on first load, not just that tsc passes.
- **Don't seed `columnVisibility` via controlled `state`.** Put it in `initialState` (uncontrolled).
  `useDataGridState`'s `tableConfig.state` controls only pagination+sorting; adding `columnVisibility`
  to a controlled `state` would freeze the Toggle Columns menu (clicks wouldn't stick).

## Reference

Full designs & the exact per-module diffs:
`docs/superpowers/specs/2026-07-24-{vendor,price-list,price-list-template,rfp}-created-updated-columns-design.md`
and the matching plans in `docs/superpowers/plans/`. Shared bits: `components/share/audit-cell.tsx`,
`types/audit.ts` (`Audit` = `{ created?, updated?, deleted? }`, each `AuditEntry = { at, id, name }`).
