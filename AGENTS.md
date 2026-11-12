# AGENTS.md

CARMEN BLUE frontend — **Vite + React Router SPA port** of the legacy Next.js app
(that repo has since been removed). Static bundle on S3/CloudFront; the browser calls the
backend directly. Spec: `docs/superpowers/specs/2026-06-11-carmen-react-ssg-migration-design.md`.

## ภาษาในการสื่อสาร

สื่อสารกับ user เป็น **ภาษาไทย** เสมอ — รวมถึง commit message (เขียนเป็นภาษาไทย)
ยกเว้น code / identifier และ **PR ที่ยังใช้ภาษาอังกฤษ**

## Commands

```bash
bun dev              # Dev server = dev:local (VITE_DEV_PROXY_TARGET=<backend> to proxy /api)
bun run dev:{local,dev,uat,prod}   # Dev server per backend env → public/config.<env>.json (prod = dev backend until real prod exists)
bun run build        # tsc + vite build → dist/ (config.json = config.prod.json)
bun run build:{local,dev,uat,prod}   # เหมือน build แต่เลือก public/config.<env>.json → dist/config.json — มีผลกับ `bun run preview` ในเครื่องเท่านั้น (S3/GCS/Docker ใช้ config.json ของ environment เอง; Vercel รัน `bun run build` เปล่า ๆ ไม่ผ่านสคริปต์นี้ และ clone ไม่มี public/config*.json ติดมา — ต้องตั้ง env var `APP_CONFIG_JSON` เป็น JSON ทั้งก้อน — แต่ `vercel --prod` อัปโหลดไฟล์ในเครื่องขึ้นไปด้วย เส้นทางนี้เลยยังไม่เคยถูกใช้จริง; **deploy = `vercel --prod` จากเครื่องเท่านั้น** git-triggered deploy โดน CANCELED ทุกใบ)
bun run typecheck    # tsc --noEmit เดี่ยว ๆ (gate ของ build:bump)
bun run lint         # ESLint        bun test          # Vitest watch
bun test:run         # Single run    bun test:run path # Single file
# e2e: moved to ../carmen-frontend-e2e (E2E_FRONTEND_DIR=../carmen-frontend bun e2e)
```

ตัด release / deploy (`build:bump` · changelog · S3/GCS/Docker/CDN) → skill `release-and-deploy`

## Architecture (deltas from the source app — its AGENTS.md still describes module patterns)

- **No server.** `lib/http-client.ts` rewrites `/api/proxy/<rest>` and `/api/external/<rest>`
  → `${BACKEND_URL}/<rest>` and attaches `Authorization: Bearer` + `x-app-id` itself.
  `API_ENDPOINTS` is identical to the source app; the data hooks' **contents** are too,
  but not their location — see **Where a hook lives** below.
- **Auth:** access token in memory (`lib/auth/token-store.ts`), refresh token in
  localStorage (`lib/auth/refresh-token-storage.ts` — single swap point for future cookie
  mode). Boot order in `main.tsx`: `loadRuntimeConfig()` → `refreshTokens()` → render.
  `RequireAuth` redirects to `/login` whenever the token store empties.
- **Routing:** React Router 7 data router in `routes/router.tsx`. Routes are **colocated**:
  each route is a `routes/<module>/<feature>/<feature>.route.tsx` file that
  `export function Component`, with its components/hooks/tests living flat beside it (no
  `page.tsx`, no `_components/`, no `[id]/` folders). Dynamic segments are native
  React Router (`path: ":id"` + `useParams`); `<feature>-edit.route.tsx` /
  `<feature>-new.route.tsx` are the list/new/edit trio. A module's shared bits sit in a
  plain `shared/` sub-folder; large features may keep organizational sub-folders
  (e.g. `pr-item-cells/`). Add new module routes under the `ProtectedShell` children.
  **All sections are migrated.** Use
  `routes/config/` / `routes/procurement/` as reference module sets. The source app's
  `playground` is intentionally NOT ported (dev-only tool); `/` redirects to `/dashboard`
  (the source `HomeComponent` landing is not ported).
- **Where a hook lives:** the smallest scope that owns it. Used by one feature →
  `routes/<module>/<feature>/use-x.ts` (its test sits flat beside it); used by two or more
  features of the same module → `routes/<module>/shared/`; used across modules, or by
  another hook in `hooks/` → stays in `hooks/`. `hooks/` is therefore the cross-cutting
  layer only (93 files: infra, lookups every module needs, `use-can`/`use-mobile` and
  friends), not a dumping ground for every `use-<entity>`. Two hooks stay global despite
  a single caller today — `use-locale` and `use-number-formatter` are generic, and burying
  them in physical-count / purchase-request would just hide them. No `index.ts` barrels.

- **Module boundary (enforced by ESLint):** `routes/<A>/` may not import from
  `routes/<B>/`, and the shared layer (`components/` `hooks/` `lib/` `constant/` `types/`)
  may not import from `routes/` at all. `eslint.config.mjs` reads the module list off disk
  and emits one `no-restricted-imports` block per module, so a new module is covered the
  moment its folder exists. When two modules need the same thing, its home is
  `components/` / `hooks/` / `lib/` / `types/` — never the other module. Only the alias
  form (`@/routes/...`) is checked; relative escapes are not, because nobody writes them
  here (0 in the repo) and guarding them false-positives on feature sub-folders.

- **Error boundaries:** every route is covered. Module section parents and the standalone
  shell routes carry `RouteErrorBoundaryAdapter` (in-layout error UI); the root route
  has `RootErrorBoundary` (`routes/root-error-boundary.tsx`) as a full-page catch-all so
  React Router's default error screen never shows. Both render `ModuleError` → `ErrorState`.
- **Imports (no compat layer):** the `lib/compat/*` shims are **removed** — import
  `react-router` / `use-intl` directly (ESLint blocks direct `next*` imports). The full
  Next→react-router rewrite table lives in the `migrate-source-module` skill.
- **i18n:** `use-intl` + `components/i18n-provider.tsx`; locale persisted in
  localStorage (`carmen.locale`); messages in `messages/{en,th}.json`.
- **Runtime config:** `public/config.json` (`BACKEND_URL`, `X_APP_ID`) fetched at boot —
  never hardcode backend URLs in the bundle.

## Migrating a module from the source app

Use the `migrate-source-module` skill (`.Codex/skills/migrate-source-module/`) — it carries
the full colocated-route convention and Next→react-router rewrite steps. Gate: `bunx tsc
--noEmit && bun test:run` must be clean. (The `scripts/codemods/*` helpers predate the
compat removal — don't rely on them for the import step.)

## Activity sheet (ประวัติ "ใครแก้อะไร" ของรายการเดียว)

`components/share/activity-sheet.tsx` เป็นของกลาง เปิดผ่าน `openActivity()` ของ
`activity-sheet-host.tsx` ที่ mount ครั้งเดียวใน `routes/root-layout.tsx` —
**อย่าถือ state หรือ render sheet เองในหน้าใหม่**

จุดเข้าถึงทั้งสามทาง · ทะเบียน entity ที่ backend บันทึกจริง (7 list ที่ไม่เปิด) ·
สัญญา `ACTION_TITLE_KEY` ↔ enum ฝั่ง DB → skill `activity-sheet`

## Interfaces config (`/system-admin/interface`)

Per-BU external-system config (Accounting / POS / PMS). Conventions, storage model, and the
list-envelope gotcha live in `routes/system-admin/interface/AGENTS.md` (loads when working
in that folder). One cross-cutting deploy note: **Prod/UAT must set `SECRET_ENCRYPTION_KEY`**
or any secret-bearing app-config save (incl. the pre-existing `report_email`) 400s.

## Security headers / CSP

ทุกปลายทาง deploy ส่ง CSP + header ชุดเดียวกัน (nginx · vercel.json · GCS backend
bucket · CloudFront policy) กับดักเดียวที่ต้องจำ: **`script-src` ผูกกับ sha256 ของ
inline script ใน `index.html`** แก้สคริปต์นั้นแล้วไม่อัปเดต hash = สคริปต์ถูกบล็อกเงียบ ๆ
เฉพาะใน production (dev server ไม่มี CSP) — `lib/__tests__/security-headers.test.ts`
คำนวณให้แล้วเทียบทั้ง 4 ไฟล์ รายละเอียดที่เหลืออยู่ใน `docs/deploy.md` §Security headers

## React Compiler กับตาราง (`DataGrid`)

กับดักตารางค้างตอนเปลี่ยนหน้า + วิธีแก้ด้วย `"use no memo";` อยู่ใน `routes/AGENTS.md`
(โหลดเองเมื่อทำงานใต้ `routes/`)

## Design system (`/design-system`)

หน้า Accounting detail ที่แก้หรือเพิ่มใหม่ (JV, Payment, AR Invoice/Receipt, Asset) → skill `accounting-detail-shell` ใน `.agents/skills/` เพื่อเทียบ form, action และ footer กับ JV detail ทั้ง view/create/edit ก่อนส่งงาน

กฎอยู่ใน `docs/DESIGN.md` · ของจริงอยู่ที่หน้า **`/design-system`** ซึ่งเรนเดอร์ token จาก
`styles/globals.css` และ primitive จาก `components/ui/` ตรง ๆ (โค้ดหน้าอยู่ที่
`routes/design-system/` — dev tool: อยู่หลัง auth แต่ไม่อยู่ใน `constant/module-list.ts`
จึงไม่ขึ้นเมนู ไม่ผูก permission/license และไม่ผ่าน i18n) ก่อนเพิ่มหรือแก้ UI
ให้หยิบของที่มีอยู่ อย่าตั้งค่าสี/ขนาดใหม่ที่ call site

สี่กับดักที่พลาดกันบ่อย:

- token สถานะ (`--success` `--warning` …) เป็น **สีพื้น** ใช้เป็น `text-*` แล้วตก WCAG AA
  — ข้อความต้องใช้ `text-success-ink` / `text-warning-ink` (`lib/__tests__/status-ink-contrast.test.ts` ดักอยู่)
- utility `bg-status-*` **ไม่มีจริง** ต้องเขียน `bg-[var(--status-draft)]` (บล็อก `@theme inline` ท้าย `styles/badge-status.css` เป็นโค้ดที่ไม่มีผล)
- ห้ามประกาศ `--spacing-md` (รวมถึง sm/lg/xl/2xl) — Tailwind v4 ใช้คีย์ร่วมกับสเกล container แล้ว `max-w-md` ทั้งแอปจะยุบ
- ขนาดตัวอักษรดิบนอก ladder เป็นบั๊ก design system — `components/ui/type-ladder.test.ts` แดงทันที

**dark mode ทั้งแอปยังไม่มีสวิตช์จริง** — CSS ครบทั้งชุดแต่ไม่มีโค้ดไหนตั้งคลาส `.dark`
ที่ `<html>` เลย ปุ่มสลับธีมในหน้า `/design-system` จึงผูกคลาสไว้ที่ container ของหน้าเอง
(`&:is(.dark *)` ต้องการแค่ ancestor) ใช้ดูงานได้ แต่ไม่ใช่การเปิด dark mode ให้ผู้ใช้

## Known open items

- `/api/time` was a Next route — `use-server-time` is stubbed to client time.
- Exchange-rate live-rates fetch needs a backend endpoint (`GET /api/exchange-rate?base=XXX`,
  same shape as the old Next route, which held the provider API key server-side). Config
  CRUD works; the live-rates panel degrades gracefully until then.
- Backend CORS required before production on S3/GCS static hosting (dev uses the Vite
  proxy; the **Docker image needs no CORS** — its nginx proxies `/api/*` itself).
- Local dev against the local backend: `VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev`.
- Backend bug ที่ผูกกับโมดูลเดียว ย้ายไปอยู่ข้างโมดูลแล้ว (โหลดเองเมื่อทำงานในโฟลเดอร์นั้น):
  decimal qty ที่ `.int()` ปัด → `routes/AGENTS.md` · dashboard-widgets 500 →
  `routes/dashboard/AGENTS.md` · PR list ไม่มี `audit` → `routes/procurement/AGENTS.md`
- `scripts/changelog.ts`'s conventional-commit regex captures the breaking-change `!`
  marker (e.g. `feat(api)!: …`) but nothing reads it — deliberately not implementing a
  breaking-change badge in What's New for now; such commits render like ordinary features.
- **License gating ฝั่ง FE ครอบไม่ครบโดยตั้งใจ** — จุดที่ปิดปุ่มเขียนตาม `canWrite` จริง
  **มีแค่ 3 จุด** คือ `FormToolbar` (Save/Edit/Delete), row actions ของ data-grid
  (`useConfigTable` → `DataGridRowActions`) และ `ConfigListTemplate` (ปุ่ม Add + `readOnly`
  ของ dialog แก้ไข) ปุ่มอื่นที่เรียก mutation ตรงจะยังกดได้แล้วเด้ง 403 จาก backend
  ซึ่งยอมรับได้เพราะ `LicenseInterceptor` ที่ gateway คือตัวบังคับจริง การไล่ปิดทุกปุ่ม
  เป็นงานที่ไม่มีวันจบและตรวจไม่ได้ว่าครบ
- **`useCan().guard()` ยังไม่มีผู้เรียกสักจุดเดียวในแอป** — มันเช็ค `canWrite` ก่อน `can()`
  แล้วเด้ง dialog ให้ตามเหตุผล (expired/permission) และมีเทสต์ครบ แต่ไม่มีใคร destructure
  ออกมาใช้ (ทุก call site ของ `useCan()` เอาแค่ `can`/`isAdmin`/`canWrite`) — **อย่าอ่านว่า
  "การเขียนถูกบล็อกทุกที่ที่มี guard"** ถ้าจะใช้ต้องไปเสียบที่ handler เอง:
  `const { guard } = useCan(); <Button onClick={guard(PERMISSIONS.x.create, doCreate)}>`
  เก็บโค้ดไว้เพราะมันถูกและเป็นทางลัดที่พร้อมใช้ ไม่ใช่เพราะมันทำงานอยู่
- **license feature key ≠ permission key** — `constant/module-list.ts` มีฟิลด์
  `licenseFeature` ไว้ระบุ feature ของ leaf ตรง ๆ เมื่อ key ที่คำนวณจาก `permission`
  ไม่ตรง catalog ของ backend (เช่น `report_analytics.view` → `report.list`,
  `product_management.unit.view` → `configuration.unit`) ค่าที่ใส่ต้องมาจาก
  `LICENSE_ROUTE_FEATURES` ของ backend เท่านั้น และ
  `constant/module-list.license-feature.test.ts` จะแดงถ้า key ที่ผลิตได้ไม่มีใน catalog
  (สำเนา catalog อยู่ที่ `constant/__fixtures__/license-catalog.ts` พร้อมวิธีอัปเดต)
- **`LICENSE_ENFORCEMENT` เปิดอยู่จริงแล้วทุก environment** (ตรวจ 2026-09-20) — เป็น
  optional key ใน `RuntimeConfig` (`lib/runtime-config.ts`) ที่ default `false`
  (shadow mode) แต่ `public/config.{local,dev,uat,prod}.json` **ตั้ง `true` ครบทุกไฟล์
  แล้ว** ไฟล์พวกนี้ถูก gitignore (`public/config*.json` ยกเว้น `public/config.sample.json`)
  จึงอ่านจากรีโปไม่เห็น — **อย่าอ่านค่า default ว่า "ยังไม่มีผล"** และไม่มีทางเปิด/ปิด
  ผ่าน env var หรือ build flag ต้องแก้ที่ไฟล์ config ของ environment นั้น
  ผลที่ตามมา: การผูก leaf กับ **license feature key ใหม่ล็อกหน้านั้นทันทีที่ deploy**
  สำหรับ BU ที่ยังไม่ถูก assign feature การเพิ่มคีย์ระดับ resource จึงต้องทำสามขั้นตาม
  ลำดับเสมอ — deploy backend → `db:seed.license-feature` ของ env นั้น → assign feature
  ให้ทุก BU ที่ carmen-backstage → ค่อย deploy FE (ตรวจงาน license ในเครื่องด้วยการสลับ
  `LICENSE_ENFORCEMENT` เป็น `false` ชั่วคราวแล้วคืนค่า)
