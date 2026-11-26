---
title: "Marking a whole account-mapping tab reviewed goes through a filter-based endpoint, not by sending row ids"
author: Thammanoon
date: 2026-11-26
branch: feature/coam-review-all-matching
cost: { minutes: 7, tokens: 124794 }
id: l-df9bfaf2
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/plans/2026-11-26-coam-review-all-matching.md
  - docs/superpowers/specs/2026-11-26-coam-review-all-matching-design.md
---

## Decided
2026-11-26 the user chose: "select all" on the Chart of Account Mapping page marks every row matching the current tab/search/filters reviewed with ONE request to a new backend endpoint that reuses the list's SQL filter. The FE sends the row count it shows; the backend refuses (409, nothing touched) if its count differs, so rows added while the user was looking never get reviewed silently. Batch edit stays capped at 100 rows and is hidden in select-all mode.

## Tried and ruled out
- FE loads every page then posts review in chunks of 100: a few thousand rows = ~60 requests, slow, and can stop half-done.
- Raising the 100-id cap: still needs every row in the browser and the body risks the gateway's 100kb limit.

## Watch out
The header checkbox only selects loaded rows (lazy load, 50 per page) — that is the cause of "select all gives 50". The new api_name must be in the app allowlist before the FE ships, or users get logged out.

In the code: routes/config/chart-of-account-mapping/ (ACCOUNT_MAPPING_PAGE_SIZE = 50); BE review / batch-update DTOs .max(100); new POST account-mapping/review-by-filter, api_name account-mapping.reviewByFilter, error ACCOUNT_MAPPING_SCOPE_CHANGED. Spec + plan in docs/superpowers/{specs,plans}/2026-11-26-coam-review-all-matching*.
