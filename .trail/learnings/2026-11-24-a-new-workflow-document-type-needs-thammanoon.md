---
title: "A new workflow document type needs its own route before the workflow id route, and its list endpoint allowlisted before the frontend ships"
author: Thammanoon
date: 2026-11-24
branch: feature/ap-payment-workflow
cost: { minutes: 10, tokens: 53112 }
id: l-ec6adbb7
scope: repo
status: active
src: agent
touches:
  - routes/system-admin/workflow/wf-menu.test.ts
  - routes/system-admin/workflow/workflow-doc-type.route.tsx
  - messages/en.json
  - messages/th.json
  - routes/accounting/accounts-payable/payment/ap-payment-detail.tsx
  - routes/accounting/accounts-payable/shared/ap-http-repository.ts
  - routes/accounting/accounts-payable/shared/ap-status.ts
  - types/accounts-payable.ts
  - constant/api-endpoints.ts
  - constant/query-keys.ts
---

## Decided
Every workflow document type gets a static `workflow/<slug>` route registered before `workflow/:id`. AP Invoice shipped without it (FE #723), so its menu leaf silently opened the edit page with id "ap-invoice". It was fixed in the AP Payment branch. Adding the type to the hooks and menu alone is not enough.

## Watch out
- The workflow landing page counts workflows for every type card. Adding a type therefore makes every admin who opens `/system-admin/workflow` call the new list endpoint. If the endpoint's api_name is missing from the allowlist, that admin is logged out. Deploy order: backend → allowlist → frontend.
- Typecheck does not catch a missing route. Check by clicking the menu leaf.

In the code: routes/router.tsx (doc-type routes above `workflow/:id`, lazy `workflow-doc-type.route`), hooks/use-workflow.ts `WORKFLOW_DOC_TYPES`, wf-landing.tsx `WorkflowCount`; api_names `workflow.findAllApInvoice`, `workflow.findAllApPayment`.
