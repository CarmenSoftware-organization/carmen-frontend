---
title: "Backend already serves comment+attachment endpoints for many master entities; adding one is FE-only, and allowlist can be probed from the browser via the app's…"
author: Thammanoon
date: 2026-11-02
branch: main
cost: { minutes: 6, tokens: 46627 }
id: l-ae1e4812
scope: repo
status: active
src: agent
touches:
  - constant/api-endpoints.ts
  - constant/query-keys.ts
  - routes/product-management/product/pd-form-toolbar.tsx
  - routes/product-management/product/pd-form.tsx
  - routes/product-management/product/use-product-comments.ts
---

## Decided
- Product comments (PR #460) were FE-only: gateway `api/config/:bu_code/product-comments` (guards `productComment.*`) already existed, same shape as vendor-comments. Wiring = `createCommentCrud` + `EntityCommentSheet` (lazy) + `onComment` on `FormToolbar`.
- Backend tenant schema also has `tb_*_comment` for product category / sub-category / item group, unit, location, department, currency, tax profile, etc. Check `apps/backend-gateway/src/config/config_<entity>-comments/` before assuming backend work is needed.

## Watch out
- A new api_name not in the app allowlist logs users out (401 → token clear), it does not just hide the feature. Cheap check without a fixture record: in the Vite dev page, `const {httpClient} = await import('/lib/http-client.ts'); await httpClient.get('<endpoint>')` — reuses the in-memory token; 200 with empty data = allowlisted on that env.
- BU Demo (AVG) on the dev DB has zero products, so product-page UI can't be eyeballed there without creating data in a shared DB.
