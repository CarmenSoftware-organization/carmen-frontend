---
title: "รายการสินค้าโหมดดูของ CN GRN PO SR เป็นการ์ดแถวละใบเมื่อกล่องแคบกว่า 900px"
author: Thammanoon
date: 2026-11-18
branch: feature/pr-item-responsive
cost: { minutes: 5, tokens: 40100 }
id: l-c4f6a533
scope: repo
status: active
replaces: l-17da51a3
src: agent
touches:
  - routes/procurement/goods-receive-note/grn-item-cards.tsx
  - routes/procurement/goods-receive-note/grn-item-table.tsx
  - routes/procurement/purchase-order/po-item-cards.tsx
  - routes/procurement/purchase-order/po-item-cells/comment-footer-row.tsx
  - routes/procurement/purchase-order/po-item-fields.tsx
  - routes/store-operation/store-requisition/sr-item-cards.tsx
  - routes/store-operation/store-requisition/sr-item-fields.tsx
---

## Decided
2026-11-18 ผู้ใช้สั่งให้รายการสินค้าของ CN ในโหมดดูบนมือถือและ tablet เป็นการ์ด แล้วสั่งต่อให้ GRN, PO, SR ทำแบบเดียวกัน กล่องรายการที่แคบกว่า 900px จะเป็นการ์ดแถวละใบ ส่วนโหมดแก้และจอ HD ขึ้นไปยังเป็นตาราง (PR ทำการ์ดไว้ก่อนแล้ว และใช้กับโหมดแก้ด้วย)
- CN: แถวที่กางออก (ยอดตาม GRN) กลายเป็นส่วน "GRN Reference" ในการ์ด
- PO: แถวหมายเหตุ (footerContent) อยู่ท้ายการ์ด
- GRN, SR: ไม่มีแถวกางหรือแถว footer

## Tried and ruled out
- CN ใช้แถวกางเดิม (CnGrnRow) ในการ์ด: เป็นตารางซ้อนที่คิดความกว้างเป็น % ของคอลัมน์ตารางหลัก ใส่ในการ์ดแล้วไม่มีคอลัมน์ให้ตรง
- CN ล็อกความกว้างขั้นต่ำแล้วเลื่อนแนวนอน: ใช้ได้ แต่ผู้ใช้เลือกการ์ด
- เทียบกับผลรวม size ตรง ๆ: HD 1366 ที่กาง sidebar ได้กล่อง ~1,080px ก็จะเป็นการ์ดไปด้วย

## Watch out
- การ์ดของแต่ละโมดูลเป็นสำเนาแยกกัน ESLint ห้าม route module import ข้ามกัน ถ้าจะแก้ทรงการ์ด ต้องแก้ทั้ง 4 ไฟล์ (หรือยกไปไว้ใน components/ ก่อน)
- flexRender ห่อ cell ที่เป็นฟังก์ชันเป็น element เสมอ ผลจึงไม่เคยเป็น null การ์ดเลยเรียกฟังก์ชัน cell ตรง ๆ เพื่อดูว่าช่องว่างหรือไม่ ซึ่งปลอดภัยตราบที่ฟังก์ชัน cell ไม่เรียก hook เอง
- PO ใช้การ์ดเฉพาะ isViewMode && disabled ผู้อนุมัติที่อยู่ในโหมดแก้ (มีช่องติ๊ก) ยังเป็นตาราง
- ป้ายของคอลัมน์ Dimensions ใน GRN เป็นข้อความ "Dim" ที่เขียนไว้ตรง ๆ ไม่ผ่าน i18n

In the code: cn-item-cards.tsx, grn-item-cards.tsx, po-item-cards.tsx, sr-item-cards.tsx · ค่า *_ITEM_CARDS_MAX_WIDTH = 900 ในไฟล์ items ของแต่ละโมดูล
