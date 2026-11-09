---
title: Editable DataGrid/useReactTable tabs must memoize columns+data or the browser freezes on…
author: Thammanoon
date: 2026-11-09
id: l-385b6813
scope: repo
status: active
touches:
  - vitest.setup.ts
  - "components/lookup/lookup-location.tsx#LookupLocation"
  - "components/lookup/lookup-unit.tsx#LookupUnit"
  - "components/ui/data-grid/data-grid.tsx#DataGrid"
---

## Decided
In this repo, any `useReactTable` + `DataGrid` tab with editable lookup cells (Radix
Popover/combobox like `LookupLocation`/`LookupUnit`) MUST memoize `columns` and stabilize
its derived data (row array, excludeIds), or entering **edit mode freezes the whole browser
tab** — a synchronous infinite loop, no console error.

**Why:** rebuilding `columns` (or passing a new derived-id array) on every render remounts
the lookup cells; the Radix ResizeObserver measurement then re-triggers render → remount →
measure forever. `jsdom` CANNOT reproduce it (the test setup polyfills `ResizeObserver` as a
no-op, `vitest.setup.ts`), so tests pass green while the real page freezes — verify editable
DataGrid tabs in a **real browser**.

## Watch out
wrap `columns` in `useMemo`; stabilize derived ID lists via a joined
string key + `useMemo` (e.g. `const key = ids.join("|"); const ids = useMemo(() => key.split("|"), [key])`);
memoize the row/data array too. `pd-unit-conversion-tab.tsx` is the canonical correct example
(it has an explicit comment about keeping `columns` stable). Bug was in
`routes/product-management/product/pd-location-tab.tsx` (fixed 2026-07-24).

Debugging signature: hard 30s+ renderer freeze (screenshot/CDP click times out), zero console
…

_From Claude Code's memory of this repo, last updated Jul 24._
