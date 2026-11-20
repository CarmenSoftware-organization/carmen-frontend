---
title: "หน้า Inventory Period เลิกใช้ตารางแบ่งหน้า เปลี่ยนเป็นกระดานรายปีบัญชีที่แสดงทุกรอบในครั้งเดียว"
author: Thammanoon
date: 2026-11-20
branch: feature/inventory-period-open-strip
cost: { minutes: 11, tokens: 259745 }
id: l-8d10ef1d
scope: repo
status: active
src: agent
touches:
  - routes/system-admin/inventory-period/inventory-period-timeline.tsx
  - routes/system-admin/inventory-period/inventory-period-board.tsx
  - routes/system-admin/inventory-period/inventory-period-component.tsx
---

## Decided
2026-11-20 ผู้ใช้สั่งให้หน้า Inventory Period ของ System Admin แสดงงวดที่เปิดอยู่ครบ แล้วให้หาวิธีแสดงแทนตาราง ("อาจไม่ใช่ตารางก็ได้")
- ทั้งหน้าเป็นกระดานรายปีบัญชี: แต่ละปีเป็นไทล์เดือน (ชื่อเดือน รหัสรอบ ช่วงวันที่ phase) ดึงทุกรอบครั้งเดียวด้วย useListAll ไม่มีแบ่งหน้า
- บนสุดเป็นแถบสรุปบรรทัดเดียว: จำนวนรอบที่เปิด ช่วงรอบ และจำนวนรอบค้างปิด (แทนแถบไทม์ไลน์ 12 ช่องรายปี)
- ตัดเดือนว่างหัว/ท้ายปีออก เหลือช่องประเพื่อเตือนเฉพาะรูโหว่กลางปี · ปีที่ปิดครบก่อนช่วงที่เปิดพับไว้หลังปุ่มเดียว
- ไม่มีช่องค้นหา ตัวกรอง หรือ saved view แล้ว (รอบมีปีละ 12)
- จำนวนคอลัมน์ของไทล์เป็นตัวหารของ 12 ตามความกว้างกล่อง (container query)

## Tried and ruled out
- ตารางแบ่งหน้าหน้าละ 10: งวดเปิด 12 รอบตกไปหน้า 2 และแถบไทม์ไลน์รายปีซ่อนงวดปีหน้าไว้หลังปุ่มเลื่อนปี
- โชว์ 12 ช่องเต็มทุกปี: ช่อง "ยังไม่มีรอบ" หัว/ท้ายปีกินที่เกินครึ่งจอโดยไม่ได้บอกอะไร
- ชิป "Open" บนไทล์ของรอบที่เปิด: ซ้ำกับ phase (ค้างปิด/กำลังใช้/ยังไม่ถึง) ชิปใช้กับรอบที่ปิด/ล็อกแล้วเท่านั้น

## Watch out
- export ส่ง perpage 100 (เพดาน backend) ประมาณ 8 ปี เกินกว่านั้นต้องเปลี่ยนไปวนหน้า
- skill carmen-blue-ui-design เคยยกหน้านี้เป็นตัวอย่าง "DataGrid with few columns" เอาออกแล้ว

In the code:
- routes/system-admin/inventory-period/inventory-period-board.tsx (InventoryPeriodBoard, TILE_GRID)
- routes/system-admin/inventory-period/inventory-period-component.tsx
- ลบ inventory-period-timeline.tsx, inventory-period-card.tsx, use-inventory-period-table.tsx
