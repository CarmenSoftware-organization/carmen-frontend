---
title: "หน้ารายละเอียด Price List และ Price List Template ใช้หัวการ์ดแบบ PR และตาราง audit ว่างเพราะ micro-business ไม่ส่งฟิลด์ผู้สร้าง/ผู้แก้"
author: Thammanoon
date: 2026-11-19
branch: fix/price-list-template-header-card
cost: { minutes: 5, tokens: 56836 }
id: l-c55c574c
scope: repo
status: active
replaces: l-127ea3fa
src: agent
touches:
  - routes/vendor-management/price-list-template/plt-form.tsx
  - routes/vendor-management/price-list/pl-form.tsx
---

## Decided
2026-11-19 ผู้ใช้สั่งให้หน้ารายละเอียด Price List แล้วต่อด้วย Price List Template มี style เดียวกับหัว PR: หัวเป็นการ์ดมีพื้น ปุ่มย้อนกลับในแถวชื่อ สถานะข้างชื่อ ช่อง General ย้ายเข้า ribbon ของหัว ตาราง audit ชิดขวาล่างข้างกริดในโหมดดู (ทรงหัว PR ไม่ใช่ทรง vendor เพราะมีแค่ 3–4 ช่อง) การ์ด General แยกเอาออก
- Price List: บรรทัดเลขที่ใบใต้ชื่อ มือถือไอคอน audit อยู่ท้ายบรรทัดนั้น
- Template: ไม่มีเลขที่ใบ ไอคอน audit มือถืออยู่ข้างป้ายสถานะ · Instructions to vendor เลิกวางคู่กับ General (ไม่มีคู่แล้ว) เป็นหมวดแรกของฟอร์ม
- Description โหมดดูกินช่องเดียวตั้งแต่ @md (div data-wide + @md:col-span-1!) ทรงหัว PR ไม่งั้นตกแถวสองเพราะตาราง audit กินที่ขวา

## Tried and ruled out
- โทษ FE เมื่อตาราง audit ไม่ขึ้น/ชื่อเป็น "—": ต้นเหตุคือ findOne ของ micro-business ไม่ select และ zod *DetailResponseSchema ไม่มี created_by_id/updated_by_id (Price List ไม่มีแม้แต่ created_at — ตารางไม่ขึ้นเลย; Template มีแค่เวลา — ขึ้นแต่ชื่อเป็น "—") gateway มี @EnrichAuditUsers อยู่แล้ว

## Watch out
- หน้า detail ไหนที่ DocAuditLine ไม่ขึ้นหรือชื่อเป็น "—" ให้ตรวจ *DetailResponseSchema ของ micro-business ก่อน เป็นบั๊กซ้ำแบบเดียวกันมาแล้ว 4 ครั้ง (product, vendor, price list, template)
- ช่อง General อยู่นอก <form> แล้ว กด Enter ไม่ submit (ทางเดียวกับ PR)
- ยังไม่ได้ดูหน้า /new, tablet, ธีมสว่าง, ภาษาไทย, skeleton ในเบราว์เซอร์ และยังไม่ได้กด Save จริง

In the code: FE routes/vendor-management/price-list/pl-form.tsx + pl-general-card.tsx (FE #692) · routes/vendor-management/price-list-template/plt-form.tsx (generalFields + ribbon) + plt-form-skeleton.tsx · BE apps/micro-business/src/master/price-list/ (#1090) และ price-list-template/ price-list-template.service.ts findOne + dto/price-list-template.serializer.ts
