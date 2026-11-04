# GL JV Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock Template / Recurring / Allocation Voucher pages with list + detail pages on the real `gl-jv-templates` API, including single and generate-all-due JV generation.

**Architecture:** New feature folder `routes/accounting/jv-template/` holding a repository + React Query hooks, one list component parameterised by `JvTemplatePageKind` (`"all" | "recurring" | "allocation"`), one detail component with a per-type line grid, and two generate dialogs. List pages copy the Journal Voucher list pattern from PR #490 (`routes/accounting/journal-voucher/journal-voucher-list.tsx`, `use-jv-table.tsx`, `jv-card-list.tsx`). The three mock kinds are removed from `routes/accounting/documents/`.

**Tech Stack:** React 19 + React Router 7 data router, TanStack Query/Table, react-hook-form + zod, use-intl (`messages/en.json`, `messages/th.json`), Tailwind v4 tokens.

**Spec:** `docs/superpowers/specs/2026-11-04-gl-jv-templates-design.md` — read it first; this plan does not repeat its backend contract tables.

## Global Constraints

- **No new test files.** User preference (`~/.claude/CLAUDE.md`): implement → `bun run typecheck` → `bun run lint` → commit. Existing suite (`bun test:run`) must stay green before the PR. Manual browser verification replaces tests.
- Commit messages in **Thai**; PR title/body in English; merge with `--merge` (never squash).
- Branch: `feature/gl-jv-templates` off `main`.
- ESLint module boundary: nothing in `components/ hooks/ lib/ constant/ types/` may import from `routes/`; `routes/accounting/*` may not import from another module.
- Hook placement: used by one feature → beside it; by two features of `accounting` → `routes/accounting/shared/`.
- No hardcoded colours: status/active display via `StatusIconLabel` / `createStatusConfig`; text colours via `text-*-ink` tokens.
- All user-facing text through `useTranslations`; new namespace `accounting.jvTemplate` in both `messages/en.json` and `messages/th.json`. ICU messages must not contain `{{` or `<word>`.
- Local backend `:4000` is the **shared dev DB** — delete every template / JV created during verification.
- Saving a template always sends **all** lines in `details.add` plus `doc_version` (backend replaces lines).

## Review Focus

1. **Stale `doc_version`** — two tabs edit the same template; the second save must show the backend conflict error and keep the user's input, not silently overwrite. Verify manually (Task 5, Step 6).
2. **Allocation ratios that look like 1 but aren't** (e.g. 0.3333 ×3) — FE validation must compare with the same tolerance the backend uses (exact sum of decimals as entered; use string→Decimal-safe arithmetic via cents ×10⁴ integers, not float `0.1+0.2`). Verify with 0.5/0.5 (passes) and 0.3333/0.3333/0.3334 (passes) and 0.3333×3 (fails) in Task 5, Step 6.
3. **Generate-all-due with nothing due** — result dialog must show "0 created" plus the skipped list, not an empty white box (Task 4, Step 5).
4. **A template with no open period inside its range** — generate dialog's period list is empty → show a message and keep the Run button disabled (Task 4, Step 5).
5. **Mobile width** — detail line grid and the result dialog must be usable at 375 px (horizontal scroll inside the grid only) (Task 5, Step 6).

---

## File Structure

```
routes/accounting/jv-template/
  jv-template-types.ts          # API types (header, line, payloads, generate results)
  jv-template-config.ts         # type/page-kind config, labels, filter options, paths
  jv-template-repository.ts     # http calls (list/get/create/update/remove/generate/generateAllDue)
  use-jv-template.ts            # React Query hooks over the repository
  jv-template-list.tsx          # shared list (all / recurring / allocation)
  use-jv-template-table.tsx     # columns + useConfigTable
  jv-template-card-list.tsx     # grid/mobile cards
  {template,recurring,allocation}-voucher-list.route.tsx    # one route file per path (Task 3)
  {template,recurring,allocation}-voucher-detail.route.tsx  # one route file per path (Task 5)
  jv-template-detail.tsx        # detail page (add/view/edit)
  jv-template-form-schema.ts    # zod schema + per-type validation + payload builder
  jv-template-lines.tsx         # per-type line grid
  jv-template-generate-dialog.tsx      # single template → one period
  jv-template-generate-all-dialog.tsx  # all due → result in 3 groups
  use-open-gl-periods.ts        # open periods for the period picker
routes/accounting/shared/
  use-gl-jv-prefix-options.ts   # MOVED from routes/accounting/settings/
```

---

### Task 1: Data layer — types, config, repository, hooks

**Files:**
- Create: `routes/accounting/jv-template/jv-template-types.ts`, `jv-template-config.ts`, `jv-template-repository.ts`, `use-jv-template.ts`, `use-open-gl-periods.ts`
- Move: `routes/accounting/settings/use-gl-jv-prefix-options.ts` → `routes/accounting/shared/use-gl-jv-prefix-options.ts` (update its importer `routes/accounting/settings/accounting-settings-form.tsx`)

**Interfaces — Produces:**

```ts
// jv-template-types.ts
export type JvTemplateType = "recurring" | "allocation" | "amortize";
export type JvTemplateSide = "debit" | "credit";
export type JvAmortizeType = "day_in_month" | "monthly";
export interface JvTemplateLine {
  id?: string; sequence_no: number; chart_of_accounts_id: string;
  cost_center_id: string | null; description: string | null;
  debit: number; credit: number; side: JvTemplateSide | null;
  allocation_ratio: number | null;
}
export interface JvTemplate {
  id: string; doc_version: number; template_type: JvTemplateType;
  code: string; name: string; description: string | null; is_active: boolean;
  prefix_id: string; from_fiscal_year: number; from_period_no: number;
  to_fiscal_year: number; to_period_no: number; frequency_months: number | null;
  currency_id: string | null; exchange_rate: number | null;
  allocate_amount: number | null; amortize_type: JvAmortizeType | null;
  start_date: string | null; end_date: string | null; total_amount: number | null;
  note: string | null; lines: JvTemplateLine[]; // [] on list rows
}
export type JvTemplateInput = Omit<JvTemplate, "id" | "doc_version" | "lines"> & { lines: JvTemplateLine[] };
export interface JvGenerateResult { jv_id: string; jv_no: string; gl_period_id: string; amount_total: number }
export interface JvGenerateAllResult {
  generated: { template_id: string; jv_id: string; jv_no: string }[];
  skipped: { template_id: string; reason: "already_run" | "not_due" }[];
  failed: { template_id: string; code: string }[];
}

// jv-template-config.ts
export type JvTemplatePageKind = "all" | "recurring" | "allocation";
export const JV_TEMPLATE_PAGES: Record<JvTemplatePageKind, {
  path: string;                 // "/accounting/template-voucher" | "/accounting/recurring-voucher" | "/accounting/allocation-voucher"
  fixedType: JvTemplateType | null;   // null for "all"
  creatableTypes: JvTemplateType[];   // all: 3 types; recurring: ["recurring"]; allocation: ["allocation"]
  listPageKey: string;          // LIST_PAGE_KEYS.JV_TEMPLATE | JV_TEMPLATE_RECURRING | JV_TEMPLATE_ALLOCATION
  titleKey: string;             // i18n key under accounting.jvTemplate
}>;
export const JV_TEMPLATE_TYPE_CONFIG;   // createStatusConfig(["recurring","allocation","amortize"], labels) — no colour (type, not status)
export const JV_TEMPLATE_TYPE_OPTIONS;  // createStatusFilterOptions("template_type", JV_TEMPLATE_TYPE_CONFIG)
export const JV_TEMPLATE_ACTIVE_OPTIONS;// createStatusFilterOptions("is_active", …) values "is_active|boolean:true/false" — check the clause format used by an existing active filter (grep `is_active|boolean`) and copy it
export function jvTemplateDetailPath(kind: JvTemplatePageKind, id: string): string;

// jv-template-repository.ts — all take buCode first, use buildUrl + httpClient + ApiError.from like journal-voucher-http-repository.ts
list(buCode: string, params?: ParamsDto): Promise<PaginatedResponse<JvTemplate>>;
get(buCode: string, id: string): Promise<JvTemplate>;           // maps tb_gl_jv_template_detail[] → lines
create(buCode: string, input: JvTemplateInput): Promise<{ id: string }>;
update(buCode: string, id: string, docVersion: number, input: JvTemplateInput): Promise<void>;
remove(buCode: string, id: string): Promise<void>;
generate(buCode: string, id: string, glPeriodId: string): Promise<JvGenerateResult>;
generateAllDue(buCode: string, glPeriodId: string): Promise<JvGenerateAllResult>;

// use-jv-template.ts — query key root ["jv-templates", buCode]
useJvTemplates(params?: ParamsDto, options?: { enabled?: boolean }); // list (signature fits useGridPagination)
useJvTemplate(id?: string);                 // disabled for "new"
useCreateJvTemplate(); useUpdateJvTemplate(); useDeleteJvTemplate();
useGenerateJvTemplate();   // mutation {id, glPeriodId}; invalidates templates + ["journal-vouchers", buCode]
useGenerateAllDueJvTemplates(); // mutation glPeriodId; same invalidation
useExportJvTemplates();    // same shape as useExportJournalVoucher
// use-open-gl-periods.ts
useOpenGlPeriods(): { periods: GlPeriodMaster[]; isLoading: boolean } // useGlPeriods() filtered status==="open", sorted fiscal_year, period_number
```

Payload mapping (repository, not UI): `JvTemplateInput` → `{ …header, details: { add: lines.map(({id, ...l}) => l) } }`; recurring lines send `side: null, allocation_ratio: null`; allocation/amortize lines send `debit: 0, credit: 0`. Number fields come back as strings from Prisma Decimal — coerce with `Number()` in `get`/`list`.

- [ ] **Step 1:** Create the four files above with the listed exports; add `LIST_PAGE_KEYS.JV_TEMPLATE = "jv_template"`, `JV_TEMPLATE_RECURRING = "jv_template_recurring"`, `JV_TEMPLATE_ALLOCATION = "jv_template_allocation"` in `constant/list-page-keys.ts` (accounting block).
- [ ] **Step 2:** Move `use-gl-jv-prefix-options.ts` to `routes/accounting/shared/` and fix the import in `accounting-settings-form.tsx`.
- [ ] **Step 3:** Run `bun run typecheck && bun run lint` — Expected: no errors.
- [ ] **Step 4:** Commit: `git commit -m "feat(accounting): เพิ่ม data layer ของ GL JV template (types, repository, hooks)"`

---

### Task 2: Access control + menu + i18n base

**Files:**
- Modify: `constant/permissions.ts` (add an `accounting` namespace if absent)
- Modify: `constant/module-list.ts:183-193` (recurringVoucher, allocationVoucher)
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces — Produces:**
- `PERMISSIONS.accounting.gl_jv_template = { ...crud("accounting.gl.jv_template"), generate: "accounting.gl.jv_template.generate" }`
- i18n namespace `accounting.jvTemplate` with at least: `titleAll, titleRecurring, titleAllocation, descAll, descRecurring, descAllocation, add, entity, code, name, type, periodRange, frequency, frequencyMonths, allocateAmount, amortizeType, startDate, endDate, totalAmount, active, inactive, prefix, currency, exchangeRate, note, lines, account, costCenter, side, ratio, allocatedPreview, debit, credit, totalDebit, totalCredit, ratioSum, chooseType, typeLocked, deleteTitle, deleteConfirm ({code}), deleteKeepsJv, generate, generateAll, generateAllHint, period, noOpenPeriod, run, resultCreated, resultSkipped, resultFailed, reasonAlreadyRun, reasonNotDue, openTemplate, openJv, generated ({jvNo}), amortizeTwoLines, notBalanced, ratioNotOne`, plus type labels `type_recurring, type_allocation, type_amortize` and amortize labels `amortize_day_in_month, amortize_monthly`. Thai copy written by the implementer in the tone of the existing `accounting.*` keys.
- Readable messages for error codes: `errors.GL_JV_TEMPLATE_NOT_BALANCED, …_RATIO_NOT_ONE, …_DUPLICATE_CODE, …_ALREADY_RUN, …_NOT_DUE, …_PERIOD_OUT_OF_RANGE, PERIODS_INCOMPLETE, UNKNOWN` under `accounting.jvTemplate.errors` — used by the generate dialogs to render `failed[].code`.

- [ ] **Step 1:** Add the PERMISSIONS entry. Verify the 5 keys exist in the backend permission catalog the FE mirrors (grep `jv_template` in carmen-turborepo-backend seeds / `GET /api/permissions` via the browser on local). If `generate` is not in the catalog, still add it (the gateway checks it) and note it in the PR.
- [ ] **Step 2:** Set `licenseFeature: "accounting.gl.jv_template"` on `recurringVoucher` and `allocationVoucher` (templateVoucher already has it). Do **not** add `permission:` to these leaves unless Step 1 confirmed the `.view` key is seeded (a ghost key hides the menu for non-admins).
- [ ] **Step 3:** Add the i18n keys to both files (same key set in both).
- [ ] **Step 4:** `bun run typecheck && bun run lint && bun test:run constant` — Expected: pass (module-list tests).
- [ ] **Step 5:** Commit: `feat(accounting): ผูก recurring/allocation voucher กับ license jv_template + permission + คำแปล`

---

### Task 3: List pages

**Files:**
- Create: `jv-template-list.tsx`, `use-jv-template-table.tsx`, `jv-template-card-list.tsx`, and route files `template-voucher-list.route.tsx`, `recurring-voucher-list.route.tsx`, `allocation-voucher-list.route.tsx` (each `export function Component() { return <JvTemplateList kind="…" />; }`)
- Modify: `routes/router.tsx:907-936` — the three list paths lazy-load the new route files

**Interfaces:**
- Consumes: Task 1 hooks/config, Task 2 permissions/i18n.
- Produces: `export default function JvTemplateList({ kind }: { kind: JvTemplatePageKind })`.

Behaviour (mirror `journal-voucher-list.tsx` line for line where it applies):
- Default sort `code:asc`. Query `filter` = user filters **plus** `template_type|string:<fixedType>` when `fixedType` is set (combine clauses the same way `encodeFilterParam` joins multiple fields — check `hooks/use-list-filters.ts`).
- Filter fields: `template_type` MultiSelect (kind `"all"` only), `is_active` status filter.
- Columns (ids = backend field names for sorting): `code` (CellAction → `jvTemplateDetailPath(kind, id)` with `listReturnState()`), `name`, `template_type` (all only, `StatusIconLabel` not needed — plain label), period range (`from_fiscal_year` sortable; renders `FY/PP – FY/PP`), amount (allocate_amount | total_amount | "—"; not sortable), `frequency_months` (recurring + all), `is_active` (active/inactive label).
- Header actions: `DocumentListActions` with Export + Add (+ "Generate all due" button from Task 4 placed via the actions slot). Add on kind `"all"` navigates to `…/template-voucher/new` (type chosen in detail); on a type page `…/new?type=<fixedType>`. Hide Add / delete without `create` / `delete` permission (`useCan().can`), and respect `canWrite`.
- Delete via `DeleteDialog` with `deleteConfirm` + `deleteKeepsJv` text.

- [ ] **Step 1:** Implement the three components + route files; wire router.
- [ ] **Step 2:** `bun run typecheck && bun run lint` — Expected: no errors.
- [ ] **Step 3:** Browser (`bun dev`, local backend): each of the 3 URLs loads, request is `gl-jv-templates?page=1&perpage=10&sort=code:asc[&filter=template_type|string:recurring]`, filters/saved views/grid mode work, saved view made on one page does not appear on another.
- [ ] **Step 4:** Commit: `feat(accounting): หน้า list template/recurring/allocation voucher ต่อ API จริง`

---

### Task 4: Generate dialogs

**Files:**
- Create: `jv-template-generate-dialog.tsx`, `jv-template-generate-all-dialog.tsx`
- Modify: `jv-template-list.tsx` (Generate-all button, all 3 pages, behind `generate` permission)

**Interfaces — Produces:**
- `JvTemplateGenerateDialog({ open, onOpenChange, template: JvTemplate })` — period select of `useOpenGlPeriods()` narrowed to the template's from..to range; Run → `useGenerateJvTemplate`; success toast `generated({jvNo})` with action to open `/accounting/journal-voucher/:jv_id`; error → readable text from `accounting.jvTemplate.errors.<code>` (fallback to ApiError message).
- `JvTemplateGenerateAllDialog({ open, onOpenChange, kind: JvTemplatePageKind })` — step 1 period select (all open periods) + `generateAllHint` ("runs every active template of every type"); step 2 result: three sections Created / Skipped / Failed with counts. Template code/name resolved by one `useJvTemplates({ perpage: <n of ids>, filter: id in … })` call — if the backend filter can't do `id in`, fetch `useJvTemplate` per failed/skipped id (lists are small). Created rows link to the JV; Failed rows link to `jvTemplateDetailPath(kind, template_id)` and show the error text; Skipped rows show the reason label.

- [ ] **Step 1:** Implement both dialogs; add the button to the list header.
- [ ] **Step 2:** `bun run typecheck && bun run lint`.
- [ ] **Step 3:** Browser: open the all-due dialog with no templates → "0 created" + empty sections render cleanly (Review Focus 3).
- [ ] **Step 4:** Commit: `feat(accounting): dialog สร้าง JV จาก template ทีละตัวและรันทุกตัวที่ถึงกำหนด`
- [ ] **Step 5:** (after Task 5 exists) re-verify with real templates: generate one → JV link opens draft JV; generate-all twice → second run lists it under Skipped "already run"; a template whose range has no open period → empty picker message + disabled Run (Review Focus 4).

---

### Task 5: Detail page

**Files:**
- Create: `jv-template-detail.tsx`, `jv-template-form-schema.ts`, `jv-template-lines.tsx`, route files `template-voucher-detail.route.tsx`, `recurring-voucher-detail.route.tsx`, `allocation-voucher-detail.route.tsx` (each renders `<JvTemplateDetail kind="…" />`)
- Modify: `routes/router.tsx` — the three `:id` paths

**Interfaces — Produces:**
- `JvTemplateDetail({ kind }: { kind: JvTemplatePageKind })` — `:id` = `"new"` → add mode; type from `?type=` (locked) or, on kind `"all"`, a required type select shown first. View/edit like other document forms (`FormPageShell` + `FormToolbar`): Edit, Delete, Generate (opens Task 4 dialog; hidden without `generate` permission or when inactive).
- `jvTemplateFormSchema` (zod, `superRefine` per type) implementing exactly the spec's validation list; messages from `accounting.jvTemplate.*`.
- `toJvTemplateInput(values): JvTemplateInput` — builds the payload (all lines, sequence_no = index + 1).
- `JvTemplateLines({ type, control, readOnly })` — `useFieldArray` grid:
  - recurring: account (`LookupChartOfAccount`), cost center (`LookupCostCenter`), description, debit, credit; footer totals + balanced/unbalanced chip
  - allocation: account, cost center, description, side select, ratio; footer ratio sum per side (must be 1) + per-line preview `allocate_amount × ratio` formatted with `formatCurrency`
  - amortize: fixed two rows (debit side, credit side), no add/remove
- Ratio arithmetic: integers scaled ×10⁴ (`Math.round(Number(r) * 10000)`) — sum must equal 10000 (Review Focus 2).
- Header fields: code, name, description, prefix (`useGlJvPrefixOptions` from `routes/accounting/shared/`), from FY/period, to FY/period (number inputs 1–12), currency (`LookupCurrency`) + exchange rate, active switch, note; type-specific: frequency_months / allocate_amount / amortize_type + start_date + end_date + total_amount.
- Save: create → navigate to the new detail; update → `doc_version` from the loaded record; a 409/version error shows the message and keeps form values (Review Focus 1).

- [ ] **Step 1:** Implement schema + payload builder.
- [ ] **Step 2:** Implement lines grid.
- [ ] **Step 3:** Implement detail page + route files; wire router.
- [ ] **Step 4:** `bun run typecheck && bun run lint`.
- [ ] **Step 5:** Commit: `feat(accounting): หน้ารายละเอียด GL JV template แยกตามชนิด recurring/allocation/amortize`
- [ ] **Step 6:** Browser (local, T02): create one template of each type from the right pages; edit + save; open the same template in two tabs and save both (second shows conflict, input kept); allocation ratios 0.5/0.5 ok, 0.3333/0.3333/0.3334 ok, 0.3333×3 blocked; amortize cannot add a 3rd line; resize to 375 px (grid scrolls inside itself). Then run Task 4 Step 5. **Delete every template and generated JV afterwards.**

---

### Task 6: Remove the mock kinds + PR

**Files:**
- Modify: `routes/accounting/documents/accounting-document-model.ts` (drop `templateVoucher`, `recurringVoucher`, `allocationVoucher` from the kind union + `ACCOUNTING_DOCUMENTS`)
- Modify: `routes/accounting/documents/accounting-document-detail.tsx` (remove branches only those kinds used: `isGlVoucher` members, `hasInlineApproval` L~296 and its use L~1736 if now dead)
- Modify: `messages/*.json` — remove `accounting.documents.templateVoucher|recurringVoucher|allocationVoucher` **only if** no remaining reference (`trail grep` / grep first; the sidebar reads `accounting.*` menu labels from elsewhere — check `components/sidebar` before deleting)

- [ ] **Step 1:** Remove the kinds; `trail callers` / grep for each removed name to catch other users (e.g. `components/icons/tiles/sub-tiles.tsx`, `components/sidebar/side-main.test.tsx` reference menu names — keep menu names, they come from `module-list.ts`).
- [ ] **Step 2:** `bun run typecheck && bun run lint && bun test:run` — Expected: all pass.
- [ ] **Step 3:** Commit: `refactor(accounting): ถอดข้อมูลปลอมของ template/recurring/allocation voucher`
- [ ] **Step 4:** `trail check`; push; open PR (English) listing the deploy gates: allowlist for the 7 api_names (`gl-jv-templates.findAll/findOne/create/update/delete/generate/generateAllDue`) on every env, and BUs using these pages must have license feature `accounting.gl.jv_template` assigned (menu now locks without it). Merge with `--merge` only after the user confirms.
