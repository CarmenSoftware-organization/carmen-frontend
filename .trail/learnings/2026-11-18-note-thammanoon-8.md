---
title: "ผู้สร้างและผู้แก้ล่าสุดของเอกสารแสดงเป็นแถบเงียบท้ายหน้า ไม่ใส่ในการ์ดหัวเอกสาร"
author: Thammanoon
date: 2026-11-18
branch: main
cost: { minutes: 4, tokens: 22243 }
id: l-dbdbef50
scope: repo
status: active
src: agent
touches:
  - components/share/doc-audit-card.tsx
  - routes/procurement/purchase-request/pr-form.tsx
---

## Decided
2026-11-18 ผู้ใช้ขอการ์ดเล็ก ๆ แสดงผู้สร้าง วันที่สร้าง ผู้แก้ล่าสุด วันที่แก้ บนหน้า PR detail ทำเป็นของกลางวางใต้รายการสินค้า ไม่มีพื้นหลัง เส้นขอบประจาง ตัวอักษร xs สีจาง เพราะเป็นข้อมูลไว้เปิดดูตอนสงสัย ส่วนประวัติละเอียดอยู่ใน Activity แล้ว

## Tried and ruled out
- ใส่ไว้ในการ์ดหัวเอกสาร: หัวเอกสารเป็นการ์ดอยู่แล้ว จะกลายเป็นการ์ดซ้อนการ์ด และหัวเอกสารแน่นอยู่แล้ว
- ใช้ชื่อผู้ขอ (requestor) แทนชื่อผู้สร้าง: ผู้ขอกับผู้สร้างใบอาจเป็นคนละคน และยังไม่มีชื่อผู้แก้อยู่ดี จึงไปแก้ที่ backend (BE #1085)

## Watch out
- ถ้าชื่อไม่ขึ้นมีแต่วันที่ ให้เช็กว่า API ส่ง `audit.created.name` มาหรือไม่ ต้นเหตุที่เจอคือ schema ฝั่ง micro ตัด `created_by_id` ทิ้ง
- avatar ใช้ fallback="icon" เพราะการใส่ขนาดตัวอักษรดิบให้ตัวย่อชื่อทำให้เทสต์ type ladder แดง

In the code: components/share/doc-audit-card.tsx (DocAuditCard) · routes/procurement/purchase-request/pr-form.tsx วางใต้ </form> · PR #678
