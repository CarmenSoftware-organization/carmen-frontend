# Public API Docs (Scalar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้า public `/developers/api` แสดงเอกสาร API ขาเข้าแบบ Stripe ด้วย Scalar (5 stack, EN/TH) และถอด Swagger UI ออกจากหน้า External

**Architecture:** spec ย้ายไป shared layer `lib/external-api/` พร้อม `localizedSpec(locale)` ที่ใส่ placeholder + ทับคำแปลไทยจาก overlay; route ใหม่ `routes/developers/api/` lazy-load ตัวห่อ Scalar ไฟล์เดียว; ส่วนในแอปเหลือ quick start + ลิงก์ไปหน้า public

**Tech Stack:** React 19, React Router 7, use-intl, next-themes, `@scalar/api-reference-react@0.9.81` (exact), Bun scripts

**Spec:** `docs/superpowers/specs/2026-10-19-public-api-docs-scalar-design.md`

> **ไม่มีขั้นเขียนเทสต์อัตโนมัติ** (ตามการตั้งค่าของผู้ใช้) — ทุก task จบด้วย typecheck + lint + ตรวจในเบราว์เซอร์ แล้ว commit
> commit message เป็นภาษาไทย · ทำบน branch `feature/external-page-polish` · อย่า commit `package.json` ถ้า diff มีแค่ version bump 2.5.16 ที่ค้างอยู่ก่อนเริ่มงาน (ค่า dependency ใหม่ commit ได้ — ใช้ `git add -p package.json` แยก hunk)

## Global Constraints

- Scalar pin exact: `@scalar/api-reference-react@0.9.81` (ไม่มี `^`)
- `telemetry: false`, `withDefaultFonts: false`, `agent: { disabled: true }`, `mcp: { disabled: true }`, `showDeveloperTools: "never"`, `hideTestRequestButton: true`, `hideClientButton: true`, `hideDarkModeToggle: true`, `documentDownloadType: "none"`, `layout: "modern"`
- Stack ที่แสดง: target `shell`, `node`, `python`, `php`, `csharp` เท่านั้น · default `{ targetKey: "shell", clientKey: "curl" }` · C# ต้องมี HttpClient
- Placeholder: server `https://{host}` default `your-carmen-api-host`; header `YOUR_CLIENT_ID` / `YOUR_CLIENT_SECRET`
- ห้ามแก้ CSP ทั้ง 4 ไฟล์
- Scalar ถูก import ได้จาก `routes/developers/api/scalar-reference.tsx` ไฟล์เดียว และไฟล์นั้นถูกโหลดผ่าน `lazy()` เท่านั้น
- ข้อความใน `messages/*.json` ห้ามมี `{}` หรือ `<token>` (ICU)
- ห้ามแปล: ชื่อ field, enum, endpoint, header, examples

## Review Focus

1. เปิด `/developers/api` ตรง ๆ ตอนไม่ได้ล็อกอิน (incognito) → ต้องเห็นเอกสาร ไม่เด้ง `/login` และ boot ที่ refresh token ล้มต้องไม่ทำให้หน้าค้าง → ตรวจใน Task 2 Step 5
2. ผู้ใช้ที่ locale เป็น `th` อยู่แล้วเปิดหน้าครั้งแรก → ต้องเป็นไทยทันทีโดยไม่กดสลับ → Task 2 Step 5
3. ธีม `system` + OS มืด → Scalar ต้องมืดตาม (`resolvedTheme` ไม่ใช่ `theme`) → Task 2 Step 5
4. string ใน spec ที่ BE แก้หลังแปลแล้ว → หน้าไทยต้องแสดงอังกฤษของใหม่ ไม่ใช่คำแปลเก่า → Task 1 Step 3 (ตรวจด้วย snippet) + Task 4 รายงาน stale
5. กดดาวน์โหลดตอนหน้าเป็นภาษาไทย → ไฟล์ต้องเป็นอังกฤษ placeholder → Task 2 Step 5

---

### Task 1: ย้าย spec ไป shared layer + `localizedSpec`

**Files:**
- Move: `routes/system-admin/interface/external-api-openapi.json` → `lib/external-api/openapi.json` (`git mv`)
- Create: `lib/external-api/openapi.th.json` (เริ่มเป็น `{}`)
- Create: `lib/external-api/localized-spec.ts`
- Modify: `routes/system-admin/interface/external-api-docs.tsx` (import path ใหม่; ใช้ `stripAuthorizeHint` แทน `AUTHORIZE_HINT` ในไฟล์)

**Interfaces:**
- Produces:
  - `type ExternalApiSpec = typeof openapi` (จาก `lib/external-api/openapi.json`)
  - `type SpecOverlay = Record<string, { en: string; th: string }>` — key = JSON pointer (RFC 6901 เช่น `/paths/~1api~1ext~1v1~1ap-invoices/get/summary`)
  - `function baseSpec(): ExternalApiSpec` — spec ที่ตัดประโยค Authorize แล้ว (ใช้เป็นต้นฉบับเทียบใน Task 4)
  - `function localizedSpec(locale: string, opts?: { overlay?: SpecOverlay }): ExternalApiSpec` — `baseSpec()` + servers placeholder + (เมื่อ `locale === "th"`) ทับ pointer ที่ `entry.en === ค่าปัจจุบัน` ด้วย `entry.th`; overlay default = `openapi.th.json`
  - `const PUBLIC_SERVERS` = `[{ url: "https://{host}", description: "Carmen", variables: { host: { default: "your-carmen-api-host" } } }]`
  - `function collectTranslatableStrings(spec: ExternalApiSpec): Map<string, string>` — pointer → ข้อความ สำหรับ field ที่ต้องแปลตาม spec §ภาษา (`info.description`, `tags[*].description`, operation `summary`/`description`, `parameters[*].description`, `responses.*.description`, `components.schemas.*.description`, `properties.*.description` ทุกชั้นรวม nested/`items`) — ห้ามเก็บ `example`/`examples`/`enum`

- [ ] **Step 1:** `git mv` spec และสร้าง `openapi.th.json` เป็น `{}`
- [ ] **Step 2:** เขียน `localized-spec.ts` ตาม Interfaces (ใช้ `structuredClone`; ข้อความ Authorize hint ย้ายมาจาก `external-api-docs.tsx` เป็น const ในไฟล์นี้) แล้วแก้ `external-api-docs.tsx` ให้ใช้ `baseSpec()` + import ใหม่ (Swagger ยังทำงานเหมือนเดิมใน task นี้)
- [ ] **Step 3:** ตรวจ stale-fallback ด้วย snippet (ไม่ commit): `bun -e 'import {localizedSpec} from "./lib/external-api/localized-spec.ts"; const s=localizedSpec("th",{overlay:{"/info/title":{en:"OLD",th:"ไทย"}}}); console.log(s.info.title)'`
  Expected: พิมพ์ชื่ออังกฤษเดิม (ไม่ใช่ `ไทย`) · เปลี่ยน `en` เป็นชื่อจริงแล้วรันอีกครั้ง Expected: `ไทย`
- [ ] **Step 4:** `bun run typecheck && bun run lint` ผ่าน · เปิดหน้า External กาง API documentation — Swagger ยังขึ้นและไม่มีประโยค Authorize
- [ ] **Step 5: Commit** — `refactor(interface): ย้าย openapi.json ไป lib/external-api และเพิ่ม localizedSpec`

### Task 2: หน้า public `/developers/api` ด้วย Scalar

**Files:**
- Create: `routes/developers/api/api-docs.route.tsx` — `export function Component()`; header + `lazy(() => import("./scalar-reference"))` + `Suspense` (skeleton) + error boundary (`ErrorState` + retry แบบเดียวกับ `DocsErrorBoundary` ใน `external-api-docs-section.tsx`)
- Create: `routes/developers/api/scalar-reference.tsx` — `export default function ScalarReference(props: { locale: string; dark: boolean })` ห่อ `ApiReferenceReact` + config ตาม Global Constraints + `customCss`
- Create: `lib/external-api/scalar-th.ts` — `export const SCALAR_TH` (คำแปล UI; คีย์ตาม `node_modules/@scalar/api-reference/dist/features/localization/locales/en.js` — แปลกลุ่ม `common search navigation server clientLibraries operation response schema download models actions`; ไม่แปล `agent mcp sdk developerTools`)
- Modify: `routes/router.tsx` — เพิ่ม `{ path: "/developers/api", lazy: () => import("./developers/api/api-docs.route") }` ถัดจาก route `/pl/:url_token` (นอก `ProtectedShell`) พร้อมคอมเมนต์ว่า public เพราะผู้อ่านคือนักพัฒนาภายนอกไม่มีบัญชี
- Modify: `messages/en.json`, `messages/th.json` — namespace ใหม่ `developers.apiDocs`: `pageTitle` ("Carmen API reference" / "เอกสารอ้างอิง Carmen API"), `brand` ("API"), `download` ("Download openapi.json" / "ดาวน์โหลด openapi.json"), `loadError`, `theme` (ใช้ `common.theme*` เดิมได้)
- Modify: `package.json`, `bun.lock` — `bun add @scalar/api-reference-react@0.9.81 --exact`

**Interfaces:**
- Consumes: `localizedSpec`, `PUBLIC_SERVERS` (Task 1), `useLocale` (use-intl), `useLocaleSwitch` (`hooks/use-locale-switch.ts`), `useTheme().resolvedTheme` (next-themes), `CarmenLogo` (`components/icons/carmen-logo.tsx`), `ThemeSwitch` (`components/navbar/theme-switch.tsx` — เป็น submenu ต้องห่อใน `DropdownMenu` + ปุ่ม icon เป็น trigger)
- Produces: route `/developers/api` (Task 3 ลิงก์มาที่นี่)

- [ ] **Step 1:** ติดตั้ง Scalar แบบ exact และเพิ่ม route + messages
- [ ] **Step 2:** เขียน `scalar-reference.tsx`:
  - `content: localizedSpec(props.locale)`; `forceDarkModeState: props.dark ? "dark" : "light"`; `key={props.locale}` บน `ApiReferenceReact` (spike: เปลี่ยน content อย่างเดียวไม่ re-render ภาษา UI)
  - `hiddenClients`: ทุก target ที่ Scalar มี **ยกเว้น** 5 ตัว (รายชื่อ target อ่านจาก `node_modules/@scalar/snippetz/dist/plugins/`)
  - `authentication`: ตั้งค่า placeholder ของ scheme `x-client-id` = `YOUR_CLIENT_ID`, `x-client-secret` = `YOUR_CLIENT_SECRET` (ดูรูปแบบใน `node_modules/@scalar/types/dist/api-reference/authentication-configuration.d.ts`)
  - `localization`: `{ locale: "th", translations: SCALAR_TH }` เมื่อ `th`
  - `customCss`: ซ่อน "Generate SDK" และ "Powered by Scalar" (หา selector จาก DOM จริง); `--scalar-font: var(--font-sans)`; `--scalar-font-code: var(--font-mono)`; เว้นที่ด้านบนให้ header ของเรา
- [ ] **Step 3:** เขียน `api-docs.route.tsx`: header สูง ~48px (`CarmenLogo` + `brand` · ขวา: ปุ่ม EN/TH, เมนูธีม, ปุ่ม `download` ที่สร้าง Blob จาก `localizedSpec("en")` ชื่อไฟล์ `carmen-external-api-openapi.json`) · ตั้ง `document.title = t("pageTitle")` · ส่ง `dark = resolvedTheme === "dark"`
- [ ] **Step 4:** `bun run typecheck && bun run lint` ผ่าน (โมดูล `developers` ถูก ESLint boundary ครอบอัตโนมัติ)
- [ ] **Step 5: ตรวจในเบราว์เซอร์** (`bun dev`, หน้าต่าง incognito ที่ `http://localhost:3000/developers/api`):
  - เห็นเอกสารโดยไม่ล็อกอิน · Network: ไม่มี host อื่นนอกจาก origin + backend (ตัดของ extension ทิ้ง — ตรวจด้วย `grep` ใน `dist`/`node_modules` ถ้าสงสัย)
  - 5 stack เท่านั้น, C# HttpClient มี, header ใน snippet = `YOUR_CLIENT_ID` / `YOUR_CLIENT_SECRET`, URL = `https://your-carmen-api-host/...`
  - ไม่มี Generate SDK / Powered by Scalar / Ask AI / Test Request / ปุ่มธีมของ Scalar / ปุ่มดาวน์โหลดของ Scalar
  - ตั้ง `localStorage['carmen.locale']='th'` แล้ว reload → ไทยทันที · สลับ EN/TH ใช้ได้ · ดาวน์โหลดตอน TH ได้ไฟล์อังกฤษ
  - ธีม system + OS มืด → เอกสารมืด; สลับธีมจากเมนู → ตาม
  - ความกว้าง 375px: header ไม่ล้น
  - เปิด `/dashboard` (ล็อกอิน) → network ไม่มี chunk ที่ชื่อขึ้นต้น `scalar-reference`
- [ ] **Step 6: Commit** — `feat(developers): หน้าเอกสาร API สาธารณะ /developers/api ด้วย Scalar`

### Task 3: ส่วนในแอปเลิก Swagger + ลิงก์ไปหน้า public

**Files:**
- Modify: `routes/system-admin/interface/external-api-docs-section.tsx` — เอา Collapsible/lazy/error boundary ออก; ย้าย `curlFor` + ปุ่ม Copy command + ดาวน์โหลด (ใช้ `baseSpec()` + server ของ BU = `externalApiRoot(...)` แบบเดิม) เข้ามา; เพิ่มปุ่ม "เปิดเอกสารฉบับเต็ม" (`<a href="/developers/api" target="_blank" rel="noopener noreferrer">` ผ่าน `Button asChild`, ไอคอน `ExternalLink`) และ `CopyButton` คัดลอก `${window.location.origin}/developers/api`; กลับไปใช้ `SettingSection` แบบปกติ (ไม่ `wide`/`frameless`) `first` + `plain`
- Delete: `routes/system-admin/interface/external-api-docs.tsx`, `routes/system-admin/interface/external-api-docs.css`, `types/swagger-ui-dist.d.ts`
- Modify: `package.json`, `bun.lock` — `bun remove swagger-ui-dist`
- Modify: `messages/en.json`, `messages/th.json` (`systemAdmin.interface.export.apiDocs`) — ลบ `show` `hide` `loadError`; เพิ่ม `openFull` ("Open full documentation" / "เปิดเอกสารฉบับเต็ม"), `copyLink` ("Copy link" / "คัดลอกลิงก์"), `linkCopied` ("Link copied" / "คัดลอกลิงก์แล้ว"); แก้ `desc` ให้บอกว่าเอกสารฉบับเต็มเปิดได้โดยไม่ต้องล็อกอิน ส่งลิงก์ให้ทีม integrator ได้
- Modify: `routes/system-admin/interface/CLAUDE.md` §API documentation — เขียนใหม่ตาม spec §เอกสารประกอบ (ที่อยู่ spec, overlay, `docs:i18n-check`, telemetry ต้องปิด, pin เวอร์ชัน, ขั้นอัปเดต spec จาก BE)
- Modify: `CLAUDE.md` (ราก) — ตัวอย่าง third-party พื้นขาวที่อ้าง "Swagger UI ในหน้า External" ให้เปลี่ยน/ลบให้ถูกต้อง

**Interfaces:**
- Consumes: `baseSpec` (Task 1), route `/developers/api` (Task 2)

- [ ] **Step 1:** แก้ section + messages + ลบไฟล์ + `bun remove swagger-ui-dist`
- [ ] **Step 2:** `git grep -i swagger-ui` → ไม่เหลือในโค้ด/`package.json`/`bun.lock` (เหลือใน CHANGELOG/docs เก่าได้)
- [ ] **Step 3:** `bun run typecheck && bun run lint && bun test:run routes/system-admin/interface` ผ่าน
- [ ] **Step 4: ตรวจในเบราว์เซอร์** หน้า `/system-admin/interface/export/external`: quick start เติม URL + Client ID ของ BU; ปุ่มเปิดเอกสารเปิดแท็บใหม่ไป `/developers/api`; คัดลอกลิงก์ได้ URL เต็ม; ดาวน์โหลดได้ openapi.json ที่ server เป็น host ของ BU
- [ ] **Step 5:** อัปเดต CLAUDE.md ทั้งสองไฟล์
- [ ] **Step 6: Commit** — `refactor(interface): เลิกใช้ Swagger UI ลิงก์ไปเอกสารสาธารณะแทน`

### Task 4: สคริปต์ `docs:i18n-check` + แปลเนื้อหา spec ครบ

**Files:**
- Create: `scripts/docs-i18n-check.ts`
- Modify: `package.json` — script `"docs:i18n-check": "bun scripts/docs-i18n-check.ts"`
- Modify: `lib/external-api/openapi.th.json` — คำแปลครบทุก pointer

**Interfaces:**
- Consumes: `baseSpec`, `collectTranslatableStrings`, `SpecOverlay` (Task 1)

- [ ] **Step 1:** เขียนสคริปต์: เทียบ `collectTranslatableStrings(baseSpec())` กับ `openapi.th.json` แล้วพิมพ์ 3 กลุ่ม — `missing` (pointer ใน spec ไม่มีใน overlay), `stale` (มีแต่ `en` ≠ ข้อความปัจจุบัน), `orphan` (มีใน overlay แต่ไม่มีใน spec) พร้อมจำนวน; exit code 0 เสมอ (ไม่บล็อก) บรรทัดสุดท้าย `missing=N stale=N orphan=N`; รองรับ flag `--scaffold` ที่เขียน entry ของ `missing` ลง overlay เป็น `{ en, th: "" }` ให้แปลต่อ (entry ที่ `th` ว่างนับเป็น missing และ `localizedSpec` ไม่ทับ)
- [ ] **Step 2:** `bun run docs:i18n-check -- --scaffold` แล้วแปลทุก `th` (ศัพท์ตาม `messages/th.json` เช่น ใบรับสินค้า, ใบลดหนี้, ภาษีซื้อ, เจ้าหนี้; markdown/โค้ด/ชื่อ field ใน backtick คงเดิม)
- [ ] **Step 3:** `bun run docs:i18n-check` → Expected บรรทัดสุดท้าย `missing=0 stale=0 orphan=0`
- [ ] **Step 4: ตรวจในเบราว์เซอร์** `/developers/api` ภาษา TH: บทนำ, คำอธิบาย endpoint/parameter/response/field ของ Objects เป็นไทย; ชื่อ field/enum/ตัวอย่าง JSON ยังอังกฤษ; markdown ในบทนำ (ตาราง, โค้ด) render ถูก
- [ ] **Step 5:** `bun run typecheck && bun run lint`
- [ ] **Step 6: Commit** — `feat(developers): แปลเอกสาร API เป็นภาษาไทยและเพิ่มสคริปต์ docs:i18n-check`

### Task 5: ตรวจรับ production build ภายใต้ CSP

**Files:** ไม่มี (ถ้าเจอปัญหาแก้ในไฟล์ของ task ที่เป็นเจ้าของ)

- [ ] **Step 1:** `SKIP_VERSION_BUMP=1 bun run build` ผ่าน · จด chunk ที่มี Scalar (ชื่อ + ขนาด gzip) และยืนยันว่าไม่มีไฟล์ชื่อ `external-api-docs-*` เหลือ
- [ ] **Step 2:** เสิร์ฟ `dist/` พร้อม header จาก `vercel.json` (สคริปต์ชั่วคราวใน scratchpad: Bun.serve port 4173, อ่าน `vercel.json` `headers[*].headers`, SPA fallback ไป `index.html`) แล้วเปิด `http://localhost:4173/developers/api`
  Expected: เอกสารขึ้น, console ไม่มี `Refused to` / CSP violation, resource host มีแค่ `localhost:4173` (+ backend)
- [ ] **Step 3:** ไล่ checklist 10 ข้อใน spec §การตรวจรับ ให้ครบ จดผลข้อที่ผ่าน/ไม่ผ่านไว้ในรายงานส่งงาน
- [ ] **Step 4:** ปิด server ชั่วคราว · ไม่มี commit ถ้าไม่มีอะไรต้องแก้
