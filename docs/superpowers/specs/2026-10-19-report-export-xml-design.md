# Report template: Export XML → CSV ("Export data")

Date: 2026-10-19 · Repos: carmen-turborepo-backend-v2, micro-report, carmen-platform, carmen-inventory-frontend-react

## Intent

A report template today carries two XMLs: **Dialog XML** (the filter form) and **Content XML**
(FastReport `.frx` layout). Users can only *view* a report (FastReport viewer URL). They want
the same dataset as a **flat CSV** — one row per record, with columns named and ordered by the
template author. A third XML, **Export XML**, is that mapping: which dataset field (or constant,
or combination of fields) becomes which CSV column, with optional date/number formatting.

The CSV is generated **server-side** because scheduled report emails will later need to attach
the same CSV; the browser button and the future schedule must share one code path.

## Goals

1. carmen-platform `/report-templates/:id/edit` gets an **Export XML** tab (after Content).
   The existing tabs stay: Dialog, Content, Preview (the "Preview Dialog" tab already exists —
   `src/pages/ReportTemplateEdit.tsx:487`, `components/DialogPreview.tsx`; no new work beyond
   keeping it in the strip).
2. New nullable column stores the Export XML; it round-trips through create/update/versions/restore.
3. carmen-inventory-frontend-react `/report/list` filter dialog (`routes/report/list/report-param-dialog.tsx`)
   shows an **"Export data"** button next to "Run report" — **only when the template has an Export XML**.
   Clicking it downloads a `.csv` using the filter values currently in the dialog.
4. micro-report generates the CSV; gateway exposes it.

## Non-goals (this round)

- Scheduled email delivery of the CSV (future — but the endpoint must be callable from that path
  without going through the browser).
- Computed values (`[Qty] * [Price]`), conditionals, summary/total rows, multiple sheets, XLSX output.
- A visual mapping editor — the tab is a raw XML editor.

## Anti-goals

- CSV that Excel opens with garbled Thai (must be UTF-8 **with BOM**).
- Export output diverging from what the report itself shows for the same filters (same dataset
  pipeline, same filter mapping — never a second query path).
- One bad column reference failing the whole export.

## Export XML format (decided with the user)

```xml
<Export FileName="credit_note_detail">
  <Sort Field="LocationCode"/>
  <Sort Field="CnNo" Desc="true"/>
  <Column Header="CN No."   Field="CnNo"/>
  <Column Header="Date"     Field="CnDate" Format="dd/MM/yyyy"/>
  <Column Header="Amount"   Field="Amount" Format="#,##0.00"/>
  <Column Header="Currency" Value="THB"/>
  <Column Header="Vendor"   Expression="[VendorCode] - [VendorName]"/>
</Export>
```

- Column order in CSV = order of `<Column>` elements. Fields not listed are not exported.
- Each `<Column>` has `Header` (required) and **exactly one** value source: `Field` | `Value` | `Expression`.
- **Field names (decided):** dataset row keys in PascalCase (micro-data `executor.go:68` converts
  snake_case → PascalCase), e.g. `CnNo`. Both the bare form `CnNo` **and** the data-source-qualified form
  Content XML uses, `CreditNoteDetail.CnNo`, are accepted (the prefix is stripped), in `Field`, `Sort` and
  `[...]` placeholders. `ADMIN_Bu.Name` resolves to `BuName`.
- `Expression` = literal text with `[FieldName]` placeholders substituted (string concatenation only).
  Unknown placeholder → empty string (platform validator warns).
- **`<Sort>` (decided):** zero or more `<Sort Field="…" Desc="true|false"/>` elements, applied in order
  (first = primary key) before mapping. No `<Sort>` → dataset order. Stable sort; nulls last; numbers compare
  numerically, dates chronologically, otherwise string compare. The report's own `.frx` Sort/Group is **not** parsed.
- `Format` (only with `Field`): .NET-style patterns authors know from FastReport —
  dates: `dd`, `MM`, `yyyy`, `HH`, `mm`, `ss`; numbers: `#,##0`, `#,##0.00`, `0.00` (grouping + fixed decimals).
  *My call:* support exactly this subset; anything else → value emitted unformatted.
- **Default date output (decided):** a date-valued field with no `Format` is emitted as `dd/MM/yyyy` in ICT,
  matching what the report shows.

## Row shaping (decided)

The export uses the same rows the viewer sees **except for date rewriting**:
- Inject the same computed columns `ViewReport` adds after `buildRowsForTemplate` — `GroupBy`, `BuName`
  (self-contained templates), `CalculationMethod` (templates that declare it) — so every field Content XML
  declares is available to Export XML.
- Do **not** apply `normalizeRowDates`; dates stay raw (ISO) into the mapper so `Format` can parse them, and
  the default above produces the report's look. Factor the injection out of `ViewReport` so viewer, export and
  the future schedule share it.
- `FileName` optional; default = template name slug. Download name = `<FileName>_<yyyyMMdd_HHmmss>.csv` (*my call*).

## CSV output (my calls, agreed in conversation)

- UTF-8 with BOM, comma separator, CRLF line endings, RFC 4180 quoting (quote fields containing
  `,` `"` CR/LF; double embedded quotes). Header row always present.
- `null`/missing field → empty cell. Field missing from dataset → empty cell, export continues.
- Zero rows → API returns success with row count 0; FE shows a "no data" toast and does **not** download.

## Architecture

### Storage — backend-v2
- `packages/prisma-shared-schema-platform/prisma/schema.prisma:957` `tb_report_template`:
  add `export_xml String? @db.Text` (*plan-time call: `export_xml`, not `export` — avoids reserved-word friction in TS/Go*). Versions are **not** columns: `tb_report_template_version` stores a JSON
  `snapshot` built from `SNAPSHOT_FIELDS` in `apps/micro-cluster/src/cluster/report-template/report-template-version.ts`
  — add the field there. Restoring a pre-feature version clears Export XML (same as any null field; accepted).
- Migration (platform schema). Nullable, no backfill.
- Zod DTOs `apps/backend-gateway/src/common/dto/report-template/report-template.dto.ts:29,176`,
  micro-cluster `interface/report-template.interface.ts` and `report-template.service.ts`
  create/update/restore mapping (:252-253, :334-335) — add the field everywhere `dialog`/`content` appear.
  Remember gateway `@Serialize` response schemas or GET strips the field (known gotcha).
- `GET api/:bu_code/reports/templates` (the list FE uses) returns **`has_export: boolean`**
  (not the XML itself) so the FE can decide button visibility. This list is served by **micro-report**
  `listFlat` (`micro-report/controller/template_controller.go`) — add the flag there (`templateSelectCols`
  already selects `rt.*`, so only the Go model needs the field).
- micro-report seed (`db/seed/loader.go`, `writer.go`) writes a full-row `Updates` map — **leave `export` out
  of it** so a reseed does not wipe authored Export XML.

### Generation — micro-report (Go)
- `model/template.go`: add the Export field.
- New endpoint `POST /api/:buCode/report/export` body `{template_id, filters}` (same shape as `/report/viewer`).
  Flow: load template → if Export XML empty → 400 `export_not_configured` → build rows via the
  **existing** `buildRowsForTemplate` (`service/report_service.go:527`) with the same filter handling
  as ViewReport/BuildData → inject computed columns (see Row shaping) → parse Export XML → sort → map rows → write CSV.
- Put parse + map + CSV writing in a reusable package/function (e.g. `service/export/`) that takes
  `(exportXml, rows) → []byte`, so the future schedule job calls it directly. Existing
  `service/generator/csv_generator.go` can be reused or extended; it currently only knows
  `Columns[].Label/Key`.
- Response: `text/csv; charset=utf-8`, `Content-Disposition` with filename, `X-Row-Count` header
  (pattern already used by `/api/reports/generate`).

### Gateway — backend-v2
- `apps/backend-gateway/src/application/reports/reports.controller.ts`: `POST export` next to
  `POST viewer` (:339), same guards/permission as viewer; `reports.service.ts` forwards to
  micro-report and streams the bytes back (follow the `generate` path at :303 for binary passthrough).
- `ReportsController` has no `AppIdGuard` (verified) → **no allowlist entry needed**.
- The SPA calls the gateway cross-origin in prod and the gateway sets no `exposedHeaders`, so the export
  response must set `Access-Control-Expose-Headers: Content-Disposition, X-Row-Count` itself; FE falls back
  gracefully if the headers are unreadable.

### carmen-platform
- `ReportTemplateEdit.tsx`: `activeTab` union gains `'export'`; tab after Content; panel uses
  `components/XmlEditor.tsx` with `filename="export.xml"`. Add `export` to formData and save payload.
- Validation on save (*my call:* **warnings, not blocking**, except malformed XML which blocks like the
  other editors): unknown `Field`/`Sort Field`/`[placeholder]` (after stripping a data-source prefix) vs
  `<Column Name>`s in Content XML's `TableDataSource`;
  `<Column>` with zero or multiple value sources; missing `Header`.
- `services/reportTemplateService.ts` types gain the field; backup/import `src/utils/reportTemplateBackup.ts`
  `BACKUP_FIELDS` gains it too. Version history view shows it if it shows dialog/content.

### carmen-inventory-frontend-react
- `routes/report/shared/use-report.ts`: add `useExportReportMutation` → `POST /api/proxy/api/{bu}/reports/export`
  `{template_id, filters}`, response as blob; read filename from `Content-Disposition`, row count from `X-Row-Count`.
- Report list type gains `has_export`.
- `report-param-dialog.tsx` footer (:842-866): "Export data" button beside "Run report", rendered only when
  `has_export`. Uses the same FormData collection as `handleSubmit` (:741), including remembering params.
  The dialog only calls `onRun` today (mutations live in `report-component.tsx`) — add an `onExport` prop and
  pass pending state down. Loading state disables both buttons; errors via existing toast pattern (`hooks/use-export-error-toast.ts`).
  Does **not** open a new tab. i18n keys in `messages/{en,th}.json`.

## Deploy order

DB migration → micro-report → gateway → carmen-platform / FE.
FE before backend is harmless (no `has_export` → button hidden). Platform before backend would drop the
field on save — deploy platform after gateway.

## Left to the builder

- Go package layout, XML parsing library, exact error codes beyond `export_not_configured`.
- Whether to reuse or replace `csv_generator.go`.
- Whether the platform tab shows a small "Insert columns from Content XML" helper (nice-to-have, not required).
- Tests per repo conventions (this user's default: skip writing new tests during plan execution unless asked;
  run typecheck/lint/`go vet`).
