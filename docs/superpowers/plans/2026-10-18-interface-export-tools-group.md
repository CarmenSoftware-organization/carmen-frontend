# Interface "Export tools" group — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ย้าย brand External จากหมวด Accounting ไปหมวดใหม่ `export` ("Export tools") ทั้ง config key, license key, URL, i18n และข้อมูล

**Architecture:** BE เปลี่ยนชื่อ license feature + ให้ gateway/micro-business รู้จักหมวด `export` + migration สองชุด (platform: license, tenant: แถว config) · FE ย้าย entry ใน registry, เปลี่ยน namespace i18n, redirect URL เก่า

**Tech Stack:** NestJS + Prisma (backend-v2, jest) · Vite + React Router 7 + use-intl (FE, vitest)

**Spec:** `docs/superpowers/specs/2026-10-18-interface-export-tools-group-design.md` (FE repo)

## Global Constraints

- **ไม่เขียนเทสต์ใหม่** (กติกา user) — แต่ละ task: แก้โค้ด → typecheck → lint → เทสต์เดิมที่เกี่ยวต้องผ่าน (อัปเดตเทสต์เดิมที่อ้างโครงเก่าได้) → commit
- commit message ภาษาไทย, PR ภาษาอังกฤษ · branch `feature/interface-export-group` ในทั้งสองรีโป (FE มีแล้ว; BE แตกจาก `main` ล่าสุด — `git pull` ก่อน)
- BE ใช้ `jest` ห้าม `bun test`
- ชื่อที่ตายตัว: category key `export` · config key `interface_export_external` · license `interface.export.external` (parent `interface.export`, parent ของมันคือ `interface`) · URL `/system-admin/interface/export/external` · i18n `systemAdmin.interface.export.*` · ป้าย en "Export tools" / th "เครื่องมือส่งออก"
- ไฟล์ generated (`license-catalog.generated.ts`, `seed.license-feature.data.ts`, FE `constant/__fixtures__/license-catalog.ts`) ห้ามแก้มือ — regenerate ด้วยสคริปต์
- ไฟล์ i18n ห้ามมี `{}` หรือ `<คำ>` ในข้อความ (ICU พังทั้งหน้า)
- ห้ามแตะ `docs/superpowers/{specs,plans}/2026-10-17-*` (เอกสารประวัติ)

## Review Focus

1. **regex หลุด** — config key `interface_export_external` ที่ gateway ไม่จับ = ไม่ตรวจ license ระดับ brand เลยแบบเงียบ ๆ → Task 2 ตรวจด้วย `grep` ว่าทุก regex `(accounting|pos|pms)` มี `export` ครบ
2. **seed ก่อน migration** — ได้แถว license ใหม่ซ้อน ขณะกลุ่มยังชี้คีย์เก่า → Task 3 ใส่คำเตือนหัวไฟล์ migration + Task 3 verify รันกับ DB จริงตามลำดับ
3. **บรรพบุรุษไม่ครบ** — กลุ่มที่มี `interface.export.external` แต่ไม่มี `interface.export` = FE/BE ถือว่าไม่มีสิทธิ์ → Task 3 SQL ขั้น 3 + query ตรวจหลังรัน
4. **namespace i18n ค้าง** — ฟอร์ม External ยังเรียก `systemAdmin.interface.accounting.*` = ขึ้นชื่อคีย์ดิบ → Task 5 `grep` ต้องเป็น 0
5. **URL เก่า** (บุ๊กมาร์ก / ลิงก์ COA mapping) ต้องพาไปหน้าใหม่ ไม่ใช่ "ไม่พบ" → Task 5 ตรวจในเบราว์เซอร์

---

## รีโป BE: `/Users/samutpra/GitHub/carmensoftware-organize/carmen-turborepo-backend-v2`

### Task 1: เปลี่ยนชื่อ license feature

**Files:**
- Modify: `packages/prisma-shared-schema-platform/prisma/permission.route-map.ts` (~266, 274, 291, ~455–475 + comment "คีย์ `interface_*` ทั้งแปด" ~255)
- Modify: `apps/backend-gateway/src/license/external-interface-entitlement.ts:10` + comment บรรทัด 13–14
- Modify: comment ใน `apps/backend-gateway/src/config/config_bu-api-key/config_bu-api-key.controller.ts:55`, `config_bu-api-key.service.ts:109-110`
- Regenerate: `apps/backend-gateway/src/license/license-catalog.generated.ts`, `packages/prisma-shared-schema-platform/prisma/seed.license-feature.data.ts`

**Interfaces:**
- Produces: license key `interface.export.external`, `interface.export`; `EXTERNAL_INTERFACE_FEATURE = 'interface.export.external'`; `LICENSE_ROUTE_OVERRIDES['config:app-config/interface_export_external'] = 'interface'`

- [ ] **Step 1:** `git switch main && git pull && git switch -c feature/interface-export-group`
- [ ] **Step 2:** แก้ `permission.route-map.ts`
  - `LICENSE_ROUTE_OVERRIDES`: key `'config:app-config/interface_accounting_external'` → `'config:app-config/interface_export_external'` (ค่า `'interface'` เหมือนเดิม); `'config:bu-api-key'` → `'interface.export.external'`; comment เหนือบรรทัดนั้น "แบรนด์ Accounting → External" → "หมวด Export tools → External"
  - `PERMISSION_ONLY_ROUTE_RESOURCES` comment → `interface.export.external`
  - `LICENSE_ONLY_RESOURCES`: ลบ `['interface.accounting.external', …]`; เพิ่ม `['interface.export', 'Export tools (external systems pull data via API key)']` และ `['interface.export.external', 'External system data export via API key']` วางต่อจากบล็อก pms
- [ ] **Step 3:** `EXTERNAL_INTERFACE_FEATURE = 'interface.export.external'` + comment ทั้งสามไฟล์
- [ ] **Step 4:** `bun run generate:license-catalog` แล้ว `git diff --stat` — คาดว่า generated ทั้งสองไฟล์เปลี่ยน: แถว `interface.accounting.external` หาย, มี `interface.export` (parent `interface`) และ `interface.export.external` (parent `interface.export`); ถ้า sort_order ของแถวอื่นเลื่อนเป็นผลของ generator ยอมรับได้
- [ ] **Step 5:** `bun run audit:license-catalog` → ผ่าน; `grep -rn "interface\.accounting\.external" apps packages --include='*.ts' | grep -v node_modules | grep -v /dist/` → 0 บรรทัด
- [ ] **Step 6:** typecheck gateway (`cd apps/backend-gateway && bunx tsc --noEmit -p .`) + `bunx jest src/license src/config/config_bu-api-key` ใน gateway → ผ่าน (แก้ spec เดิมที่ hardcode คีย์เก่าได้)
- [ ] **Step 7:** commit `refactor(license): เปลี่ยน interface.accounting.external เป็น interface.export.external`

### Task 2: ให้ gateway + micro-business รู้จักหมวด `export`

**Files:**
- Modify: `apps/backend-gateway/src/config/config_app-config/config_app-config.service.ts:28` (+ comment บรรทัด 13)
- Modify: `apps/micro-business/src/app-config/app-config.service.ts` — `defaultFor` (~519), `validateValue` (~553–561), comment บรรทัด 21–22

**Interfaces:**
- Produces: `PUT/GET /app-config/interface_export_external` ตรวจ license `interface.export.external`, validate ด้วย `InterfaceAccountingSchema`, default `{ enabled: false }`

- [ ] **Step 1:** gateway `INTERFACE_CONFIG_KEY_RE = /^interface_(accounting|pos|pms|export)_(.+)$/`
- [ ] **Step 2:** micro-business `defaultFor`: regex → `/^interface_(accounting|pos|pms|export)(_.+)?$/`
- [ ] **Step 3:** micro-business `validateValue`: เพิ่มกิ่ง `/^interface_export(_.+)?$/` → `InterfaceAccountingSchema` (ใส่ comment หนึ่งบรรทัด: External ย้ายมาจาก accounting ใช้ schema เดิมเพื่อไม่ให้พฤติกรรมเปลี่ยน — หมวดนี้ยังไม่มี schema ของตัวเอง)
- [ ] **Step 4:** `grep -rnE "\(accounting\|pos\|pms\)" apps packages --include='*.ts' | grep -v node_modules | grep -v /dist/ | grep -v spec` → ทุกบรรทัดที่เหลือต้องมี `export` หรือเป็นเคสที่จงใจไม่รวม (เช่น `secretPathsFor` ที่จับ `pos|pms` — External ไม่มี secret ไม่ต้องเติม) จดเหตุผลใน commit body ถ้ามีเคสจงใจไม่รวม
- [ ] **Step 5:** typecheck ทั้งสอง app + `bunx jest src/config/config_app-config` (gateway) และ `bunx jest src/app-config` (micro-business) → ผ่าน
- [ ] **Step 6:** commit `feat(interface): gateway และ micro-business รองรับหมวด export`

### Task 3: migration (platform license + tenant config)

**Files:**
- Create: `packages/prisma-shared-schema-platform/prisma/migrations/20261018120000_move_external_interface_under_export/migration.sql`
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261018120000_rename_interface_external_config_key/migration.sql`

**Interfaces:**
- Consumes: คีย์จาก Task 1

- [ ] **Step 1: platform migration** — ลอกโครง `20261014230000_move_mcp_license_under_ai/migration.sql` ทั้งหัวคำเตือน (ต้องรันก่อน `db:seed.license-feature`) และ guard `NOT EXISTS` ทุกขั้น แทน `mcp`→`interface.accounting.external`, `ai.mcp`→`interface.export.external`, `ai`→`interface.export`:
  1. `tb_license_feature` rename key (คง id/state)
  2. `tb_license_feature_group_item` rename feature_key ต่อกลุ่ม
  3. INSERT `interface.export` ให้ทุกกลุ่มที่มี `interface.export.external` (ยังไม่มี)
  4. soft-delete `interface.accounting.external` ที่เหลือ
  5. **(ใหม่)** soft-delete `interface.accounting` ในกลุ่มที่ไม่เหลือแถว active `interface.accounting.%` แล้ว แต่ **เฉพาะกลุ่มที่ขั้น 2 เพิ่งย้าย External ออก** (เช่น เงื่อนไขกลุ่มมี `interface.export.external` active) — ห้ามแตะกลุ่มที่ตั้งใจถือ `interface.accounting` เปล่า ๆ ด้วยเหตุผลอื่น
  - comment rollback ท้ายไฟล์ย้อนครบ 5 ขั้น (ขั้น 5 ย้อน = คืน `interface.accounting` ให้กลุ่มที่มี `interface.accounting.external` หลัง rename กลับ) + บรรทัด "ใช้คู่กับ gateway + seed รุ่นก่อนเสมอ"
- [ ] **Step 2: tenant migration** — ตาราง `tb_application_config` มี unique `(key, deleted_at)`:
  ```sql
  UPDATE "tb_application_config" SET key = 'interface_export_external', updated_at = now()
  WHERE key = 'interface_accounting_external' AND deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM "tb_application_config" c2
                    WHERE c2.key = 'interface_export_external' AND c2.deleted_at IS NULL);
  ```
  (ตรวจชื่อคอลัมน์ `updated_at` ใน schema ก่อน) + comment rollback
- [ ] **Step 3: รันบน dev ตามลำดับ** (dev DB = shared — **backup ก่อน**: `pg_dump` ตาราง `tb_license_feature`, `tb_license_feature_group_item` ของ platform และ `tb_application_config` ของทุก tenant ลงไฟล์ใน scratchpad) — **ถามผู้ใช้ก่อนรันกับ DB จริง**; ลำดับ: platform `db:deploy` → `db:seed.license-feature` → tenant migrate ทุก BU (วิธีเดียวกับ migration tenant ครั้งก่อน ๆ) — ทำทันทีก่อน deploy BE ตามที่ spec ยอมรับช่วง 403 สั้น ๆ
- [ ] **Step 4: ตรวจ** query:
  - `SELECT key FROM tb_license_feature WHERE key LIKE 'interface.%' AND deleted_at IS NULL` → มี `interface.export`, `interface.export.external`; ไม่มี `interface.accounting.external`
  - ทุกกลุ่มที่มี `interface.export.external` มี `interface.export` และ `interface` (นับแล้วต้อง 0 กลุ่มที่ขาด)
  - ทุก tenant: ไม่มีแถว active `interface_accounting_external`
- [ ] **Step 5:** commit `feat(interface): migration ย้าย External ไปหมวด export (license + config key)`

### Task 4: เอกสาร API ที่ลูกค้าเห็น (BE)

**Files:**
- Modify: `docs/external-api/accounting-export.md` (~53, ~302), `apps/backend-gateway/src/external-api/external-api.swagger.ts`, `docs/external-api/openapi.json`

- [ ] **Step 1:** เปลี่ยนเส้นทางเมนู "Interface → Accounting → External → API Access" → "Interface → Export tools → External → API Access" และ `interface.accounting.external` → `interface.export.external` ทุกจุด; ถ้า `openapi.json` สร้างจาก swagger ด้วยสคริปต์ ให้ regenerate แทนแก้มือ
- [ ] **Step 2:** `grep -rn "Accounting → External\|interface\.accounting\.external" docs/external-api apps/backend-gateway/src/external-api` → 0
- [ ] **Step 3:** typecheck gateway → ผ่าน; commit `docs(external-api): อัปเดตเส้นทางเมนูและ license key เป็นหมวด Export tools`
- [ ] **Step 4:** push + เปิด PR (อังกฤษ) — body ระบุลำดับ deploy: platform migration → seed → tenant migration → BE → FE และ rollback ต้องเป็นคู่

---

## รีโป FE: `/Users/samutpra/GitHub/carmensoftware-organize/carmen-inventory-frontend-react` (branch มีแล้ว)

### Task 5: ย้าย External ไปหมวด export ฝั่ง FE

**Files:**
- Modify: `routes/system-admin/interface/interface-registry.ts`
- Modify: `routes/system-admin/interface/interface-detail.route.tsx`
- Modify: `routes/router.tsx` (~800–806)
- Modify: `routes/system-admin/interface/external-interface-form.tsx`, `external-gl-defaults-section.tsx`, `external-api-access-section.tsx`, `external-api-docs-section.tsx`, `external-api-docs.tsx`, `external-api-openapi.json`
- Modify: `routes/config/chart-of-account-mapping/coam-cells.tsx:65,114`
- Modify: `messages/en.json`, `messages/th.json`
- Modify: `routes/system-admin/interface/CLAUDE.md` + comment ที่อ้าง `interface_accounting_external`
- Regenerate: `constant/__fixtures__/license-catalog.ts`
- Update ถ้าแดง: `interface-registry.test.ts`, `interface-list.test.tsx`

**Interfaces:**
- Consumes: license key จาก Task 1 (ผ่าน fixture)
- Produces: route `/system-admin/interface/export/external`

- [ ] **Step 1: registry** — `InterfaceCategoryDef.form` เปลี่ยนเป็น optional (`readonly form?: …`); ถอด entry `external` ออกจาก accounting; เพิ่มหมวดท้ายสุด:
  `{ key: "export", icon: FileOutput, brands: [{ key: "external", configKey: "interface_export_external", form: lazy(() => import("./external-interface-form")), noConnection: true }] }` (ไม่มี `form` ระดับหมวด — comment: หมวดนี้ทุก brand ถือฟอร์มของตัวเอง) · อัปเดต comment เหนือ `INTERFACE_CATEGORIES` ให้บอกว่า category ใหม่ต้องเติม regex ใน gateway `INTERFACE_CONFIG_KEY_RE` และ micro-business `defaultFor`/`validateValue` ด้วย
- [ ] **Step 2: detail route** — `const Form = brandDef.form ?? categoryDef.form;` ถ้า `!Form` ให้ render `ErrorState` `notFound` แบบเดียวกับเคส brand ไม่รู้จัก
- [ ] **Step 3: redirect** — ใน `routes/router.tsx` เพิ่ม route ก่อน `interface/:category/:brand`: `{ path: "interface/accounting/external", element: <Navigate to="/system-admin/interface/export/external" replace /> }` (ใช้รูปแบบ redirect ที่ router.tsx ใช้อยู่แล้ว ถ้ามี — เช่น `loader: () => redirect(...)`)
- [ ] **Step 4: i18n (en + th)** — ใน `systemAdmin.interface`:
  - สร้าง `export` = `{ title, desc, brand: { external }, ...ทุกคีย์เดิมของ accounting.external }` — en `title: "Export tools"`, `desc: "Tools that let external systems pull data out of this business unit."`; th `title: "เครื่องมือส่งออก"`, `desc: "เครื่องมือให้ระบบภายนอกดึงข้อมูลออกจากหน่วยธุรกิจนี้"`; `brand.external` ใช้ค่าเดิมของ `accounting.brand.external`
  - คีย์ของ `accounting` ที่ฟอร์ม External ใช้ผ่าน `ta(...)` นอกจาก `brand.external`/`desc` (เช่น `defaults`, `defaultsDescNoInvoice`, `defaultAccountCode`, …) — ตรวจด้วย `grep -n 'ta("' external-interface-form.tsx`; ถ้าคีย์นั้น accounting form ยังใช้อยู่ ให้ **คัดลอก** ไปไว้ใต้ `export` (ไม่ย้าย), ถ้าใช้โดย External เท่านั้น (เช่น `defaultsDescNoInvoice`) ให้ **ย้าย**
  - ลบ `accounting.external` และ `accounting.brand.external`
- [ ] **Step 5: เปลี่ยน namespace ในโค้ด** — ทุก `useTranslations("systemAdmin.interface.accounting.external…")` → `"systemAdmin.interface.export…"`; ใน `external-interface-form.tsx` `ta` → `useTranslations("systemAdmin.interface.export")` (title = `ta("brand.external")`, description = `ta("desc")`); `entitlementOf`/`canReadConfig("accounting","external")` → `("export","external")`; `CONFIG_KEY = "interface_export_external"`
- [ ] **Step 6:** `coam-cells.tsx` สองจุด → `/system-admin/interface/export/external`; `external-api-openapi.json` แก้เส้นทางเมนู + license key ให้ตรงกับ Task 4 (คัดลอกจาก `docs/external-api/openapi.json` ของ BE ถ้าเป็นสำเนาตรง)
- [ ] **Step 7:** `BACKEND_REPO=/Users/samutpra/GitHub/carmensoftware-organize/carmen-turborepo-backend-v2 bun run gen:license-fixture` (BE ต้องอยู่บน branch ของ Task 1)
- [ ] **Step 8: ตรวจ** — `grep -rnE "interface\.accounting\.external|interface_accounting_external|accounting/external|systemAdmin\.interface\.accounting\.external" --include='*.ts' --include='*.tsx' --include='*.json' --include='*.md' . | grep -v node_modules | grep -v graft/ | grep -v docs/superpowers` → เหลือแค่ path ของ redirect ใน router.tsx · `bun run typecheck` · `bun run lint` · `bun test:run routes/system-admin/interface routes/config/chart-of-account-mapping lib/__tests__ constant` → ผ่าน
- [ ] **Step 9:** commit `feat(interface): ย้าย External ไปหมวดใหม่ Export tools`

### Task 6: เอกสาร e2e

**Files:**
- Modify: `/Users/samutpra/GitHub/carmensoftware-organize/carmen-inventory-frontend-e2e/docs/test-cases/1118-interface.md` (~84)

- [ ] **Step 1:** branch `feature/interface-export-group` จาก main ของรีโป e2e; แก้คำบรรยายการจัดกลุ่มการ์ด: External อยู่ใต้หมวด "Export tools" (Accounting เหลือ Carmen GL + BlueLedgers), จำนวนการ์ดรวมเท่าเดิม, หมวดเพิ่มเป็น 4
- [ ] **Step 2:** `grep -rn "accounting/external\|interface_accounting_external" .` ในรีโป e2e (ไม่รวม node_modules) → แก้ spec ที่เจอให้ใช้ URL/key ใหม่
- [ ] **Step 3:** commit `docs(e2e): External ย้ายไปหมวด Export tools`

### Task 7: ตรวจด้วยมือบน dev (หลัง deploy ตามลำดับ)

- [ ] ผู้ใช้อนุมัติแต่ละขั้นของการ deploy (migration → seed → tenant → BE → FE `vercel --prod`/dev ตามที่ผู้ใช้สั่ง)
- [ ] เบราว์เซอร์: หน้า `/system-admin/interface` มี 4 หมวด, External อยู่ใต้ Export tools · เปิดฟอร์มเห็นค่าเดิมของ BU · บันทึกได้ · สร้าง/หมุน API key ได้ · `/system-admin/interface/accounting/external` redirect · ลิงก์จาก COA mapping ไปถูก · สลับภาษาไทย ไม่มีชื่อคีย์ดิบ
- [ ] curl: GET `/api/<bu>/config/app-config/interface_export_external` ด้วย BU ที่ไม่มี license → 403; BU ที่มี → 200 ค่าเดิม · เรียก `/api/ext/v1/...` ด้วย API key เดิม → 200
