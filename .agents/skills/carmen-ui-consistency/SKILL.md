---
name: carmen-ui-consistency
description: Build new Carmen Blue frontend pages by reusing the repository's existing layout, components, tokens, and interaction patterns. Use when creating or substantially changing React pages, routes, list views, detail views, forms, settings, tables, filters, or toolbars in the Carmen Blue frontend.
---

# Carmen Blue UI Consistency

## Non-negotiable rule

A new page must look and behave like an existing page of the same family before adding custom UI. Reuse shared components first; create a new component only when an existing one cannot express the requirement.

Treat existing shared Carmen Blue components as locked. Do not change their API, layout, or styling for a feature-specific requirement unless the user explicitly requests a shared-system change. Adapt the consuming page with local composition, wrappers, or feature-local components instead.

## Adaptation boundary

When a supplied mockup or specification introduces a new workflow, preserve its information architecture and interaction intent while rendering it with Carmen Blue's existing visual language and shared components.

- Reuse Carmen Blue headers, actions, fields, tables, dialogs, sheets, footers, spacing, and tokens; do not pixel-copy an external mockup's shell or styling.
- Keep established actions such as Back, Save, Save Draft, Submit, Edit, Delete, and Activity in the shared Carmen Blue header/toolbar/footer positions.
- Use `SummaryFooterBar` for sticky totals and persistent document actions. Extend it only when the same missing composition is needed by multiple pages.
- Use the existing borderless `DataGrid` treatment. Do not wrap tables in a new bordered card or add vertical cell borders merely because the mockup does.
- A genuinely new click flow is allowed: compose it from existing `Dialog`, `Sheet`, `ConfirmDialog`, `WarningDialog`, and shared controls.
- Prefer a detail route over an oversized dialog when the form cannot remain usable on mobile.
- Extract a new shared interaction only after it recurs across at least three pages; otherwise keep it feature-local.

## Required workflow

1. Identify the closest reference page (list, detail, settings, form, or report).
2. Open the reference page in the Browser and exercise the exact target state (view, blank create, or edit). Source inspection alone is not enough because action placement changes by mode.
3. Read its route, representative component, and any shared primitives it uses.
4. Copy the page skeleton and composition pattern before changing labels or domain fields.
5. Use shared components for headers, toolbars, buttons, fields, selects, filters, tables, cards, empty states, loading states, and responsive layouts.
6. Keep existing spacing, typography, sizing, border radius, status colors, and responsive breakpoints. Do not invent one-off values without a documented reason.
7. Verify all states: loading, empty, error, view, edit, disabled, long text, mobile, and permission-restricted actions.
8. Before handoff, use the Browser to inspect the changed page and its reference at the same viewport. Verify visible action labels and measure bounding boxes when spacing is disputed. If Browser verification is unavailable, state that the visual result is unverified instead of claiming completion.
9. Run TypeScript, the relevant build, and React Doctor.

## Procurement-style document actions

When a document is intended to follow the current PR detail flow, verify against the live PR state and preserve this placement:

- View: `Edit` and `More` in `DocFormHeader`.
- Blank create: `Cancel` and `Save` in `DocFormHeader`; `Submit` in the sticky footer.
- Edit existing: `Cancel`, `Save`, and `More` in `DocFormHeader`; `Submit` in the sticky footer.
- Use `DocFormHeader` with its default spacing. Do not pass `flush` unless the live reference page also does; removing its left inset can clip the absolute Back button.
- Do not add New, Copy, Template, AI, Attachments, or Log actions merely because an older prototype contains them.

## Accounting voucher family

Apply the same shell consistently to Journal Voucher, Template Voucher, Recurring Voucher, and Allocation Voucher in view, create, and edit modes:

- The Back/title/action header sits directly on the page background with no card, border, or separate toolbar background.
- General information, approval/source/status, and accounting-entry sections are frameless: no outer Card border, card background, rounded card shell, or shadow.
- Internal separators and table header/row dividers may remain when they communicate structure; do not turn the whole section back into a card.
- Audit all four voucher types after changing the shared consumer page. A Journal Voucher-only visual check is insufficient.

## Component reuse map

- Page title: `DocumentListHeader`
- Detail header/actions: `DocFormHeader`, `FormToolbar`, `BackButton`
- List toolbar: `SearchInput`, `StatusFilter`, `DataGridSortMenu`, `DataGridColumnVisibility`
- Tables: `DataGrid`, `DataGridTable`, `DataGridContainer`, `DataGridColumnHeader`
- Settings/forms: `SettingSection`, `Field`, `FieldLabel`, `FieldInput`, `FieldPlainText`
- Cards and mobile list: `ListCard`, `ListCardRow`
- Actions: shared `Button` variants and sizes, normally `size="sm"` in toolbars
- Sticky totals/actions: `SummaryFooterBar`
- New interaction surfaces: existing `Dialog`, `Sheet`, `ConfirmDialog`, `WarningDialog`, `DeleteDialog`
- Feedback: existing empty, skeleton, toast, badge, and error components

## Review gates

- No raw `<select>`, ad-hoc search input, or bespoke table when a shared equivalent exists.
- No oversized page title or primary button compared with the reference page.
- No duplicated header/card/toolbar patterns without a strong reason.
- New reusable patterns must be extracted and documented instead of copied three times.
