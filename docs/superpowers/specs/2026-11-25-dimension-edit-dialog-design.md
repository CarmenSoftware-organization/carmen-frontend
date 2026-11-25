# Dimension edit dialog — รวมเป็นตัวเดียว + บันทึกค่าย่อยครั้งเดียว

ขนาด: งานเล็ก (FE อย่างเดียว หลักอยู่ที่ `routes/config/dimension/dimension-page.tsx` + จุดอ่าน `date_format` 2–3 ไฟล์)

## ทำไม

หน้า `/config/dimension` แก้ค่าย่อย (List Master Items) ได้สองทางที่ขัดกัน:
`DimensionDialog` ค้างการแก้ไว้จนกด Save ส่วน `DimensionValuesDialog` (ปุ่ม "N values")
บันทึกทันทีทีละแถว หน้าตาก็ไม่เหมือนกัน และฟอร์มเรียงแถวยาวมากเมื่อมีค่าย่อยหลายรายการ
ผู้ใช้ขอให้จัดหน้าตาใหม่และแก้วิธีบันทึก detail

## เป้าหมาย / ไม่ทำ

- เป้าหมาย: dialog เดียว แก้ header + ค่าย่อยในที่เดียว กด Save ครั้งเดียว และเห็นชัดว่าแถวไหนค้าง/พัง
- ไม่ทำ: endpoint ใหม่ฝั่ง BE, transaction แบบ atomic, ถามยืนยันก่อนปิดเมื่อมีของยังไม่บันทึก (ผู้ใช้ไม่เลือก)
- ห้ามเกิด: แถวที่บันทึกผ่านแล้วถูกส่งซ้ำตอนกด Save รอบสอง หรือแถวที่พังหายไปเงียบ ๆ

## Approaches

- **ก. dialog เดียว staged, Save ครั้งเดียว** ← เลือก — FE อย่างเดียว เข้ากับหน้าเอกสารอื่น
  ข้อเสีย: ไม่ atomic (header ผ่านแต่ค่าย่อยบางแถวพังได้) จึงต้องแสดงสถานะรายแถว
- ข. header กด Save, ค่าย่อยบันทึกทันทีทีละแถว — ตัดทิ้ง: สร้างใหม่ต้องกด Create ก่อนเพิ่มค่าย่อย และลืมกด ✓ ได้
- ค. request เดียว BE ทำ transaction — ตัดทิ้ง: ต้องแก้ BE + deploy BE ก่อน + allowlist

โครงหน้า: เทียบ A (ซ้อนบนล่าง) กับ B (ข้างกัน) ใน mockup — ผู้ใช้เลือก **B**

## สิ่งที่ตกลงแล้ว

- ตัด `DimensionValuesDialog` ออก ปุ่ม "N values" เปิด `DimensionDialog` ตัวเดียวกัน
- โครง B: ช่อง dimension อยู่คอลัมน์ซ้าย ตารางค่าย่อยอยู่ขวา dialog `max-w-5xl`
- ค่าย่อยเป็นตาราง แก้ในแถว: checkbox · Code (ล็อกเมื่อบันทึกแล้ว) · Name (EN)* · Name (TH) · **Active** (ใหม่)
- สถานะแถว: แก้แล้วยังไม่บันทึก (แถบส้มซ้าย) · แถวใหม่ (พื้นฟ้า) · จะลบ (ขีดฆ่า, ยกเลิกได้จน Save) · บันทึกไม่ผ่าน (พื้นแดง + ข้อความใต้ช่อง)
- กด Save ซ้ำส่งเฉพาะแถวที่ยังค้าง (logic `dirty` ใน `saveDimensionWithValues` ทำอยู่แล้ว — เพิ่มการเก็บ error รายแถวแทน throw ตัวแรกตัวเดียว)
- dimension ใหม่ใส่ค่าย่อยก่อน Create ได้เหมือนเดิม; read-only ไม่มี checkbox/ปุ่ม
- **เลิกใช้ `date_format` ของ dimension ทั้งระบบ** — วันที่ของ dimension แสดงตามรูปแบบวันที่ในโปรไฟล์ผู้ใช้
  เหมือนช่องวันที่อื่นทั้งแอป
  - dialog: ตัดช่อง Date Format และไม่ส่ง `date_format` ตอน save
  - `components/dimension/dimension-value-input.tsx`: DatePicker ไม่ส่ง `displayFormat` อีก (ใช้ของโปรไฟล์)
  - `lib/dimension-value.ts` / `hooks/use-dimension-value-formatter.ts`: ค่าวันที่จัดรูปแบบด้วยรูปแบบจากโปรไฟล์ ไม่อ่าน `dimension.date_format`
  - ค่าที่เก็บยังเป็น `YYYY-MM-DD` เหมือนเดิม; BE / คอลัมน์ DB ไม่แตะ (ปล่อยค้าง)
  - ตัดทิ้ง: ซ่อนใน dialog อย่างเดียว — ของเก่ายังใช้ format ที่มองไม่เห็นและแก้ไม่ได้ ผลไม่เท่ากันตามอายุ dimension

## การตัดสินของผม (ตรวจได้)

- เปิดจาก "N values" → focus ไปที่ตารางค่าย่อย
- จอ < `@3xl` ของ container เรียงบนล่าง
- data type ที่ไม่ใช่ lookup → ไม่มีตาราง dialog หดเป็น `max-w-xl` ช่องเรียง 2 คอลัมน์
- ใช้ primitive ที่มีใน `components/ui/` และ type ladder เดิม ไม่ตั้งสี/ขนาดใหม่ที่ call site; สีสถานะแถวใช้ token ที่มี (ต้องอ่านออกทั้ง light/dark)

## เหลือให้คนทำ

- ตำแหน่ง checkbox ลบหลายแถว vs ปุ่มลบรายแถว, ข้อความ toast สรุปผล, อัปเดต `dimension-page.test.tsx` ให้ตรงพฤติกรรมใหม่ (เทสต์เดิมต้องเขียว)

## เพิ่มเติมหลังอนุมัติ (2026-11-25)

- ตารางค่าย่อยเปลี่ยนหัวเป็น **Value / Label** และเพิ่ม **Description** (ไม่บังคับ, ≤500 ตัว) อธิบายความหมายของ label
- ซ่อนชื่อภาษาไทย (`name_local`) ทั้งของ dimension และค่าย่อย ทั้ง dialog และตาราง list จนกว่าจะทำหลายภาษา — ค่าเดิมใน DB ไม่ถูกลบ (dialog ส่งค่าเดิมกลับตอนบันทึก)
- Description ต้องมี BE: `carmen-turborepo-backend` PR #1115 (คอลัมน์ใหม่ `tb_dimension_value.description`) — **ลำดับ deploy: migrate ทุก tenant → BE → FE** ถ้า FE ขึ้นก่อน ค่าที่กรอกจะหายเงียบ
