# แก้บรรทัด JV ฉบับร่างได้ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `PATCH /gl-jv/:id` รับ `details.replace` เพื่อแทนที่บรรทัดทั้งชุดของ JV ฉบับร่าง และ FE ส่งบรรทัด (รวม dimension) ตอนแก้

**Architecture:** micro-business `GlJvService.update()` ใช้ตัวตรวจ/ตัวสร้างบรรทัดชุดเดียวกับ `createInternal` ใน transaction เดียว ส่วน gateway ส่ง body ต่อแบบ passthrough และ FE `update()` ส่ง `details.replace` เปิดให้เลือก dimension ตอนแก้

**Tech Stack:** NestJS + Prisma (carmen-turborepo-backend), React 19 + TanStack Query (carmen-frontend)

**Spec:** `carmen-frontend/docs/superpowers/specs/2026-11-17-jv-edit-lines-design.md`

## Global Constraints

- ข้ามขั้นเขียนเทสต์ใหม่ (CLAUDE.md ของ user) ให้รันแค่ typecheck + lint และเทสต์เดิมต้องผ่าน
- BE branch `feature/jv-edit-lines` แตกจาก `main` ใน carmen-turborepo-backend และ FE ใช้ branch `feature/jv-edit-lines` (มีอยู่แล้ว)
- commit message ภาษาไทย ห้าม add `package.json` ของ FE ที่ค้างอยู่
- แก้บรรทัดได้เฉพาะ `jv_status = draft` และ `source = manual` ไม่ส่ง `details` = พฤติกรรมเดิม
- ห้ามกด Save บน dev DB ร่วม (ตรวจมือด้วย curl/เบราว์เซอร์กับ backend ในเครื่องเท่านั้น ถ้ารันได้ ไม่งั้นข้าม และรายงาน)

## Review Focus

- `details.replace` ที่ไม่สมดุล / บัญชีไม่ postable / dimension ผิดกฎ: ต้องได้ error เดิมของ create และบรรทัดเดิมต้องไม่หาย (transaction rollback)
- PATCH ที่มีแค่ส่วนหัว (ไม่ส่ง `details`): ต้องไม่ลบบรรทัด
- `details.replace` บนใบ `in_review` หรือใบที่มาจาก subledger/template: ต้องถูกปฏิเสธ (409 `GL_JV_IMMUTABLE`)
- `doc_version` เก่า: ต้องไม่ลบ/สร้างบรรทัด (เช็กเวอร์ชันก่อนลบ)
- ล้าง dimension ทุกตัวของบรรทัดใน FE: ต้องส่ง `dimensions: []` แล้วค่าเดิมต้องหายจริง (เพราะเป็น replace ทั้งบรรทัด)

---

### Task 1: Backend — `details.replace` ใน `GlJvService.update()`

**Files (carmen-turborepo-backend):**
- Modify: `apps/micro-business/src/gl/gl-jv/interface/gl-jv.interface.ts` (`IUpdateGlJv.details`)
- Modify: `apps/micro-business/src/gl/gl-jv/gl-jv.service.ts` (`createInternal` บรรทัด ~145–230, `update` ~311)
- Modify: `apps/backend-gateway/src/application/gl-jv/swagger/request.ts` (`GlJvUpdateRequestDto`)

**Interfaces:**
- Produces: body ของ PATCH `{ doc_version, ..., details?: { replace: IGlJvLine[] } }` (บรรทัดรูปเดียวกับ `details.add` ของ create) และ response เดิม `{ id, doc_version }`

- [ ] **Step 1:** `IUpdateGlJv.details` เปลี่ยนเป็น `details?: { replace: IGlJvLine[] }` (ฟิลด์ add/update/remove เดิมไม่มีโค้ดไหนใช้ — grep ยืนยันก่อนลบ ถ้ามีคนใช้ให้คงไว้แล้วเพิ่ม `replace?`)
- [ ] **Step 2:** แยก private helper `buildDetailRows(lines: IGlJvLine[], accounts: Map<…>, baseAmounts, headerRate: Prisma.Decimal, headerCurrencyId: string | null)` ที่คืน array ของ data สำหรับ `tb_gl_jv_detail` (ย้ายโค้ด `lines.map(...)` ของ `createInternal` มา) แล้วให้ `createInternal` เรียกใช้ helper นี้ — create ต้องทำงานเหมือนเดิมทุกตัวอักษร
- [ ] **Step 3:** `update()` ห่อทั้งหมดด้วย `this.prismaService.$transaction(async (tx) => …)`:
  1. อ่านใบ `select { id, jv_status, doc_version, source, jv_date, exchange_rate, currency_id }` ถ้าไม่มีให้คืน NOT_FOUND และถ้า posted/void คืน `GL_JV_IMMUTABLE` (เหมือนเดิม)
  2. ถ้ามี `data.details?.replace` และ (`jv_status !== draft` หรือ `source !== manual`) ให้คืน `GL_JV_IMMUTABLE`
  3. ถ้า `existing.doc_version !== data.doc_version` และมี `details` ให้คืน error เวอร์ชันชนแบบเดียวกับที่ prisma `update where doc_version` ให้ (ใช้ catalog เดิมของโมดูล ถ้ามี ไม่มีให้ปล่อยให้ข้อ 6 throw ตามเดิม แต่ต้องทำข้อ 6 **ก่อน** ลบบรรทัด)
  4. มี replace: `lines = replace.map(stripBaseAmounts)`, `headerRate = new Prisma.Decimal(data.exchange_rate ?? existing.exchange_rate ?? 1)` → `validateJvLines(tx, lines, headerRate)` → `validateLineDimensions(tx, lines, data.jv_date ?? existing.jv_date)` (ข้ามเมื่อ `DIMENSION_EXEMPT_SOURCES.has(existing.source)`) error ไหนก็ `return Result.error(...)` แล้วต้องไม่มีอะไรถูกเขียน (ใช้ throw-to-rollback ถ้าเขียนไปแล้ว)
  5. อัปเดตส่วหัวด้วย `where: { id, doc_version: data.doc_version }` ก่อน (ฟิลด์เดิม + `currency_id`/`exchange_rate` ถ้าส่งมา + `total_debit`/`total_credit` เมื่อมี replace)
  6. มี replace: `tx.tb_gl_jv_detail.deleteMany({ where: { jv_header_id: id } })` → `tx.tb_gl_jv_detail.createMany({ data: buildDetailRows(...).map(r => ({ ...r, jv_header_id: id })) })` → `this.writeLineDimensions(tx, id, lines, resolvedValues)`
- [ ] **Step 4:** `GlJvUpdateRequestDto` เพิ่ม `@ApiPropertyOptional` ของ `details` (`{ replace: GlJvLineRequest[] }` อธิบายว่าแทนที่ทั้งชุด ได้เฉพาะ draft/manual อย่างน้อย 2 บรรทัด) และตรวจว่า `GlJvUpdateRequestSchema` passthrough + gateway `update()` ส่ง `data` ทั้งก้อน (`gl-jv.service.ts:98`)
- [ ] **Step 5:** รัน `cd apps/micro-business && bun run check-types && bunx eslint src/gl/gl-jv` และ `cd apps/backend-gateway && bun run check-types` และ `bunx jest src/gl` ใน micro-business ต้องผ่าน (รู้ไว้ว่า gateway มีเทสต์แดงเดิม 26 suites ตาม memory ไม่ต้องแก้)
- [ ] **Step 6:** commit `feat(gl-jv): แก้บรรทัด JV ฉบับร่างได้ด้วย details.replace` บน branch `feature/jv-edit-lines`

### Task 2: Frontend — ส่งบรรทัดตอนแก้ + เลือก dimension ได้ตอนแก้

**Files (carmen-frontend):**
- Modify: `routes/accounting/journal-voucher/journal-voucher-http-repository.ts` (`buildLineRequests` ~160, `update` ~534)
- Modify: `routes/accounting/documents/accounting-document-detail.tsx` (`isNew && !isView` ~2553, `savedDimensionsReadOnly` ~2026)
- Modify: `messages/en.json`, `messages/th.json` (ลบ `accounting.documents.savedDimensionsReadOnly`)

**Interfaces:**
- Consumes: body PATCH ของ Task 1 (`details.replace`)

- [ ] **Step 1:** `buildLineRequests` ส่ง `dimensions` ทุกบรรทัด (เป็น `[]` เมื่อว่าง) — backend create รับ `[]` ได้ (ตรวจ `validateLineDimensions` กับ `[]`) แต่ถ้ามี mandatory rule ผลลัพธ์เท่าเดิม
- [ ] **Step 2:** `update()` เมื่อ `input.lines?.length` ให้ใส่ `patchPayload.details = { replace: await buildLineRequests(buCode, input.lines, input.description) }` และส่ง `exchange_rate` ของส่วนหัวถ้า input มี (ดูชื่อฟิลด์ใน `create()` ~435 แล้วใช้ให้ตรงกัน)
- [ ] **Step 3:** detail page: เงื่อนไขช่องเลือก dimension เปลี่ยนจาก `isNew && !isView` เป็น `!isView` ลบบล็อก `savedDimensionsReadOnly` และคีย์ในทั้ง 2 ไฟล์ messages ส่วนกิ่ง `if (!isView)` ที่แสดง Badge ตอนนี้กลายเป็นโค้ดตาย ให้ลบ
- [ ] **Step 4:** รัน `bun run typecheck && bun run lint && bun test:run` ต้องผ่าน (มีเทสต์ `journal-voucher-http-repository.test.ts` อยู่แล้ว ถ้าเทสต์เดิมตรึง payload ของ update ไว้ ให้ปรับให้ตรงกับพฤติกรรมใหม่)
- [ ] **Step 5:** commit `feat(jv): แก้บรรทัดและ dimension ของ JV ฉบับร่างได้ (ส่ง details.replace)`

### Task 3: ตรวจด้วยมือ

- [ ] เปิด `/accounting/journal-voucher/f36fc74a-38d2-4340-93f9-28c32e03c1aa` แล้วกด Edit: บรรทัด 1 ต้องมีช่องเลือก dimension (event) และไม่มีข้อความ read-only **ห้ามกด Save** (dev DB ร่วม และ BE ใหม่ยังไม่ขึ้น dev)
- [ ] ถ้ามี micro-business ในเครื่องที่ชี้ DB ทดสอบได้ ให้ลอง PATCH ด้วย curl ไม่งั้นข้าม และบันทึกว่ายังไม่ได้ทดสอบ end-to-end
- [ ] PR 2 ใบ (BE ก่อน FE) ใส่ลำดับ deploy ไว้ใน body **ไม่ merge** จนกว่า user สั่ง
