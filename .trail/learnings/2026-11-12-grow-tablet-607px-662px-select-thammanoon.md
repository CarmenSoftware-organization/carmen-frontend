---
title: "ตารางที่ใช้คอลัมน์ grow: งบความกว้างที่ tablet คือ 607px ไม่ใช่ 662px เพราะคอลัมน์ select ที่มองไม่เห็นถูกนับด้วย"
author: Thammanoon
date: 2026-11-12
branch: feature/running-code-list-columns
cost: { minutes: 9, tokens: 250219 }
id: l-09928dc3
scope: repo
status: active
src: agent
touches:
  - messages/en.json
  - messages/th.json
  - routes/system-admin/running-code/running-code-card.tsx
  - routes/system-admin/running-code/running-code-config.ts
  - routes/system-admin/running-code/use-running-code-table.tsx
  - components/ui/data-grid/data-grid-table.tsx
  - components/ui/data-grid/use-config-table.ts
  - routes/system-admin/running-code/running-code-component.tsx
  - routes/system-admin/running-code/running-code-dialog.tsx
---

## Decided
หน้า Running Code (2026-11-13) ให้คอลัมน์ Type กว้างคงที่ คอลัมน์ Note รับความกว้างที่เหลือ และเพิ่มคอลัมน์ Example ที่โชว์เลขที่เอกสารจริงจาก config เพราะหน้านี้ตั้ง "รูปแบบ" คนดูอยากเห็นผลลัพธ์โดยไม่ต้องเปิด dialog ทีละแถว

## Tried and ruled out
ตั้งขนาดคอลัมน์ให้ผลรวมของคอลัมน์ที่เห็น (#, Type, Example, Note, ปุ่ม) เท่ากับ 650px โดยคิดว่าพอดีกล่อง 662px ที่จอ 768px — ตารางยังล้น 43px เพราะความกว้างขั้นต่ำของตารางมาจากผลรวม size ของทุกคอลัมน์ รวมคอลัมน์ select (55px) ที่ตารางของ config list ใส่ให้เสมอแม้ไม่ได้เรนเดอร์

## Watch out
- ตารางที่สร้างผ่าน hook ของ config list และมีคอลัมน์ grow: size ของคอลัมน์ที่เห็นรวมกันต้องไม่เกิน 607px (662 − 55) ต้องวัดที่ 768px ทุกครั้ง ที่ 1024px ขึ้นไปมองไม่เห็นปัญหา
- `size` ของคอลัมน์ grow คือความกว้างขั้นต่ำของมัน ไม่ใส่ = ใช้ค่า default ที่กว้างกว่าที่คิด
- ตารางที่ประกอบคอลัมน์เอง (เช่น Roles) ก็ใส่ select เองเหมือนกัน ให้นับด้วย

In the code:
- `routes/system-admin/running-code/use-running-code-table.tsx` — size 190 / 180 / 115 (grow) → 55+60+190+180+115+60 = 660
- `components/ui/data-grid/data-grid-table.tsx` — `growMinWidth = table.getTotalSize()`
- `components/ui/data-grid/use-config-table.ts` — ใส่ `selectColumn()` (size 55) ให้ทุกตาราง
- `routes/system-admin/running-code/running-code-config.ts` — `exampleCode()` ใช้ในตารางและการ์ด
