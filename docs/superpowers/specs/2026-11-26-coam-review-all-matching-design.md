# Chart of Account Mapping — ยืนยันว่าตรวจแล้วทั้งแท็บ (review-by-filter)

วันที่ 2026-11-26 · รีโป: carmen-turborepo-backend (micro-business + gateway), carmen-frontend

## ทำไม

หน้า `/config/chart-of-account-mapping` โหลดรายการทีละ 50 แถว (lazy load) ช่องติ๊กบนหัวตาราง
จึงเลือกได้แค่แถวที่โหลดแล้ว ผู้ใช้อยากกด **"ยืนยันว่าตรวจแล้ว" ทั้งแท็บ** ซึ่งมีหลักพันแถว
และ endpoint `review` เดิมรับได้ไม่เกิน 100 id ต่อคำขอ

## เป้าหมาย / ไม่ใช่เป้าหมาย

- เป้าหมาย: เลือก "ทุกแถวที่ตรงเงื่อนไขปัจจุบัน" (แท็บ + ค้นหา + filter รวม status) แล้วยืนยันว่าตรวจแล้วด้วยคำขอเดียว
- ไม่ใช่เป้าหมาย: แก้บัญชี/cost center หลายพันแถวในคำขอเดียว (`batch-update` ยังคงเพดาน 100 แถวเท่าเดิม)
- anti-goal: ตรวจแถวที่ผู้ใช้ไม่ได้ตั้งใจจะตรวจ เช่น แถวที่คนอื่นเพิ่มเข้ามาระหว่างที่ผู้ใช้ดูหน้าจออยู่ ห้ามถูกตรวจไปเงียบ ๆ

## Approaches

| | วิธี | ข้อดี / ข้อเสีย |
|---|---|---|
| **A (เลือก)** | BE เพิ่ม endpoint ตรวจตาม filter ส่วน FE แสดงแถบ "เลือกทั้งหมด N แถว" | คำขอเดียว เร็ว ไม่ต้องโหลดทุกแถวมาที่เบราว์เซอร์ / ต้องแก้ 2 รีโปและต้อง deploy BE ก่อน |
| B | FE โหลดหน้าที่เหลือจนครบ แล้วยิง `review` ทีละ 100 | ไม่ต้องแตะ BE / หลายพันแถวต้องยิงประมาณ 60 คำขอ ช้า และอาจตรวจได้แค่บางส่วนถ้าพังกลางทาง |
| C | ขยายเพดาน `ids` | ยังต้องโหลดทุกแถวมาที่ FE และ body เสี่ยงชนเพดาน 100kb ของ gateway |

ผู้ใช้เลือก A ในการคุยวันที่ 2026-11-26

## Design

### Backend — micro-business (`master/account-mapping`)

- ย้ายส่วนที่สร้าง `filters` (SQL fragment) ใน `findAll` ออกมาเป็น private method
  เพื่อให้ `findAll` และ `reviewByFilter` ใช้เงื่อนไข**ชุดเดียวกันแน่นอน** (ห้ามคัดลอก logic ไปเขียนซ้ำ)
- `reviewByFilter(payload)` ใช้ schema = `AccountMappingListQuerySchema` แต่ไม่มี `page` / `perpage` / `sort`
  และต้องมี `expected_count: z.number().int().min(0)` เพิ่ม
  1. ใน `$transaction` เดียว ให้นับแถวที่ตรงเงื่อนไข (นับแบบเดียวกับ `total` ของ list คือรวม status filter)
  2. ถ้าจำนวนที่นับได้ไม่เท่ากับ `expected_count` ให้ตอบ 409 และไม่แตะแถวไหนเลย
  3. ถ้าเท่ากัน ให้ `UPDATE tb_account_mapping SET is_reviewed = true, updated_by_id, updated_at`
     `WHERE id IN (<cte> SELECT r.id FROM r WHERE true <filters> <statusWhere>) AND is_reviewed = false AND deleted_at IS NULL`
  4. คืน `{ updated: <จำนวนแถวที่เปลี่ยน> }` ซึ่งเป็น shape เดียวกับ `review`
- เพิ่ม MessagePattern `AccountMapping.reviewByFilter` คู่กับ `AccountMapping.review`

### Backend — gateway

- `POST account-mapping/review-by-filter` · `AppIdGuard('account-mapping.reviewByFilter')`
  · ใช้ permission เดียวกับ `review` · เขียน swagger ทั้งสองภาษาตามแบบที่ไฟล์นี้ใช้
- DTO ฝั่ง gateway ต้องตรงกับ micro (zod)

### Frontend — `routes/config/chart-of-account-mapping/`

- เพิ่ม state `allMatching: boolean`
- เมื่อติ๊กครบทุกแถวที่โหลดแล้ว (`table.getIsAllRowsSelected()`) และ `totalRecords > rows.length`
  ให้แสดงแถบเหนือตาราง:
  `เลือก 50 แถวที่แสดงอยู่ · [เลือกทั้งหมด 3,214 แถว]` และเมื่อกดแล้วเปลี่ยนเป็น
  `เลือกทั้งหมด 3,214 แถวแล้ว · [ล้างที่เลือก]`
- ระหว่างที่ `allMatching` เปิดอยู่:
  - ปุ่ม "ยืนยันว่าตรวจแล้ว (3,214)" ให้เรียก hook ใหม่ `useReviewAccountMappingByFilter` โดยส่ง `query` ชุดเดียวกับ list และ `expected_count = totalRecords`
  - ซ่อนปุ่ม "แก้ที่เลือก" เพราะ batch-update มีเพดาน 100 แถว
  - ถ้าผู้ใช้เอาติ๊กออกแม้แถวเดียว หรือเปลี่ยน `scopeKey` (แท็บ ค้นหา sort หรือ filter) ให้ออกจากโหมด `allMatching`
- ถ้าได้ 409 ให้ขึ้น toast "รายการเปลี่ยนไประหว่างที่ดูอยู่ กรุณาตรวจอีกครั้ง" แล้ว refetch และล้างที่เลือก
- ถ้าสำเร็จให้ขึ้น toast `markReviewedDone` ด้วยจำนวน `updated` แล้วล้างที่เลือก
- ข้อความใหม่ต้องมีทั้ง en/th ห้ามใช้ `{{}}` หรือ `<คำ>` ในไฟล์แปล

### ลำดับ deploy

migration ไม่ต้องมี · micro-business + gateway → เพิ่ม `account-mapping.reviewByFilter` ใน allowlist
(ไม่งั้นผู้ใช้โดน logout) → FE

## สิ่งที่ให้ผู้ทำตัดสินเอง

- ชื่อ field และ wording ของ toast/แถบ (ขอให้ตรงกับ i18n key ที่มีอยู่ในหน้า)
- จะเอา count + update ไว้ใน CTE เดียว หรือแยกเป็นสอง query ใน transaction
- การวางแถบ ให้ใช้ของจาก design system ที่มีอยู่แล้ว และต้องอ่านออกทั้ง light/dark
