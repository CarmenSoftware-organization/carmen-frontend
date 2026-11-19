---
title: "ย้ายช่องฟอร์มเข้าการ์ดหัวแบบ PR ทุกครั้ง ต้องอ่าน error ด้วย useFormState ในคอมโพเนนต์ของช่องเอง ไม่งั้นช่องว่างไม่ขึ้นแดง"
author: Thammanoon
date: 2026-11-19
branch: main
cost: { minutes: 19, tokens: 132284 }
id: l-345efb82
scope: repo
status: active
src: agent
touches:
  - routes/operation-plan/category/recipe-category-form-skeleton.tsx
  - routes/operation-plan/category/recipe-category-form.tsx
  - routes/operation-plan/category/recipe-category-general-fields.tsx
  - routes/operation-plan/category/recipe-category-pricing-fields.tsx
  - routes/operation-plan/category/recipe-category-toolbar.tsx
  - routes/operation-plan/cuisine/cuisine-detail-fields.tsx
  - routes/operation-plan/cuisine/cuisine-form-skeleton.tsx
  - routes/operation-plan/cuisine/cuisine-form.tsx
  - routes/operation-plan/cuisine/cuisine-general-fields.tsx
---

## Decided
2026-11-19 ผู้ใช้สั่งให้หน้ารายละเอียด Recipe Category และ Cuisine Type ใช้หัวการ์ดแบบ PR (ช่อง General เป็น ribbon ของหัว) ทั้งสองหน้าเจอบั๊กเดียวกับหัวใบ IA: ลบช่องบังคับแล้วกด Save ฟอร์มไม่บันทึก (ถูก) แต่ช่องไม่ขึ้นแดงและไม่มีข้อความ ผู้ใช้ไม่รู้ว่าทำไมกดไม่ไป แก้ด้วย `const { errors } = useFormState({ control: form.control })` ในคอมโพเนนต์ที่ render ช่องเอง

Cuisine: หมวด Additional (Note + Status) ยุบเข้าการ์ดหัว เพราะเหลือสองช่องและ Status ซ้ำป้ายข้างชื่อ — Status switch วางท้าย ribbon ให้ Description/Note อยู่แถวเดียวกันที่ iPad

## Tried and ruled out
- อ่าน `form.formState.errors` จาก prop `form` เหมือนตอนช่องอยู่ใน CompactSection ใต้ <form>: element ที่ส่งเป็น ribbon มี props คงที่ React Compiler จึง memo ไว้ ไม่ re-render ตอน error เปลี่ยน
- typecheck / lint / เทสต์ characterization ผ่านทั้งที่บั๊กอยู่ — จับได้จากการลบช่องแล้วกด Save ในเบราว์เซอร์เท่านั้น

## Watch out
- หน้าใดที่ย้ายช่องเข้า ribbon ของ FormToolbar/DocFormHeader ให้ลอง "เว้นช่องบังคับ → Save" ทุกครั้ง เจอแล้ว 3 หน้า (IA, Recipe Category, Cuisine) ยังไม่ได้ไล่ตรวจหน้าที่ทำไปก่อน (Price List, PLT, RFP ฯลฯ)
- ช่องใน ribbon อยู่นอก <form> กด Enter ไม่ submit (ทางเดียวกับ PR)

In the code: routes/operation-plan/category/recipe-category-general-fields.tsx · routes/operation-plan/cuisine/cuisine-general-fields.tsx (useFormState) · ต้นแบบ routes/vendor-management/price-list-template/plt-form.tsx · FE #702 · IA fix commit 263580d0
