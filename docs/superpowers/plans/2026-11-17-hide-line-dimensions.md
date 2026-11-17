# ซ่อน dimension รายบรรทัด + AP ตามกฎผังบัญชี Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ซ่อน dimension รายบรรทัดใน PR/PO/GRN/SR/IA ด้วยสวิตช์ runtime `LINE_DIMENSIONS_ENABLED` (ค่าเริ่มต้นคือปิด) และทำให้ AP Invoice แสดง dimension ตามกฎผังบัญชีเหมือน AR/JV

**Architecture:** เพิ่มคีย์ใน `RuntimeConfig` แล้วให้ `useLineDimensionsEnabled()` ตรวจคีย์นี้ก่อน (gate เดียวที่ทั้ง 5 เอกสารใช้ร่วมกัน) ส่วน AP เปลี่ยน `InvoiceDimensions` ให้ใช้ `readCoaRules` + `visibleLineDimensions` ตามแบบ `ArLineDimensions`

**Tech Stack:** React 19, TanStack Query, Vite, Vitest

**Spec:** `docs/superpowers/specs/2026-11-17-hide-line-dimensions-design.md`

## Global Constraints

- **ข้ามขั้นเขียนเทสต์ใหม่** (ตาม CLAUDE.md ของ user) ให้รันแค่ `bun run typecheck`, `bun run lint` และเทสต์เดิมต้องผ่าน
- คีย์ config ชื่อ `LINE_DIMENSIONS_ENABLED` ถ้าไม่มี / ไม่ใช่ boolean / config ยังไม่โหลด = `false`
- commit message เป็นภาษาไทย
- ไม่แตะ `/config/dimension`, การ์ด CoA, AR, JV

## Review Focus

- config ยังไม่โหลด (เทสต์ หรือ render ก่อน boot เสร็จ): ต้องไม่ throw แต่ได้ `false` (ใช้ try/catch แบบ `isEnforcementEnabled()` ใน `hooks/use-license.ts:232`)
- สวิตช์ปิดแต่บรรทัดมี dimension ที่บันทึกไว้แล้ว: save ต้องไม่ส่ง `dimensions` (ค่าเดิมต้องไม่หาย) ซึ่ง `lineDimensionsPayload(item, false)` จัดการให้อยู่แล้ว ให้ตรวจว่าทุก call site ยังรับค่าจาก hook
- AP บรรทัดที่ยังไม่เลือกบัญชี: ต้องไม่มีปุ่ม Dimensions
- AP บรรทัดที่มีค่าบันทึกไว้แล้ว แต่ตอนนี้บัญชีห้าม (prohibited) หรือ dimension ถูกปิด: ต้องยังเห็นค่าเดิม (helper ทำให้อยู่แล้ว)
- AP เปลี่ยนบัญชีขณะเปิดส่วน Dimensions อยู่: รายการต้องคำนวณใหม่ตามบัญชีใหม่

---

### Task 1: สวิตช์ `LINE_DIMENSIONS_ENABLED`

**Files:**
- Modify: `lib/runtime-config.ts` (interface + `loadRuntimeConfig`)
- Modify: `hooks/use-line-dimensions-enabled.ts`
- Modify (มือ, gitignored): `public/config.local.json`, `public/config.dev.json` → `"LINE_DIMENSIONS_ENABLED": true`
- Modify: `public/config.sample.json` → `"LINE_DIMENSIONS_ENABLED": false` (ถ้าไฟล์ถูก track)
- Modify: `docs/deploy.md` → เพิ่มบรรทัดว่าต้องเติมคีย์นี้ใน config ของแต่ละ env ด้วยมือ (ไม่ตั้ง = ซ่อน)

**Interfaces:**
- Produces: `RuntimeConfig.LINE_DIMENSIONS_ENABLED?: boolean`; `useLineDimensionsEnabled(): boolean` (signature เดิม)

- [ ] **Step 1:** เพิ่ม `LINE_DIMENSIONS_ENABLED?: boolean` ใน `RuntimeConfig` พร้อม JSDoc (เหตุผล: ฟีเจอร์ยังไม่พร้อมขาย, default false, ไฟล์ config ถูก gitignore ต้องเติมมือ) และอ่านค่าใน `loadRuntimeConfig` เฉพาะเมื่อ `typeof === "boolean"` เหมือน `LICENSE_ENFORCEMENT`
- [ ] **Step 2:** ใน `use-line-dimensions-enabled.ts` เพิ่มฟังก์ชันภายใน `isLineDimensionsSwitchOn(): boolean` (try/catch `getRuntimeConfig()` → `false`) แล้วเปลี่ยนเป็น `const licensed = isLineDimensionsSwitchOn() && isLicensed(DIMENSION_LICENSE_FEATURE);` hook ยังต้องเรียก `useLicense()` / `useGlDimensions()` ตามลำดับเดิมเสมอ (กฎของ hooks) แก้ JSDoc ของ hook ให้ระบุเงื่อนไขทั้ง 3 ข้อ
- [ ] **Step 3:** แก้ config local/dev/sample + `docs/deploy.md`
- [ ] **Step 4:** รัน `bun run typecheck && bun run lint && bun test:run` ต้องผ่าน ถ้ามีเทสต์เดิมที่คาดว่าช่อง dimension จะขึ้น ให้เติม `setRuntimeConfigForTests({ ..., LINE_DIMENSIONS_ENABLED: true })` ในเทสต์นั้น
- [ ] **Step 5:** commit `feat(dimension): ซ่อน dimension รายบรรทัดด้วยสวิตช์ LINE_DIMENSIONS_ENABLED (ค่าเริ่มต้นปิด)` (อย่า add `package.json` ที่ค้างอยู่ใน working tree)

### Task 2: AP Invoice แสดง dimension ตามกฎผังบัญชี

**Files:**
- Modify: `routes/accounting/accounts-payable/invoice/ap-invoice-lines.tsx` (dialog ประมาณบรรทัด 545–600, `InvoiceDimensions` ประมาณบรรทัด 785)

**Interfaces:**
- Consumes: `useChartOfAccountById(id?: string)` (`hooks/use-chart-of-account.ts`), `readCoaRules(bu, id)` / `coaRulesKey(bu, id)` (`lib/coa-dimension-rules.ts`), `visibleLineDimensions(dimensions, account, rules, selected: {dimension_id, dimension_value_id}[])` (`routes/accounting/documents/journal-line-dimensions.ts`), `useBuCode()`
- อ้างอิงแบบ: `ArLineDimensions` ใน `routes/accounting/accounts-receivable/ar-invoice-line-dialog.tsx:227-275` ข้าม module ได้ (อยู่ใน `routes/accounting/` เหมือนกัน)

- [ ] **Step 1:** ย้ายการคำนวณขึ้นไปไว้ที่ระดับ dialog (หรือทำเป็น hook ในไฟล์เดียวกัน เช่น `useVisibleInvoiceDimensions(line)`) ให้ได้ `visible` จาก `useChartOfAccountById(line.dr_chart_of_accounts_id || undefined)` + query `readCoaRules` (`enabled: !!bu && !!line.dr_chart_of_accounts_id`) + `useGlDimensions(hasDimensions)` / `useGlDimensionValues(hasDimensions)` โดย `hasDimensions` คิดแบบเดียวกับ AR และต้อง map `selected` จาก `gl_dimension_id/gl_dimension_value_id` เป็น `dimension_id/dimension_value_id`
- [ ] **Step 2:** ปุ่ม "Dimensions · N" + ส่วนที่กางออก render เฉพาะเมื่อ `visible.length > 0` และ `InvoiceDimensions` วน `visible` แทน `.filter(is_active || selected)` เดิม ส่วน error/retry และการเลือกค่าคงเดิม
- [ ] **Step 3:** รัน `bun run typecheck && bun run lint && bun test:run routes/accounting` ต้องผ่าน
- [ ] **Step 4:** commit `feat(ap): แสดง dimension ของบรรทัด AP ตามกฎผังบัญชีเหมือน AR/JV`

### Task 3: ตรวจด้วยมือในเบราว์เซอร์ (ห้ามกด Save เพราะ dev DB ใช้ร่วมกัน)

- [ ] สวิตช์ปิด (ลบคีย์ออกจาก `config.local.json` ชั่วคราว): เปิด `/procurement/purchase-request/a2868b12-0252-4cdd-9e3e-69cdfb1bc629` แล้วกางแถว ต้องไม่มีช่อง Dimension และต้องไม่มี request `gl-dimension` ใน network ส่วน PO/GRN detail ก็ต้องไม่มีเหมือนกัน
- [ ] สวิตช์เปิด: ช่องกลับมาเหมือนเดิม
- [ ] AP Invoice detail: บรรทัดที่บัญชีไม่มีกฎ → ไม่มีปุ่ม ส่วนบรรทัดที่บัญชีมีกฎ → ปุ่มขึ้นและแสดงเฉพาะ mandatory/optional
- [ ] คืนค่า `config.local.json` ให้เปิดสวิตช์ไว้เหมือนเดิม
