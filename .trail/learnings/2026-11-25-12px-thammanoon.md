---
title: "ขนาดตัวอักษรกำหนดตามหน้าที่ของข้อความ: ข้อความที่ไม่ใส่ขนาดเป็น 12px และเซลล์ตารางมีแค่สองขั้น"
author: Thammanoon
date: 2026-11-25
branch: feature/typography-role-defaults
cost: { minutes: 48, tokens: 466326 }
id: l-d452c000
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/plans/2026-11-25-typography-role-defaults.md
  - docs/superpowers/specs/2026-11-25-typography-role-defaults-design.md
  - styles/globals.css
  - components/ui/badge.tsx
  - components/ui/calendar.tsx
  - components/ui/type-ladder.test.ts
  - docs/superpowers/plans/2026-11-25-typography-role-defaults-baseline.md
  - routes/design-system/design-system.route.tsx
  - routes/design-system/sections/typography.tsx
  - routes/inventory-management/spot-check/sc-form.tsx
---

## Decided
- 2026-11-25 ผู้ใช้เห็นตัวอักษรไม่เท่ากันระหว่างหน้า ระหว่าง cell ในแถวเดียวกัน และ description ใน detail ใหญ่กว่า group header
- ต้นเหตุ: `body` ตั้งไว้ 17px (ค่าที่ติดมาจากแอปต้นทาง) ข้อความที่ไม่มี class ขนาดจึงใหญ่กว่าหัว (14) และค่าในฟิลด์ (12) และมีราว 43 ไฟล์ที่ตั้งขนาดเองใน `cell:` ทับค่า text-xs ของ DataGrid
- ทีมเลือกตารางจับคู่หน้าที่กับขนาด: h1 18 · หัวกลุ่ม/การ์ด/dialog 14 semibold · ข้อความใต้หัว, label, ค่าในฟิลด์, หัวคอลัมน์ 12 · เซลล์บรรทัดหลัก 12 · เซลล์บรรทัดรอง 11 สีจาง · meta 10 · รายการใน control ทุกตัว (menu/command/popover/sidebar/select/tabs) 12 · body 12
- เซลล์: บรรทัดหลักทุกเซลล์ขนาดเดียว ส่วนบรรทัดรองเล็กลงได้หนึ่งขั้นซึ่งเป็นขั้นเดียวทั้งแอป (ผู้ใช้เลือกข้อนี้แทนการให้ทุกอย่างในแถวขนาดเท่ากัน) ถ้าต้องการเน้นให้ใช้น้ำหนักตัวอักษร ไม่ใช้ขนาด
- ปุ่ม, toast, login, recipe cook mode, dashboard tile และ print อยู่นอกขอบเขต
- เทสต์ดักขนาดในเซลล์ตารางสแกนสองแบบ: body ของ `cell:`/`header:` ที่เขียนใน column definition (วัดขอบเขตจากการเยื้อง) และไฟล์ที่ชื่อลงท้าย `-cell.tsx` / `-cells.tsx` หรืออยู่ในโฟลเดอร์ `*-cells/` ทั้งไฟล์
- แบบแรกอย่างเดียวเจอแค่ 11 ไฟล์ เพราะเซลล์ส่วนใหญ่แยกเป็น component จึงเพิ่มแบบที่สอง (23 ไฟล์)
- บรรทัดรองของเซลล์ส่วนใหญ่ทั้งแอปมาจาก NameWithSubtext (ใช้ราว 29 ไฟล์) ซึ่งเทสต์ไม่เห็นเพราะชื่อไฟล์ไม่ใช่ cell — เจอจากการวัดหน้า detail ในเบราว์เซอร์ ตอนนี้ใช้ CELL_SUB_CLASS แล้ว

## Tried and ruled out
- แก้เฉพาะจุดโดยคง body ไว้ 17px: ต้นเหตุยังอยู่ โค้ดใหม่ที่ลืมใส่ขนาดจะกลับมาใหญ่อีก
- ใช้ letter-spacing -0.12px ของ token: ไม่ขยายตาม font scale จึงคง -0.01em ไว้

## Watch out
- ข้อความที่ไม่มี class ขนาดคือเนื้อหา 12px อย่าใส่ text-sm ให้ description หรือ cell
- sidebar กับเมนูอยู่ทุกหน้า แก้แล้วต้องวัดทั้งตอนกางและตอนหุบ ที่ font scale biggest

In the code:
- spec docs/superpowers/specs/2026-11-25-typography-role-defaults-design.md, plan docs/superpowers/plans/2026-11-25-typography-role-defaults.md
- styles/globals.css body font-size; components/ui/data-grid/cell-text.tsx (CellText/CellSub); guard components/ui/data-grid/cell-type.test.ts
- เทสต์ type ladder กับเทสต์เซลล์เทียบรายการยกเว้นแบบตรงทุกตัว: ลบขนาดนอก ladder ออกจากไฟล์ไหนแล้วต้องลบรายการของไฟล์นั้นออกด้วย ไม่งั้นแดง (ตั้งใจ กันรายการค้าง)
- component ใหม่ที่ render เซลล์แต่ไม่ได้ตั้งชื่อ *-cell เทสต์จะไม่ดัก ให้ใช้ CellSub / CELL_SUB_CLASS สำหรับบรรทัดรองเสมอ

- components/ui/data-grid/cell-type.test.ts (CELL_FILE, columnBodies, ALLOWLIST), components/ui/data-grid/cell-text.tsx
- components/ui/type-ladder.test.ts ALLOWED_OFF_LADDER
- components/share/name-with-sub-text.tsx
