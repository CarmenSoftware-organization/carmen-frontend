---
title: "เซลล์ตารางที่ต้องวางของเป็นแถวหรือหลายบรรทัด ต้องหนีการตัด 2 บรรทัดของตาราง ไม่งั้นป้ายล้นไปทับข้อความ"
author: Thammanoon
date: 2026-11-17
branch: main
cost: { minutes: 5, tokens: 219545 }
id: l-f81590ab
scope: repo
status: active
src: agent
touches:
  - routes/config/chart-of-account-mapping/coam-cells.tsx
---

## Decided
ในหน้าผังการผูกบัญชี ย้ายป้ายที่มา/ป้ายเตือนขึ้นไปอยู่ข้างรหัสบนบรรทัดแรก (บรรทัดสอง = ชื่อ) แทนการวางป้ายเป็นบรรทัดที่สาม เพราะแถวในตารางสูงได้แค่ 2 บรรทัด ของบรรทัดที่สามจะล้นไปทับข้อความแถวเดิม/แถวอื่น

## Watch out
ตัวห่อเนื้อหาเซลล์ของ DataGrid ใส่ line-clamp-2 ให้ลูกทุกตัวที่ไม่มี attribute data-slot — line-clamp เปลี่ยน display เป็น -webkit-box จึงทับ `flex` / `flex-col` ที่เขียนไว้เงียบ ๆ (computed style ยังโชว์ flex-direction แต่ layout ไม่ทำตาม) เซลล์ที่ต้องจัด flex เองให้ใส่ data-slot ที่ root ของเซลล์

In the code:
- routes/config/chart-of-account-mapping/coam-cells.tsx — ValueLayout / EmptyValue ใส่ data-slot="coam-value"
- wrapper class: `[&>*:not([data-slot])]:line-clamp-2` บน div ใน td ของ DataGrid
