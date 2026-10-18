# เอกสาร API สาธารณะแบบ Stripe ด้วย Scalar (แทน Swagger UI)

วันที่ 2026-10-19 · รีโป: `carmen-inventory-frontend-react` (FE อย่างเดียว)
· ต่อยอดจาก branch `feature/external-page-polish` (ไฟล์ส่วน API documentation ถูกแก้ใน branch นั้น)

## เจตนา

เอกสาร API ขาเข้า (`/api/ext/v1` — ap-invoices / gl-journals) ตอนนี้เป็น Swagger UI ฝังอยู่ในหน้า
`/system-admin/interface/export/external` ซึ่ง (1) หน้าตาโบราณ (2) มีตัวอย่างแค่ curl และ
(3) เปิดได้เฉพาะคนที่ล็อกอิน Carmen และมีสิทธิ์ `system_admin.bu_api_key.view`

คนที่ต้องอ่านจริงคือ **นักพัฒนาฝั่งลูกค้า** (ทีมระบบบัญชีที่มาดึงข้อมูล) ซึ่ง **ไม่มีบัญชี Carmen**
ต้องเปิดเอกสารได้จากลิงก์โดยไม่ล็อกอิน หน้าตาและการใช้งานต้องใกล้ https://docs.stripe.com/api
(สามช่อง: เมนูซ้าย · คำอธิบายกลาง · โค้ด+response ขวาติดจอ) และมีตัวอย่างหลาย stack

ผู้ใช้เลือกใช้ **Scalar** (`@scalar/api-reference-react`, MIT) แทนการเขียนตัว render เอง —
spike เมื่อ 2026-10-19 ยืนยันแล้วว่า layout "modern" ของ Scalar ตรงแบบที่ต้องการ, สร้าง snippet ครบ 5 stack
จาก spec เอง, render ผ่าน CSP production เดิม (ไม่มี `eval` / `new Function` ใน chunk), ไม่ยิง request
ออกนอกเมื่อปิด telemetry, และรับคำแปล UI ภาษาไทยผ่าน `localization.translations` ได้

## เป้าหมาย

1. หน้า **public** ใหม่ `/developers/api` — ไม่ต้อง auth, render ด้วย Scalar layout `modern`
2. ตัวอย่างโค้ด **5 stack เท่านั้น**: cURL (shell), Node.js, Python, PHP, C# — ค่าเริ่มต้น cURL
   ภาษาอื่นที่ Scalar มีให้ซ่อนทั้งหมด
3. **สองภาษา EN / TH** สลับได้บนหน้า ใช้ locale เดียวกับแอป (`carmen.locale` ผ่าน `I18nProvider` /
   `useSwitchLocale`) — สลับแล้วทั้ง UI ของ Scalar และเนื้อหาเอกสารเปลี่ยนตาม
4. ส่วน "API documentation" ในหน้า External (ในแอป) **เลิกใช้ Swagger** เหลือ:
   Quick start curl ที่เติม URL/Client ID ของ BU (ของเดิม) + ปุ่มดาวน์โหลด openapi.json (ของเดิม) +
   ปุ่ม **"เปิดเอกสารฉบับเต็ม"** (เปิด `/developers/api` แท็บใหม่) + ปุ่ม **คัดลอกลิงก์** (ไว้ส่งให้ทีม integrator)
5. ถอด `swagger-ui-dist` ออกจากโปรเจกต์ทั้งหมด

## ไม่ทำ (non-goals)

- ไม่มี "Try it" / ยิง request จริงจากหน้าเอกสาร (ต้องวาง secret ในเบราว์เซอร์ และ BE ไม่เปิด CORS ให้ `/api/ext`)
- ไม่ใช้บริการ host ของ scalar.com — ใช้แค่ library open source ฝังในแอป
- ไม่แก้ backend — spec ยังเป็นสำเนาของ BE `docs/external-api/openapi.json` เหมือนเดิม
- ไม่เขียน snippet เองต่อภาษา (`x-codeSamples`) — ใช้ snippet ที่ Scalar สร้าง
- ไม่ทำ SEO / sitemap / หน้า landing "developers" อื่น ๆ — มีหน้าเดียว

## Anti-goals (ทำงานได้แต่ถือว่าล้มเหลว)

- หน้า public ยิง request ไปโดเมนภายนอกใด ๆ (scalar.com, posthog, CDN ฟอนต์) — **telemetry ของ Scalar
  เปิดเป็นค่าเริ่มต้น** ต้องปิดชัดเจน ลืมปิด = ส่งข้อมูลผู้เข้าชมออกไปเงียบ ๆ (CSP `connect-src https:` ไม่ช่วยบล็อก)
- ตัวอย่างโค้ดหรือหน้าใดมีค่า client id / secret / base URL **จริง** ของ BU ใด — หน้า public ใช้ placeholder เท่านั้น
- มีปุ่ม/ลิงก์ขายของ Scalar หลงอยู่ ("Generate SDK", "Powered by Scalar", Agent/Ask AI, MCP, Developer tools)
- ธีมของเอกสารขัดกับธีมแอป (เช่นแอปสว่างแต่เอกสารมืด) หรือมีปุ่มสลับธีมสองชุด
- Scalar chunk ถูกโหลดในหน้าอื่นของแอป (ต้อง lazy เฉพาะ route นี้)

## ข้อจำกัด

- **CSP** (`vercel.json`, nginx, GCS, CloudFront — 4 ไฟล์ตรงกัน, `lib/__tests__/security-headers.test.ts`
  เทียบให้): `font-src 'self' data:` → ต้อง `withDefaultFonts: false`; `style-src 'unsafe-inline'` มีอยู่แล้ว;
  ห้ามแก้ CSP เพื่อ Scalar
- **ขนาด**: chunk Scalar ราว 3.1 MB (gzip ~942 KB) เทียบ Swagger 1.46 MB (gzip 428 KB) — ผู้ใช้ยอมรับแล้ว
  เงื่อนไขคือต้องอยู่ใน lazy chunk ของ route นี้เท่านั้น
- **Module boundary (ESLint)**: `routes/<A>/` import `routes/<B>/` ไม่ได้ — spec ที่ใช้ร่วมสองโมดูลต้องย้ายไป
  shared layer
- **Public route**: วางนอก `ProtectedShell` แบบเดียวกับ `/terms`, `/pl/:url_token` ใน `routes/router.tsx`
  SPA fallback ของทุก deploy target รองรับ path ใหม่อยู่แล้ว (ผู้สร้างตรวจซ้ำว่า `/developers/api` เปิดตรง ๆ ได้บน
  Vercel/nginx)
- **Pin เวอร์ชัน Scalar แบบ exact** (spike ใช้ `@scalar/api-reference-react@0.9.81` ↔ `@scalar/api-reference@1.75.0`)
  เพราะการซ่อนองค์ประกอบบางส่วนพึ่ง CSS selector ภายในของ Scalar อัปเกรดแล้วต้องตรวจหน้าด้วยตาอีกครั้ง

## การตัดสินใจที่ผู้ใช้เลือกแล้ว

- ใช้ Scalar (ไม่เขียน renderer เอง)
- คนอ่าน = นักพัฒนาภายนอกไม่มีบัญชี → หน้า public
- Layout สามช่องแบบ Stripe (แบบ A ใน mockup)
- Stack: curl, Node.js, Python, PHP, C#
- สองภาษา EN + TH
- Snippet ใช้ placeholder ไม่บังคับให้อ่าน env var (ยอมรับข้อจำกัดของ Scalar)

## โครงสร้าง (การตัดสินใจของผู้ออกแบบ — แก้ได้ถ้ามีเหตุผล)

### ไฟล์

| ที่อยู่ | หน้าที่ |
|---|---|
| `lib/external-api/openapi.json` | ย้ายมาจาก `routes/system-admin/interface/external-api-openapi.json` (git mv) — สำเนาจาก BE ตัวเดียวที่ทั้งสองโมดูลใช้ |
| `lib/external-api/openapi.th.json` | overlay คำแปลไทยของเนื้อหา spec (ดู §ภาษา) |
| `lib/external-api/localized-spec.ts` | `localizedSpec(locale)` → spec ฉบับพร้อมแสดง: แทน `servers`, ใส่ placeholder, ทับคำแปลเมื่อ `th` |
| `lib/external-api/scalar-th.ts` | คำแปล UI ของ Scalar ภาษาไทย (`localization.translations`) |
| `routes/developers/api/api-docs.route.tsx` | หน้า public (`export function Component`) — header + lazy Scalar |
| `routes/developers/api/scalar-reference.tsx` | ตัวห่อ `ApiReferenceReact` + config + `customCss` — ไฟล์เดียวที่ import Scalar (lazy) |
| `routes/system-admin/interface/external-api-docs-section.tsx` | เหลือ Quick start + ดาวน์โหลด + เปิดเอกสาร + คัดลอกลิงก์ |
| ลบ | `external-api-docs.tsx`, `external-api-docs.css`, `types/swagger-ui-dist.d.ts`, dependency `swagger-ui-dist` |

`curlFor` / ปุ่มดาวน์โหลดใน `external-api-docs.tsx` เดิมย้ายเข้า `external-api-docs-section.tsx` (ไม่ต้อง lazy แล้ว
เพราะไม่มี Swagger) — ดาวน์โหลดเป็นฉบับภาษาอังกฤษพร้อม server ของ BU นั้น (พฤติกรรมเดิม)

### หน้า `/developers/api`

- **Header บางของเราเอง** ด้านบน (สูงราว 48px, ไม่ใช่ของ Scalar): โลโก้ Carmen + "API" · ด้านขวา
  ตัวสลับ EN/TH + ตัวสลับธีม (ใช้ `ThemeSwitch`/next-themes ของแอปถ้าใช้นอก shell ได้ ไม่งั้นปุ่มเล็กที่เรียก `setTheme`)
- header มีปุ่ม **ดาวน์โหลด openapi.json** ของเราเอง (การตัดสินใจของผู้ออกแบบ) — ให้ไฟล์ **ภาษาอังกฤษฉบับ placeholder เสมอ**
  ไม่ว่าหน้ากำลังแสดงภาษาไหน (ปุ่มของ Scalar จะดาวน์โหลด spec ที่กำลังแสดงอยู่ ซึ่งเป็นฉบับไทยเมื่อเลือก TH จึงปิดไป)
- ใต้ header คือ Scalar เต็มความกว้าง; เมนูซ้ายของ Scalar ต้องไม่ถูก header บัง (ผู้สร้างจัด offset ตามจริง)
- Scalar โหลดแบบ `lazy()` + `Suspense` fallback เป็น skeleton; error boundary แสดง `ErrorState` พร้อม retry
- `<title>` ของหน้า: "Carmen API reference"
- จอแคบ: ใช้ responsive ของ Scalar เอง (เมนูยุบเป็น hamburger) — header ของเราต้องไม่ล้นที่ 375px

### Config ของ Scalar (ทุกค่าจำเป็น)

```ts
{
  content: localizedSpec(locale),
  layout: "modern",
  telemetry: false,                 // ค่าเริ่มต้น true — ห้ามลืม
  withDefaultFonts: false,          // CSP font-src
  hideTestRequestButton: true,
  hideClientButton: true,
  hideDarkModeToggle: true,         // ใช้ปุ่มธีมของเรา
  forceDarkModeState: resolvedTheme === "dark" ? "dark" : "light",
  showDeveloperTools: "never",
  agent: { disabled: true },
  mcp: { disabled: true },
  documentDownloadType: "none",     // ปุ่มดาวน์โหลดของเราเองใน header (ดูด้านล่าง)
  hiddenClients: { /* ทุก target ยกเว้น shell, node, python, php, csharp */ },
  defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
  localization: locale === "th" ? { locale: "th", translations: SCALAR_TH } : undefined,
  customCss: /* ซ่อน Generate SDK, Powered by Scalar; ฟอนต์/สีตาม token ของแอป */,
}
```

- ใน target ที่เหลือจะเก็บ client ย่อยตัวไหน (เช่น shell: curl/wget/httpie, node: fetch/axios/…) ให้ผู้สร้างเลือก
  แต่ต้องมีอย่างน้อยหนึ่งตัวต่อ stack และ C# ต้องมี HttpClient
- ถ้าไม่มี option สำหรับซ่อน "Generate SDK" / "Powered by Scalar" ใช้ `customCss` (spike ยืนยันว่ามีสองอย่างนี้โผล่)
- ฟอนต์: ใช้ฟอนต์ของแอปผ่าน CSS variable ของ Scalar (`--scalar-font`, `--scalar-font-code`) ชี้ไปที่ฟอนต์ที่แอปโหลดอยู่แล้ว
  โทนสี: ใกล้ token ของแอป (primary) พอประมาณ ไม่ต้อง theme ทุกจุด

### Placeholder (หน้า public ไม่มีค่าจริงของ BU ใด)

- `servers`: `[{ url: "https://{host}", variables: { host: { default: "your-carmen-api-host" } } }]` —
  ผู้อ่านพิมพ์ host จริงได้ในช่อง server ของ Scalar แล้ว snippet อัปเดตตาม ไม่ prefill จาก `BACKEND_URL`
  เพราะ host สาธารณะของ `/api/ext` (`base_url` ที่ BE ส่งมา) อาจไม่ใช่ `BACKEND_URL` ของ deployment
- ค่าใน header ของ snippet: `x-client-id` → `YOUR_CLIENT_ID`, `x-client-secret` → `YOUR_CLIENT_SECRET`
  (spike พบว่าค่าเริ่มต้นของ Scalar เป็น `YOUR_SECRET_TOKEN` ทั้งคู่ — ตั้งผ่าน `authentication` config ของ Scalar)
- หัวข้อ Authentication ใน intro ต้องบอกชัด (สองภาษา) ว่าให้เก็บ secret ใน environment variable / secret store
  ห้ามใส่ในโค้ดหรือ URL

### ภาษา

- **UI ของ Scalar**: `lib/external-api/scalar-th.ts` แปลทุกข้อความที่ **มองเห็นได้** ใน layout modern ที่เราเปิดใช้
  (search, navigation, operation, response, schema, models, download, actions) ข้อความของฟีเจอร์ที่ปิด (agent, mcp,
  developerTools, sdk) ไม่ต้องแปล — คีย์ที่ขาด Scalar ถอยไปอังกฤษเอง
- **เนื้อหา spec**: `openapi.th.json` เป็น overlay แบบแบน key = JSON pointer ของ string ใน spec, value =
  `{ "en": "<ข้อความอังกฤษต้นฉบับ ณ ตอนแปล>", "th": "<คำแปล>" }` ครอบ:
  `info.description` (บทนำทั้งก้อน — markdown), `tags[*].description`, `paths.*.*.summary` / `description`,
  `parameters[*].description`, `responses.*.description`, `components.schemas.*.description` และ
  `properties.*.description`
- `localizedSpec` ตัดประโยคชวนกด Authorize (`AUTHORIZE_HINT` ใน `external-api-docs.tsx` เดิม) ออกจาก
  `info.description` ทุกภาษา เพราะไม่มี Try it — และ `en` ใน overlay ต้องเทียบกับข้อความ **หลังตัด** แล้ว
  ไม่งั้น i18n-check จะรายงาน stale ตลอด (การตัดสินใจของผู้ออกแบบ)
- `localizedSpec("th")` ทับเฉพาะ pointer ที่ `en` ยังตรงกับต้นฉบับปัจจุบัน — ถ้า BE เปลี่ยนข้อความแล้วยังไม่แปลใหม่
  จะแสดงอังกฤษ (ไม่แสดงคำแปลเก่าที่อาจผิด)
- **ห้ามแปล**: ชื่อ field, ค่า enum, ชื่อ endpoint, ตัวอย่าง (examples), ชื่อ header
- สคริปต์ `bun run docs:i18n-check` (ไม่ใช่เทสต์ — **ไม่บล็อก build/CI**) รายงานสองกลุ่ม:
  string ใน spec ที่ยังไม่มีคำแปล และคำแปลที่ต้นฉบับเปลี่ยนแล้ว (stale) ใช้หลัง copy spec ใหม่จาก BE
- งานนี้ต้อง **แปลครบทุก string** ใน spec ปัจจุบัน (สคริปต์ต้องรายงาน 0 / 0 ตอนส่งงาน)
- `<title>` และข้อความใน header ของเราใช้ `messages/{en,th}.json` ตามปกติ — ระวังกับดัก ICU: ข้อความห้ามมี `{}` / `<token>`

### ในแอป (หน้า External → API documentation)

- คงเงื่อนไขการมองเห็นเดิม (สิทธิ์ `bu_api_key.view` + ใบ INF อ่านได้)
- เลิก Collapsible + lazy Swagger; แสดงตรง ๆ: Quick start (curl ที่เติม URL + Client ID ของ BU, secret เป็น
  `$CARMEN_CLIENT_SECRET`) · ปุ่มดาวน์โหลด openapi.json · ปุ่ม "เปิดเอกสารฉบับเต็ม" (`<a target="_blank" rel="noopener">`)
  · ปุ่มคัดลอกลิงก์ (`${window.location.origin}/developers/api`)
- layout ของ section ใช้ `SettingSection` แบบเดียวกับ section อื่นในหน้า (การ์ดคอลัมน์ขวา) — ไม่ต้อง wide แล้วเพราะเนื้อหาสั้น

### เอกสารประกอบที่ต้องอัปเดต

- `routes/system-admin/interface/CLAUDE.md` §API documentation — เขียนใหม่: ที่อยู่ spec ใหม่, overlay ไทย,
  สคริปต์ i18n-check, กติกาห้าม telemetry, pin เวอร์ชัน
- `CLAUDE.md` ราก (บรรทัดที่อ้าง Swagger UI ในหน้า External เป็นตัวอย่าง third-party พื้นขาว) — แก้ตัวอย่าง
- ขั้นตอนอัปเดต spec จาก BE: copy มาทับ `lib/external-api/openapi.json` → รัน `docs:i18n-check` → แปลส่วนที่ขาด

## การตรวจรับ (ผู้ใช้ตรวจด้วยตา/เบราว์เซอร์ — ไม่เขียนเทสต์อัตโนมัติเพิ่ม เว้นแต่ผู้ใช้ขอ)

1. เปิด `/developers/api` ในหน้าต่าง incognito (ไม่ล็อกอิน) ได้ ไม่เด้งไป `/login`
2. Network tab: ไม่มี request ไปโดเมนอื่นนอกจาก origin ของแอป (และ backend จาก boot ปกติของแอป)
3. ทั้ง 5 stack แสดงได้, C# HttpClient มี, ไม่มีภาษาอื่น, header เป็น `YOUR_CLIENT_ID` / `YOUR_CLIENT_SECRET`
4. ไม่มี Generate SDK / Powered by Scalar / Ask AI / Test Request / ปุ่มธีมของ Scalar
5. สลับ TH: เมนู, หัวข้อ, คำอธิบาย parameter/field เป็นไทย; ชื่อ field/enum ยังเป็นอังกฤษ; `docs:i18n-check` = 0/0
6. สลับธีมแอป → เอกสารตาม; reload แล้วจำทั้งภาษาและธีม
7. `bun run build` แล้วเสิร์ฟ `dist/` พร้อม header CSP จริง → หน้าเปิดได้ ไม่มี CSP violation ใน console
8. chunk Scalar ไม่ถูกโหลดในหน้าอื่น (เช่นเปิด `/dashboard` แล้วดู network)
9. หน้า External ในแอป: ไม่มี Swagger, ปุ่มเปิด/คัดลอกลิงก์ทำงาน, ดาวน์โหลด openapi.json ยังได้, curl ยังเติมค่าของ BU
10. typecheck + lint ผ่าน; `swagger-ui-dist` ไม่อยู่ใน `package.json` / `bun.lock`

## ปล่อยให้ผู้สร้างตัดสินใจ

- client ย่อยที่เก็บไว้ในแต่ละ stack (เงื่อนไขตาม §Config)
- รายละเอียด customCss / การไล่สีให้ใกล้ token ของแอป
- ถ้อยคำแปลภาษาไทย (ใช้ศัพท์บัญชีที่แอปใช้อยู่แล้วใน `messages/th.json` เช่น ใบรับสินค้า, ใบลดหนี้, ภาษีซื้อ)
- โครงภายในของ `localizedSpec` และสคริปต์ i18n-check
