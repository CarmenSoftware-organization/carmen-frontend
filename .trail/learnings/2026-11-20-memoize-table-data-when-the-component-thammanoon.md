---
title: "Memoize table data when the component opts out of the compiler, or the tab freezes"
author: Thammanoon
date: 2026-11-20
standing: true
id: l-f25a047d
scope: repo
status: active
src: init-review
---

## Watch out
- The stock replenishment wizards opt out of React Compiler and built a new row array every render. The table's auto page reset then caused an infinite render loop that hung the tab when a dropdown opened, with no console error.
- In the code: In `stock-repl-pr-wizard.tsx` and `stock-repl-sr-wizard.tsx`, and any component with `"use no memo"`, wrap the `data` passed to `useReactTable` in `useMemo` with proper deps. Diagnose by counting renders and DOM mutations.

_From PR #697 here, Nov 19._
