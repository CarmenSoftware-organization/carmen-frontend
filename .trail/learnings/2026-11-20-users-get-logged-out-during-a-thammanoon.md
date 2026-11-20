---
title: Users get logged out during a server or Keycloak outage because every refresh failure looks like an expired session
author: Thammanoon
date: 2026-11-20
branch: fix/refresh-token-outage
cost: { minutes: 14, tokens: 106637 }
id: l-89a5347a
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-20-refresh-token-outage-design.md
  - main.tsx
  - lib/http-client.ts
---

## Decided
2026-11-20: a refresh failure is split into three results: ok, rejected, and unreachable. Only rejected (the refresh token was really refused) clears the session and goes to login. Unreachable keeps the session. The user stays on the page, or sees a full-screen "can't reach the server" screen that retries on its own. This needs a 3-repo fix, because the backend also hid outages behind 401.

## Tried and ruled out
- A retry loop in main.tsx before render. It only covers reload and can't use i18n or theme, so it was rejected in favour of a state that RequireAuth reads.
- Fixing only the FE. When Keycloak is down, the backend already answers 401, so the FE wipes the refresh token for real.

## Watch out
- If the gateway is down, the FE gets a network error or 5xx and doRefresh already kept the refresh token. But http-client still cleared the access token, which kicked the user out.
- If Keycloak or micro-keycloak is down, the response arrives as 401. The FE can't tell this apart from an expired token unless the backend is fixed.

In the code:
- micro-keycloak src/keycloak/keycloak.controller.ts handleRefreshToken: the catch turns every error into ErrorCode.UNAUTHENTICATED (401), including fetch throws and Keycloak 5xx.
- carmen-turborepo-backend apps/micro-business/src/authen/auth/auth.service.ts refreshToken: every non-200 from micro-keycloak, rpc transport failures included, becomes 401.
- carmen-frontend lib/http-client.ts 401 branch: tokenStore.clear() runs whenever refresh returns false.
- main.tsx boot: refresh fails → no token → RequireAuth → /login.
- Spec: docs/superpowers/specs/2026-11-20-refresh-token-outage-design.md
