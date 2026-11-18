---
title: "เลขลำดับแถวต้องแสดงตลอดทุกขนาดจอ ทั้งตารางและการ์ด เพราะผู้ใช้ใช้อ้างอิงแถวเวลาคุยกัน"
author: Thammanoon
date: 2026-11-18
branch: feature/list-row-number
cost: { minutes: 5, tokens: 87957 }
id: l-f0162236
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-18-list-row-number-design.md
  - components/ui/data-grid/columns.tsx
  - components/share/list-card.tsx
  - routes/config/shared/use-config-list-table.ts
---

## Decided
2026-11-18 ผู้ใช้สั่งให้ทุกหน้ารายการมีเลขลำดับ ทั้งมุมมองตารางและการ์ด เหตุผลคือใช้อ้างอิงแถวเวลาคุยกัน ("แถวที่ 27") เลขจึงต้องนับต่อข้ามหน้า และรายการเดียวกันต้องได้เลขเดียวกันทั้งในตารางและการ์ด ทุกขนาดจอ
ผู้ใช้เลือกให้แสดงเลขตลอด ซึ่งกลับคำตัดสินเมื่อ 13 พ.ย. ที่ให้ซ่อนเลขลำดับก่อนเมื่อกล่องตารางแคบ (Vendor, Certification, RFP, PRT, Document) ตอนนี้ให้คอลัมน์รองหายแทน
วิธีทำ: ส่งเลขผ่าน prop ทีละหน้า โดยใช้สูตรจากฟังก์ชันกลางตัวเดียว ทำเฉพาะหน้ารายการ ไม่รวมตารางในฟอร์ม dialog และ wizard
เลขผูกกับการเรียงและตัวกรองที่ตั้งอยู่ การอ้างข้ามมุมมองใช้เลขเอกสารเหมือนเดิม

## Tried and ruled out
- ให้ CSS counter นับเลขบนการ์ด: เลขจาก ::before คัดลอกไม่ได้และ screen reader อ่านไม่แน่นอน skeleton หรือการ์ดที่ซ่อนทำให้เลขเพี้ยนโดยไม่มีอะไรเตือน และใช้กับตารางไม่ได้
- ให้ DataGrid ใส่คอลัมน์ # เองทุกตาราง: ซ้ำกับ # ของตารางในฟอร์ม และงบความกว้างที่คำนวณไว้ทุกตารางจะเพี้ยนพร้อมกัน

## Watch out
- หน้าที่ใช้ปุ่ม "โหลดเพิ่ม" นับตามลำดับในรายการที่โหลดสะสม ไม่ได้ใช้ page × perpage
- อย่าเพิ่มเลขลำดับกลับเข้า tier ที่ซ่อนตามความกว้างกล่อง

In the code:
- components/ui/data-grid/columns.tsx indexColumn() → แยกสูตรเป็น rowNumber(params, index)
- components/share/list-card.tsx ListCard รับ prop index ใหม่
- routes/config/shared/use-config-list-table.ts งบความกว้าง `hideIndex ? 0 : 60`
- spec: docs/superpowers/specs/2026-11-18-list-row-number-design.md
