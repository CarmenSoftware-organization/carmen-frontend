# Report to carmen-turborepo-backend team — 2026-06-12

From the frontend team (carmen-frontend). One bug report and two
feature/config requests, in priority order. All evidence below was captured today
against a local gateway (`carmen-turborepo-backend` on `http://localhost:4000`),
logged in as the seeded admin user.

---

## 1. BUG: `GET /api/me/dashboard-widgets?bu_code=T02` returns 500 "fetch failed"

**Severity:** medium — the dashboard widget area is empty for every user; the frontend
degrades gracefully but no widgets ever load.

**Repro** (any authenticated user with access to BU `T02`):

```
GET /api/me/dashboard-widgets?bu_code=T02
Authorization: Bearer <valid token>
x-app-id: 9c83fd4b-ce3f-4de2-a522-349ad1280b10

HTTP 500 (≈0.35s)
{"data":null,"status":500,"success":false,"message":"fetch failed",
 "timestamp":"2026-06-12T03:33:51.127Z"}
```

**Why we believe it's inside the gateway, not the frontend or the request:**

- The same call with a BU the user does NOT have (`bu_code=ZB01`) returns a
  well-formed `401 "Access denied. You do not have permission for the following BU
  code(s): ZB01"` — so routing, auth, and BU authorization all run fine. The 500
  happens *after* authorization succeeds.
- `"fetch failed"` is the raw Node/undici error message, i.e. the gateway's own
  outbound HTTP call to the downstream widgets service threw (connection refused /
  bad service URL / service not running) rather than the service returning an error.
- We verified the response is byte-identical whether the browser calls the gateway
  directly or through our dev proxy — no frontend middleware involved.

**Suggested place to look:** the gateway's service-discovery/env config for the
dashboard-widgets downstream — the ~350 ms latency then immediate undici failure
smells like a wrong host/port rather than a crash in the service itself.

(Minor observation while testing: `GET /api/me` and `GET /api/me/business-unit`
both 404 on this gateway build — not a problem for us, just noting in case it's
unexpected.)

---

## 2. REQUEST: exchange-rate proxy endpoint

The old Next.js frontend had a server route holding the provider API key. The new
SPA is a static bundle (S3/CDN) with no server, so the key can't live in the
frontend anymore. We need the gateway to expose the equivalent:

```
GET /api/exchange-rate?base=USD
```

Behavior of the old route (we'd like the same):

- `base` is required, must match `^[A-Z]{3}$` (ISO 4217) → else 400 with
  `{"error": "..."}`.
- Server-side fetch of `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${base}`
  with a 10 s timeout; response body passed through as-is (the frontend already
  parses the provider's payload shape).
- Rate-limited 30 req/min per IP; cacheable (`Cache-Control: s-maxage=300,
  stale-while-revalidate=60`) since rates only refresh every few minutes.
- `EXCHANGE_RATE_API_KEY` env var on the gateway (we can hand over the current key).

Until this exists, the currency-config CRUD works but the "live rates" panel shows
its empty/degraded state.

---

## 3. REQUEST: CORS for static-hosting deployments

When we ship the SPA from S3/CloudFront or GCS/Cloud CDN, the browser calls the
gateway cross-origin. Please enable CORS on the gateway for our frontend origins:

- `Access-Control-Allow-Origin`: the deployed frontend origin(s) — we'll supply the
  exact domains per environment (no wildcard needed; credentials are header-based).
- `Access-Control-Allow-Headers`: `Authorization, Content-Type, x-app-id`
- `Access-Control-Allow-Methods`: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- Preflight (`OPTIONS`) must succeed unauthenticated.

Note: our Docker/nginx deployment proxies `/api/*` same-origin and needs none of
this — CORS only blocks the S3/GCS path. Not urgent until we pick static hosting
for production, but flagging early.

---

**Contact:** frontend repo `carmen-frontend`; repro steps and this
report live in `docs/2026-06-12-report-to-backend-team.md` there.
