# Architecture

CARMEN BLUE frontend — a **Vite + React 19 + React Router 7** single-page
app, ported from the legacy Next.js app (that repo has since been removed). It ships as a
static bundle (S3/CloudFront, GCS/Cloud CDN, or a Docker nginx image); the browser
talks to the backend gateway directly. There is **no application server** of our own.

> This document describes how the app is wired together. For module-by-module detail
> see `docs/modules/`. For the migration spec see
> `docs/superpowers/specs/2026-06-11-carmen-react-ssg-migration-design.md`.

## System context

How this SPA sits in the wider Carmen Blue system. Service names and ports match the
backend's `carmen-turborepo-backend/docs/architecture-system.md`. There is no
frontend application server: the static bundle runs in the browser and calls the
backend gateway directly.

```mermaid
flowchart TD
    Browser["Browser SPA\ncarmen-frontend\n(Vite + React 19 + React Router 7)\nstatic bundle — no app server"]
    Edge["Static hosting / edge\nS3 + CloudFront · GCS + Cloud CDN ·\nDocker nginx (Port 3000, proxies /api/*)"]
    Config["public/config.json\nBACKEND_URL · X_APP_ID"]
    Gateway["backend-gateway\nAPI Gateway\nHTTP: 4000 / HTTPS: 4001"]
    Business["micro-business\nauth · master data ·\ninventory · procurement · recipes"]
    FileSvc["micro-file\nfile storage"]
    Notify["micro-notification\nSocket.io"]
    Keycloak["micro-keycloak → Keycloak Server\nauth / tokens"]

    Browser -->|"served from"| Edge
    Browser -->|"fetched at boot"| Config
    Browser -->|"HTTPS · Bearer + x-app-id\n(/api/* → BACKEND_URL)"| Gateway
    Gateway --> Business
    Gateway --> FileSvc
    Gateway --> Notify
    Gateway --> Keycloak
```

In static-hosting modes (S3/CloudFront, GCS/Cloud CDN) the browser reaches the
gateway directly and the backend **must** send CORS headers; in the Docker nginx
mode the image proxies `/api/*` itself, so no backend CORS is required. See
**Build & deploy** below.

## Boot sequence

`main.tsx` boots in a fixed order before anything renders:

1. **`loadRuntimeConfig()`** — fetches `public/config.json` (`BACKEND_URL`, `X_APP_ID`).
   Backend URLs are never baked into the bundle, so the same artifact deploys to any
   environment by swapping `config.json`.
2. **`refreshTokens()`** — attempts to restore the session from the refresh token in
   `localStorage`. Failure just means "not logged in"; `RequireAuth` redirects to
   `/login`. Doing this _before_ first render avoids a login-page flash on reload while
   already authenticated.
3. **render** — mounts `<RouterProvider router={router} />`.

If config loading throws, boot writes a plain-HTML error message into `#root` instead
of rendering a half-initialized app.

## Auth & tokens

The token design has a single, deliberate split (`lib/auth/`):

- **Access token — in memory only** (`token-store.ts`). Never persisted; a page reload
  always re-derives it from the refresh token. This is the security boundary: an XSS
  read of `localStorage` cannot lift the access token.
- **Refresh token — in `localStorage`** (`refresh-token-storage.ts`). This file is the
  single swap point if the app ever moves to a cookie-based refresh model.
- **`auth-api.ts`** — `login()`, `refreshTokens()`, `logout()`. `logout()` clears both
  stores locally _and_ posts the refresh token to the backend for server-side
  revocation (whenever either token is present).
- **`RequireAuth`** redirects to `/login` whenever the token store empties. The
  `useLogout` hook routes through `auth-api.logout()` so a logout cannot leave a
  resumable refresh token behind.

## HTTP layer — the proxy rewrite

There is no server to proxy `/api/*`, so `lib/http-client.ts` does it in the browser:

| Request path           | Rewritten to                                      |
| ---------------------- | ------------------------------------------------- |
| `/api/proxy/<rest>`    | `${BACKEND_URL}/<rest>`                           |
| `/api/external/<rest>` | `${BACKEND_URL}/<rest>` (public, unauthenticated) |
| `/api/<rest>`          | `${BACKEND_URL}/api/<rest>` (e.g. `/api/auth/*`)  |

`httpClient` attaches `Authorization: Bearer <access token>` and `x-app-id` itself, so
`constant/api-endpoints.ts` and every data hook are byte-identical to the source app.

Error handling in `handleClientErrors`:

- **401** → try `refreshTokens()` once; on success the _retried_ request is re-run
  through the handler (a second 401 clears the session, 403/429 are normalized) rather
  than returned raw. A `"permission"` message is treated as 403.
- **403** → dispatch a `permission-denied` event + throw `ApiError(FORBIDDEN)`.
- **429** → throw `ApiError(RATE_LIMITED, …, retryable)` with `retryAfter`.
- **`/api/external/*`** → auth interception is **skipped** entirely; the raw response
  reaches the hook so public pages (price-list links) can show "link expired" instead
  of "session expired".

Note: plain `<img src>` / `<a href>` do **not** pass through `httpClient`, so any
backend asset URL must be resolved against `BACKEND_URL` (and, if auth-protected,
fetched as a blob) rather than using an `/api/proxy/...` path.

## Routing

`routes/router.tsx` is a React Router 7 data router (`createBrowserRouter`, 162 lazy
routes). Shape:

```text
/ (redirect → /dashboard)
├── /login                         (public)
├── /pl/:url_token                 (public price-list)
└── ProtectedShell  (RequireAuth + app chrome)
    ├── dashboard, profile, profile/setting, notifications   (standalone children)
    └── <section>  (ErrorBoundary: RouteErrorBoundaryAdapter)
        ├── index → section landing
        └── <leaf>, <leaf>/new, <leaf>/:id …
```

Sections: `config`, `procurement`, `inventory-management`, `vendor-management`,
`store-operation`, `operation-plan`, `product-management`, `system-admin`, `report`.

Conventions:

- Routes are **colocated**: `routes/<module>/<feature>/<feature>.route.tsx`, which must
  `export function Component`. Its components, hooks and tests live flat beside it —
  no `page.tsx`, no `_components/`, no `[id]/` folders.
- The list/new/edit trio is `<feature>.route.tsx` / `<feature>-new.route.tsx` /
  `<feature>-edit.route.tsx`; dynamic segments are native React Router
  (`path: ":id"` + `useParams`). Reference module sets: `routes/config/`,
  `routes/procurement/`.
- A module's shared bits sit in a plain `shared/` sub-folder. Large features may keep
  organizational sub-folders (e.g. `routes/procurement/purchase-request/pr-item-cells/`).
- **Where a hook lives** — the smallest scope that owns it: one feature →
  `routes/<module>/<feature>/use-x.ts`; two or more features of one module →
  `routes/<module>/shared/`; across modules → `hooks/`. No `index.ts` barrels.
- Every route is covered by an error boundary: section parents and the standalone shell
  routes carry `RouteErrorBoundaryAdapter` (in-layout), and the root route carries
  `RootErrorBoundary` (`routes/root-error-boundary.tsx`) as a full-page catch-all, so
  React Router's default error screen never shows.
- `next/dynamic` became `lazy()` + `<Suspense fallback={null}>`.

## Module boundary

Enforced by ESLint: `routes/<A>/` may not import from `routes/<B>/`, and the shared layer
(`components/` `hooks/` `lib/` `constant/` `types/`) may not import from `routes/` at all.
`eslint.config.mjs` reads the module list off disk and emits one `no-restricted-imports`
block per module, so a new module is covered the moment its folder exists. When two
modules need the same thing, its home is the shared layer — never the other module.

## Imports — the compat layer is gone

The `lib/compat/*` shims that the migration originally used (`next/navigation`,
`next/link`) have been **removed**. Import `react-router` and `use-intl` directly;
ESLint still blocks direct `next*` imports.

## i18n

`use-intl` via `components/i18n-provider.tsx`. Messages are per-locale JSON chunks
(`messages/{en,th}.json`) loaded with `import.meta.glob`; the active locale is persisted
in `localStorage` (`carmen.locale`). If a locale chunk fails to load (e.g. a stale chunk
after a redeploy) the provider falls back to the default-locale chunk rather than
rendering a blank screen. `document.documentElement.lang` tracks the active locale.

## Runtime config

`public/config.json` is fetched at boot (`lib/runtime-config.ts`):

```json
{
  "BACKEND_URL": "https://gateway.example.com",
  "X_APP_ID": "carmen-inventory",
  "WS_URL": "wss://gateway.example.com/ws",
  "LICENSE_ENFORCEMENT": true,
  "OTEL_ENABLED": true,
  "OTEL_ENVIRONMENT": "prod"
}
```

`BACKEND_URL` and `X_APP_ID` are required and validated at boot; the rest are optional
(see the table in README.md for what each does and what its default is).
`config.sample.json` is the template. The Docker image rewrites `config.json` from
environment variables in its entrypoint — but only the first three keys; the optional
ones have no entrypoint support today. Never hardcode backend URLs in the bundle.

## Build & deploy

- `bun run build` → `tsc` + `vite build` → `dist/`.
- **S3/CloudFront** and **GCS/Cloud CDN**: static hosting; the backend **must** send CORS
  headers (the browser calls it directly). `scripts/deploy-{s3,gcs}.sh`.
- **Vercel**: `vercel --prod` from a machine holding `public/config.prod.json`.
  Git-triggered deploys are broken on this repo (webhook deployments come back
  `CANCELED` before build — as of 2026-09-08).
- **Docker (nginx)**: `scripts/deploy-docker.sh` builds an image whose nginx proxies
  `/api/*` to the backend itself, so **no backend CORS is required** in this mode. The
  entrypoint also materializes `config.json` from env vars.
- SPA fallback: all unknown paths serve `index.html`. A consequence — a request to a
  non-existent `/api/...` path on static hosting returns `index.html` with HTTP 200, so
  fetches must guard on `Content-Type`/`res.ok` rather than trusting status alone.

See [deploy.md](deploy.md) for the full deploy runbook and [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

## Testing

Vitest (`bun test:run`) — **1,522 tests across 195 files**. Co-located `__tests__/` and
`*.test.ts(x)` files; the suite covers the http layer, auth, lib utilities, schemas,
security headers/CSP hashes, license gating, and per-module hooks/components.
`tsc --noEmit` + `bun run lint` (ESLint, including the `next*`-import guard and the
module-boundary rules) round out the gate. CI (`.github/workflows/ci.yml`) runs
lint → test → build on every push and PR to `main`.

## Known deltas from the source app

- `playground` (dev-only) is intentionally **not** ported; `/` redirects to `/dashboard`.
- `/api/time` (a Next route) → `use-server-time` is stubbed to client time.
- Exchange-rate live rates need a backend endpoint (`GET /api/exchange-rate?base=XXX`);
  the panel degrades gracefully until then.
- `app/` was removed (2026-06-12); `routes/` is the single home for all pages.
- The `lib/compat/*` Next.js shims were removed; imports are `react-router` / `use-intl`.
