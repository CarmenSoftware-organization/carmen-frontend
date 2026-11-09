---
title: "Certification list \"Vendors holding\" counts"
author: Thammanoon
date: 2026-11-09
id: l-edd2e6ef
scope: repo
status: active
touches:
  - "components/templates/config-list-template.tsx#ConfigListTemplate"
---

## Decided
BE #832 (vendor-master-certificate findAll → vendor_count / expiring_count / expired_count) and FE #314 (Certification list columns) were both merged on 2026-10-15 (merge commits b8d34abb / ca50a53e). Neither is deployed.

**Why:** the FE treats missing counts as "—" rather than 0, so deploying FE first is harmless. The real numbers only appear after BE is deployed.

## Watch out
deploy BE before FE, or in any order. There is no new api_name, so no allowlist change is needed. The "expiring" (warning) badge has never been seen live because no dev vendor certificate expires within 30 days. "Expiring" means within 30 days, defined by `CERTIFICATE_EXPIRING_SOON_DAYS` in the micro-business service.

Side note: config lists (`ConfigListTemplate`) render `table-fixed` with equal-width columns. Neither per-column `size` nor a `w-*` header class has any effect there.

_From Claude Code's memory of this repo, last updated Oct 15._
