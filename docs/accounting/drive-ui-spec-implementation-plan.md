# Accounting UI Specs — Implementation Plan

Frontend-only interactive mockup work is scoped separately in [Accounting UI Mockup — Frontend-Only Plan](accounting-ui-mockup-frontend-plan.md).

## 1. Source and decision

Drive connection verified 2026-09-28. The folder is accessible; this is a reviewed snapshot, not an automatic sync. Inventoried the folder and read the latest FRDs for GL/JV, AP Invoice, AP Payment and AR Invoice. The previously reviewed master-data and dashboard references remain in scope:

- `GL`: Journal Voucher FRD V2.14 and fast-entry HTML
- `Master Data`: Title, Asset Category, JV Prefix, WHT Service Type, WHT Form, Payment Type, Account Code Grouping, Dimension, Cost Center, and COA
- `AP`: Dashboard, Invoice FRD v4.5.06, Payment FRD v2.16, Payment Approval/Payment, plus the latest root AP mockup
- `AR`: new Invoice FRD v1.07 and HTML mockup (added 2026-09-27)

The Google Docs FRDs are the business-rule source. The latest HTML in each folder is a visual and interaction reference, not a database or API contract. Older HTML versions are reference history only unless a newer FRD explicitly preserves their behavior.

Implementation must extend the existing Carmen Blue React patterns and accounting documents. Do not port the standalone HTML, CDN dependencies, local mock persistence, or Supabase proof-of-concept code.

## 2. Current repository state

| Area                           | Current state                 | Main gap                                                                                 |
| ------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------- |
| Accounting foundation          | Designed                      | Backend/runtime contracts still need end-to-end verification                             |
| GL Journal Voucher             | Interactive UI prototype      | Save Draft, balanced Submit, Copy, Void and Reverse use the in-memory repository; HTTP adapter and production integration pending |
| AP Dashboard, Invoice, Payment | Interactive UI prototype      | Invoice mock checks duplicate vendor numbers, generates input-tax fields at Submit and links posted open invoices to Payment; Payment mock posts at Submit/final approval. Backend integration pending |
| AR Invoice and Receipt         | ARIV-specific UI preview; Receipt generic | No AR domain repository, server actions, five-document lifecycle, tax/folio/settlement contract |
| COA                            | Existing config CRUD          | Model is limited to code, descriptions, nature, type, status, and control-account fields |
| Department                     | Existing shared config module | Must be reused as the Cost Center base instead of duplicated blindly                     |
| Remaining accounting masters   | Not implemented               | No routes, types, hooks, API adapters, permissions, or dependency checks                 |

Relevant existing implementation:

- `routes/accounting/accounts-payable/`
- `routes/accounting/journal-voucher/`
- `routes/config/chart-of-accounts/`
- `routes/config/department/`
- `components/templates/config-list-template.tsx`
- `lib/http-client.ts`

## 3. Cross-module rules

These rules repeat across the Drive specs and should be one backend/API convention with reused Carmen Blue UI behavior:

1. Scope every master by Business Unit/property where applicable.
2. Normalize codes with trim and uppercase; enforce case-insensitive uniqueness in the database.
3. Make the code immutable after creation.
4. Show status as a badge in lists and edit status through the detail form.
5. Validate deactivation and deletion on the backend against active references and transaction history.
6. Return dependency details for the blocking dialog; never reproduce reference counting in the browser.
7. Use optimistic concurrency through `doc_version` and return the updated snapshot after mutation.
8. Return capabilities from the backend; do not infer create/update/delete/approve permission from status alone.
9. Record create, update, status change, blocked attempt, and delete in the shared audit/activity model.
10. Keep CSV/XLSX export server-filter aware. Reuse the existing list/export infrastructure where dataset size permits.

Required common error additions:

```text
409 DUPLICATE_CODE
409 VERSION_CONFLICT
422 DEPENDENCY_BLOCKED
422 NON_ZERO_BALANCE
422 INVALID_ACCOUNT_MAPPING
422 INVALID_DIMENSION_MAPPING
403 CAPABILITY_DENIED
```

`DEPENDENCY_BLOCKED` should include module, reference type, count, and optional authorized deep link. It must not expose records outside the user's BU or permission scope.

## 4. Target route map

Reuse existing configuration routes for shared master data and accounting routes for transaction work:

```text
/config/chart-of-accounts
/config/departments                         # UI label may be Cost Centers
/config/accounting/account-groups
/config/accounting/dimensions
/config/accounting/jv-prefixes
/config/accounting/payment-types
/config/accounting/wht-service-types
/config/accounting/wht-forms
/config/accounting/titles
/config/accounting/asset-categories

/accounting/journal-voucher
/accounting/accounts-payable
/accounting/accounts-payable/invoice
/accounting/accounts-payable/payment
/accounting/accounts-receivable/invoice
/accounting/accounts-receivable/receipt
```

Do not add separate Cost Center storage until backend analysis proves Department cannot carry the required accounting fields. Preferred model: extend Department with accounting group, allowed-account mappings, active/dependency rules, and accounting display metadata.

## 5. Delivery slices

### Slice 0 — Contract and ownership decisions

Backend and frontend agree before adding pages:

- canonical IDs, BU scope, `doc_version`, audit fields, list query shape, capability shape, and dependency error shape
- Department versus Cost Center ownership
- Dimension count: Drive specs conflict between 10 and 20; choose one backend capability-driven limit
- WHT Form versus WHT Service Type ownership and foreign-key direction
- shared activity log versus module-specific dependency-log tables
- accounting API prefixes and OpenAPI schemas

Exit criteria: approved OpenAPI/schema decisions and no unresolved ownership ambiguity for COA, Department/Cost Center, Dimension, WHT, or AP posting.

### Slice 1 — Accounting master foundation

Build the smallest reusable layer needed by the repeated master screens:

- server-side list/search/status filter/pagination
- create/update/status/delete mutations with `doc_version`
- capability-aware actions
- reusable dependency-blocked dialog using backend details
- active-status badge and code-lock behavior using existing Carmen Blue components
- audit/activity readback
- route/menu/permission registration

Do not create a generic schema-driven form builder. Reuse `ConfigListTemplate`; keep each domain form explicit because validation and dependencies differ.

Verification: contract tests, duplicate-code race test, stale-version test, dependency authorization test, list loading/empty/error/mobile states.

### Slice 2 — Foundation masters

Implement in dependency order:

1. **Account Code Grouping** — L1-L4 tree, ordering, active status, child/account dependency protection.
2. **Dimension** — dimension categories and values/sub-codes, active status, one default sub-code per account/dimension where configured.
3. **Department/Cost Center extension** — group, status, allowed account mappings, transaction dependency protection.
4. **COA enhancement** — category-driven nature, mandatory grouping path, allowed departments, allowed dimensions/sub-codes, one default sub-code per dimension, external key/value tags, balance/deletion guardrails, control-account policy.

COA must move from the current modal-only core CRUD toward the FRD's full-screen editor only when the additional sections no longer fit the existing dialog accessibly. Preserve the existing import action and control-account fields.

Verification: hierarchy cycles, inactive parent behavior, invalid account/dimension combinations, default-sub-code uniqueness, non-zero balance deactivation, used-account deletion, and manual posting restrictions.

### Slice 3 — Simple accounting masters

Implement these with explicit forms on the shared master foundation:

| Master           | Required fields/behavior                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Title            | code, description, status, system-reserved protection, AR/PMS dependency check           |
| JV Prefix        | 2-10 character code, EN/TH descriptions, system prefix protection, JV history dependency |
| Payment Type     | code, description, payment method/config fields from final FRD, AP/payment dependency    |
| WHT Service Type | code, description, rate with decimal bounds, status, vendor/AP dependency                |

Export is lower priority than correct mutation, dependency, permission, and audit behavior.

Verification: normalization, uniqueness, immutable code, system-record protection, referenced-record deactivation/delete, export filter parity.

### Slice 4 — Composite masters

1. **WHT Form**
   - code and description
   - GL account and Cost Center mapping
   - account-driven dimension categories and values
   - reset dependent Cost Center/dimension values when account changes
   - vendor/AP/WHT reconciliation dependencies

2. **Asset Category**
   - code, description, integer asset life
   - three required account/Cost Center legs: asset cost, accumulated depreciation, depreciation expense
   - validate account category/nature for each leg
   - inheritance contract for Asset Register
   - asset register/disposal dependency protection

Verification: mapping validity at effective/posting date, account-change reset, three-leg completeness, inheritance snapshot, and dependency rules.

### Slice 5 — AP backend integration

Keep the current AP screens, replace only the repository implementation behind `use-accounts-payable.ts`:

- HTTP repository selected by environment/config; mock remains test/dev fixture only
- server-side invoice/payment directories
- canonical duplicate invoice check
- PO/GRN matching and tolerance results
- tax invoice and WHT rule resolution from master data
- workflow assignments and backend capabilities
- posted open items, reservation/application, payment proposal grouping
- Submit/Post (เมื่อไม่มี LOA) หรือ final approval (เมื่อมี LOA) สร้าง PV posting/JV และตัดหนี้ทันทีใน backend transaction เดียวตาม AP Payment FRD v2.16; bank execution/reconciliation ติดตามแยกจาก posting
- activity, source evidence, generated JV, and reconciliation links

Do not redesign AP screens during adapter integration unless the API exposes a missing required state. This keeps visual changes separate from accounting-integrity changes.

Verification follows `accounts-payable-implementation-readiness.md`; no capability becomes `integrated` until frontend adapter, backend endpoint, contract tests, and smoke tests pass together.

### Slice 6 — GL integration and reconciliation

- replace JV mock repository with HTTP adapter
- bind JV prefix, COA, Department/Cost Center, and Dimension lookups to active/effective master data
- enforce source-generated JV read-only policy
- connect AP Accounting Events through the posting contract
- add AP control-account reconciliation drill-down
- verify schedule, auto-reverse, period lock, idempotency, and source trace

Do not copy the Drive GL page's Supabase setup, dark-mode implementation, Swagger screen, or local master editor. Existing Carmen Blue shell, theme, API client, and configuration modules own those concerns.

### Slice 7 — AR contract and implementation (new 2026-09-27)

The AR FRD v1.07 adds five document kinds: Invoice (ARIV), Credit Note (ARCN), Debit Note (ARDN), Advance Deposit (ARDP), and Receipt/Tax Invoice (ARRC). The `/accounting/accounts-receivable/receipt` route still uses the generic `accounting-document-*` mock; the ARIV route has a domain UI preview without server actions. Complete the AR lifecycle only after its backend owner confirms the posting and settlement contracts.

**UI progress 2026-09-28:** `/accounting/accounts-receivable/invoice` now has an ARIV-specific list and detail preview. The detail includes the FRD header, item grid/detail sheet, tax register, deposit reference, receipt/open balance, Manual GL preview, PMS no-repost message, and two-currency footer in the Carmen Blue shell. The screen explicitly marks server actions as pending; no ARIV Submit, tax-number allocation, approval, deposit settlement, receipt creation, or GL posting is simulated as a successful backend operation. Existing legacy `Carmen.WebApi/Controllers/ArInvoiceController.cs` is available for contract comparison but must not be assumed to implement the v1.07 rules.

**FRD correction needed before Deposit JV:** §6.4 example says Dr `3,370.50 + 727.60 = 4,098.10` and Cr `3,150 + 220.50 + 749 + 21.40 = 4,098.10`, but that credit sum is `4,140.90`. The stated FX gain sign also does not balance the entry. Confirm the offset posting direction and FX account sign with Accounting before implementing or exposing it as a balanced JV.

1. Agree on AR Profile/customer, PMS folio ingestion, tax invoice running, period policy, LOA capabilities, open items and idempotent GL event contracts. Preserve the existing source-generated JV read-only rule. PMS folio invoices must not post revenue/AR twice after night audit.
2. Replace the generic AR mock with domain list/detail and a repository boundary. Start with ARIV and ARRC, then ARDP and document application, then ARCN/ARDN. Add routes for the latter three only with their domain operations and permissions.
3. Implement invoice lines, tax invoice register, document references, receipt history and GL trace in the existing Carmen Blue shell. Tax invoice numbering is separate from document numbering and assigned by the backend. Invoice WHT amount is informational at invoicing; recognize WHT at receipt.
4. Make application/settlement atomic on the backend: same BU/customer/currency policy, available balance, folio amount cap, realized FX, period validation, tax adjustment and rollback on failure. ARRC must clear the correct open item; ARDP must reduce aging only when applied.
5. Verify duplicate submission, partial receipt, over-application, closed period, PMS replay/no double posting, tax-number uniqueness, cross-BU isolation, masked guest/card data, AR aging against open items and AR control-account reconciliation against GL.

### Delta and decision log for the newer Drive FRDs

| Source | Change to carry forward | Contract decision before coding |
| --- | --- | --- |
| [AR FRD v1.07](https://drive.google.com/file/d/1Fje9Y-DFfRJhLmjhS8_WdJxabM4PxMVl/view) | New AR scope and five document types; tax invoice sequence, PMS folio, deposit application, receipt and realized FX | Define source ownership, posting event types, tax-number allocation and open-item/application schema. |
| [AP Invoice FRD v4.5.06](https://drive.google.com/file/d/1hrpqTFJbx19WRSKAiDnd-B9X24VlcS7v/view) | Explicit APIV/APDN/APCN/APDP, Tax Invoice and Doc Reference tabs, deposit offset and GL reversal, Excel import | Keep Phase 1 APIV priority; agree sign convention, tax timing, credit/deposit reference and posting rules before enabling other kinds. |
| [AP Payment FRD v2.16](https://drive.google.com/file/d/1pT3ApXgbpS736LP7IJ9LJ6AQiltcJHrB/view) | Single-voucher settlement, partial payment, Summary/Detail view, multiple bank allocations and up to three WHT services | **Decision 2026-09-28 (โอม):** post PV, create JV and apply open items immediately after valid Submit without LOA or final LOA approval. No Release/Execute prerequisite. Backend owns atomicity and idempotency. |
| [GL JV FRD V2.14](https://drive.google.com/file/d/1_XUdqEp2bJs_gctSTr8qk2-V9M6fdjFB/view) | Fast-entry actions, account-driven Cost Center/dimensions, period guard and auto-reverse | Align copy/reverse/void semantics and backend capabilities with source-generated JV policy before wiring actions. |

**Priority:** complete AP/GL accounting-integrity contracts before expanding their mock flows. AR contract discovery may run alongside that work, but AR posting cannot be implemented as a UI-only state change. The AP Payment posting-point decision above supersedes the older release/execute-first plan; the backend must still validate period, balance, permissions and duplicate requests before committing.

## 6. Backend work required

This frontend repository cannot complete the plan alone. Backend deliverables:

- migrations and unique/foreign/check constraints
- dependency queries and authorized reference summaries
- balance/usage guardrails inside the same transaction as status/delete mutation
- immutable audit events and blocked-attempt audit
- capability evaluation and RBAC/SoD enforcement
- active/effective lookup endpoints
- AP open-item locking, payment idempotency, WHT/FX calculation, posting events, and reconciliation
- OpenAPI plus test fixtures for frontend contract tests

Database constraints, not client validation, are the final protection for duplicate codes, one-default rules, referential integrity, and accounting balances.

## 7. Frontend test matrix

Every new or substantially changed page must cover:

- loading, empty, error, populated, view, create, edit, read-only, permission-denied, dependency-blocked, stale-version, and mobile states
- keyboard access, focus return, labels, dialog titles/descriptions, and destructive confirmation
- server pagination/filter/sort and URL state where applicable
- field normalization and backend field-error mapping
- no hidden mock fallback in production configuration
- `bunx tsc --noEmit`, targeted Vitest, React Doctor, and a production build before handoff

## 8. Recommended execution order

```text
Contract decisions
  -> Account Grouping + Dimension + Department/Cost Center
  -> COA enhancement
  -> WHT Service Type + WHT Form + Payment Type + JV Prefix
  -> Title + Asset Category
  -> AP HTTP integration
  -> GL HTTP integration + AP/GL reconciliation
  -> AR Invoice/Receipt + AR/GL reconciliation
  -> AR Deposit/Credit Note/Debit Note
```

The next implementation PR should close Slice 0 contract decisions for the master data and posting boundaries, then deliver one vertical master slice, preferably Account Code Grouping. It proves list, form, validation, permission, dependency, audit, and backend integration without coupling that delivery to AP payment complexity. AR contract discovery can proceed in parallel; its first vertical slice starts with ARIV/ARRC after the GL event and settlement contracts are agreed.
