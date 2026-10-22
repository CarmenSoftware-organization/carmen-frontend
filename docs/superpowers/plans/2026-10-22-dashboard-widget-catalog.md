# Dashboard widget catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `bun run docs:widgets` สร้าง `docs/dashboard-widgets.md` จาก dataset catalog + dashboard templates บน dev พร้อมชื่อไทยจาก `messages/th.json`

**Architecture:** สคริปต์ Bun ตัวเดียว `scripts/gen-widget-docs.ts`: โหลด config → login → ยิง 3 GET (catalog, templates system, templates bu_default) → render markdown ด้วยฟังก์ชันบริสุทธิ์ → เขียนไฟล์ก็ต่อเมื่อทุกอย่างสำเร็จ

**Tech Stack:** Bun, TypeScript, `fetch`, import `availableRenders` จาก `components/dashboard-widget/render-support.ts`

**Spec:** `docs/superpowers/specs/2026-10-22-dashboard-widget-catalog-design.md`

## Global Constraints

- email/password จาก env `WIDGET_DOC_EMAIL` / `WIDGET_DOC_PASSWORD` เท่านั้น — ไม่มี default, ไม่พิมพ์ token/password ลง stdout หรือไฟล์
- config เริ่มต้น `public/config.prod.json` (`--env <name>` เลือก `public/config.<name>.json`) — หัวไฟล์แสดง `BACKEND_URL` ไม่แสดง `X_APP_ID`
- อ่านอย่างเดียว: GET เท่านั้น (นอกจาก POST login)
- พังที่ไหน / catalog ว่าง → `process.exit(1)` ไม่แตะไฟล์ปลายทาง
- deterministic: เรียงตาม id / module order แล้ว order_index; เวลาสร้าง (ISO UTC `Z`) อยู่บรรทัดเดียว
- ห้าม import จาก `routes/`
- ไม่เขียนเทสต์ (CLAUDE.md ของ user) — gate คือ typecheck + lint + รันจริง

## Review Focus

- `title_i18n` เป็น null / title เป็น null → ใช้ title_i18n.th ?? title_i18n.en ?? title ?? ชื่อ dataset
- template อ้าง dataset_id ที่ไม่มีใน catalog → แสดงแถวพร้อมป้าย ⚠️ ไม่ crash
- ข้อความ `|` หรือขึ้นบรรทัดใหม่ใน description/label → escape ก่อนลงตาราง markdown
- response ห่อ envelope ต่างกัน (`data.items` vs `data` เป็น array) → normalize ด้วยฟังก์ชันเดียว แล้ว error ถ้าไม่ใช่ array
- module ของ template ที่ไม่อยู่ใน 7 ตัวที่รู้จัก → ต่อท้ายตามชื่อ

---

### Task 1: สคริปต์ตัวสร้าง

**Files:**
- Create: `scripts/gen-widget-docs.ts`
- Modify: `package.json` (เพิ่ม `"docs:widgets": "bun scripts/gen-widget-docs.ts"`)
- Modify: `types/dashboard-widget.ts` (comment ของ `SystemWidgetConfigItem` — system widget เป็นแถว template ใน DB ของ platform ที่ gateway cache 60 วิ ไม่ใช่ hardcode)

**Interfaces:**
- Produces: `CatalogItem { id, name, description?, shape, category, unit?, params: Param[], supported_renders: string[] }`, `Template { kind, module: string|null, dataset_id, widget_type, title, title_i18n, order_index, params?, display?, allow_business_unit?, deny_business_unit?, is_active? }`
- `renderDoc(input: { backendUrl: string; generatedAt: string; catalog: CatalogItem[]; system: Template[]; buDefault: Template[]; thNames: Record<string,string> }): string`

- [ ] **Step 1:** โหลด config + env, `login()` ด้วย `POST {BACKEND_URL}/api/auth/login` body `{email,password}` header `Content-Type` + `x-app-id` อ่าน `data.access_token`
- [ ] **Step 2:** `getJson(path)` ใส่ Bearer + x-app-id; `asItems(json)` รับ `data.items` หรือ `data` ที่เป็น array; ยิง `/api-system/dashboard-templates/datasets`, `?kind=system`, `?kind=bu_default`
- [ ] **Step 3:** `thNames` = flatten `messages/th.json` → `dashboard.datasets` เป็น map `dataset_id → string`
- [ ] **Step 4:** `renderDoc` ตามโครงใน spec (หัวไฟล์ · สารบัญ · ส่วน 1 จัดกลุ่มตาม prefix ก่อนจุดแรก · ส่วน 2 system ตาม `MODULE_ORDER` + bu_default · ส่วน 3 ภาคผนวก RENDERERS/shape data/display keys) — "FE วาดได้" = `availableRenders(shape, supported_renders)`; ป้าย `⚠️ วาดไม่ได้ใน FE`, `⚠️ ไม่มีชื่อไทย`, `⚠️ ไม่มี dataset นี้ใน catalog`, `⚠️ FE วาด <type> กับ shape นี้ไม่ได้`
- [ ] **Step 5:** `bun run typecheck` และ `bunx eslint scripts/gen-widget-docs.ts` ผ่าน
- [ ] **Step 6:** commit

### Task 2: สร้างเอกสารชุดแรก

- [ ] **Step 1:** `WIDGET_DOC_EMAIL=… WIDGET_DOC_PASSWORD=… bun run docs:widgets` → ได้ `docs/dashboard-widgets.md`; ถ้า 403 ที่ `api-system/*` ให้หยุดแล้วรายงาน
- [ ] **Step 2:** อ่านไฟล์ที่ได้: จำนวน dataset ตรงกับ `count`, ชื่อไทยขึ้น, ไม่มี token/password ในไฟล์ (`grep -i "bearer\|password"`)
- [ ] **Step 3:** รันซ้ำ → `git diff` ต่างแค่บรรทัดเวลา
- [ ] **Step 4:** commit
