---
title: "ตารางรายการของ PR Template: กล่องแคบเลื่อนแนวนอนด้วยความกว้างขั้นต่ำ กล่องกว้างให้คอลัมน์สุดท้ายรับที่เหลือ (โหมดแก้ = คอลัมน์ปุ่มลบ)"
author: Thammanoon
date: 2026-11-18
branch: main
cost: { minutes: 5, tokens: 217907 }
id: l-0df80718
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-request-template/use-prt-item-table.tsx
  - routes/procurement/purchase-request-template/prt-item-fields.tsx
---

## Decided
- 2026-11-18 จัดหน้า PR Template detail ตาม skill carmen-blue-ui-design: เลิก max-w-4xl, ข้อมูลทั่วไปเป็น CompactSection + FieldGrid, โหมดดูไม่มีสวิตช์สถานะ (ป้ายจาง + badge แบบหน้า config)
- ตารางรายการ (แก้ในตัว 6 คอลัมน์) ใช้สองชุดตามความกว้างกล่องที่วัดจริง: กล่อง < 1140px = แบ่งสัดส่วนเดิม + min-w-[760px] ให้เลื่อนแนวนอนแทนการบีบ · กล่อง ≥ 1140px = คอลัมน์ข้อมูลกว้างคงที่ แล้ว grow คอลัมน์สุดท้าย (โหมดดู = จุดส่งของ, โหมดแก้ = คอลัมน์ปุ่มลบ) ช่องกรอกจึงไม่ยืดตามจอ

## Tried and ruled out
- grow ตลอดเวลา: skill ห้ามบนตารางแก้ไขหลายคอลัมน์เพราะล้นที่ tablet — จึงเปิด grow เฉพาะเมื่อกล่องกว้างกว่าผลรวม size เท่านั้น
- grow คอลัมน์จุดส่งของในโหมดแก้: lookup จะยืดกว้างพันกว่า px ที่ 4K ผิดกฎ 2

## Watch out
- ก่อนแก้ ที่ 390 ตารางถูกบีบเหลือช่องละ ~60px (lookup อ่านไม่ออก) — ปัญหาเดิม ไม่ได้เกิดจากการย้ายเป็น wide
- เปลี่ยน size คอลัมน์ต้องคำนวณ PRT_ITEM_WIDE_BOX ใหม่ (ต้องสูงกว่าผลรวม 1090 ตอนแก้)
- โครงตอนโหลดอยู่ใน prt-form-skeleton.tsx (SPANS) แก้ช่องข้อมูลทั่วไปต้องแก้ตาม

In the code:
- routes/procurement/purchase-request-template/use-prt-item-table.tsx — containerWidth, PRT_ITEM_WIDE_BOX
- routes/procurement/purchase-request-template/prt-item-fields.tsx — useElementWidth, tableClassNames min-w
