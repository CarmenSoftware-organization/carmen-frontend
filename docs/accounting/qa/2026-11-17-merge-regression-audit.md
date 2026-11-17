# Accounting merge regression audit — 2026-11-17

Reviewed local HEAD `ec4d1aad` against its first parent `7c74eabf` (the completed AP/AR/voucher work). The incoming parent is `bdfed579`; the merge base is `1540f292`. Incoming changes include typed dimension values (#619), editable JV lines (#617), and Recipe iPad layout (#618).

## Confirmed defects and repairs

| Area | Failure | Repair and regression evidence |
| --- | --- | --- |
| AR Invoice / Contract | Merge removed `round2`, `ReactNode`, `Textarea` and `FieldPlainText` imports while retaining their callers. Amount calculation and line dialogs failed. | Restore imports; test the actual line dialog and server-compatible totals. |
| AR response types | Three optional response fields were removed while existing callers still used them. | Restore subtotal, net and unpaid fields without reverting the new dimension type. |
| AR / Contract dimensions | New `dimension_id`/typed values met old `gl_dimension_*` readers and test fixtures. Contract session records from before the merge could no longer be displayed or preserved correctly. | Update readers to the shared formatter, migrate legacy session keys on read, and preserve values/counters on the next Save. Tests include lookup, text, date, number, `0` and `false`. No old-key API fallback was added. |
| AP dimension editor | Incoming change removed mandatory marks and account/rules loading/error guards. | Restore those guards with the new dimension key. Test pending account, mandatory marker, failed rules, Retry and the typed payload. |
| JV manual draft | Incoming #617 added `details.replace`, but the old component guard still rejected every line edit before calling the repository. This guard was already present on the incoming branch. | Allow manual draft replacement, preserve document version, and lock native generated lines while allowing their existing header-only edit flow. Tests cover component → repository → mocked HTTP and subledger read-only behavior. |

The Profile/Receipt CRUD implementation, partial-save retry guards, AR routes/menus and Contract tab, AR translations, lookup sizing, voucher shell and Void styling were not overwritten by the incoming merge. Repair changes are left in the working tree; no commit or deployment was performed.

## Current API and browser checks

- Read the dev gateway's live `/swagger` document. AR line dimensions accept `dimension_id`, optional `dimension_value_id`, and typed `value`. JV update documents `details.replace` for manual drafts and header-only updates when details are omitted.
- Read-only dimension master/value calls returned 200 with the new keys. An older local backend checkout still describes the old schema, so it was not used to infer a deployment failure.
- Opened the actual AR Invoice line dialog in a separate QA browser tab: all five sections rendered, quantity/price/discount recalculated, and no page overflow was observed.
- Opened an existing manual JV in view/edit mode, changed a comment locally, then cancelled. A subsequent API read confirmed its document version remained 0 and the test comment was not saved.
- The QA tab reported no console errors and was closed; the user's existing tab was left open.
- No API write, Submit, Approve, Post, bank action or tax action was executed in this audit.

## Verification

- Full suite: **322 test files passed; 2,674 tests passed, 5 existing todo**.
- Typecheck and production build passed. Build ran with `SKIP_VERSION_BUMP=1`; version remains 2.7.3.
- Full ESLint completed with **0 errors, 164 warnings**. The repaired source/test files passed scoped ESLint without warnings.
- Formatting checks for repaired files and `git diff --check` passed.
- Node 25.6.1 and Bun 1.3.9 locally; CI pins Bun 1.3.13. CI/deployment was not run.
