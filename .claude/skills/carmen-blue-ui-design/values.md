# Values and recipes by kind of page

## Forms (form / settings / detail)

```tsx
<FormPageShell width="wide" header={<FormToolbar … />}>
  <form>
    <CompactSection first title={…} description={…}>
      <FieldGrid>{/* fields */}</FieldGrid>
    </CompactSection>
    <div className={SECTION_PAIR}>
      <CompactSection title={…}>…</CompactSection>
      <CompactSection title={…} action={<Button size="sm" … />}>…</CompactSection>
    </div>
  </form>
</FormPageShell>
```

| Item | Value |
|---|---|
| Field grid (`FieldGrid`) | `grid gap-x-5 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4 @min-[96rem]:grid-cols-6` under an `@container` wrapper |
| Field that needs width (textarea, long name) | `@md:col-span-2` — not `col-span-full` and not `sm:col-span-2` |
| Paired sections (`SECTION_PAIR`) | `min-[1700px]:grid min-[1700px]:grid-cols-2 min-[1700px]:gap-x-5` — no `items-start`; paired cards are the same height |
| Space between sections | `mt-5`, no divider line |
| Section heading | `text-sm font-semibold` + description `text-xs text-muted-foreground` on the same line, above the card; action right-aligned |
| Card | `bg-card rounded-xl border p-4 shadow-sm` |
| Label in view mode | `text-muted-foreground text-xs` followed by the value `text-sm`, `mt-0.5` apart |
| Label in edit mode | `text-foreground text-xs font-semibold` |
| Empty value in view mode | `—` in `text-muted-foreground/60` |

Resulting column counts (sidebar expanded):

| Screen size | Sections | `FieldGrid` | `FieldGrid size="item"` |
|---|---|---|---|
| Mobile (390) | stacked | 1 | 1 |
| Tablet (768) | stacked | 2 | 2 |
| 1366 | stacked | 3 | 2 |
| Full HD (1920) | paired | full card 6 · paired card 3 | 4 |
| 4K (3840) | paired | 6 | 6 |

Pair sections when the two are close in height and belong together (Hotel | Company). Do not pair a
3-item section with a 13-item section.

## Lists

**A settings list "label left, value right, full row width"** breaks rule 2 on a wide screen. Make
each item a `FieldGrid` cell: code/label on top, value or control below, description (if it adds
something) under the control — like `ConfigField` on the default-setting page.

**Items with several parts** (icon, name, label, status, sample text) use `FieldGrid size="item"`.
Clamp sample text with `line-clamp-2`.

**Items that expand to show detail** (Ask AI providers): collapsed = one grid cell ·
expanded = `col-span-full`, taking its own full row. One expanded at a time. Two blocks that need to
be compared sit side by side with `@3xl:grid-cols-2` under their own `@container`.

```tsx
<Collapsible open={open} onOpenChange={onOpenChange}
  className={cn("min-w-0", open && "col-span-full")}>
```

**A summary table "name left · number right" inside a card** (attachments by type on the Storage
page): it is the same label-left-value-right list. Turn it into `FieldGrid` cells — label on top,
main value below (`text-sm font-medium`), secondary value appended as
`text-xs text-muted-foreground`. Keep the original sort order.

**A few things with progress bars** (database / attachment on the Storage page): place them side by
side with `grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]`. Name and number stay together
on the left (`flex flex-wrap items-baseline gap-x-2`), not `justify-between`.

**A list page split into groups, each with a few rows** (the Interfaces page): do not stretch rows
across the screen. Let the groups flow as columns with `auto-fit`, not a fixed column count — the
number of groups depends on data (the BU's licences). A 4-column grid with 3 groups leaves an empty
column on the right; `auto-fit` collapses the empty column and lets the existing groups fill the
width.

```tsx
// minimum = the width at which a row inside still shows everything · min(100%, …) prevents
// overflow on screens narrower than the minimum
<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,46rem),1fr))] items-start gap-5">
  <section>…<ul className="@container …">{/* rows use @xl: by card width */}</ul></section>
</div>
```

Rows inside a group's card must change `sm:` to `@xl:` (and put `@container` on the card), because a
narrow card can occur on a wide screen once it splits into several columns.

**A landing page whose groups differ in height** (System Admin: 6 chapters with 2–5 cards each): an
`auto-fit` grid leaves blank space under the short groups, and the last row leaves empty cells when
the group count does not divide evenly by the columns. Use CSS multi-column instead — groups flow
down one column at a time, in order.

```tsx
// 20rem = minimum column width · the number after it = the column-count ceiling (= group count)
// without the ceiling a 4K screen gets 10 columns, half the screen empty
<div className="gap-x-5" style={{ columns: `20rem ${CHAPTERS.length}` }}>
  <section className="@container mb-5 break-inside-avoid">
    {/* group heading */}
    <div className="grid gap-3 @xl:grid-cols-2">{/* cards */}</div>
  </section>
</div>
```

- `break-inside-avoid` goes on the group, not the card — a group must not be split across columns
  (the third card showing up in the next column with no heading).
- Columns can therefore differ in height (groups cannot be split) — acceptable, because groups have
  no frame; they are not the paired cards of rule 4.
- Measure: the number of columns (distinct `left` values of the groups) and the card width, which
  must be around 280–400px at every screen size (System Admin: 1 / 2 / 3 / 4 / 6 columns at
  390 / 768 / 1366 / 1920 / 3840).
- Landing cards **must not carry hard-coded statistics** ("14 roles · 87 permissions") — they look
  like real data but are not. A number must come from the API · and every page in the module's left
  menu must have a card on the landing page.

## Tables (list pages)

List pages are already full-width and compact. The one place that breaks rule 2 is **a table with
only a few short columns**: `DataGrid` divides the width in proportion to `size`, so on a 4K screen
the columns end up thousands of pixels apart.

```tsx
{ accessorKey: "period", size: 240, … },
{ accessorKey: "start_at", size: 195, … },
// the last column takes the rest → the two columns before it are fixed-width, so the
// left-aligned content stays close together
{ accessorKey: "status", size: 110, meta: { grow: true }, … },
```

For a table with a long-text column (description), put `grow` on that column instead. Set `size` so
the total fits at tablet (see the gotchas in `SKILL.md`). The `size` of the grow column is its
minimum width. Truncate long-text cells with `block truncate` + `title` by the column width, not a
fixed `max-w-*`.

**Pages that configure a pattern** (running-code) add a column showing the pattern's real result
(rule 8) — the sample document number `PR26110001` in the table, without opening a dialog row by
row.

**A table whose columns do not fit the 662px box at tablet** — choose by the measured width of the
box, not the screen:

```tsx
// page: wrap the DataGrid in a measuring box (subtract DataGridContainer's 1px border on each side)
const [setGridBox, gridBoxWidth] = useElementWidth();
const table = useXxxTable({ …, containerWidth: gridBoxWidth == null ? undefined : gridBoxWidth - 2 });
<div ref={setGridBox}><DataGrid table={table} …>…</DataGrid></div>

// table hook: undefined (not measured yet) = the wide-box set
const w = containerWidth ?? Number.POSITIVE_INFINITY;
```

- **Many columns (document, 6 columns):** hide secondary columns in steps through
  `state.columnVisibility` — uploader ≥1060 · type ≥890 · sequence number ≥800. Whatever is hidden
  must still be reachable another way (the type icon moves in front of the file name; the uploader
  is in the preview view).
- **Few columns but wide values (user: name, email, department):** do not hide; swap between two
  `size` sets — box ≥900: name 240 / email 280; below that 180 / 190. The last column (department)
  is the grow column.
- Write each step's `size` total in a comment above the step function. Recalculate whenever a column
  size changes.
- On a page without `"use no memo"`, resize the box live and confirm the columns swap (React
  Compiler may freeze the JSX).

**A plain HTML table (`<table className="w-full">`)** — the browser shares the remaining width among
all columns. Make data columns as wide as their content with `w-px whitespace-nowrap` (+ `pr-10` as
spacing) and let the last column (row buttons, right-aligned) take the rest. Content in a `w-px`
column must not `flex-wrap`, otherwise the column shrinks to its widest piece and labels drop to a
new line.

If the table has a long-text column (subject, description), make that column the single elastic one:
`<td className="w-full max-w-0">` + `<span className="block truncate" title={…}>` (`max-w-0` stops
the cell from pushing the table wider to fit the text). Give its header `min-w-40`, and the button
column goes back to `w-px`. Do not use a fixed `max-w-*` on long text — the subject gets cut at
256px even though the screen has room, and combined with other nowrap columns the table overflows at
1366px.

A table whose minimum width exceeds the box: switch to a stacked list by the box width
(`@container` + `@xl:hidden` / `hidden @xl:block`), building the row's parts (name, status, buttons)
once and using them in both forms. **The switch point = the table's measured minimum width**, not
one value for every page: email-profile (4 columns, ~610px) switches at `@xl`; email-template
(5 columns, ~890px) switches at `@4xl`. Measure `table.offsetWidth` against
`table.parentElement.clientWidth` at every size, including 1024 and 1180.
Examples: `routes/system-admin/email-profile/`, `routes/system-admin/email-template/`

## Bars (footer status bar, toolbar, summary bar)

A bar with two sides pushed left and right (`justify-between`) overlaps when it chooses what to show
from the screen width.

```tsx
<footer className="@container flex items-center justify-between gap-3 …">
  <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
    <span className="truncate">{name}</span>
    <span className="hidden shrink-0 @md:inline">{buCode}</span>
  </div>
  <div className="flex shrink-0 items-center gap-3">
    <span className="hidden @md:flex">{time}</span>
    <span className="hidden @4xl:flex">{apiVersion}</span>
  </div>
</footer>
```

- Order things by importance; less important things appear as the bar gets wider.
- Hidden things must still be reachable another way (tooltip, `aria-label`, or present elsewhere on
  the page).
- Text `truncate`d down to a few characters ("Admi…") means too much is still showing — hide more.

**A summary bar above a table** (total + breakdown + "view all" link on the Document page): every
piece sits together on the left, not total-left / breakdown-right, and they go horizontal once the
bar itself is wide enough (`@container` + `@xl:flex-row`).

**The search bar of a list page** (rule 12): search box → View button → Filter button, together on
the left. Always use `ListToolbar`. If you must lay it out yourself, the wrapper around the search
box must not stretch from `md` (the search box has a fixed width at that size):

```tsx
<div className="flex w-full items-center gap-2">
  <div className="flex-1 md:flex-initial"><SearchInput … /></div>
  <ViewSelector … />
  <ListFilter … />
</div>
```

Measure the distance from the search box's right edge to the View button's left edge — it must be
the same at every screen size from tablet up (17px).

**Form header buttons** (rule 13): one line at every screen size. When the header is narrower than
576px, secondary buttons become icon-only.

```tsx
// DocFormHeader — the header is a named container
<div className="@container/doc-header relative">…</div>

// secondary button: the label sits in a span hidden when the header is narrow + title for hover
<Button variant="outline" size="sm" title={tc("delete")}>
  <Trash2 />
  <span className="@max-xl/doc-header:sr-only">{tc("delete")}</span>
</Button>
```

- The primary button (Edit / Save) always keeps its label · secondary = Cancel, Delete, Print,
  Comment, Activity
- `sr-only`, not `hidden` — the label is still the button's name for screen readers and for tests
  that find buttons by text
- The order must not change: Edit/Cancel·Save → Delete → page buttons → Comment → Activity, and they
  must not collapse into a ⋯ menu (the user reversed that, 2026-10-29)
- Numbers: the button row with labels is ~440px wide · icon-only it is ~275px (Edit 62 + icons
  34×4 + gaps), which fits the 302px box of a 390 screen and the 272px box of a 360 screen · the
  576px switch point = wider than the labelled row by enough to keep the document name on the top
  line
- The container name does not exist outside the form header, so the same button used elsewhere
  (`PrintDocumentButton`) keeps its label as normal
- Older code that uses a screen breakpoint: `DocActions` (`max-xl:sr-only`) — not yet moved to the
  container

Steps of `status-bar.tsx`: narrower than 448px shows name · period code · App v → time + BU code +
"Period" label (`@md`, 448px) → commit hash (`@2xl`, 672px) → full "Inventory period" label + API
version (`@4xl`, 896px)
