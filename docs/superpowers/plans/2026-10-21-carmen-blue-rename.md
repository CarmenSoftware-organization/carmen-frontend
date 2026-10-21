# Carmen → Carmen Blue Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยนชื่อผลิตภัณฑ์ใหม่ในทุกข้อความที่คนนอกเห็นจาก "Carmen" เป็น "Carmen Blue" ใน 13 รีโป โดยไม่แตะ identifier หรือชื่อของผลิตภัณฑ์เดิม

**Architecture:** แก้เฉพาะข้อความ (copy) — ไม่มี API contract/โครงสร้างเปลี่ยน หนึ่ง branch `feature/carmen-blue-rename` + หนึ่ง PR ต่อรีโป ไฟล์ generate (OpenAPI/swag/license catalog) สร้างใหม่ด้วยเครื่องมือของรีโป ไม่แก้มือ

**Tech Stack:** NestJS + Bun/turbo (backend-v2), Go + swag (micro-report, micro-data), Vite/React + next-intl-style JSON (frontend), React/Vite (platform), Expo (mobile), VitePress (usermanual), Markdown (wiki/accounting-*), Bruno

**Spec:** `docs/superpowers/specs/2026-10-21-carmen-blue-rename-design.md` (ผู้ลงมือต้องอ่านทั้งไฟล์ — ตารางชื่อ, anti-goals และข้อควรระวังอยู่ที่นั่น)

## Global Constraints

- ตารางชื่อ: product "Carmen"/"คาร์เมน"/"Carmen Inventory"/"Carmen Accounting"/"Carmen ERP"/"Carmen Cloud ERP" (บริบทใหม่) → **Carmen Blue** · "Carmen Platform" → **Carmen Blue Platform** · "Carmen Software" ทั่วไป → **CarmenSoftware**
- ตัวสะกด: **CARMEN BLUE** สำหรับ wordmark/footer/หัวกระดาษ/ข้อความกฎหมาย · **Carmen Blue** ในประโยคและ title · ห้าม "CarmenBlue" · ในข้อความไทยใช้ "Carmen Blue" อักษรโรมัน
- **คงเดิมเสมอ:** "Carmen 4", "Carmen GL", "Interface Carmen GL", "Import from Carmen GL", "Carmen Cloud" ที่หมายถึงตัวเก่า, ชื่อนิติบุคคลจดทะเบียน (`LEGAL_ENTITY.company`, "คาร์เมน ซอฟต์แวร์ บจก.", "Carmen Software Co., Ltd."), "Carmen blue" (b เล็ก = สีแบรนด์)
- **ไม่แตะ:** identifier, env var, ชื่อ package/repo/service/DB/schema, URL/โดเมน/อีเมล, log/OTel attribute, ชื่อ Keycloak flow, ข้อมูล seed ที่เป็นรหัส (`CARMEN`, `CARMEN-AVG`, `lastname: 'CARMEN'`)
- **ไม่แก้ประวัติ:** `CHANGELOG.md`, `changelog.json`, `docs/superpowers/**`, `.planning/**`
- ชื่อโรงแรม/บริษัทสมมติที่มีคำว่า Carmen → ชื่อกลาง ๆ ที่ไม่มี Carmen ใช้ชุดเดียวกันทั้งรีโป (แนะนำ: "Riverside Hotel", "Riverside Hotels Group", "Riverside Hotels (Thailand) Co., Ltd.", "Riverside Grand Hotel", "Riverside Bangkok", "Riverside Cluster")
- ค่าตั้งต้น email subject prefix `"[Carmen]"` → `"[Carmen Blue]"` · ไม่เขียน migration/UPDATE ใด ๆ
- **Workspace:** ทุกรีโปทำใน worktree ใหม่จาก `origin/main` (`git -C <repo> fetch origin && git -C <repo> worktree add ../<repo>-cbr -b feature/carmen-blue-rename origin/main`) — ยกเว้น `carmen-inventory-frontend-react` ที่ใช้ branch `feature/carmen-blue-rename` ที่มีอยู่แล้ว (มี commit spec + plan) ห้าม stash/reset/checkout ใน checkout หลักของรีโปอื่น
- **ไม่เขียนเทสต์ใหม่** (ความต้องการของ user) — แต่เทสต์เดิมที่ assert ข้อความเก่าต้องแก้ให้ตรง และ suite เดิมต้องผ่าน
- Commit message ภาษาไทย รูปแบบ conventional (`fix(branding): …` หรือ `docs(branding): …`) · PR ภาษาอังกฤษ · ห้าม squash-merge (changelog generator)
- **Sweep มาตรฐาน** (ใช้ในทุก task, รันจาก root ของ worktree):

```bash
# S1 — สิ่งที่เหลือ ต้องเป็นข้อยกเว้นทั้งหมด (Carmen 4 / GL / legal entity / identifier / ประวัติ)
rg -n -P '\b(Carmen|CARMEN|คาร์เมน)\b(?!( |-|_)?(Blue|BLUE|บลู))' \
  -g '!node_modules' -g '!dist' -g '!.git' -g '!*.lock' -g '!bun.lock*' -g '!package-lock.json' \
  -g '!graft/**' -g '!CHANGELOG.md' -g '!changelog.json' -g '!docs/superpowers/**' -g '!.planning/**' .
# S2 — ต้องว่าง
rg -n 'Carmen Blue Blue|CARMEN BLUE BLUE|Carmen Blue (4|GL)\b|CarmenBlue|Carmen Blue Software|Carmen Blue Platform Platform' -g '!node_modules' -g '!dist' .
```

## Review Focus

1. **ชื่อของตัวเก่าโดนเปลี่ยน** ("Carmen 4", "Carmen GL", "Interface Carmen GL" ใน UI/คู่มือ/OpenAPI ~114 จุด) — ผู้ใช้จะเห็นของเก่าถูกเรียกว่า Carmen Blue → S2 ต้องว่าง และ `rg -c 'Carmen 4|Carmen GL'` ต้องเท่ากันก่อน/หลังในทุก task (จดตัวเลขก่อนเริ่ม)
2. **overlay ภาษาไทยของ Scalar หลุดจากต้นฉบับ** (`openapi.th.json` keyed ด้วยข้อความอังกฤษ) — หน้า `/developers/api` ภาษาไทยจะกลับเป็นอังกฤษเงียบ ๆ → Task 8 รัน `bun run docs:i18n-check`
3. **คู่มือ quote ข้อความ UI ที่ไม่มีแล้ว** — ผู้ใช้หาข้อความตามคู่มือไม่เจอ → Task 12 grep ทุกประโยคใน `"…"` ที่มีคำว่า Carmen Blue Platform เทียบกับ `carmen-platform/src/i18n/en.ts`
4. **identifier ถูกแก้จน build พัง** (`CarmenLogo`, `CARMEN_*`, key i18n `moreFromCarmen`) — คีย์ i18n ห้ามเปลี่ยนชื่อ แก้เฉพาะค่า → typecheck/lint ของทุก task ที่เป็นโค้ด
5. **ข้อความไทยที่มีคำว่า "คาร์เมน"/"Carmen" ปนในประโยคไทย** ถูกข้าม — S1 ครอบ `คาร์เมน` แล้ว ตรวจ th ทุกไฟล์แปลด้วยตาในแต่ละ task

---

### Task 1: backend-v2 — Swagger ของ gateway, คำอธิบาย endpoint, ข้อมูลตัวอย่าง

**Files (ใต้ `carmen-turborepo-backend-v2/apps/backend-gateway/src/`):**
- Modify: `main.ts:188-189,252,265` — title `'Carmen Blue API Gateway'`, description `'Carmen Blue API Gateway by CarmenSoftware'`, Scalar `name: 'Carmen Blue API Gateway'`
- Modify: `httpdocs/defaultroot.html.ts:16` (`<title>Carmen Blue API Gateway</title>`), `:233` (`<span>Carmen Blue</span> API Gateway`)
- Modify: `platform/platform-user/platform-user.controller.ts:89,347,568`, `platform/platform_clusters/platform_clusters.controller.ts:285`, `auth/auth.controller.ts:602` — "Carmen platform"/"Carmen ERP platform"/"แพลตฟอร์ม Carmen" → "Carmen Blue"/"Carmen Blue Platform" ตามความหมาย
- Modify: `config/config_app-config/config_app-config.controller.ts:173,194` — `subject_prefix: '[Carmen Blue]'`
- Modify: ชื่อโรงแรมสมมติ/ตัวอย่างทุกจุดที่ระบุใน spec §E (business-units/clusters/user/applications/subscriptions/licenses/email-settings swagger + `common/dto/business-unit/business-unit.dto.ts`, `common/dto/cluster/cluster.dto.ts`) — 'Carmen mobile client' → 'Carmen Blue mobile client', 'Carmen Platform' from_name → 'Carmen Blue Platform', 'Carmen (Average Cost)' → 'Riverside (Average Cost)'
- Modify: `mcp/tools/get-backend-status.tool.ts:22` — "Carmen backend services" → "Carmen Blue backend services"

- [ ] **Step 1:** สร้าง worktree ตาม Global Constraints แล้วจดตัวเลข `rg -c 'Carmen 4|Carmen GL' apps packages | awk -F: '{s+=$2} END{print s}'`
- [ ] **Step 2:** แก้ไฟล์ข้างบน + ค้นข้อความ error ที่ตอบลูกค้า: `rg -n -P "(throw new|message:).*\bCarmen\b(?! Blue)" apps/*/src` แก้ที่เจอ
- [ ] **Step 3:** `bun run swagger:verify` ผ่าน · `cd apps/backend-gateway && bunx tsc --noEmit` ผ่าน · `bun run lint:changed` ผ่าน
- [ ] **Step 4:** jest ของ gateway เฉพาะ spec ที่ไฟล์แก้แตะ (`cd apps/backend-gateway && bunx jest <paths>`) ผ่าน — ถ้ามี spec assert ชื่อเดิมให้แก้ค่าที่คาด
- [ ] **Step 5:** S1 (ใต้ `apps/backend-gateway/src`) เหลือแค่ข้อยกเว้น · S2 ว่าง · ตัวเลข Step 1 ไม่เปลี่ยน
- [ ] **Step 6:** commit `fix(branding): เปลี่ยนชื่อผลิตภัณฑ์ใน Swagger และตัวอย่างของ gateway เป็น Carmen Blue`

### Task 2: backend-v2 — External API docs + regenerate OpenAPI

**Files:**
- Modify: `apps/backend-gateway/src/external-api/external-api.swagger.ts:25,32,34,43,53,72,134,196` — `.setTitle('Carmen Blue External API')`, `customSiteTitle: 'Carmen Blue External API'`, "<your Carmen Blue API host>" (ชื่อตัวแปร shell `CARMEN_API` คงเดิม)
- Modify: `external-api/ap-invoice/ap-invoice.controller.ts:81`, `external-api/gl-journal/gl-journal.controller.ts:75`, `external-api/gl-journal/swagger/examples.ts:59` — "in Carmen" → "in Carmen Blue" (บรรทัด "Carmen 4" ข้างเคียงคงเดิม)
- Regenerate: `docs/external-api/openapi.json`
- Modify: `docs/external-api/accounting-export.md:89`

**Interfaces:**
- Produces: `docs/external-api/openapi.json` ที่ Task 8 copy ไป frontend

- [ ] **Step 1:** แก้ไฟล์ source
- [ ] **Step 2:** `bun run swagger:export-external` แล้ว `git diff --stat docs/external-api/openapi.json` + `git diff docs/external-api/openapi.json | rg '^[-+]' | rg -v Carmen` — ถ้ามีบรรทัดเปลี่ยนที่ไม่เกี่ยวกับชื่อ **หยุดและรายงาน** (spec: ไม่รวม drift)
- [ ] **Step 3:** `rg -c 'Carmen 4' docs/external-api/openapi.json` ต้องเป็น 38 เท่าเดิม · S2 ว่าง
- [ ] **Step 4:** typecheck gateway ผ่าน
- [ ] **Step 5:** commit `fix(branding): เปลี่ยนชื่อใน External API docs เป็น Carmen Blue และ regenerate openapi.json`

### Task 3: backend-v2 — อีเมล, Excel creator, seed license

**Files:**
- Modify: `apps/micro-business/src/authen/auth/auth.service.ts:3429,3441,3487,3498,3517,3522,3525` — "your Carmen Blue account", subject `'You already have a Carmen Blue account'`
- Modify: `apps/micro-business/src/app-config/app-config.service.ts:945,946,1028,1029` — "test email from Carmen Blue"
- Modify: `workbook.creator = 'Carmen Blue'` ที่ `procurement/purchase-request/purchase-request.service.ts:2491`, `procurement/purchase-order/purchase-order.service.ts:4813`, `inventory/good-received-note/good-received-note.service.ts:2618` (ใต้ `apps/micro-business/src/`)
- Modify: `packages/prisma-shared-schema-platform/prisma/permission.route-map.ts:486` + `seed.license-feature.data.ts:128` — "Access to Carmen Blue data through MCP tools (AI assistants)"
- Regenerate: license catalog

- [ ] **Step 1:** แก้ไฟล์
- [ ] **Step 2:** `bun run generate:license-catalog` แล้ว `bun run audit:license-catalog` ผ่าน (diff ของ generated ต้องเป็นแค่ข้อความ ai.mcp)
- [ ] **Step 3:** `bun run audit:fe-license-fixture` — ถ้าแดงเพราะ fixture ของ FE มีข้อความเดิม จดไว้ให้ Task 7 แก้ใน FE
- [ ] **Step 4:** typecheck micro-business + jest ของ spec ที่ assert ข้อความอีเมล/creator (`rg -l "Carmen account|test email from Carmen|Carmen System" apps/micro-business/src --glob '*.spec.ts'`) แก้ค่าที่คาดแล้วผ่าน
- [ ] **Step 5:** S1 ทั้งรีโปเหลือแค่ข้อยกเว้น (ไฟล์ .md ภายในตาม spec "ไม่ใช่เป้าหมาย" ให้ดู README/CLAUDE.md ระดับบนสุด: ถ้าเรียกผลิตภัณฑ์ว่า "Carmen" ให้แก้) · S2 ว่าง
- [ ] **Step 6:** commit `fix(branding): เปลี่ยนชื่อในอีเมล ไฟล์ Excel และคำอธิบาย license เป็น Carmen Blue` แล้วเปิด PR (Tasks 1–3 เป็น PR เดียว)

### Task 4: micro-notification

**Files:**
- Modify: `src/email/email.service.ts:404` (`Carmen Blue — Automated Report Notification`), `:432` (`Carmen Blue — Notification`)
- Modify: `src/app-config/app-config.service.ts:294,295`, `src/platform-email/platform-email.service.ts:145,147,149` (`'Carmen Blue Platform email test'`, "Carmen Blue Platform email settings page")
- Modify: `src/v1/v1.controller.ts:183` — `title: 'Carmen Blue Notification API'`
- Test (แก้ค่าที่คาด): `src/email/email.service.spec.ts:267,269`

- [ ] **Step 1:** worktree + แก้ไฟล์
- [ ] **Step 2:** `bunx tsc --noEmit` + `bun run lint` + `bun run test` ผ่าน
- [ ] **Step 3:** S1/S2
- [ ] **Step 4:** commit `fix(branding): เปลี่ยนชื่อในอีเมลและ OpenAPI ของ notification เป็น Carmen Blue` + PR

### Task 5: micro-report + micro-data

**Files:**
- micro-report: `service/generator/pdf_generator.go:214`, `service/generator/templates/common/layout.html:194` → `Carmen Blue - Report generated automatically` · `cmd/server/main.go:30` `@description Carmen Blue report-generation service — …` · regenerate `docs/swagger/*`
- micro-report: `db/seed/report-templates/Purchase_Order_Document.content.xml:200` — เฉพาะเมื่อ `rg -n 'CARMEN-PO-FASTREPORT' --hidden -g '!.git' . ../carmen-turborepo-backend-v2 ../report-render` เจอแค่ไฟล์ seed นี้: เปลี่ยนเป็น `CARMEN-BLUE-PO-FASTREPORT-v1.4` ไม่งั้นคงเดิมและรายงาน
- micro-data: `cmd/server/main.go:28` `@contact.name CarmenSoftware` · regenerate `api/openapi.*`

- [ ] **Step 1:** worktree ทั้งสองรีโป + แก้ไฟล์
- [ ] **Step 2:** micro-report `make swagger` · micro-data `make swagger` แล้ว `make swagger-check` — diff generate ต้องเป็นแค่ข้อความที่แก้
- [ ] **Step 3:** `go build ./... && go vet ./... && go test ./...` ในแต่ละรีโปผ่าน
- [ ] **Step 4:** S1/S2 แต่ละรีโป
- [ ] **Step 5:** commit แยกรีโป `fix(branding): …` + PR แต่ละรีโป

### Task 6: carmen-turborepo-backend-bruno

**Files:**
- Modify: `.bru` 4 ไฟล์ที่ copy คำอธิบายจาก Swagger (spec §bruno) — ให้ตรงกับข้อความใหม่ของ Task 1 ทุกตัวอักษร
- Modify: body ตัวอย่างโรงแรมสมมติ (`user-business-units/*`, `platform/business-unit/*`, `platform/clusters/*`, `user-management/user/POST-set-default-business-unit.bru:40`) — ใช้ชุดชื่อเดียวกับ Task 1
- Modify: `README.md:81` "Internal — CarmenSoftware."

- [ ] **Step 1:** worktree + แก้ (ถ้ารีโปมี script sync จาก Swagger ให้ใช้ script หลัง Task 1 merge แทนแก้มือ — ตรวจ `package.json`)
- [ ] **Step 2:** S1/S2 · `rg -c 'Carmen GL'` เท่าเดิม
- [ ] **Step 3:** commit + PR

### Task 7: frontend — UI copy

**Files (ใต้ `carmen-inventory-frontend-react/`):**
- Modify: `messages/en.json` + `messages/th.json` บรรทัด 808, 1879, 1929, 1934, 1997, 2004, 2017, 2542, 2626, 2646, 2653, 2722, 5355, 5400, 5429, 5435, 5603, 6302 — แก้ **ค่า** เท่านั้น ห้ามเปลี่ยนชื่อคีย์ (`moreFromCarmen` คงชื่อ ค่าเป็น "More from Carmen Blue") · 6302 → "Carmen Blue API reference"
- Modify: `alt="Carmen Blue"` ที่ `components/auth/auth-split-shell.tsx:157,162`, `components/sidebar/app-sidebar.tsx:25,30`, `routes/legal/legal-page.tsx:91,96`, `routes/developers/api/api-docs.route.tsx:65,70`
- Modify: `components/icons/carmen-logo.tsx:13` default `title = "Carmen Blue"`, `:20` lockup text `CARMEN BLUE`
- Modify: `routes/system-admin/config-email/config-email-component.tsx:50,275` → `"[Carmen Blue]"` · Test (แก้ค่าที่คาด): `config-email.discard.test.tsx:23`
- Modify: `lib/email-template.ts:38,46` — `bu_name: "Riverside Hotel Bangkok"`
- Modify (ถ้า Task 3 Step 3 แดง): fixture license ของ FE ให้ตรงข้อความ ai.mcp ใหม่

- [ ] **Step 1:** checkout `feature/carmen-blue-rename` (มีอยู่แล้ว) + แก้ไฟล์
- [ ] **Step 2:** `bun run typecheck` + `bunx eslint <files>` + `bun test:run` ผ่าน (รวม `type-ladder`, `status-ink-contrast`, `security-headers`)
- [ ] **Step 3:** S1 เฉพาะ `messages components routes lib` เหลือแค่ข้อยกเว้น · S2 ว่าง · เทียบ en/th: `rg -c 'Carmen Blue' messages/en.json messages/th.json` ห่างกันไม่เกินจำนวนเดิม (th.json มีเพิ่ม 1 ที่ 1719 อยู่แล้ว)
- [ ] **Step 4:** commit `fix(branding): เปลี่ยนชื่อผลิตภัณฑ์บนหน้าจอเป็น Carmen Blue`

### Task 8: frontend — Scalar/OpenAPI

**Files:**
- Replace: `lib/external-api/openapi.json` ← copy จาก `carmen-turborepo-backend-v2/docs/external-api/openapi.json` (Task 2)
- Modify: `lib/external-api/openapi.th.json` บรรทัด 3, 4, 131, 132, 167, 168, 259, 260 — คีย์อังกฤษให้ตรงต้นฉบับใหม่, ค่าไทยใช้ "Carmen Blue"
- Modify: `lib/external-api/localized-spec.ts:22`, `routes/system-admin/interface/external-api-docs-section.tsx:48` — server `description: "Carmen Blue"`

**Interfaces:**
- Consumes: `openapi.json` ของ Task 2

- [ ] **Step 1:** ก่อน copy: `diff <(jq -S . lib/external-api/openapi.json) <(git -C <backend-worktree> show origin/main:docs/external-api/openapi.json | jq -S .)` ต้องว่าง (สำเนาเดิมตรงต้นทาง) — ถ้าไม่ว่าง **หยุดและรายงาน**
- [ ] **Step 2:** copy + แก้ overlay + 2 ไฟล์ ts
- [ ] **Step 3:** `bun run docs:i18n-check` ผ่าน · typecheck ผ่าน · `rg -c 'Carmen 4' lib/external-api/openapi.json` = 38, `openapi.th.json` = 76
- [ ] **Step 4:** ตรวจด้วยตา `bun dev` → `/developers/api` ทั้ง EN/TH หัวเรื่องเป็น "Carmen Blue External API"
- [ ] **Step 5:** commit `fix(branding): sync External API docs ชื่อ Carmen Blue เข้าหน้า /developers/api`

### Task 9: frontend — เอกสาร

**Files:**
- Modify: `docs/investor/carmen-technology-overview.md:1,12,94,118`, `.th.md:1,12,93,117`, `docs/investor/deck/carmen-tech-deck.template.html:2,523,551,745`, `carmen-tech-deck.th.template.html:2,511,540,731` (`<h1>` wordmark → `CARMEN BLUE`)
- Modify: `docs/email-profile-microsoft-oauth2.md:23,37,55,63`
- Modify (living docs): `CONTEXT.md`, `docs/accounting/README.md`, `docs/DESIGN.md` (ข้อความที่เรียกผลิตภัณฑ์ — `name: Carmen-inventory-ERP` ใน frontmatter เป็น identifier คงเดิม), `docs/architecture.md:14`, `.agents/skills/carmen-ui-consistency/SKILL.md` (เฉพาะข้อความ)
- คงเดิม: `docs/business-context/carmen-brand-coding-reference.md` (อ้างแบรนด์บริษัท/ของเดิม), `docs/ui/modals/CB-MODAL-002-import-carmen-gl.md`

- [ ] **Step 1:** แก้ไฟล์
- [ ] **Step 2:** S1 ทั้งรีโปเหลือแค่ข้อยกเว้น · S2 ว่าง
- [ ] **Step 3:** commit `docs(branding): เปลี่ยนชื่อผลิตภัณฑ์ในเอกสารเป็น Carmen Blue` แล้ว push + เปิด PR (Tasks 7–9 เป็น PR เดียว, base `main`)

### Task 10: carmen-platform

**Files:**
- Modify: `index.html:7` (`content="Carmen Blue Platform - Management System"`), `:12` (`<title>Carmen Blue Platform</title>`)
- Modify: `src/components/Sidebar.tsx:56` `PRODUCT_BRAND = { name: 'Carmen Blue Platform', code: 'C' }` (ตรวจแล้ว: `isProductBrand()` เทียบกับ constant ตัวเดียวกันเท่านั้น — ผู้ใช้คือ `Layout.tsx`, `ClusterAdminLayout.tsx` ปลอดภัย)
- Modify: `src/pages/Login.tsx:201` wordmark `CARMEN BLUE`, `:243` "Carmen Blue Platform"
- Modify: `src/i18n/en.ts` 1017, 1024, 2404, 3844, 3857, 3891, 3893, 5030, 5047 และคู่ใน `th.ts` 784, 790, 1802, 2704, 2717, 2746, 2748, 3975, 3992 — 5047: "No Carmen Blue Platform account exists for this Google email…" · 5030: "Access the Carmen Blue operations console."
- Modify: `en.ts:1041`/`th.ts:807` `designBy` คงเดิม (เป็น handle `@carmensoftware`)
- Modify: `src/components/ProductLogo.tsx:38` `alt="Carmen Blue"`, `src/pages/platformConfig/NotificationEmailConfigCard.tsx:241` `placeholder="[Carmen Blue]"`
- Modify: `README.md:1` "# Carmen Blue Platform", `:70` "© CarmenSoftware", `OVERVIEW.md`, `SITEMAP.md`, `docs/ui/*` (ข้อความชื่อผลิตภัณฑ์)
- คงเดิม: `infra/gcp/wif.tf` (GCP display name ภายใน), `scripts/lib/preconfig-mock/*`, test fixtures

**Interfaces:**
- Produces: ข้อความ UI ใหม่ที่ Task 12 ต้อง quote ให้ตรง — โดยเฉพาะ en.ts 5047, 5030, label ใน platform-config

- [ ] **Step 1:** worktree + แก้ไฟล์
- [ ] **Step 2:** `bun run typecheck` + `bun run lint` + `bun run test` ผ่าน (แก้ค่าที่คาดในเทสต์ที่ assert "Carmen Platform" ถ้ามี: `rg -l "Carmen Platform" src --glob '*.test.*'`)
- [ ] **Step 3:** S1/S2 · ตรวจด้วยตา `bun run dev` หน้า login + sidebar
- [ ] **Step 4:** commit `fix(branding): เปลี่ยนชื่อคอนโซลเป็น Carmen Blue Platform` + PR

### Task 11: carmen-inventory-mobile

**Files:**
- Modify: `app.json:52,73` ("Allow Carmen Blue to …"), `:67` (escaped Thai "…แอป Carmen Blue")
- Modify: `src/i18n/translations.ts` th 15, 44, 215, 224, 225, 317, 321 · en 478, 505, 679, 689, 690, 783, 787
- Modify: `src/hooks/use-auth.tsx:447` `'ปลดล็อก Carmen Blue'`
- Modify: `src/components/onboarding/tour.tsx:224` wordmark `CARMEN BLUE`, `:235,284,289,291,329` "Carmen Blue", `:187-189` ชื่อโรงแรมสมมติ → ชื่อกลาง ๆ (เช่น "The Riverside, Lisbon", "Riverside Porto", "Riverside Sintra")
- คงเดิม: comment อ้างไฟล์ design, `theme.ts:32` ("Carmen brand blue" = สี)

- [ ] **Step 1:** worktree + แก้
- [ ] **Step 2:** `bun run typecheck` + `bun run lint` + `bun run test` ผ่าน · `jq . app.json >/dev/null` ผ่าน
- [ ] **Step 3:** S1/S2
- [ ] **Step 4:** commit + PR (body ระบุ: permission text มีผลกับ native build รอบถัดไป, ไม่ต้องออก store build)

### Task 12: carmen-platform-support-usermanual

**Files:**
- Modify: `site/.vitepress/config.mts:29,38,68,69` — `'Carmen Blue Platform คู่มือการใช้งาน'`, `'Carmen Blue Platform User Manual'`
- Modify: `site/index.md:5`, `site/en/index.md:5`, และทุกหน้าใต้ `site/` + `site/en/` ที่เรียกผลิตภัณฑ์ (spec ~66 จุด: login, glossary, applications, tenant-migrations, usage-analytics …)
- Modify: ข้อความที่ quote UI ให้ตรง Task 10 ทุกตัวอักษร (`site/en/getting-started/login.md:50` และคู่ไทย, `site/en/screens/platform/platform-config.md:85`)
- Modify: `site/en/screens/platform/email-settings.md:59` ตัวอย่าง sender → `"Carmen Blue"`
- คงเดิม: "Interface Carmen GL" (`site/en/guides/manage-license.md:116`, `capture/guides/manage-license.capture.ts:125`), ภาพหน้าจอ

**Interfaces:**
- Consumes: ข้อความ UI ใหม่จาก Task 10

- [ ] **Step 1:** worktree + แก้
- [ ] **Step 2:** สำหรับทุกประโยคในเครื่องหมายคำพูดที่มีคำว่า "Carmen Blue": `rg -o '"[^"]*Carmen Blue[^"]*"' site | sort -u` แล้วยืนยันว่าแต่ละประโยคมีอยู่จริงใน `../carmen-platform-cbr/src/i18n/{en,th}.ts` (หรือเป็นตัวอย่างค่าที่ผู้ใช้กรอก)
- [ ] **Step 3:** `bun run check` + `bun run docs:build` ผ่าน
- [ ] **Step 4:** S1/S2 (ยกเว้น `capture/**` selector ของ legacy) · `rg -c 'Carmen GL'` เท่าเดิม
- [ ] **Step 5:** commit `docs(branding): เปลี่ยนชื่อในคู่มือเป็น Carmen Blue Platform` + PR (body: merge หลัง platform PR, ภาพหน้าจอรอ re-capture หลังโลโก้ใหม่)

### Task 13: carmen-wiki

**Files:**
- Modify: ไฟล์ `.md` ใต้ `en/` และ `th/` ที่เรียกผลิตภัณฑ์ใหม่ (~340 จุด) — ชื่อเล่ม "Carmen Inventory" → "Carmen Blue", "Carmen Platform" → "Carmen Blue Platform", `en/home.md` "Carmen Wiki" → "Carmen Blue Wiki"
- คงเดิม: "Carmen 4", "Carmen GL", "Import from Carmen GL", ค่า config/data ในโค้ดบล็อก (`"from_name": "Carmen Purchasing"` ใน `config-email.md:108` เป็นตัวอย่างข้อมูล → เปลี่ยนเป็น `"Carmen Blue Purchasing"`), ไฟล์ `.png`

- [ ] **Step 1:** worktree (checkout หลักมี `.png` ค้าง 239 ไฟล์ — ห้ามแตะ) + แก้ทีละโฟลเดอร์ (`inventory/` → `platform/` → หน้าแรก) อ่านบริบทก่อนแทนทุกจุด
- [ ] **Step 2:** S1/S2 · `rg -c 'Carmen 4|Carmen GL'` เท่าเดิม · ลิงก์ภายในยังไม่พัง (`rg -o '\]\(([^)]+\.md)' -r '$1'` ทุก path มีไฟล์จริง — ไม่ได้เปลี่ยนชื่อไฟล์จึงควรผ่าน)
- [ ] **Step 3:** commit `docs(branding): เปลี่ยนชื่อผลิตภัณฑ์ใน wiki เป็น Carmen Blue` + PR

### Task 14: carmen-accounting-concept + carmen-accounting-task

**Files:**
- concept: "Carmen Cloud ERP" ~19 จุด → "Carmen Blue" (`README.md:1` → "# Carmen Blue — Accounting System", `docs/PRD-*.md` หัวเรื่อง/บรรทัด Product), `docs/PRD-accounting-system-overview.md:91` "Shared with Carmen Blue platform", "Carmen Software" 1 จุด → CarmenSoftware · คงเดิม "Carmen 4 architecture" (`README.md:116`, `PRD-accounting-system-overview.md:491`)
- task: `README.md:1` "# Carmen Blue Accounting", `accounting-foundation.md:5,312`, `slides/accounting-backlog/index.tsx:345` eyebrow "Carmen Blue · โมดูล Accounting · Draft v0.1", `docs/backlog/accounting-backlog.yaml:504,724,750` "Carmen Blue backend", `tools/jira_backlog/__main__.py:1` (docstring เท่านั้น)

- [ ] **Step 1:** worktree ทั้งสองรีโป (task มีไฟล์ค้าง 4 ไฟล์ — ห้ามแตะ) + แก้
- [ ] **Step 2:** task: `yq . docs/backlog/accounting-backlog.yaml >/dev/null` (หรือ `python3 -c 'import yaml,sys;yaml.safe_load(open(sys.argv[1]))'`) ผ่าน · ถ้ามี typecheck ของ slides ให้รัน
- [ ] **Step 3:** S1/S2 แต่ละรีโป
- [ ] **Step 4:** commit + PR แต่ละรีโป

### Task 15: e2e ทั้งสองรีโป

**Files:**
- `carmen-platform-e2e/tests/auth/login.spec.ts:23` annotation → 'Assert "Carmen Blue Platform" heading is visible' + comment ที่ 28-30 ถ้าอ้างชื่อ
- `carmen-inventory-frontend-e2e`: คำอธิบาย/annotation ที่เรียกผลิตภัณฑ์ว่า "Carmen Inventory" (`tests/160-pl-template.spec.ts:674-805` annotation "Login เข้า Carmen Blue", `tests/wiki-screenshots/sitemap.ts:150,193` "Carmen Blue · Sitemap") + docs ที่ไม่ใช่ประวัติ
- คงเดิม: seed (`seeds/carmen.data.ts`, `"Admin CARMEN"`, `CARMEN-AVG`, อีเมล `carmensoftware.dev+…`), `tests/results/*.json`

- [ ] **Step 1:** worktree ทั้งสอง (frontend-e2e checkout หลักอยู่บน feature branch + ไฟล์ค้าง 44 — ห้ามแตะ)
- [ ] **Step 2:** `bunx tsc --noEmit` แต่ละรีโปผ่าน (ไม่ต้องรัน e2e — ไม่มี assertion เปลี่ยน)
- [ ] **Step 3:** commit + PR แต่ละรีโป

### Task 16: Sweep ปิดงาน + checklist ส่งมอบ

- [ ] **Step 1:** รัน S1 + S2 ในทุก worktree ของ Tasks 1–15 รวมผลเป็นตารางต่อรีโป: จำนวนบรรทัดที่เหลือ × เหตุผล (Carmen 4 / GL / legal / identifier / ประวัติ) — บรรทัดที่ไม่เข้าข้อยกเว้นต้องเป็น 0
- [ ] **Step 2:** รายการ PR ทั้งหมด + ลำดับ merge: backend-v2 (Tasks 1–3) → frontend (7–9) · platform (10) → usermanual (12) · ที่เหลือ merge เมื่อไหร่ก็ได้
- [ ] **Step 3:** ส่ง user: ขั้นตอน Keycloak realm (spec §ขั้นตอนที่ user ทำเอง) + งานที่แยกไปทำทีหลัง (spec §งานที่แยก) + จุดที่ตรวจด้วยตาแล้ว/ยังไม่ได้ตรวจ
