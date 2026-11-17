# แก้บรรทัด JV ฉบับร่างได้ (รวม dimension)

งานคร่อม 2 รีโป: carmen-turborepo-backend (micro-business + gateway) และ carmen-frontend

## เหตุผล

user กด Edit ที่ JV ฉบับร่างแล้วแก้ dimension ไม่ได้ ระหว่างไล่หาสาเหตุพบว่า `PATCH /api/:bu/gl-jv/:id`
แก้ได้แค่ส่วนหัว (วันที่ / description / note / is_adjustment) ใน `gl-jv.service.ts` `update()` ส่วน FE ก็ส่งไปแค่ส่วนหัว
(`journal-voucher-http-repository.ts` `update()`) แต่ในโหมด Edit FE ยังเปิดให้แก้บัญชี, cost center, comment, จำนวนเงิน
และเพิ่ม/ลบบรรทัดได้ **กด Save แล้วการแก้บรรทัดหายเงียบ ๆ** ทั้งที่ขึ้นว่าบันทึกสำเร็จ (อ่านจากโค้ด ยังไม่ได้ลองกดจริง)
dimension ถูกล็อกไว้ด้วยเหตุผลนี้ (`savedDimensionsReadOnly`)

user ตัดสินใจ: หลังสร้าง JV ฉบับร่างแล้ว ต้องแก้ได้ทุกอย่างในบรรทัด

## เป้าหมาย / ไม่ใช่เป้าหมาย / ห้ามเกิด

- **เป้าหมาย:** JV สถานะ `draft` ที่ไม่ได้มาจากระบบอื่น แก้บรรทัดได้ครบ (บัญชี, cost center, comment, เดบิต/เครดิต, สกุลเงิน/อัตรา, dimension, เพิ่ม/ลบ/สลับลำดับ) แล้วบันทึกได้จริง
- **ไม่ใช่เป้าหมาย:** แก้บรรทัดของใบที่ `in_review` / `scheduled` / `posted` / `void` หรือ JV ที่ระบบสร้าง (AP/GRN/inventory…) และ JV template
- **ห้ามเกิด:**
  - บันทึกแล้วใบไม่สมดุล หรือ dimension ผิดกฎผังบัญชี (ต้องผ่านตัวตรวจชุดเดียวกับตอนสร้าง)
  - การแก้แค่ส่วนหัว (ไม่ส่ง `details`) ทำบรรทัดเดิมหาย
  - บันทึกทับการแก้ของคนอื่น (ใช้ `doc_version` เดิม)

## Approaches

1. **ส่งบรรทัดทั้งชุดแทนที่ของเดิม (`details.replace`):** **user เลือก** ใช้ตัวตรวจและตัวคำนวณยอดของ create ได้เกือบทั้งหมด
   ตรงกับธรรมชาติของ JV ที่ต้องตรวจทั้งใบ id บรรทัดเปลี่ยนทุกครั้ง แต่ไม่มีอะไรอ้างถึงนอกจากตาราง dimension ซึ่ง cascade
2. `details.add/update/delete` แบบ PR/PO: id คงเดิม แต่ FE ต้องติดตาม id ที่บันทึกแล้ว และ BE ต้องรวมของเดิมกับส่วนต่างก่อนตรวจ — ไม่เลือก
3. endpoint แก้เฉพาะ dimension: ไม่ปิดปัญหาบรรทัดหายเงียบ ๆ — ไม่เลือก

## Design

### Backend (carmen-turborepo-backend)
- `IUpdateGlJv` เพิ่ม `currency_id?` / `exchange_rate?` (ถ้ายังไม่รับ) และ `details?: { replace: IGlJvLine[] }` (รูปบรรทัดเดียวกับ `details.add` ของ create)
- `GlJvService.update()` ทำทั้งหมดใน `$transaction`:
  - ใบต้องไม่ถูกลบ ถ้า posted/void คืน `GL_JV_IMMUTABLE` เหมือนเดิม และ **ถ้ามี `details` ใบต้องเป็น `draft` และ `source = manual`**
    (ไม่งั้นคืน `GL_JV_IMMUTABLE` หรือรหัสใหม่ใน error catalog ถ้าจำเป็น) `in_review` ยังแก้ส่วนหัวได้ตามเดิม
  - มี `details.replace`: `stripBaseAmounts` → `validateJvLines(tx, lines, headerRate)` →
    `validateLineDimensions(tx, lines, jv_date ใหม่หรือเดิม)` (ใช้ `DIMENSION_EXEMPT_SOURCES` กับ `source` ของใบ)
    → ลบ `tb_gl_jv_detail` เดิมของใบ (dimension ถูก cascade) → สร้างใหม่ด้วยรูปเดียวกับ create
    → `writeLineDimensions` → อัปเดต `total_debit`/`total_credit` ของส่วนหัว
  - แยก helper สร้างแถว detail ออกจาก `createInternal` เพื่อให้ create และ update ใช้ร่วมกัน
  - ส่วนหัวใช้ `where: { id, doc_version }` + `increment` เหมือนเดิม (409 เมื่อเวอร์ชันไม่ตรง)
  - ไม่ส่ง `details` = พฤติกรรมเดิมทุกอย่าง
- Gateway: `GlJvUpdateRequestSchema` เป็น passthrough อยู่แล้ว ให้เพิ่มเอกสาร swagger ของ `details.replace` ใน `GlJvUpdateRequestDto` และตรวจว่า gateway ส่ง body ต่อไปครบ
- validate ขั้นต่ำของ `details.replace`: อย่างน้อย 2 บรรทัด เหมือน create

### Frontend (carmen-frontend)
- `journal-voucher-http-repository.ts` `update()`: ส่ง `details: { replace: await buildLineRequests(...) }` เมื่อ input มี `lines`
  (ส่วนหัวคงเดิม รวมถึง currency) และใน `buildLineRequests` ส่ง `dimensions` ทุกครั้ง (ส่ง `[]` ได้ เพื่อให้ล้างค่าได้)
- `accounting-document-detail.tsx`:
  - ช่องเลือก dimension ใช้ได้ทั้งตอนสร้างและตอนแก้ (`isNew && !isView` → `!isView`)
  - ลบข้อความ `savedDimensionsReadOnly` (และคีย์ใน messages) ออก
  - เปลี่ยนบัญชีแล้วล้าง dimension ของบรรทัดอยู่แล้ว ใช้ต่อ
- ช่องบรรทัดเปิดให้แก้เฉพาะเมื่อ `can_edit_accounting_fields` (draft + ไม่ใช่ generated) ตามเดิม

### ลำดับ deploy
BE (micro-business + gateway) ก่อน FE ถ้า FE ขึ้นก่อน backend เก่าจะทิ้ง `details` เงียบ ๆ (ซึ่งก็คือพฤติกรรมวันนี้ ไม่แย่ลง)
ไม่มี migration ไม่มี api_name ใหม่ (ใช้ endpoint PATCH เดิม)

## ปล่อยให้ผู้ลงมือตัดสินเอง
- ชื่อ helper ที่แยกออกมา และจะใช้รหัส error เดิมหรือเพิ่มรหัสใหม่สำหรับ "แก้บรรทัดได้เฉพาะ draft"
- การ refetch หลังบันทึก (`update()` ฝั่ง FE ดึงทั้งใบใหม่อยู่แล้ว)
