# Accounting → สี่โมดูลบนสุด Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ย้าย `/accounting/*` ไปเป็น `/general-ledger`, `/accounts-payable`, `/accounts-receivable`, `/asset` และทำให้ทั้งสี่เป็นโมดูลบนสุดของ `moduleList` จริง

**Architecture:** แยก block ใน `routes/router.tsx` เป็นสี่ block ที่ใช้ไฟล์ `lazy` ชุดเดิม เพิ่ม route `accounting/*` สำหรับ redirect URL เก่า ลบ wrapper `accounting` และ `findAccountingSection` ออก แล้วให้ทุกจุดใช้ `findActiveModule` ตัวเดียว โฟลเดอร์ `routes/accounting/` อยู่ที่เดิม

**Tech Stack:** React Router 7 data router, TypeScript, Vitest, bun

**Spec:** `docs/superpowers/specs/2026-11-26-accounting-top-level-routes-design.md`

## Global Constraints

- **ไม่เขียนเทสต์ใหม่:** ไม่สร้างไฟล์ `*.test.ts(x)` ใหม่ และข้ามขั้น "write failing test" (ตามที่ user ตั้งไว้) แต่**เทสต์เดิมที่อ้าง path หรือโครงเก่าต้องแก้ให้ผ่าน**
- **static check ต้องรันทุก task:** `bun run typecheck` และ `bunx eslint <ไฟล์ที่แก้>`
- **ห้ามแตะ:** permission key, license key (`accounting.gl`, `accounting.gl.jv_template`, `accounting.ap`, `accounting.ar`, `accounting.asset`), `interface/accounting/*`, API path, `entitlementOf("accounting", …)`, `interface-registry.ts`
- **ชื่อ (`name`) ของสี่โมดูลคงเดิม:** `generalLedger`, `accountsPayable`, `accountsReceivable`, `asset` (key แปลภาษามีอยู่แล้ว)
- **commit message เป็นภาษาไทย**
- **ห้าม import ข้ามโมดูล:** ESLint บังคับ และ `routes/accounting/*` ยังนับเป็นโมดูลเดียว

## ตารางแปลง path (ใช้ทุก task)

ทำตามลำดับนี้ prefix ต้องมี `"`, `'`, `` ` `` หรือ `(` นำหน้า เพื่อไม่ให้ไปโดน `interface/accounting`

1. `/accounting/accounts-payable` → `/accounts-payable`
2. `/accounting/accounts-receivable` → `/accounts-receivable`
3. `/accounting/asset` → `/asset`
4. `/accounting/cheque-reconciliation` และ `/accounting/output-tax` → `/accounts-receivable/…`
5. `/accounting/<อื่น ๆ>` → `/general-ledger/<อื่น ๆ>`
6. `/accounting` ที่จบด้วย quote, `?` หรือ `#` → `/general-ledger`

## Review Focus

1. **บุ๊กมาร์กเก่าที่มี query:** `/accounting/accounts-payable/invoice?status=draft` ต้องไปถึง `/accounts-payable/invoice?status=draft` โดย query ยังครบ → ตรวจมือใน Task 5
2. **URL เก่าที่ redirect สองต่อ:** `/accounting/accounts-receivable/preview/invoice` → `/accounts-receivable/preview/invoice` → `/accounts-receivable/invoice` ต้องไม่วนลูป → ตรวจมือใน Task 5
3. **prefix ชนกันใน `findActiveModule`:** ตอนนี้ใช้ `startsWith` ไม่มีขอบเขต `/` พอมีโมดูล `/asset` แล้ว path อย่าง `/assets…` ในอนาคตจะติดโมดูลผิด → Task 2 ใส่ boundary และแก้เทสต์เดิมใน `accounting-navigation.test.ts` ให้ครอบกรณีนี้
4. **หน้าที่อ่านชนิดเอกสารจาก pathname:** ได้แก่ `accounting-document-list.tsx:250` (`startsWith("/accounting/asset/")`), `ap-document-page.ts` (`base`) และ `accounting-document-model.ts` ถ้าแก้หลุด หน้าเปิดได้แต่แสดงคอลัมน์หรือชนิดผิด → Task 3 แก้ แล้ว Task 5 เปิดดู deposit, debit-note, credit-note, asset register และ disposal
5. **launcher และ sidebar ต้องใช้ภาพ tile ของ accounting ต่อไป:** ตอนนี้ SubTile ใช้ `parentName="accounting"` ถ้าหลุด tile จะเปลี่ยนเป็นสีหรือภาพของ config → Task 2 (`tileParent`) แล้ว Task 5 ดูด้วยตา

---

### Task 1: Router — สี่ block + redirect URL เก่า

**Files:**
- Create: `routes/accounting/shared/legacy-accounting-path.ts`
- Modify: `routes/router.tsx` (block `path: "accounting"` บรรทัดประมาณ 915–1190)
- Modify (เทสต์เดิม): `routes/__tests__/router-layout.test.ts`

**Interfaces:**
- Produces: `legacyAccountingPath(pathname: string, search: string): string` รับ pathname ที่ขึ้นต้นด้วย `/accounting` แล้วคืน path ใหม่ตามตารางข้อ 1–6 โดยต่อ `search` ท้าย ใช้ boundary `/` เสมอ ตัวอย่างเช่น `/accounting/assetx` ไม่นับเป็น asset แต่ไปเป็น `/general-ledger/assetx`

- [ ] **Step 1: เขียน `legacyAccountingPath`** ใน `routes/accounting/shared/legacy-accounting-path.ts`
- [ ] **Step 2: แยก block `accounting` ใน `router.tsx` เป็นสี่ block** ภายใต้ `ProtectedShell` children ตำแหน่งเดิม ทุก block ใส่ `ErrorBoundary: RouteErrorBoundaryAdapter` และใช้ `lazy` import ตัวเดิมทุกตัว
  - `general-ledger`: index (accounting-dashboard), `journal-voucher[/:id]`, `template-voucher[/:id]`, `recurring-voucher[/:id]`, `allocation-voucher[/:id]`, `settings`, `financial-reports[/:id]`
  - `accounts-payable`: index (ap-dashboard), `invoice[/:id]`, `deposit[/:id]`, `debit-note[/:id]`, `credit-note[/:id]`, `payment[/:id]`, `payment-approvals`
  - `accounts-receivable`: index (ar-dashboard), `cheque-reconciliation`, `output-tax`, `advance-deposit`, `profile[/:id]`, `invoice[/:id]`, `folio`, `receipt[/:id]`, `preview`, `preview/invoice[/:id]`, `preview/folio`, `preview/contracts`, `preview/profiles`, `contract`
    - `Navigate` ทุกตัวในกลุ่มนี้ชี้ `/accounts-receivable/...`
  - `asset`: index (accounting-dashboard), `register[/:id]`, `disposal[/:id]`
- [ ] **Step 3: เพิ่ม redirect ของ URL เก่า** ใส่ `{ path: "accounting/*", loader: ({ request }) => { const u = new URL(request.url); return redirect(legacyAccountingPath(u.pathname, u.search)); } }` แทน block เดิม แล้วลบ redirect เดี่ยว `cheque-reconciliation` และ `output-tax` ออก (ตารางข้อ 4 ครอบแล้ว) splat `accounting/*` ครอบ `/accounting` เปล่า ๆ ด้วย จึงไม่ต้องมี route แยก
- [ ] **Step 4: แก้ `router-layout.test.ts`** ให้ assert ว่า protected shell มี path `general-ledger`, `accounts-payable`, `accounts-receivable`, `asset` และ `accounting/*` ส่วน `appRoot.children` ไม่มีตัวไหนในกลุ่มนี้
- [ ] **Step 5: ตรวจ**
  - Run: `bun run typecheck && bunx eslint routes/router.tsx routes/accounting/shared/legacy-accounting-path.ts && bun test:run routes/__tests__/router-layout.test.ts`
  - Expected: ไม่มี error และเทสต์ผ่าน
- [ ] **Step 6: Commit** `git commit -m "feat: แยก route บัญชีเป็น /general-ledger /accounts-payable /accounts-receivable /asset และ redirect URL เก่า"`

### Task 2: moduleList + sidebar / launcher / breadcrumb / dashboard

**Files:**
- Modify: `constant/module-list.ts` (`ModuleDto` บรรทัด 73, `accountingModuleSections` 156–335, `findAccountingSection` 338, entry `accounting` 640, `findActiveModule` 1030)
- Modify: `components/sidebar/side-main.tsx:76-80,122-127`
- Modify: `components/navbar/module-app.tsx:26-39`
- Modify: `components/navbar/path-breadcrumb.tsx:120-160`
- Modify: `routes/accounting/dashboard/accounting-dashboard.tsx`
- Modify (เทสต์เดิม): `constant/accounting-navigation.test.ts`, `components/sidebar/side-main.test.tsx`, `components/navbar/module-app.test.tsx`, `components/navbar/__tests__/path-breadcrumb.test.tsx`, `constant/module-list.license-feature.test.ts` (comment บรรทัด 37)

**Interfaces:**
- Consumes: path ใหม่จาก Task 1
- Produces:
  - `ModuleDto.tileParent?: string` ภาพ tile ที่ยืมของโมดูลแม่ สี่โมดูลบัญชีตั้งเป็น `"accounting"`
  - `findActiveModule(pathname)` match แบบ `pathname === mod.path || pathname.startsWith(mod.path + "/")`
  - ลบ `findAccountingSection` และ `accountingModuleSections` ออกจาก export

- [ ] **Step 1: แก้ `module-list.ts`**
  - แทน path ตามตาราง
  - spread สี่ section (ตั้ง `tileParent: "accounting"`) ลง `moduleList` ตรงตำแหน่ง entry `accounting` เดิม
  - ลบ wrapper และ `findAccountingSection`
  - ใส่ boundary ให้ `findActiveModule`
  - แก้ comment เรื่อง license (บรรทัด 150–155) ให้บอกว่าสี่โมดูลเป็นโมดูลบนสุด
- [ ] **Step 2: `side-main.tsx`** ให้ `sidebarModule = activeModule` และส่ง AppTile เป็น `name={sidebarModule.tileParent ?? sidebarModule.name}`
- [ ] **Step 3: `module-app.tsx`** ลบ `flatMap` พิเศษ แล้ว map เป็น `{ module: mod, tileParentName: mod.tileParent }` ตรง ๆ
- [ ] **Step 4: `path-breadcrumb.tsx`** ลบ `accountingSection`, การ `continue` และ `keyOverride` ที่เกี่ยวข้องทั้งหมด เพราะ `PATH_TO_KEY` สร้างจาก `moduleList` อยู่แล้ว `/general-ledger` จึงได้ key `generalLedger` เอง
  - ถ้าไม่มี caller อื่นใช้ `keyOverride` แล้ว ให้ลบ field ทิ้ง
- [ ] **Step 5: `accounting-dashboard.tsx`** ใช้ `findActiveModule(pathname)?.name` แทน `findAccountingSection` คง fallback `"generalLedger"` ไว้
- [ ] **Step 6: แก้เทสต์เดิมให้ตรงโครงใหม่**
  - `accounting-navigation.test.ts`: ทดสอบผ่าน `findActiveModule` และใช้ path ใหม่ในตาราง `it.each` เพิ่มแถว `["/assetx", undefined]` ใน it.each เดิม สำหรับ Review Focus ข้อ 3 (เพิ่มเคสในไฟล์เดิม ไม่ได้สร้างไฟล์ใหม่) ส่วนเคส "four launcher modules in display order" ให้ assert ลำดับใน `moduleList`
  - `side-main.test.tsx` และ `module-app.test.tsx`: เปลี่ยน mock จาก wrapper `accounting` เป็นสี่โมดูลที่มี `tileParent`
  - `path-breadcrumb.test.tsx`: เปลี่ยน path ตามตาราง
- [ ] **Step 7: ตรวจ**
  - Run: `bun run typecheck && bunx eslint constant components/sidebar components/navbar routes/accounting/dashboard && bun test:run constant components/sidebar components/navbar`
  - Expected: ผ่านทั้งหมด และ `grep -rn findAccountingSection --include='*.ts*' . --exclude-dir=node_modules` ว่าง
- [ ] **Step 8: Commit** `git commit -m "refactor: ยก GL/AP/AR/Asset เป็นโมดูลบนสุดของ moduleList และลบ findAccountingSection"`

### Task 3: แทนลิงก์ทั้งหมดในโค้ด

**Files (ไฟล์ที่ยังอ้าง `/accounting` หลัง Task 1–2):**
- `routes/accounting/**` ทั้งไฟล์ปกติและเทสต์ (ประมาณ 32 ไฟล์) โดยเฉพาะ
  - `ap-document-page.ts:4`
  - `accounting-document-model.ts:31-56`
  - `accounting-document-list.tsx:250`
  - `use-ar-register.ts:27`
  - `journal-voucher-source.ts:72-74`
  - `jv-template-config.ts:22-36`
  - `dashboard-mock-data.ts`
- `routes/procurement/goods-receive-note/grn-journal-tab.tsx:64`
- `routes/system-admin/workflow/wf-structure-lock-notice.tsx:32-55`

**Interfaces:** ไม่มีตัวใหม่ เป็นการแทน string ตามตาราง

- [ ] **Step 1: แทน prefix ตามตารางข้อ 1–6** ทีละไฟล์ (ใช้ sed หรือสคริปต์ก็ได้ แต่ต้องรันตามลำดับ) แล้วไล่อ่าน diff ทุกบรรทัด path ที่ประกอบแบบ `` `/accounting/${x}` `` ต้องดูว่า `x` อาจเป็นอะไร แล้วแปลงให้ถูกเป็นรายจุด
- [ ] **Step 2: ตรวจว่าไม่มีอะไรหลุด**
  - Run: `grep -rnE "[\"'\`(]/accounting([/\"'\`?#]|$)" --include='*.ts' --include='*.tsx' --include='*.json' components constant hooks lib routes types messages`
  - Expected: เหลือเฉพาะ `routes/router.tsx` (route `accounting/*`) กับ `routes/accounting/shared/legacy-accounting-path.ts`
- [ ] **Step 3: ตรวจ**
  - Run: `bun run typecheck && bun run lint && bun test:run`
  - Expected: ผ่านทั้งหมด ถ้ามีเทสต์ที่แดงอยู่แล้วบน main ให้รายงานแยก ห้ามแก้เกินขอบเขต
- [ ] **Step 4: Commit** `git commit -m "refactor: เปลี่ยนลิงก์หน้าบัญชีทั้งหมดเป็น path ใหม่"`

### Task 4: รีโป e2e

**Files:** `../carmen-frontend-e2e/tests/820-accounting-settings.spec.ts` (บรรทัด 11, 14, 23, 43, 69, 73, 84, 108) และไฟล์อื่นในรีโปนั้นที่ grep เจอ

- [ ] **Step 1:** ใน `carmen-frontend-e2e` ตรวจ `git ls-remote --heads origin` ก่อน แล้วแตก branch `feature/accounting-top-level-routes` จาก `main`
- [ ] **Step 2:** แทน path ตามตาราง ทั้งใน `page.goto`, ค่าคงที่ และข้อความ step หรือชื่อเทสต์ จากนั้นรัน `grep -rn "/accounting" tests` ซึ่งต้องว่าง
- [ ] **Step 3:** รัน type check ของรีโปนั้น (`bunx tsc --noEmit` หรือสคริปต์ที่มีใน package.json) ไม่ต้องรัน e2e สด
- [ ] **Step 4: Commit** `git commit -m "test: ใช้ path ใหม่ของโมดูลบัญชี (/general-ledger, /accounts-payable)"` ห้าม push จนกว่า FE จะ merge

### Task 5: ตรวจทั้ง branch + ตรวจมือในเบราว์เซอร์

- [ ] **Step 1:** รัน `bun run typecheck && bun run lint && bun test:run` บน branch และ `trail check` ต้องผ่าน
- [ ] **Step 2: ตรวจมือ** รัน `bun dev` แล้วเปิดเบราว์เซอร์ (ข้อนี้ไม่ข้าม) แล้วดูว่า:
  - launcher (⌘K) ยังมีสี่ tile ภาพเดิม และกดแล้วไป URL ใหม่ (Review Focus ข้อ 5)
  - sidebar และ breadcrumb ของแต่ละโมดูลถูกต้อง: `/general-ledger/journal-voucher`, `/accounts-payable/invoice`, `/accounts-receivable/receipt`, `/asset/register`
  - หน้า AP deposit, debit-note และ credit-note กับ asset register และ disposal แสดงชนิดเอกสารและคอลัมน์ถูก (Review Focus ข้อ 4)
  - เปิด URL เก่า `/accounting`, `/accounting/journal-voucher`, `/accounting/accounts-payable/invoice?status=draft`, `/accounting/accounts-receivable/preview/invoice`, `/accounting/cheque-reconciliation` และ `/accounting/asset/disposal` แล้วต้องไปถึงที่ใหม่ โดย query ครบและไม่วนลูป (Review Focus ข้อ 1–2)
  - ดูทั้งธีมสว่างและมืด
- [ ] **Step 3:** ไม่ต้อง deploy คู่กับ backend เพราะเป็นงาน FE ล้วน รอ user อนุมัติก่อน push หรือเปิด PR
