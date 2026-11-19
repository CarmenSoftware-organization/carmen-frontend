# Current Carmen Blue conventions

Use the current source to resolve stale plans. Read only the recipe needed for
the page in `.agents/skills/carmen-blue-ui-design/` (`forms.md`, `lists.md`, `landing.md`,
`tables.md`, `bars.md`); keep new layout
gotchas in the relevant recipe rather than growing the skill entrypoint.

## Layout and forms

- Full available width, compact sections, no empty heading column or page-level
  max-width. Wider boxes add field columns rather than stretching inputs.
- Use container queries for fields, cards and bars; an ancestor must establish
  `@container`. Use `useElementWidth` for TanStack column state/sizes.
- `LookupCombobox` fills the available field/cell width by default. Keep explicit
  `w-fit`/fixed widths for compact inline controls; use `flex-1 min-w-0` when a
  lookup shares a row with action buttons. Do not patch widths separately in
  each page. `bun run test:ui` measures the real shared control in Chrome;
  the full `bun test:run` suite includes this browser gate.
- Reuse `CompactSection`, `FieldGrid`, `SECTION_PAIR`, `SettingField` and the page
  shell. Paired sections start at 1700px, align at both edges and have equal
  heights; avoid `items-start` on framed cards. Long descriptions go inside.
- View mode shows plain values; editing shows controls. Exceptions: Role detail
  intentionally retains the full resource/action permission matrix and its
  Granted/Missing filters. User assigned roles show only the roles held.
- Pattern settings show a real formatted example first and the pattern second.
- `DocFormHeader` is the named `doc-header` container. Secondary `FormToolbar`
  labels use `ToolbarLabel` and `title`; below 576px they become icon-only while
  Edit/Save retains its label. Do not replace those actions with a More menu.
  A crowded title/badge group may opt into `titleClassName` to place actions on
  their own row; do not change every document header to fix one page.
- Accounting documents retain their frameless shell and sticky totals; read
  `.agents/skills/accounting-detail-shell/SKILL.md` for action placement.
- A query-backed form that stays editable after Save must update query cache
  before invalidation and preserve dirty values during refetch. A form returning
  to view mode must wait for fresh data/version before enabling the next edit.
  See `useUpdateProfile` and `useUpdateBusinessUnit` for the two patterns.

## Lists, tables and status

- Use `ListPageShell` and `ListToolbar`; Search, View and Filter stay together
  on the left. Sort, columns and display controls belong on the right.
- `useIsMobile` forces cards below 768px. `DisplayModeToggle` hides below the
  same breakpoint; do not add `sm:flex` at call sites or overwrite the user's
  desktop preference when resizing. Document's third preview mode uses it too.
- For a few short columns, give columns fixed sizes and one grow column: long
  description/name when present, otherwise the last data column. No empty
  trailing spacer column. Do not apply fixed grow widths to an editable grid
  without measuring its minimum width.
- Count every TanStack column, including an unrendered 55px selection column.
  The 768px reference layout has about 662px available, or 607px for visible
  columns when that hidden selection column exists. These are reference budgets,
  not universal box widths; measure with the sidebar both open and collapsed.
- CSS-hidden columns still count in `getTotalSize()`. Use table visibility or
  width-dependent column sets, retaining user column preferences. Set each
  threshold above the corresponding size sum; keep hidden data accessible.
- Detail tables can use row cards when the measured box is too narrow; the
  threshold depends on the table (Vendor certificates 560px, Product locations
  760px). Editable inline grids may need horizontal scrolling instead.
- DataGrid row highlighting is on by default and is separate from checkbox
  selection. Do not use a highlighted row as a bulk-action selection.
- Status everywhere (table, card, header): neutral chip, one colored dot,
  sentence-case label, size `sm` (22px), left-aligned. Use `StatusBadge` for
  active/inactive, `StatusChip` for document status, `StatusDotBadge` for semantic
  state. `StatusIconLabel` is for document type/dropdown options, not progress.
- Status text uses `*-ink`; status fills use plain tokens. Keep type sizes on the
  ladder and never declare t-shirt spacing tokens such as `--spacing-md`.
- Category tree actions sit at the card's right edge; row highlight ties them
  to the selected name. Keep the header and row flex columns identical.

## Landing pages, dashboards and shell

- Landing cards come from actual menu destinations and `useVisibleModules`,
  including nested permissions. Descriptions match the destination's header.
  No invented counts, versions, names or nonfunctional buttons. Entire cards
  open their destination; hidden groups disappear and numbering stays contiguous.
- Unequal-height landing groups use CSS multi-column with a column ceiling;
  equal-height form cards use grids. Illustrations use lines rather than fake
  business records. Preserve a user's widget order and configured size instead
  of filling dashboard gaps with dense placement.
- Dashboard widget grids and skeleton spans follow box width (6 columns from
  38rem, 12 from 64rem) with a container ancestor. Check KPI content clipping.
- Module-less pages use `findActiveModule` consistently for sidebar presence
  and navigation. Register their full breadcrumb paths to avoid name collisions.
- Catch-all 404 is inside `ProtectedShell`; links lead to an accessible module.
  Dashboard Dataset's page was removed; dataset hooks remain in use by widgets.

## Module boundaries that changed

- Storage lives on `/system-admin/document`; `/system-admin/storage` redirects.
  Measured quotas and live file totals can differ. Keep their timestamps and
  independent loading/failure behavior; reset measure-button state by BU.
- Inventory Period is read-only. Closing a period fills open+locked periods to
  12 in the backend transaction. Keep initial generation; do not restore manual
  date editing or implement a second frontend auto-generation request.
- Interfaces use per-brand config and plain-text read mode. Read
  `routes/system-admin/interface/CLAUDE.md`; the list loads individual keys.
  Incoming API secrets stay out of query cache/storage/logs, and Scalar keeps
  telemetry disabled. Do not infer entitlement failures are layout failures.
- AP Invoice/Payment use the HTTP repository (`ap-invoice`, `ap-payment`), not
  old prototype endpoints. Compare gateway request schemas, response serializers,
  repository mapping and form payloads before calling a field missing. Some old
  design/readiness documents still describe mocks or proposed endpoints. Current
  Drive FRD links and unsupported contracts are in
  `docs/accounting/ap-api-deferred-fields.md`; use the FRDs for business rules
  and the owning backend schemas for writable fields.
- AP Payment currently uses a payment-method enum and real Tax Profile metadata
  (PND enum, income-type text). Config Payment Type, WHT Form and WHT Service
  Type use the live BU-scoped master APIs, including GL mapping, bank/cheque
  lookups, dependency checks and versioned updates/deletes. Master dimension
  references use `gl_dimension_id` / `gl_dimension_value_id` at the API boundary.
  Master IDs are not yet wired into AP/AR document writers; master CRUD does not
  prove document integration.
- Tax Profile config edits only name, tax rate and active status. API read types
  retain VAT/WHT metadata for existing AP lookups; do not restore the removed
  `TAX_PROFILE_TYPES` / `WHT_PND_FORMS` runtime option arrays or WHT config fields
  without a new documented requirement.

## Verification

Use real viewport overrides and read-only DOM measurements. Check 390, 768,
1366, 1920 and 3840; include 640/767 around the list switch and 820/1024/1180/1280
for intermediate table/header failures. Reset viewport overrides afterward.
Verify sidebar states, visible highlights, real clicks, loading/empty/error,
Thai/English and both themes where relevant. A permission simulation does not
prove a real non-admin flow. Use existing reversible test data for Save/reload;
do not post accounting entries or close periods merely to inspect layout.
Run typecheck, relevant tests/lint/build and React Doctor for React changes.
Report exactly which runtime states were not exercised.
