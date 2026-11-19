---
title: "หน้ารายละเอียด Price List ใช้หัวการ์ดแบบ PR และตาราง audit ว่างเพราะ micro-business ไม่ส่งฟิลด์ผู้สร้าง/ผู้แก้"
author: Thammanoon
date: 2026-11-19
branch: fix/price-list-detail-header-card
cost: { minutes: 8, tokens: 267865 }
id: l-127ea3fa
scope: repo
status: active
src: agent
touches:
  - routes/vendor-management/price-list/pl-edit-content.tsx
  - routes/vendor-management/price-list/pl-form.tsx
  - routes/vendor-management/price-list/pl-general-card.tsx
  - routes/vendor-management/price-list/pl-item-fields.tsx
---

## Decided
2026-11-19 ผู้ใช้สั่งให้หน้ารายละเอียด Price List มี style เดียวกับหัว PR: หัวเป็นการ์ดมีพื้น ปุ่มย้อนกลับอยู่ในแถวชื่อ ข้างชื่อมีสถานะกับป้ายช่วงราคา ใต้ชื่อเป็นบรรทัดเลขที่ใบ ช่อง General (Vendor, Currency, Effective Period, Description) ย้ายเข้า ribbon ของหัว ตาราง audit อยู่ชิดขวาล่างข้างกริดในโหมดดู (ทรงหัว PR ไม่ใช่ทรง vendor เพราะมีแค่ 4 ช่อง) การ์ดสรุปที่แยกไว้เอาออก หมวด Products จึงเป็นหมวดแรกของฟอร์มเสมอ

## Tried and ruled out
- โทษ FE เมื่อตาราง audit ไม่ขึ้น: ต้นเหตุคือ findOne ของ micro-business ไม่ select และ zod schema ของ detail ไม่มี created_at/created_by_id/updated_at/updated_by_id (มีแค่ใน schema ของ list) gateway มี @EnrichAuditUsers อยู่แล้วแต่ไม่มีอะไรให้ประกอบ

## Watch out
- หน้า detail ไหนที่ DocAuditLine ไม่ขึ้น ให้ตรวจ *DetailResponseSchema ของ micro-business ก่อน เป็นบั๊กซ้ำแบบเดียวกันมาแล้ว 3 ครั้ง (product, vendor, price list)
- ช่อง General อยู่นอก <form> แล้ว กด Enter ไม่ submit (ทางเดียวกับ PR)
- ยังไม่ได้ดูหน้า /new, tablet, ธีมสว่าง, ภาษาไทย, ใบโมฆะ และยังไม่ได้กด Save จริง

In the code: FE routes/vendor-management/price-list/pl-form.tsx (DOC_HEADER_CARD + inlineBack + subtitle=identityLine + ribbon) · pl-general-card.tsx (PlViewFields = FieldGrid dense + SettingField) · pl-edit-content.tsx (skeleton หัวเป็นการ์ด) · BE apps/micro-business/src/master/price-list/price-list.service.ts findOne + dto/price-list.serializer.ts PriceListDetailResponseSchema (BE #1090, FE #692)
