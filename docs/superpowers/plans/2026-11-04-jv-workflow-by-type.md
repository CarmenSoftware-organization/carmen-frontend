# JV ผ่าน workflow ตามประเภท — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **ไม่เขียน test ในรอบนี้** (ความต้องการของ user ใน `~/.claude/CLAUDE.md`): ทำ implement → type-check → lint → commit ทุก task.
> ห้ามสร้าง `*.spec.ts` / `*.test.ts` ใหม่ แต่ test ที่มีอยู่ต้องไม่แดงเพราะงานนี้ (รัน suite ของไฟล์ที่แตะ ถ้ามี).
> ขั้น "ตรวจด้วยมือ" (curl / browser) ไม่ข้าม

**Goal:** ให้ BU ตั้ง workflow ของ JV แยกตาม prefix + ที่มาของใบได้ ระบบเลือก workflow ให้เองตอน submit และหน้า JV อนุมัติ/ตีกลับได้จริง

**Architecture:** ขอบเขตเก็บใน `tb_workflow.data.jv_scope` (JSON เดิม ไม่มี migration). micro-business มี helper กลางตัวเดียว
(`gl-jv-workflow-scope.ts`) ที่ทั้ง `GlJvService` (submit) และ `GlPostingService` (reverse) ใช้ resolve workflow — แยกเป็นฟังก์ชันอิสระเพราะ
`GlJvService` inject `GlPostingService` อยู่แล้ว ฝั่ง posting เรียก service ของ JV ย้อนไม่ได้. ฝั่ง workflows service ตรวจห้ามทับภายใต้ advisory lock.
FE เพิ่มชนิด JV ในหน้า workflow (แท็บ "ขอบเขต" แทนแท็บสินค้า) และทำปุ่ม/แถบขั้นในหน้า JV ให้อ่าน `role` + `stage_actions` จาก backend แบบ PO

**Tech Stack:** NestJS + Prisma + zod (backend, `carmen-turborepo-backend`), Vite + React 19 + React Router 7 + TanStack Query + RHF/zod + use-intl (`carmen-frontend`)

**Spec:** `docs/superpowers/specs/2026-11-04-jv-workflow-by-type-design.md` (อ่านคู่กับแผนนี้)

## Global Constraints

- ที่มาที่เข้า workflow ได้มี 6 ค่าเท่านั้น: `manual`, `recurring`, `allocation`, `amortize`, `reversal`, `closing`. ค่าอื่นของ `enum_gl_jv_source` → ไม่มี workflow เสมอ
- ขอบเขต = `prefix_id ∈ prefix_ids` **AND** `source ∈ sources`; อาร์เรย์ว่าง = ทุกค่าของมิตินั้น; ไม่มี `jv_scope` = ว่างทั้งคู่
- ห้ามขอบเขตทับกันระหว่าง workflow `gl_jv` ที่ `is_active = true` และ `deleted_at = null`
- ใบที่ไม่เข้าขอบเขตใด = post ทันที (พฤติกรรมเดิม)
- reversal จับขอบเขตด้วย **prefix ของใบต้นทาง**, source = `reversal`; auto-reverse (`runDueAutoReversals`) ไม่ผ่าน workflow
- ใบ `in_review` เดินต่อตาม `workflow_id` ที่ผูกไว้; submit ใหม่หลัง reject = resolve ใหม่ (ไม่ใช้ `header.workflow_id` เดิม)
- action รอบนี้: submit / approve / reject — ไม่มี send back
- ข้อความ i18n ห้ามมี `{{…}}` หรือ `<คำ>` (ICU พัง); commit message ภาษาไทย; branch `feature/jv-workflow-by-type` ทั้งสองรีโป
- module boundary ของ FE: `routes/system-admin/` import จาก `routes/accounting/` ไม่ได้ — ของที่ใช้ร่วมย้ายไป `hooks/`
- api_name ใหม่ต้องเติม allowlist ทุก env ก่อน deploy FE (ไม่งั้น user โดน logout)

## Review Focus

1. **reversal กดซ้ำระหว่างรออนุมัติ** — ใบต้นทางมี reversal เป็น draft/in_review อยู่แล้ว กด reverse อีกครั้งต้องได้ `GL_JV_IMMUTABLE` ไม่ใช่ใบที่สอง (Task 2, ตรวจด้วยมือ ขั้น 6)
2. **reversal ที่ผ่าน workflow แล้ว post** — หลังอนุมัติขั้นสุดท้าย ใบต้นทางต้องมี `reversed_by_jv_id` ชี้ใบ reversal (รวมกรณีอนุมัติแบบตั้งเวลา post แล้ว `runDueJobs` เป็นคน post) (Task 2 ขั้น 6)
3. **ใบที่ถูก reject แล้วแก้ prefix ก่อน submit ใหม่** — ต้องไป workflow ของ prefix ใหม่ ไม่ใช่ตัวเดิม (Task 2 ขั้น 6)
4. **บันทึก workflow ที่ขอบเขตทับ / เปิด active ตัวที่ทับ** — ได้ 422 `WORKFLOW_JV_SCOPE_OVERLAP` พร้อมชื่อ workflow ที่ชน และ FE แสดงข้อความเฉพาะ ไม่ใช่ "กรอกไม่ถูกต้อง" (Task 1 ขั้น 6, Task 4 ขั้น 9)
5. **BU ที่ไม่ตั้ง workflow JV เลย** — submit ยัง post ทันที, หน้า JV ไม่แสดงแถบขั้น/ปุ่มอนุมัติ (Task 2 ขั้น 6, Task 5 ขั้น 7)

---

## ส่วน A — backend (`carmen-turborepo-backend`)

ก่อนเริ่ม: `git checkout main && git pull && git checkout -b feature/jv-workflow-by-type`

### Task 1: ขอบเขต workflow JV + กฎห้ามทับ + endpoint รายการ JV workflow

**Files:**
- Create: `apps/micro-business/src/gl/gl-jv/workflow/gl-jv-workflow-scope.ts`
- Modify: `apps/micro-business/src/master/workflows/workflows.service.ts` (`create` ~L704, `update` ~L1331)
- Modify: `packages/error-catalog/src/catalog.ts` (ต่อท้ายกลุ่ม `MODULE.WORKFLOW` — id ถัดจากตัวสุดท้าย ปัจจุบันคือ 7) + `reference/` ที่ generate
- Modify: `apps/backend-gateway/src/config/config_workflows/config_workflows.controller.ts` (เพิ่ม `@Get('journal-voucher')` ข้าง `store-requisition` ~L300)

**Interfaces:**
- Produces (ไฟล์ scope):
  - `export const JV_WORKFLOW_SOURCES: readonly enum_gl_jv_source[]` — 6 ค่าตาม Global Constraints
  - `export interface JvScope { prefix_ids: string[]; sources: enum_gl_jv_source[] }`
  - `export interface JvScopeKey { prefix_id: string; source: enum_gl_jv_source }`
  - `export function parseJvScope(data: unknown): Result<JvScope>` — อ่าน `data.jv_scope`; ไม่มี → `{prefix_ids: [], sources: []}`; มีแต่ผิดรูป (ไม่ใช่ uuid[], source นอก 6 ค่า) → error `WORKFLOW_JV_SCOPE_INVALID`
  - `export function scopeMatches(scope: JvScope, key: JvScopeKey): boolean`
  - `export function scopesOverlap(a: JvScope, b: JvScope): boolean` — ทับเมื่อ (prefix ตัดกัน หรือฝั่งใดว่าง) **และ** (source ตัดกัน หรือฝั่งใดว่าง)
  - `export async function scopeKeyForJv(db: PrismaClientLike, header: { prefix_id: string; source: enum_gl_jv_source; reversal_of_jv_id: string | null }): Promise<JvScopeKey | null>` — source นอก 6 ค่า → null; `source === reversal` และมี `reversal_of_jv_id` → ใช้ `prefix_id` ของใบต้นทาง
  - `export async function resolveJvWorkflowId(db: PrismaClientLike, key: JvScopeKey | null): Promise<string | null>` — key null → null; อ่าน workflow `gl_jv` ที่ active ไม่ถูกลบ เรียง `created_at asc` คืนตัวแรกที่ `scopeMatches`
  - `PrismaClientLike` = ชนิดที่รับได้ทั้ง `prismaService` และ `tx` (ดูที่ `gl-posting.service.ts` ใช้ `PrismaTx` อยู่แล้ว — ใช้ union ของทั้งสอง)
- Produces (catalog): `WORKFLOW_JV_SCOPE_OVERLAP` (422, param `{workflow}`), `WORKFLOW_JV_SCOPE_INVALID` (422)
- Produces (gateway): `GET /api/config/:bu_code/workflows/journal-voucher`, guard `new AppIdGuard('workflow.findAllJournalVoucher')`, เรียก `findAllByType(enum_workflow_type.gl_jv, …)` แบบเดียวกับอีกสามตัว; operationId `configWorkflows_findAllJournalVoucher`

- [ ] **Step 1: เพิ่ม 2 รหัสใน error catalog**

ข้อความ (ใช้ตามนี้):
- `WORKFLOW_JV_SCOPE_OVERLAP` en: `This scope overlaps workflow {workflow}: a journal voucher would match both` · th: `ขอบเขตนี้ทับกับ workflow {workflow} — ใบสำคัญหนึ่งใบจะเข้าได้ทั้งสองตัว`
- `WORKFLOW_JV_SCOPE_INVALID` en: `Journal voucher scope is invalid: prefixes must be ids and sources must be manual, recurring, allocation, amortize, reversal or closing` · th: `ขอบเขตของ JV ไม่ถูกต้อง: prefix ต้องเป็นรหัส และที่มาต้องเป็น manual, recurring, allocation, amortize, reversal หรือ closing`

แล้วรัน generator ของ reference (`packages/error-catalog/scripts/generate-reference.ts` — ดูคำสั่งใน `packages/error-catalog/package.json`) และ build package ถ้าแอปอ่านจาก `dist`

- [ ] **Step 2: เขียน `gl-jv-workflow-scope.ts` ตาม Interfaces**

- [ ] **Step 3: ใส่กฎห้ามทับใน `WorkflowsService.create` และ `update`**

เฉพาะเมื่อชนิด (ของ payload ตอน create / ของแถวที่เก็บไว้ตอน update) = `gl_jv`:
1. `parseJvScope(nextData)` — error → คืนเลย
2. ถ้าผลลัพธ์จะเป็น active (`is_active` ใหม่ ?? ของเดิม ?? true): ภายใน `this.prismaService.$transaction(async (tx) => …)` รัน
   `` await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('tb_workflow:gl_jv_scope'))` `` → อ่าน workflow `gl_jv` อื่นที่ active/ไม่ถูกลบ (ไม่รวม id ตัวเอง)
   → ตัวแรกที่ `scopesOverlap` → `Result.errorFromCatalog(ERROR_CATALOG.WORKFLOW_JV_SCOPE_OVERLAP, { workflow: other.name })`
3. การเขียน (`create` / `update`) ต้องอยู่ใน transaction เดียวกับขั้น 2 — ย้ายเฉพาะคำสั่งเขียนของกิ่ง `gl_jv` เข้าไป ไม่ต้องเปลี่ยนกิ่งของ PR/PO/SR

`update` ที่ไม่ได้ส่ง `data` แต่เปิด `is_active` → ใช้ `jv_scope` จาก `workflow.data` ที่เก็บไว้ตรวจ

- [ ] **Step 4: เพิ่ม endpoint `journal-voucher` ใน gateway** ตาม Interfaces (ลอก decorator/swagger ของ `store-requisition`) และแก้ข้อความ description ของ endpoint "ทุกชนิด" (~L552) ที่เขียนว่า "all three types" ให้รวม journal voucher

- [ ] **Step 5: type-check + lint**

Run: `cd packages/error-catalog && bun run check-types && cd ../../apps/micro-business && bun run check-types && bun run lint && cd ../backend-gateway && bun run check-types && bun run lint`
Expected: ไม่มี error

- [ ] **Step 6: ตรวจด้วยมือ (local stack, BU T02, `admin@zebra.com`)**

curl สร้าง workflow `gl_jv` A `data.jv_scope = {prefix_ids: [<GJ id>], sources: []}` → 200; สร้าง B `{prefix_ids: [], sources: ["recurring"]}` → 422 `WORKFLOW_JV_SCOPE_OVERLAP` ข้อความมีชื่อ A;
สร้าง B แบบ `is_active: false` → 200 แล้ว PATCH เปิด active → 422; ส่ง `sources: ["ap"]` → 422 `WORKFLOW_JV_SCOPE_INVALID`; `GET …/workflows/journal-voucher` → เห็น A
(dev DB ใช้ร่วมกัน — ลบ workflow ทดสอบทิ้งหลังตรวจ)

- [ ] **Step 7: Commit**

```bash
git add packages/error-catalog apps/micro-business/src/gl/gl-jv/workflow/gl-jv-workflow-scope.ts apps/micro-business/src/master/workflows/workflows.service.ts apps/backend-gateway/src/config/config_workflows/config_workflows.controller.ts
git commit -m "feat(workflow): ขอบเขต workflow ของ JV ตาม prefix และที่มา พร้อมกฎห้ามทับ"
```

### Task 2: submit / reverse เลือก workflow ตามขอบเขต + ผูก reversal ตอน post

**Files:**
- Modify: `apps/micro-business/src/gl/gl-jv/gl-jv.service.ts` (ลบ `resolveJvWorkflowId` ส่วนตัว ~L381, แก้ `submit` ~L448-455)
- Modify: `apps/micro-business/src/gl/gl-posting/gl-posting.service.ts` (`reverse` ~L669, `reverseInTx` ~L712, `postReversal` ~L772, `postInTx` ~L404)
- Modify: `apps/micro-business/src/gl/gl-posting/gl-posting.controller.ts` (~L65)

**Interfaces:**
- Consumes: `scopeKeyForJv`, `resolveJvWorkflowId` จาก Task 1
- Produces: `GlPostingService.reverse(jvId: string, jvDate: Date, canPost: boolean, opts?: { viaWorkflow?: boolean }): Promise<Result<unknown>>` — default `viaWorkflow: false`

- [ ] **Step 1: `submit` ใช้ resolver กลาง**

`const workflowId = await resolveJvWorkflowId(this.prismaService, await scopeKeyForJv(this.prismaService, header))` แล้วส่ง `workflow_id: workflowId` เข้า `glJvToWorkflowDocument` (ไม่ใช้ `header.workflow_id ?? …` อีก — submit ใหม่หลัง reject ต้อง resolve ใหม่). ลบเมธอด private เดิม

- [ ] **Step 2: manual reverse ผ่าน workflow**

ใน `reverse()`: เพิ่ม `prefix_id` ใน `select` ของ `origin`; เมื่อ `opts.viaWorkflow` และ `resolveJvWorkflowId(db, { prefix_id: origin.prefix_id, source: enum_gl_jv_source.reversal })` ได้ค่า → บังคับ `canPost = false` (ได้ draft ผ่านกิ่ง `!canPost` เดิม). controller ส่ง `{ viaWorkflow: true }`; `runDueAutoReversals` (~L1583) ไม่ส่ง

- [ ] **Step 3: กันกลับรายการซ้ำใน `reverseInTx`**

หลังเช็ค `jv_status !== posted || reversed_by_jv_id`: ถ้ามีแถว `tb_gl_jv_header` ที่ `reversal_of_jv_id = jvId`, `deleted_at = null`, `jv_status != void` อยู่แล้ว → `GL_JV_IMMUTABLE`

- [ ] **Step 4: ย้ายการผูก `reversed_by_jv_id` เข้า `postInTx`**

ใน `postInTx` หลังเขียน status `posted` สำเร็จ (ไม่ใช่กิ่ง `scheduled`): ถ้า `header.source === reversal && header.reversal_of_jv_id` → update ใบต้นทาง `reversed_by_jv_id = header.id` แบบเดียวกับใน `postReversal` ตอนนี้ (unique violation → `GL_JV_IMMUTABLE`; ถ้าใบต้นทางไม่ใช่ `posted` แล้ว → `GL_JV_IMMUTABLE`). ลบบล็อกเดียวกันออกจาก `postReversal` เพื่อไม่ให้เขียนซ้ำ. ผลคือทุกเส้นทาง post (กดเอง, approve ขั้นสุดท้าย, `runDueJobs` ที่ post ใบตั้งเวลา, submit ที่ไม่มี workflow) ผูกใบต้นทางเหมือนกัน — ตรวจว่า trigger `gl_jv_posted_guard` ยอมให้แก้ `reversed_by_jv_id` บนแถว posted (ตอนนี้ `postReversal` ทำอยู่แล้วจึงควรผ่าน)

- [ ] **Step 5: type-check + lint** — คำสั่งเดียวกับ Task 1 ขั้น 5 (micro-business) แล้วรัน spec ที่มีอยู่ของ `gl-posting` / `gl-jv` (`bun test` ในไฟล์ `*.spec.ts` ของสองโฟลเดอร์) — ต้องเขียวเท่าเดิม; ถ้า spec เดิมพังเพราะพฤติกรรมเปลี่ยนตั้งใจ (เช่น `postReversal` ไม่ผูกเองแล้ว) ให้แก้ spec ตัวนั้นให้ตรงพฤติกรรมใหม่

- [ ] **Step 6: ตรวจด้วยมือ**

ด้วย workflow A จาก Task 1 (prefix GJ, ทุก source):
- JV manual prefix GJ → submit → `in_review`, `workflow_id = A`; prefix อื่น → submit → `posted` ทันที
- reject ใบ GJ → แก้ prefix เป็นตัวอื่น → submit → `posted` (ไม่ติด A)
- reverse ใบ GJ ที่ posted (ผู้ใช้มีสิทธิ์ post) → ได้ใบ reversal `draft`; reverse ซ้ำ → `GL_JV_IMMUTABLE`; submit ใบ reversal → `in_review`; approve จนจบ → ใบต้นทางมี `reversed_by_jv_id`
- ปิด workflow A ทั้งหมด → submit ใบ GJ ใหม่ → `posted` ทันที

- [ ] **Step 7: Commit**

```bash
git add apps/micro-business/src/gl
git commit -m "feat(gl-jv): เลือก workflow ตามขอบเขตตอน submit/reverse และผูกใบกลับรายการตอน post"
```

### Task 3: JV detail ส่ง role + stage_actions + ข้อมูล workflow

**Files:**
- Modify: `apps/micro-business/src/gl/gl-jv/gl-jv.service.ts` (`findOne` ~L58)
- Modify: `apps/micro-business/src/gl/gl-jv/dto/gl-jv.serializer.ts` (`GlJvResponseSchema` ~L45)
- Modify: `apps/backend-gateway/src/common/dto/gl-jv/gl-jv.serializer.ts` (~L57) + swagger response ของ gl-jv ถ้ามี field list

**Interfaces:**
- Produces (detail response เพิ่ม): `role: string` (ค่าจาก `resolveUserRole`), `stage_actions: { approve: boolean; reject: boolean; sendback: boolean } | null`, `workflow_name`, `workflow_previous_stage`, `workflow_next_stage`, `workflow_history` (array `{action, at, user, current_stage, next_stage?}`)

- [ ] **Step 1: `findOne` คำนวณ role / stage_actions** แบบเดียวกับ `purchase-order.service.ts:575-592`:
`resolveUserRole(row.jv_status === draft, row.created_by_id === this.userId, row.workflow_id, row.workflow_current_stage, row.user_action, this.userId, this.bu_code)` และ `resolveStageActionFlags(row.workflow_id, row.workflow_current_stage, this.userId, this.bu_code)`; ใบที่ไม่มี `workflow_id` → `stage_actions: null`

- [ ] **Step 2: เพิ่ม field ใน serializer ทั้งสองฝั่ง** (micro + gateway — ขาดฝั่งใดฝั่งหนึ่ง zod จะตัดทิ้งเงียบ ๆ)

- [ ] **Step 3: type-check + lint** (micro-business + backend-gateway)

- [ ] **Step 4: ตรวจด้วยมือ** — `GET …/gl-jv/:id` ของใบ `in_review` ด้วยผู้อนุมัติ → `role: "approve"`, `stage_actions.approve: true`; ด้วยผู้สร้าง → role ไม่ใช่ approve; ใบที่ไม่มี workflow → `stage_actions: null`; ใบ `in_review` ขึ้นในคิวรออนุมัติของผู้อนุมัติ ("My pending" / ส่วนนับใบค้างของ `gl_jv` ใน `workflows.service.ts` ~L783/L923) — ถ้าไม่ขึ้น แก้ให้ขึ้นใน task นี้

- [ ] **Step 5: Commit**

```bash
git add apps/micro-business/src/gl/gl-jv apps/backend-gateway/src/common/dto/gl-jv apps/backend-gateway/src/application/gl-jv
git commit -m "feat(gl-jv): ส่ง role, stage_actions และข้อมูล workflow ในรายละเอียด JV"
```

---

## ส่วน B — frontend (`carmen-frontend`, branch `feature/jv-workflow-by-type` มีอยู่แล้ว)

### Task 4: ชนิด workflow "Journal Voucher" ในหน้า `/system-admin/workflow`

**Files:**
- Modify: `types/workflows.ts` (enum + ชนิดของ `data`)
- Modify: `constant/workflow.ts`, `hooks/use-workflow.ts` (L15-30), `routes/router.tsx` (~L784-797), `constant/module-list.ts` (~L829)
- Modify: `routes/system-admin/workflow/wf-role-colors.ts`, `wf-structure-lock-notice.tsx`, `wf-form-schema.ts`, `wf-detail.tsx`, `wf-routing.tsx` (หรือ `wf-routing-constants.ts`)
- Create: `routes/system-admin/workflow/wf-jv-scope.tsx`
- Move: `routes/accounting/shared/use-gl-jv-prefix-options.ts` → `hooks/use-gl-jv-prefix-options.ts` (แก้ import ใน `routes/accounting/jv-template/jv-template-header-fields.tsx`)
- Modify: `lib/error-message.ts` (`APP_CODE_TO_KEY`), `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: endpoint `GET /api/config/:bu/workflows/journal-voucher`, error codes จาก Task 1
- Produces: `WORKFLOW_TYPE.JV = "gl_jv"`; `WorkflowDocType` เพิ่ม `"journal-voucher"`; `data.jv_scope?: { prefix_ids: string[]; sources: JvWorkflowSource[] }`;
  `export const JV_WORKFLOW_SOURCES = ["manual","recurring","allocation","amortize","reversal","closing"] as const` (วางใน `constant/workflow.ts`);
  `useGlJvPrefixOptions()` คืน option เพิ่ม `isActive: boolean`

- [ ] **Step 1: ชนิดและค่าคงที่** — เพิ่ม `JV` ใน `WORKFLOW_TYPE`, `workflowTypeField`, `WF_ROW_TYPE`, `WORKFLOW_TYPES` (i18nKey `typeJournalVoucher`), `WF_TYPE_I18N_KEY`; `WORKFLOW_DOC_TYPES` + `WORKFLOW_TYPE_BY_DOC_TYPE` (`"journal-voucher" → JV`). รัน `bun run typecheck` — ทุก `Record<WORKFLOW_TYPE, …>` ที่แดงคือจุดที่ต้องเติม: `ROLES_BY_WORKFLOW_TYPE[JV] = ["create","approve"]`, `DOCUMENT_LIST[JV] = { path: "/accounting/journal-voucher", status: "in_review" }` (ตรวจรูปแบบ status ที่ตัวอื่นใช้แล้วทำให้ลิงก์กรองหน้า JV list ด้วย `jv_status=in_review` ได้)

- [ ] **Step 2: route + เมนู** — `workflow/journal-voucher` ชี้ `workflow-doc-type.route` (ก่อน `workflow/:id`); submenu `workflowJournalVoucher` ต่อจาก store-requisition ด้วย `licenseFeature`/`permission` เดียวกับพี่น้อง

- [ ] **Step 3: ย้าย `useGlJvPrefixOptions` ไป `hooks/`** และเพิ่ม `isActive` จาก `row.is_active` (query key/cache เดิมห้ามเปลี่ยน)

- [ ] **Step 4: schema ฟอร์ม** — เพิ่ม `jv_scope: z.object({ prefix_ids: z.array(z.string()), sources: z.array(z.enum(JV_WORKFLOW_SOURCES)) }).optional()` ใน `wfFormSchema.shape.data` (ต้องประกาศ ไม่งั้น zod ตัดทิ้งแล้ว PUT ทับขอบเขตหายเงียบ ๆ — ดูคอมเมนต์ `inherit_signature_from_pr`); default ของ JV = `{ prefix_ids: [], sources: [] }`

- [ ] **Step 5: แท็บขอบเขต `wf-jv-scope.tsx`** — `export function WfJvScope({ form }: { form: UseFormReturn<WfFormValues> })`:
multi-select prefix จาก `useGlJvPrefixOptions()` (prefix ที่ `isActive=false` แต่อยู่ใน `prefix_ids` ยังแสดงพร้อมป้าย "ไม่ใช้งาน"), checkbox 6 ที่มา, ข้อความใต้แต่ละกลุ่ม "ไม่เลือก = ทุก …" และบรรทัดสรุปว่าใบแบบไหนจะเข้า workflow นี้. ใช้ primitive ใน `components/ui/` ตาม `docs/DESIGN.md` อ่านออกทั้ง light/dark

- [ ] **Step 6: `wf-detail.tsx`** — เมื่อ `workflow_type === JV`: ซ่อนแท็บ `products` แสดงแท็บ `scope` (`WfJvScope`) แทน; `WfScopeLine` ของ JV แสดงจำนวน prefix/ที่มา แทนจำนวนสินค้า (`wf-scope-line.tsx`)

- [ ] **Step 7: routing ของ JV** — field เงื่อนไขเหลือ `total_amount` อย่างเดียว (`department`/`category` ไม่มีความหมายกับ JV — mapper ส่ง department เป็น null)

- [ ] **Step 8: error + คำแปล** — `APP_CODE_TO_KEY`: `WORKFLOW_JV_SCOPE_OVERLAP → "workflowJvScopeOverlap"`, `WORKFLOW_JV_SCOPE_INVALID → "workflowJvScopeInvalid"`; เพิ่มคีย์ใน `errors` ทั้ง en/th (ไม่ใส่ placeholder), คีย์ `typeJournalVoucher`, เมนู `workflowJournalVoucher`, และข้อความของแท็บขอบเขตใน namespace `systemAdmin.workflow`

- [ ] **Step 9: type-check + lint** — `bun run typecheck && bun run lint` ไม่มี error; `bun test:run routes/system-admin/workflow` เขียวเท่าเดิม

- [ ] **Step 10: ตรวจด้วยมือ (browser, `VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev`, BU T02)** — เมนู Workflow มี Journal Voucher; สร้าง workflow JV, ตั้งขอบเขต, บันทึก, reload แล้วขอบเขตยังอยู่; สร้างตัวที่สองให้ทับ → ข้อความทับพร้อมชื่อ (จาก toast/ข้อความเฉพาะ); stage เลือก role ได้แค่ create/approve; หน้า PR/PO/SR workflow ยังทำงานเหมือนเดิม

- [ ] **Step 11: Commit**

```bash
git add types/workflows.ts constant hooks routes/router.tsx routes/system-admin/workflow routes/accounting/jv-template/jv-template-header-fields.tsx routes/accounting/shared lib/error-message.ts messages
git commit -m "feat(workflow): ตั้ง workflow ของ JV ได้ พร้อมแท็บขอบเขต prefix และที่มา"
```

### Task 5: หน้า JV — อนุมัติ / ตีกลับ / แถบขั้นจริง

**Files:**
- Modify: `types/journal-voucher.ts` (`JournalVoucherStatus` L1-10, `JournalVoucher` ~L94-115)
- Modify: `routes/accounting/journal-voucher/journal-voucher-source.ts` (`journalVoucherCapabilities` ~L67)
- Modify: `routes/accounting/journal-voucher/journal-voucher-mock-repository.ts` (ให้ compile กับสถานะใหม่)
- Modify: `routes/accounting/documents/accounting-document-detail.tsx` (~L276-291 hooks, ~L1730-1775 แถบขั้น hardcode, แถบปุ่ม header/footer)
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: detail fields จาก Task 3; `useJournalVoucherAction("approve" | "reject")` ที่มีอยู่ (`use-journal-voucher.ts:124`); `StageActionFlags`/`getStageActionFlags` จาก `lib/workflow-stage-actions.ts`; `STAGE_ROLE` จาก `types/stage-role`; `WorkflowTrack` จาก `components/share/workflow-track`
- Produces: `JournalVoucherStatus = "draft" | "in_review" | "scheduled" | "posted" | "void"`; capabilities `can_approve` / `can_reject` ใหม่

- [ ] **Step 1: ชนิด** — `JournalVoucherStatus` ให้ตรง `enum_jv_status` (ดู learning 2026-11-04 jv_status); เพิ่ม `workflow_id`, `workflow_name`, `workflow_current_stage`, `workflow_previous_stage`, `workflow_next_stage`, `workflow_history`, `role?: string`, `stage_actions?: StageActionFlags | null`. แก้ทุกจุดที่ `typecheck` แดงจากสถานะเก่า (`submitted`, `post_failed`, `voided`, …)

- [ ] **Step 2: capabilities** — `can_submit`: draft และไม่ใช่ source-generated; `can_approve`: `in_review && role === STAGE_ROLE.APPROVE && getStageActionFlags(stage_actions).approve`; `can_reject`: เหมือนกันแต่ `.reject`; ตัด `can_return` / `can_retry_post` และเลิกใช้ `workflow_enabled_snapshot` (แก้ผู้เรียกที่ตามมา)

- [ ] **Step 3: แถบขั้นจริง** — แทนบล็อก hardcode (~L1730-1775) ด้วย `WorkflowTrack` ที่รับ `workflow_previous_stage` / `workflow_current_stage` / `workflow_next_stage` ของใบ; `hasWorkflowApproval` ของ JV = `Boolean(journal?.workflow_id)` (ไม่มี workflow = ไม่แสดง)

- [ ] **Step 4: ปุ่มอนุมัติ / ตีกลับ** — แสดงเมื่อ capability เป็น true: "อนุมัติ" เป็นปุ่มหลัก (ตามกฎปุ่มหลักตัวเดียวต่อหน้า — ตอน `in_review` ไม่มี Save/Submit จึงไม่ชน), "ตีกลับ" เปิด dialog กรอกเหตุผล (ไม่บังคับ) แล้วส่ง `reason`; ส่ง `doc_version` ตามที่ repository ต้องการ; สำเร็จ → invalidate query ของใบ + toast

- [ ] **Step 5: ข้อความหลัง submit / reverse** — submit แล้วได้ `posted` → "ลงบัญชีแล้ว", ได้ `in_review` → "ส่งอนุมัติแล้ว"; reverse แล้วได้ `jv_status: "draft"` → toast "สร้างใบกลับรายการเป็นฉบับร่าง รอส่งอนุมัติ" แล้วพาไปหน้าใบใหม่ (`id` ในผลลัพธ์)

- [ ] **Step 6: type-check + lint** — `bun run typecheck && bun run lint`; `bun test:run routes/accounting` เขียวเท่าเดิม (แก้ test เดิมที่อ้างสถานะเก่าให้ตรงชนิดใหม่ได้ ไม่เพิ่มไฟล์ test ใหม่)

- [ ] **Step 7: ตรวจด้วยมือ (browser)** — ด้วย workflow A: สร้าง JV GJ → submit → เห็นแถบขั้นและสถานะ in_review; สลับเป็นผู้อนุมัติ → เห็นปุ่มอนุมัติ/ตีกลับ → อนุมัติจน posted; ตีกลับอีกใบ → กลับเป็น draft; ผู้สร้างไม่เห็นปุ่มอนุมัติ; JV prefix อื่น → submit แล้ว posted ทันที ไม่มีแถบขั้น; reverse ใบ GJ → ได้ draft และไปหน้าใบใหม่; dark mode อ่านออก; หน้า 375px ไม่ล้น

- [ ] **Step 8: Commit**

```bash
git add types/journal-voucher.ts routes/accounting messages
git commit -m "feat(accounting): หน้า JV อนุมัติ/ตีกลับตาม workflow และแสดงขั้นจริง"
```

---

## Deploy (หลัง merge — ไม่ใช่ส่วนของ task)

1. deploy backend (micro-business + gateway) — ไม่มี migration
2. เติม allowlist `workflow.findAllJournalVoucher` ทุก env ที่ไม่ใช่ `allow_all`
3. deploy FE (`vercel --prod` จากเครื่อง ตาม skill `release-and-deploy`)
