---
name: carmen-blue-ui-design
description: Use when laying out or adjusting a CARMEN BLUE screen (form / settings / detail / list / shell bars) so it fills the screen width, stays compact, and is correct at all 5 screen sizes (mobile, tablet, 1366, Full HD, 4K) — or when the user says a page is "empty", "stretched", "not compact", "has blank space left and right", "text overlaps", "overflows" (Thai: "โล่ง" "ยืด" "ไม่ compact" "มีที่ว่างซ้ายขวา" "ข้อความทับกัน" "ล้น")
---

# CARMEN BLUE — screen layout

Rules the user set themselves. They cover **use of space** only — colour, type and primitives belong
to `docs/DESIGN.md` and the `/design-system` page.

## Start from the kind of page

Read the recipe section for your kind of page before editing — its gotchas live there, not here.

| Page | What to do | Recipe |
|---|---|---|
| form / settings / detail | Convert to `CompactSection` + `FieldGrid` | `values.md` §Forms |
| settings list (label left, value right, full row) | Turn each row into a `FieldGrid` cell | `values.md` §Lists |
| list whose items expand to show detail | collapsed = grid cell · expanded = full row | `values.md` §Lists |
| list split into groups, a few rows per group | Groups flow as columns with `auto-fit` | `values.md` §Lists |
| list you can add to / remove from (addresses, contacts) | Grid of cards, separate view-mode component | `values.md` §Lists |
| module landing page | Real things only; groups flow with CSS multi-column | `values.md` §Landing pages |
| list (`ListPageShell` + `DataGrid`) | **Do not change the structure**; fix only tables with few columns | `values.md` §Tables |
| list whose columns do not fit the box at tablet | Hide secondary columns / swap size sets by box width | `values.md` §Tables |
| table on a detail page | `grow` only when the box is wide; one card per row when narrow | `values.md` §Tables |
| list that is a plain `<table>` | Data columns as wide as their content + stack as a list when the box is narrow | `values.md` §Tables |
| shell bars (footer, toolbar, summary bar) | Let the bar decide from its own width | `values.md` §Bars |
| list page search bar · form header buttons | Rules 12 and 13 | `values.md` §Bars |

When done, check against `verify.md` every time — rules 1–3 can be broken without any error.

## Rules

1. **Full screen width at every size** — no `max-w-*` around the content, no empty heading column at
   the side. The only acceptable blank space is the shell gutter and internal gaps
   (`FormPageShell width="wide"`).
2. **A wider screen means more columns, not wider fields** — a value must stay next to its label.
3. **Decide from the box's own width, not the screen's** — container queries (`@md:`), not
   breakpoints (`md:`). The box is the screen minus a sidebar that can be collapsed or expanded.
4. **Sections that form a pair sit side by side on wide screens** (1700px and up); below that they
   stack. Cards in the same row must be the **same height** — `SECTION_PAIR` + `CompactSection`
   already do this. Hand-written cards in a multi-column grid must not use `items-start`.
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
    of the row. The right side of the bar may hold only table buttons (sort, column picker, view
    switch).
13. **Form header buttons stay on one line at every screen size** — in a narrow header, secondary
    buttons become icon-only and the primary button keeps its label. The order is unchanged and
    they are **never collapsed into a ⋯ menu**. Buttons a page adds to the header (children of
    `FormToolbar`) must wrap their label in `<ToolbarLabel>` and set `title`.

## What already exists — use it, do not write a second set

- `components/share/compact-section.tsx` — `CompactSection` (`count`, `action`, `first`,
  `frameless` = no card wrapper, for content that has its own frame such as a grid of item cards or
  a table), `CompactSectionSkeleton`, `FieldGrid` (`size="field"` | `"item"`), `SECTION_PAIR`
- `components/share/setting-field.tsx` — `SettingField`, the view-mode field: muted label + strong
  value, no border (prop `specimen` for rule 8, `fullWidth` = `@md:col-span-2`)
- `components/share/form-toolbar.tsx` — `FormToolbar`, `ToolbarLabel` (rule 13);
  `PrintDocumentButton` already follows it
- `components/list-filter/list-toolbar.tsx` — `ListToolbar`, both `variant="wrap"` and `"row"`,
  already puts View/Filter next to the search box. Do not write your own search bar.
- `hooks/use-element-width.ts` — `useElementWidth()` measures a box's width with ResizeObserver, for
  places where a CSS container query cannot do the job (columns / column sizes of a `DataGrid`)
- `DataGrid` column `meta: { grow: true }` — the column takes the remaining width
- `routes/system-admin/company-profile/company-profile-ui.tsx` — `ConfigField` (document code +
  label on top, value below) — still owned by the system-admin module. Another module that needs it
  must lift it into `components/` first (ESLint forbids `routes/<A>/` → `routes/<B>/`).

Finished pages to open as examples, one per kind (all under `routes/`):

| Kind | Example |
|---|---|
| form with paired sections | `system-admin/company-profile/` |
| settings list as `FieldGrid` cells | `system-admin/default-setting/` |
| expandable items | `system-admin/ask-ai/` |
| groups as columns | `system-admin/interface/` (list) |
| grid of cards, view mode as text | `vendor-management/vendor/` |
| view-only page | `profile/` |
| `DataGrid` with few columns | `system-admin/inventory-period/`, `system-admin/role/` |
| `DataGrid` picking columns by box width | `system-admin/document/`, `system-admin/user/` |
| plain `<table>` that stacks | `system-admin/email-profile/`, `system-admin/email-template/` |
| editor and preview split by card width | `system-admin/notification-template/` |
| landing page | `system-admin/` (`wf-landing.tsx` for an API-backed number) |
| shell bar | `components/footer/status-bar.tsx` |

## Gotchas

- **`@md:` does nothing without an ancestor that is a `@container`** — no error; the columns simply
  never split.
- **Do not make `components/ui/setting-section.tsx` compact across the board** — config-email and
  the vendor-management forms still use its heading-left-1/3 layout. The user has not asked to
  change those pages. Ask first.
- **Never write `max-w-4xl` or safe-area padding in the page itself** — they come from
  `FormPageShell` (`components/share/__tests__/form-page-shell.usage.test.ts` catches it).
- **Two adjacent fields that each span 2 columns land on separate rows in a 3-column grid** — keep
  to one wide field per section.
- **A skeleton must have the same structure as the real page**, otherwise the content jumps when
  data arrives.
- **Passing every screen size does not mean the form works** — press Save for real, then edit again
  within 3 seconds. Causes and fixes → `values.md` §Forms · how to try it → `verify.md` §Check real
  clicks.
- **Pages with an older learning that fixes their layout** (e.g. Ask AI) — `trail check` goes red.
  Save a new learning with `--replaces` and write the reason in the PR. Keep the other behaviours of
  the old learning.
