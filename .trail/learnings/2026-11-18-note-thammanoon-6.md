---
title: "ตารางที่ซ่อนคอลัมน์ตามความกว้างกล่อง: เลขลำดับไม่อยู่ในขั้นที่ซ่อน ขั้นแคบสุดย้ายสถานะลงบรรทัดรองแทน"
author: Thammanoon
date: 2026-11-18
branch: feature/list-row-number
cost: { minutes: 47, tokens: 676202 }
id: l-38c55067
scope: repo
status: active
src: agent
touches:
  - routes/report/list/report-component.tsx
  - routes/system-admin/document/use-document-table.tsx
  - routes/inventory-management/transaction/use-transaction-table.tsx
  - routes/procurement/credit-note/use-cn-table.tsx
  - routes/procurement/goods-receive-note/use-grn-table.tsx
  - routes/procurement/my-approval/approve-queue-list.tsx
  - routes/procurement/purchase-order/use-po-table.tsx
  - routes/procurement/purchase-request/use-pr-table.tsx
  - routes/report/schedules/use-schedule-table.tsx
  - routes/store-operation/stock-replenishment/stock-repl-location.tsx
---

## Decided
2026-11-18 ผู้ใช้เลือกทาง A: ให้ `#` แสดงทุกความกว้าง ในตารางที่มี columnTier (มี 15 ตาราง) ถ้าใส่ `#` 48px แล้วขั้นแคบสุดเกินกล่อง tablet 662px ให้ย้ายคอลัมน์หนึ่งลงไปเป็นบรรทัดรองของช่องอื่นแทนการซ่อน `#`
- PO/GRN/CN: ชิปสถานะลงใต้ผู้ขาย · PR: ลงใต้เลขที่ (เฉพาะ My pending) · SR: ลงใต้แผนก
- My Approval: "รอมาแล้ว" ลงใต้ยอดเงิน · Document: ขนาดไฟล์ลงใต้ชื่อ
- Transaction/Wastage/Stock replenishment: tablet เป็นโหมด compact แต่ยังมีคอลัมน์ `#` · Schedules: ต่ำกว่า 718px ใช้การ์ด
- Vendor: ขั้นแคบสุดซ่อนคอลัมน์สถานะ · RFP: ความกว้างขั้นต่ำของชื่อเหลือ 170
จุดเปลี่ยนของขั้นที่อยู่ต่ำกว่าขั้นที่เคยซ่อน `#` ขยับขึ้นทีละ 48px ผลคือ CN ที่ 1366 ตอนเมนูกาง (กล่อง 1084) ไม่เห็นคอลัมน์ Invoice No แล้ว

## Tried and ruled out
- ซ่อน `#` เฉพาะ tablet: ขัดกับเหตุผลที่ใส่เลข คือใช้อ้างแถวเวลาคุยกัน
- ยอมให้ตารางเลื่อนแนวนอน: ขัดกับมาตรฐาน layout

## Watch out
- indexColumn เดิมใช้ row.index ซึ่งเป็นลำดับก่อนเรียง เปลี่ยนเป็นตำแหน่งที่แสดงจริงแล้ว ถ้าไม่ส่ง params จะอ่านหน้าจาก table.getState().pagination
- รายการที่โหลดสะสม (infinite/lazy) ต้องส่ง undefined หรือ {} ห้ามส่ง params ไม่งั้นเลขกระโดด
- ตารางที่ข้อมูลแบ่งหน้าฝั่ง server แต่การ์ดอยู่ในหน้าเดียวกัน (เช่น Report catalog) ต้องส่ง params ให้การ์ดด้วย

In the code:
- lib/row-number.ts rowNumber() / pageParamsOf()
- components/ui/data-grid/columns.tsx indexColumn(params?)
- components/share/list-card.tsx ListCard rowNo, ListCardRowNo
- columnTier() ใน use-po-table, use-grn-table, use-cn-table, use-pr-table, use-sr-table, approve-queue-list, use-document-table, use-transaction-table, use-wr-table, stock-repl-location, use-schedule-table (SCHEDULE_CARD_BELOW = 718)
