# Period End Review — dialog รายการเอกสาร: จัดกลุ่มสถานะ, กรองใบค้าง, โหลดทีละหน้า

วันที่: 2026-11-02 · รีโปที่แตะ: `carmen-turborepo-backend`, `carmen-frontend`

## เจตนาและเหตุผล

หน้า `/inventory-management/period-end/review` มีการ์ดของแต่ละโมดูล (PR, PO, GRN, CN, SR,
Stock In, Stock Out) กดแล้วเปิด dialog รายการเอกสารของงวด
(`routes/inventory-management/period-end/pe-documents-dialog.tsx`)

ปัญหาในวันนี้มีสองข้อ

1. **ในอนาคตหน้าจะเปิดช้า** `PeriodEndService.findReview` (micro-business,
   `apps/micro-business/src/inventory/period-end/period-end.service.ts`) ดึงเอกสาร**ทุกใบ**ของงวด
   จาก 7 ตารางแบบไม่มี limit แล้วส่งทั้งก้อนมากับ `GET /api/:bu_code/period-ends/review`
   หน้าจึงช้าลงตามจำนวนเอกสาร ทั้งที่ยังไม่มีใครเปิด dialog เลย
2. **หาใบที่ต้องทำต่อยาก** dialog แสดงเอกสารตามวันที่ ปนกันทุกสถานะ ผู้ใช้ต้องการเห็นใบที่
   **ยังไม่เสร็จ** เพื่อกดเข้าไปทำต่อให้จบก่อนปิดงวด (ลิงก์เลขเอกสารไปหน้าเอกสารมีอยู่แล้ว)

## เป้าหมาย

1. dialog จัดเอกสารเป็น 4 กลุ่ม และเรียงตามลำดับนี้: **Draft → In-progress → Complete → Cancelled/Void**
2. dialog มีตัวกรอง: **ยังไม่เสร็จ** (Draft + In-progress) · **เสร็จแล้ว** · **ยกเลิก/Void** · **ทั้งหมด**
   เปิดมาครั้งแรก **ค่าเริ่มต้น = ยังไม่เสร็จ** (user เลือกเอง) และแต่ละตัวกรองแสดงจำนวนใบ
3. dialog ดึงรายการเอง **ทีละหน้า** และโหลดหน้าถัดไปเมื่อเลื่อนถึงท้ายตาราง (infinite scroll)
4. `GET .../period-ends/review` **ไม่ส่งรายชื่อเอกสารอีก** ส่งแค่ตัวเลขสรุป เวลาตอบจึงไม่โตตามจำนวนเอกสาร

## ไม่ใช่เป้าหมาย

- **ไม่เปลี่ยนกฎการปิดงวด** ใบ cancelled/void ยังไม่ขวางการปิดงวดเหมือนเดิม
  ชุด `*_COMPLETE` ใน `period-end.validate.ts`, `is_complete`, การ์ด และ `pe-close-track.tsx` ทำงานเหมือนเดิม
  ที่เปลี่ยนคือแค่**การแสดงผล**ซึ่งแยก cancelled/void ออกมาเป็นกลุ่มของตัวเอง
- ไม่แตะ `pe-start-blocked-dialog.tsx` (ใช้ข้อมูลจาก start-counting คนละ endpoint)
- ไม่เพิ่มช่องค้นหาเลขเอกสาร (my call ไว้ทำรอบหน้าถ้าต้องการ)
- ไม่ทำ mobile (`carmen-mobile` ไม่ได้เรียก endpoint review)

## สิ่งที่ห้ามเกิด (anti-goals)

- ตัวเลขบนการ์ด / หัว dialog ไม่ตรงกับจำนวนแถวที่ไล่ดูได้จริงใน dialog
- ใบ void หรือ cancelled ไปโผล่ในตัวกรอง "เสร็จแล้ว"
- ผู้ใช้โดน logout เพราะ api_name ใหม่ยังไม่อยู่ใน app allowlist (ดู §Deploy)
- ช่วงที่ deploy BE แล้วแต่ FE ยังไม่ขึ้น dialog ว่างเปล่า (ดู §ลำดับการ rollout)

## นิยามกลุ่มสถานะ

ยึด enum จาก `packages/prisma-shared-schema-tenant/prisma/schema.prisma` และชุด `*_COMPLETE` เดิม
โดยแยก `cancelled` / `voided` ออกจาก complete

| โมดูล (ตาราง · enum) | Draft | In-progress | Complete | Cancelled/Void |
|---|---|---|---|---|
| PR `tb_purchase_request.pr_status` · `enum_purchase_request_doc_status` | draft | in_progress | approved, completed | voided |
| PO `tb_purchase_order.po_status` · `enum_purchase_order_doc_status` | draft | in_progress, approved, sent_or_print, partial | completed, closed | voided |
| GRN `tb_good_received_note.doc_status` · `enum_good_received_note_status` | draft | saved | committed | voided |
| CN `tb_credit_note.doc_status` · `enum_credit_note_doc_status` | draft | in_progress | completed | cancelled, voided |
| SR / SI / SO `doc_status` · `enum_doc_status` | draft | in_progress | completed | cancelled, voided |

กติกา: **Complete ∪ Cancelled/Void = ชุด `*_COMPLETE` เดิมพอดี** ดังนั้น
`complete_count` (เดิม) = `group_counts.complete + group_counts.cancelled` และ
`incomplete_count` = `draft + in_progress` เสมอ

`pr_status` / `po_status` เป็น nullable ใน schema (โค้ดเดิม map null เป็น `''` แล้วนับเป็น incomplete)
→ **null นับเป็น Draft** (my call) `incomplete_count` จึงเท่าเดิม

นิยามนี้ควรอยู่ที่ backend ที่เดียว (เช่นเพิ่มใน `period-end.validate.ts` ข้าง `*_COMPLETE`)
และให้ทั้ง review counts กับ endpoint รายการใช้ชุดเดียวกัน FE ไม่ต้องรู้ว่าสถานะไหนอยู่กลุ่มไหน
แค่ส่งชื่อกลุ่มไปกรอง

ตัวกรองขอบเขตงวดคงเดิมตาม `findReview` ทุกข้อ คือ date range ของงวด, `deleted_at: null`
และ PR/SR ต้องมีเลขเอกสาร (`NUMBERED_DOC`)

## Backend (`carmen-turborepo-backend`)

### 1. `GET /api/:bu_code/period-ends/review` ส่งแค่ตัวเลข

- ต่อโมดูลส่ง `count`, `complete_count`, `incomplete_count`, `is_complete` เหมือนเดิม
  **เพิ่ม** `group_counts: { draft, in_progress, complete, cancelled }`
- นับด้วย `groupBy` ตามคอลัมน์สถานะ ไม่ต้อง `findMany` ทุกแถว
- `documents` ถูกถอดออกหลัง FE ใหม่ขึ้นแล้ว (ดู §ลำดับการ rollout) และ gateway serializer
  (`apps/backend-gateway/src/common/dto/period-end/period-end.serializer.ts`) ต้องแก้ตาม
- ฝั่ง physical count ไม่เปลี่ยน

### 2. Endpoint ใหม่: รายการเอกสารของโมดูลเดียว

`GET /api/:bu_code/period-ends/review/:module/documents`

- `:module` ∈ `pr | po | grn | cn | sr | si | so` (ตรงกับ `ReviewTransactionKey`) ค่าอื่นตอบ 400
- query: `group` ∈ `incomplete | complete | cancelled | all` (ค่าเริ่มต้น `incomplete`),
  `page`, `perpage` (ค่าเริ่มต้น 50 และมีเพดาน เช่น 100) ใช้ pattern paginate ที่ endpoint list อื่นใช้อยู่
- ใช้งวดปัจจุบันตาม `findReview` (open/locked งวดแรก) ถ้าไม่มีงวดตอบ `PERIOD_END_NO_CURRENT_PERIOD` แบบเดิม
- แต่ละแถว: `{ id, no, status, date, group }` (`group` = `draft | in_progress | complete | cancelled`)
- **ลำดับ**: rank ของกลุ่มตามข้างบน (draft=0, in_progress=1, complete=2, cancelled=3)
  ตามด้วยวันที่เอกสาร**เก่า → ใหม่** (my call ใบที่ค้างนานสุดขึ้นก่อน) แล้วตามด้วย `id`
  เพื่อให้ลำดับนิ่งเวลาแบ่งหน้า
- response มี paginate meta (total) ตามรูปแบบ list endpoint เดิม **และ** `group_counts` ของโมดูลนั้น
  ซึ่งคำนวณใน request เดียวกับรายการ (my call) dialog ใช้ตัวเลขชุดนี้กับตัวกรองและหัว dialog
  ตัวเลขกับแถวจึงตรงกันเสมอ แม้เอกสารจะเปลี่ยนสถานะหลังโหลดหน้า review ไปแล้ว
- gateway: controller ใหม่ใน `apps/backend-gateway/src/application/period-end/`
  พร้อม `AppIdGuard('period_end.findReviewDocuments')` (ชื่อเป็น my call), serializer และ Swagger
  ฝั่ง micro-business เพิ่ม `MessagePattern` ใหม่ใน `PeriodEnds`
- สิทธิ์ใช้ชุดเดียวกับ `findReview`

**ทางเลือกที่เหลือให้ builder**: Prisma `orderBy` เรียงด้วย CASE ไม่ได้
จะใช้ raw SQL ที่มี `CASE` ก็ได้ หรือจะไล่ทีละกลุ่มแล้วคำนวณ offset ข้ามกลุ่มจาก `group_counts` ก็ได้
ขอแค่ผลลัพธ์ตรงลำดับที่กำหนด และแบ่งหน้าแล้วไม่มีแถวซ้ำหรือหาย

## Frontend (`carmen-frontend`)

- `constant/api-endpoints.ts`: เพิ่ม `PERIOD_END_REVIEW_DOCUMENTS(buCode, module)`
- `types/period-end.ts`: เพิ่ม `group_counts` ใน `ReviewTransactionStat`, `group` ใน `ReviewDocument`,
  type `ReviewDocumentGroup` และถอด `documents` ออกจาก stat
- hook ใหม่ `routes/inventory-management/period-end/use-review-documents.ts` (ใช้ที่ dialog เดียว
  จึงวางข้าง feature ตามกติกา "Where a hook lives") ใช้ `useInfiniteQuery`
  key = `[QUERY_KEYS.PERIOD_ENDS, buCode, "review", module, "documents", group]`
  และ `enabled` เฉพาะตอน dialog เปิดและมี module (ดู pattern ที่ `hooks/use-comment-crud.ts`)
- `usePeriodEndReview` เลิก map `documents`
- `pe-documents-dialog.tsx`:
  - ตัวกรอง 4 ปุ่มเหนือตาราง เรียงตามนี้: ยังไม่เสร็จ (default) · เสร็จแล้ว · ยกเลิก/Void · ทั้งหมด
    แต่ละปุ่มมีจำนวนจาก `group_counts` ของ**หน้าแรกที่ endpoint ใหม่ตอบกลับ** ไม่ใช่จาก review
    (ยังไม่เสร็จ = draft + in_progress, ทั้งหมด = ผลรวม 4 กลุ่ม) ระหว่างหน้าแรกยังโหลด
    ใช้ตัวเลขจาก review เป็นค่าชั่วคราวได้
  - ทุกครั้งที่เปิด dialog ให้ refetch รายการ (และ invalidate key ของ review ให้การ์ดอัปเดตตาม)
    เพราะผู้ใช้มักกดเข้าไปแก้เอกสารแล้วกลับมาดูใหม่
    ใช้ primitive ที่มีอยู่ใน `components/ui/` (เช่น tabs/segmented) ห้ามตั้งสีหรือขนาดใหม่ที่ call site
  - เปิด dialog ใหม่หรือเปลี่ยนโมดูล → ตัวกรองกลับเป็น "ยังไม่เสร็จ"
  - ถ้าผู้ใช้ไม่เปลี่ยนตัวกรองเอง ให้คงไว้ที่ "ยังไม่เสร็จ" แม้กลุ่มนั้นจะว่าง แล้วแสดง empty state
    ที่บอกว่าไม่มีใบค้าง (my call ไม่สลับตัวกรองให้อัตโนมัติ)
  - โหลดหน้าถัดไปเมื่อเลื่อนถึงท้าย `DataGridScrollArea` (sentinel + IntersectionObserver)
    แสดง loading แถวท้ายขณะโหลด และแสดง error พร้อมปุ่มลองใหม่ถ้าโหลดหน้าถัดไปไม่สำเร็จ
  - คอลัมน์ `#` ใช้ลำดับต่อเนื่องข้ามหน้า
  - ข้อความหัว dialog (`documentsSummary`) แสดงจำนวนครบ 4 กลุ่ม (my call)
  - คอลัมน์และลิงก์ไปเอกสาร (`buildDocumentPath`) คงเดิม ตารางยังเรียงตามลำดับจาก server
    ไม่มีการเรียงฝั่ง client
  - ตารางใช้ `useReactTable` และ data เปลี่ยนเมื่อโหลดหน้าใหม่ จึงต้องดูกับดัก React Compiler / DataGrid
    ใน `routes/CLAUDE.md` (`"use no memo";`) และ memo columns ตามเดิม
- i18n: เพิ่มคีย์ของตัวกรอง 4 อัน, ข้อความ empty state "ไม่มีใบค้าง" และ `documentsSummary` แบบใหม่
  ใน namespace `inventoryManagement.periodEnd` ครบทุกภาษาที่มี
  ห้ามใส่ `{{}}` หรือ `<คำ>` ในข้อความแปล (ICU)
- อ่านออกทั้ง light/dark

## ลำดับการ rollout และ deploy

ตอนนี้ dialog เป็นจุดเดียวที่อ่าน `documents` จาก review จึงแบ่งเป็นสองจังหวะ
(my call) เพื่อไม่ให้ dialog ว่างระหว่าง deploy

1. **BE PR 1**: เพิ่ม endpoint ใหม่ + `group_counts` โดย review **ยังคงส่ง `documents`**
   (ใช้ทางเดิมไปก่อน) แล้ว deploy
2. **allowlist**: เพิ่ม api_name ใหม่ (`period_end.findReviewDocuments` หรือชื่อที่ใช้จริง) ใน
   app allowlist ทุก env ที่ไม่ได้ allow_all **ก่อน** deploy FE ไม่อย่างนั้น 401 จะเคลียร์ token
   ทำให้ผู้ใช้โดน logout allowlist อยู่ใน**แถว application ใน DB** (`AppAllowlistStore.isAllowed`
   ใน backend-gateway ลัดวงจรเมื่อแถวนั้นตั้ง `allow_all: true`) ก่อน deploy ให้ตรวจแต่ละ env ว่าเป็น
   allow_all ไหม ถ้าไม่ใช่ให้เติมแถว ขั้นนี้เป็นงานที่ **user ทำเอง/อนุมัติ** และต้องเขียนบอกไว้ใน PR ของ FE ด้วย
   เพราะการ deploy FE คือตัวที่ทำให้เกิดปัญหา
3. **FE PR**: dialog ใช้ endpoint ใหม่ เลิกอ่าน `documents` แล้ว deploy
4. **BE PR 2**: ถอด `documents` ออกจาก review (service + serializer) แล้ว deploy
   จังหวะนี้ทำให้ได้ผลด้านความเร็วจริง

## ทดสอบ / ตรวจรับ

ตาม CLAUDE.md ของ user การรันตามแผนข้ามขั้นเขียน test ใหม่ แต่ต้องรัน typecheck/lint และ
test suite เดิมต้องผ่าน การตรวจรับให้ทำด้วยมือดังนี้

- curl endpoint ใหม่ทุก module × ทุก group: ลำดับถูก, ไม่มีแถวซ้ำหรือหายระหว่างหน้า, total ตรงกับ `group_counts`
- เทียบ `complete_count` / `incomplete_count` / `is_complete` ก่อนและหลัง ต้องเท่าเดิม
- ในเบราว์เซอร์: เปิด dialog ของโมดูลที่มีเอกสาร > 50 ใบ (ถ้า dev DB ไม่มีให้ลด `perpage` ชั่วคราว)
  แล้วเลื่อนให้โหลดต่อ, สลับตัวกรอง, กดลิงก์เอกสาร, ดูทั้ง light/dark
