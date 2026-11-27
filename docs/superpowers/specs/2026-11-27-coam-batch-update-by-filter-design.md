# COAM: แก้ cost center / account ทุกแถวที่ตรงตัวกรอง (batch-update-by-filter)

วันที่: 2026-11-27 · ขนาด: งานเล็ก คร่อม 2 รีโป (carmen-turborepo-backend + carmen-frontend)

## เจตนา

หน้า `/config/chart-of-account-mapping` แก้หลายแถวพร้อมกันได้แล้ว (FE #282 / BE #825) แต่ใช้ได้กับแถวที่โหลดมาแล้วเท่านั้น
ตารางโหลดทีละ 50 แถว และ `batch-update` รับได้สูงสุด 100 แถว ตอนผู้ใช้กด "เลือกทุกแถวที่ตรงตัวกรอง" (#765)
ปุ่ม "แก้ไขที่เลือก" จะถูกซ่อน ผู้ใช้จึงแก้แถวเกิน 50 แถวด้วยค่าเดียวกันไม่ได้
งานนี้ทำให้แก้ทุกแถวที่ตรงตัวกรองได้ในคำขอเดียว ใช้แนวเดียวกับ "ยืนยันว่าตรวจแล้ว" (`review-by-filter`)

## เป้าหมาย / ไม่ใช่เป้าหมาย

- เป้าหมาย: ในโหมดทุกแถว ปุ่ม "แก้ไขที่เลือก (N)" ต้องกลับมาแสดง เปิด sheet เดิม (ไม่เปลี่ยน / ตั้งเป็น / คืนค่าเริ่มต้น)
  แล้วบันทึกครั้งเดียวกับทุกแถวที่ตรงตัวกรอง
- ไม่ใช่เป้าหมาย: เปลี่ยนการทำงานของโหมดติ๊กเอง (≤ แถวที่โหลด) ซึ่งยังใช้ `batch-update` แบบเช็ก `doc_version` รายแถวเหมือนเดิม
- anti-goal: ห้ามแก้แถวที่ผู้ใช้ไม่เห็น ถ้าจำนวนแถวที่ตรงตัวกรองเปลี่ยนไประหว่างนั้น ต้องไม่แตะสักแถว

## แนวทางที่พิจารณา

| | แนวทาง | ข้อแลกเปลี่ยน |
|---|---|---|
| **ก (เลือก)** | endpoint ใหม่ `batch-update-by-filter`: ตัวกรอง + `expected_count` + ค่าที่จะตั้ง, SQL UPDATE เดียว | คร่อม 2 รีโป + allowlist; ไม่มี conflict รายแถว |
| ข | FE โหลดทุกหน้า แล้วยิง `batch-update` ทีละ 100 | หลายพันแถว = หลายสิบคำขอ พังกลางทาง = แก้ไปครึ่งเดียว (ตัดทิ้งไปแล้วตอนทำ review-by-filter) |
| ค | ขยายเพดาน `batch-update` + FE โหลด id ทั้งหมด | ยังต้องโหลดทุกหน้า และยังมีเพดาน |

ผู้ใช้เลือก ก. และ **ยอมรับว่าโหมดทุกแถวไม่เช็ก conflict รายแถว** แถวที่คนอื่นแก้ระหว่างนั้นจะถูกเขียนทับ ส่วนที่กันไว้มีแค่กรณีจำนวนแถวเปลี่ยน

## Backend (carmen-turborepo-backend)

- gateway DTO `AccountMappingBatchUpdateByFilterSchema` = `AccountMappingListQuerySchema.omit({page, perpage, sort})`
  `.extend({ expected_count, account_code?: string|null, cost_center_id?: uuid|null })` + refine เดียวกับ batch-update
  (ต้องส่ง account_code หรือ cost_center_id อย่างน้อยหนึ่งค่า) schema คู่ใน micro-business ต้องตรงกัน
- `POST account-mapping/batch-update-by-filter` · `AppIdGuard('account-mapping.batchUpdateByFilter')` · permission เดียวกับ batch-update
- micro-business `batchUpdateByFilter()` เขียนตามแบบ `reviewByFilter()`: `invalidTarget()` ก่อน (422 ทั้งก้อน) → transaction
  นับด้วย `statusCte` + `listFilters` + `statusWhere` ชุดเดียวกับ findAll → ไม่ตรง `expected_count` = 409 `ACCOUNT_MAPPING_SCOPE_CHANGED`
  → `UPDATE … WHERE m.id IN (SELECT r.id FROM r …) AND deleted_at IS NULL` ตั้งค่าเฉพาะฟิลด์ที่ส่งมา (null = คืนค่าเริ่มต้น),
  `is_reviewed = true`, `updated_by_id`, `updated_at`, **`doc_version = doc_version + 1`** (raw SQL ไม่ผ่าน client extension —
  ต้องบวกเอง เพื่อให้ sheet แก้แถวเดียวที่เปิดค้างไว้ได้ 409 แทนการเขียนทับเงียบ ๆ) · timeout 25s เท่า reviewByFilter
- คืน `{ updated: number }`
- deploy: gateway + micro-business ก่อน แล้วเติม allowlist `account-mapping.batchUpdateByFilter` บน env ที่ไม่ allow_all แล้วจึง deploy FE

## Frontend (carmen-frontend)

- `use-account-mapping.ts`: เพิ่ม `useBatchUpdateAccountMappingByFilter()` (skipGlobalErrorToast) และ type ของ body
- `coam-component.tsx`: เลิกซ่อนปุ่ม "แก้ไขที่เลือก" ในโหมด `allMatching` ตัวเลขบนปุ่มใช้ `matchCount` แล้วส่งตัวกรอง
  (query ที่ไม่มี sort) + `matchCount` ไปให้ sheet
- `coam-batch-edit-sheet.tsx`: รับได้สองโหมด คือ `rows` (เดิม) หรือ `filter + count` โหมดตัวกรองให้หัว sheet แสดงจำนวน N
  ส่วนคำบรรยายใช้ข้อความ "ทุกแถวที่ตรงตัวกรองปัจจุบัน" แทนรายชื่อ location/movement · สำเร็จ → toast `batchEditDone` + ล้างการเลือก
  · 409 SCOPE_CHANGED → toast `scopeChanged` + ล้างการเลือก + ปิด sheet · 422 → errorToast ไม่ปิด sheet (เหมือนเดิม)
- i18n: เพิ่มคีย์คำบรรยายโหมดตัวกรอง (en/th)

## ปล่อยให้ผู้ลงมือตัดสินเอง

- รูปแบบ props ของ sheet (union type หรือ prop แยก)
- ข้อความ i18n ที่ใช้จริง
- จะแยก helper "ตัวกรองที่ไม่มี sort" ที่ markReviewed ใช้ร่วมด้วยหรือไม่
