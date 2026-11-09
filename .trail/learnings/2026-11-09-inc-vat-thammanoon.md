---
title: "ป้าย Inc VAT ใช้ตัวกลางตัวเดียวทุกหน้า และวางหน้าตัวเลขราคาเสมอ"
author: Thammanoon
date: 2026-11-09
branch: fix/inc-vat-ui-consistency
cost: { minutes: 5, tokens: 261547 }
id: l-f9dfe1df
scope: repo
status: active
src: agent
touches:
  - components/share/inc-vat.tsx
---

## Decided
2026-11-10 ผู้ใช้สั่งให้ไล่ทุกหน้าที่มี Inc VAT (PL, PL ภายนอก, PR, PR price-list dialog, PO, PO-from-price-list, GRN, AP) ให้หน้าตาเหมือนกัน
- โหมดอ่าน: ชิปพื้น muted (ตระกูลเดียวกับป้าย "ซ่อน" ของราคา) วาง **หน้า** ตัวเลข — คอลัมน์ราคาชิดขวา ถ้าต่อท้าย แถวที่ติ๊กตัวเลขจะเลื่อน ทศนิยมไม่ตรงแถวอื่น
- โหมดแก้ไข: ช่องติ๊กขนาดเดียว ชิดขวา ใต้ช่องราคา (PR อยู่แถวป้าย Unit Price)
- tooltip ราคาก่อน VAT ใส่คำว่า "before VAT" ต่อท้าย

## Tried and ruled out
- ป้ายข้อความเปล่าต่อท้ายตัวเลข (ของเดิม PO/GRN/AP): ทำให้ตัวเลขไม่ตรงคอลัมน์
- AP โหมดอ่านขึ้นบรรทัดแยกใต้ตัวเลข: แถวสูงไม่เท่ากัน
- Price List โหมดแก้ไขไม่ได้เปลี่ยน — ยังเป็นคอลัมน์ Inc VAT ของตัวเองตามที่ตกลงไว้ก่อนหน้า

## Watch out
หน้าใหม่ที่ต้องแสดง Inc VAT ให้ใช้ component กลาง อย่าเขียน span/Checkbox เอง

In the code: components/share/inc-vat.tsx — IncVatTag, PriceWithIncVat (tag หน้าตัวเลข), IncVatToggle; branch fix/inc-vat-ui-consistency
