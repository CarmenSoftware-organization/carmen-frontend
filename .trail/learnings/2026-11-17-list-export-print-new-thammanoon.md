---
title: "ปุ่มเสริมบนหัวหน้า list อยู่แถวเดียวกับ Export/Print/New: หัวแคบให้ปุ่มรองเหลือไอคอน ไม่ห่อเป็นสองแถว"
author: Thammanoon
date: 2026-11-17
branch: fix/coa-list-header-one-row
cost: { minutes: 8, tokens: 209010 }
id: l-ab94138e
scope: repo
status: active
src: agent
touches:
  - components/share/list-page-shell.tsx
  - routes/config/chart-of-accounts/coa-component.tsx
  - routes/config/chart-of-accounts/coa-import-carmen-gl-button.tsx
---

## Decided
2026-11-17 หน้า Chart of Accounts: ปุ่มที่หน้าใส่เพิ่มบนหัว list (extraActions) ต้องอยู่แถวเดียวกับ Export / Print / New ทุกขนาดจอ (กฎข้อ 13 ของ skill carmen-blue-ui-design ใช้กับหัว list ด้วย ไม่ใช่แค่หัวฟอร์ม) เมื่อกล่องหัวแคบกว่า 896px (@4xl วัดจากกล่องหัวเอง) ปุ่มรองเหลือไอคอน + title ปุ่ม New เก็บป้าย ไม่ยุบลงเมนู ⋯

จุดสลับ 896px มาจากการวัด: ชื่อ + คำอธิบายกว้าง ~298px + ปุ่มมีป้ายครบ ~520px + ช่องว่าง ≈ 860px · ที่จอ 1024 (หัว 744px) ป้ายไม่พอ ที่ 1180 (หัว 900px) พอ

## Tried and ruled out
ห่อ extraActions ด้วย `flex flex-wrap` (โค้ดเดิม): ที่ tablet และมือถือปุ่ม Wizard กับ Import ซ้อนกันสองแถวข้างปุ่ม New

## Watch out
- ตรวจว่าป้ายถูกซ่อนหรือไม่ อย่าดูจาก textContent เพราะ sr-only ยังมีข้อความอยู่ ให้ดูความกว้างปุ่มแทน (ไอคอนอย่างเดียว = 34px)
- ปุ่ม Export/Print ที่ซ่อนบนมือถือมี top = 0 นับแถวปุ่มให้ข้ามปุ่มที่กว้าง 0 และนับจากจุดกึ่งกลาง (ปุ่ม ⋯ สูง 44 ปุ่มอื่น 32)
- ป้ายภาษาไทยยาวกว่า ยังไม่ได้วัด อาจต้องขยับจุดสลับ

In the code: `LIST_HEADER_LABEL_HIDE` (`@max-4xl/list-header:sr-only`) และ `@container/list-header` ใน components/share/list-page-shell.tsx · ใช้ใน routes/config/chart-of-accounts/coa-component.tsx และ coa-import-carmen-gl-button.tsx
