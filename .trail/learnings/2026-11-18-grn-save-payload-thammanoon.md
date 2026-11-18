---
title: GRN ล้างคำอธิบายหรือหมายเหตุให้ว่างแล้วกด Save ค่าเดิมยังอยู่ เพราะ payload กรองค่าว่างทิ้ง
author: Thammanoon
date: 2026-11-18
branch: fix/doc-card-followups
cost: { minutes: 14, tokens: 656645 }
id: l-5db5066a
scope: repo
status: active
src: agent
touches:
  - components/loader/doc-page-skeleton.tsx
  - routes/procurement/goods-receive-note/use-grn-form-actions.ts
  - routes/procurement/purchase-request/pr-item-cards.tsx
---

## Decided
2026-11-18 เจอระหว่างทดสอบ Save จริงบน dev: ล้างช่องคำอธิบายของ GRN draft ให้ว่างแล้วกด Save Draft ระบบตอบสำเร็จ แต่ค่าเดิมยังอยู่ ต้นเหตุคือ payload ใช้ `values.description || undefined` ค่าว่างจึงกลายเป็น undefined แล้วถูก filter ทิ้ง ระบบจึงไม่ได้ส่งคำสั่งล้างค่าไปเลย แก้ให้ description กับ note ส่ง "" ไปแบบเดียวกับ PO (หลังบ้านรับ "" ได้ ทดสอบกับ PO แล้วล้างค่าได้จริง)

## Watch out
- invoice_no, invoice_date, grn_date ยังเป็น `|| undefined` อยู่ ล้างให้ว่างไม่ได้เหมือนกัน แต่เป็นช่องที่มีกติกาตรวจ จึงยังไม่ได้แก้
- ทดสอบ Save บน GRN ให้ใช้ใบ draft กับปุ่ม Save Draft เท่านั้น ปุ่ม Save ของใบ saved ทำให้หลังบ้านลงสต็อก

In the code: routes/procurement/goods-receive-note/use-grn-form-actions.ts (raw payload ใน onSubmit)
