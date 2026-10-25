# carmen-frontend

CARMEN BLUE — ERP for hospitality supply chain. **Vite + React Router 7 SPA**, fully
migrated from the legacy Next.js app (that repo has since been removed)
and built for static hosting on **S3 + CloudFront** (no server runtime; the browser talks
to the backend directly).

**Migration status: complete** — 162 lazy routes across every section:

| Section | Routes |
|---|---|
| Configuration (`/config/*`) | unit, currency, exchange-rate, department, location, delivery-point, tax-profile + 8 more |
| Procurement (`/procurement/*`) | purchase-request (+template), purchase-order (+from-price-list), goods-receive-note, credit-note, approval |
| Inventory (`/inventory-management/*`) | inventory-adjustment, transaction, physical-count (+entry/review), spot-check (+review/by-location), period-end |
| Vendor (`/vendor-management/*`) | vendor, price-list, price-list-template, request-price-list |
| Store ops (`/store-operation/*`) | store-requisition, wastage-reporting, stock-replenishment |
| Operation plan (`/operation-plan/*`) | recipe, category, cuisine, equipment (+categories) |
| Products (`/product-management/*`) | product, category |
| System admin (`/system-admin/*`) | user, role, workflow designer, notification-template, query-dataset, period + 7 more |
| Reports (`/report/*`) | list, schedules, history |
| Shell | dashboard, profile (+setting), notifications, login |
| Public (no auth) | `/pl/:url_token` — vendor-facing price list |

Not ported by design: `playground` (dev-only fixtures); `/` redirects to `/dashboard`.

## Tech stack

Vite 7 · React 19 (React Compiler) · TypeScript 5 (strict) · React Router 7 (lazy data
routes) · Tailwind CSS 4 + shadcn/ui · TanStack Query 5 + Table 8 · react-hook-form 7 +
zod 4 · use-intl (en/th) · Vitest + Testing Library · **Bun** runtime

## Quickstart

```bash
bun install
cp public/config.sample.json public/config.local.json   # set X_APP_ID; keep BACKEND_URL="" for proxy mode
VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev   # proxy /api/* to your backend (avoids CORS in dev)
```

`bun dev` (alias for `bun run dev:local`) serves `public/config.local.json` as `/config.json` —
there is no literal `public/config.json` in dev. Use `bun run dev:dev` / `dev:uat` / `dev:prod`
to point at `public/config.dev.json` / `config.uat.json` / `config.prod.json` instead.

Open http://localhost:3000 (Vite picks the next port if busy) and log in with a backend
account.

## Commands

<!-- AUTO-GENERATED: package.json scripts — regenerate, do not hand-edit -->

| Command | Description |
|---|---|
| `bun dev` | Dev server — alias for `dev:local` (`VITE_DEV_PROXY_TARGET=<backend>` to proxy `/api`) |
| `bun run dev:local` | Dev server serving `public/config.local.json` as `/config.json` |
| `bun run dev:dev` | Dev server serving `public/config.dev.json` |
| `bun run dev:uat` | Dev server serving `public/config.uat.json` |
| `bun run dev:prod` | Dev server serving `public/config.prod.json` |
| `bun run build` | `tsc --noEmit` + bump the patch in `package.json` (`scripts/bump-build.ts`) + `vite build` → `dist/` (bakes `config.prod.json` as `dist/config.json`). The bump is skipped when `CI` is set, there is no `.git`, or `SKIP_VERSION_BUMP=1` |
| `bun run build:local` | Same, but `dist/config.json` = `public/config.local.json` |
| `bun run build:dev` | Same, but `dist/config.json` = `public/config.dev.json` |
| `bun run build:uat` | Same, but `dist/config.json` = `public/config.uat.json` |
| `bun run build:prod` | Same, but `dist/config.json` = `public/config.prod.json` |
| `bun run build:force` | Delete `dist/`, `node_modules/.vite` and `tsconfig.tsbuildinfo`, then `build` — forces a full `tsc` re-check (combine with `BUILD_CONFIG_FILE=…`) |
| `bun run build:bump [patch\|minor\|major]` | Cut a release: bump `package.json` + release commit + annotated tag (local only, never pushes); run on `main` with a clean tree; gates on typecheck + lint + `test:run`; prompts for the level if omitted |
| `bun run typecheck` | `tsc --noEmit` only |
| `bun run preview` | Serve the production build locally |
| `bun test` | Vitest watch |
| `bun test:run [path]` | Vitest single run (optionally one file) |
| `bun run lint` | ESLint (incl. the `next*`-import guard and the module-boundary rules) |
| `bun run clear` | Delete `dist/` and `node_modules/` |
| `bun run gen:license-fixture` | Regenerate `constant/__fixtures__/license-catalog.ts` from a backend checkout (needs `BACKEND_REPO`) |
| `bun run gen:route-map [--check]` | Regenerate the URL→file tables in `docs/modules/README.md` from `routes/router.tsx`; `--check` fails instead of writing |

The `build:*` variants only affect `bun run preview` locally — S3/GCS/Docker each supply
their own `config.json` at deploy/run time, and Vercel runs a bare `bun run build`.

Deploy scripts (details in [docs/deploy.md](docs/deploy.md)):

```bash
scripts/deploy-s3.sh <bucket> <cloudfront-id>       # S3 + CloudFront
scripts/deploy-gcs.sh <bucket> [url-map]            # GCS + Cloud CDN
scripts/deploy-docker.sh [tag] [registry]           # Docker image (nginx + /api proxy)
scripts/cloudfront-security-headers.sh <dist-id> public/config.<env>.json   # once per distribution
scripts/setup-gcs-cdn.sh                            # GCS CDN + security headers (idempotent)
```

<!-- /AUTO-GENERATED -->

## Runtime & build configuration

<!-- AUTO-GENERATED: lib/runtime-config.ts + public/config.sample.json + vite.config.ts -->

**Runtime** — `public/config.json`, fetched at boot by `loadRuntimeConfig()`. There is no
`.env`; nothing below is baked into the bundle.

| Key | Required | Description | Example |
|---|---|---|---|
| `BACKEND_URL` | Yes | Backend origin. `""` means same-origin (Docker nginx proxy, or the Vite dev proxy) | `https://backend.example.com` |
| `X_APP_ID` | Yes | App id this deployment is registered under in the backend's allowlist | `carmen-inventory` |
| `WS_URL` | No | WebSocket endpoint; omit to disable real-time notifications | `wss://backend.example.com/ws` |
| `LICENSE_ENFORCEMENT` | No | `false` (default) = shadow mode — the license banner and write locks do nothing. Turn on only after the backend has enforcement on **and** every BU is backfilled. **Already `true` in every real environment's config** | `true` |
| `OTEL_ENABLED` | No | Ship traces/errors to SigNoz via `${BACKEND_URL}/telemetry/v1`. Not set = off, and the OTel SDK is never even downloaded | `true` |
| `OTEL_ENVIRONMENT` | No | Environment name attached to every trace/error. Not set = `dev` | `prod` |

> `public/config*.json` is gitignored except `config.sample.json`, so the optional keys
> must be added **by hand** per environment — there is no env var or build flag for them.
> The Docker entrypoint (`docker/40-render-config-json.sh`) renders only `BACKEND_URL`,
> `X_APP_ID` and `WS_URL`; the optional keys are unreachable in that target today.

**Build / dev env vars** — read by `vite.config.ts` and the scripts, never by app code.

| Variable | Required | Description | Example |
|---|---|---|---|
| `CONFIG_ENV` | No | Which `public/config.<env>.json` the dev server serves at `/config.json` (default `local`) | `local`, `dev`, `uat`, `prod` |
| `VITE_DEV_PROXY_TARGET` | No | Dev only — proxy `/api/*` to this backend so dev never needs CORS | `http://localhost:4000` |
| `BUILD_CONFIG_FILE` | No | Which `public/<file>` is emitted as `dist/config.json` (default `config.prod.json`) | `config.uat.json` |
| `APP_CONFIG_JSON` | No | Whole `config.json` as a JSON string; the fallback when `public/<BUILD_CONFIG_FILE>` is absent (git clones, e.g. CI). Validated at build time | `{"BACKEND_URL":"…","X_APP_ID":"…"}` |
| `SKIP_VERSION_BUMP` | No | `1` = `bun run build` does not bump the patch version (also skipped automatically when `CI` is set or `.git` is absent) | `1` |
| `APP_COMMIT_SHA` | No | Commit shown in the version line; falls back to `VERCEL_GIT_COMMIT_SHA`, then `git rev-parse`, then `unknown` — set it where `.git` is absent (Docker) | `4fd0efb` |
| `BACKEND_REPO` | For `gen:license-fixture` | Path to a `carmen-turborepo-backend` checkout | `../carmen-turborepo-backend` |

Container runtime (`docker-compose.yml`): `BACKEND_URL`, `X_APP_ID`, `WS_URL`,
`PROXY_SSL_VERIFY`, plus `IMAGE_TAG` / `REGISTRY` for image selection.

<!-- /AUTO-GENERATED -->

## Architecture in one minute

- **No server.** `lib/http-client.ts` rewrites the legacy `/api/proxy/<rest>` and
  `/api/external/<rest>` paths to `${BACKEND_URL}/<rest>` and attaches
  `Authorization: Bearer` + `x-app-id` itself (with 401 → refresh → retry).
- **Auth:** access token in memory only; refresh token in localStorage behind
  `lib/auth/refresh-token-storage.ts`. Boot: `loadRuntimeConfig()` → `refreshTokens()` →
  render. `RequireAuth` redirects to `/login` whenever the token store empties.
- **Runtime config:** `public/config.json` is fetched at boot — one build artifact
  deploys to every environment (keys above).
- **Routing:** routes are colocated — `routes/<module>/<feature>/<feature>.route.tsx`
  exporting `Component`, with its components/hooks/tests flat beside it (no `page.tsx`,
  no `_components/`, no `[id]/`). Dynamic segments are native React Router
  (`path: ":id"` + `useParams`). Section parents carry a shared error-boundary adapter,
  and the root route has a full-page catch-all.
- **Module boundary (ESLint-enforced):** `routes/<A>/` may not import from `routes/<B>/`,
  and `components/` `hooks/` `lib/` `constant/` `types/` may not import from `routes/`
  at all.

How to get a change in (setup, gate, commit format, PR checklist):
[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md). Full guidance for working in this repo
(incl. the module-migration recipe used to port the app): **CLAUDE.md**. Design history: `docs/superpowers/specs/` + `docs/superpowers/plans/`.

## Deploying

Four supported targets — step-by-step in [docs/deploy.md](docs/deploy.md):

| Target | Model | Backend CORS needed? |
|---|---|---|
| **AWS S3 + CloudFront** | private bucket + OAC, 403/404 → `/index.html` fallback | yes |
| **GCS (+ Cloud CDN)** | bucket website fallback or LB backend bucket | yes |
| **Docker** | nginx serves `dist/` and **proxies `/api/*` to the backend itself** | **no** |
| **Vercel** | `vercel --prod` from a machine that has `public/config.prod.json` | yes |

For the static-CDN targets the per-environment `config.json` lives on the bucket; the
Docker image renders it from env (`BACKEND_URL`, `X_APP_ID`, `WS_URL`) at container start;
Vercel uploads the local folder (config file included), so its `APP_CONFIG_JSON`
fallback has never actually been exercised. **Git-triggered Vercel deploys do not work
on this repo** — every webhook deployment has come back `CANCELED` before the build
starts (as of 2026-09-08); `vercel --prod` from a developer machine is the only path.

> CORS (S3/GCS only): allow the CDN origin, headers `Authorization`, `Content-Type`,
> `x-app-id`. Dev never needs CORS thanks to the Vite proxy.

## Testing

- **238 test files** (Vitest + Testing Library) — auth flows (refresh
  mutex, 401 retry), http-client URL rewrite, route guards, i18n, security-header/CSP
  hashes, license gating, and per-module hook/component tests.
- CI (`.github/workflows/ci.yml`) runs `lint` → `test:run` → `build`, but is
  **manual-only** (`workflow_dispatch`) — nothing runs on push or PR, so run the three
  locally before merging; `build` includes `tsc --noEmit`.
- **Playwright e2e** lives in the dedicated suite
  [carmen-frontend-e2e](../carmen-frontend-e2e) (191+ TC-annotated
  tests, frontend-agnostic). Run it against this SPA with:
  `E2E_FRONTEND_DIR=../carmen-frontend VITE_DEV_PROXY_TARGET=<backend> bun e2e`
  — `002-spa-smoke.spec.ts` there covers the SPA-specific boot/auth-guard behavior.
