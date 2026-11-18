---
title: "ตารางใบรับสินค้า: วันที่ใบแจ้งหนี้เป็นคอลัมน์ของตัวเองเมื่อกล่องพอ ส่วนกล่องแคบซ้อนใต้เลขใบแจ้งหนี้"
author: Thammanoon
date: 2026-11-18
branch: fix/grn-list-mobile-4k
cost: { minutes: 17, tokens: 66473 }
id: l-b1ab534b
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-request-template/prt-card.tsx
  - routes/procurement/purchase-request-template/prt-component.tsx
  - routes/procurement/credit-note/cn-card-list.tsx
  - routes/procurement/goods-receive-note/use-grn-table.tsx
---

## Decided
2026-11-18 ผู้ใช้สั่งให้หน้า GRN list แสดงคอลัมน์ GRN No, GRN Date, Invoice No, Invoice Date และเลือกลำดับแบบ PO คือผู้ขายอยู่ต่อจากเลขที่ (GRN No · Vendor · GRN Date · Invoice No · Invoice Date · Status · …)
วันที่ใบแจ้งหนี้เลิกซ่อนเป็นค่าตั้งต้น เป็นคอลัมน์ของตัวเองเมื่อกล่อง ≥1150 (1366 เมนูพับ, Full HD, 4K) กล่องแคบกว่านั้น (1366 เมนูกาง = 1084) ซ้อนเป็นบรรทัดรองใต้เลขใบแจ้งหนี้ ซึ่งผู้ใช้เลือกเอง
ลำดับที่หลุดออกเมื่อกล่องแคบลง: # → ชนิดใบ → ผู้รับ → วันที่ใบแจ้งหนี้ → เลขใบแจ้งหนี้ → วันที่ GRN · กล่อง ≥1540 ผู้รับกว้าง 200px

## Tried and ruled out
- บีบคอลัมน์อื่นเพื่อให้วันที่ใบแจ้งหนี้ขึ้นที่ 1366 เมนูกาง (GRN No 180→150, Invoice No 160→140): ผู้ขายจะเหลือ ~140px จาก 269 ผู้ใช้ไม่เลือก
- เรียงสี่คอลัมน์เลข/วันที่ติดกันแล้วค่อยผู้ขาย: ผู้ใช้เลือกให้ผู้ขายต่อจากเลขที่เหมือน PO

## Watch out
- ถ้าผู้ใช้ปิดคอลัมน์วันที่ใบแจ้งหนี้เองจากเมนู Toggle Columns วันที่จะกลับไปซ้อนใต้เลขใบแจ้งหนี้

In the code: routes/procurement/goods-receive-note/use-grn-table.tsx columnTier() 1480/1420/1290/1150(showInvoiceDate)/1025/865, roomy 1540; invoiceDateColumn คุมการซ้อนในเซลล์ invoice_no
