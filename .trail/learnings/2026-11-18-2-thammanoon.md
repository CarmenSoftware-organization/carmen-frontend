---
title: "หัวเอกสารบนมือถือ: ช่องโหมดดูแบ่ง 2 คอลัมน์ตั้งแต่กล่องแคบสุด ช่องกรอกยังคอลัมน์เดียว"
author: Thammanoon
date: 2026-11-18
branch: feature/pr-item-responsive
cost: { minutes: 3, tokens: 37157 }
id: l-073355fe
scope: repo
status: active
src: agent
touches:
  - components/share/compact-section.tsx
  - components/share/setting-field.tsx
  - routes/procurement/credit-note/cn-general-fields.tsx
  - routes/procurement/credit-note/cn-header.tsx
  - routes/procurement/goods-receive-note/grn-form-header.tsx
  - routes/procurement/goods-receive-note/grn-header.tsx
  - routes/procurement/purchase-order/po-header.tsx
  - routes/procurement/purchase-request/pr-header.tsx
  - routes/store-operation/store-requisition/sr-header.tsx
  - routes/store-operation/store-requisition/sr-request-details.tsx
---

## Decided
2026-11-18 ผู้ใช้เลือกให้หัวเอกสาร PR, GRN, CN, SR บนมือถือแสดงช่องโหมดดูเป็น 2 คอลัมน์ตั้งแต่กล่องแคบสุด เพราะค่าส่วนใหญ่สั้น (วันที่ เลขที่ใบ สกุลเงิน) แบบคอลัมน์เดียวทำให้หัว CN สูงเกินหนึ่งจอ ช่องที่ยาว (Vendor, Description) ยังกินเต็มแถว และเมื่อหัวแคบ กลุ่มป้ายสถานะไม่มีเส้นคั่นซ้าย

## Watch out
- dense ใช้ได้กับช่องที่เป็นข้อความล้วนเท่านั้น ห้ามใส่กับช่องกรอก เพราะกล่องกว้างแค่ ~150px ต่อช่อง ฟอร์มจึงส่ง dense={isView}
- ช่องที่ต้องกินเต็มแถวต้องมี data-wide ซึ่ง SettingField fullWidth ใส่ให้แล้ว ส่วน Field ที่เขียน @md:col-span-2 เองจะได้แค่ครึ่งแถวในโหมด dense
- PO ยังไม่ได้ทำ เพราะโหมดดูของ PO ยังเป็นช่อง input ที่ disabled ไม่ใช่ข้อความ ต้องแปลงเป็นข้อความก่อน
- ตารางรายการของ CN บนมือถือถูกบีบจนหัวคอลัมน์ทับกัน ปัญหานี้มีมาก่อนแล้ว ไม่ได้เกิดจากงานนี้ และยังไม่ได้แก้

In the code: FieldGrid prop dense ใน components/share/compact-section.tsx · data-wide ใน components/share/setting-field.tsx
