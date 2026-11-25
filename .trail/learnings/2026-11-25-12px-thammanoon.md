---
title: "ขนาดตัวอักษรกำหนดตามหน้าที่ของข้อความ: ข้อความที่ไม่ใส่ขนาดเป็น 12px และเซลล์ตารางมีแค่สองขั้น"
author: Thammanoon
date: 2026-11-25
branch: feature/typography-role-defaults
cost: { minutes: 25, tokens: 152138 }
id: l-d452c000
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/plans/2026-11-25-typography-role-defaults.md
  - docs/superpowers/specs/2026-11-25-typography-role-defaults-design.md
  - styles/globals.css
---

## Decided
- 2026-11-25 ผู้ใช้เห็นตัวอักษรไม่เท่ากันระหว่างหน้า ระหว่าง cell ในแถวเดียวกัน และ description ใน detail ใหญ่กว่า group header
- ต้นเหตุ: `body` ตั้งไว้ 17px (ค่าที่ติดมาจากแอปต้นทาง) ข้อความที่ไม่มี class ขนาดจึงใหญ่กว่าหัว (14) และค่าในฟิลด์ (12) และมีราว 43 ไฟล์ที่ตั้งขนาดเองใน `cell:` ทับค่า text-xs ของ DataGrid
- ทีมเลือกตารางจับคู่หน้าที่กับขนาด: h1 18 · หัวกลุ่ม/การ์ด/dialog 14 semibold · ข้อความใต้หัว, label, ค่าในฟิลด์, หัวคอลัมน์ 12 · เซลล์บรรทัดหลัก 12 · เซลล์บรรทัดรอง 11 สีจาง · meta 10 · รายการใน control ทุกตัว (menu/command/popover/sidebar/select/tabs) 12 · body 12
- เซลล์: บรรทัดหลักทุกเซลล์ขนาดเดียว ส่วนบรรทัดรองเล็กลงได้หนึ่งขั้นซึ่งเป็นขั้นเดียวทั้งแอป (ผู้ใช้เลือกข้อนี้แทนการให้ทุกอย่างในแถวขนาดเท่ากัน) ถ้าต้องการเน้นให้ใช้น้ำหนักตัวอักษร ไม่ใช้ขนาด
- ปุ่ม, toast, login, recipe cook mode, dashboard tile และ print อยู่นอกขอบเขต

## Tried and ruled out
- แก้เฉพาะจุดโดยคง body ไว้ 17px: ต้นเหตุยังอยู่ โค้ดใหม่ที่ลืมใส่ขนาดจะกลับมาใหญ่อีก
- ใช้ letter-spacing -0.12px ของ token: ไม่ขยายตาม font scale จึงคง -0.01em ไว้

## Watch out
- ข้อความที่ไม่มี class ขนาดคือเนื้อหา 12px อย่าใส่ text-sm ให้ description หรือ cell
- sidebar กับเมนูอยู่ทุกหน้า แก้แล้วต้องวัดทั้งตอนกางและตอนหุบ ที่ font scale biggest

In the code:
- spec docs/superpowers/specs/2026-11-25-typography-role-defaults-design.md, plan docs/superpowers/plans/2026-11-25-typography-role-defaults.md
- styles/globals.css body font-size; components/ui/data-grid/cell-text.tsx (CellText/CellSub); guard components/ui/data-grid/cell-type.test.ts
