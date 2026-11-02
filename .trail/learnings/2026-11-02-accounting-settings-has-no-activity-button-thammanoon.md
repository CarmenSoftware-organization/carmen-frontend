---
title: Accounting Settings has no Activity button on purpose — tb_application_config is not in the backend activity registry
author: Thammanoon
date: 2026-11-02
branch: main
cost: { minutes: 5, tokens: 89281 }
id: l-6012a39a
scope: repo
status: active
src: agent
touches:
  - routes/accounting/settings/accounting-settings-form.tsx
---

## Decided
2026-11-03: user chose NOT to add an Activity button to `/accounting/settings` (routes/accounting/settings/accounting-settings-form.tsx). The page saves via app-config upsert into `tb_application_config` (key GL_SETTING_KEY), and that table is absent from carmen-turborepo-backend/apps/micro-business/src/common/activity/activity-registry.ts, so no history is ever written.

## Tried and ruled out
FE-only button (`FormToolbar activity={{ id }}`): would open an always-empty sheet — the exact case the activity-sheet skill forbids.

## Watch out
If Activity is wanted later it is a 2-repo change: register tb_application_config + app-config upsert/delete commands in the registry (upsert does create OR update — pick the id source carefully; it also covers every app-config key, not just GL), confirm useAppConfigByKey returns the row id, deploy BE before FE. History starts from deploy only.
