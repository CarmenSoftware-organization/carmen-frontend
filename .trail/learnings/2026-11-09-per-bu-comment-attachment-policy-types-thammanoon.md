---
title: "Per-BU comment attachment policy (types+MB) merged 2026-10-15 in 3 repos, not deployed"
author: Thammanoon
date: 2026-11-09
id: l-d2c9f66d
scope: repo
status: active
touches:
  - lib/attachment-policy.ts
  - "routes/system-admin/interface/interface-list.test.tsx#config"
---

## Decided
Merged 2026-10-15 (merge commits): BE #836 (97a4d7fdd), platform #353 (e07d875d), inventory FE #321 (8ad4c165). **Not deployed.** Spec/plan: `docs/superpowers/{specs,plans}/2026-10-15-bu-attachment-policy*`.

Shape: `tb_business_unit.config` entries `attachment.allowed_types` (array of image|pdf|excel|word|csv|text) + `attachment.max_size_mb` (1–25, default 10; default types image+pdf = old behavior). Gateway `AttachmentPolicyService` (60s cache) replaced 138 copied checks in 46 comment controllers; multer cap 25MB; `GET api/:bu_code/attachment-policy`; BU-side PUT/PATCH api/business-units silently cannot change `attachment.*` (PUT re-attaches stored entries).

**Why:** a missing allowlist for api_name `attachmentPolicy.get` → 401 → logout (see new-api-name-401-logs-users-out); FE only calls it when a comment sheet / notes dialog opens.

## Watch out
deploy order BE → allowlist (curl GET attachment-policy with inventory x-app-id = 200 on every env) → platform → FE. Open product question left with user: cluster admins can set `attachment.*` via direct PUT /api-system/business-units/:id. Not hand-verified: platform section in browser, notes dialog, FE against backend without the endpoint. Group lists are duplicated in BE `attachment-policy.ts`, platform `src/constants/attachmentTypes.ts`, FE `lib/attachment-policy.ts` — change all three together. Related: vendor-comments.

_From Claude Code's memory of this repo, last updated Oct 15._
