# Typography Role Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ข้อความหน้าที่เดียวกันใช้ขนาดเดียวกันทุกหน้า: body ตั้งต้น 12px, primitive ตรงตามตารางหน้าที่, เซลล์ตารางมีแค่บรรทัดหลัก 12 / บรรทัดรอง 11 และมีเทสต์ดัก

**Architecture:** แก้ที่ต้นเหตุก่อน (ค่า `body` ใน `globals.css`) แล้วแก้ primitive กลางใน `components/ui` + `components/share` ต่อด้วยตัวช่วยเซลล์ `CellText` / `CellSub` กับเทสต์ static ที่สแกน `cell:` (เริ่มจาก allowlist ของไฟล์ที่ยังไม่ migrate แล้วค่อย ๆ หดจนว่าง) และปิดท้ายด้วยการวัดบนหน้าจริงเทียบกับ baseline

**Tech Stack:** Vite + React 19 + Tailwind v4 (`@theme` ใน `styles/globals.css`) + Vitest + Chrome automation สำหรับการวัด

**Spec:** `docs/superpowers/specs/2026-11-25-typography-role-defaults-design.md`

## Global Constraints

- ใช้ขนาดได้เฉพาะขั้นใน ladder (`text-micro-floor` 8 · `text-micro-eyebrow` 9 · `text-micro-legal` 10 · `text-micro` 11 · `text-xs` 12 · `text-sm` 14 · `text-base` 16 · `text-lg` 18 · `text-xl` 20 · `text-2xl` 24 · `text-3xl` 30 · `text-4xl` 36) ห้ามใส่ arbitrary `text-[..rem]` ใหม่
- ตารางหน้าที่ (จาก spec): h1 = `text-lg` semibold · หัวกลุ่ม/การ์ด/dialog/sheet = `text-sm` semibold · ข้อความใต้หัว = `text-xs` สีจาง · label = `text-xs` สีจาง · ค่าในฟิลด์/description = `text-xs` · หัวคอลัมน์ = `text-xs` semibold สีจาง · เซลล์บรรทัดหลัก = `text-xs` · เซลล์บรรทัดรอง = `text-micro` + `text-muted-foreground` · meta = `text-micro-legal` · รายการใน control = `text-xs` · body = `0.75rem`
- `body` ตั้ง `font-size: 0.75rem` และคง `letter-spacing: -0.01em`
- ห้ามแตะ: ปุ่ม (`button.tsx`), toast (sonner), `auth-split-shell.tsx`, recipe cook mode (`recipe-cook-step-stage.tsx` ฯลฯ), dashboard tile/widget visual, `landing-visuals.tsx`, print CSS, font scale (`html.font-scale-*`, `lib/font-scale.ts`)
- ห้ามประกาศ `--spacing-md/sm/lg/xl/2xl` และห้ามตั้ง `leading-none` ใหม่บนข้อความไทย
- ตัวยกเว้นใน allowlist ของเทสต์ต้องมีเหตุผลกำกับทุกรายการ
- ตาม `~/.claude/CLAUDE.md`: ไม่สร้างไฟล์เทสต์อื่นนอกจาก `components/ui/data-grid/cell-type.test.ts` (user อนุมัติไฟล์นี้ผ่าน spec) · ทุก task ต้องรัน `bun run typecheck` + `bunx eslint <files>` และเทสต์ที่มีอยู่ซึ่งเกี่ยวข้อง
- commit message เป็นภาษาไทย อยู่บน branch `feature/typography-role-defaults`

## Review Focus

1. **ข้อความที่พึ่ง 17px โดยไม่รู้ตัว** เช่นข้อความเปล่าใน empty state ของหน้า, ตัวเลขใหญ่ใน summary bar หรือข้อความใน `<p>` ของ dialog body ควรยังอ่านออกและหัวยังใหญ่กว่าเนื้อ → Task 1 บันทึก baseline และ Task 8 เทียบรายการเดียวกัน
2. **sidebar ตอนหุบ (icon mode) และ tooltip ของมัน** หลังลด `text-sm` เป็น `text-xs` ป้ายต้องไม่ล้นและไอคอนต้องไม่เลื่อน → Task 4 มีขั้นวัดเฉพาะ
3. **font scale `biggest` (137.5%)** ที่ 12px ต้องได้ราว 16.5px โดย layout ต้องไม่ล้น และที่ `small` ต้องยังอ่านได้ (~11.25px) → Task 8 วัดที่ทั้งสองระดับ
4. **ข้อความไทยสองชั้น (สระบน + วรรณยุกต์)** ในบรรทัดรอง 11px ต้องไม่ถูกตัด → Task 5 ให้ `CellSub` ใช้ line-height ของ token (`--text-micro--line-height: 1.35`) ห้ามใส่ `leading-none` และ Task 8 ตรวจ
5. **dark mode** เพราะ `text-muted-foreground` บนบรรทัดรองที่เล็กลงอาจตก contrast ให้ใช้ token เดิมที่ผ่าน AA อยู่แล้ว ห้ามจางลงกว่านี้ (เช่น `/60`) → Task 8 ตรวจทั้งสองธีม

---

### Task 1: Baseline measurement

**Files:**
- Create: `docs/superpowers/plans/2026-11-25-typography-role-defaults-baseline.md`

**Interfaces:**
- Produces: รายการหน้าตัวแทน + computed font-size ต่อหน้าที่ ซึ่ง Task 8 จะใช้เทียบ

- [ ] **Step 1:** รัน `bun dev` (ใช้ backend dev) ล็อกอิน แล้วเปิดหน้าตัวแทน: PR list, PR detail (ใบที่มี description), GRN detail (มี extra cost note), `/config/location/<id>` (โหมดดู), dialog ใดก็ได้ที่มี description, empty state ของ list, หน้า login, `/dashboard`, sidebar ทั้งตอนกางและตอนหุบ, dropdown menu ของแถว (⋯), command palette
- [ ] **Step 2:** ในแต่ละหน้าใช้ `javascript_tool` เก็บ `getComputedStyle(el).fontSize` ของ: h1, หัว section, label, ค่าในฟิลด์, description, หัวคอลัมน์, เซลล์ทุกคอลัมน์ของแถวแรก, รายการเมนู แล้วจดลงตาราง markdown (หน้า · หน้าที่ · selector · px)
- [ ] **Step 3:** commit `docs: บันทึก baseline ขนาดตัวอักษรก่อนแก้`

### Task 2: body ตั้งต้น 12px + DESIGN.md + font-serif

**Files:**
- Modify: `styles/globals.css:464-468` (บล็อก `body`)
- Modify: `docs/DESIGN.md` §typography (`inherited-base` และเพิ่มหัวข้อ Roles)
- Modify: `routes/vendor-management/vendor/vendor-contact.tsx:166`

- [ ] **Step 1:** ใน `body` เปลี่ยน `font-size: 1.0625rem` เป็น `font-size: 0.75rem` คง `letter-spacing: -0.01em` และแก้ comment "Apple reading pace" ให้บอกว่าค่านี้คือขั้น 12px ของ ladder (ข้อความที่ไม่มี class = เนื้อหา)
- [ ] **Step 2:** `docs/DESIGN.md`: `inherited-base.fontSize` เปลี่ยนเป็น 12px และเขียนเหตุผลใหม่ จากนั้นเพิ่มบล็อก `roles:` ที่คัดตารางหน้าที่จาก spec ทั้ง 12 แถว (role → token → weight/color)
- [ ] **Step 3:** `vendor-contact.tsx:166` เปลี่ยน `font-serif` เป็น `font-sans`
- [ ] **Step 4:** รัน `bun test:run components/ui/type-ladder.test.ts lib/__tests__` แล้วต้องเขียวทั้งหมด จากนั้นรัน `bun run typecheck` ต้องได้ exit 0
- [ ] **Step 5:** commit `feat(design): ลดขนาดตั้งต้นของ body เป็น 12px ตาม ladder`

### Task 3: primitive หัวและข้อความใต้หัว

**Files:**
- Modify: `components/ui/setting-section.tsx:59` `text-base` → `text-sm`
- Modify: `components/ui/dialog.tsx:141`, `components/ui/sheet.tsx:128`, `components/ui/card.tsx:51`, `components/ui/alert-dialog.tsx:123` (Description) `text-sm` → `text-xs`
- Modify: `components/ui/alert-dialog.tsx:108` (Title) `text-lg` → `text-sm` และคง semibold ไว้ ส่วน `SheetTitle` ถ้าไม่ใช่ `text-sm` ให้เปลี่ยนเป็น `text-sm`
- Modify: `components/ui/field.tsx:57` legend `text-base` → `text-sm`
- Modify: `components/share/doc-form-header.tsx:117` ลบ `sm:text-xl` ออก
- Modify: `components/share/document-list-header.tsx:36` ลบ `sm:text-sm` ออก
- Modify: `routes/dashboard/dashboard-component.tsx:133` `text-[1rem] ... sm:text-[2rem]` → `text-lg`

- [ ] **Step 1:** แก้ตามรายการข้างบน ส่วน `dialog.tsx:128` (Title) ซึ่งเป็น `text-sm leading-none` ให้เปลี่ยน `leading-none` เป็น `leading-snug` เพราะหัว dialog เป็นภาษาไทยได้
- [ ] **Step 2:** ค้นจุดเรียกที่ส่ง `className` ขนาดทับ primitive เหล่านี้ด้วย `trail grep "DialogDescription"` และ `trail grep "SettingSection"` ถ้าเจอ `text-sm` หรือ `text-base` ส่งเข้ามา ให้ลบออก เว้นแต่จุดนั้นอยู่ในรายการ "ห้ามแตะ"
- [ ] **Step 3:** รัน `bun run typecheck` และ `bunx eslint` กับไฟล์ที่แก้ ต้องผ่าน
- [ ] **Step 4:** commit `feat(design): หัวและข้อความใต้หัวใช้ขนาดตามหน้าที่`

### Task 4: รายการใน control เป็น 12px

**Files:**
- Modify: `components/ui/dropdown-menu.tsx:75,93,129,156,212` `text-sm` → `text-xs`
- Modify: `components/ui/command.tsx:74,105,148` `text-sm` → `text-xs`
- Modify: `components/ui/popover.tsx:50` `text-sm` → `text-xs`
- Modify: `components/ui/sidebar.tsx:469,498,507,509,713` `text-sm` → `text-xs`
- Check: `components/ui/select.tsx`, `tabs.tsx`, `breadcrumb.tsx`, `tooltip.tsx` (เป็น `text-xs` อยู่แล้ว ให้ยืนยันเท่านั้น)

- [ ] **Step 1:** แก้ตามรายการ โดยไม่เปลี่ยนความสูงของแถว (`h-8` เป็นต้น) และไม่เปลี่ยนขนาดไอคอน
- [ ] **Step 2:** วัดใน Chrome ว่าเมนู ⋯ ของแถว, command palette และ sidebar ทั้งตอนกางและตอนหุบ ได้ computed 12px ทุกรายการ ป้ายต้องไม่ล้น และ tooltip ตอนหุบต้องยังแสดง
- [ ] **Step 3:** รัน `bun run typecheck` และ `bunx eslint` กับไฟล์ที่แก้ ต้องผ่าน
- [ ] **Step 4:** commit `feat(design): รายการใน menu, command, popover และ sidebar ใช้ 12px`

### Task 5: ตัวช่วยเซลล์ + เทสต์ดัก

**Files:**
- Create: `components/ui/data-grid/cell-text.tsx`
- Create: `components/ui/data-grid/cell-type.test.ts`

**Interfaces:**
- Produces:
  - `export function CellText(props: React.ComponentProps<"span">): JSX.Element` เป็น span ที่มี `data-slot="cell-text"` และไม่ใส่ขนาด (สืบทอด 12px จากตาราง) ใช้กับบรรทัดหลักที่ต้องห่อ เช่น truncate หรือ bold
  - `export function CellSub(props: React.ComponentProps<"span">): JSX.Element` เป็น span `block` ที่มี `data-slot="cell-sub"` และ class `text-micro text-muted-foreground` เป็นจุดเดียวที่กำหนดขนาดบรรทัดรอง
  - `export const CELL_SUB_CLASS = "text-micro text-muted-foreground"` สำหรับจุดที่ต้องใช้ class ตรง ๆ (เช่น `<Link>`)
  - ไฟล์เทสต์ export ค่าคงที่ภายใน `ALLOWLIST: Record<string, string>` (path → เหตุผล) ซึ่ง Task 6–7 จะลบรายการออกทีละโมดูล

- [ ] **Step 1: เขียนเทสต์** `components/ui/data-grid/cell-type.test.ts` สแกนไฟล์ `.tsx` ทั้งหมดใต้ `routes/` และ `components/` (ยกเว้น `*.test.tsx`) หา body ของ `cell:` (ตั้งแต่ `cell:` ถึงจุดจบของ arrow function หรือ property นั้น ให้ builder เลือกวิธีจับขอบเขต) แล้วหา class ขนาด `text-(sm|base|lg|xl|2xl|micro-legal|micro-floor|micro-eyebrow|\[...\])` หรือ `text-micro` ที่ไม่ได้มาจาก `CELL_SUB_CLASS`/`CellSub` สำหรับ test cases:
  - `it("no cell: sets its own font size outside the allowlist")` → `expect(offenders().filter(f => !(f in ALLOWLIST))).toEqual([])`
  - `it("allowlist has no stale entries")` → ทุก key ใน `ALLOWLIST` ต้องยังเป็น offender จริง (กันไม่ให้ allowlist ค้าง)
  - `it("detects the pattern it guards")` → probe string อย่างน้อย 4 แบบ: `cell: ({ row }) => <span className="text-sm">` ต้องจับ, `cell: () => <div className="font-mono text-micro-legal">` ต้องจับ, `cell: () => <CellSub>x</CellSub>` ต้องไม่จับ, `cell: () => <span className="text-xs font-semibold">` ต้องไม่จับ
  - `it("covers header renderers but not code outside column defs")` → probe `header: () => <span className="text-sm">` ต้องจับ (spec รวม header renderer ด้วย; หัวคอลัมน์อนุญาตแค่ `text-xs`) ส่วน probe `<p className="text-sm">` ที่ไม่ได้อยู่ใน `cell:`/`header:` ต้องไม่จับ
  - ขอบเขตการสแกนจึงเป็น body ของทั้ง `cell:` และ `header:`
- [ ] **Step 2:** รันเทสต์ ครั้งนี้ต้อง FAIL และแสดงรายชื่อ offender ราว 43 ไฟล์
- [ ] **Step 3:** สร้าง `cell-text.tsx` ตาม Interfaces แล้วเติม `ALLOWLIST` ด้วยรายชื่อ offender ปัจจุบันทุกไฟล์ ใส่เหตุผล `"pending migration"` ชั่วคราว
- [ ] **Step 4:** รัน `bun test:run components/ui/data-grid/cell-type.test.ts` ต้อง PASS ทั้ง 4 case จากนั้นรัน typecheck และ eslint ต้องผ่าน
- [ ] **Step 5:** commit `feat(data-grid): เพิ่ม CellText/CellSub และเทสต์ดักขนาดในเซลล์`

### Task 6: migrate cell ของ `routes/procurement` และ `routes/accounting`

**Files:** ไฟล์ใน `ALLOWLIST` ที่ขึ้นต้นด้วย `routes/procurement/` (12) และ `routes/accounting/` (7)

**Interfaces:**
- Consumes: `CellText`, `CellSub`, `CELL_SUB_CLASS` จาก `@/components/ui/data-grid/cell-text`

- [ ] **Step 1:** ในแต่ละ `cell:` ถ้าเป็นบรรทัดหลัก ให้ลบ class ขนาดออก ส่วน `font-semibold`/`font-mono`/`tabular-nums` คงได้ ถ้าเป็นบรรทัดรอง (รหัส ชื่อรอง วันที่ใต้ชื่อ) ให้เปลี่ยนเป็น `CellSub` หรือ `CELL_SUB_CLASS` โดยบรรทัดรองที่เป็น 10px จะขยับเป็น 11px ตาม spec
- [ ] **Step 2:** ลบไฟล์ที่แก้แล้วออกจาก `ALLOWLIST` จากนั้นรัน `bun test:run components/ui/data-grid/cell-type.test.ts` ต้อง PASS (case "stale entries" จะ fail ถ้าลืมลบ)
- [ ] **Step 3:** เปิด PR list กับ AP invoice list ใน Chrome แล้วยืนยันว่าบรรทัดหลักทุกเซลล์ในแถวแรกได้ 12px และบรรทัดรองได้ 11px
- [ ] **Step 4:** รัน typecheck และ eslint ต้องผ่าน แล้ว commit `refactor(procurement,accounting): เซลล์ตารางใช้ขนาดตามหน้าที่`

### Task 7: migrate cell ของโมดูลที่เหลือ และ components/

**Files:** ไฟล์ที่เหลือทั้งหมดใน `ALLOWLIST` (operation-plan 4, store-operation 3, system-admin 3, vendor-management 3, inventory-management 2, config / external / product-management / report อย่างละ 1, components/ 5)

- [ ] **Step 1:** ใช้กติกาเดียวกับ Task 6 Step 1 ส่วนไฟล์ใน `components/dashboard-widget/` ถ้าเป็น visual ของ tile ที่อยู่ในรายการ "ห้ามแตะ" ให้คงไว้ใน `ALLOWLIST` พร้อมเหตุผลจริง (เช่น `"dashboard tile visual — out of scope per spec"`)
- [ ] **Step 2:** `ALLOWLIST` ต้องเหลือเฉพาะรายการที่มีเหตุผลจริง ห้ามมี `"pending migration"` เหลืออยู่ ให้เพิ่ม test case `it("has no pending-migration entries")` แล้วรันเทสต์ต้อง PASS
- [ ] **Step 3:** รัน typecheck และ eslint ต้องผ่าน แล้ว commit `refactor: เซลล์ตารางทุกโมดูลใช้ขนาดตามหน้าที่`

### Task 8: ขนาดนอก ladder + หน้า `/design-system` + วัดหลังแก้

**Files:**
- Modify: `components/ui/calendar.tsx:92,101` `text-[0.8rem]` → `text-xs`
- Modify: `components/ui/badge.tsx:52` `text-[0.8125rem]` → `text-xs` และ `:54` `text-[0.9375rem]` → `text-sm`
- Modify: `routes/inventory-management/spot-check/sc-form.tsx:193` h1 → `text-lg` (ลบตัวขยายขนาดแบบ responsive)
- Modify: `routes/design-system/sections/typography.tsx` แก้ note ของ `text-sm` ("body" → ไม่ใช่ body แล้ว) และเพิ่ม `DsSection` "Roles" ที่เรนเดอร์ตัวอย่างจริงของทั้ง 12 หน้าที่ และแถวตารางตัวอย่างที่ใช้ `CellText` + `CellSub`
- Modify: `docs/superpowers/plans/2026-11-25-typography-role-defaults-baseline.md` (เพิ่มคอลัมน์ "หลังแก้")

- [ ] **Step 1:** แก้ขนาดนอก ladder ตามรายการ แล้วรัน `grep -rnE "text-\[[0-9.]+(rem|px)\]" routes components --include='*.tsx'` ต้องเหลือเฉพาะ `auth-split-shell.tsx`
- [ ] **Step 2:** เพิ่ม section Roles ในหน้า `/design-system` แล้วเปิดดูทั้งสองธีม
- [ ] **Step 3:** วัดหน้าตัวแทนชุดเดียวกับ Task 1 ที่ font scale `normal` และ `biggest` ทั้งธีมสว่างและมืด แล้วเติมคอลัมน์ "หลังแก้" เกณฑ์ผ่านคือ (ก) ทุกค่าตรงกับหน้าที่ในตาราง (ข) หัวไม่เล็กกว่าเนื้อหาที่กำกับ (ค) ไม่มี horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`) และสระบน/วรรณยุกต์ไม่ถูกตัด ถ้าจุดไหนไม่ผ่าน ให้ใส่ class ตามตารางที่จุดนั้น ห้ามยกค่า body กลับขึ้น
- [ ] **Step 4:** รัน `bun test:run` ทั้งชุดต้องเขียว (หรือ fail เฉพาะเทสต์ที่ fail อยู่แล้วบน main ซึ่งต้องจดไว้) จากนั้น `bun run typecheck` และ `trail check` ต้องผ่าน
- [ ] **Step 5:** commit `feat(design-system): แสดงตารางหน้าที่ของตัวอักษร และปัดขนาดนอก ladder`
