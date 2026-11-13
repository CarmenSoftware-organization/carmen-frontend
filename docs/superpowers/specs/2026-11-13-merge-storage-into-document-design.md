# รวมหน้า Storage เข้าหน้า Document Management

วันที่: 2026-11-13 · ขนาดงาน: เล็ก (frontend อย่างเดียว)

## เจตนา

คนใช้สองหน้านี้คือ admin และเขาต้องเปิดสองหน้าที่ไม่เชื่อมกันเพื่อดูเรื่องเดียวกัน:
หน้า Storage บอกว่าใช้พื้นที่ไปเท่าไรเทียบโควตา ส่วนหน้า Document บอกว่าไฟล์ไหนกินพื้นที่
และลบได้ รวมให้เหลือหน้าเดียวคือ `/system-admin/document`

## เป้าหมาย

- หน้า Document แสดงโควตา (ไฟล์แนบ + database) เหนือรายการไฟล์
- ไม่มีหน้า Storage, เมนู Storage และการ์ด Storage บน landing อีก
- ลิงก์และ bookmark เก่าที่ชี้ `/system-admin/storage` ยังพาไปถึงที่ที่ใช้งานได้

## ไม่ทำ

- ไม่แก้ backend, endpoint, license feature หรือ permission
- ไม่ทำให้ยอดที่วัดเป็นรอบกับยอดสดตรงกัน (ผู้ใช้เลือกแบบ A: แสดงตามจริงทั้งคู่)
- ไม่แตะแบนเนอร์เตือนโควตานอกจากปลายทางของลิงก์
- ไม่เขียนเทสต์ใหม่ (แก้เฉพาะเทสต์เดิมที่แดงเพราะการลบ)

## สิ่งที่ต้องไม่เกิด

- ผู้ใช้ที่ไม่มี `system_admin.view` เห็นปุ่ม "วัดใหม่"
- หน้า Document ขึ้น error state เพราะ endpoint โควตาหรือ endpoint สรุปโหลดไม่ได้
  (ทั้งสองต้องเงียบเหมือนเดิม — เคสจริงคือ api_name ยังไม่อยู่ใน allowlist)
- ตารางกระตุกตอน skeleton ของกล่องบนสลับเป็นของจริง

## ทางเลือกที่พิจารณา

1. **ย้ายเข้าโฟลเดอร์ Document แล้วลบหน้า Storage — เลือกทางนี้** ได้หน้าเดียวจริง
   ไม่เหลือโค้ดค้าง แลกกับต้องปรับความสูงตารางใหม่
2. คงไฟล์ของ Storage ไว้แล้ว import มาใช้ — แก้น้อยกว่า แต่เหลือโฟลเดอร์ที่ไม่มีหน้า
   และการ์ดเดิมเป็นหน้าเต็ม ต้องรื้อข้างในอยู่ดี
3. ทำเป็นแท็บในหน้า Document — admin ยังต้องสลับสองมุมมอง คือปัญหาเดิม

## แบบ

```
Document Management                                   [วัดใหม่] [Upload]
┌──────────────────────────────────────────────────────────────────────┐
│ ไฟล์แนบ  1.2 GB / 5 GB (24%)  ▓▓▓░░░░░░   Database  310 MB / 2 GB ▓░░░ │
│ วัดล่าสุด 13 พ.ย. 12:05 · PR 400 MB · GRN 310 MB · PO 120 MB  ดูทั้งหมด › │
└──────────────────────────────────────────────────────────────────────┘
[ค้นหา…] [ตัวกรอง]                                   [list|grid|preview]
```

ผู้ใช้ตัดสินแล้ว:

- แถบโควตาสองตัวแทนแถบสรุปเดิมเหนือช่องค้นหา
- แจกแจงตามชนิดเหลือชุดเดียว คือชุดของหน้า Document (`useDocumentSummary`:
  บรรทัดย่อ 3 ชนิดแรก + Sheet "ดูทั้งหมด") กริด `by_reference_type` ของหน้า Storage ตัดทิ้ง
- ปุ่ม "วัดใหม่" อยู่ข้างปุ่ม Upload เห็นเฉพาะ `system_admin.view` พฤติกรรม 429
  (ปิดปุ่ม + tooltip) เหมือนเดิม
- ยอดวัดเป็นรอบกับยอดสดแสดงตามจริงทั้งคู่ แถบโควตากำกับ "วัดล่าสุดเมื่อ…"

ผมตัดสินเอง (แก้ได้):

- ไฟล์ใหม่ `routes/system-admin/document/document-storage-bar.tsx` แทน
  `document-summary-bar.tsx` (ลบไฟล์เดิม) รับ `usage` + `summary` + สถานะโหลด
- แต่ละครึ่งของกล่องซ่อนตัวเองได้อิสระ: โควตาโหลดไม่ได้ = เหลือบรรทัดแจกแจงเหมือนวันนี้ ·
  BU ยังไม่มีไฟล์ = เหลือแถบโควตา · ไม่มีทั้งคู่ = ไม่แสดงกล่อง
- "วัดล่าสุด" แสดงครั้งเดียวต่อกล่อง (เวลาของ kind ไฟล์แนบ) ไม่ซ้ำใต้ทุกแถบ
- มือถือ: แถบโควตาเรียงลงเป็นคอลัมน์ ใช้ container query เหมือนแถบเดิม
- `/system-admin/storage` เป็น redirect (`replace`) ไป `/system-admin/document`
- ลิงก์ในแบนเนอร์เตือนโควตาชี้ `/system-admin/document` ตรง ๆ
- กลุ่ม "Data" บน landing ของ System Admin ว่างหลังลบการ์ด จึงลบทั้งกลุ่ม
- ลบคีย์แปลที่ไม่มีผู้ใช้แล้ว (`storageQuota.pageTitle/pageDesc/usageTitle/breakdown*/openDocuments`,
  ชื่อเมนูและข้อความการ์ด storage) ทั้ง en และ th

## จุดที่แตะ

- `routes/system-admin/document/document-component.tsx` — ใช้แถบใหม่, ปุ่มวัดใหม่ใน
  `actions`, ปรับ `max-h` ของตารางตามความสูงกล่องใหม่ (คงหลัก `summarySlotVisible`:
  เผื่อพื้นที่ตั้งแต่ตอนโหลด)
- `routes/system-admin/storage/` — ลบทั้งโฟลเดอร์
- `routes/router.tsx` · `constant/module-list.ts` · `routes/system-admin/landing-types.ts` ·
  `routes/system-admin/landing-visuals.tsx` · `components/storage-quota-banner.tsx` ·
  `hooks/use-storage-usage.ts` (คอมเมนต์) · `messages/{en,th}.json`

## เหลือให้คนลงมือ

- ค่า `max-h` จริงของตารางในสี่เคส (มี/ไม่มีกล่อง × มี/ไม่มี active filter) วัดจากหน้าจริง
- เทสต์เดิมที่ต้องตามแก้: ข้อยกเว้นใน type ladder เมื่อลบภาพประกอบการ์ด landing,
  เทสต์ module-list / landing ที่อ้าง storage

## ตรวจ

`bun run typecheck` · `bun run lint` · `bun test:run` แล้วดูหน้าจริงที่ 5 ขนาดจอ
(มือถือ, tablet, 1366, Full HD, 4K) ทั้งธีมสว่างและมืด ด้วยบัญชี admin และบัญชีที่ไม่มี
`system_admin.view`
