# Dimension ชนิด Text / Number / Date / Boolean เก็บค่าบนบรรทัดเอกสารได้

งานคร่อมรีโป: carmen-turborepo-backend (tenant schema + micro-business + gateway) และ carmen-frontend
(micro-report อ่าน `value_code` อยู่แล้ว คาดว่าไม่ต้องแก้ ต้องยืนยันตอนวางแผน)

## เหตุผล

หน้าตั้งค่า `/config/dimension` ให้เลือกชนิดได้ 5 แบบ (`lookup` = List, `string` = Text, `number`, `date`, `boolean`)
แต่ทุกเอกสารเก็บ dimension เป็นการอ้างค่าจากรายการ (`gl_dimension_value_id` NOT NULL FK ไป `tb_gl_dimension_value`)
และ FE แสดงเป็นช่องเลือกจากรายการเสมอ dimension ที่ตั้งเป็นชนิดอื่นจึงกรอกไม่ได้ในเอกสารใดเลย
(spec `carmen-turborepo-backend/docs/superpowers/specs/2026-11-16-chart-of-accounts-cost-center-dimension-design.md` บรรทัด 37
กันไว้เป็น non-goal) user พบตอนเปลี่ยน dimension "Channel" เป็น Text แล้วกรอกใน JV ไม่ได้

user ต้องการ: dimension ทุกชนิดต้องบันทึกค่าบนบรรทัดเอกสารได้จริง ("ต้องบันทึกข้อมูลหลาย ๆ ชนิดได้ เช่น ตัวเลข วันที่ ...")
Channel เป็นแค่ตัวอย่าง

## เป้าหมาย / ไม่ใช่เป้าหมาย / ห้ามเกิด

**เป้าหมาย**
- กรอกค่าตามชนิดได้ในทุกเอกสารที่มี dimension รายบรรทัด **ทั้งหมดในรอบเดียว** (user เลือก) ได้แก่
  PR, PO, GRN, SR, stock-in, stock-out (IA), AP invoice, AR invoice, JV และ dimension ของ payment type และ WHT form
  (12 ตาราง `*_dimension` ที่มี `gl_dimension_value_id` ไม่นับ `tb_gl_account_dimension_rule*`)
- ค่าแบบพิมพ์เองส่งต่อจากเอกสารต้นทางเข้าบรรทัด JV ตอนลงบัญชี (`gl-posting.service.ts`) เหมือนค่าแบบรายการ
- กฎผังบัญชีใช้กับชนิดใหม่ได้ในระดับ requirement (mandatory / optional / prohibited)
- รายงานและหน้าจอที่อ่าน `value_code` แสดงค่าได้โดยไม่ต้องแก้

**ไม่ใช่เป้าหมาย**
- default / allowed values สำหรับชนิดที่ไม่ใช่ List (ยังห้ามเหมือนเดิม — `GL_DIMENSION_CONFIG_NOT_LOOKUP`)
- การจับคู่ค่าที่พิมพ์ต่างกัน ("Grab" กับ "grab") — ค่าเท่ากันเมื่อตรงกันทุกตัวอักษร
- รายงานใหม่ / ตัวกรองช่วงตัวเลขหรือวันที่ในรายงาน (โครงสร้างรองรับแล้ว แต่ไม่ทำ UI ในงานนี้)
- เปิดสวิตช์ `LINE_DIMENSIONS_ENABLED` — เอกสารซื้อ/คลังยังซ่อนจากลูกค้าเหมือนเดิม

**ห้ามเกิด**
- ข้อมูลเดิมที่เป็นค่าแบบรายการเสียหายหรือแสดงไม่ได้หลัง migration
- บันทึกค่าผิดชนิดลงฐานข้อมูลได้ (เช่น ข้อความลงช่องตัวเลข หรือแถวที่มีทั้ง value_id และค่าพิมพ์เอง)
- เปลี่ยนชนิดของ dimension ที่มีค่าบันทึกในเอกสารแล้ว จนค่าเดิมขัดกับชนิดใหม่โดยไม่มีใครรู้

## Approaches

1. **แยกคอลัมน์ตามชนิด** — **user เลือก** เพิ่ม `value_text varchar(20)`, `value_number decimal(20,5)`,
   `value_date date`, `value_boolean boolean` ในทุกตาราง `*_dimension` + ทำ `gl_dimension_value_id` เป็น nullable
   + check constraint ให้มีค่าในช่องเดียวพอดี ฐานข้อมูลบังคับชนิด เรียงลำดับ/ค้นช่วงได้ถูกโดยไม่ cast
2. คอลัมน์ข้อความคอลัมน์เดียว (รูปแบบมาตรฐาน) — migration เล็กกว่า แต่เรียง/ค้นช่วงตัวเลขต้อง cast และไม่มีการบังคับชนิด — ไม่เลือก
3. คอลัมน์ JSON — query ในรายงานยากที่สุด ไม่มีการบังคับชนิด — ตัดทิ้ง

ขอบเขต: ทำทั้ง 10 เอกสาร (12 ตาราง `*_dimension`) ในรอบเดียว (user เลือก) แทนที่จะเริ่มจาก JV/AP/AR

## Design

### 1. Schema (tenant, migration เดียว ทุกตาราง `*_dimension` 12 ตาราง)
- `gl_dimension_value_id` → nullable (FK เดิมคงไว้)
- เพิ่ม `value_text varchar(20) NULL`, `value_number decimal(20,5) NULL`, `value_date date NULL`, `value_boolean boolean NULL`
- check constraint: มีค่าใน 5 ช่องนี้ (`gl_dimension_value_id`, `value_text`, `value_number`, `value_date`, `value_boolean`) **พอดี 1 ช่อง**
- unique เดิม `(detail_id, gl_dimension_id)` คงไว้ — บรรทัดหนึ่งมีค่าได้หนึ่งค่าต่อ dimension
- `value_code` (varchar(30) เดิม) เก็บค่าที่แสดงผลของชนิดใหม่ด้วย: text ตามที่กรอก · number เป็นข้อความรูปแบบมาตรฐาน (ไม่มีตัวคั่นหลักพัน) · date เป็น `YYYY-MM-DD` · boolean เป็น `true`/`false`
  (เก็บรูปแบบเป็นกลาง ให้ FE จัดรูปแบบตอนแสดงตาม `date_format`/locale — สอดคล้องกฎ "backend ไม่ format")
- ข้อมูลเดิมทุกแถวเป็นค่าแบบรายการ ผ่าน constraint ทันที ไม่ต้อง backfill
- deploy ตามขั้นตอน tenant migration ปกติ (ทุก BU / preflight UAT-prod ตาม learning ที่มีอยู่)
- **(ผมตัดสิน)** check constraint เพิ่มแบบ `NOT VALID` แล้ว `VALIDATE CONSTRAINT` ในไฟล์เดียวกัน เพื่อไม่ล็อกตารางนานบน BU ที่ข้อมูลเยอะ
  migration นี้ backward-compatible: โค้ดเก่าที่ยังไม่ deploy เขียนแถวแบบรายการได้ตามเดิม ไม่ต้องมีแผน rollback ข้อมูล
- `value_text` จำกัด 20 ตัวอักษรตามป้ายในหน้าตั้งค่า ("Text (Max 20 digits)") ไม่ผูกกับความยาว `value_code`

### 2. สัญญา API (เหมือนกันทุกเอกสาร)
- request ต่อ dimension ของบรรทัด: `{ gl_dimension_id, gl_dimension_value_id?: uuid | null, value?: string | number | boolean | null }`
  - ชนิด `lookup` → ต้องส่ง `gl_dimension_value_id` (เหมือนเดิม ไม่ส่ง `value`)
  - ชนิดอื่น → ต้องส่ง `value` (date เป็น `"YYYY-MM-DD"`) และไม่ส่ง `gl_dimension_value_id`
  - client เดิมที่ส่งแค่ `gl_dimension_value_id` ทำงานต่อได้ไม่ต้องแก้
- response: ทุก ref คืน `gl_dimension_id`, `gl_dimension_value_id` (nullable), `value_text`, `value_number`, `value_date`, `value_boolean`,
  `dimension_code`, `value_code` และ `data_type` ของ dimension (FE ใช้เลือกวิธีแสดง)
- endpoint และ api_name เดิมทั้งหมด ไม่มี endpoint ใหม่

### 3. ตัวตรวจกลาง (`gl-dimension.validator.ts` `validateLineDimensions`)
- โหลด `info.data_type` ของทุก dimension ที่ส่งมา แล้วตรวจตามชนิด:
  - lookup: ตรวจเหมือนเดิม (ค่าเป็นของ dimension, active, มีผล ณ วันที่, อยู่ใน allowed values)
  - string: เป็นข้อความ ตัดช่องว่างหัวท้าย ไม่ว่าง ไม่เกิน 20 ตัวอักษร
  - number: เป็นตัวเลข finite ไม่เกิน 15 หลักหน้าจุด / 5 หลักหลังจุด (ตาม decimal(20,5))
  - date: `YYYY-MM-DD` ที่เป็นวันที่จริง
  - boolean: `true`/`false` จริง (ไม่รับ `"true"` ข้อความ)
  - ส่งชนิดผิด (เช่น value_id กับ dimension ชนิด string) → error catalog ใหม่ `GL_DIMENSION_VALUE_TYPE_MISMATCH` (422, มี `dimension_code`)
- กฎ requirement (mandatory/prohibited) ใช้กับทุกชนิดเหมือนกัน
- ผลลัพธ์ที่คืน (`IResolvedDimensionValue`) ขยายให้มีค่าตามชนิด + `value_code` ที่คำนวณแล้ว เพื่อให้ writer ทุกตัวเขียนแถวได้จากผลเดียวกัน
- ทุก writer (PR, PO, GRN, SR, stock-in, stock-out, AP, AR, JV, payment type, WHT form) เปลี่ยนไปใช้ helper กลางตัวเดียว
  สร้างแถว `*_dimension` จากผลตรวจ (ตอนนี้แต่ละตัวเขียนเอง)

### 4. การลงบัญชี (`gl-posting.service.ts`) และ key ที่ใช้รวม/แยกบรรทัด
- ตอน copy dimension จากบรรทัดต้นทางไป `tb_gl_jv_detail_dimension` ให้ copy ทั้ง 4 คอลัมน์ใหม่ + `value_code` ด้วย
- **(ผมตัดสิน)** `build-dimension-signature.ts` (key ที่ใช้รวม/จัดกลุ่มบรรทัดตาม dimension) ต้องรวมค่าตามชนิดด้วย
  (เช่น `dim=v:<value_id>` สำหรับรายการ และ `dim=t:<value_code>` สำหรับชนิดอื่น) ไม่งั้นบรรทัดที่ Channel "Grab" กับ "Line"
  จะถูกนับเป็นบรรทัดเดียวกันแล้วยอดรวมผิดเงียบ ๆ — บรรทัดที่ค่าต่างกันต้องแยกกันเสมอ เหมือนค่าแบบรายการวันนี้

### 4.1 ผู้อ่าน `gl_dimension_value_id` ทุกตัวต้องรับค่า null ได้
**(ผมตัดสิน)** ขอบเขตคือทุกจุดใน backend ที่อ่านตาราง `*_dimension` ไม่ใช่แค่ writer กับ posting — ไล่ด้วย
`grep gl_dimension_value_id` แล้วแก้ทุกตัว (เช่น `dimension-value.service` usage/delete guard, `chart-of-accounts-links.plan`,
`dimension-config.*`, `accounting-master-mapping`, serializer ทุกเอกสาร, `resolved-from-stored-rows`, swagger/DTO ของ gateway)
ห้ามใช้ inner join / relation include ที่ทำให้แถวชนิดใหม่หายไป micro-report ต้องไล่ query ที่ join `tb_gl_dimension_value` ด้วยเช่นกัน

### 5. การเปลี่ยนชนิดของ dimension
- `dimension.service.ts` update: ถ้าเปลี่ยน `data_type` (ทุกทิศทาง รวมถึงเปลี่ยนกลับเป็น lookup) และ dimension นั้นมีแถวใน
  ตาราง `*_dimension` ใดก็ได้ทั้ง 12 ตาราง (นับทุกแถว ไม่สนสถานะเอกสาร) → ปฏิเสธด้วย error catalog ใหม่
  `GL_DIMENSION_TYPE_IN_USE` (422) เหตุผล: ค่าที่บันทึกแล้วจะขัดกับชนิดใหม่ **(ผมตัดสิน)** `countUsage` ขยายให้ครบ 12 ตาราง
  ทางแก้ถ้าตั้งชนิดผิด: สร้าง dimension ใหม่ที่ชนิดถูก แล้วปิด dimension เดิม
- dimension ที่ถูกเปลี่ยนชนิดไปแล้วก่อนงานนี้ (เช่น Channel บน dev): ค่าเดิมยังแสดงจาก `value_code`
  ตอนแก้บรรทัดนั้น ผู้ใช้ต้องกรอกค่าใหม่ตามชนิดปัจจุบัน (ค่าเดิมแบบรายการจะถูกแทนที่)
- **(ผมตัดสิน)** การแก้ที่ไม่แตะ dimension (เช่นแก้จำนวน) ไม่บังคับให้กรอก dimension ใหม่: writer ที่ทำงานแบบ
  "ไม่ส่ง dimensions = ไม่แตะค่าเดิม" (PR/PO/GRN/SR/IA) ไม่ตรวจแถวเดิม ส่วนเอกสารที่ส่งบรรทัดทั้งชุดทุกครั้ง (JV `details.replace`,
  AP/AR) FE จะส่งค่าเดิมกลับไปตามที่เก็บอยู่ ตัวตรวจจึงต้องยอมรับค่าแบบรายการเดิมของ dimension ที่ชนิดเปลี่ยนไปแล้ว
  **เฉพาะเมื่อเป็นค่าเดิมของบรรทัดนั้น** (ส่ง `gl_dimension_value_id` เดิมกลับมา) ค่าใหม่ต้องตรงชนิดปัจจุบันเสมอ

### 6. Frontend
- type `DimensionRef` (`types/gl-dimension.ts`) และ `JournalLineDimensionInput` เพิ่มฟิลด์ตามข้อ 2 · `DimensionMaster.data_type` มีอยู่แล้ว
- คอมโพเนนต์กลางใหม่ `components/dimension/dimension-value-input.tsx`: รับ dimension + ค่าปัจจุบัน แล้วแสดงช่องตามชนิด
  - lookup → Select เดิม (ค่าจาก `useGlDimensionValues`)
  - string → Input (maxLength 20) · number → Input ตัวเลข (ใช้ formatter ของแอป) · date → date picker ของแอป แสดงตาม `date_format`
  - boolean → Select 3 สถานะ (ว่าง / Yes / No) เพื่อให้แยก "ไม่กรอก" ออกจาก "false" ได้
  - โหมดดู: แสดง `value_code` จัดรูปแบบตามชนิด
- ใช้คอมโพเนนต์นี้ทุกจุดที่เลือก dimension ของบรรทัด: `LineDimensionFields` / `LineDimensionPopover` (PR, PO, GRN, SR, IA),
  AP `InvoiceDimensions`, AR `ArLineDimensions`, JV ใน `accounting-document-detail.tsx`, payment type, WHT form
- payload builder ทุกตัวส่งตามสัญญาข้อ 2
- `visibleLineDimensions` / กฎผังบัญชีฝั่ง FE ไม่ต้องเปลี่ยน (ทำงานระดับ dimension ไม่ใช่ค่า)

### ลำดับ deploy
tenant migration ทุก BU → micro-business + gateway → FE
FE ขึ้นก่อน BE = ส่ง `value` ไป backend เก่าที่ไม่รู้จัก → ค่าหายเงียบ ๆ (ต้องขึ้น BE ก่อนเสมอ)

## ปล่อยให้ผู้ลงมือตัดสินเอง
- ชื่อ helper กลางของ writer และวิธีแบ่ง task ตามเอกสาร
- ข้อความ error ใน catalog (EN/TH) ของรหัสใหม่ 2 ตัว
- รูปแบบตัวเลขใน `value_code` (เช่นตัดศูนย์ท้าย) ตราบที่เป็นรูปแบบกลางไม่ขึ้นกับ locale
