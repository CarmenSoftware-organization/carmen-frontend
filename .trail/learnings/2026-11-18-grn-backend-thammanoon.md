---
title: "ใบลดหนี้: หน้ารายการแสดงเลข/วันที่ GRN และเลข/วันที่ใบแจ้งหนี้ ทั้งตารางและการ์ดมือถือ (backend ต้องขึ้นก่อน)"
author: Thammanoon
date: 2026-11-18
branch: fix/grn-list-mobile-4k
cost: { minutes: 12, tokens: 70208 }
id: l-1bcd7cb3
scope: repo
status: active
src: agent
touches:
  - routes/procurement/credit-note/cn-card-list.tsx
  - routes/procurement/credit-note/cn-card.tsx
  - routes/procurement/credit-note/cn-component.tsx
  - routes/procurement/credit-note/use-cn-table.tsx
  - routes/procurement/goods-receive-note/grn-card-list.tsx
  - routes/procurement/goods-receive-note/grn-card.tsx
  - routes/procurement/goods-receive-note/grn-component.tsx
  - routes/procurement/goods-receive-note/use-grn-table.tsx
  - types/credit-note.ts
---

## Decided
2026-11-18 ผู้ใช้สั่งให้หน้า CN list แสดง GRN No, GRN Date, Invoice No, Invoice Date ทั้งตารางและการ์ดมือถือ และยืนยันลำดับ CN No · Vendor · GRN No · GRN Date · Invoice No · Invoice Date · Type · Created By · Doc Date · Status · Amount (ผู้ขายต่อเลขที่ เหมือน PO/GRN)
list endpoint เดิมไม่ส่งทั้ง 4 ฟิลด์ (ทั้งที่ FE type ประกาศ grn_no/grn_date ไว้) จึงแก้ backend: select + map ใน micro-business findAll และ CreditNoteListItemResponseSchema ทั้ง micro และ gateway
ตารางซ่อนตามความกว้างกล่อง: # → ชนิด → ผู้สร้าง → วันที่ใบแจ้งหนี้ (ซ้อนใต้เลข) → วันที่ GRN (ซ้อนใต้เลข) → เลขใบแจ้งหนี้ → เลข GRN · การ์ดมือถือเพิ่มบรรทัดไอคอนกล่อง (GRN) และไอคอนเอกสาร (ใบแจ้งหนี้)

## Watch out
- deploy backend ก่อน FE — FE ก่อนคอลัมน์/บรรทัดว่าง (ไม่พัง)
- เพิ่มฟิลด์ใน list ต้องแก้ serializer ทั้ง micro และ gateway ไม่งั้น gateway ตัดทิ้งเงียบ ๆ
- เลขใบแจ้งหนี้ยาว (INV-PO-2603-02-…) ถูกตัดที่ 140px

In the code: routes/procurement/credit-note/use-cn-table.tsx columnTier() 1645/1585/1450/1310/1195/1080/940/800, roomy 1705; cn-card.tsx RefLine; types/credit-note.ts CreditNote invoice_no/invoice_date · BE: apps/micro-business/src/procurement/credit-note/credit-note.service.ts findAll, dto/credit-note.serializer.ts, apps/backend-gateway/src/common/dto/credit-note/credit-note.serializer.ts
