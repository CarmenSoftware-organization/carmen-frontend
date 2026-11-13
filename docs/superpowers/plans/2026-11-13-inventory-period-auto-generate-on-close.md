# Inventory Period Auto-Generate on Close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปิดงวดสต๊อกแล้วระบบเติมงวดเปิดให้ครบ 12 เดือนเอง และไม่มีทางแก้วันที่ของงวดทั้งจากหน้าจอและ API

**Architecture:** แยก logic เติมงวดของ `InventoryPeriodService.generateNextPeriods` เป็น helper ที่รับ Prisma client/transaction แล้วให้ `PeriodEndService.closeCurrent` เรียกใน transaction เดียวกับการปิดงวด ฝั่ง API ปฏิเสธการแก้วันที่/ปี/เดือนบัญชี และการสร้างงวดด้วยมือเมื่อมีงวดอยู่แล้ว ฝั่งหน้าเว็บลบ dialog เพิ่ม/แก้ ทำหน้าเป็นแบบดูอย่างเดียว

**Tech Stack:** NestJS + Prisma (`carmen-turborepo-backend/apps/micro-business`, `packages/error-catalog`) · Vite + React + TanStack Query + use-intl (`carmen-frontend`)

**Spec:** `docs/superpowers/specs/2026-11-13-inventory-period-auto-generate-on-close-design.md`

## Global Constraints

- จำนวนงวดเปิดเป้าหมาย = `12`, `start_day` = `1` (ค่าคงที่ชื่อ `OPEN_PERIOD_TARGET = 12` ฝั่ง BE)
- งวดใหม่: `start_at` = วันที่ 1 เที่ยงคืน UTC, `end_at` = วันสุดท้ายของเดือนเที่ยงคืน UTC, รหัส `YYMM`, สถานะ `open` — กติกาเดิมของตัวเติมงวด ห้ามเปลี่ยน
- "งวดเปิด" นับทั้ง `open` และ `locked`
- ไม่มี migration · ไม่มี `api_name` ใหม่ · ไม่มี endpoint ใหม่
- Deploy: BE ก่อน FE
- **ไม่เขียนเทสต์ใหม่** (ไม่สร้าง `*.spec.ts` / `*.test.ts`) — ตรวจด้วย type-check, lint และตรวจมือ แต่ spec เดิมที่มีอยู่ต้องยังผ่าน ถ้า spec เดิมแดงเพราะพฤติกรรมที่ตั้งใจเปลี่ยน ให้แก้ assertion ของ spec นั้น
- Branch: `feature/inventory-period-auto-next` ทั้งสองรีโป แตกจาก `main` · commit message ภาษาไทย · PR ภาษาอังกฤษ · ห้าม squash-merge ฝั่ง FE
- dev DB เป็นของร่วม — ตรวจมือบน BU `T02` เท่านั้น และ **ห้ามกดปิดงวดจริงโดยไม่ถามผู้ใช้ก่อน** (ย้อนไม่ได้)
- ไฟล์แปล FE (`messages/en.json`, `messages/th.json`) ห้ามมี `{{}}` หรือ `<คำ>` ที่ไม่ปิดแท็ก

## Review Focus

ไม่มีเทสต์ใหม่ในแผนนี้ ทุกข้อด้านล่างตรวจด้วยการอ่านโค้ดและตรวจมือใน Task ที่ระบุ

1. BU ที่มีงวดเปิดมากกว่า 12 อยู่แล้ว → ปิดงวดต้องสำเร็จ ไม่สร้างเพิ่ม ไม่ error (Task 1)
2. งวดที่จะสร้างชนกับงวดปิด/ลบที่มีรหัสหรือปี-เดือนเดียวกัน → ข้ามเดือนนั้นแล้วไปต่อ ไม่ทำ transaction ปิดงวดล้ม (Task 1 — พฤติกรรม skip เดิมต้องคงอยู่)
3. client เก่าส่ง `PATCH` ทั้งก้อนด้วยวันที่เดิม (รูป string ต่างจากที่เก็บ เช่นไม่มีมิลลิวินาที) → ต้องผ่าน เทียบด้วยค่าเวลา ไม่ใช่เทียบ string (Task 2)
4. BU ใหม่ที่ไม่มีงวดเลย → หน้าเว็บต้องพาไปปุ่ม "เติมรอบ" ได้ ไม่ติดตาย (Task 4)
5. เปิดหน้า Inventory Period ค้างไว้ แล้วปิดงวดจากหน้า Period End → กลับมาต้องเห็นงวดใหม่โดยไม่ต้อง refresh (Task 3)

---

### Task 1 (BE): แยกตัวเติมงวด แล้วเรียกตอนปิดงวด

**Files:**
- Create: `apps/micro-business/src/inventory/inventory-period.generate.helper.ts`
- Modify: `apps/micro-business/src/inventory/inventory-period/inventory-period.service.ts` (`generateNextPeriods`, ราว L510–674)
- Modify: `apps/micro-business/src/inventory/period-end/period-end.service.ts` (`closeCurrent`, ราว L301–430)

**Interfaces:**
- Produces:

```ts
export const OPEN_PERIOD_TARGET = 12;

export interface FillOpenPeriodsResult {
  existing_open_count: number;
  start_from: { fiscal_year: number; fiscal_month: number } | null; // null เมื่อไม่ต้องสร้าง
  created: { id: string; period: string; fiscal_year: number; fiscal_month: number; start_at: string; end_at: string }[];
  skipped: { period: string; reason: string }[];
  total_created: number;
  total_skipped: number;
}

// client = Prisma tenant client หรือ Prisma.TransactionClient
export async function fillOpenInventoryPeriods(
  client: any,
  count: number,
  start_day: number,
  user_id: string,
): Promise<FillOpenPeriodsResult>;
```

- [ ] **Step 1:** สร้าง branch `feature/inventory-period-auto-next` จาก `main` ใน `carmen-turborepo-backend`
- [ ] **Step 2:** ย้าย logic ตั้งแต่ "หางวดเปิด" ถึงวนสร้างงวดใน `generateNextPeriods` ไปเป็น `fillOpenInventoryPeriods` ตาม signature ข้างบน ย้ายตามเดิมทุกกติกา (นับ open+locked, เริ่มจากเดือนถัดจากงวดเปิดสุดท้าย → งวดสุดท้ายสถานะใดก็ได้ → เดือนปัจจุบัน, ข้ามเดือนที่มีอยู่แล้ว, `maxIterations = periodsToCreate + 120`) การ clamp `count`/`start_day` (`safeCount`/`safeStartDay`) อยู่ใน helper
- [ ] **Step 3:** `generateNextPeriods` เหลือ: หา tenant → ได้ `prisma` → เรียก helper → คืน `Result.ok(...)` รูป response เดิมทุก key (กรณีไม่ต้องสร้างยังคืน `message` + `created: []` + `total_created: 0` เหมือนเดิม)
- [ ] **Step 4:** ใน `closeCurrent` ภายใน `prisma.$transaction` หลังบล็อก held receipts และก่อน `return` เรียก `fillOpenInventoryPeriods(tx, OPEN_PERIOD_TARGET, 1, user_id)` แล้วเพิ่ม `periods_created: <result>.created` ใน object ที่ return อัปเดต JSDoc ของ `closeCurrent` (อังกฤษ + ไทย ตามรูปแบบไฟล์) ว่าตอนนี้เติมงวดให้ครบ 12 จริง
- [ ] **Step 5:** รัน type-check และ lint ของ `micro-business` (ดูชื่อ script ใน `apps/micro-business/package.json`) — ต้องผ่าน
- [ ] **Step 6:** รัน spec เดิม: `inventory-period.service.spec.ts`, `period-end.service.spec.ts` — ต้องผ่าน (mock `tx` ใน spec ของ period-end อาจต้องมี `tb_inventory_period.findMany/findFirst/create` เพิ่ม แก้ที่ mock ไม่ใช่ที่โค้ด)
- [ ] **Step 7:** Commit — `feat(period-end): ปิดงวดแล้วเติมงวดเปิดให้ครบ 12 เดือนใน transaction เดียวกัน`

### Task 2 (BE): ห้ามแก้วันที่ และห้ามสร้างงวดด้วยมือเมื่อมีงวดแล้ว

**Files:**
- Modify: `packages/error-catalog/src/catalog.ts` (ต่อจาก `PERIOD_STATUS_VIA_PERIOD_END_ONLY`, ราว L1440)
- Modify: `packages/error-catalog/reference/error-codes.json` (สร้างใหม่ด้วย script ของ package ถ้ามี ไม่มีให้แก้มือตามรูปเดิม)
- Modify: `apps/micro-business/src/inventory/inventory-period/inventory-period.service.ts` (`create` ราว L156, `update` ราว L380)

**Interfaces:**
- Produces: รหัส error สองตัว (FE Task 4 ใช้ชื่อนี้เป็น key คำแปล)

| code | http | message_en | message_th |
|---|---|---|---|
| `PERIOD_DATES_NOT_EDITABLE` | 422 | `Period dates are set by the system and cannot be edited` | `วันที่ของงวดกำหนดโดยระบบ แก้ไขไม่ได้` |
| `PERIOD_CREATE_ONLY_WHEN_EMPTY` | 422 | `Periods are created automatically when a period is closed` | `งวดถูกสร้างอัตโนมัติเมื่อปิดงวด สร้างเองไม่ได้` |

`id` ใช้ `makeId(MODULE.PERIOD, n)` ด้วยเลขว่างสองตัวถัดไปของ module นี้

- [ ] **Step 1:** เพิ่ม catalog entry สองตัวตามตาราง พร้อมคอมเมนต์เหตุผลหนึ่งบรรทัดต่อ entry แล้ว build package `error-catalog` (micro-business อ่านจาก dist)
- [ ] **Step 2:** `update`: ต่อจากด่าน status เพิ่มด่าน — ถ้า `fields.fiscal_year` / `fields.fiscal_month` ถูกส่งมาและไม่เท่าค่าเดิม หรือ `fields.start_at` / `fields.end_at` ถูกส่งมาและ `new Date(x).getTime()` ไม่เท่าของ `existingPeriod` → `Result.errorFromCatalog(ERROR_CATALOG.PERIOD_DATES_NOT_EDITABLE)` ค่าวันที่ที่ parse ไม่ได้ยังคืน `Invalid start_at date` / `Invalid end_at date` เหมือนเดิม
- [ ] **Step 3:** `update`: ลบการเขียน `fiscal_year` / `fiscal_month` / `start_at` / `end_at` ลง `updatePayload` และลบการเรียก `findBeforeCurrentBlock` ใน `update` (เข้าไม่ถึงแล้ว) — `findBeforeCurrentBlock` ยังถูก `create` ใช้ ห้ามลบตัว method; คง `note` / `info` / `dimension`
- [ ] **Step 4:** `create`: หลังได้ `prisma` นับ `tb_inventory_period` ที่ `deleted_at: null` ถ้า > 0 → `Result.errorFromCatalog(ERROR_CATALOG.PERIOD_CREATE_ONLY_WHEN_EMPTY)` ก่อนด่านอื่นทั้งหมด
- [ ] **Step 5:** type-check + lint + รัน `inventory-period.service.spec.ts` — เคส spec เดิมที่ทดสอบ "แก้วันที่สำเร็จ" หรือ "สร้างงวดที่สองสำเร็จ" ให้แก้ assertion เป็นคาดหวัง error ใหม่
- [ ] **Step 6:** ตรวจมือกับ backend ในเครื่อง (gateway `:4000`, BU `T02`): `PATCH` งวดหนึ่งด้วย `end_at` ใหม่ → 422 `PERIOD_DATES_NOT_EDITABLE`; `PATCH` ด้วยวันที่เดิม + `doc_version` → 200; `POST` สร้างงวด → 422 `PERIOD_CREATE_ONLY_WHEN_EMPTY`
- [ ] **Step 7:** Commit — `feat(inventory-period): ห้ามแก้วันที่งวดและห้ามสร้างงวดเองเมื่อมีงวดอยู่แล้ว` แล้วเปิด PR (อังกฤษ) ระบุ deploy order: BE ก่อน FE

### Task 3 (FE): หน้า Inventory Period เป็นแบบดูอย่างเดียว

**Files:**
- Delete: `routes/system-admin/inventory-period/inventory-period-dialog.tsx`
- Delete: `routes/system-admin/inventory-period/inventory-period-form-schema.ts`
- Modify: `routes/system-admin/inventory-period/inventory-period-component.tsx`
- Modify: `routes/system-admin/inventory-period/use-inventory-period-table.tsx`
- Modify: `routes/system-admin/inventory-period/inventory-period-card.tsx`
- Modify: `routes/system-admin/inventory-period/inventory-period-timeline.tsx`
- Modify: `routes/system-admin/inventory-period/use-inventory-period.ts`
- Modify: `routes/inventory-management/period-end/use-period-end.ts` (`useClosePeriodEnd`, L99–111)
- Modify: `types/inventory-period.ts` (ลบ type ที่ไม่มีผู้ใช้หลังลบ dialog)

**Interfaces:**
- Produces: `useInventoryPeriodTable` ไม่รับ `onEdit` · `InventoryPeriodCard` ไม่รับ `onEdit` / `onDelete` · `InventoryPeriodTimeline` ไม่รับ `onSelect`

- [ ] **Step 1:** สร้าง branch `feature/inventory-period-auto-next` จาก `main` ใน `carmen-frontend`
- [ ] **Step 2:** ลบสองไฟล์ dialog/schema; ใน component ลบ lazy import, `<Suspense>` ของ dialog, state `dialogOpen` / `editInventoryPeriod`, `openEdit`, ปุ่ม "เพิ่ม" (`Plus`) และ import ที่ไม่ใช้แล้ว — แถบ actions เหลือปุ่มเมนู ⋯ ปุ่มเดียว (ตรวจว่า wrapper `flex w-full … sm:w-auto` ไม่ทำปุ่มยืดเต็มจอบนมือถือ)
- [ ] **Step 3:** ตาราง: รหัสงวดเป็น `<span className="tabular-nums">` ธรรมดา ไม่ห่อ `CellAction`; การ์ด: `ListCard` ไม่ส่ง `onOpen` / `onDelete` (ตรวจว่า `ListCard` รองรับไม่มี `onOpen` ถ้าไม่รองรับให้ทำ prop นั้น optional ที่ `ListCard`); ไทม์ไลน์: ช่องเดือนเป็น element ที่ไม่ใช่ปุ่ม ไม่มี hover/focus แบบกดได้ แต่คง tooltip/aria-label ของสถานะไว้
- [ ] **Step 4:** `use-inventory-period.ts`: ลบ export `useCreateInventoryPeriod`, `useUpdateInventoryPeriod`, `useDeleteInventoryPeriod`, `useInventoryPeriodById` ที่ไม่มีผู้เรียก (ยืนยันด้วย `trail grep` ทีละชื่อก่อนลบ)
- [ ] **Step 5:** `useClosePeriodEnd`: เพิ่ม `QUERY_KEYS.INVENTORY_PERIODS` ใน `invalidateKeys` พร้อมคอมเมนต์ไทยหนึ่งบรรทัดว่าปิดงวดสร้างงวดใหม่ต่อท้าย
- [ ] **Step 6:** `bun run typecheck` และ `bun run lint` — ต้องผ่าน (lint ดัก import ค้าง)
- [ ] **Step 7:** Commit — `feat(inventory-period): หน้าเป็นแบบดูอย่างเดียว ลบฟอร์มเพิ่ม/แก้งวด`

### Task 4 (FE): ข้อความ empty state และคำแปล

**Files:**
- Modify: `messages/en.json`, `messages/th.json` (namespace `systemAdmin.inventoryPeriod` และหมวดคำแปล error catalog ที่มี `PERIOD_STATUS_VIA_PERIOD_END_ONLY` อยู่)
- Modify: `routes/system-admin/inventory-period/inventory-period-component.tsx`

**Interfaces:**
- Consumes: รหัส error จาก Task 2 (`PERIOD_DATES_NOT_EDITABLE`, `PERIOD_CREATE_ONLY_WHEN_EMPTY`)

- [ ] **Step 1:** แก้ค่า `systemAdmin.inventoryPeriod.desc` เป็น — en: `Period dates are set by the system. New periods are created when a period is closed.` · th: `วันที่ของงวดกำหนดโดยระบบ งวดใหม่ถูกสร้างเมื่อปิดงวด`
- [ ] **Step 2:** เพิ่มคีย์ `emptyTitle` / `emptyDesc` / `emptyAction` — en: `No periods yet` / `Generate the first 12 periods to start.` / `Generate periods` · th: `ยังไม่มีงวด` / `เติมงวด 12 เดือนแรกเพื่อเริ่มใช้งาน` / `เติมงวด`
- [ ] **Step 3:** เมื่อ `allPeriods.length === 0` และไม่ได้กำลังโหลด และไม่มี search/filter ให้ empty state (ทั้งตารางและการ์ดมือถือ) แสดงข้อความชุดนี้พร้อมปุ่มที่เรียก `setGenerateOpen(true)` — ใช้ prop ที่ `EmptyComponent` มีอยู่ (อ่าน `components/empty-component.tsx` ก่อน); มี search/filter แล้วไม่เจอให้ใช้ empty เดิม
- [ ] **Step 4:** เพิ่มคำแปล error สองรหัสใน en/th ข้าง `PERIOD_STATUS_VIA_PERIOD_END_ONLY` ใช้ข้อความเดียวกับตารางใน Task 2
- [ ] **Step 5:** ลบคีย์แปลของ dialog ที่ไม่มีผู้ใช้แล้วใน `systemAdmin.inventoryPeriod` (ยืนยันด้วย `trail grep` ทีละคีย์; `fiscalYear` / `fiscalMonth` / `startAt` / `endAt` / `status*` ยังถูก export และตารางใช้ ห้ามลบ)
- [ ] **Step 6:** `bun run typecheck`, `bun run lint`, `bun test:run` — ต้องผ่าน (มีเทสต์ดักคีย์แปล/ขนาดตัวอักษรทั้งรีโป)
- [ ] **Step 7:** ตรวจในเบราว์เซอร์ที่ `http://localhost:3000/system-admin/inventory-period` (BU `T02`): ไม่มีปุ่ม "เพิ่ม", รหัสงวดกดไม่ได้ทั้งตาราง/ไทม์ไลน์, เมนู ⋯ ยังมี เติมรอบ/ส่งออก/พิมพ์, ดูทั้ง light/dark และจอมือถือ/tablet/1366 — ถ่ายภาพให้ผู้ใช้ดู **การปิดงวดจริงเพื่อดูงวดใหม่เกิด ให้ถามผู้ใช้ก่อนกด**
- [ ] **Step 8:** Commit — `feat(inventory-period): ข้อความวันที่กำหนดโดยระบบ และ empty state ชี้ไปปุ่มเติมงวด` แล้วเปิด PR (อังกฤษ) ระบุว่า BE PR ต้อง deploy ก่อน
