# Workflow Available Actions Enforcement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ checkbox Approve / Reject / Send back ของ workflow stage มีผลจริง — BE ปฏิเสธ action ที่ปิด, FE ไม่เสนอทางเลือกที่จบด้วย action ที่ปิด (PR/PO/SR)

**Architecture:** BE เพิ่ม guard `assertStageActionAllowed` ใน `WorkflowOrchestratorService` ที่ logic ของ PR/PO/SR เรียก **ก่อน** `build*Workflow` (opt-in โดยการเรียก — AP ไม่เรียก จึงไม่โดน) และส่ง flag `stage_actions` ไปกับ detail ของเอกสาร FE อ่าน flag ผ่าน helper กลางแล้วคุมปุ่ม bulk + ปุ่มท้ายใบ

**Tech Stack:** NestJS microservices + Prisma + zod serializer (BE) · React 19 + react-hook-form + next-intl-style messages (FE)

**Spec:** `docs/superpowers/specs/2026-10-21-workflow-available-actions-enforcement-design.md`

**รีโป / branch:** `feature/workflow-available-actions` ทั้งสองรีโป
- BE = `/Users/samutpra/GitHub/carmensoftware-organize/carmen-turborepo-backend-v2` (สร้าง branch จาก `main`)
- FE = `/Users/samutpra/GitHub/carmensoftware-organize/carmen-inventory-frontend-react` (branch มีแล้ว — **อย่า commit `package.json`** ที่ค้างอยู่)

## Global Constraints

- **ไม่เขียนเทสต์ใหม่** (ความชอบของผู้ใช้) — ทุก task จบด้วย typecheck + lint; เทสต์ชุดเดิมของไฟล์ที่แตะต้องผ่าน
- commit message ภาษาไทย (conventional prefix อังกฤษ เช่น `feat(workflow): …`)
- ขอบเขต role: guard ทำงานเฉพาะ stage ที่ role เป็น `approve` · `purchase` · `issue`
- map endpoint → checkbox: approve → `approve` · reject → `reject` · review → `sendback`
- **ค่าที่ไม่มี = เปิด**: stage ไม่มี `available_actions` / ไม่มี key / หา stage ไม่เจอ / RPC ล้ม → ยอมผ่าน · FE ไม่ได้รับ `stage_actions` → เปิดทั้งหมด
- **ไม่แตะ AP** (`ap-invoice.service.ts`, `ap-payment.service.ts`) และไม่แตะ Submit ของ stage create
- กติกา reject: Approve เปิด → reject **บางรายการ**ได้เสมอ · reject **ครบทุกรายการ**ต้องมี Reject เปิด
- dev DB (`:4000`) เป็นของกลาง — แก้ workflow เพื่อทดสอบแล้วต้องคืนค่า

## Review Focus

1. **Swipe-approve / swipe-reject แบบหลายใบ** — ใบที่ action ปิดต้องล้มเฉพาะใบนั้น ใบอื่นใน batch ต้องผ่านตามปกติ (Task 2)
2. **เอกสารที่ stage ถูก rename/ลบหลังส่ง** — guard ต้องยอมผ่าน ไม่ใช่ 500/404 (Task 1)
3. **Reject ปิด + เลือกทุกแถวแล้วกด bulk Reject** — ต้องกดไม่ได้ พร้อมบอกเหตุผล ไม่ใช่ค้างเงียบ; แถวที่ถูก reject มาจาก stage ก่อนนับรวมด้วย (Task 5–7)
4. **BE เก่า + FE ใหม่** (deploy ไม่พร้อมกัน) — detail ไม่มี `stage_actions` ปุ่มต้องเหมือนเดิมทุกปุ่ม (Task 4)
5. **ผู้ใช้ view_only** — ได้ `stage_actions` มาแต่ไม่มีปุ่มอยู่แล้ว ต้องไม่โผล่ปุ่มใหม่เพราะ flag (Task 5–7: flag ใช้ AND กับเงื่อนไข role เดิมเสมอ)

---

## BE (carmen-turborepo-backend-v2)

### Task 1: Error catalog + guard + flag resolver ใน orchestrator

**Files:**
- Modify: `packages/error-catalog/src/catalog.ts` (ต่อท้าย `WORKFLOW_STAGE_NOT_FOUND` ~:3055)
- Modify: `apps/micro-business/src/common/workflow/workflow-orchestrator.service.ts` (`fetchStageRole` :423, เพิ่ม method ใหม่ในส่วน public)
- Modify: `apps/micro-business/src/common/workflow/workflow.types.ts` (export type ใหม่)

**Interfaces:**
- Produces:
  - `type StageActionKey = 'approve' | 'reject' | 'sendback'` (workflow.types.ts)
  - `interface StageActionFlags { approve: boolean; reject: boolean; sendback: boolean }` (workflow.types.ts)
  - `WorkflowOrchestratorService.assertStageActionAllowed(document: WorkflowDocument, action: StageActionKey, userId: string, buCode: string): Promise<void>` — throw เมื่อปิด
  - `WorkflowOrchestratorService.resolveStageActionFlags(workflowId: string | null, currentStage: string | null, userId: string, buCode: string): Promise<StageActionFlags | null>`
  - `ERROR_CATALOG.WORKFLOW_STAGE_ACTION_DISABLED`

- [ ] **Step 1: เพิ่ม catalog entry**

```ts
WORKFLOW_STAGE_ACTION_DISABLED: {
  code: 'WORKFLOW_STAGE_ACTION_DISABLED',
  id: makeId(MODULE.WORKFLOW, 7),
  http_status: 422,
  message_en: 'Action "{action}" is turned off for stage {stage} in this workflow',
  message_th: 'stage {stage} ไม่เปิดให้ทำ "{action}" ใน workflow นี้',
},
```
ตรวจก่อนว่า `makeId(MODULE.WORKFLOW, 7)` ยังไม่มีใครใช้

- [ ] **Step 2: แยก `private fetchStageDetail(workflowId, stage, userId, buCode): Promise<{ role?: enum_stage_role; available_actions?: Record<string, { is_active?: boolean }> } | null>`**

ยก RPC `Workflows.getWorkflowStageDetail` ออกจาก `fetchStageRole` มาไว้ที่นี่ (คืน `callResult.data ?? null`, catch → `null`) แล้วให้ `fetchStageRole` เรียกตัวนี้ พฤติกรรม/cache ของ `fetchStageRole` ต้องเหมือนเดิมทุกประการ

- [ ] **Step 3: `resolveStageActionFlags`**

`workflowId`/`currentStage` ว่าง หรือ detail เป็น `null` → คืน `null` · ไม่งั้นคืน flag สามตัว โดยแต่ละตัว = `available_actions?.[key]?.is_active !== false` (ไม่มีค่า = เปิด)

- [ ] **Step 4: `assertStageActionAllowed`**

ดึง detail ของ `document.workflow_current_stage` (ไม่มี `workflow_id`/stage หรือ detail `null` → return) · role ไม่อยู่ใน `{approve, purchase, issue}` → return · `available_actions?.[action]?.is_active === false` → `throw Result.errorFromCatalog(ERROR_CATALOG.WORKFLOW_STAGE_ACTION_DISABLED, { action, stage }).error` (pattern เดียวกับ `good-received-note.ledger.ts:395`)
JSDoc สองภาษาแบบเดียวกับ method อื่นในไฟล์ ระบุว่า AP ไม่เรียก method นี้โดยตั้งใจ

- [ ] **Step 5: ตรวจ**

Run: `cd packages/error-catalog && bun run build` (ถ้ามี script build) แล้ว `cd apps/micro-business && bunx tsc --noEmit -p . && bunx eslint src/common/workflow/workflow-orchestrator.service.ts src/common/workflow/workflow.types.ts`
Run: `bunx jest src/common/workflow` (เทสต์เดิมของ orchestrator ต้องผ่าน)
Expected: ไม่มี error

- [ ] **Step 6: Commit** — `feat(workflow): เพิ่ม guard ตรวจ available actions ของ stage ใน orchestrator`

### Task 2: เรียก guard ใน PR / PO / SR logic

**Files:**
- Modify: `apps/micro-business/src/procurement/purchase-request/logic/purchase-request.logic.ts` (:620 approve, :729 swipeApprove, :804 reject, :892 swipeReject, :947 review)
- Modify: `apps/micro-business/src/procurement/purchase-order/purchase-order.logic.ts` (:418 approve, :554 reject, :609 review)
- Modify: `apps/micro-business/src/inventory/store-requisition/logic/store-requisition.logic.ts` (:351 approve/issue, :652 reject, :702 review)

**Interfaces:**
- Consumes: `assertStageActionAllowed` (Task 1)

- [ ] **Step 1: ใส่ `await this.workflowOrchestrator.assertStageActionAllowed(<doc>, '<action>', user_id, tenant_id)` ก่อน `build*Workflow` ทุกจุด** — `<doc>` คือ WorkflowDocument ตัวเดียวกับที่ส่งเข้า build (เช่น `prToWorkflowDocument(purchaseRequestData)`) — คำนวณครั้งเดียวแล้วใช้ซ้ำ
  - swipe (PR :729, :892): วางไว้**ภายใน**ขอบเขต try/ผลต่อใบของ loop เดิม เพื่อให้ใบที่ถูกปฏิเสธลงผลเป็น error ของใบนั้น ไม่ล้มทั้ง batch (Review Focus 1) — อ่านโครง loop ก่อนแล้ววางให้ตรง pattern error ต่อใบที่มีอยู่
  - grep ซ้ำ `buildApproveWorkflow\|buildRejectWorkflow\|buildReviewWorkflow` ใน `procurement/` และ `inventory/store-requisition/` หลังแก้ — ทุกจุดต้องมี guard นำหน้า (และไม่มีจุดใน `ap/`)
- [ ] **Step 2: ตรวจ** — `bunx tsc --noEmit -p .` + `bunx eslint <3 ไฟล์>` + `bunx jest src/procurement/purchase-request src/procurement/purchase-order src/inventory/store-requisition` (spec เดิมที่ mock orchestrator อาจต้องเพิ่ม `assertStageActionAllowed: jest.fn()` ใน mock — แก้ mock ได้ ไม่เพิ่ม test case)
- [ ] **Step 3: Commit** — `feat(workflow): PR/PO/SR ปฏิเสธ approve/reject/send back ที่ stage ปิดไว้`

### Task 3: ส่ง `stage_actions` ไปกับ detail

**Files:**
- Modify: `apps/micro-business/src/procurement/purchase-request/purchase-request.service.ts:242` · `apps/micro-business/src/procurement/purchase-order/purchase-order.service.ts:569` · `apps/micro-business/src/inventory/store-requisition/store-requisition.service.ts:200` (เฉพาะ findById — **ไม่ใช่** :402 / :2695 ซึ่งเป็น list/อื่น)
- Modify serializer micro: `…/purchase-request/dto/purchase-request.serializer.ts:121`, `…/purchase-order/dto/purchase-order.serializer.ts:115`, `…/store-requisition/dto/store-requisition.serializer.ts:51`
- Modify serializer gateway: `apps/backend-gateway/src/common/dto/{purchase-request,purchase-order,store-requisition}/*.serializer.ts` (ข้าง `role`)

**Interfaces:**
- Consumes: `resolveStageActionFlags` (Task 1)
- Produces (สัญญากับ FE): detail ของ PR/PO/SR มีฟิลด์ `stage_actions: { approve: boolean; reject: boolean; sendback: boolean } | null`
  *ส่งเป็น flag ไม่ใช่ `available_actions` ทั้งก้อน — ก้อนจริงมี recipients/notification config ที่ FE เอกสารไม่ต้องรู้ (ปรับจาก spec ข้อ BE-3 — การตัดสินของ Claude)*

- [ ] **Step 1:** เรียก `resolveStageActionFlags(res.workflow_id, res.workflow_current_stage, this.userId, this.bu_code)` ข้าง `resolveUserRole` แล้วใส่ `stage_actions` ใน object ที่ parse (เรียกแค่ใน detail — list ไม่ต้อง)
- [ ] **Step 2:** zod ทั้ง 6 ไฟล์: `stage_actions: z.object({ approve: z.boolean(), reject: z.boolean(), sendback: z.boolean() }).nullable().optional()` (ต้องครบทั้ง micro **และ** gateway ไม่งั้นฟิลด์หายเงียบ)
- [ ] **Step 3: ตรวจ** — tsc + eslint ทั้ง `apps/micro-business` และ `apps/backend-gateway`; รัน BE local แล้ว curl detail PR ของ T02 (บัญชี `admin@zebra.com` ตาม memory test accounts) เห็น `stage_actions`
- [ ] **Step 4: ตรวจ guard จริง (curl)** — บน workflow ทดสอบของ T02: ปิด `reject` ของ stage HOD ผ่านหน้า config → หา PR ที่ค้างอยู่ stage นั้น → `PATCH …/purchase-requests/{id}/reject` ต้องได้ 422 `WORKFLOW_STAGE_ACTION_DISABLED` · เปิดคืนแล้วยิงซ้ำต้องไม่ติด guard · **คืนค่า workflow ทุกครั้ง**
- [ ] **Step 5: Commit** — `feat(workflow): ส่ง stage_actions ไปกับรายละเอียด PR/PO/SR`
- [ ] **Step 6:** push + เปิด PR (ภาษาอังกฤษ) ระบุ deploy ก่อน FE

---

## FE (carmen-inventory-frontend-react)

### Task 4: type + helper + ข้อความ error

**Files:**
- Create: `lib/workflow-stage-actions.ts`
- Modify: `types/purchase-request.ts:153`, `types/purchase-order.ts:223`, `types/store-requisition.ts:52` (ข้าง `role`)
- Modify: `messages/en.json`, `messages/th.json` (`errors.byCode` และข้อความเตือนใหม่)

**Interfaces:**
- Produces:
  - `interface StageActionFlags { approve: boolean; reject: boolean; sendback: boolean }` (export จาก `lib/workflow-stage-actions.ts`)
  - type detail ทั้งสาม: `stage_actions?: StageActionFlags | null`
  - `getStageActionFlags(raw: StageActionFlags | null | undefined): StageActionFlags` — `null`/`undefined` → `{ approve: true, reject: true, sendback: true }`
  - `wouldRejectAll(statuses: readonly string[], rejectIndices: readonly number[], isReject: (s: string) => boolean): boolean` — true เมื่อหลังตั้งแถว `rejectIndices` เป็น reject แล้ว **ทุกแถว** เป็น reject (แถวที่ reject อยู่แล้วนับด้วย) และมีอย่างน้อย 1 แถว
  - i18n: `errors.byCode.WORKFLOW_STAGE_ACTION_DISABLED` · `common.rejectAllNotAllowed` (ข้อความเตือน)

- [ ] **Step 1:** เขียน helper ทั้งสองตามสัญญาข้างบน (ไม่ import จาก `routes/` — ESLint boundary)
- [ ] **Step 2:** i18n — ห้ามมี `{}` หรือ `<คำ>` ในข้อความ (memory: ICU พังทั้งหน้า)
  - en `WORKFLOW_STAGE_ACTION_DISABLED`: "This workflow stage doesn't allow that action anymore. Refresh to see the current options."
  - th: "stage นี้ของ workflow ไม่เปิดให้ทำ action นี้แล้ว รีเฟรชหน้าเพื่อดูตัวเลือกล่าสุด"
  - en `rejectAllNotAllowed`: "This stage can't reject the whole document. Keep at least one item approved."
  - th: "stage นี้ปัดตกทั้งใบไม่ได้ ต้องอนุมัติไว้อย่างน้อย 1 รายการ"
- [ ] **Step 3:** `bun run typecheck && bunx eslint lib/workflow-stage-actions.ts`
- [ ] **Step 4: Commit** — `feat(workflow): helper อ่าน stage_actions ของเอกสาร`

### Task 5: PR

**Files:**
- Modify: `routes/procurement/purchase-request/pr-form.tsx` (:296 `PrFooterAction`, :325 `PrItemFields` — ส่ง `stageActions`)
- Modify: `routes/procurement/purchase-request/pr-item-fields.tsx` (`canBulkAction` :212, ปุ่ม :402–435)
- Modify: `routes/procurement/purchase-request/workflow/pr-footer-action.tsx` (:89–105, :181–297)

**Interfaces:**
- Consumes: `getStageActionFlags`, `wouldRejectAll`, `StageActionFlags` (Task 4)
- Produces: prop ใหม่ `stageActions: StageActionFlags` บน `PrItemFields` และ `PrFooterAction` (ค่าที่ผ่าน `getStageActionFlags` แล้ว คำนวณครั้งเดียวที่ `pr-form.tsx` จาก `purchaseRequest?.stage_actions`)

- [ ] **Step 1 — bulk:** ปุ่ม Approve แสดงเมื่อ `canBulkAction && stageActions.approve` · Review เมื่อ `… && stageActions.sendback` · Reject แสดงเมื่อ `canBulkAction && (stageActions.reject || stageActions.approve)` และ **disabled** เมื่อ `!stageActions.reject && wouldRejectAll(statuses, selectedIndices, isReject)` พร้อม `title`/tooltip = `rejectAllNotAllowed` (ใช้ tooltip ที่มีใน `components/ui/` ถ้ามี) · `isReject` ใช้นิยามเดียวกับ `pr-purchase-action.ts` (reject | rejected) · Split ไม่แตะ
- [ ] **Step 2 — footer:** AND flag เข้ากับเงื่อนไขเดิม: Approve/Purchase Approve ต้อง `stageActions.approve` · Reject ต้อง `stageActions.reject` · Send back ต้อง `stageActions.sendback` · คำนวณ `hasVisibleButton` ใหม่ให้ตรง · ถ้า `purchaseAction === "rejected" && !stageActions.reject` ให้แสดงข้อความ `rejectAllNotAllowed` (text ขนาด ladder เดิม, สี `text-warning-ink`) แทนปุ่ม
- [ ] **Step 3:** `bun run typecheck && bunx eslint routes/procurement/purchase-request && bun test:run routes/procurement/purchase-request`
- [ ] **Step 4: Commit** — `feat(pr): ซ่อนตัวเลือกอนุมัติ/ปัดตก/ส่งกลับที่ stage ปิดไว้`

### Task 6: PO

**Files:**
- Modify: `routes/procurement/purchase-order/po-form.tsx` (:249, :289)
- Modify: `routes/procurement/purchase-order/po-item-fields.tsx` (`canBulkAct` :196, ปุ่ม :279–323, `canApprove`/`canReject` :180–181)
- Modify: `routes/procurement/purchase-order/po-footer-action.tsx` (:115–131)

**Interfaces:** เหมือน Task 5 (prop `stageActions` บน `PoItemFields`, `PoFooterAction`; ต้นทาง `purchaseOrder?.stage_actions`)

- [ ] **Step 1:** bulk + footer ตามกติกาเดียวกับ Task 5 (isReject ตาม `computePoAction`)
- [ ] **Step 2:** `bun run typecheck && bunx eslint routes/procurement/purchase-order && bun test:run routes/procurement/purchase-order`
- [ ] **Step 3: Commit** — `feat(po): ซ่อนตัวเลือกอนุมัติ/ปัดตก/ส่งกลับที่ stage ปิดไว้`

### Task 7: SR

**Files:**
- Modify: `routes/store-operation/store-requisition/sr-form.tsx` (:250, :304 — `itemFieldsProps`)
- Modify: `routes/store-operation/store-requisition/sr-item-fields.tsx` (`canBulkAction` :158, ปุ่ม :194–224)
- Modify: `routes/store-operation/store-requisition/sr-footer.tsx` (:59–63, :111–169)

**Interfaces:** เหมือน Task 5 (ต้นทาง `storeRequisition?.stage_actions`) · ปุ่ม **Issue** ของ role issue ผูกกับ `stageActions.approve`

- [ ] **Step 1:** bulk + footer ตามกติกาเดียวกับ Task 5 (isReject ตาม `computeSrAction` ใน `sr-form-schema.ts`)
- [ ] **Step 2:** `bun run typecheck && bun run lint && bun test:run routes/store-operation/store-requisition`
- [ ] **Step 3: Commit** — `feat(sr): ซ่อนตัวเลือกอนุมัติ/ปัดตก/ส่งกลับ/จ่ายของที่ stage ปิดไว้`
- [ ] **Step 4:** push + เปิด PR (อังกฤษ) ระบุว่าต้อง deploy หลัง BE PR

### Task 8: ตรวจในเบราว์เซอร์ (ผู้ใช้ตรวจเอง / ช่วยตรวจถ้า Chrome เข้าถึง localhost ได้)

- [ ] FE ชี้ BE ที่มี Task 1–3 (`VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev`)
- [ ] ต่อโมดูล (PR, PO, SR): ปิดทีละ action ของ stage ทดสอบ → เปิดใบที่ค้าง stage นั้นด้วยผู้ใช้ของ stage → ปุ่ม bulk/ท้ายใบหายตามกติกา · Reject ปิด + เลือกครบทุกแถว → bulk Reject กดไม่ได้พร้อมเหตุผล · ตัดบางแถว + approve ที่เหลือ → ผ่าน
- [ ] ตรวจ dark mode + mobile ของข้อความเตือนใหม่
- [ ] คืนค่า workflow ทดสอบทั้งหมด

## ก่อน deploy prod (ไม่บล็อก dev)

query อ่านอย่างเดียวทุก tenant: stage ที่ role ∈ {approve, purchase, issue} และมี `available_actions.{approve|reject|sendback}.is_active = false` (ยกเว้น stage สุดท้าย) — ถ้าเจอ ต้องคุยกับ BU ก่อนเปิดใช้
