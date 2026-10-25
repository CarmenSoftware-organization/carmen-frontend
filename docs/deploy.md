# Deploy — static SPA hosting

สี่ปลายทางที่รองรับ: **AWS S3 + CloudFront** · **Google Cloud Storage (+ Cloud CDN)** ·
**Docker (nginx)** · **Vercel** — ทุกตัวใช้โมเดลเดียวกัน: build artifact ก้อนเดียวไม่ผูก
environment, `config.json` ต่อ environment อยู่นอก bundle, `index.html` เป็น no-cache

`bun run build:{local,dev,uat,prod}` เลือกได้ว่า `dist/config.json` จะมาจากไฟล์ไหน แต่
**ไม่กระทบการ deploy ทั้งสองทาง** — `deploy-s3.sh` / `deploy-gcs.sh` ตัด `dist/config.json`
ออกจาก sync และ Docker image ลบทิ้งแล้ว render ใหม่จาก env ตอนรัน สคริปต์ชุดนี้มีไว้สำหรับ
`bun run preview` ในเครื่องเท่านั้น — **Vercel ไม่ได้ใช้สคริปต์นี้**: `vercel.json` ไม่ได้ตั้ง
`buildCommand` จึงรัน `bun run build` เปล่า ๆ และ clone จาก git **ไม่มี `public/config*.json`
ติดมาเลย** (gitignore) จึงต้องส่ง config ผ่าน env var `APP_CONFIG_JSON` — ดู §Vercel

---

## AWS — S3 + CloudFront

### One-time infrastructure setup

1. **S3 bucket** (private, no static-website mode needed):
   - Block all public access: ON
2. **CloudFront distribution**:
   - Origin: the S3 bucket via **Origin Access Control (OAC)**; update the bucket
     policy with the generated statement.
   - Default root object: `index.html`
   - **Custom error responses** (SPA client-side routing):
     - HTTP 403 → response page `/index.html`, response code 200
     - HTTP 404 → response page `/index.html`, response code 200
   - Viewer protocol policy: redirect HTTP → HTTPS
3. **Per-environment `config.json`** — upload once per environment:
   ```bash
   aws s3 cp config.uat.json s3://<bucket>/config.json --cache-control "no-cache"
   ```

### Each release

```bash
scripts/deploy-s3.sh <bucket> <distribution-id>
```

---

## GCP — Cloud Storage (+ optional Cloud CDN)

### One-time infrastructure setup

One command provisions everything (bucket → Cloud CDN → HTTPS LB → managed cert)
and runs the first deploy:

```bash
scripts/setup-gcs-cdn.sh <bucket> config.<env>.json            # no domain? auto <LB-IP>.sslip.io
scripts/setup-gcs-cdn.sh <bucket> config.<env>.json app.example.com
scripts/setup-gcs-cdn.sh <bucket> --teardown                   # delete LB/CDN (bucket kept)
```

- Idempotent — safe to re-run; every resource is create-if-missing.
- `config.json` is uploaded only if absent on the bucket (never overwritten).
- With a custom domain, point an A record to the printed LB IP; the managed
  cert activates once DNS resolves. Without one, sslip.io resolves immediately
  (first cert takes ~15–40 min).
- Cache mode is `USE_ORIGIN_HEADERS`, so the per-object headers set by
  `deploy-gcs.sh` (immutable assets, no-cache `index.html`) drive the CDN.
- Remember the backend CORS prerequisite (Shared notes below).

<details><summary>What the script creates (manual reference)</summary>

1. **GCS bucket**:
   ```bash
   gcloud storage buckets create gs://<bucket> --location=<region> --uniform-bucket-level-access
   ```
2. **SPA fallback** — serve `index.html` for unknown paths (client-side routing):
   ```bash
   gcloud storage buckets update gs://<bucket> \
     --web-main-page-suffix=index.html --web-error-page=index.html
   ```
   Note: behind a load-balancer backend bucket, unknown paths return the
   `index.html` BODY with HTTP status 404 — the SPA still boots and routes
   correctly (the app is auth-gated, so the status code has no SEO impact).
3. **Choose exposure**:
   - **Public bucket website** (simplest): grant `roles/storage.objectViewer` to
     `allUsers` and serve via `https://storage.googleapis.com/<bucket>/index.html`
     or a CNAME — fine for UAT.
   - **HTTPS Load Balancer + Cloud CDN** (production): backend bucket → enable
     Cloud CDN → HTTPS frontend with managed cert. Pass the LB's URL-map name to
     the deploy script so `/index.html` gets invalidated on each release.
4. **Per-environment `config.json`** — upload once per environment:
   ```bash
   gcloud storage cp config.uat.json gs://<bucket>/config.json --cache-control="no-cache"
   ```

</details>

### Each release

```bash
scripts/deploy-gcs.sh <bucket>              # bucket-only (no CDN)
scripts/deploy-gcs.sh <bucket> <url-map>    # behind HTTPS LB + Cloud CDN
```

---

## Docker — nginx + built-in /api proxy

The image serves the static bundle with nginx and **proxies `/api/*` to the backend
inside the container** (same model as the original Next server) — so the backend
needs **no CORS** for Docker deployments. `config.json` is rendered from env at
container start (`BACKEND_URL` in it stays `""` = same-origin).

### Build / push

```bash
scripts/deploy-docker.sh                 # build, tag = git short SHA + latest
scripts/deploy-docker.sh v1.0.0 <registry>   # build + push (e.g. ECR/GCR/Docker Hub)
```

### Run

```bash
docker run -d -p 3000:80 \
  -e BACKEND_URL=https://<backend-host> \
  -e X_APP_ID=<app id> \
  -e WS_URL=wss://<backend-host>/ws \
  carmen-frontend:latest
# หรือ: BACKEND_URL=.. X_APP_ID=.. docker compose up -d --build
```

Runtime env:

| Var | Required | Meaning |
|---|---|---|
| `BACKEND_URL` | yes | backend origin the nginx `/api/*` proxy targets |
| `X_APP_ID` | yes | rendered into `config.json` |
| `WS_URL` | no | rendered into `config.json` (notifications) |
| `PROXY_SSL_VERIFY` | no (default `on`) | set `off` ONLY for UAT self-signed backends — never in production; prefer adding the CA to the trust store |

Endpoints: `/healthz` (used by the image HEALTHCHECK), SPA fallback for all
non-file paths, immutable caching on `/assets/*`, no-cache on `index.html` +
`config.json`.

---

## Vercel — `vercel --prod` จากเครื่องเท่านั้น

```bash
vercel --prod      # จากเครื่องที่มี public/config.prod.json
```

⚠️ **git-triggered deployment ใช้ไม่ได้กับรีโปนี้** — ณ 8 ก.ย. 2026 deployment ที่ Vercel
สร้างจาก GitHub webhook เป็น `CANCELED` ทุกใบติดกัน 21 ใบ ทุก branch (main, PR) โดย
build log ว่างเปล่า = ถูกยกเลิกก่อน build เริ่ม **ยังไม่ทราบสาเหตุ** โครงสร้าง branch
`vercel` (mirror ของ `main`, Production Branch = `vercel`) ตั้งไว้ครบแล้วตามโมเดลของ
`carmen-backstage` แต่ `git push origin main:vercel` จะไม่ deploy อะไรเลย ถ้าจะรื้อ
ให้เริ่มที่ banner ในหน้า project settings ของ dashboard

อย่าอ่าน `"live": false` จาก API ว่าโปรเจกต์ถูก pause — `carmen-backstage` ที่ deploy
สำเร็จก็เป็น `false` เหมือนกัน

### ตั้งค่าครั้งเดียวใน Vercel project settings

| ที่ | ค่า |
|---|---|
| Settings → Git → Production Branch | `vercel` |
| Settings → Environment Variables → `APP_CONFIG_JSON` (Production) | เนื้อ JSON ของ `public/config.<env>.json` ทั้งก้อน |

Build/Output ไม่ต้องตั้ง — `vercel.json` ใช้ preset `vite` (`bun run build` → `dist/`)
และ header/SPA rewrite อยู่ในไฟล์นั้นแล้ว

**`APP_CONFIG_JSON` คือทางเดียวที่ config ไปถึง Vercel ได้ *ถ้า* deploy มาจาก git** —
แต่ `vercel --prod` อัปโหลดโฟลเดอร์ในเครื่องขึ้นไปทั้งดุ้น ไฟล์ `public/config.prod.json`
จึงติดไปด้วยและเส้นทาง fallback นี้ **ยังไม่เคยถูกเรียกใช้จริงสักครั้ง** — ถ้าวันหนึ่ง git
deploy กลับมาทำงาน ต้องตั้ง env var ตัวนี้ (scope Production) ก่อน ไม่งั้น build ตายที่
`public/config.prod.json not found` · `public/config*.json` ถูก
gitignore ทั้งหมด clone ที่ Vercel จึงไม่มีไฟล์ และ `emitBuildConfig()` ใน `vite.config.ts`
จะ fallback มาอ่าน env var นี้แทน (validate `BACKEND_URL`/`X_APP_ID` แล้ว fail build ทันที
ถ้า JSON เสียหรือคีย์ขาด — ดีกว่าไปพังเป็นหน้า "Failed to load application configuration"
ตอน boot) ค่าเป็น JSON ทั้งก้อน ไม่ใช่แยกทีละคีย์ คีย์ใหม่ของ `RuntimeConfig` จึงไม่ต้อง
ตามเพิ่มตัวแปรใน dashboard:

```json
{ "BACKEND_URL": "https://backend.example.com", "X_APP_ID": "<app id>", "WS_URL": "wss://backend.example.com/ws", "LICENSE_ENFORCEMENT": true }
```

**Backend prerequisite** — Vercel ยิง backend ตรง ไม่มี proxy เหมือน Docker: backend ต้อง
เปิด CORS ให้ origin `*.vercel.app` ที่ใช้ และ `X_APP_ID` ต้องอยู่ใน app-id allowlist ของ
backend ไม่งั้นได้ 401 แล้วเด้งออกหน้า login

---

## Shared notes

- `config.json` shape (see `public/config.sample.json` · คำอธิบายต่อคีย์อยู่ใน README
  §Runtime & build configuration):
  ```json
  {
    "BACKEND_URL": "https://<backend-host>",
    "X_APP_ID": "<app id>",
    "WS_URL": "wss://<backend-host>/ws",
    "LICENSE_ENFORCEMENT": true,
    "OTEL_ENABLED": true,
    "OTEL_ENVIRONMENT": "prod"
  }
  ```
  `BACKEND_URL` + `X_APP_ID` บังคับ ที่เหลือ optional · **`LICENSE_ENFORCEMENT`,
  `OTEL_ENABLED`, `OTEL_ENVIRONMENT` ต้องเติมด้วยมือในไฟล์ config ของแต่ละ
  environment** (ไฟล์พวกนี้ถูก gitignore) และ **Docker entrypoint
  (`docker/40-render-config-json.sh`) render ให้แค่ 3 คีย์แรก** — ปลายทาง Docker
  จึงเปิด license enforcement / telemetry จาก env ไม่ได้
- **Backend prerequisite for S3/GCS (see spec §4)** — CORS: allow the CDN/bucket origin,
  methods GET/POST/PUT/PATCH/DELETE, headers `Authorization`, `Content-Type`,
  `x-app-id`. (The Docker target is exempt — its nginx proxies `/api/*` same-origin.)
- `index.html` is no-cache; hashed assets are immutable — returning users pick up
  new releases on next navigation.
- Both deploy scripts delete the dev `config.json` from `dist/` before syncing and
  exclude `config.json` from the sync, so the environment's config on the bucket
  is never overwritten.

---

## Security headers

ทุกปลายทางส่ง header ชุดเดียวกัน: CSP · `X-Content-Type-Options` ·
`X-Frame-Options` · `Referrer-Policy` · `Permissions-Policy` ·
`Strict-Transport-Security` — ตั้งคนละที่เพราะแต่ละปลายทางคุม response header คนละชั้น

| ปลายทาง | ตั้งที่ไหน | ต้องทำอะไรเอง |
|---|---|---|
| Docker/nginx | `docker/30-render-security-headers.sh` render ตอน container start | ไม่ต้อง — อยู่ใน image แล้ว |
| Vercel | `vercel.json` | ไม่ต้อง |
| GCS + Cloud CDN | `scripts/setup-gcs-cdn.sh` ตั้งที่ backend bucket | รันสคริปต์ setup (รันซ้ำได้ — refresh header ให้ distribution เก่าด้วย) |
| S3 + CloudFront | response-headers-policy | รัน `scripts/cloudfront-security-headers.sh <distribution-id> public/config.<env>.json` **ครั้งเดียวต่อ distribution** |

### กับดักที่ต้องรู้ก่อนแก้

- **`script-src` ผูกกับ hash ของ inline script ใน `index.html`** (ตัวที่เติม font-scale
  ก่อน paint แรก) แก้สคริปต์นั้นแม้แต่ตัวอักษรเดียวโดยไม่คำนวณ hash ใหม่ =
  **สคริปต์ถูกบล็อกเงียบ ๆ ใน production ทุกปลายทาง** หน้าเว็บยังขึ้นปกติ แค่ขนาด
  ตัวอักษรกระพริบจาก normal ไปขนาดที่ผู้ใช้เลือกทุกครั้งที่โหลด — dev server ไม่มี CSP
  จึงไม่มีทางเจอตอนพัฒนา `lib/__tests__/security-headers.test.ts` คำนวณ hash จาก
  `index.html` จริงแล้วเทียบกับทั้ง 4 ไฟล์ให้ ถ้าแดงคือให้เอาค่าใน error ไปแทนของเดิม
- **`connect-src` ต่างกันตามปลายทาง** — Docker เป็น same-origin (nginx proxy `/api` เอง)
  จึงมีแค่ `'self'` + `WS_URL`; CDN ยิงข้าม origin จึงต้องระบุ backend origin ด้วย
  ย้าย backend เมื่อไหร่ต้องรันสคริปต์ setup/cloudfront ใหม่ ไม่งั้น request ถูกบล็อกทั้งแอป
- **Vercel ใช้ `connect-src 'self' https: wss:`** ซึ่งหลวมกว่าปลายทางอื่นโดยตั้งใจ —
  `vercel.json` เป็น JSON นิ่ง ๆ ไม่รู้ backend origin ตอน deploy ส่วนที่กัน XSS จริง
  (`script-src`) ยังแน่นเท่ากัน
- **HSTS ไม่ใส่ `includeSubDomains`** — โดเมนลูกที่ยังเป็น http จะเข้าไม่ได้ทันที
  เปิดเพิ่มเมื่อยืนยันแล้วว่าทุก subdomain เป็น https
- `style-src` มี `'unsafe-inline'` เพราะ React ใส่ `style` attribute เองและ
  `components/ui/chart.tsx` inject `<style>` — `script-src` **ห้ามมี** เด็ดขาด
  (มี test กันไว้)
