# Payment Type / WHT master live CRUD QA — 2026-11-18

Environment: local frontend at `http://localhost:3000`, live Dev backend at
`https://dev.blueledgers.com:4001`, BU `CARMEN-FIFO`.

All three lists initially returned HTTP 200 with zero rows. The frontend now uses
live master CRUD, account mapping, bank accounts, dimension values, cheque-form
metadata and dependency endpoints; no session fixture fallback remains.

## Saved test records

These six records remain active in Dev, verified with fresh list and by-ID GETs
after page reload. WHT Service rates are test data.

| Master | Code | ID | Version | Rate |
|---|---|---|---:|---:|
| Payment Type | QA-PAY-01 | dd4b31ab-5853-42ca-a113-30280e3024e1 | 1 | — |
| Payment Type | QA-PAY-02 | 4dfce8d3-4f35-4be1-ba3e-aa26357407d1 | 1 | — |
| WHT Form | QA-WHT-01 | 775be5e2-f342-4d4a-9cd5-da7bc4baa204 | 1 | — |
| WHT Form | QA-WHT-02 | f61fd006-60d7-4517-93cb-605d87ff359e | 0 | — |
| WHT Service Type | QA-SVC-01 | 2296afe6-c50d-4c0a-9692-59c879928b92 | 3 | 3% |
| WHT Service Type | QA-SVC-02 | 7e74fbd7-2fa1-47af-b6c6-596b965126f5 | 0 | 5% |

## Verification

- Created the first record of each master through its actual UI dialog (HTTP 201).
  Created the second of each through the authenticated application HTTP client.
- Updated Payment Type, WHT Form and WHT Service Type from their UI dialogs;
  fresh reads confirmed values and incremented `doc_version`.
- Deactivated QA-SVC-01 through the UI after the live dependency check; restored
  it to active through the API. All six retained records are active.
- Created one temporary `*-DEL` record per master, deleted each through the UI
  dependency/confirmation flow, and verified none remains in the lists.
- All three reject stale version updates and duplicate codes with HTTP 409.
- Exact-code searches return one row. Pagination/sort and active-state filters
  were exercised against the live API.
- Payment Type rejects the missing Cost Center when its GL account requires it;
  selecting an allowed Cost Center permits saving. Bank defaults resolve from
  real bank-to-GL mapping. No accounting documents were posted.
- Related automated tests: 47 passed across 5 files. Includes HTTP contracts,
  dimension reference conversion, stable card pagination, dependency guards,
  dialog save payloads, precision validation, permission and license states.
- React Doctor: 93/100, no issues in the changed files.
- Typecheck and changed-file ESLint passed. Full ESLint: 0 errors, 164 warnings.
- Build and final Vite build passed with the existing large-chunk warning.
  The build script's incidental package version bump was restored.
- Shared Chrome layout gate passed at 390/768/1366/1920/3840 in light and dark.
  Actual master pages were checked at those widths without document overflow;
  Payment Type also checked at 640/767/820/1024/1180/1280. Inspected desktop
  English and mobile Thai/dark screenshots; restored locale and system theme.
- Preflight: Node/nvm v25.6.1; Bun 1.3.9. CI pins Bun 1.3.13 and does not pin
  Node. No runtime installations were changed.

## Limits

- No frontend deployment or commit was performed.
- The BU has no authorized cheque forms, so live cheque creation was not tested.
- Selected test GL accounts have no dimension rules; dimension round-tripping
  and mapping rules are covered by automated contract tests, not live saved
  dimension references. No existing GL configuration was changed for testing.
- Permission/license restrictions were tested with fixtures, not a separate
  non-admin live session.
- AP/AR document writers still use their existing payment/WHT contracts; master
  CRUD does not connect the new IDs to those documents.
