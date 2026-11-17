---
title: "Line dimensions stay hidden from customers behind a runtime switch, off by default; accounting documents show them only by chart-of-accounts rules"
author: Thammanoon
date: 2026-11-17
branch: feature/hide-line-dimensions
cost: { minutes: 13, tokens: 123666 }
id: l-b6676eae
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/plans/2026-11-17-hide-line-dimensions.md
  - docs/superpowers/specs/2026-11-17-hide-line-dimensions-design.md
  - docs/superpowers/specs/2026-11-17-line-dimension-by-product-account-design.md
  - lib/runtime-config.ts
  - hooks/use-line-dimensions-enabled.ts
  - routes/accounting/documents/journal-line-dimensions.ts
---

## Decided
2026-11-17 the user decided line-level GL dimensions are not ready for customers. They must be hidden on every purchasing/inventory document (PR, PO, GRN, SR, stock-in/out), but the team must still be able to test them on local/dev. They are hidden by a runtime config switch that is off when the key is missing. AP/AR/JV keep dimensions, but show them only when the line's account has chart-of-accounts dimension rules (mandatory/optional) or allowed_dimensions. AP did not do this before and is being aligned with AR/JV.
Deriving an account for purchasing/inventory lines from the product, so those documents could also follow CoA rules, is backlog only (open questions are in the backlog spec).

## Tried and ruled out
- A hard-coded constant: it also hides the feature on local/dev, which blocks the inventory line-dimension work that shares the same gate.
- Removing the configuration.dimension license from every BU: it is manual per BU and also hides the config pages.

## Watch out
public/config*.json is gitignored. LINE_DIMENSIONS_ENABLED has to be added by hand in each env's config. If it is missing, dimensions stay hidden, which is the safe direction, but someone testing on dev without it will see no dimension fields and no error.

In the code:
- switch: RuntimeConfig.LINE_DIMENSIONS_ENABLED (lib/runtime-config.ts), checked first in useLineDimensionsEnabled() (hooks/use-line-dimensions-enabled.ts)
- accounting visibility: visibleLineDimensions() in routes/accounting/documents/journal-line-dimensions.ts
- specs: docs/superpowers/specs/2026-11-17-hide-line-dimensions-design.md, 2026-11-17-line-dimension-by-product-account-design.md
