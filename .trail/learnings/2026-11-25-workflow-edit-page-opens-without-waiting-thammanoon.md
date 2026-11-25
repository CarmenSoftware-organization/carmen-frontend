---
title: Workflow edit page opens without waiting for the product list; only the Products and Routing tabs wait for it
author: Thammanoon
date: 2026-11-25
branch: fix/workflow-edit-defer-products
cost: { minutes: 9, tokens: 222957 }
id: l-47482f36
scope: repo
status: active
src: agent
touches:
  - routes/system-admin/workflow/wf-detail-skeleton.tsx
  - routes/system-admin/workflow/wf-edit-content.tsx
  - hooks/use-product.ts
---

## Decided
2026-11-25: the workflow edit page sat on its loading skeleton for about 5 seconds because it waited for every product before opening. The product list is fetched 100 at a time, one page after another: T02 has 1,220 products, so that is 13 requests in a row. The page now opens as soon as the workflow and users arrive. Only the Products and Global Routing tabs show a skeleton until the products are in. Overview, the stage rail and stage details do not use products. The product counts they show come from the form's product ids.
The loading skeleton also now mirrors the real page layout (stage rail plus tabbed card), replacing the generic settings-form skeleton that made the page jump on load (PR #732).

## Watch out
- The Products tab builds its category tree and which categories start expanded only once, when it first shows. If it shows with an empty product list, the tree stays empty. Show it only after products have loaded.
- Users are a single request (one page), so they are still awaited. They were not the slow part.

In the code: routes/system-admin/workflow/wf-edit-content.tsx (isLoading = wfLoading || userLoading, passes productsLoading) · wf-detail.tsx (productsLoading → WfTabBodySkeleton in the routing/products TabsContent) · wf-detail-skeleton.tsx (WfDetailSkeleton, WfTabBodySkeleton) · useProductAll = crud.useListAll in hooks/use-product.ts
