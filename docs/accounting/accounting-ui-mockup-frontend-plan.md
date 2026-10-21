# Accounting UI Mockup — Frontend-Only Plan

## 1. Goal

สร้าง mockup React ที่ใช้งานคลิก flow ได้ครบสำหรับ GL, Accounting Master Data และ AP โดย:

- ใช้ Carmen Blue shell, layout, typography, spacing, colors และ shared components ปัจจุบัน
- ใช้ข้อมูล mock/local repository เท่านั้นในรอบนี้
- นำ interaction flow ใหม่จาก Drive spec มาใช้เมื่อระบบเดิมยังไม่มี flow นั้น
- ไม่ copy HTML/CSS/Tailwind/CDN/Supabase code จาก mockup ใน Drive
- ไม่ออกแบบ backend contract, migration หรือ production accounting logic ในรอบนี้

หลักตัดสิน: **Carmen Blue visual language + shared components เดิม, Drive interaction flow ใหม่**

## 2. Reference pages and shared components

### Page skeletons

| New page family         | Start from                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Master list             | `routes/config/chart-of-accounts/coa-component.tsx` and `components/templates/config-list-template.tsx`    |
| Small master add/edit   | `components/templates/config-entity-dialog.tsx`                                                            |
| Document list           | `routes/accounting/accounts-payable/invoice/ap-invoice-list.tsx`                                                   |
| Document detail         | existing procurement detail pages using `DocFormHeader`, `FormToolbar`, item grids, and `SummaryFooterBar` |
| AP prototype content    | `routes/accounting/accounts-payable/`                                                                      |
| GL/JV prototype content | `routes/accounting/journal-voucher/`                                                                       |

### Required shared components

- Header/back/actions: `DocFormHeader`, `FormToolbar`, `BackButton`, `DocumentListHeader`
- Buttons: shared `Button`; toolbar buttons normally `size="sm"`
- List controls: `SearchInput`, `StatusFilter`, `DataGridSortMenu`, `DataGridColumnVisibility`
- Tables: `DataGrid`, `DataGridContainer`, `DataGridTable`, `DataGridColumnHeader`, `DataGridRowActions`, `CellAction`
- Forms: `Field`, `FieldLabel`, `FieldInput`, `FieldPlainText`, shared `Input`, `Select`, `DatePicker`, `Switch`
- Mobile list: `ListCard`, `ListCardRow`
- Footer totals: `SummaryFooterBar` from `components/ui/summary-bar.tsx`
- Feedback: existing `Badge`, toast, skeleton, empty state, error state, `ConfirmDialog`, `DeleteDialog`, `WarningDialog`, `Sheet`, and `Dialog`
- Audit mock: `ActivitySheet` where the page needs history

No raw `<table>`, `<select>`, ad-hoc page header, custom search box, or duplicated sticky footer.

## 3. Visual adaptation rules

Drive mockups provide information architecture and click behavior, not visual styling.

### Keep from Carmen Blue

- Current app navigation and page container
- Existing font scale and compact ERP density
- Existing form spacing, field labels, button sizes, radius, badges, and responsive breakpoints
- Existing light/dark theme behavior
- Existing permission-disabled presentation
- Existing table row height, hover, selection, sorting, column visibility, and mobile card behavior

### Do not carry from Drive HTML

- Custom navbar/sidebar/profile bars
- CDN fonts/icons/Tailwind runtime
- Standalone dark-mode or language toggles
- Supabase setup/status controls
- Swagger/developer panels
- oversized KPI cards or one-off color palettes
- bordered card around every section

### Table rule

All list and line-item tables use the existing Carmen Blue `DataGrid` appearance:

- no custom outer border box
- no vertical cell borders
- use existing row separators/hover state only
- sticky header only where the existing grid supports it
- clickable primary identifier uses `CellAction`
- actions use shared row-action controls
- mobile switches to the existing card/list pattern when the table is not usable

## 4. Action and footer rules

### List pages

Header actions remain in the standard list toolbar:

- primary: `New` / `Add`
- secondary: Export, Refresh, column visibility, sort
- row: View/Edit/Delete through existing row actions

Search and filters remain in the existing toolbar. Summary cards from Drive are optional; add them only when they help the mockup explain a workflow. Do not add them to every simple master page.

### Detail and document pages

Use `DocFormHeader`/`FormToolbar` for:

- Back
- Edit
- Cancel
- Save / Save Draft
- Delete/Void when applicable
- Activity/attachments through existing action placement

For documents with workflow:

- `Save Draft` saves mock state without changing lifecycle
- `Submit` opens the new confirmation flow, then changes mock lifecycle
- Approve, Return, Reject, Release, Post, or Void appear only when the mock capability allows them
- destructive or lifecycle-changing actions use existing confirmation dialogs

### Sticky footer

Use `SummaryFooterBar`; do not implement a new footer component.

- left: summary data such as Subtotal, Discount, VAT, WHT, Total, Debit, Credit, Difference, selected count
- right: context actions such as Save Draft and Submit when the screen benefits from persistent actions
- mobile: wrap summary values, respect safe-area inset, keep the primary action visible
- master-data dialogs do not need a sticky page footer; use the existing dialog footer

If the same Save/Submit footer composition is used by three document pages, extend `SummaryFooterBar` props once instead of copying markup.

## 5. New interaction patterns allowed

Use Drive behavior when Carmen Blue has no equivalent, but compose it from existing primitives.

| New flow                          | Implementation                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| Dependency blocked                | `WarningDialog` or `Dialog` with reference summary and optional mock deep links         |
| Full-screen COA editor            | normal route/detail page using `DocFormHeader`; not a custom application shell          |
| Grouping hierarchy picker         | `Dialog` containing tree/list selection; use existing buttons and fields                |
| Dimension sub-code/default picker | `Dialog` or `Sheet` with `DataGrid`; one mock default per dimension                     |
| AP line accounting detail         | existing `Sheet` pattern for account, Cost Center, dimensions, tax, PO/GRN evidence     |
| Payment approval detail           | detail route or `Sheet` depending information density; never nested custom modal stacks |
| Submit/Approve confirmation       | existing `ConfirmDialog`/`AlertDialog`                                                  |
| Unsaved changes                   | existing discard/back handling pattern                                                  |

Only extract a new shared component after the same new interaction is used by at least three pages. Before that, keep it local to the feature.

## 6. Page-family implementation

### A. Simple master pages

Modules:

- Title
- JV Prefix
- Payment Type
- WHT Service Type

Flow:

```text
List page
  -> New opens ConfigEntityDialog
  -> identifier click/Edit opens same dialog in edit mode
  -> code becomes read-only in edit mode
  -> status changes inside dialog
  -> mock dependency conflict opens WarningDialog and restores prior status
  -> Delete opens DeleteDialog or dependency-blocked dialog
```

Reuse `ConfigListTemplate` and `ConfigEntityDialog`. Each module keeps its own explicit schema and fields.

### B. Composite master pages

Modules:

- Asset Category
- WHT Form

Flow:

- list uses standard Carmen Blue list page
- add/edit uses a wider dialog only while the form remains usable and accessible
- account/Cost Center/dimension mappings use grouped existing fields
- changing Account Code resets dependent mock values where the Drive flow requires it
- three Asset Category accounting legs remain visible as three compact sections

If the form exceeds a practical dialog height on mobile, use a detail route. Do not force a giant modal.

### C. Hierarchical master pages

Modules:

- Account Code Grouping
- Dimension
- Cost Center/Department
- COA

Flow:

- Account Grouping uses a split view only if necessary: existing list/tree on the left, selected detail on the right
- Dimension list opens detail plus sub-code management using `Dialog`/`Sheet`
- Cost Center extends the current Department visual pattern; do not create a visually separate module family
- COA uses a full detail route because grouping, departments, dimensions, tags, and guardrail state exceed a standard dialog

COA list remains the existing borderless `DataGrid`; identifier click opens the full-screen editor route.

### D. AP Dashboard

- keep current Carmen Blue accounting dashboard shell and shared widget/card vocabulary
- preserve Drive information groups: outstanding, aging, due, approval, payment, and tax/WHT exceptions
- every clickable card/chip navigates to the existing Invoice/Payment list with mock query filters
- do not add a second dashboard navigation system

### E. AP Invoice

List:

- existing `DataGrid` without custom border shell
- current filters, selection, row click, New, Pay Selected, and Export patterns

Detail:

- replace custom prototype header with `DocFormHeader`/`FormToolbar`
- use shared fields and existing section/card rhythm
- line table uses `DataGrid`; line click opens accounting detail `Sheet`
- sticky `SummaryFooterBar` shows Subtotal, Discount, Net, VAT, Est. WHT, Total, and Open amount
- editing actions: Cancel, Save Draft, Submit
- Submit opens confirmation, then updates mock status and read-only capability

### F. AP Payment and Payment Approval

List:

- use existing Payment list and approval filters
- approval is a saved/canonical filter state, not a visually separate table implementation

Detail:

- use `DocFormHeader`/`FormToolbar`
- invoice applications, WHT services, tax invoices, other expenses, and posting preview use existing tables/sections
- sticky `SummaryFooterBar` shows Applied, WHT, Other Expenses, Net Cash, and Base Currency Total
- actions follow mock capability: Save Draft, Submit, Approve/Return/Reject, Release
- confirmation dialog required before Submit, Approve, Reject, Release, Void

### G. GL Journal Voucher

List:

- keep the current shared `DataGrid` list/grid toggle
- remove any Drive-specific shell or master editor

Detail:

- standard `DocFormHeader`/`FormToolbar`
- journal lines use existing borderless `DataGrid`
- line click opens `Sheet` for Department, Dimensions, Tax, Budget, and source details
- sticky `SummaryFooterBar` shows Total Debit, Total Credit, and Difference
- actions: Save Draft, Submit, Approve/Return/Reject, Post, Reverse according to mock capability
- source-generated JV remains read-only and exposes `Open source`

## 7. Mock data and state

Keep one repository boundary per domain:

- existing `ap-mock-repository.ts` for AP
- existing JV mock repository for GL
- one small accounting-master mock repository for the new master pages

Use `structuredClone`, deterministic seed data, and `localStorage` only where reload persistence materially helps the demo. Do not create separate repositories for every two-field master.

Mock behavior must include:

- loading delay and error toggle for QA
- duplicate-code validation
- immutable code after create
- dependency-blocked examples
- view/edit capability states
- lifecycle changes for Save Draft, Submit, Approve, Return, Reject, Release, Post, and Void where relevant

## 8. Delivery order

### Increment 1 — Establish the visual pattern

- Title master list/dialog
- Account Code Grouping list + hierarchy dialog
- AP Invoice detail conversion to shared header, actions, grid, and sticky summary footer

This increment proves all three page families: simple master, new interaction dialog, and document detail.

### Increment 2 — Foundation masters

- Dimension
- Cost Center/Department adaptation
- COA full-screen editor

### Increment 3 — Remaining masters

- JV Prefix
- Payment Type
- WHT Service Type
- WHT Form
- Asset Category

### Increment 4 — AP flows

- Dashboard drill-down
- Invoice list/detail completion
- Payment list/detail
- Payment approval flow

### Increment 5 — GL flows

- JV list/detail polish
- source-generated read-only state
- posting/reversal mock flows

## 9. Verification per increment

- loading, empty, error, populated, view, add, edit, disabled, permission-restricted, dependency-blocked, and long-text states
- desktop and mobile comparison against the chosen Carmen Blue reference page
- keyboard navigation, focus return, dialog titles/descriptions, and sticky-footer overlap
- table remains borderless and consistent with current Carmen Blue grids
- no raw controls where a shared component exists
- `bunx tsc --noEmit`
- targeted Vitest for non-trivial mock transitions
- React Doctor
- production build before final mockup handoff

## 10. Explicitly skipped

- Backend/API integration
- Database/schema work
- Production permission enforcement
- Real posting, matching, tax, WHT, FX, reconciliation, and dependency queries
- Pixel-copying the Drive HTML

Add those only after the interactive frontend mockup is approved.
