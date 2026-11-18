# เลขลำดับแถวทุกหน้ารายการ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทุกหน้ารายการมีเลขลำดับแถวที่นับต่อข้ามหน้า และตรงกันทั้งมุมมองตารางกับการ์ด แสดงตลอดทุกขนาดจอ

**Architecture:** ใช้ฟังก์ชันกลาง `rowNumber()` ตัวเดียว ให้ทั้ง `indexColumn` (ตาราง) และ `ListCard` (การ์ด) คิดเลขจากสูตรเดียวกัน แต่ละหน้าส่งเลขผ่าน prop เอง ไม่มี magic

**Tech Stack:** React 19 + TanStack Table + Tailwind v4 (Vite SPA)

**Spec:** `docs/superpowers/specs/2026-11-18-list-row-number-design.md`

## Global Constraints

- **ข้ามขั้นตอนเทสต์** (ตามที่ user ตั้งค่าไว้): ไม่ต้องเขียน `*.test.tsx` ใหม่ แต่ต้องรัน `bun run typecheck` และ `bunx eslint <files>` ทุก task และเทสต์ที่มีอยู่ต้องยังผ่าน
- สูตร: แบบแบ่งหน้า `(page − 1) × perpage + index + 1` (ค่าตั้งต้น page 1, perpage 10 เหมือน `indexColumn` เดิม) · แบบ infinite / โหลดเพิ่ม `index + 1` จากรายการที่โหลดสะสม
- ทำเฉพาะ **หน้ารายการ** ไม่แตะตารางในฟอร์ม dialog และ wizard
- `#` **ห้ามอยู่ใน tier ที่ซ่อนตามความกว้าง** ไม่ว่าตารางไหน
- dark mode: เลขบนการ์ดใช้ token (`text-muted-foreground`) ไม่ตั้งค่าสีเอง และไม่ใช้ขนาดตัวอักษรที่อยู่นอก ladder (`type-ladder.test.ts`)
- commit message เป็นภาษาไทย ส่วน PR เป็นภาษาอังกฤษ ห้าม squash-merge

## Review Focus

1. **mobile (infinite) กับ desktop grid (แบ่งหน้า) ของหน้าเดียวกัน**: บนมือถือรายการเป็นแบบสะสม ถ้าส่ง `params` ไปด้วย หน้า 2 จะเริ่มที่ 21 แทน 11 ทุกหน้าที่มี `useInfiniteScroll` ต้องส่ง `undefined` เมื่ออยู่โหมด infinite (Task 3, 4)
2. **ตารางกับการ์ดของหน้าเดียวกันได้เลขตรงกัน**: สลับ list ↔ grid ที่หน้า 2 แล้วรายการแรกต้องเป็น #11 ทั้งสองมุมมอง (Task 7)
3. **ตารางที่เรียงฝั่ง client** (เช่น `getSortedRowModel`): `row.index` คือลำดับเดิมก่อนเรียง ไม่ใช่ลำดับที่แสดง ตารางพวกนี้ต้องใช้ตำแหน่งใน `table.getRowModel().rows` (Task 1 กำหนด, Task 5 ตรวจ)
4. **งบความกว้างเปลี่ยนเมื่อ `#` เหลือ 48px**: ตารางที่มีคอลัมน์ `grow` และ `columnTier()` คำนวณผลรวมจาก 60 ต้องปรับทั้งหมด ไม่งั้นจะล้นหรือมีที่ว่างที่ 768/1024 (Task 1, 6)
5. **เลข 4 หลักบนการ์ดที่ชื่อยาว**: `#1234` ต้องไม่เบียดชื่อหรือ badge จนหลุดการ์ด เลขต้อง `shrink-0` ส่วนชื่อยัง truncate ได้ (Task 1)

---

### Task 1: ฟังก์ชันกลาง + indexColumn + ListCard + config template

**Files:**
- Create: `lib/row-number.ts`
- Modify: `components/ui/data-grid/columns.tsx:44-60` (`indexColumn`)
- Modify: `routes/config/shared/use-config-list-table.ts:67` (งบ `hideIndex ? 0 : 60` → 48)
- Modify: `components/share/list-card.tsx` (`ListCardProps`, `ListCard` header)
- Modify: `components/templates/types.ts:48` (`CardRenderProps`)
- Modify: `components/templates/config-list-template.tsx:64-95` (`renderGridContent`)

**Interfaces:**
- Produces: `rowNumber(params: Pick<ParamsDto, "page" | "perpage"> | undefined, index: number): number` — ถ้า `params` เป็น `undefined` จะคืน `index + 1` (โหมดสะสม)
- Produces: `ListCard` prop `rowNo?: number` ถ้าไม่ส่งจะไม่แสดงเลข
- Produces: `CardRenderProps.rowNo: number` (ใช้คู่กับ `index` ที่มีอยู่แล้ว)

- [ ] **Step 1:** สร้าง `lib/row-number.ts` ตาม signature ข้างบน ใช้ `Number(x) || default` เหมือนโค้ดเดิม
- [ ] **Step 2:** แก้ `indexColumn` ให้ cell เรียก `rowNumber(params, rowPosition)` โดย `rowPosition` = ตำแหน่งของแถวใน `table.getRowModel().rows` (ใช้ `table.getRowModel().rows.indexOf(row)` หรือ `row.getDisplayIndex?.()` ถ้ามีใน TanStack เวอร์ชันนี้) ไม่ใช้ `row.index` ตรง ๆ (Review Focus 3) · เปลี่ยน `size` เป็น 48
- [ ] **Step 3:** ปรับงบใน `use-config-list-table.ts:67` เป็น `48`
- [ ] **Step 4:** ใน `ListCard` ถ้ามี `rowNo` ให้ใส่ `<span className="text-muted-foreground shrink-0 tabular-nums">#{rowNo}</span>` ไว้ก่อน `CardTitle` ในแถว flex เดียวกัน โดยจัด `gap-1.5` ระหว่างเลขกับชื่อ (ห่อทั้งสองใน `div` ที่เป็น `flex min-w-0 items-baseline` เพื่อให้ badge ยังชิดขวา) และใช้ขนาดตัวอักษรเดียวกับ title (`text-sm`)
- [ ] **Step 5:** เพิ่ม `rowNo` ใน `CardRenderProps` · ใน `renderGridContent` รับ `params` เพิ่ม แล้วส่ง `rowNo: rowNumber(useInfiniteScroll ? undefined : params, index)`
- [ ] **Step 6:** `bun run typecheck` และ `bunx eslint lib/row-number.ts components/ui/data-grid/columns.tsx components/share/list-card.tsx components/templates/` ต้องผ่าน และ `bun test:run components/share/list-card.test.tsx components/ui/data-grid` ยังเขียว
- [ ] **Step 7:** commit `feat(list): ฟังก์ชันกลาง rowNumber + เลขลำดับบน ListCard`

### Task 2: การ์ดหน้า config (ผ่าน `renderCard`)

**Files (ส่ง `rowNo` จาก `renderCard` ต่อไปให้ `ListCard`):**
- `routes/config/{adjustment-type,business-type,chart-of-accounts(coa),cost-center-group,cost-center,credit-note-reason,credit-term,currency,delivery-point,department,exchange-rate,extra-cost,location,shelf,tax-profile,unit}/*-card.tsx` + `*-component.tsx` ที่เรียก
- `routes/operation-plan/{category,cuisine,equipment-category,equipment,recipe}/*-card.tsx` + ตัวที่เรียก
- `routes/product-management/eco/eco-card.tsx`, `routes/vendor-management/{certification,price-list,price-list-template,request-price-list,vendor}/*-card.tsx` ถ้าตัวที่เรียกเป็น `ConfigListTemplate`
- `routes/config/shared/config-master-grid.tsx` (ใช้ `table.getRowModel().rows` → ใช้ตำแหน่งใน array + `rowNumber(params, i)`) และ `routes/config/shared/mock-config-list.tsx`
- `routes/config/{payment-type,wht-form,wht-service-type}/*-page.tsx`

**Interfaces:** Consumes `CardRenderProps.rowNo`, `ListCard rowNo` (Task 1)

- [ ] **Step 1:** เพิ่ม `rowNo?: number` ใน props ของการ์ดแต่ละตัว แล้วส่งต่อให้ `<ListCard rowNo={rowNo}>` · ที่ call site ให้เปลี่ยน `renderCard={({ item, onEdit, onDelete }) => …}` เป็นรับ `rowNo` เพิ่ม
- [ ] **Step 2:** หาให้ครบด้วย `grep -rn "renderCard=" routes` ทุก match ต้องส่ง `rowNo`
- [ ] **Step 3:** typecheck + eslint ไฟล์ที่แก้
- [ ] **Step 4:** commit `feat(list): เลขลำดับบนการ์ดหน้า config`

### Task 3: การ์ดหน้าเอกสาร/โมดูล (card list เขียนเอง)

**Files (ไฟล์ `*-card-list.tsx` หรือ component ที่ `map` แล้ว render การ์ด):**
- procurement: `pr-card`, `po-card`, `grn-card`, `cn-card`, `prt-card`, `my-approval/approve-queue-list.tsx`
- store/inventory: `sr-card`, `ia-card`
- accounting: `ap-invoice-list`, `ap-payment-list`, `jv-card-list`, `jv-template-card-list`, `ar-{contract,folio,invoice-list,profile,receipt-list}.route.tsx`, `accounting-document-list`, `accounting-register-list`, `operations/preview-register`
- system-admin: `user-card`, `role-card`, `running-code-card`, `inventory-period-card`
- product: `pd-card`
- ไฟล์ใน `grep -rl "<ListCard" routes` ที่ Task 2 ยังไม่ได้แก้

**Interfaces:** Consumes `rowNumber`, `ListCard rowNo` (Task 1)

- [ ] **Step 1:** ที่จุด `items.map((item) => <XCard …/>)` เปลี่ยนเป็น `map((item, i) => <XCard rowNo={rowNumber(infinite ? undefined : params, i)} …/>)` โดย `infinite` คือ flag ของหน้านั้น (เช่น `useInfiniteScroll` ใน `pr-component.tsx:163`) ถ้า list component ไม่มี `params` หรือ flag ให้ส่ง prop `rowOffsetParams?: ParamsDto` ลงไปจาก component แม่ (`undefined` = โหมดสะสม)
- [ ] **Step 2:** การ์ดที่มีหลาย branch (เช่น `pr-card.tsx` ที่มี `compact` และแบบเต็ม) ต้องส่ง `rowNo` ทุก branch
- [ ] **Step 3:** ตรวจว่าครบ: ทุกไฟล์ใน `grep -rl "<ListCard" routes` ต้องมี `rowNo=` (ยกเว้น skeleton)
- [ ] **Step 4:** typecheck + eslint
- [ ] **Step 5:** commit `feat(list): เลขลำดับบนการ์ดหน้าเอกสาร`

### Task 4: การ์ดที่ไม่ได้ใช้ ListCard

**Files:** `routes/system-admin/document/document-card.tsx`, `routes/system-admin/workflow/wf-card.tsx`, `routes/report/list/report-card.tsx`, `routes/report/history/history-card.tsx`, `routes/report/schedules/schedule-cards.tsx`, `routes/system-admin/activity-log/activity-log-card.tsx`, `routes/system-admin/user-activity/user-activity-card.tsx` (และตัวที่เรียก)

**Interfaces:** Consumes `rowNumber` (Task 1)

- [ ] **Step 1:** ใส่ `#{rowNo}` ด้วย class เดียวกับ Task 1 Step 4 ไว้หน้าชื่อหรือหัวการ์ด ส่วนการคิดเลขใช้วิธีเดียวกับ Task 3 Step 1 · `document-icon-grid.tsx` (กริดไอคอนไฟล์) ไม่ต้องใส่ เพราะไม่ใช่การ์ดรายการ
- [ ] **Step 2:** typecheck + eslint · `bun test:run routes/report/list/report-card.test.tsx` ยังเขียว
- [ ] **Step 3:** commit `feat(list): เลขลำดับบนการ์ดที่เขียนเอง`

### Task 5: ตารางรายการที่ยังไม่มี `#`

**Files:** `routes/accounting/accounts-receivable/{ar-folio,ar-receipt-list,ar-contract,ar-invoice-list}.route.tsx`, `routes/accounting/documents/{accounting-document-list,accounting-register-list}.tsx`, `routes/accounting/operations/preview-register.tsx`, `routes/operation-plan/sales-consumption/sc-table.tsx`, `routes/operation-plan/import-pos/pos-import-history.tsx`, `routes/report/history/history-component.tsx` (ตรวจก่อนว่า `use-history-table` ใส่ `#` ให้แล้วหรือยัง), `routes/config/shared/use-ap-master-table.tsx:67` (ลบ `hideIndex: true`)

**Interfaces:** Consumes `indexColumn` (Task 1)

- [ ] **Step 1:** ใส่ `indexColumn<T>(params)` เป็นคอลัมน์แรกถัดจาก select (ถ้ามี) · ถ้าตารางแบ่งหน้าฝั่ง client ให้ส่ง `{ page: pageIndex + 1, perpage: pageSize }` จาก state ของตาราง · ถ้าตารางแสดงทั้งหมดในหน้าเดียว ให้ส่ง `{}` (ผลเท่ากับ index + 1)
- [ ] **Step 2:** ตารางที่มีคอลัมน์ `grow` หรืองบความกว้างคงที่: เพิ่ม 48 เข้าไปในผลรวม แล้วเปิดดูที่ 768px ว่าไม่ล้น
- [ ] **Step 3:** typecheck + eslint
- [ ] **Step 4:** commit `feat(list): คอลัมน์ # ในตารางรายการที่ยังไม่มี`

### Task 6: ตารางที่เคยซ่อน `#` ตามความกว้างกล่อง

**Files:** `routes/vendor-management/vendor/use-vendor-table.tsx` (`columnTier` ~L50-75, `showIndex` L55/176/236), `routes/vendor-management/certification/use-certification-table.tsx:182`, `routes/vendor-management/request-price-list/use-rfp-table.tsx:176`, `routes/procurement/purchase-request-template/use-prt-table.tsx:165`, `routes/system-admin/document/use-document-table.tsx` (`columnTier`)

- [ ] **Step 1:** เอา `showIndex` ออกจาก tier และตั้ง `#` ให้แสดงตลอด แล้วคิดจุดเปลี่ยน tier ใหม่จากผลรวม size โดยนับ `#` = 48 และนับ select 55 ด้วย แม้จะไม่เรนเดอร์ (ดู learning เรื่องงบ 607px) ตั้งจุดเปลี่ยนให้สูงกว่าผลรวมจนคอลัมน์ยืดได้ราว 230px ก่อนที่คอลัมน์รองจะกลับมา
- [ ] **Step 2:** ใน `use-vendor-table.tsx:176` ขนาดคอลัมน์ที่ขึ้นกับ `showIndex` (`190 : 170`) ให้เหลือค่าเดียว
- [ ] **Step 3:** อัปเดตคอมเมนต์ในโค้ดที่อธิบายลำดับการซ่อน (ตอนนี้เขียนว่าซ่อนเลขลำดับ) ให้ตรงกับโค้ดใหม่
- [ ] **Step 4:** typecheck + eslint
- [ ] **Step 5:** commit `fix(list): ตารางผู้ขาย/ใบรับรอง/RFP/PRT/เอกสาร แสดง # ตลอดทุกความกว้าง`

### Task 7: ตรวจในเบราว์เซอร์ + ส่งงาน

- [ ] **Step 1:** `bun dev` แล้วตรวจด้วยมือ ใช้ backend :4000 บัญชีตาม memory
  - PR list: หน้า 2 แถวแรกเป็น #11 ทั้งมุมมอง list และ grid (Review Focus 2)
  - มือถือ (375px): PR และ Unit นับต่อเนื่องหลังโหลดเพิ่ม 1→20→21 (Review Focus 1)
  - Vendor และ Document ที่ 768 / 1024 / 1180 / 1280 / 1366 / 1920 / 3840: `#` แสดงทุกขนาดและไม่ล้น (Review Focus 4)
  - การ์ดที่ชื่อยาว + เลข 3–4 หลัก: badge ไม่หลุดการ์ด (Review Focus 5)
  - dark mode: เลขอ่านออก
- [ ] **Step 2:** `bun run typecheck && bun run lint && bun test:run` ต้องผ่านทั้งหมด (เทสต์ที่มีอยู่)
- [ ] **Step 3:** `trail check` ถ้า exit 1 เพราะขัดกับ learning วันที่ 13 พ.ย. ที่ให้ซ่อนเลขเมื่อกล่องแคบ ให้อธิบายใน PR ว่า user สั่งกลับคำตัดสินเมื่อ 2026-11-18 (learning `l-f0162236`)
- [ ] **Step 4:** เปิด PR แยกตามที่ spec เสนอไว้: PR1 = Task 1 + 5, PR2 = Task 2–4, PR3 = Task 6 (stacked: ห้ามใช้ `--delete-branch` จนกว่าจะ merge ครบ) หรือรวมเป็น PR เดียวถ้า user ต้องการ
