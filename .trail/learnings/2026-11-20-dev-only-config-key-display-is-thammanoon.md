---
title: Dev-only config key display is off unless the environment says dev
author: Thammanoon
date: 2026-11-20
standing: true
id: l-76deb15a
scope: repo
status: active
src: init-review
touches:
  - public/config.local.json
---

## Decided
- The new environment setting controls whether Default Setting shows config keys under labels. Unset means not dev, so production is safe, and the runtime config files are gitignored.
- In the code: Add `"APP_ENV": "dev"` by hand to `public/config.local.json` or the dev deployment config. Use `isDevAppEnv()` for dev-only UI. See `config.sample.json`.

_From PR #707 here, Nov 20._
