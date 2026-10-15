# นโยบายไฟล์แนบ comment ต่อ BU (ชนิดไฟล์ + ขนาด) — design

วันที่: 2026-10-15 · รีโป: `carmen-turborepo-backend-v2` (BE: backend-gateway + packages) +
`carmen-platform` (ตั้งค่า) + `carmen-inventory-frontend-react` (FE: ใช้ค่า)

## ปัญหา

ชนิดและขนาดไฟล์แนบใน comment ถูก hardcode ไว้สองฝั่งและไม่ตรงกัน:

- **BE:** comment controller 46 ตัวใน backend-gateway ประกาศ `MAX_FILE_SIZE_BYTES = 10MB` +
  `ALLOWED_MIME_TYPES = jpeg/png/webp/gif/pdf` เองตัวละชุด และตรวจด้วย loop ที่ copy กัน
  รวม 138 จุด — ไม่มี helper กลาง · `FilesInterceptor('files')` ไม่ตั้ง multer `limits`
  ไฟล์ทั้งก้อนถูกโหลดเข้า RAM ก่อนจะถูกเช็กขนาด · micro-file ไม่ตรวจอะไรเลย
- **FE:** `components/ui/comment-sheet.tsx` (10MB) กับ
  `routes/inventory-management/shared/entry-notes-dialog.tsx` (3MB) ตั้งค่าคงที่แยกกัน
- ลูกค้าบางรายต้องแนบ Excel/Word ใน comment แต่ไม่มีทางเปิดให้เฉพาะ BU นั้น

## เป้าหมาย / ไม่ใช่เป้าหมาย

- **ทำ:** ทีม Carmen ตั้งได้จาก carmen-platform ว่าแต่ละ BU แนบไฟล์ใน comment ได้ **กลุ่มชนิดไหน**
  และ **ใหญ่สุดกี่ MB** (ภายในเพดานระบบ) — BE บังคับใช้ FE ใช้ตรวจก่อนอัปโหลด
- **ทำ:** รวมการตรวจไฟล์ comment ฝั่ง gateway ให้เหลือจุดเดียว + ตัดไฟล์เกินเพดานตั้งแต่ multer
- **ไม่ทำ:** อัปโหลดที่ไม่ใช่ comment (import, รูปสินค้า/สูตร, avatar/ลายเซ็น, ใบรับรอง vendor,
  document management) — คงเพดานเดิม (หลายจุดฝั่ง BE ไม่มีเพดานเลย เป็นงานแยก)
- **ไม่ทำ:** ตั้งแยกต่อประเภทเอกสาร (PR/PO/...) — หนึ่งนโยบายต่อ BU
- **ไม่ทำ:** จำนวนไฟล์ต่อครั้ง (`MAX_FILES = 10` คงเป็นค่าคงที่) · quota พื้นที่รวมต่อ BU
- **ไม่ทำ:** ให้ admin BU แก้เองจากแอป inventory — ตั้งจาก platform เท่านั้น

## การตัดสินใจหลัก

| เรื่อง | เลือก | เหตุผล |
|---|---|---|
| ใครตั้ง | carmen-platform เท่านั้น | ทีม Carmen คุมพื้นที่เก็บไฟล์และความเสี่ยงของชนิดไฟล์ |
| ที่เก็บ | entry ใน `tb_business_unit.config` (platform DB) | ที่เก็บค่าต่อ BU ที่มีอยู่แล้ว ไม่ต้อง migration · gateway อ่านตรงผ่าน `PRISMA_SYSTEM` ได้ |
| รูปค่า | **รหัสกลุ่ม** ไม่ใช่ MIME ดิบ | คนตั้งคิดเป็น "เปิด Excel" · เพิ่ม MIME ให้กลุ่มทีหลังได้โดยไม่แก้ข้อมูลทุก BU |
| ชนิดที่เลือกได้ | รายการตายตัวในโค้ด (รูป, PDF, Excel, Word, CSV, Text) | ไม่มีทางเปิด svg/html/exe ที่ฝัง script ได้ |
| ขนาด | เพดาน 25MB · ค่าเริ่มต้น 10MB | BU ที่ไม่ตั้ง = พฤติกรรมเดิมเป๊ะ deploy แล้วไม่มีอะไรเปลี่ยน |
| ทางเลือกที่ตัดทิ้ง | ตารางใหม่ (งานมากขึ้น ต้อง migration + CRUD) · `tb_application_config` (admin BU เขียนได้ ขัดกับ "platform เท่านั้น") | |

## 1. รูปแบบข้อมูล

entry ใน `tb_business_unit.config` (array ของ `{ key, label, datatype, value }` แบบเดิม):

| key | value | ไม่มี entry |
|---|---|---|
| `attachment.allowed_types` | array ของรหัสกลุ่ม เช่น `["image","pdf","excel"]` | `["image","pdf"]` |
| `attachment.max_size_mb` | จำนวนเต็ม 1–25 | `10` |

รายการกลุ่ม — single source อยู่ใน gateway `src/common/attachment-policy/attachment-policy.ts` (ผู้ใช้ทั้งสองฝั่ง —
ตัวตรวจไฟล์และ validation ตอน platform เขียน — อยู่ใน gateway · ไม่ใส่ `packages/` เพราะต้อง build dist เพิ่มโดยไม่มีผู้ใช้อื่น):

| กลุ่ม | MIME | นามสกุล |
|---|---|---|
| `image` | `image/jpeg` `image/png` `image/webp` `image/gif` | .jpg .jpeg .png .webp .gif |
| `pdf` | `application/pdf` | .pdf |
| `excel` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` `application/vnd.ms-excel` | .xlsx .xls |
| `word` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` `application/msword` | .docx .doc |
| `csv` | `text/csv` (+ `application/vnd.ms-excel` ที่ Windows ส่งมากับ .csv) | .csv |
| `text` | `text/plain` | .txt |

**กติกาตอนอ่าน (resolve):** ค่าผิดรูป/นอกช่วงไม่ทำให้พัง — ขนาดถูก clamp เข้า 1–25 (ไม่ใช่ตัวเลข =
ค่าเริ่มต้น) · กลุ่มที่ไม่รู้จักถูกทิ้ง · array ว่างหลังกรอง = ค่าเริ่มต้น (กันการตั้งพลาดจนแนบอะไรไม่ได้เลย)

**กติกาจับคู่ไฟล์:** ผ่านเมื่อ MIME อยู่ในชุดของกลุ่มที่เปิด · นามสกุลเป็นทางสำรอง**เฉพาะ**เมื่อ MIME
เป็นค่ากลาง (`application/octet-stream` หรือว่าง) — MIME ที่ชี้ชัดว่าต้องห้ามถูกปฏิเสธเสมอแม้นามสกุลดูถูก
· กรณี `application/vnd.ms-excel` ผ่านถ้าเปิด `excel` **หรือ** `csv`

## 2. Backend (backend-gateway)

### 2.1 `AttachmentPolicyService` (ใหม่ — `src/common/attachment-policy/`)

- `getPolicy(bu_code)` → `{ allowed_types, max_size_mb, mime_types, extensions }` อ่าน
  `tb_business_unit.config` ด้วย `PRISMA_SYSTEM` (หา BU ด้วย `code`, `deleted_at: null`) แล้ว resolve ตาม §1
- cache ใน memory ต่อ `bu_code` อายุ 60 วินาที (ท่าเดียวกับ `src/license/license.service.ts`) —
  platform เปลี่ยนค่าแล้วมีผลภายใน ≤ 1 นาที · แต่ละ instance ของ gateway มี cache ของตัวเอง
- BU หาไม่เจอ = ค่าเริ่มต้น (guard ของ route ตัดสินสิทธิ์ BU ไปแล้ว ไม่ใช่หน้าที่ของ service นี้)

### 2.2 ตัวตรวจกลาง

- `assertAttachments(files, policy)` (pure) + `AttachmentPolicyService.assertFiles(bu_code, files)`
- ทั้ง 46 `*-comments.controller.ts`: ลบ `MAX_FILE_SIZE_BYTES` / `ALLOWED_MIME_TYPES` และ loop ตรวจ
  ทุกจุด แทนด้วย `await this.attachmentPolicy.assertFiles(bu_code, files)` · `MAX_FILES` คงเดิม
- `FilesInterceptor('files', …)` ของ comment ทุกตัวใช้ options กลางที่มี
  `limits: { fileSize: 25 * 1024 * 1024 }` — ไฟล์เกินเพดานถูกตัดระหว่าง stream
- แก้ 46 ไฟล์แบบ mechanical ด้วย script ที่ assert จำนวนจุดที่แทนต่อไฟล์

### 2.3 รหัส error (error catalog แบบ #835)

| รหัส | เมื่อ | params |
|---|---|---|
| `ATTACHMENT_TYPE_NOT_ALLOWED` | ชนิดไม่อยู่ในนโยบายของ BU | `{ name, allowed }` |
| `ATTACHMENT_TOO_LARGE` | ใหญ่กว่า `max_size_mb` ของ BU หรือโดน multer `LIMIT_FILE_SIZE` | `{ name, max_mb }` |
| `ATTACHMENT_POLICY_INVALID` | platform เขียน `attachment.*` ที่ผิดรูป (§2.6) | `{ key, max_mb }` |

โยนเป็น `BadRequestException({ code, ...params })` — exception filter ของ gateway ดึงรหัสจาก body ไป render
ข้อความ catalog ตาม `Accept-Language` และส่ง `error.code` / `error.id` ให้ FE (ยังเป็น `BadRequestException`
เทสต์ controller เดิมที่คาด `BadRequestException` จึงผ่าน) · ข้อความ catalog ไม่อ้าง `{name}` เพราะกรณีโดน
multer ตัดไม่รู้ชื่อไฟล์

ต้องดัก `LIMIT_FILE_SIZE` ของ multer ให้ออกเป็นรหัสที่สอง (ไม่งั้นได้ 413/500 ไร้รหัส)

### 2.4 Endpoint อ่านนโยบาย

`GET api/:bu_code/attachment-policy` → รูปเดียวกับ `getPolicy` · ผู้ใช้ทุกคนของ BU นั้นอ่านได้
(ไม่มี permission เพิ่ม) · **api_name ใหม่ `attachmentPolicy.get` — ต้องเติม allowlist ก่อน deploy FE**
(ไม่งั้น user ถูก logout — ดู memory `new-api-name-401-logs-users-out`)

### 2.5 ปิดช่องเขียนจากฝั่ง BU

`user-business-units.service.ts` มีสองเส้นที่เขียน `config`:

- `PATCH` (`patchCurrentBusinessUnit`) — ทิ้ง entry `attachment.*` ที่ส่งมาก่อน `mergeConfigByKey` ค่าเดิมคงอยู่
  เพราะ merge ทับเฉพาะ key ที่ส่งมา
- `PUT` (`updateCurrentBusinessUnit`) — **แทน config ทั้งก้อน** ทิ้งอย่างเดียวจะลบค่าที่ platform ตั้งไว้ จึงต้อง
  อ่าน config ปัจจุบัน (`BusinessUnits.findOneForMember` แบบเดียวกับ PATCH) แล้วต่อ entry `attachment.*` เดิมกลับเข้าไป

ทั้งสองเส้นทำ**แบบเงียบ** ไม่ตอบ 400 เพราะหน้า Default Setting ของ inventory ส่ง config ทั้งก้อนกลับตอนบันทึก

### 2.6 ตรวจตอนเขียนฝั่ง platform

endpoint สร้าง/แก้ BU ของ platform (`platform/platform_business-units`) ตรวจ entry `attachment.*`:
กลุ่มต้องอยู่ในรายการ · ขนาดต้องเป็นจำนวนเต็ม 1–25 · ไม่ผ่าน = 400 พร้อมรหัส

## 3. carmen-platform

- component ใหม่ `AttachmentPolicyFields` — checkbox ต่อกลุ่ม (รูป/PDF/Excel/Word/CSV/Text) +
  ช่องตัวเลข "ขนาดสูงสุด (MB)" 1–25 + ข้อความบอกค่าเริ่มต้นเมื่อยังไม่ตั้ง
- ใช้ใน `src/pages/BusinessUnitEdit.tsx` เท่านั้น — `clusterAdmin/BusinessUnitForm.tsx` ไม่แสดง (หน้านั้นถือว่าค่า
  ระดับ platform เป็นของอ่านอย่างเดียวอยู่แล้ว เช่น calculation method และส่ง config เดิมกลับไปทั้งก้อนจึงไม่ลบค่า)
- ซ่อน key `attachment.*` จากตัวแก้ config key/value ทั่วไป — แก้ได้ที่เดียว · บันทึกเป็น entry ใน `config`
- "คืนค่าเริ่มต้น" = ลบสอง entry ทิ้ง (ไม่เขียนค่า default ลงไป เพื่อให้ตามค่าเริ่มต้นของระบบที่อาจเปลี่ยนทีหลัง)

## 4. inventory FE

- `hooks/use-attachment-policy.ts` (ใหม่, ใน `hooks/` เพราะใช้คร่อมโมดูล) — `GET api/:bu_code/attachment-policy`
  ด้วย `CACHE_STATIC` · key ผูก `buCode`
- `components/ui/comment-sheet.tsx` — เลิกใช้ `ALLOWED_TYPES` / `MAX_FILE_SIZE` / `ACCEPT` คงที่ อ่านจาก hook
  ทั้งการกรองตอนเลือกและ `accept` · ข้อความเตือนบอกชนิด/ขนาดของ BU จริง
- `routes/inventory-management/shared/entry-notes-dialog.tsx` — ใช้ hook เดียวกัน (เพดาน 3MB ที่ไม่ตรงหายไป)
- ระหว่างโหลด / ดึงไม่สำเร็จ = ค่าเริ่มต้นเดียวกับ BE (รูป + PDF, 10MB) ไม่บล็อกการใช้งาน — BE คือด่านจริง
- ไม่ต้องเพิ่ม `errors.byCode.*` — error ของ BE มี `error.id` (catalogId) และข้อความที่ render ตามภาษาแล้ว
  `getUserErrorMessage` ใช้ข้อความนั้นเมื่อไม่มี `byCode` ของเรา
- ข้อความเตือนฝั่ง client (`commentSheet.fileNotAllowed/fileTooLarge`,
  `inventoryManagement.entryDialogs.evidenceTooLarge`) ใช้ ICU argument `{types}` / `{max}` แทนค่าคงที่
  (ห้ามมี `{{ }}` ในไฟล์แปล — ทำหน้าพังทั้งหน้า)
- notes dialog เป็น UI รูปหลักฐาน (thumbnail) จึงรับเฉพาะ MIME `image/*` ที่อยู่ในนโยบาย + ขนาดตามนโยบาย

## 5. ลำดับ deploy / rollback

1. **BE** — ปลอดภัยที่จะขึ้นก่อน: BU ที่ไม่ตั้ง = รูป + PDF 10MB เหมือนเดิม
2. **allowlist `attachmentPolicy.get`** ทุก env ที่ไม่ได้ `allow_all`
3. **carmen-platform** — เริ่มตั้งค่าให้ BU
4. **inventory FE**

rollback ถอยย้อนลำดับ · FE ที่ขึ้นก่อน BE จะได้ 404 จาก endpoint นโยบาย → ต้อง fallback เป็นค่าเริ่มต้น
**และต้องยืนยันจริงว่าไม่ทำให้ user ถูก logout**

## 6. การตรวจสอบ

ไม่เขียนเทสต์ใหม่ (preference ของ user) — ตรวจด้วย static check + เทสต์เดิม + มือ

- typecheck + lint ทั้งสามรีโป · jest ของ comment controller เดิมใน gateway ต้องเขียว
  (ใช้ jest ห้าม bun test) — เป็นตาข่ายตอนแก้ 46 ไฟล์
- curl ที่ `:4000` (BU T02, dev DB ที่ใช้ร่วมกัน — backup `config` ของ BU ก่อน คืนค่าเมื่อเสร็จ):
  - BU ไม่ตั้งค่า: `.txt` → 400 `ATTACHMENT_TYPE_NOT_ALLOWED` · PDF 11MB → `ATTACHMENT_TOO_LARGE`
  - ตั้ง `["image","pdf","excel"]` + 15 → `.xlsx` 12MB ผ่าน · ไฟล์ 30MB ถูก multer ตัด → `ATTACHMENT_TOO_LARGE`
  - `PATCH api/business-units` ส่ง `attachment.max_size_mb` → ค่าใน DB ไม่เปลี่ยน
  - `GET attachment-policy` ก่อนเติม allowlist บน env ที่ไม่ allow_all → ยืนยันพฤติกรรม
- เบราว์เซอร์: ตั้งใน platform → แผง comment ของ inventory เห็นผลภายใน 1 นาที (`accept`, ข้อความเตือน,
  อัปโหลด .xlsx ได้) · notes dialog ของ spot-check ใช้ค่าเดียวกัน

## ความเสี่ยง / สิ่งที่ต้องจำ

- แก้ 46 controller พร้อมกัน — พลาดจุดเดียว = comment ของโมดูลนั้นตรวจไฟล์ผิด · script ต้อง assert
  จำนวนจุดต่อไฟล์ และ grep ยืนยันว่า `ALLOWED_MIME_TYPES` เหลือ 0
- เปิด `word` / `excel` = ไฟล์ที่มี macro (.xls/.doc รุ่นเก่า) อัปโหลดได้ — ไม่มีการสแกนไวรัส ·
  ไฟล์ถูกเก็บและดาวน์โหลดคืนเท่านั้น ไม่ถูกเปิดฝั่ง server · ตัดสินใจรับความเสี่ยงนี้ระดับ BU ผ่าน platform
- cache 60 วินาทีต่อ instance — ค่าที่เพิ่งเปลี่ยนอาจต่างกันระหว่าง instance ได้ไม่เกิน 1 นาที
