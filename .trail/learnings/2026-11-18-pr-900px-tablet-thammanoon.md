---
title: "รายการสินค้าในหน้า PR เป็นการ์ดแถวละใบเมื่อกล่องแคบกว่า 900px ทั้งมือถือและ tablet"
author: Thammanoon
date: 2026-11-18
branch: feature/pr-item-responsive
cost: { minutes: 5, tokens: 100250 }
id: l-67d749fb
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-request/pr-item-cards.tsx
  - routes/procurement/purchase-request/pr-item-fields.tsx
  - routes/procurement/purchase-request/use-pr-item-table.tsx
---

## Decided
2026-11-18 ผู้ใช้เลือกให้ตารางรายการสินค้าในหน้า PR detail แสดงเป็นการ์ดแถวละใบ ทั้งบนมือถือและ tablet เมื่อกล่องแคบกว่า 900px (วัดจากกล่อง ไม่ใช่จอ) แทนการเลื่อนตารางแนวนอน ซึ่งเดิมซ่อนจำนวนกับยอดเงินไว้หลังขอบ การ์ดวาด cell เดิมของตารางด้วย flexRender การแก้ไข การติ๊กเลือก การกางแถว และหมายเหตุจึงยังทำงานเหมือนเดิม

## Tried and ruled out
- ตารางย่อบน tablet (เหลือ # · Product · Requested · FOC · Amount): กล่องที่ 768 กว้างราว 630px แต่ตารางย่อนี้ยังกว้าง 695px ในโหมด view และ 790px ในโหมด edit ใบที่อยู่ใน stage อนุมัติยังมี select + Approved เพิ่มอีก ถ้าจะให้พอดีต้องซ่อนยอดเงินทิ้งด้วย
- เปลี่ยนเป็นการ์ดเมื่อกล่องแคบกว่า table.getTotalSize() (~1,165px): HD 1366 ที่กาง sidebar ได้กล่อง ~1,080px ก็จะกลายเป็นการ์ดไปด้วย

## Watch out
- โหมดการ์ดไม่มีหัวตาราง checkbox "เลือกทั้งหมด" จึงต้องยกขึ้นมาไว้เหนือการ์ด ส่วนการกดหัวคอลัมน์เพื่อเรียงใช้ไม่ได้ในโหมดนี้
- handleAddItem ใช้ selector `tbody tr, [data-pr-item-card]` หาแถวแรก
- ที่ HD ตารางยังล้นขวาอยู่เล็กน้อย (Delivery Date ถูกตัด) ปัญหานี้มีมาก่อนแล้ว

In the code: routes/procurement/purchase-request/pr-item-cards.tsx, ITEM_CARDS_MAX_WIDTH ใน pr-item-fields.tsx
