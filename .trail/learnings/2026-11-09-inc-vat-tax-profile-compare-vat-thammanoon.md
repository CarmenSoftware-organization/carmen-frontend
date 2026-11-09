---
title: Inc VAT เป็นช่องติ๊กรายบรรทัดแยกจาก tax profile และ compare ราคาต้องเทียบราคาก่อน VAT
author: Thammanoon
date: 2026-11-09
branch: feature/inc-vat-per-line
id: l-6102fc48
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-09-inc-vat-per-line-design.md
  - docs/superpowers/plans/2026-11-09-inc-vat-per-line.md
---

## Decided
- 2026-11-09 ผู้ใช้กำหนด: Inc VAT เป็น boolean ต่อบรรทัด แยกจาก tax profile โดยสิ้นเชิง (tax profile ให้แค่ rate) ใช้กับ Price List / PR / PO / GRN / AP
- ราคาที่กรอก (เช่น 107) และค่าติ๊กไหลไปด้วยกันทุกเอกสาร ไม่แปลงเป็นราคาก่อน VAT ระหว่างทาง
- ส่วนลดหักจากยอดที่รวม VAT · invariant: net_amount = ก่อน VAT, total = รวม VAT เสมอ → ต้นทุนคลัง (base_net_amount) ถูกเองโดยไม่ต้องแก้
- Price List Compare ต้องเรียงด้วย price_without_tax (ราคาก่อน VAT 5 ตำแหน่ง) ไม่ใช่ price

## Tried and ruled out
- ใช้ enum_tax_type { none, included, add } ที่มีใน schema tenant: ไม่มีตารางไหนใช้ และ none/add ซ้อนกับ tax profile ที่ผู้ใช้ต้องการให้แยก

## Watch out
- สูตรอยู่ 3 จุดที่ต้องตรงกัน: FE computeLineAmounts, BE getCalculatePriceInfo (+ amount.check verify), AP computeLine ทั้ง FE/BE — แก้จุดเดียว = ยอด FE ไม่ตรงที่ BE บันทึก
- AP variance เดิมเทียบ net ของ AP กับ qty × received_price ถ้า GRN ติ๊ก received_price รวม VAT → ต้องใช้ราคาก่อน VAT ต่อหน่วย
- PR→PO merge key ต้องรวมค่าติ๊ก ไม่งั้นบรรทัดราคาเท่ากันแต่ติ๊กต่างกันถูกยุบรวม

In the code: spec docs/superpowers/specs/2026-11-09-inc-vat-per-line-design.md · plan docs/superpowers/plans/2026-11-09-inc-vat-per-line.md · คอลัมน์ is_tax_included (AP: vat_is_included)
