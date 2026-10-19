# Report Run / Export Toggles — Spec + Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Two independent per-template switches in carmen-platform — **Run report** and **Export data** — decide which buttons the inventory FE `/report/list` filter dialog shows.

**Builds on:** `docs/superpowers/specs/2026-10-19-report-export-xml-design.md` (Export XML → CSV, merged).

## Spec (decided with the user, 2026-10-19)

- `allow_run` (default **true**) controls the **Run Report** button.
- `allow_export` (default **false**) controls the **Export data** button. The button shows only when `allow_export` **and** a non-blank Export XML exist.
- Both off is allowed → the template is **not listed** in `/report/list`.
- Scope: **web buttons only**. Schedules are unaffected (they use `generate-async`, not `viewer`/`export`). The two endpoints the buttons call (`report/viewer`, `report/export`) refuse a disabled action so stale UIs can't bypass it.
- Migration backfill: all rows `allow_run = true`; `allow_export = true` where `export_xml` is non-blank (keeps the Credit Note Detail button that exists on dev).
- Applies to `template_type = 'list'` only. Form (print) templates ignore both and the platform hides the switches for them.

## Global Constraints

- No new test files (user preference). Static checks every task; existing suites green (micro-report: `TestBuildFilterSubtitle`, `TestSeedTemplates_ContentAndDefaults` fail on base — not ours).
- Branch `feature/report-run-export-toggle` in each repo (worktrees `<repo>-toggle`). Thai commit messages, conventional prefix. Never push.
- Column / JSON names exactly: `allow_run`, `allow_export`; list item fields `allow_run`, `has_export`.
- `has_export` now means `allow_export && export_xml non-blank`.
- Disabled-action refusal reuses micro-report's existing `TemplateUnavailableError` → HTTP 403 `{"error", "code":"REPORT_TEMPLATE_UNAVAILABLE", "reason"}` with reasons exactly `run_disabled` / `export_disabled`.
- List filter: query param `actionable=true` on the BU template list hides rows where `!allow_run && !has_export`. Only `/report/list` sends it (schedule pickers must not).
- Deploy order: migration → micro-report + backend-v2 → platform / FE. FE first is harmless (missing `allow_run` ⇒ treat as true).

## Review Focus

1. FE talking to an old backend (no `allow_run` in payload) → Run Report still shows.
2. Platform saving a template loaded before the migration fields existed → `allow_run` must not flip to false (load with `?? true`).
3. `allow_export` on but Export XML blank → no Export button, no 500; platform shows a warning.
4. Schedules page template picker still lists templates with both switches off.
5. Form templates: switches hidden, payload unchanged for them.

---

### Task 1: backend-v2 — columns, DTO, micro-cluster, gateway list passthrough

**Files:** `packages/prisma-shared-schema-platform/prisma/schema.prisma` (`tb_report_template`, after `export_xml`); new migration `prisma/migrations/20261019180000_report_template_allow_run_export/migration.sql`; `apps/backend-gateway/src/common/dto/report-template/report-template.dto.ts` (create + update); `apps/backend-gateway/src/platform/platform_report-templates/swagger/response.ts`; `apps/micro-cluster/src/cluster/report-template/interface/report-template.interface.ts`, `report-template.service.ts` (create / update / restore), `report-template-version.ts` (`SNAPSHOT_FIELDS`); `apps/backend-gateway/src/application/reports/reports.controller.ts` + `reports.service.ts` (`listTemplates`).

- [ ] Prisma: `allow_run Boolean @default(true)`, `allow_export Boolean @default(false)`.
- [ ] Migration (idempotent, same style as `20261019120000_*`): `ADD COLUMN IF NOT EXISTS "allow_run" BOOLEAN NOT NULL DEFAULT true`, `... "allow_export" BOOLEAN NOT NULL DEFAULT false`, then `UPDATE "tb_report_template" SET "allow_export" = true WHERE COALESCE(btrim("export_xml"), '') <> '';`.
- [ ] zod create/update: `z.boolean().optional()` with `.meta`. micro-cluster create: `allow_run: data.allow_run ?? true`, `allow_export: data.allow_export ?? false`; update only when `!== undefined`; restore: `(snap.allow_run as boolean | undefined) ?? true`, `(snap.allow_export as boolean | undefined) ?? false` (pre-feature snapshot → defaults, NOT cleared to false for run). Add both to `SNAPSHOT_FIELDS` and the swagger response class.
- [ ] Gateway `GET api/:bu_code/reports/templates`: accept `@Query('actionable') actionable?: string`; `listTemplates` forwards `actionable=true` to micro-report only when the value is `'true'`. Swagger `@ApiQuery` optional.
- [ ] `db:generate` + rebuild prisma package dist; `bun run build --filter=backend-gateway --filter=micro-cluster`; jest `report-template` + `reports`. Do NOT apply the migration to any DB.
- [ ] Commit `feat(report-template): สวิตช์ allow_run / allow_export`.

### Task 2: micro-report — model, list, refusal

**Files:** `model/template.go`; `controller/template_controller.go` (`listFlat`); `service/report_service.go` (`ViewReport`, `ExportCSV`).

- [ ] Model: `AllowRun bool \`gorm:"column:allow_run;default:true" json:"allow_run"\``, `AllowExport bool \`gorm:"column:allow_export;default:false" json:"allow_export"\``. Leave seed `Updates` maps untouched.
- [ ] `listFlat`: item gains `AllowRun bool \`json:"allow_run"\``; `HasExport = t.AllowExport && export_xml non-blank`. When query `actionable=true`, drop templates with `!AllowRun && !HasExport` in the same in-memory filter loop that applies `TemplateAvailability` (before paging, so totals stay right).
- [ ] `ViewReport`: after `EnsureAvailable`, if `tmpl.TemplateType == "list" && !tmpl.AllowRun` → return `&model.TemplateUnavailableError{Reason: "run_disabled"}` (construct it the way existing code does). `ExportCSV`: after `EnsureAvailable`, if `!tmpl.AllowExport` → same error with `"export_disabled"` (before the `ErrExportNotConfigured` check). Handlers already call `writeUnavailable` first — confirm and leave them.
- [ ] gofmt / go vet / go build / go test ./... (known 2 base failures only).
- [ ] Commit `feat(report): สวิตช์ allow_run / allow_export คุมปุ่มและ endpoint`.

### Task 3: carmen-platform — two switches

**Files:** `src/pages/ReportTemplateEdit.tsx` (form type, initial data, load mapping ~:284, payload ~:424, UI near `is_standard` ~:821); `src/services/reportTemplateService.ts`; `src/utils/reportTemplateBackup.ts` (`BACKUP_FIELDS`); i18n files with `pages.reportTemplates.*`; `src/pages/reportTemplates/ReportTemplateVersionsSheet.tsx` only if it lists scalar fields.

- [ ] Form fields `allow_run: boolean` (initial `true`, load `template.allow_run ?? true`) and `allow_export: boolean` (initial `false`, load `?? false`); sent in create/update payload for list templates; for form templates omit both (do not send).
- [ ] UI: two switches using the page's existing checkbox/switch primitive and style, visible only when `template_type === 'list'`. Labels/keys: `pages.reportTemplates.allowRun` (en "Run report", th "รันรายงาน") with hint `allowRunHint` (en "Show the Run Report button in Report List.", th "แสดงปุ่มรันรายงานในหน้ารายการรายงาน"); `allowExport` (en "Export data", th "ส่งออกข้อมูล") with `allowExportHint` (en "Show the Export data button. Needs an Export XML.", th "แสดงปุ่มส่งออกข้อมูล ต้องมี Export XML"). When `allow_export && !export_xml.trim()` show warning `allowExportNoXml` (en "Export data is on but this template has no Export XML — the button stays hidden.", th "เปิดส่งออกข้อมูลไว้แต่ยังไม่มี Export XML — ปุ่มจะยังไม่แสดง") in the warning style already used for Export XML lint. When both off show info `bothOffHidden` (en "Both off: this template is hidden from Report List.", th "ปิดทั้งสองอย่าง: รายงานนี้จะไม่แสดงในหน้ารายการรายงาน").
- [ ] Add both to `BACKUP_FIELDS` and the service type. ICU messages: no `{{ }}`, no `<word>`.
- [ ] `bun run typecheck && bun run lint`.
- [ ] Commit `feat(report-template): สวิตช์รันรายงาน / ส่งออกข้อมูล`.

### Task 4: inventory FE — honour the switches

**Files:** `types/report.ts`; `routes/report/list/report-component.tsx` (`templateToReport`, list query); `routes/report/shared/use-report.ts` (template list hook used by `/report/list`); `routes/report/list/report-param-dialog.tsx` (footer).

- [ ] `ReportTemplate.allow_run?: boolean`; `Report._allowRun?: boolean` = `t.allow_run ?? true`.
- [ ] The `/report/list` template query adds `actionable=true`. Find the hook it uses; if that hook is shared with the schedules page, add an opt-in option (e.g. `{ actionable: true }`) used only by `/report/list` — schedules must keep calling without it.
- [ ] Dialog: render Run Report only when `report._allowRun !== false`; Export data unchanged (`_hasExport`). If neither renders, the footer keeps Cancel only (can only happen with a stale list).
- [ ] `REPORT_TEMPLATE_UNAVAILABLE` with `reason` `run_disabled` / `export_disabled` → toast `report.actionDisabled` (en "This action is turned off for this report.", th "รายงานนี้ปิดการใช้งานคำสั่งนี้ไว้") instead of `unavailableForBu`, in both handlers. Read `reason` the way ApiError exposes it; if it doesn't, extend ApiError minimally.
- [ ] `bun run typecheck && bun run lint && bun test:run routes/report`.
- [ ] Commit `feat(report): ซ่อนปุ่ม Run/Export ตามสวิตช์ของ template`.
