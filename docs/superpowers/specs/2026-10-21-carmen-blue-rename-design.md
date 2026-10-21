# เปลี่ยนชื่อผลิตภัณฑ์ที่คนนอกเห็น: "Carmen" → "Carmen Blue"

วันที่: 2026-10-21 · ครอบคลุมหลายรีโปใต้ `~/GitHub/carmensoftware-organize/` (รายการใน §ขอบเขต)

## ทำไม

ผลิตภัณฑ์นี้เป็น **ผลิตภัณฑ์ใหม่** (codename Carmen Blue) แต่ข้อความหลายจุดที่คนนอกเห็น — หน้าจอแอป,
อีเมล, PDF, Swagger/Scalar, คู่มือ — ยังเรียกมันว่า "Carmen" เฉย ๆ ซึ่งชนกับ **ผลิตภัณฑ์ Carmen เดิม**
(Carmen 4 / Carmen Cloud / Carmen GL) ทำให้ลูกค้า ทีมขาย และผู้อ่านเอกสารเข้าใจผิดว่าเป็นตัวเดียวกัน

## เป้าหมาย

1. ทุกข้อความที่ **คนนอกทีมเห็น** และหมายถึงผลิตภัณฑ์ใหม่ ใช้ชื่อ Carmen Blue ตามตารางชื่อด้านล่าง
2. ชื่อบริษัทแบบทั่วไปใช้ **CarmenSoftware** (ติดกัน)
3. เอกสาร "ที่ยังมีชีวิต" (README, คู่มือ, wiki, PRD/design ที่ยังใช้อ้างอิง) ใช้ชื่อเดียวกัน

## ไม่ใช่เป้าหมาย

- **ไม่แตะชื่อภายใน:** ชื่อรีโป, ชื่อ package, identifier ในโค้ด (`CarmenLogo`, `CARMEN_SYSTEM`, `carmen_gl` …),
  env var, ชื่อ DB/schema, ชื่อ service/Docker/k8s, URL/โดเมน, branch, log/OTel attribute,
  ชื่อ flow ใน Keycloak ("Carmen - Google ID token") — เปลี่ยนแล้วเสี่ยง build/deploy/integration พัง
- **ไม่ migrate ข้อมูลใน DB** — แก้เฉพาะ source/seed ข้อมูลที่บันทึกแล้วคงเดิม (user ตัดสินใจ)
- **ไม่ทำโลโก้/ภาพ** ในรอบนี้ (ดู §งานที่แยกไปทำทีหลัง)
- **ไม่แก้ประวัติ:** CHANGELOG.md, `changelog.json` (ทั้งที่เสิร์ฟผ่าน What's New), spec/plan ลงวันที่ใน
  `docs/superpowers/` และ `.planning/` — เป็นบันทึกเหตุการณ์ ไม่ใช่เอกสารอ้างอิงปัจจุบัน *(ผมตัดสินใจเอง)*

## Anti-goals (ถือว่าล้มเหลวแม้ build ผ่าน)

- ไปเปลี่ยนชื่อที่หมายถึง **ผลิตภัณฑ์เดิม** — "Carmen 4", "Carmen GL", "Interface Carmen GL",
  "Carmen Cloud" ในบริบทตัวเก่า, ปุ่ม "Import from Carmen GL" → ต้องคงเดิมทุกจุด
- ไปเปลี่ยน **ชื่อนิติบุคคลที่จดทะเบียน** — `LEGAL_ENTITY.company` ใน `routes/legal/legal-content.ts`,
  "คาร์เมน ซอฟต์แวร์ บจก." / "Carmen Software Co., Ltd." ในข้อมูลทดสอบหรือที่อยู่บริษัท → คงเดิม
- find-and-replace แบบหว่าน (`Carmen` → `Carmen Blue`) จนได้ "Carmen Blue Blue", "Carmen Blue 4",
  หรือแตะ identifier
- ข้อความในคู่มือที่อ้าง UI label/ข้อความ error ไม่ตรงกับแอปหลังแก้

## ตารางชื่อ (กติกาหลัก)

| เจอ | กลายเป็น |
|---|---|
| "Carmen" / "คาร์เมน" ที่หมายถึงผลิตภัณฑ์ใหม่ | **Carmen Blue** |
| "Carmen Inventory", "Carmen Accounting", "Carmen ERP", "Carmen Cloud ERP" (ในบริบทผลิตภัณฑ์ใหม่) | **Carmen Blue** — ส่วน Inventory/Accounting เรียกเป็นโมดูลในประโยคถ้าจำเป็น เช่น "โมดูล Accounting ของ Carmen Blue" |
| "Carmen Platform" (คอนโซลผู้ดูแล) | **Carmen Blue Platform** |
| "Carmen Software" (บริษัท, ใช้ทั่วไป) | **CarmenSoftware** |
| ชื่อนิติบุคคลจดทะเบียน | คงเดิม |
| "Carmen 4", "Carmen GL", ตัวเก่าทุกแบบ | คงเดิม |
| ชื่อโรงแรม/บริษัทสมมติในตัวอย่าง ("Carmen Grand Hotel", "Carmen Hotels Group", "The Carmen, Lisbon" …) | ชื่อกลาง ๆ ไม่มีคำว่า Carmen เช่น "Riverside Hotel", "Grand Hotel Group" |
| ค่าตั้งต้น email subject prefix `"[Carmen]"` | `"[Carmen Blue]"` |

**ตัวสะกด** *(ผมเสนอ user ไม่ค้าน — ยึดตามที่ frontend ทำอยู่):* **CARMEN BLUE** ตัวใหญ่สำหรับ wordmark /
footer / หัวกระดาษ / ข้อความกฎหมาย · **Carmen Blue** ในประโยคและ title · ห้าม "CarmenBlue"
คำว่า "Carmen blue" (b เล็ก) ที่หมายถึง **สีแบรนด์** #0154BD ไม่ใช่ชื่อผลิตภัณฑ์ — ไม่แตะ

**ภาษาไทย:** ใช้ "Carmen Blue" อักษรโรมันในข้อความไทยด้วย (ไม่ทับศัพท์เป็น "คาร์เมน บลู")

## ขอบเขตรีโป

### อยู่ในขอบเขต (คนนอกเห็น → ทำก่อน)

| รีโป | จุดหลัก (จาก audit 21 ต.ค., ตัวเลขประมาณ) |
|---|---|
| `carmen-turborepo-backend-v2` | ~45 + OpenAPI snapshot: Swagger gateway (`apps/backend-gateway/src/main.ts:188-265`, `httpdocs/defaultroot.html.ts:16,233`), คำอธิบาย controller platform-user/clusters/auth, External API (`src/external-api/external-api.swagger.ts`, `ap-invoice`/`gl-journal` controller + `swagger/examples.ts`), อีเมล (`apps/micro-business/src/authen/auth/auth.service.ts:3429-3525`, `app-config/app-config.service.ts:945-1029`), Excel `workbook.creator = 'Carmen System'` 3 จุด (PR/PO/GRN service), seed `ai.mcp` description (`seed.license-feature.data.ts:128` + `permission.route-map.ts:486`), `docs/external-api/accounting-export.md:89`, ตัวอย่างโรงแรมสมมติ ~40 จุด, `subject_prefix` ตัวอย่าง Swagger, MCP tool description `get-backend-status.tool.ts:22` |
| `micro-notification` | footer อีเมล "Carmen ERP" (`src/email/email.service.ts:404,432`), อีเมลทดสอบ (`app-config.service.ts:294`, `platform-email.service.ts:145-149`), OpenAPI title `v1.controller.ts:183` + spec ที่ assert ข้อความ |
| `micro-report` | footer PDF (`service/generator/pdf_generator.go:214`, `templates/common/layout.html:194`), swag `@description` (`cmd/server/main.go:30`) แล้ว regenerate `docs/swagger/*` |
| `micro-data` | `@contact.name Carmen Software` → CarmenSoftware (`cmd/server/main.go:28`) แล้ว regenerate `api/openapi.*` |
| `carmen-inventory-frontend-react` | i18n `messages/en.json`/`th.json` ~18 key ต่อภาษา, alt โลโก้ (`auth-split-shell.tsx`, `app-sidebar.tsx`, `legal-page.tsx`, `api-docs.route.tsx`), `components/icons/carmen-logo.tsx:13,20`, Scalar (`lib/external-api/openapi.json` + `openapi.th.json` + server description ใน `localized-spec.ts:22` / `external-api-docs-section.tsx:48`), `config-email-component.tsx:50,275` prefix, `lib/email-template.ts:38,46` ชื่อโรงแรมตัวอย่าง, `docs/investor/**`, `docs/email-profile-microsoft-oauth2.md` (ลิงก์จาก UI) |
| `carmen-platform` | "Carmen Platform" → "Carmen Blue Platform" ทั้ง `index.html`, `Login.tsx`, `Sidebar.tsx` `PRODUCT_BRAND` (**ระวัง: `isProductBrand()` เทียบ string นี้**), i18n `src/i18n/en.ts`/`th.ts`, `ProductLogo.tsx:38` alt, `NotificationEmailConfigCard.tsx:241` placeholder, README |
| `carmen-inventory-mobile` | `app.json` permission prompts (52, 67, 73), `src/i18n/translations.ts` th+en, `src/hooks/use-auth.tsx:447`, `src/components/onboarding/tour.tsx` (wordmark + ข้อความ + ชื่อโรงแรมสมมติ 187-189) |
| `carmen-platform-support-usermanual` | ~66: `site/.vitepress/config.mts`, hero `index.md`, หน้า login, glossary ฯลฯ ทั้ง th/en — ข้อความที่อ้าง UI ต้องตรงกับ platform หลังแก้ |
| `carmen-turborepo-backend-bruno` | คำอธิบายที่ copy จาก Swagger (sync ใหม่จาก Swagger ไม่แก้มือ), ตัวอย่างโรงแรมสมมติ, README "Carmen Software" |

### อยู่ในขอบเขต (คนในอ่าน → ทำหลัง)

| รีโป | หมายเหตุ |
|---|---|
| `carmen-wiki` | ~340 จุด รวมชื่อเล่ม "Carmen Inventory"/"Carmen Platform" — **มีไฟล์ค้างไม่ commit 239 ไฟล์** ห้ามแตะ/ทับ ดู §ข้อควรระวัง |
| `carmen-accounting-concept` | "Carmen Cloud ERP" ~19 จุด → Carmen Blue (user ยืนยัน) |
| `carmen-accounting-task` | "Carmen Accounting"/"Carmen Inventory" ~45 จุด (รวม eyebrow ในสไลด์ `slides/accounting-backlog/index.tsx:345`) |
| `carmen-inventory-frontend-e2e`, `carmen-platform-e2e` | **ไม่มี assertion ไหนผูกกับชื่อแบรนด์** — แก้เฉพาะ annotation/คำอธิบายที่พูดถึงชื่อผลิตภัณฑ์ (เช่น `carmen-platform-e2e/tests/auth/login.spec.ts:23`) ข้อมูล seed (`CARMEN` cluster, `lastname: 'CARMEN'`, `CARMEN-AVG`, อีเมล `carmensoftware.dev+…`) เป็น identifier คงเดิม |

### นอกขอบเขต

- `developer-carmensoftware`, `knowledge-base-carmen`, `Accounting-docs`, `carmen` (PeakMNA) — user ตัดออก
- `carmen-inventory-god-mode` — คอนโซลพนักงานภายใน ไม่มีคนนอกเห็น *(ผมตัดสินใจเอง)*
- `micro-cronjobs`, `micro-file`, `micro-keycloak` — audit แล้วเป็น identifier ล้วน ไม่มีอะไรต้องแก้
- `report-render` — มีแค่โลโก้ฝัง (`CarmenLogoBase64`) → ไปอยู่ในงานโลโก้

## จุดที่ต้องทำตามลำดับ

1. **OpenAPI ของ External API มีต้นทางเดียว:** แก้ `carmen-turborepo-backend-v2` (`external-api.swagger.ts` +
   controller/examples) → regenerate `docs/external-api/openapi.json` → copy ไป
   `carmen-inventory-frontend-react/lib/external-api/openapi.json` → แก้ overlay `openapi.th.json`
   ให้ตรง (overlay keyed ด้วยข้อความอังกฤษ) → `bun run docs:i18n-check` ต้องผ่าน
2. **platform ก่อน usermanual:** ข้อความในคู่มือที่ quote UI (เช่น error "No Carmen Platform account exists for
   this Google email…", label ใน platform-config) ต้องตรงกับข้อความใหม่ใน platform
3. ไม่มี API contract เปลี่ยน → ลำดับ deploy ระหว่าง BE/FE ไม่สำคัญ

## ข้อควรระวัง

- **ไฟล์ค้างในรีโป:** `carmen-wiki` (239), `carmen-inventory-frontend-e2e` (44, อยู่บน `feature/interface-export-group`),
  และรีโปอื่นที่ค้าง 1-4 ไฟล์ — user รัน Claude หลายเซสชันพร้อมกัน ห้าม stash/reset/checkout ทับ
  **ทำทุกรีโปใน worktree แยกจาก `origin/main` เสมอ** · ตรวจแล้ว (21 ต.ค.): ไฟล์ค้างของ wiki เป็น `.png` ทั้งหมด
  ไม่ทับกับ `.md` ที่ต้องแก้ · ของ e2e ทับแค่ `tests/results/*.json` (ผลรันที่ generate) — ไม่ต้องแก้ไฟล์นั้น
  ถ้าตอนลงมือพบไฟล์ค้างที่ทับกับเป้าหมาย ให้ข้ามไฟล์นั้นแล้วรายงาน user
- **หน้า legal:** ตรวจแล้ว ข้อความกฎหมายใช้ "CARMEN BLUE" อยู่แล้ว เหลือแค่ `company: "Carmen Software"` (ชื่อจดทะเบียน → คงเดิม)
  และ `alt="Carmen"` ของโลโก้ใน `legal-page.tsx:91,96` (แก้ได้) — ไม่มีถ้อยคำสัญญาให้แตะ
- **OpenAPI regenerate:** ถ้า generator ดึงความต่างอื่นที่ไม่ใช่การเปลี่ยนชื่อมาด้วย (drift บน main หรือสำเนา FE
  ไม่ตรงต้นทาง) ให้หยุดและรายงาน อย่ารวมของที่ไม่เกี่ยวเข้า PR นี้ *(ผมตัดสินใจเอง)*
- **seed แบบ upsert:** ถ้า seed `ai.mcp` / report template เป็น upsert ที่รันตอน deploy แล้วเขียนทับคำอธิบายเดิม
  ถือว่ารับได้ (ได้ข้อความใหม่โดยไม่ต้องเขียน migration เอง) — "ไม่ migrate" หมายถึงไม่เขียน migration/UPDATE แยก *(ผมตัดสินใจเอง)*
- **`PRODUCT_BRAND` ใน platform:** grep หาผู้ใช้ string "Carmen Platform" ทั้งหมดก่อนแก้ (state ที่บันทึก, response, test)
  ถ้ามีคนเทียบค่าจากภายนอกให้หยุดรายงาน
- **ข้อความ error ที่ API ตอบกลับลูกค้า** (4xx/5xx body) นับเป็นสิ่งที่คนนอกเห็น — ถ้าเจอ "Carmen" เปล่าให้แก้ด้วย *(ผมตัดสินใจเอง)*
- **seed เปลี่ยนแต่ DB ไม่เปลี่ยน:** `ai.mcp` description — หลังแก้ seed ต้องรัน generator/drift check ของ
  license catalog ให้เขียว (`license-catalog.generated.ts`) · PO template ref `CARMEN-PO-FASTREPORT-v1.4`
  (`micro-report/db/seed/report-templates/Purchase_Order_Document.content.xml:200`) — ตรวจก่อนว่ามีโค้ดไหน
  match string นี้หรือไม่ ถ้าไม่มีเปลี่ยนเป็น `CARMEN-BLUE-PO-FASTREPORT-v1.4` ในไฟล์ seed ถ้ามีให้คงเดิม
- **mobile:** ข้อความ permission ใน `app.json` (infoPlist/android) มีผลเมื่อ build native ใหม่เท่านั้น ไม่ใช่ OTA
  PR นี้ merge อย่างเดียว ไม่ต้องออก store build แยก — ข้อความใหม่ไปกับ native build รอบถัดไป (mobile ยังไม่ live)
  ชื่อแอป `app.json` `name` เป็น "Carmen Blue" อยู่แล้ว *(ผมตัดสินใจเอง)*
- **test ที่ assert ข้อความเดิม** ต้องแก้ตาม (เช่น `micro-notification/src/email/email.service.spec.ts:267,269`,
  `config-email.discard.test.tsx:23`) — เป็นการแก้เทสต์เดิมให้ตรง ไม่ใช่เขียนเทสต์ใหม่
- **CSP:** ถ้าแตะ inline script ใน `index.html` ของ frontend ต้องอัปเดต sha256 (การเปลี่ยน `<title>` ไม่กระทบ)

## ขั้นตอนที่ user ทำเอง (ไม่อยู่ในโค้ด)

**Keycloak realm — ทำใน admin console ทีละ environment (dev / UAT / prod):**
- Realm settings → General → **Display name**: "Carmen ERP" → "Carmen Blue"
- **HTML Display name**: `<h1>Carmen ERP</h1><p>Hospitality Management System</p>` → `<h1>Carmen Blue</h1><p>Hospitality Management System</p>`
- Realm settings → Email → **From display name** และ **Reply to display name**: "Carmen ERP" → "Carmen Blue"
- (ถ้าต้องการ) คำอธิบาย role/client ที่ขึ้นต้น "Carmen ERP …" — เห็นเฉพาะ admin
- ไม่แตะชื่อ flow "Carmen - Google ID token" (micro-keycloak อ้างชื่อนี้ตรง ๆ)

## งานที่แยกไปทำทีหลัง

1. **โลโก้** (ต้องมี designer): `carmen-inventory-frontend-react/components/icons/carmen-branding-{light,dark}.svg`
   (PNG ฝังใน SVG), `carmen-platform/public/logo_{light,dark}.svg` (outline "CARMEN"), `report-render`
   `CarmenLogoBase64`, favicon gateway (`httpdocs/favicon.svg.ts`) — ตัดสินใจว่าจะมี mark แยกของ Blue หรือไม่
2. **ถ่ายภาพหน้าจอใหม่** หลังโลโก้ขึ้นแอปแล้ว: usermanual ~226 ภาพ (`capture/` ถ่ายอัตโนมัติ), carmen-wiki ~311 ภาพ
3. **ข้อมูลใน DB** (user เลือกไม่ migrate): `subject_prefix "[Carmen]"` ที่ BU บันทึกไว้, `from_name` ผู้ส่ง,
   `tb_license_feature` `ai.mcp`, PO template ใน `tb_report_template`

## ปล่อยให้ผู้ลงมือตัดสินใจ

- ชื่อสมมติแทนโรงแรม/บริษัทตัวอย่าง (ขอแค่ไม่มีคำว่า Carmen และสม่ำเสมอภายในรีโป)
- ถ้อยคำในประโยคที่ต้องเรียบเรียงใหม่หลังใส่ชื่อ (เช่น "Carmen Inventory itself" → "Carmen Blue itself")
- แบ่ง PR: หนึ่ง PR ต่อรีโป, branch `feature/carmen-blue-rename`, commit ภาษาไทย, PR ภาษาอังกฤษ
- ลำดับรีโปภายในกลุ่มเดียวกัน (ขอแค่ทำตาม §จุดที่ต้องทำตามลำดับ)

## วิธีตรวจว่าเสร็จ

- ต่อรีโป: `rg -P '\b(Carmen|CARMEN|คาร์เมน)\b(?!( |-|_)?(Blue|BLUE|บลู))'` (ไม่รวม node_modules/dist/.git/lockfile/
  changelog/docs/superpowers) แล้วทุกบรรทัดที่เหลือต้องเข้าข่ายข้อยกเว้น: Carmen 4 / Carmen GL / ชื่อจดทะเบียน /
  identifier / ประวัติ — ไม่มี "Carmen" เปล่าที่หมายถึงผลิตภัณฑ์ใหม่
- `rg 'Carmen Blue Blue|Carmen Blue 4|Carmen Blue GL'` ต้องว่าง
- typecheck + lint ของทุกรีโปที่เป็นโค้ด, เทสต์เดิมผ่าน, regenerate OpenAPI แล้ว diff สะอาด, `docs:i18n-check` ผ่าน
- ตรวจด้วยตา: หน้า login/footer ของ frontend และ platform, หน้า `/developers/api`, Swagger ของ gateway,
  อีเมลทดสอบจากหน้า config email, PDF รายงาน, คู่มือ build ผ่าน (`vitepress build`)
