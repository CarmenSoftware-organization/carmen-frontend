---
title: "ตารางทุกตัวในแอป คลิกแถวแล้วไฮไลต์ค้าง เป็นค่าเริ่มต้น"
author: Thammanoon
date: 2026-11-13
branch: feat/data-grid-row-highlight
cost: { minutes: 18, tokens: 266349 }
id: l-38117d95
scope: repo
status: active
src: agent
touches:
  - components/ui/data-grid/data-grid.tsx
  - components/ui/data-grid/data-grid-table.tsx
---

## Decided
- 2026-11-13 ผู้ใช้สั่งที่หน้า Eco Certification ว่า "ปรับให้ตารางสามารถ คลิ๊ก hilight ได้" แล้วขยายเป็นทุกหน้า config list และสุดท้ายสั่ง "เปิดเป็นค่าเริ่มต้นของ DataGrid ทั้งแอป"
- คลิกส่วนไหนของแถวก็ไฮไลต์แถวนั้น ทีละแถว สีเดียวกับแถวที่ติ๊ก checkbox และแถวที่เลือกของต้นไม้หมวดหมู่ คลิกซ้ำไม่ยกเลิก
- เป็นแค่ตัวช่วยตามสายตา ไม่ใช่การเลือกเพื่อสั่งงาน จึงไม่แตะ row selection ของ TanStack
- ตารางไหนไม่ต้องการ ปิดเป็นรายตาราง

## Tried and ruled out
- เปิดเป็นตัวเลือกของ template หน้า config list อย่างเดียว: ครอบแค่ 19 หน้า หน้าที่ประกอบตารางเอง (Equipment Category, Running Code, หน้าเอกสาร) ไม่ได้ ผู้ใช้จึงสั่งเปิดทั้งแอป
- จำแถวที่ไฮไลต์ด้วย row id ของ TanStack: ค่าเริ่มต้นคือลำดับแถว เปลี่ยนหน้าหรือเรียงใหม่แล้วไฮไลต์ค้างที่ตำแหน่งเดิมบนข้อมูลคนละตัว → จำด้วย id ของข้อมูล แถวที่ยังไม่มี id (แถวใหม่ในฟอร์ม) ถอยไปใช้ลำดับแถว

## Watch out
- ตารางที่มี checkbox: แถวที่คลิกกับแถวที่ติ๊กสีเดียวกัน แยกได้จากช่องติ๊กเท่านั้น
- ตรวจด้วยการคลิกจริงแค่ Eco, Extra Cost, Equipment Category, Running Code, รายการ PO/Product และตารางในฟอร์ม PO — ตารางลากเรียงแถว ตารางที่แถวกางออกได้ ยังไม่ได้ตรวจ

In the code:
- components/ui/data-grid/data-grid.tsx — tableLayout.rowHighlight (default true), highlightedRowId ใน context
- components/ui/data-grid/data-grid-table.tsx — DataGridTableBodyRow: highlightKey, data-state="selected", data-highlighted
