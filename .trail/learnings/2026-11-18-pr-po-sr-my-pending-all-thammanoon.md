---
title: "แถบเครื่องมือหน้า PR/PO/SR เมื่อแถบแคบ ปุ่ม My pending/All Documents ขึ้นเป็นบรรทัดแรก ให้ช่องค้น View และ Filter อยู่ติดกัน"
author: Thammanoon
date: 2026-11-18
branch: fix/pr-list-mobile-cards
cost: { minutes: 6, tokens: 61831 }
id: l-78030c33
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-order/po-component.tsx
  - routes/procurement/purchase-request/pr-card-list.tsx
  - routes/procurement/purchase-request/pr-card.tsx
  - routes/procurement/purchase-request/pr-component.tsx
  - routes/procurement/purchase-request/use-pr-filter-fields.tsx
  - routes/store-operation/store-requisition/sr-component.tsx
  - components/list-filter/list-toolbar.tsx
  - routes/procurement/purchase-request/use-pr-table.tsx
---

## Decided
2026-11-18 ผู้ใช้เลือก: เมื่อแถบเครื่องมือแคบกว่า 56rem (วัดจากความกว้างแถบ ไม่ใช่จอ) ปุ่มขอบเขต My pending / All Documents ขึ้นเป็นบรรทัดแรก บรรทัดสองเป็นช่องค้น + View + Filter ติดกัน (ห่าง 17px ตามกฎข้อ 12) และปุ่มตารางชิดขวาบรรทัดเดียวกัน แถบกว้างกว่านั้นอยู่แถวเดียวเหมือนเดิม บนมือถือก็เรียงแบบนี้ (ขอบเขตอยู่บนสุด)
ตาราง PR list ยุบวันที่ลงใต้เลขที่ก่อนซ่อนคอลัมน์ผู้ขอ เพราะคอลัมน์เลขที่ 210px ใช้จริงแค่ราว 90px ที่ 1024 (เมนูกาง) All Documents จึงได้คอลัมน์ผู้ขอคืนมา และแผนกกว้างจาก 177 เป็น 222px

## Tried and ruled out
- ให้ปุ่มขอบเขตเหลือแต่ไอคอนเพื่อให้ทุกอย่างอยู่บรรทัดเดียว: ประหยัดได้หนึ่งบรรทัด แต่คนต้องเดาความหมายของไอคอน "My pending" ซึ่งเป็นขอบเขตตั้งต้น
- ปล่อยให้ flex-wrap ตัดบรรทัดเอง (แบบเดิม): View/Filter ตกบรรทัดสองห่างจากช่องค้น และปุ่มตารางลอยกลางระหว่างสองบรรทัด

## Watch out
- ลูกทุกตัวของแถบต้องอยู่ใน flex-wrap ชั้นเดียว order ถึงย้าย scope ขึ้นบรรทัดแรกได้ (order ข้ามกลุ่มที่ซ้อนกันไม่ได้) จึงใช้ผังแยกเฉพาะตอนส่ง scope
- จุด 56rem ตั้งจากภาษาอังกฤษ ป้ายภาษาไทยยาวกว่า ยังไม่ได้ตรวจ

In the code: components/list-filter/list-toolbar.tsx prop `scope` (@container/list-toolbar, order-first w-full @4xl/list-toolbar:order-none) — ลบ beforeViewSelector แล้ว; pr/po/sr-component ส่ง scope={<ViewModeToggle className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto" />}; routes/procurement/purchase-request/use-pr-table.tsx columnTier() 965/905/805(wide)/650(showRequester)
