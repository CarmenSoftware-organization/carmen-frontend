---
title: "Line dimensions are switched on per business unit and per document, not by an environment flag"
author: Thammanoon
date: 2026-11-20
branch: feature/line-dimension-by-account-mapping
id: l-e27c91c8
scope: repo
status: active
replaces: l-b6676eae
src: agent
touches:
  - lib/line-dimension-scope.ts
  - hooks/use-line-dimensions-enabled.ts
---

## Decided
2026-11-20 the user removed the runtime env switch that hid line dimensions everywhere. Each business unit now chooses in Default Setting where dimensions start: none (default), from PR (PR, PO and GRN), from PO (PO and GRN) or GRN only, plus separate on/off for store requisitions and inventory adjustments. Front end and back end read the same keys with the same rules, so what the screen shows and what submit enforces never disagree.
A level that is switched off does not pass dimensions on: PR values are not copied into the PO (and not used to split PO lines) unless the BU starts from PR, and GRN copies from PO only when PO is on.

## Tried and ruled out
- Keeping the env flag as an outer gate: the back end cannot see it, so a BU with the config on would be blocked at submit while the screen showed no fields.
- Leaving store requisitions and adjustments on the old show-everything behaviour: removing the env would have exposed every dimension to every customer on deploy.

## Watch out
After deploy every BU, including dev ones that used to test with the env on, sees no dimensions until its config is set. When the BU starts from PO, a PO created from a PR is not checked at conversion (users can't enter dimensions before it exists); it is checked at GRN.

In the code: keys dimension.start-from / dimension.sr.enabled / dimension.ia.enabled · FE lib/line-dimension-scope.ts, hooks/use-line-dimensions-enabled.ts · BE micro-business master/dimension/line-dimension/line-dimension-scope.ts
