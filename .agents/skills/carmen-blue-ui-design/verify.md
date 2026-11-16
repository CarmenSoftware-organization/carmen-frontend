# Verify Carmen Blue layout and behavior

Use the browser automation or computer-use capability available in the current session. Read its
instructions and use supported viewport resizing and normal user interactions. The Claude
extension's `javascript_tool`, `tabs_create_mcp` and iframe-injection helpers are not prerequisites.
Do not inject a viewport iframe or native input setter to simulate clicks or bypass disabled fields.

## Viewports and measurements

Check the changed page and its reference at these sizes where the affected layout applies:

| Width × height | Target |
|---|---|
| 390 × 844 | Mobile |
| 768 × 1024 | Tablet |
| 1366 × 768 | Laptop |
| 1920 × 1080 | Full HD |
| 3840 × 2160 | 4K |

Also check narrow headers at 360/486, the list/card switch at 640/767 and responsive table steps
at 820/1024/1180/1280 when relevant. Test sidebar expanded and collapsed. Use real viewport
pixels for DOM measurements; screenshot coordinates can differ with scaling. Restore viewport,
locale and any temporary theme override when finished.

With read-only DOM inspection when supported, check:

- Page scroll width does not exceed the viewport width.
- A table's width does not exceed its frame; intentionally scrollable editable grids stay inside
  their own scroll container rather than creating page scroll.
- Footer/bar groups have a nonnegative gap and no clipped or overlapping text.
- Header buttons occupy one line and remain inside the header. Secondary actions become icon-only
  with accessible names; the primary action keeps its label. Preserve the established order.
- Search, View and Filter remain adjacent from tablet upward.
- Width-dependent table columns switch on live resize, retaining the user's column preferences.
- Framed paired sections align and have equal heights; skeletons match the real page structure.

Capture screenshots of relevant states. If a requested viewport or inspection capability is not
available, report that limitation; source inspection does not prove visual correctness.

## Exercise real behavior

Check view, create/edit, loading, empty, error, disabled and expandable states relevant to the
change. Use Thai at mobile and 1366 at least; check English and long text/data-dependent counts.
The app has no global dark-mode switch: use the design-system preview or a supported temporary
local theme override and state how it was checked. Do not add a theme feature for verification.

For a changed Save flow, use authorized reversible test data:

1. Record the original value, edit and Save through the real UI.
2. Once editing is enabled, change the same field back within roughly 3 seconds and Save again.
3. Reload and confirm the final value. Verify the saved `doc_version` is fresh and refetch does
   not overwrite dirty fields or leave Save disabled.

Relevant source patterns: `hooks/use-profile.ts` (`useUpdateProfile`) and
`routes/profile/user-profile-setting.tsx` update query cache before invalidating and preserve dirty
values; `hooks/use-business-unit.ts` (`useUpdateBusinessUnit`) awaits invalidation before returning
to view mode. Inspect the owning hook before choosing either pattern.

Do not bypass disabled controls. If a tool disconnects or reports an ambiguous result after an
action, inspect current state before retrying to avoid duplicate writes. On a shared dev database,
restore changed test values and remove test records; never overwrite an existing file/image or
use bulk delete for layout QA. Do not post accounting entries or close periods merely to test UI.

## Landing pages

- Compare destinations against `constant/module-list.ts`; titles and descriptions match the menu
  and destination headers. No fabricated counts, versions, business records or dead buttons.
- Unequal-height groups remain intact across CSS columns; measure group positions and card widths
  against the reference (typically 280–400px), not a hard-coded column count for every module.
- Check illustration clipping and raw translation keys; reload after translation changes.
- Open each affected destination and actually click a card. Confirm the intended route and absence
  of error UI using normal browser navigation.
- Verify allowed, locked, denied and hidden states, including an entirely hidden group and
  contiguous group numbering. Prefer existing tests/fixtures or an appropriate test account.
  If a temporary local simulation is necessary, remove it afterward and inspect the diff.
  Report simulated permission coverage separately from real non-admin verification.

## Handoff

A shared-component change requires checking its affected consumers. Run typecheck, relevant
lint/tests/build and React Doctor for React changes. Report which viewports, modes and interactions
were exercised, and name any unavailable or unverified states without claiming they passed.
