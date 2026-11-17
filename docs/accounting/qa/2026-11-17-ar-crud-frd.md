# AR form and CRUD verification — 2026-11-17

## Sources and scope

- [AR Profile & Contract FRD v1.2](https://drive.google.com/file/d/18Z0MXMvaXKF02uOQc3oqQ1AZip68xWXz/view) and [AR Profile mockup v1.2](https://drive.google.com/file/d/1niNZn7sSJi0GSpLSoTYBzi2DmdS2zmyF/view).
- Invoice uses the [general AR FRD v1.07](https://drive.google.com/file/d/1Fje9Y-DFfRJhLmjhS8_WdJxabM4PxMVl/view), modified 2026-09-27. Drive's November 17 timestamp is a viewed date, not a revision date.
- [Receipt folder](https://drive.google.com/drive/folders/1C03zIg5uKwk2vJoNKSZB9hRUHK-EbAfb) contains no files. Receipt form follows the general AR FRD; no separate Receipt FRD or HTML was available.
- This pass covers profile/contract placement and draft CRUD/forms. It does not implement the full invoice approval/LOA interface, Invoice Copy/Print/Add Folio, contract billing engine or receipt posting.

## Persistence

| Feature | Real API | Mock only |
| --- | --- | --- |
| Profile | Customer identity/type group, note, tax ID/branch/profile, credit settings, AR account, status and registered/billing/mailing addresses | Contact/person details, register date, entity switch, billing/mailing contacts and emails, payment/WHT defaults, attachments |
| Contract tab | Customer and accounting/tax/dimension lookups | Contract headers, lines and attachments; BU-scoped session storage |
| Invoice | Create/read/update/delete draft, supported header/line/reference fields and version checking | Tax entity overrides and deposit application; no effect on issued tax snapshots or real outstanding |
| Receipt | Customer details, posted-invoice selection and GL master lookups | Receipt CRUD, allocation, payment, WHT and tax form; no Receipt API found |

Mock data is scoped to the browser tab/session and business unit. Closing/resetting the browser context can lose it. Profile and Invoice retain the form after API success/local-storage failure; retry saves only the mock data and cannot create a second real document.

## Runtime evidence

Authenticated browser at localhost:3000, dev backend, BU CARMEN-FIFO; no API interception.

- Profile `QAR261117A`: created, opened, edited and deactivated through the UI. GET confirmed all three address types, preserved address IDs and credit term 30. Deleted through UI; subsequent GET returned 404.
- Invoice `ARIV26110001`: POST 200; GET 200. Initial totals: 2,000 subtotal − 200 discount + 126 VAT = 1,926. UI edit sent PUT 200 and incremented version 0 → 1; totals became 3,000 − 300 + 189 = 2,889. Multiline reference and account/cost center IDs survived. Draft journal preview balanced at 2,889 debit/credit. UI deletion confirmed by GET 404.
- Invoice API returned a valid cost center ID with a null code. Batch selected-ID lookups now resolve labels in Items, Tax, Journal and line details, without replacing IDs or saved tax rates.
- Contract `202600002`: created, viewed, edited and deleted within its saved Profile tab. One full accounting line produced 1,000 total. Profile view mode allowed contract CRUD independently.
- Receipt `ARRC-MOCK-06866F64`: copied/created, payment reference and bank edited, saved, reopened, edited and deleted. Only the original two mock samples remain.
- Receipt payment selectors use Account UUID and GL Cost Center UUID. Department master is not used. Actual calendar tests cover date-only values for receipt, payment and cheque dates.
- Void and Delete on Invoice had identical outline/destructive classes and computed color.

Responsive browser measurements cover 390, 768, 1366, 1920 and 3840 widths for the affected create/view/edit forms and line/payment dialogs. No page overflow was observed; Account/Cost Center buttons filled their fields. Dialogs remained inside the viewport. Screenshots were visually inspected at mobile and desktop sizes. The JSON companion records measurements and exact temporary IDs; Invoice view/edit measurements predate the added heading-readiness marker and are supplemented by screenshot/CRUD checks.

## Checks

- Full suite: **319 files passed, 2,655 tests passed, 5 existing todo**.
- `bun run typecheck` and `SKIP_VERSION_BUMP=1 bun run build:local` passed; version was not bumped.
- Scoped AR ESLint passed with the existing router Fast Refresh warning; `git diff --check` passed.
- Actual route/form tests include Receipt create/edit/delete, filtered export/print, customer tax defaults, calendar selection, Profile partial-save retry, Invoice payload/version/FX/tax validation, missing master labels and Contract line CRUD.
- Node 25.6.1, Bun 1.3.9 locally; CI pins Bun 1.3.13. CI itself was not run.
- Browser console had no errors after final navigation; the existing React Router HydrateFallback warning remains. Large pre-existing build chunks still produce the standard size warning.
- React Doctor identified component size/complexity and attachment index-key advisories. The customer-query state hydration issue was replaced with derived defaults and regression-tested. No broad style refactor was made for the remaining advisories.

## API and verification limits

- Tax2 WHT is rejected by the backend; its selector follows supported VAT profiles. WHT is represented in header/Receipt fields.
- Current AR backend calculates VAT as added tax; VAT-inclusive calculation from the FRD is not supported by its Tax Profile/line contract.
- Invoice references currently support matching posted credit notes. Deposit application is mock and does not settle API balances.
- Customer API does not accept the mock Profile fields. Customer use checks are enforced by the deployed API; the broader Folio/Receipt checks in the Profile FRD are not implemented by this frontend.
- Closed accounting period checks remain authoritative at backend Submit. This pass did not add a separate closed-period guard to Save Draft.
- No real posted invoice was created to exercise Receipt settlement. No Submit, Approve, Post, GL generation, bank clearing, tax issuance or filing action was executed. No deployment or commit was performed.
