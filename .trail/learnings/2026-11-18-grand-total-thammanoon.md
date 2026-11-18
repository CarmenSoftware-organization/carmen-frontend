---
title: "แถบยอดรวมท้ายหน้า (ไม่ใช่หัวเอกสาร) บนจอมือถือยุบเหลือ Grand Total กดดูรายละเอียด เปิดเฉพาะใบรับของก่อน"
author: Thammanoon
date: 2026-11-18
branch: main
cost: { minutes: 1, tokens: 3139 }
id: l-a918b4a7
scope: repo
status: active
src: agent
touches:
  - components/ui/summary-bar.tsx
  - routes/procurement/goods-receive-note/grn-summary-footer.tsx
  - components/loader/doc-page-skeleton.tsx
---

## Decided
- 2026-11-18 จัด GRN detail มือถือ/tablet: แถบท้าย (ยอด 5 ช่อง + Commit/Void) บนมือถือสูง ~97px 3 บรรทัด → ยุบเหลือ "Grand Total x ⌃" (แตะเปิด popover ยอดครบ) บรรทัดเดียวกับปุ่ม ~49px
- ทำเป็นตัวเลือกเปิดเอง ใช้กับ GRN เท่านั้น หน้าอื่น 11 หน้าที่ใช้แถบเดียวกันคงโครงเดิมทุก class (ยังไม่ได้ถามผู้ใช้ว่าจะขยายไป PR/PO/CN/SR)
- ปุ่มรองในแถบแคบเหลือไอคอน ปุ่มหลักคงข้อความ · สกุลเงินท้ายยอดซ่อนก่อนเมื่อแถบ < 20rem (อยู่ที่หัวใบ + popover แล้ว)
- แถวยังตัดบรรทัดได้: ยอดหลักล้านหรือภาษาไทยที่ 360px ปุ่มลงบรรทัดสอง (ชิดขวา) แทนล้นจอ

## Tried and ruled out
- เบรกพอยต์ตายตัวให้พอดีบรรทัดเดียวเสมอ: ยอดเงินยาวไม่คงที่ ไทย 360px ยังเกิน 7px
- ให้คอลัมน์ Note ของตาราง Extra Cost grow ทุกขนาด: มือถือตารางกว้างตามผลรวมคอลัมน์ 552px ต้องเลื่อน → grow เฉพาะกล่อง ≥ 600px

## Watch out
- container query ใช้กับตัว container เองไม่ได้ — `@lg:` บน element ที่เป็น `@container` ไปถามบรรพบุรุษ ต้องมีชั้นใน
- ใส่ `flex-wrap` กับ `flex-nowrap` ปนในชุดเดียว ตัวที่ชนะขึ้นกับลำดับใน CSS ไม่ใช่ลำดับใน className
- อย่าเปลี่ยนแถบเดิมไปใช้ cn(): twMerge จะตัด class ที่ผู้เรียกส่งมาชนต่างจากเดิม
- โครงตอนโหลดต้องเปิดแบบยุบด้วย ไม่งั้นแถบกระโดดตอนข้อมูลมา

In the code:
- components/ui/summary-bar.tsx — SummaryFooterBar prop collapseOnNarrow (ชั้นนอก @container, ชั้นใน flex-wrap @5xl:flex-nowrap)
- routes/procurement/goods-receive-note/grn-summary-footer.tsx, grn-footer-action.tsx (Void `hidden @sm:inline`)
- components/loader/doc-page-skeleton.tsx — footerCollapse; grn-edit-content.tsx ส่งค่า
- grn-extra-cost-fields.tsx — readOnly แยกจาก disabled, useElementWidth ≥ 600 → note grow
