# Voucher CRUD — live API and UI verification

Tested 17 November 2026 against `https://dev.blueledgers.com:4001`, BU `CARMEN-FIFO`, using the authenticated local frontend. No API responses were mocked. The recorder logged real fetch responses; one expired-token request was retried successfully by the existing auth client.

## Results

| Menu                              | Create/read                                                                                                 | Update                                                                                                           | Delete                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Template Voucher (all-types view) | Amortize created through API; recurring created through `/template-voucher/new` UI. POST 201, GET 200.      | Amortize edited through UI: name, amount 1200 → 2400, line description; dates retained. PATCH 200.               | Both temporary records deleted through UI; DELETE 200, subsequent GET 404. |
| Recurring Voucher                 | Temporary record created through API; retained example created through UI. POST 201, GET 200.               | UI rename saved repeatedly with fresh versions. API-created line USD currency/rate 2 remained intact. PATCH 200. | Temporary record deleted through UI; DELETE 200, GET 404.                  |
| Allocation Voucher                | Temporary 2-line record created through API; retained 3-line example created through UI. POST 201, GET 200. | UI name, amount 1000 → 1500 and line description saved; ratios retained. PATCH 200.                              | Temporary record deleted through UI; DELETE 200, GET 404.                  |

All three menus use `/api/:bu/gl-jv-templates`. Template is the all-types view, not a separate backend `template_type`.

- Stale version PATCH: 409 `COMMON_DOC_VERSION_CONFLICT`; rejected write left name/version unchanged.
- Duplicate code POST: 409.
- Unbalanced recurring POST: 422 `GL_JV_TEMPLATE_NOT_BALANCED`.
- Empty optional currency/cost-center values accepted when creating through Template UI.
- Four temporary records removed; API lists and GET confirm removal. Existing records were not edited or deleted.
- JV count before/after: **4 → 4**. No Generate, Submit or Post action was invoked.

## Bug fixed during verification

The form default mapper, validation schema and PATCH input builder dropped API line `currency_id` and `exchange_rate`. Because PATCH replaces lines, an unrelated UI rename could clear those values. Optional fields now survive API read → form validation → PATCH, including null versus absent keys. Regression tests fail before the fix and pass afterward; live UI edits confirmed preservation.

## Two retained examples

| Code                         | Type       | Amount                                | ID                                     |
| ---------------------------- | ---------- | ------------------------------------- | -------------------------------------- |
| `DEMO-REC-20261117-904355`   | Recurring  | Debit/credit 1,000 THB                | `02af86a2-4f2c-4ee6-ad7f-0e49c56444b1` |
| `DEMO-ALLOC-20261117-904355` | Allocation | 1,200 THB; debit 60%/40%, credit 100% | `65b17b30-9d7f-4b72-93b8-a66e3109fda1` |

Both were created through the real UI, read back through the API, and are visible in Template's list and their respective type lists. **Active is off** so Generate All Due cannot generate journals from example data. They remain available for review/edit.

Structured request/status evidence and owned record IDs: [2026-11-17-voucher-crud-live.json](2026-11-17-voucher-crud-live.json).
