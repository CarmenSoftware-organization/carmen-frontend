---
name: carmen-blue-ui-design
description: Use when laying out or adjusting a CARMEN BLUE screen (form / settings / detail / list / shell bars) so it fills the screen width, stays compact, and is correct at all 5 screen sizes (mobile, tablet, 1366, Full HD, 4K) — or when the user says a page is "empty", "stretched", "not compact", "has blank space left and right", "text overlaps", "overflows" (Thai: "โล่ง" "ยืด" "ไม่ compact" "มีที่ว่างซ้ายขวา" "ข้อความทับกัน" "ล้น")
---

# CARMEN BLUE — screen layout

Rules the user set themselves on the `/system-admin/company-profile` page (2026-11-12). They cover
**use of space** only — colour, type and primitives belong to `docs/DESIGN.md` and the
`/design-system` page.

## Start from the kind of page

| Page | What to do | Recipe |
|---|---|---|
| form / settings / detail | Convert to `CompactSection` + `FieldGrid` | `values.md` §Forms |
| settings list (label left, value right, full row) | Turn each row into a `FieldGrid` cell | `values.md` §Lists |
| list whose items expand to show detail | collapsed = grid cell · expanded = full row | `values.md` §Lists |
| list split into groups, a few rows per group | Groups flow as columns with `auto-fit` | `values.md` §Lists |
| module landing page (groups of unequal height) | Groups flow as columns with CSS multi-column | `values.md` §Lists |
| list (`ListPageShell` + `DataGrid`) | **Do not change the structure**; fix only tables with few columns | `values.md` §Tables |
| list whose columns do not fit the box at tablet | Hide secondary columns / swap size sets by box width | `values.md` §Tables |
| list that is a plain `<table>` | Data columns as wide as their content + stack as a list when the box is narrow | `values.md` §Tables |
| shell bars (footer, toolbar, summary bar) | Let the bar decide from its own width | `values.md` §Bars |
| list page search bar | View (bookmark) and Filter buttons sit next to the search box | `values.md` §Bars |

When done, check against `verify.md` every time — rules 1–3 can be broken without any error.

## Rules

1. **Full screen width at every size** — no `max-w-*` around the content, no empty heading column at
   the side. The only acceptable blank space is the shell gutter and internal gaps
   (`FormPageShell width="wide"`).
2. **A wider screen means more columns, not wider fields** — a value must stay next to its label.
3. **Decide from the box's own width, not the screen's** — container queries (`@md:`), not
   breakpoints (`md:`). The box is the screen minus a sidebar that can be collapsed or expanded.
4. **Sections that form a pair sit side by side on wide screens** (1700px and up); below that they
   stack. Cards in the same row must be the **same height** (user instruction on `/profile/setting`,
   2026-11-13) — `SECTION_PAIR` + `CompactSection` already do this. Hand-written cards in a
   multi-column grid must not use `items-start`.
5. **Compact** — spacing must not take more room than the content.
6. **No cross-section side navigation.**
7. **View mode does not box its values** — muted label + strong value. Borders are only for fields
   that can actually be edited.
8. **Pattern settings show the result first** — `2026-11-12` is the main value, `yyyy-MM-dd` the
   secondary line.
9. **Help text under a field only when it adds something** — text that merely repeats the label is
   removed.
10. **Text must never overflow or overlap at any screen size** — when there is no room, hide the
    less important thing; do not let things overlap or truncate down to a few characters.
11. **Readable in both light and dark** — tokens only.
12. **View (bookmark) and Filter buttons sit next to the search box** — not pushed to the far right
    of the row (user instruction on `/system-admin/user`, 2026-11-13). The right side of the bar may
    hold only table buttons (sort, column picker, view switch).
13. **Form header buttons stay on one line at every screen size** (user instruction on the vendor
    page, 2026-11-13) — when the header is narrower than 576px, secondary buttons (Cancel, Delete,
    Print, Comment, Activity) become icon-only and the primary button (Edit / Save) keeps its label.
    The order is unchanged and they are **never collapsed into a ⋯ menu**. `FormToolbar` +
    `PrintDocumentButton` already do this. Buttons a page adds to the header (children of
    `FormToolbar`) must wrap their label in `<ToolbarLabel>` from
    `components/share/form-toolbar.tsx` and set `title` — forget it and that button pushes the whole
    row onto a second line on mobile.

## Module landing pages

Rules the user set on the `/system-admin` page (2026-11-13) — a landing page must **show only real
things**:

1. **No hard-coded numbers or data** — card statistics ("14 roles · 87 permissions"), version
   numbers and tool counts all read as real data. A number is allowed only when it comes from the
   API (done right: the workflow count in `routes/system-admin/workflow/wf-landing.tsx`).
2. **Every page in the module's left menu has a card** — compare against `constant/module-list.ts`
   every time.
3. **A card's description is that page's own header description** (`systemAdmin.<page>.desc`) and
   its title is the left-menu name — no separate marketing copy (the old copy claimed features that
   do not exist).
4. **Card permissions come from `useVisibleModules`, the same source as the left menu** — hidden =
   no card · locked / no permission = a faded card that is a button calling
   `dispatchPermissionDenied` (locked wins over denied). A group whose cards are all gone disappears
   entirely, and group numbers count only what is shown.
5. **The whole card is clickable** — no card footer holding only an Open button.
6. **No button that does nothing when pressed, and no text promising things that do not exist**
   (handbook, sandbox).
7. **Illustrations use lines instead of text** — no made-up names, document numbers, times or
   percentages. Labels inside an illustration must match the real page, and the illustration must
   depict the same subject as the page (Running Code = a document-number pattern, not a terminal).
   Helpers: `Line`, `ListViz` in `routes/system-admin/landing-visuals.tsx`.
8. **Compact page header** — page name + tagline. No half-screen hero, no table of contents
   repeating the headings below.

Layout → `values.md` §Lists (multi-column) · how to check → `verify.md` §Landing pages

## What already exists — use it, do not write a second set

- `components/share/compact-section.tsx` — `CompactSection` (`count`, `action`, `first`,
  `frameless` = no card wrapper, for content that has its own frame such as a grid of item cards or
  a table), `CompactSectionSkeleton`, `FieldGrid` (`size="field"` | `"item"`), `SECTION_PAIR`
- `components/share/setting-field.tsx` — `SettingField`, the view-mode field: muted label + strong
  value, no border (prop `specimen` for rule 8, `fullWidth` = `@md:col-span-2`). Usable from any
  module.
- `routes/system-admin/company-profile/company-profile-ui.tsx` — `ConfigField` (config field:
  document code + label on top, value below) — still owned by the system-admin module. Another
  module that needs it must lift it into `components/` first (ESLint forbids `routes/<A>/` →
  `routes/<B>/`).
- `DataGrid` column `meta: { grow: true }` — the column takes the remaining width
- `hooks/use-element-width.ts` — `useElementWidth()` measures a box's width with ResizeObserver, for
  places where a CSS container query cannot do the job (choosing columns / column sizes of a
  `DataGrid`). Usable from any module.
- `components/list-filter/list-toolbar.tsx` — `ListToolbar`, both `variant="wrap"` and `"row"`,
  already puts View/Filter next to the search box. Do not write your own search bar.
- Example shell bar: `components/footer/status-bar.tsx`

Pages already done (open them as examples): company-profile #547 · default-setting #548 ·
ask-ai #549 · inventory-period + footer #550 · interface (list) #552 · email-profile #553 ·
email-template #554 · role (list) #555 · running-code (list) #556 · document (list) #557 ·
storage #558 · user (list) · profile (view page: full-width card per BU) #565 ·
profile/setting (single-row form + token grid) #566 ·
system-admin landing (multi-column, real things only) #568 ·
user (detail: view mode shows only what is held + table picks columns in 3 steps by box width) ·
vendor (detail: lists as a grid of cards, address in view mode as text, `CompactSection frameless`)

## Gotchas

- **`@md:` does nothing without an ancestor that is a `@container`** — no error; the columns simply
  never split.
- **Do not make `components/ui/setting-section.tsx` compact across the board** — config-email,
  notification-template and the vendor-management forms still use its heading-left-1/3 layout. The
  user has not asked to change those pages. Ask first.
- **Never write `max-w-4xl` or safe-area padding in the page itself** — they come from
  `FormPageShell` (`components/share/__tests__/form-page-shell.usage.test.ts` catches it).
- **Two adjacent fields that each span 2 columns land on separate rows in a 3-column grid** — keep
  to one wide field per section.
- **`meta.grow` turns the other columns into fixed px, so measure at tablet** — the sum of `size`
  plus the minimum width of the grow column (~165px for a status column) must not exceed 662px or
  the table overflows. Never use it on a multi-column editable table.
- **`getTotalSize()` counts the select column (55px) even when it is not rendered** — tables from
  `useConfigTable`, and tables that add `selectColumn()` themselves without turning on
  `tableLayout.checkbox`, have a tablet budget of only 607px (662 − 55), not 662px.
- **You cannot hide a column of a grow table with CSS** — the table's minimum width is computed from
  every column TanStack considers visible. Turn it off through `state.columnVisibility` based on the
  measured box width.
- **A column step's switch point must be higher than that step's `size` total** — set them exactly
  equal and, once the box is just past that point, the secondary column comes back and the grow
  column shrinks to its minimum (the file name is narrower than when the box was smaller).
- **A `flex-1` wrapper around something of fixed width pushes the next thing to the far right** —
  the search box has a fixed width from `md`, so its wrapper must stop stretching at `md` too
  (`flex-1 md:flex-initial`).
- **Do not use an empty trailing column to absorb the remaining width in a `DataGrid`** — it is at
  least 75px wide even with `p-0!`. Make the last data column the grow column.
- **A grid with a fixed column count leaves empty columns when there are fewer items than columns**
  — for lists whose count depends on data use `repeat(auto-fit, minmax(…, 1fr))`. Measure the right
  edge of the last item against the right edge of the box, at every screen size.
- **View mode of a checklist is not the same list disabled** — show only what is held, as `FieldGrid`
  cells (name + description), from the data that comes with the document itself; do not fetch the
  whole registry. Edit mode then shows the checklist, with its width capped (`max-w-2xl`) when rows
  have the name on the left and the mark on the right. Example:
  `routes/system-admin/user/user-assigned-roles.tsx`
- **Lists you can add to / remove from (addresses, contacts) are a grid of cards, not full-width
  rows** — `grid-cols-[repeat(auto-fill,minmax(min(100%,<min>),1fr))]` (`auto-fill`, not `auto-fit`:
  a single card must not stretch across the row). The edit-mode minimum is wider than view mode's,
  and inside the card use container queries (`@container` + `@sm:`) because a narrow card can occur
  on a wide screen. Write view mode as a separate component that shows text, not the same form with
  every field disabled. Example: `routes/vendor-management/vendor/`
- **A table with few columns on a detail page: use `grow` only when the box is wide enough** —
  measure with `useElementWidth`. When the box is narrower than the column total, fall back to
  proportional widths (no `grow`), otherwise the table overflows its box on mobile.
- **A table on a detail page in a narrow box (mobile) becomes one card per row, not a squeezed
  table** (user instruction on the vendor page, 2026-11-13) — switch on the measured box width
  (`< 560px`), not a screen breakpoint. The card must carry every field of the table, row buttons
  are 32px tall (`size="icon-sm"`), and the box bound to the width-measuring ref must exist in both
  views. Example: `CertificateCards` in `vendor-certificate-section.tsx`
- **A page that returns to view mode after Save must wait for the new data first** — a mutation that
  only calls `invalidateQueries` and finishes leaves view mode showing the old value for 1–3
  seconds, and a second Save in that window sends the old `doc_version` and hits a 409. Have the
  hook's `onSuccess` **return the `invalidateQueries` promise** (the mutation stays pending until
  the refetch completes). Example: `useUpdateBusinessUnit` in `hooks/use-business-unit.ts`
- **A row-button column in a `DataGrid` must be wide enough**: two 24px buttons + 4 gap + 24 cell
  padding = 76px. With `size: 72` the buttons wrap onto two lines. Use 84.
- **A skeleton must have the same structure as the real page**, otherwise the content jumps when
  data arrives.
- **Passing every screen size does not mean the form works** — a form that binds `values` to a query
  needs `resetOptions: { keepDirtyValues: true }`, and the mutation must `setQueryData` before
  invalidating; otherwise editing a value a few seconds after Save leaves the Save button stuck
  disabled. How to try it → `verify.md` §Check real clicks
- **The Chrome extension's `resize_window` cannot be trusted** — it reports success but the viewport
  does not change. Use the iframe from `verify.md`.
- **Pages with an older learning that fixes their layout** (e.g. Ask AI) — `trail check` goes red.
  Save a new learning with `--replaces` and write the reason in the PR. Keep the other behaviours of
  the old learning.
