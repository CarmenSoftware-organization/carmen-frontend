---
title: "App-config LIST endpoint wraps rows as data.items, unlike the single-key GET whose data…"
author: Thammanoon
date: 2026-11-09
id: l-3bbe1f9e
scope: repo
status: active
touches:
  - hooks/use-app-config.ts
  - types/app-config.ts
  - "hooks/use-app-config.ts#useAppConfigByKey"
  - "hooks/use-app-config.ts#useAppConfigs"
  - "types/app-config.ts#AppConfig"
---

## Decided
The gateway `GET /api/config/:bu/app-config` (list) returns
`{ data: { items: [...], count: N }, status, success, message, timestamp }` — the
array is at `json.data.items`, NOT at `json.data`.

The single-key `GET .../app-config/:key` returns `{ data: <row> }` — there `json.data`
IS the row object. So `useAppConfigByKey` correctly reads `json.data`, but a list hook
must read `json.data.items ?? []` (see `useAppConfigs` in `hooks/use-app-config.ts`).

Row shape from the list is `{ id, key, value, audit: { created, updated } }` — NOT the
flat `created_at`/`created_by_id`/… that the `AppConfig` type (`types/app-config.ts`)
declares. The type is inaccurate vs runtime; only `key`/`value`/`id` are safe to read.

**Why:** a unit test that mocks `{ data: rows }` (a bare array) passes while the real
`{ data: { items } }` envelope crashes the consumer (`configs.map is not a function`).
This exact gap shipped past the unit tests and was only caught by browser verification
against the live gateway.

## Watch out
for any NEW app-config list hook, unwrap
`.items`, and mock the real `{ data: { items, count } }` shape in its test. Verify
list-rendering features in a real browser, not just unit tests. Related: project-carmen-react-migration.

_From Claude Code's memory of this repo, last updated Aug 23._
