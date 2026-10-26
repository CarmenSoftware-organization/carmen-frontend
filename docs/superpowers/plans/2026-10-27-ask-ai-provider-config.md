# Ask AI provider config — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **ความชอบของ user:** ข้ามขั้น "เขียน test ใหม่" ทั้งหมด — ห้ามสร้างไฟล์ `*.test.ts` / `*.spec.ts` ใหม่ · ยังต้องรัน typecheck + lint ทุก task · test suite เดิมที่ไฟล์ที่แก้แตะถึงต้องเขียวก่อน commit · ตรวจด้วยมือ (curl / browser) ตามที่แต่ละ task ระบุ · commit message เป็นภาษาไทย

**Goal:** ย้าย provider + prompt ของปุ่ม Ask AI (หน้า PR) จากโค้ดไปเป็นข้อมูล — ค่ามาตรฐานจัดการใน carmen-backstage, BU แก้ทับ/ปิดได้ใน carmen-frontend, หน้า PR แค่ดึงไปใช้

**Architecture:** ตาราง platform `tb_ai_provider` เป็นของ micro-cluster (แบบเดียวกับ dashboard-template) gateway เปิด CRUD ให้ backstage ที่ `/api-system/ai-providers` และเปิด endpoint ราย BU ที่ดึง provider ผ่าน RPC + อ่าน/เขียน key `ask_ai` ใน `tb_application_config` ของ tenant (ผ่าน `ConfigAppConfigService` ที่มีอยู่) แล้ว merge ที่ gateway ฝั่ง FE ไม่มีค่าฝังในโค้ดอีก

**Tech Stack:** NestJS + Prisma + zod (`nestjs-zod`) · rpc-contract generator · backstage React (useState/useEffect, sonner, i18n `en.ts`/`th.ts`) · FE Vite React + TanStack Query + use-intl

**Spec:** `carmen-frontend/docs/superpowers/specs/2026-10-27-ask-ai-provider-config-design.md` (อ่านคู่กันเสมอ)

**Repos / branch:** ทั้ง 3 รีโปใช้ branch `feature/ask-ai-provider-config` แตกจาก `main`
- `BE` = `/Users/samutpra/GitHub/carmensoftware-organize/carmen-turborepo-backend`
- `BS` = `/Users/samutpra/GitHub/carmensoftware-organize/carmen-backstage`
- `FE` = `/Users/samutpra/GitHub/carmensoftware-organize/carmen-frontend`

## Global Constraints

- ห้ามเรียก LLM ฝั่ง server, ห้ามเก็บ API key ของ AI
- ใช้แค่หน้า PR — ไม่ทำโครงหลายจุดใช้งาน
- ห้ามผูก license feature key ใหม่ใน FE (`LICENSE_ENFORCEMENT` เปิดทุก env) — หน้าใหม่ใช้ `licenseFeature: "system_admin"`
- provider ที่ `is_active=false` ห้ามโผล่ใน BU ไหนเลย
- ไม่มีแถว `ask_ai` ใน BU = ใช้ค่ามาตรฐานทั้งหมด → หลัง deploy หน้า PR ต้องเหมือนเดิม (6 provider, prompt เดิม)
- `code`: regex `^[a-z0-9][a-z0-9_-]{1,49}$`, แก้ไม่ได้หลังสร้าง
- `default_prompt` / BU `prompt`: ยาวไม่เกิน **4000** ตัวอักษร
- `url_template` และ `icon_url`: ต้อง `https:`, ห้ามมี username/password, `{query}` (ถ้ามี) ต้องอยู่หลัง `?` หรือ `#` ตัวแรก
- `icon_key` ที่รับ: `claude | chatgpt | gemini | deepseek | grok | google` หรือ `null`
- ตัวแทนค่าใน prompt คือ `{items}` (แทนทุกจุด, function replacer) · ไม่มี `{items}` = ต่อตารางท้าย prompt หลังบรรทัดว่าง
- URL สุดท้ายยาวเกิน **8000** ตัวอักษร = ใช้วิธีคัดลอกลง clipboard + เปิด URL ที่ตัด `{query}` ออก
- ห้ามใส่ `{...}` ลง `messages/*.json` ของ FE (ICU พัง) — ข้อความที่ต้องโชว์ `{items}` ให้ใส่เป็น literal ใน JSX
- เพิ่ม `api_name` ใหม่ทุกตัวต้องเข้า `seed.application-api.data.ts` ของ app ที่ไม่ใช่ `allow_all`

## Review Focus

(ตาม preference ของ user ข้อเหล่านี้ตรวจด้วยมือในขั้น "ตรวจด้วยมือ" ของ task เจ้าของ ไม่เขียน test ใหม่)

1. BU ที่ไม่มีแถว `ask_ai` → `GET .../ask-ai/providers` คืน 6 ตัวเดิม prompt = seed → เมนู PR เหมือนเดิม (Task 4, Task 6)
2. backstage ปิด provider ที่ BU เปิดไว้ → หายจากเมนู PR และหน้าตั้งค่า; เปิดกลับ → ค่าเดิมของ BU กลับมา (Task 4)
3. `ask_ai` ถูกเขียนด้วยค่าเสียผ่าน `PUT /api/config/:bu/app-config/ask_ai` (เช่น `{"value":"x"}`) → endpoint ใหม่ไม่ 500 ใช้ค่ามาตรฐานแทน (Task 4)
4. PR ที่เลือก ~80 บรรทัดกับ Claude → URL เกิน 8000 → คัดลอกลง clipboard + toast + เปิด `https://claude.ai/new?q=` (Task 6)
5. prompt ที่มี `$&`, `$1` หรือ `{items}` สองจุด → ตารางขึ้นทั้งสองจุด และ `$&` ยังเป็นข้อความเดิม (Task 6)

---

## ค่าที่ใช้ร่วมกัน (อ้างอิงจากทุก task)

**prompt มาตรฐาน (seed ทั้ง 6 ตัว)** — ข้อความตรงตัว (ขึ้นบรรทัดด้วย `\n`):

```
You are helping a hotel purchasing officer in Thailand review a purchase request.
Prices are for wholesale / foodservice supply, not retail.

For each item below, give a typical wholesale price range for that pack size and
say whether the quoted price looks reasonable. Answer as a short table.
If you are not confident about Thai market prices, say so instead of guessing.
Do not invent supplier names.

{items}
```

**seed 6 แถว** (`seed_key` = `code`, `is_active=true`, `default_enabled_for_bu=true`):

| sort | code | label | icon_key | url_template |
|---|---|---|---|---|
| 10 | claude | Claude | claude | `https://claude.ai/new?q={query}` |
| 20 | chatgpt | ChatGPT | chatgpt | `https://chatgpt.com/?q={query}` |
| 30 | gemini | Gemini | gemini | `https://gemini.google.com/app` |
| 40 | deepseek | DeepSeek | deepseek | `https://chat.deepseek.com/` |
| 50 | grok | Grok | grok | `https://grok.com/` |
| 60 | google | Google Search | google | `https://www.google.com/search?q={query}` |

**รูปข้อมูล (ใช้ชื่อนี้ทุก repo)**

```ts
// platform row (micro-cluster → gateway → backstage)
interface AiProvider {
  id: string; code: string; label: string;
  icon_key: string | null; icon_url: string | null;
  url_template: string; default_prompt: string;
  is_active: boolean; default_enabled_for_bu: boolean; sort_order: number;
  doc_version: number; created_at: string; updated_at: string;
}

// ค่า value ของ tb_application_config key 'ask_ai'
interface AskAiBuConfig {
  providers: Record<string, { enabled?: boolean; prompt?: string }>;
}

// GET /api/config/:bu_code/ask-ai  (หน้าตั้งค่า FE)
interface AskAiConfigItem {
  code: string; label: string; icon_key: string | null; icon_url: string | null;
  sort_order: number; default_prompt: string; default_enabled_for_bu: boolean;
  bu_enabled: boolean | null;   // null = ยังไม่เคยตั้ง
  bu_prompt: string | null;     // null = ใช้ค่ามาตรฐาน
}
// response: { items: AskAiConfigItem[] }

// PUT /api/config/:bu_code/ask-ai  body (แทนค่าทั้งก้อน)
// { providers: Record<string, { enabled?: boolean | null; prompt?: string | null }> }
// null / "" = ลบฟิลด์นั้น (กลับไปใช้ค่ามาตรฐาน)

// GET /api/:bu_code/ask-ai/providers  (หน้า PR) — เฉพาะตัวที่ใช้ได้ เรียงตาม sort_order
interface AskAiProvider {
  code: string; label: string; icon_key: string | null; icon_url: string | null;
  url_template: string; prompt: string;
}
// response: AskAiProvider[]
```

---

### Task 1: BE — ตาราง `tb_ai_provider`, migration, seed, backstage permission

**Files (ใต้ `BE/packages/prisma-shared-schema-backstage/`):**
- Modify: `prisma/schema.prisma` (เพิ่ม model ต่อท้ายกลุ่ม dashboard template ~:1260)
- Create: `prisma/migrations/20261027120000_add_ai_provider/migration.sql`
- Create: `prisma/seed.ai-provider.data.ts`, `prisma/seed.ai-provider.ts`
- Modify: `package.json` (script `db:seed.ai-provider`)
- Modify: `src/backstage-permission-resource.ts` (~:56), `prisma/seed.backstage-permission.data.ts` (~:103), `prisma/seed.backstage-role-permission.data.ts` (:16, :63, :91)

**Interfaces:**
- Produces: Prisma model `tb_ai_provider` (ฟิลด์ตาม `AiProvider` + `seed_key String? @db.VarChar(100)`, `created_by_id`/`updated_by_id`/`deleted_at`/`deleted_by_id`); permission `ai_provider.{read,create,update,delete}`; seed export `AI_PROVIDER_SEED`

- [ ] **Step 1:** เพิ่ม `model tb_ai_provider` ลอกแบบ `tb_dashboard_widget_template` (:1219) — `code VarChar(50)`, `label VarChar(100)`, `icon_key VarChar(30)?`, `icon_url VarChar(500)?`, `url_template VarChar(500)`, `default_prompt String @db.Text`, `is_active Boolean @default(true)`, `default_enabled_for_bu Boolean @default(false)`, `sort_order Int @default(0)` · `@@unique([code, deleted_at], map: "ai_provider_code_u")` + `@@index([sort_order])`
- [ ] **Step 2:** เขียน `migration.sql` ด้วยมือ (CREATE TABLE + index + partial unique `(seed_key) WHERE seed_key IS NOT NULL` แบบ migration `20261006130000_dashboard_widget_template_seed_key`) แล้ว `bun run db:generate`
- [ ] **Step 3:** `seed.ai-provider.data.ts` export `AI_PROVIDER_SEED` = 6 แถวตามตาราง "seed 6 แถว" + prompt มาตรฐาน · `seed.ai-provider.ts` ลอก `seed.dashboard-widget-template.ts`: match ด้วย `seed_key` (รวมแถว soft-deleted), insert เฉพาะที่ยังไม่มี **ไม่ทับแถวที่มีอยู่** (admin อาจแก้ prompt แล้ว) ใน `$transaction` เดียว · เพิ่ม script `"db:seed.ai-provider": "bun prisma/seed.ai-provider.ts"`
- [ ] **Step 4:** เพิ่ม resource `ai_provider` (description en/th) ใน `backstage-permission-resource.ts`, 4 action ใน `seed.backstage-permission.data.ts`, และใน `ROLE_PERMISSIONS`: `'ai_provider.*'` ทุกที่ที่มี `'dashboard_template.*'`, `'ai_provider.read'` ทุกที่ที่มี `'dashboard_template.read'`
- [ ] **Step 5:** ตรวจ: `bun run db:check.backstage-permission-resource && bun run db:check.backstage-permission && bun run db:check.backstage-role-permission` ผ่าน · `bunx tsc --noEmit -p .` ผ่าน
- [ ] **Step 6:** Commit `feat(ai-provider): เพิ่มตาราง tb_ai_provider + seed 6 provider + สิทธิ์ backstage`

> ห้ามรัน migration/seed กับฐาน dev ใน task นี้ — ฐาน :4000 คือ dev ที่ใช้ร่วมกัน (รอขั้น deploy ที่ user อนุญาต) · ทดสอบ local ด้วยฐานของตัวเองถ้ามี

---

### Task 2: BE — rpc-contract + micro-cluster `ai-provider` module

**Files:**
- Create: `BE/apps/micro-cluster/src/cluster/ai-provider/{ai-provider.controller.ts, ai-provider.service.ts, ai-provider.module.ts, ai-provider.validation.ts}`
- Modify: `BE/apps/micro-cluster/src/app.module.ts` (import + `imports` array ~:127)
- Generated: `BE/packages/rpc-contract/src/contracts/ai-providers.ts` + export ใน `contracts/index.ts`

**Interfaces:**
- Consumes: `tb_ai_provider` (Task 1)
- Produces: contract `AiProviders` = `findAll` (`{ include_inactive?: boolean }` → `AiProvider[]` เรียง `sort_order, label`), `findOne` (`{ id }`), `create` (`{ data }`), `update` (`{ id, data }` มี `doc_version`), `delete` (`{ id }` soft delete) — cmd `ai-providers.<op>`, app `micro-cluster`, rest `/ai-providers[/:id]`
- Produces: `validateAiProviderInput(data): string | null` ใน `ai-provider.validation.ts` (คืนข้อความ error หรือ null) — ใช้ซ้ำใน gateway ไม่ได้เพราะข้าม app ให้ gateway ตรวจด้วย zod ของตัวเอง (Task 3) และ micro-cluster ตรวจซ้ำเป็นชั้นสุดท้าย

- [ ] **Step 1:** service ลอก `dashboard-template.service.ts` (`@Inject('PRISMA_SYSTEM')`, `@TryCatch`, `Result.ok`/`Result.error`) · `create` คืน `ALREADY_EXISTS` เมื่อ `code` ซ้ำ (แถวที่ยังไม่ลบ) · `update` ห้ามเปลี่ยน `code` (ignore ฟิลด์นี้), stale `doc_version` → `ALREADY_EXISTS` · ตัวใหม่ที่ไม่ส่ง `default_enabled_for_bu` = `false`
- [ ] **Step 2:** `validateAiProviderInput` ตรวจตาม Global Constraints (code regex, ความยาว prompt, URL https/no userinfo/`{query}` หลัง `?`/`#`, `icon_key` อยู่ในรายการ) — ตรวจ URL โดยแทน `{query}` ด้วย `x` แล้ว `new URL()` · ผิด → `Result.error(msg, ErrorCode.INVALID_ARGUMENT)`
- [ ] **Step 3:** controller ใช้ `@MessagePattern({cmd,service})` literal ชั่วคราว → `bun run gen:rpc-contract` → เปลี่ยนเป็น `AiProviders.<op>.pattern` · register module
- [ ] **Step 4:** ตรวจ: `bun run typecheck` และ `bun run lint` ใน `apps/micro-cluster` + `packages/rpc-contract` ผ่าน
- [ ] **Step 5:** Commit `feat(ai-provider): micro-cluster CRUD + rpc contract`

---

### Task 3: BE — gateway backstage `/api-system/ai-providers`

**Files:**
- Create: `BE/apps/backend-gateway/src/backstage/backstage_ai-providers/{backstage_ai-providers.controller.ts, backstage_ai-providers.service.ts, backstage_ai-providers.module.ts, swagger/response.ts}`
- Create: `BE/apps/backend-gateway/src/common/dto/ai-provider/ai-provider.dto.ts`
- Modify: `BE/apps/backend-gateway/src/app.module.ts` (~:43, ~:197)
- Regenerate: `BE/apps/backend-gateway/src/backstage/applications/app-api-catalog.generated.ts`
- Modify: `BE/packages/prisma-shared-schema-backstage/prisma/seed.application-api.data.ts`

**Interfaces:**
- Consumes: `AiProviders` contract (Task 2)
- Produces (สำหรับ Task 5): `GET /api-system/ai-providers` → `AiProvider[]` (รวมตัวที่ปิด) · `GET /:id` · `POST` body `AiProviderCreateDto` · `PATCH /:id` body `AiProviderUpdateDto` (partial + `doc_version` บังคับ, ไม่มี `code`) · `DELETE /:id` — permission `ai_provider.read/create/update/delete`, api_name `ai-provider.findAll|findOne|create|update|delete`

- [ ] **Step 1:** DTO zod (`zod/v4` + `createZodDto`) ตาม Global Constraints ใช้ `.refine` สำหรับกฎ URL
- [ ] **Step 2:** controller/service ลอก `backstage_dashboard-templates` (class: `@Controller('api-system/ai-providers')`, `KeycloakGuard`; route: `new AppIdGuard('ai-provider.<op>')`, `BackstagePermissionGuard`, `@RequireBackstagePermission(...)`, `@EnrichAuditUsers()`) · register module
- [ ] **Step 3:** regenerate catalog (`bun run scripts/generate-app-api-catalog/run.ts`) · เพิ่ม 5 api_name ให้ app backstage ที่ไม่ใช่ `allow_all` ใน `seed.application-api.data.ts` · `bun run db:check.application-api` ไม่ฟ้อง drift ที่เกี่ยวกับชื่อใหม่
- [ ] **Step 4:** ตรวจ: gateway `typecheck` + `lint` ผ่าน · `bun run audit:app-api-catalog-drift` ผ่าน
- [ ] **Step 5:** Commit `feat(ai-provider): gateway backstage CRUD /api-system/ai-providers`

---

### Task 4: BE — gateway endpoint ราย BU (`ask-ai`)

**Files:**
- Create: `BE/apps/backend-gateway/src/config/config_ask-ai/{config_ask-ai.controller.ts, config_ask-ai.service.ts, config_ask-ai.module.ts, ask-ai-resolve.ts}`
- Create: `BE/apps/backend-gateway/src/application/ask-ai/{ask-ai.controller.ts, ask-ai.module.ts}`
- Modify: `BE/apps/backend-gateway/src/config/route-config.ts` (~:72, ~:153) + ไฟล์ register ของ `application/` (`route-application.ts`)
- Modify: `BE/apps/backend-gateway/src/config/config_app-config/config_app-config.service.ts` (`isListExcluded` ~:197: เพิ่ม `key === 'ask_ai'`)
- Modify: `BE/packages/prisma-shared-schema-backstage/prisma/permission.route-map.ts` (`ROUTE_RESOURCE_MAP`)
- Modify: `seed.application-api.data.ts` + regenerate catalog

**Interfaces:**
- Consumes: `AiProviders.findAll` (Task 2), `ConfigAppConfigService` (inject จาก `ConfigAppConfigModule`)
- Produces (สำหรับ Task 6, 7): ตามบล็อก "รูปข้อมูล" — `GET/PUT /api/config/:bu_code/ask-ai` (api_name `askAi.getConfig` / `askAi.saveConfig`) และ `GET /api/:bu_code/ask-ai/providers` (api_name `askAi.providers`)
- Produces ใน `ask-ai-resolve.ts` (pure, ไม่มี DI):
  - `parseAskAiBuConfig(value: unknown): AskAiBuConfig` — shape ผิดทุกกรณีคืน `{ providers: {} }`, entry ที่ `enabled` ไม่ใช่ boolean หรือ `prompt` ไม่ใช่ string/ว่าง → ตัดฟิลด์นั้นทิ้ง
  - `toConfigItems(providers: AiProvider[], bu: AskAiBuConfig): AskAiConfigItem[]` — เฉพาะ `is_active`
  - `resolveBuProviders(providers: AiProvider[], bu: AskAiBuConfig): AskAiProvider[]` — `is_active && (bu.enabled ?? default_enabled_for_bu)`, `prompt = bu.prompt || default_prompt`

- [ ] **Step 1:** เขียน `ask-ai-resolve.ts` ตาม signature ข้างบน
- [ ] **Step 2:** `ConfigAskAiService`: `getConfig(bu_code,user_id)` = RPC `AiProviders.findAll` + `ConfigAppConfigService` อ่าน key `ask_ai` (ไม่มีแถว = `{providers:{}}`) → `{ items: toConfigItems(...) }` · `saveConfig(bu_code,user_id,body)` = ตรวจ code ทุกตัวอยู่ในรายการ provider ที่มีจริง (ไม่ใช่ → 422 พร้อมรายชื่อ), prompt ≤ 4000, แปลง null/"" เป็นลบฟิลด์, entry ว่างทิ้ง → upsert key `ask_ai` · `getProviders(bu_code,user_id)` = `resolveBuProviders(...)`
- [ ] **Step 3:** controller ตั้งค่า `@Controller('api/config/:bu_code/ask-ai')` + `@UseGuards(KeycloakGuard, PermissionGuard)` · GET `@Permission({ 'system_admin.business_unit': ['view'] })` · PUT `@Permission({ 'system_admin.business_unit': ['update'] })` — **ก่อนใช้ อ่านคอมเมนต์ที่ FE `constant/permissions.ts` ~:129 (key `business_unit` ถูก flag ไว้) และยืนยันว่า key นี้มีในตาราง permission ของ tenant จริง** ถ้าไม่มี ให้หยุดแล้วถาม ห้ามประดิษฐ์ key ใหม่
- [ ] **Step 4:** controller หน้า PR `@Controller('api/:bu_code/ask-ai')` + `KeycloakGuard` อย่างเดียว (ไม่มี `@Permission` — เหมือน `/app-config`; ข้อมูลไม่ลับ และ role ที่มีแค่ `view_department` ต้องเห็นปุ่มด้วย) · route `GET providers` · ใช้ `bu_code` จาก path เท่านั้น
- [ ] **Step 5:** route-map: `'config:ask-ai': 'configuration.app_config'` และ `'app:ask-ai': 'procurement.purchase_request'` · เพิ่ม 3 api_name ใน `seed.application-api.data.ts` ของ app FE ที่ไม่ใช่ `allow_all` + regenerate catalog · `isListExcluded` เพิ่ม `ask_ai`
- [ ] **Step 6:** ตรวจ: gateway `typecheck` + `lint` ผ่าน · `bun run` check `check.endpoint-permission-coverage.ts` + catalog drift ผ่าน
- [ ] **Step 7 (ตรวจด้วยมือ, ฐาน local/branch DB ที่ migrate+seed แล้ว):** curl ครบ Review Focus 1–3: ไม่มีแถว `ask_ai` → providers 6 ตัว · PUT ปิด `deepseek` + prompt `claude` → providers 5 ตัว claude ใช้ prompt ใหม่ · PATCH backstage `is_active=false` ให้ claude → หาย, เปิดกลับ → prompt ของ BU กลับ · `PUT /app-config/ask_ai {"value":"x"}` → `GET providers` ยัง 200 ด้วยค่ามาตรฐาน · PUT code `nope` → 422
- [ ] **Step 8:** Commit `feat(ask-ai): endpoint ราย BU สำหรับตั้งค่าและดึง provider ของ Ask AI`

---

### Task 5: BS — เมนู AI → Providers

**Files (ใต้ `BS/src/`):**
- Modify: `types/index.ts` (เพิ่ม `AiProvider`, `AiProviderInput`)
- Create: `services/aiProviderService.ts`
- Create: `pages/AiProviderManagement.tsx`, `pages/aiProviders/AiProviderEditDialog.tsx`
- Modify: `App.tsx` (lazy import + route `/ai-providers` ด้วย `PrivateRoute requiredPermission="ai_provider.read" feature="ai_providers"`)
- Modify: `components/nav/backstageNav.ts` (บล็อกใหม่ `groupKey: 'navGroup.ai'` ต่อเนื่องกัน วางก่อนบล็อก Database), `constants/featureFlags.ts` (`FEATURE_CATALOG` key `ai_providers`, `defaultState: 'active'`), `components/Breadcrumbs.tsx` (`'ai-providers': 'breadcrumb.aiProviders'`)
- Modify: `i18n/en.ts`, `i18n/th.ts` (`nav.aiProviders`, `navGroup.ai`, `breadcrumb.aiProviders`, `pages.aiProviders.*`)

**Interfaces:**
- Consumes: `/api-system/ai-providers` (Task 3)
- Produces: `aiProviderService.{list, create, update, remove}` ลอก `dashboardTemplateService.ts` (`unwrap`, `PATCH` ส่ง `doc_version`)

- [ ] **Step 1:** service + types
- [ ] **Step 2:** หน้า list ลอก `DashboardTemplateManagement.tsx` / `TemplateListPanel.tsx`: คอลัมน์ ไอคอน (icon_url → `<img>`, ไม่มี → ชื่อ icon_key), label, code, สถานะ (Badge เปิด/ปิด), "เปิดให้ BU ตั้งต้น", sort · ปุ่มสร้าง/แก้/ลบ ห่อ `<Can permission="ai_provider.<op>" clusterId={BACKSTAGE_SCOPED_RECORD}>` · ลบใช้ `ConfirmDialog`
- [ ] **Step 3:** dialog ลอก `TemplateEditDialog.tsx` (useState ต่อฟิลด์): code (disabled ตอนแก้), label, icon_key (Select + "ไม่มี"), icon_url, url_template (ข้อความช่วย: มี `{query}` = เปิดพร้อมข้อความ / ไม่มี = คัดลอกให้วางเอง, แสดงผลลัพธ์สดใต้ช่อง), default_prompt (Textarea + ตัวนับ /4000, ข้อความช่วยเรื่อง `{items}`), is_active, default_enabled_for_bu, sort_order — toggle ใช้ปุ่ม/Badge แบบ `FeatureStateToggle` (ไม่มี `ui/switch`) · conflict ใช้ `isVersionConflict`/`notifyVersionConflict` · error ใช้ `getErrorDetail`
- [ ] **Step 4:** ตรวจ: `bun run typecheck && bun run lint` ผ่าน · `bun run test` เดิมเขียว
- [ ] **Step 5 (ตรวจด้วยมือ):** login backstage → เมนู AI โผล่ → เห็น 6 ตัว → สร้าง `perplexity` (`https://www.perplexity.ai/search?q={query}`) → ค่า "เปิดให้ BU" เริ่มที่ปิด · ลอง URL `http://` และ `https://{query}.com` → ถูกปฏิเสธ
- [ ] **Step 6:** Commit `feat(ai-providers): หน้า AI → Providers ใน backstage`

---

### Task 6: FE — หน้า PR ใช้ provider จาก backend

**Files (ใต้ `FE/`):**
- Modify: `constant/api-endpoints.ts` (`ASK_AI_PROVIDERS: (buCode) => \`/api/proxy/api/${buCode}/ask-ai/providers\``, `ASK_AI_CONFIG: (buCode) => \`/api/proxy/api/config/${buCode}/ask-ai\``)
- Modify: `constant/query-keys.ts` (`ASK_AI_PROVIDERS: "ask-ai-providers"`, `ASK_AI_CONFIG: "ask-ai-config"`)
- Create: `routes/procurement/purchase-request/ai/use-ask-ai-providers.ts`
- Modify: `routes/procurement/purchase-request/ai/build-pr-ai-query.ts`, `build-pr-ai-query.test.ts` (ปรับ test เดิมให้เข้ากับ signature ใหม่เท่านั้น)
- Replace: `routes/procurement/purchase-request/ai/ai-providers.ts` → เหลือ `providerIcon(iconKey: string | null): ProviderIcon` (map 6 key → component ใน `components/icons/provider-icons.tsx`, อื่น ๆ → `Sparkle`)
- Modify: `routes/procurement/purchase-request/ai/pr-ask-ai-menu.tsx`

**Interfaces:**
- Consumes: `GET /api/:bu_code/ask-ai/providers` (Task 4) → `AskAiProvider[]`
- Produces:
  - `useAskAiProviders(): UseQueryResult<AskAiProvider[], ApiError>` — `enabled: !!buCode`, `staleTime: 60_000`, ดึงตอน mount (ไม่ใช่ตอนเปิดเมนู)
  - `buildPrAiQuery(template: string, items: readonly PrAiQueryItem[]): string`
  - `buildProviderUrl(urlTemplate: string, query: string): { url: string; copy: boolean }` — ไม่มี `{query}` → `{url: urlTemplate, copy: true}` · มี และ URL ที่แทนแล้ว ≤ 8000 → `{url, copy:false}` (แทนทุกจุดด้วย `encodeURIComponent(query)`) · เกิน → `{url: urlTemplate ที่ตัด {query} ออก, copy: true}`
  - `PrAskAiMenuProps` เดิม (`items`, `disabled`) ไม่เปลี่ยน → `pr-item-fields.tsx` ไม่ต้องแก้

- [ ] **Step 1:** `buildPrAiQuery`: ลบ `CONTEXT` · สร้างตารางแบบเดิม (header `| # | Item | Qty | Quoted price |` + rows) · `template.includes("{items}")` → `template.replace(/\{items\}/g, () => table)` ไม่งั้น `${template}\n\n${table}` · ย้ายคอมเมนต์เรื่อง "ไม่ส่งชื่อคลัง" ไว้ที่เดิม และคอมเมนต์เรื่อง "อย่าเดา" ย้ายไปไว้ที่ seed (Task 1)
- [ ] **Step 2:** ปรับ `build-pr-ai-query.test.ts` ให้ส่ง prompt มาตรฐาน (ข้อความจาก "ค่าที่ใช้ร่วมกัน") เป็น template — test เรื่องบริบทโรงแรม/ห้ามแต่ง supplier ยังผ่านเพราะ template มีข้อความนั้น · ห้ามเพิ่มไฟล์ test ใหม่
- [ ] **Step 3:** `buildProviderUrl` (วางใน `build-pr-ai-query.ts`) + `providerIcon` + `useAskAiProviders`
- [ ] **Step 4:** `PrAskAiMenu`: ใช้ `useAskAiProviders` · โหลดอยู่หรือ error → ปุ่ม disabled · ได้ `[]` → `return null` · คลิก → `buildPrAiQuery(p.prompt, items)` → `buildProviderUrl` → ถ้า `copy` ใช้ clipboard + toast เดิม (`askAiCopied`/`askAiCopyFailed`) → `window.open(url, "_blank", "noopener,noreferrer")` · ไอคอน: `icon_url` → `<img src className="size-3.5" alt="">` ไม่งั้น `providerIcon(icon_key)`
- [ ] **Step 5:** ตรวจ: `bun run typecheck && bun run lint` ผ่าน · `bun test:run routes/procurement/purchase-request` เขียว
- [ ] **Step 6 (ตรวจด้วยมือ, `VITE_DEV_PROXY_TARGET=<BE branch> bun dev`):** เปิด PR ตัวอย่างใน spec → เลือก 2 บรรทัด → เมนูมี 6 ตัวเหมือนเดิม → Claude เปิดพร้อม prompt + ตาราง · Gemini → toast คัดลอก · Review Focus 4 (เลือกบรรทัดเยอะ) และ 5 (ตั้ง prompt ที่มี `$&` + `{items}` สองจุดผ่าน Task 7)
- [ ] **Step 7:** Commit `feat(pr-ask-ai): ดึง provider และ prompt ของ Ask AI จาก backend`

---

### Task 7: FE — หน้า `/system-admin/ask-ai`

**Files (ใต้ `FE/`):**
- Create: `routes/system-admin/ask-ai/{ask-ai.route.tsx, ask-ai-component.tsx, ask-ai-provider-card.tsx, use-ask-ai-config.ts}`
- Modify: `routes/router.tsx` (~:819 ข้าง `default-setting`: `{ path: "ask-ai", lazy: () => import("./system-admin/ask-ai/ask-ai.route") }`)
- Modify: `constant/module-list.ts` (หลัง `defaultSetting` ~:791: `{ name: "askAi", path: "/system-admin/ask-ai", licenseFeature: "system_admin", icon: Sparkles, permission: PERMISSIONS.system_admin.business_unit.view }`)
- Modify: `messages/en.json`, `messages/th.json` (label เมนู `askAi` ในบล็อกเดียวกับ `defaultSetting` ~:6323 และ namespace `askAi` ระดับบนสุดสำหรับข้อความในหน้า)

**Interfaces:**
- Consumes: `GET/PUT /api/config/:bu_code/ask-ai` (Task 4), `ASK_AI_CONFIG` / `QUERY_KEYS.ASK_AI_CONFIG` (Task 6)
- Produces: `useAskAiConfig(): UseQueryResult<{ items: AskAiConfigItem[] }, ApiError>` · `useSaveAskAiConfig(): UseMutationResult<unknown, ApiError, AskAiSaveBody>` — `onSuccess` invalidate ทั้ง `ASK_AI_CONFIG` และ `ASK_AI_PROVIDERS`, ไม่ใส่ `onError` (MutationCache toast ให้แล้ว)

- [ ] **Step 1:** hooks ลอก `use-report-form-templates.ts` / `use-running-code.ts`
- [ ] **Step 2:** หน้า ลอกโครง `default-setting-component.tsx` (`SettingSection`, โหมด Edit/Save): ต่อ provider หนึ่ง card — ไอคอน + label, `Switch` (ค่าที่แสดง = `bu_enabled ?? default_enabled_for_bu`), Badge "ใช้ค่ามาตรฐาน"/"แก้แล้ว", `Textarea` prompt (ค่าว่าง = ใช้ค่ามาตรฐาน, ตัวนับ /4000), ค่ามาตรฐานแบบอ่านอย่างเดียวพับ/กางได้, ปุ่ม "กลับไปใช้ค่ามาตรฐาน" (ล้าง prompt) · Save ส่งทั้งก้อนตามรูป PUT · ปุ่มบันทึกโชว์เมื่อ `useCan` มี `system_admin.business_unit.update` · ข้อความที่พูดถึง `{items}` ใส่ใน JSX ตรง ๆ · ต้องอ่านออกทั้ง light/dark
- [ ] **Step 3:** route + router + module-list + i18n th/en
- [ ] **Step 4:** ตรวจ: `bun run typecheck && bun run lint` ผ่าน · `bun test:run components/ui lib` (type-ladder, status-ink, security-headers) เขียว
- [ ] **Step 5 (ตรวจด้วยมือ):** เมนู System Admin มี Ask AI → ปิด DeepSeek + แก้ prompt Claude → Save → เปิดหน้า PR ใหม่ เมนูเหลือ 5 ตัว Claude ใช้ prompt ใหม่ → "กลับไปใช้ค่ามาตรฐาน" → Save → กลับเหมือนเดิม · provider ใหม่จาก backstage (Task 5) โผล่ในหน้านี้แบบปิด เปิดแล้วโผล่ในเมนู PR
- [ ] **Step 6:** Commit `feat(ask-ai): หน้าตั้งค่า Ask AI ราย BU`

---

## หลังทุก task (ไม่ใช่ task สำหรับ subagent)

- `trail check` ใน FE ก่อนเปิด PR
- PR 3 ใบ (BE, BS, FE) — merge แบบ merge commit (ห้าม squash: changelog generator)
- **Deploy ต้องขออนุญาต user ทุกขั้น** ลำดับ: platform migration `20261027120000_add_ai_provider` + `db:seed.ai-provider` + `db:seed.backstage-permission` + `db:seed.backstage-role-permission` + `db:seed.application-api` (ทุก env) → micro-cluster → gateway → backstage → FE (`vercel --prod`)
- FE ขึ้นก่อน BE = ปุ่ม Ask AI disabled ทุก BU
