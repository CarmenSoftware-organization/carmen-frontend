---
title: "Merging to main auto-deploys dev, so an FE PR that calls a new api_name on every page needs the dev allowlist first"
author: Thammanoon
date: 2026-11-03
branch: main
cost: { minutes: 12, tokens: 39249 }
id: l-280f5b91
scope: repo
status: active
src: agent
touches:
  - ".github/workflows/deploy-dev.yml"
  - components/storage-quota-banner.tsx
  - lib/http-client.ts
---

## Decided
- .github/workflows/deploy-dev.yml runs on every push to main (same for backend build.yml, backstage and micro-cronjobs deploy-dev). Merging is therefore a dev deploy. For the storage quota PRs the order chosen was: merge the backend first, then the FE (components/storage-quota-banner.tsx calls storageUsage.get on every page), accepting that dev's `website` app is allow_all or gets the row added by hand.
## Tried and ruled out
- Holding the FE PR open until the dev migration and allowlist are done: safer, but it leaves main and the backend out of step; it was not chosen.
- Merging everything at once regardless of order: ruled out, because the FE could reach dev before the gateway endpoint exists.
## Watch out
- A missing app-allowlist row is not a "feature off": AppIdGuard returns 401, lib/http-client.ts clears the token and the user is sent to /login. A banner or layout component that calls a new endpoint on every page turns that into everyone logged out on that env.
