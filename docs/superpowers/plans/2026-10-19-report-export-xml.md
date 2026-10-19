# Report Export XML → CSV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Report templates get a third XML (Export XML) that maps the report's dataset to a flat CSV; the `/report/list` filter dialog gets an "Export data" button for templates that have one.

**Architecture:** New nullable column `tb_report_template.export_xml` (platform DB). micro-report (Go) parses Export XML, sorts + maps the same rows the viewer uses, writes CSV (`POST /api/:buCode/report/export`). Gateway passes the bytes through (`POST api/:bu_code/reports/export`). carmen-platform edits the XML in a new tab; inventory FE downloads.

**Tech Stack:** NestJS + Prisma + zod (backend-v2), Go + gin + `encoding/csv` + `encoding/xml` (micro-report), React + CodeMirror (carmen-platform), React + TanStack Query + use-intl (inventory FE).

**Spec:** `docs/superpowers/specs/2026-10-19-report-export-xml-design.md` (read it — format, row shaping and CSV rules live there).

## Global Constraints

- **No new test files** (user preference). Existing suites must stay green; static checks run every task: backend `bun run build` / `tsc` + lint, micro-report `go vet ./... && go test ./...`, platform + FE `bun run typecheck && bun run lint`.
- Branch `feature/report-export-xml` in each of the 4 repos, off `main` (re-check `git ls-remote --heads origin` first). Commit messages in Thai, conventional-commit prefix. PR bodies English.
- Column name `export_xml` everywhere (DB, Prisma, DTO, Go `json:"export_xml"`, TS).
- CSV: UTF-8 **with BOM** (`\xEF\xBB\xBF`), comma, CRLF, RFC 4180 quoting, header row always.
- Default date output with no `Format`: `dd/MM/yyyy` in ICT (UTC+7).
- Field names accept bare `CnNo` and qualified `CreditNoteDetail.CnNo`; `ADMIN_Bu.Name` → `BuName`.
- Deploy order: migration → micro-report → gateway → platform / FE. **Platform must not ship before gateway** (save would drop the field).

## Review Focus

1. Thai / non-ASCII template name → `Content-Disposition` filename must stay ASCII (slugged) or the header breaks; FE must fall back to `<report name>.csv` when the header is unreadable (CORS).
2. Values containing `,` `"` or newlines (descriptions, remarks) → correctly quoted, never column-shifted.
3. Large float values (`1234567.5`) with no `Format` → emitted as `1234567.5`, never `1.2345675e+06`.
4. Template with Export XML but **no data source** (`buildRowsForTemplate` returns `nil, nil`) → header-only CSV, row count 0, FE "no data" toast — not a 500.
5. User double-clicks "Export data" / clicks "Run report" while exporting → one request only.

Each is pinned by a verification step in the owning task (manual / curl, per Global Constraints).

---

### Task 1: Store `export_xml` (backend-v2: Prisma + migration + DTO + micro-cluster)

**Files:**
- Modify: `packages/prisma-shared-schema-platform/prisma/schema.prisma` (model `tb_report_template`, after `content` ~:971)
- Create: `packages/prisma-shared-schema-platform/prisma/migrations/20261019120000_report_template_export_xml/migration.sql`
- Modify: `apps/backend-gateway/src/common/dto/report-template/report-template.dto.ts` (create schema ~:70, update schema ~:217)
- Modify: `apps/micro-cluster/src/cluster/report-template/interface/report-template.interface.ts` (`IReportTemplateUpdate` + create counterpart)
- Modify: `apps/micro-cluster/src/cluster/report-template/report-template.service.ts` (create :253, update :335, restore :551)
- Modify: `apps/micro-cluster/src/cluster/report-template/report-template-version.ts:5` (`SNAPSHOT_FIELDS`)

**Interfaces:**
- Produces: column `export_xml TEXT NULL`; API field `export_xml?: string | null` on create/update/get of `/api-system/report-templates`.

- [ ] **Step 1:** Prisma: `export_xml String? @db.Text` directly below `content`. Migration SQL: `ALTER TABLE "tb_report_template" ADD COLUMN "export_xml" TEXT;` (match the schema-qualification style of `20261018130000_*`).
- [ ] **Step 2:** zod create + update: `export_xml: z.string().nullable().optional()` with a `.meta({ description })` matching the neighbours. Empty string is normalised to `null` in the service (Step 3).
- [ ] **Step 3:** micro-cluster: add `export_xml?: string | null` to the interfaces; service create/update write `export_xml: data.export_xml?.trim() ? data.export_xml : null` (update only when `data.export_xml !== undefined`, like `dialog`); restore uses `(snap.export_xml as string | null) ?? null` (pre-feature snapshot → cleared, per spec). Append `'export_xml'` to `SNAPSHOT_FIELDS`.
- [ ] **Step 4:** Check the gateway platform controller / response DTOs for an explicit response field list (`@Serialize` / swagger response classes) and add `export_xml` wherever `content` is listed, or GET strips it.
- [ ] **Step 5:** Run `bun run db:generate` (or the repo's prisma generate script for the platform schema), rebuild the prisma package dist, then `bun run build --filter=backend-gateway --filter=micro-cluster` and the existing jest for `report-template`. Expected: green.
- [ ] **Step 6:** Commit `feat(report-template): เพิ่มคอลัมน์ export_xml สำหรับ Export XML`.

### Task 2: micro-report model + `has_export` on the BU template list

**Files:**
- Modify: `micro-report/model/template.go` (after `Content`)
- Modify: `micro-report/controller/template_controller.go` (`listFlat` local `item` struct ~:631 and its fill loop)

**Interfaces:**
- Produces: `model.ReportTemplate.ExportXML *string \`gorm:"column:export_xml" json:"export_xml,omitempty"\``; list item field `HasExport bool \`json:"has_export"\``.

- [ ] **Step 1:** Add the model field. `templateSelectCols` selects `rt.*`, so no repo change. Do **not** add it to the seed `Updates` map (`db/seed/`) — a reseed must not wipe authored Export XML.
- [ ] **Step 2:** `listFlat`: `HasExport: t.ExportXML != nil && strings.TrimSpace(*t.ExportXML) != ""`. Do not return the XML itself.
- [ ] **Step 3:** `go vet ./... && go test ./...` → PASS.
- [ ] **Step 4:** Commit `feat(template): ส่ง has_export ในรายการ template ของ BU`.

### Task 3: micro-report Export XML engine (parse → sort → map → CSV)

**Files:**
- Create: `micro-report/service/export_xml.go` (package `service` — reuses `ictZone`, `dateInputLayouts` from `dateformat.go`)

**Interfaces:**
- Produces:
  ```go
  type ExportSpec struct { FileName string; Sorts []ExportSort; Columns []ExportColumn }
  type ExportSort struct { Field string; Desc bool }
  type ExportColumn struct { Header, Field, Value, Expression, Format string }
  func ParseExportXML(src string) (*ExportSpec, error)
  func WriteExportCSV(spec *ExportSpec, rows []map[string]any) ([]byte, error) // sorts a copy, then maps
  func normalizeExportField(name string) string
  ```

- [ ] **Step 1: `ParseExportXML`** with `encoding/xml` (strip leading BOM first). Root must be `<Export>`; errors: not `<Export>`, zero `<Column>`, a column without `Header`, a column with ≠1 of `Field`/`Value`/`Expression`. Error messages name the column index + header. Normalise `Field` and `Sort Field` through `normalizeExportField`.
- [ ] **Step 2: `normalizeExportField`**: `"ADMIN_Bu.Name"` → `"BuName"`; otherwise strip everything up to and including the last `.`; trim spaces.
- [ ] **Step 3: Sorting** — `sort.SliceStable` on a copy, keys in `Sorts` order. Compare: `nil`/missing always last (regardless of `Desc`); both `float64` (or `json.Number`) → numeric; both parse via `dateInputLayouts` → chronological; else `strings.Compare` on `fmt.Sprint`. `Desc` inverts non-nil comparisons only.
- [ ] **Step 4: Cell value** per column:
  - `Value` → literal.
  - `Expression` → replace each `\[([^\]]+)\]` with the formatted value of `normalizeExportField(group1)` (no `Format`); unknown → `""`.
  - `Field` → `nil`/missing → `""`; `string` that parses as a date → `Format` given and date-shaped (contains any of `dd MM yyyy HH mm ss`) ? .NET→Go layout (`yyyy→2006 MM→01 dd→02 HH→15 mm→04 ss→05`) : `02/01/2006`, always `.In(ictZone)`; number (`float64`, `json.Number`, numeric string when `Format` is numeric) with numeric `Format` matching `^(#,##)?0(\.0+)?$` → grouping + fixed decimals (round half away from zero); number without `Format` → `strconv.FormatFloat(v, 'f', -1, 64)`; `bool` → `true`/`false`; anything else → `fmt.Sprint`. Unsupported `Format` → unformatted value.
- [ ] **Step 5: `WriteExportCSV`** — BOM bytes, then `csv.NewWriter` with `UseCRLF = true`; header row = `Header`s; one record per row. Zero rows → header only.
- [ ] **Step 6:** `go vet ./... && go test ./...` → PASS. Throwaway check (delete afterwards, do not commit): a `main` or `go run` snippet feeding rows `{"CnNo":"CN-1","Remark":"a, \"b\"\nc","Amount":1234567.5,"CnDate":"2026-10-01T00:00:00+07:00"}` through the spec example XML — expect `"a, ""b""\nc"` quoted in one cell (Review Focus 2), `1,234,567.50` with `#,##0.00` and `1234567.5` without (Review Focus 3), `01/10/2026` for the date.
- [ ] **Step 7:** Commit `feat(export): ตัวแปลง Export XML เป็น CSV`.

### Task 4: micro-report `ExportCSV` service + route

**Files:**
- Modify: `micro-report/service/report_service.go` (new method next to `BuildData` ~:489)
- Modify: `micro-report/controller/report_controller.go` (`RegisterRoutes` :34, new handler after `reportData`)

**Interfaces:**
- Consumes: Task 3 `ParseExportXML`, `WriteExportCSV`; Task 2 `ExportXML`.
- Produces: `var ErrExportNotConfigured = errors.New("export_not_configured")`; `func (s *ReportService) ExportCSV(ctx context.Context, templateID, buCode string, filters model.ReportFilters) (*model.ReportResult, error)`; route `POST /api/:buCode/report/export` body `templateFilterRequest`.

- [ ] **Step 1: `ExportCSV`** — `FindByID` → `EnsureAvailable` → empty `ExportXML` → `ErrExportNotConfigured` → `ParseExportXML` (wrap error `invalid export xml: %w`) → `buildRowsForTemplate` (`nil` result → empty rows, Review Focus 4) → inject computed columns into every row: `GroupBy` (from `filters.GroupBy`), `BuName` (`s.db.BuName`, fallback `buCode`), `CalculationMethod` only when `declaresCalculationMethod(tmpl.Content)`. Inject for all templates (not just self-contained) — harmless, since only mapped columns are written. **Do not** call `normalizeRowDates`. Leave `ViewReport` untouched (plan-time call: no refactor of the viewer path; the small duplication is preferable to regressing the viewer).
- [ ] **Step 2: filename** — base = `spec.FileName` or `tmpl.Name`; slug: lowercase, runs of non-`[a-z0-9]` → `_`, trim `_`, empty → `report`; final `<slug>_<yyyyMMdd_HHmmss in ICT>.csv`. `ContentType: "text/csv; charset=utf-8"`, `RowCount: len(rows)`.
- [ ] **Step 3: handler** — mirror `viewReport` validation; `writeUnavailable` first; `ErrExportNotConfigured` → 400 `{"error":"export_not_configured"}`; parse error → 400 `{"error": err.Error()}`; else 500. Success headers exactly as `generate` (`Content-Disposition attachment; filename=%q`, `X-Row-Count`, `Content-Length`) then `c.Data`.
- [ ] **Step 4:** `go vet ./... && go test ./...` → PASS. Run micro-report locally against the dev DB, set `export_xml` on one list template by SQL (back up the row first — shared dev DB), then `curl -X POST localhost:<port>/api/<BU>/report/export -H 'Content-Type: application/json' -H '<internal token header>' -d '{"template_id":"…","filters":{…}}' -D -` → 200, BOM present (`xxd | head -1` shows `efbb bf`), ASCII filename for a Thai-named template (Review Focus 1); a template without data source → header-only, `X-Row-Count: 0`.
- [ ] **Step 5:** Commit `feat(report): endpoint export CSV ตาม Export XML`.

### Task 5: Gateway `POST reports/export`

**Files:**
- Modify: `apps/backend-gateway/src/application/reports/reports.service.ts` (new method next to `reportData` ~:564)
- Modify: `apps/backend-gateway/src/application/reports/reports.controller.ts` (new endpoint after `reportData` ~:389)

**Interfaces:**
- Consumes: Task 4 route.
- Produces: `exportCsv(bu_code: string, template_id: string, filters?: unknown): Promise<{ file_content: Buffer; file_name: string; content_type: string; row_count: number }>`; `POST /api/:bu_code/reports/export`, body `ViewerRequestDto`, operationId `exportReportCsv`.

- [ ] **Step 1: service** — raw `fetch` like `generate` (:273–350): URL `${this.reportBaseUrl}/api/${encodeURIComponent(bu_code)}/report/export`, `INTERNAL_TOKEN_HEADER`, `!response.ok` → `HttpException(err.error ?? 'Export failed', response.status)`; filename parsed from `content-disposition` (fallback `export.csv`), `row_count` from `x-row-count`.
- [ ] **Step 2: controller** — `@Post('export')`, `@HttpCode(200)`, swagger mirrors `viewReport` with a `text/csv` binary response. Headers: `Content-Type`, `Content-Disposition: attachment; filename="<name>"`, `X-Row-Count`, and **`Access-Control-Expose-Headers: Content-Disposition, X-Row-Count`** (SPA is cross-origin in prod; gateway has no global `exposedHeaders`). No `AppIdGuard` on this controller → no allowlist row.
- [ ] **Step 3:** `bun run build --filter=backend-gateway`, lint, existing `reports.*.spec.ts` jest → PASS. curl through the gateway with a real Bearer token (use a different user than any open browser session) → same bytes as Task 4; `export_not_configured` comes back as 400 with the message.
- [ ] **Step 4:** Commit `feat(reports): เปิด endpoint export CSV ที่ gateway`.

### Task 6: carmen-platform Export XML tab

**Files:**
- Modify: `src/pages/ReportTemplateEdit.tsx` (form type :83, initial data, load mapping, `activeTab` :162, `XML_TABS` :487, panels :1249–1281, save payload :396–441)
- Create: `src/utils/exportXml.ts`
- Modify: `src/services/reportTemplateService.ts` (template type :34), `src/utils/reportTemplateBackup.ts:14` (`BACKUP_FIELDS`), i18n files holding `pages.reportTemplates.contentXmlTab`

**Interfaces:**
- Consumes: Task 1 API field `export_xml`.
- Produces: `lintExportXml(exportXml: string, contentXml: string): string[]` — human-readable warnings, `[]` when clean or when `exportXml` is blank.

- [ ] **Step 1:** Form field `export_xml: string` (load `?? ''`, save `export_xml: formData.export_xml.trim() ? formData.export_xml : null`). `BACKUP_FIELDS` + service type gain `export_xml`.
- [ ] **Step 2:** Tab union `'dialog' | 'content' | 'export' | 'preview'`; tab entry after Content: label key `pages.reportTemplates.exportXmlTab` (en "Export XML", th "Export XML"), `count` = line count, `hasError: !exportValidation.valid`. Panel = `XmlEditor` with `filename="export.xml"`, `uploadAccept=".xml,.txt"`, same props as Content, `onParseChange={setExportValidation}`. Empty Export XML must count as valid (it is optional).
- [ ] **Step 3: `lintExportXml`** (DOMParser) — warnings for: root not `<Export>`; `<Column>` missing `Header`; not exactly one of `Field`/`Value`/`Expression`; `Field`, `Sort Field`, or `[x]` in `Expression` that (after the same normalisation as Go: `ADMIN_Bu.Name`→`BuName`, strip through last `.`) is not a `<Column Name>` inside Content XML's `TableDataSource`, nor one of `GroupBy`/`BuName`/`CalculationMethod`. Render the list under the editor (warning style from the design tokens). Warnings never block save; malformed XML blocks exactly like the other editors.
- [ ] **Step 4:** `bun run typecheck && bun run lint` → clean. Browser: open the template from the spec URL, add the example Export XML, save, reload → persists; version history restore of a pre-feature version clears it; a typo'd field shows a warning but saves.
- [ ] **Step 5:** Commit `feat(report-template): แท็บ Export XML พร้อมคำเตือน field ที่ไม่มีใน Content`.

### Task 7: inventory FE "Export data" button

**Files:**
- Modify: `types/report.ts` (`ReportTemplate`, `Report`)
- Modify: `routes/report/list/report-component.tsx` (`templateToReport` :38, new `handleExport` next to `handleRunReport` :133, dialog props)
- Modify: `routes/report/shared/use-report.ts` (new mutation after `useRunReportMutation` :186)
- Modify: `routes/report/list/report-param-dialog.tsx` (props :54, `handleSubmit` :741, footer :842–866)
- Modify: `messages/en.json`, `messages/th.json` (`report` namespace)

**Interfaces:**
- Consumes: Task 2 `has_export`; Task 5 endpoint.
- Produces: `ReportTemplate.has_export?: boolean`; `Report._hasExport?: boolean`; `useExportReportMutation(): UseMutationResult<{ blob: Blob; fileName: string | null; rowCount: number | null }, ApiError, RunReportPayload>`; dialog props `onExport?: (report: Report, filters: Record<string, string>) => void` and `busy?: boolean`.

- [ ] **Step 1:** Types + `templateToReport`: `_hasExport: t.has_export ?? false`.
- [ ] **Step 2: mutation** — `httpClient.post(\`${API_ENDPOINTS.REPORTS(buCode!)}/export\`, payload)`; `!res.ok` → `ApiError.from(res, "Failed to export report")`; `blob = await res.blob()`; `fileName` from `content-disposition` `filename="…"` (null if absent); `rowCount` = `Number(x-row-count)` or null if absent.
- [ ] **Step 3: dialog** — extract the FormData collection + `saveReportParams` from `handleSubmit` into a local `collectFilters()` reused by both buttons. Footer: "Export data" (`variant="outline"`, before Run report) rendered only when `report._hasExport && onExport`. Both buttons `disabled={busy}`; Run report keeps its current behaviour.
- [ ] **Step 4: `handleExport`** in `report-component.tsx` — return early if `exportReport.isPending || runReport.isPending` (Review Focus 5); keep the dialog open while pending (pass `busy={exportReport.isPending}`); on success: `rowCount === 0` → `toast.info(t("exportNoData"))`, keep dialog open; else download via `URL.createObjectURL` + temporary `<a download>` (filename = header value ?? `${report.ReportName}.csv`), revoke the URL, close the dialog, `toast.success(t("exportReady", { name }))`. Errors: same toast branch as `handleRunReport` (incl. `REPORT_TEMPLATE_UNAVAILABLE`) with `t("exportError")`. Do not open a new tab.
- [ ] **Step 5:** i18n `report.exportData` (en "Export data", th "ส่งออกข้อมูล"), `report.exportNoData` (en "No data for these filters.", th "ไม่มีข้อมูลตามเงื่อนไขที่เลือก"), `report.exportReady` (en "\"{name}\" exported", th "ส่งออก \"{name}\" แล้ว"), `report.exportError` (en "Unable to export the data. Please try again.", th "ส่งออกข้อมูลไม่สำเร็จ กรุณาลองใหม่"). No `{{ }}` or `<word>` in messages.
- [ ] **Step 6:** `bun run typecheck && bun run lint` → clean; `bun test:run routes/report` → existing tests PASS. Browser (`VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev`, backend from Tasks 1–5 running locally): template without Export XML → no button; with → button, CSV downloads with the XML's headers/order, opens in Excel with Thai intact; filters that return nothing → "no data" toast, no file; double-click → one network request; check light + dark theme.
- [ ] **Step 7:** Commit `feat(report): ปุ่ม Export data ในหน้าเลือกรายงาน`.

---

## After all tasks

PRs per repo (English bodies, each states the deploy order and that platform must follow the gateway). Merge order mirrors deploy order. Nothing is deployed by this plan; UAT/prod need the migration first.
