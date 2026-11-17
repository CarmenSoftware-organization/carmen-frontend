# Inventory line dimension: frontend design (งานย่อย 3 ฝั่ง frontend)

Spec ฝั่ง backend: `carmen-turborepo-backend/docs/superpowers/specs/2026-11-17-inventory-line-dimension-design.md`
ฝั่ง frontend ของ procurement ทำไปแล้วใน #611 (merge `193028cd`)

## เป้าหมายและเหตุผล

งานนี้ให้ผู้ใช้เลือก GL dimension เป็นรายบรรทัดได้ในเอกสาร inventory 3 ประเภทที่ backend รองรับแล้ว ได้แก่
**store requisition** (รวม transfer ซึ่งก็คือ SR ที่ `sr_type=transfer`), **stock-in** และ **stock-out**
backend กับ tenant migration ขึ้น dev ครบทุก BU แล้วเมื่อ 2026-11-17 ทุกอย่างที่ฝั่ง frontend ต้องใช้จึงพร้อมแล้ว

ในงานเดียวกันจะ**เปลี่ยน GRN** จากแถว dimension ใต้บรรทัด (`meta.footerContent`) มาเป็นปุ่มต่อบรรทัดที่เปิด popover
เพื่อให้เอกสารที่ใช้ตารางแบนทุกตัวหน้าตาเหมือนกัน (user ตัดสินใจ)

## ขอบเขต

**อยู่ในขอบเขต**
- หน้า inventory adjustment `routes/inventory-management/inventory-adjustment/` ซึ่งใช้ร่วมกันระหว่าง stock-in และ stock-out แก้หน้าเดียวได้ทั้งสองเอกสาร
- หน้า store requisition `routes/store-operation/store-requisition/`
- GRN `routes/procurement/goods-receive-note/`: เปลี่ยนแถวใต้บรรทัดเป็นปุ่มเปิด popover

**ไม่อยู่ในขอบเขต**
- spot check, count stock, physical count และ period-end เพราะ backend ไม่ได้เพิ่ม dimension ให้
- PR และ PO ยังคงใช้แบบเดิมของ #611 (PR อยู่ในแถวขยาย ส่วน PO อยู่ในแถว footer ของ comment) ไม่เปลี่ยน
- หน้า list ทุกหน้า เพราะ list endpoint ไม่ได้คืน `dimensions`
- dimension ระดับหัวเอกสาร, การส่งต่อไป inventory transaction และ JV

**สิ่งที่ห้ามเกิด**
- การแก้เฉพาะ dimension ต้องไม่ทำให้ต้นทุน (`cost_per_unit`/`total_cost`) หรือจำนวนของบรรทัดเปลี่ยน
- ห้ามเอา field JSON `dimension` (เอกพจน์) กลับมา ตัวนี้ถูกลบไปแล้วใน #612/#1072

## สัญญากับ backend (เหมือน procurement ทุกจุด)

- request: แต่ละบรรทัดใน create / `add` / `update` รับ `dimensions?: {gl_dimension_id, gl_dimension_value_id}[] | null`
  - ไม่ส่ง = ไม่แตะค่าเดิม
  - ส่งมา (รวม `[]`) = แทนที่ทั้งชุด
  - key ของรายการ: SR `details.store_requisition_detail`, SI `stock_in_detail`, SO `stock_out_detail`
- response: เฉพาะ GET รายตัวเท่านั้นที่คืน `dimensions: DimensionRef[]` (ถ้าไม่มีได้ `[]`) แต่ละตัวมี id 2 ตัว คู่กับ code/name อย่างละ 2
- backend ไม่บังคับ license gate อยู่ที่ frontend เท่านั้น ผ่าน `useLineDimensionsEnabled()` = license `configuration.dimension` และมี dimension ที่ active อย่างน้อย 1 ตัว
- backend ตรวจความถูกต้องของค่า (active, อยู่ใต้ dimension นั้น, มีผล ณ วันที่ของเอกสาร) ตอนเขียนเท่านั้น frontend ไม่ต้องตรวจซ้ำ แต่ต้องแสดง error ที่ได้จาก `/save`

## Approaches ที่พิจารณา

- **ก. แถว dimension ใต้บรรทัด แบบ GRN เดิม:** เห็นค่าทันทีโดยไม่ต้องกด แต่ตารางยาวขึ้นเกือบเท่าตัว
- **ข. ปุ่มต่อบรรทัดเปิด popover (เลือกแล้ว):** ตารางกระชับ ต้องกดปุ่มก่อนถึงจะเห็นค่า แต่ปุ่มแสดงจำนวน dimension ที่เลือกไว้ จึงพอรู้ภาพรวมได้
- ค. ใช้แถวขยายแบบ PR: ตัดทิ้ง เพราะ IA กับ SR เป็น DataGrid แบน การทำแถวขยายต้องรื้อโครงตาราง

user เลือก **ข.** และสั่งให้ GRN เปลี่ยนมาใช้แบบเดียวกัน

## Design

### คอมโพเนนต์ที่ใช้ร่วมกัน (ของใหม่ 1 ตัว)
`components/dimension/line-dimension-popover.tsx`: `<LineDimensionPopover value onChange disabled />`
- ตัว trigger เป็นปุ่มเล็กในเซลล์ แสดงจำนวนที่เลือกไว้ เช่น `Dim 2` และ `Dim —` เมื่อยังไม่ได้เลือก
- ตัวเนื้อหาใช้ `<LineDimensionFields>` ของเดิมจาก #611 โดยไม่แก้อะไร
- ตอน `disabled` (โหมดดูเอกสาร หรือบรรทัดที่ถูกล็อก) ยังเปิด popover ได้ แต่ช่องใน popover จะเป็น read-only ผู้ตรวจเอกสารจึงเห็นค่าได้เสมอ
- คอลัมน์นี้แสดงเฉพาะเมื่อ `useLineDimensionsEnabled()` เป็น true BU ที่ไม่มี license จะไม่เห็นคอลัมน์และไม่ส่งค่าใด ๆ

ส่วนที่ใช้ซ้ำจาก #611 โดยไม่แก้: `LineDimensionFields`, `useLineDimensionsEnabled`, `lineDimensionsPayload`, `clearDimensionsDirty`, `DimensionRef`/`DimensionPayload`

### การต่อสายในแต่ละเอกสาร (ใช้แบบเดียวกับ PR ใน #611)
- **schema:** แต่ละบรรทัดมี `dimensions: DimensionRef[]` (optional) และ `dimensions_dirty: boolean` ค่า default ของบรรทัดใหม่คือ `[]` และ `false` ตอนโหลดเอกสาร map `d.dimensions ?? []`
- **payload:** spread `lineDimensionsPayload(item, enabled)` ลงในตัวสร้าง payload รายบรรทัด (`mapItemToPayload` ของ IA และ `mapSrItemToPayload` ของ SR) ผลคือบรรทัดเดิมที่ไม่ได้แก้ dimension จะไม่ส่ง field นี้
- **onChange:** ตั้ง `dimensions` ด้วย `shouldDirty: true` และตั้ง `dimensions_dirty: true`
- **หลัง save สำเร็จ:** หุ้ม reset ด้วย `clearDimensionsDirty` ทั้ง IA (`ia-form.tsx` ตรง reset ทั้งสองจุด) และ SR (`use-sr-form-actions.ts` ตรง `form.reset(values)`)
- **IA ต้นทุน:** ถ้าบรรทัดใน `update` แก้แค่ dimension ต้องส่งต้นทุนที่เก็บไว้เดิมกลับไป ไม่ใช่ค่าที่ form คำนวณขึ้นใหม่ ทำแบบเดียวกับ `restoreStoredPricing` ของ GRN หรือจะตัดต้นทุนออกจากบรรทัดที่แก้แค่ dimension ก็ได้ ให้ builder เลือก แต่ต้องได้ผลตาม "สิ่งที่ห้ามเกิด"
- **SR การล็อก:** ปุ่ม dimension ใช้ disabled flag เดียวกับช่องอื่นของบรรทัดนั้น ตามการล็อกต่อขั้นที่มีอยู่แล้ว (`lockNonApproved/lockApproved/lockIssued`)
- **SR duplicate:** `buildSrDuplicateValues` คัดลอก dimension ของบรรทัดไปด้วย บรรทัดใหม่ส่งค่าเสมออยู่แล้ว (เป็นการตัดสินใจของผม)

### GRN
- ลบ `meta.footerContent`/`footerColSpan` ที่ใช้แสดง dimension ใน `use-grn-item-table.tsx` ออก แล้วเพิ่มคอลัมน์ `LineDimensionPopover` แทน
- `GrnItemDimensions` จะเหลือเป็นแค่ wrapper ของ popover หรือจะลบทิ้งก็ได้ ตามที่ builder เห็นว่าเหมาะ
- payload, `restoreStoredPricing` และ `clearDimensionsDirty` ของ GRN ไม่เปลี่ยน งานนี้เปลี่ยนแค่ UI
- ถ้า `footerContent` ยังถูกใช้แสดงอย่างอื่นในตาราง GRN ต้องคงส่วนนั้นไว้

## ส่วนที่ปล่อยให้ builder ตัดสินใจ
- ตำแหน่งของคอลัมน์ในแต่ละตาราง (แนะนำให้วางไว้ก่อน action column) และรายละเอียดหน้าตาของปุ่ม
- จะเพิ่ม i18n key สำหรับ label ของปุ่มหรือไม่ (`LineDimensionFields` มี key ของตัวเองอยู่แล้ว)

## การตรวจ
- typecheck, lint แบบ scoped และ vitest ชุดเดิมต้องผ่าน งานนี้ไม่เขียนเทสต์ใหม่ เว้นแต่ user สั่ง
- ตรวจด้วยมือบน dev ทั้ง SR, stock-in, stock-out และ GRN:
  - เลือก dimension แล้ว save จากนั้น reload ค่าต้องยังอยู่
  - แก้แค่ dimension แล้วต้นทุนกับจำนวนต้องไม่เปลี่ยน
  - BU ที่ไม่มี license ต้องไม่เห็นคอลัมน์
  - ในโหมดดูเอกสาร ต้องเปิด popover ดูค่าได้
  - SI/SO ที่สร้างจาก physical count ต้องแสดง dimension ที่ server ตั้ง default ไว้

## ลำดับ deploy
backend และ migration ขึ้น dev แล้ว (11 BU) จึง merge PR ของ frontend ได้ทันที ส่วนบน prod ต้องรอ backend และ migration ของ prod ขึ้นก่อน
