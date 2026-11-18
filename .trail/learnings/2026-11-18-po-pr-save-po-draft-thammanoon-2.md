---
title: "หัวเอกสาร PO โหมดดูเป็นข้อความแบบ PR, สกุลเงินแสดงรหัส | เรตบรรทัดเดียว และปุ่ม Save ของ PO draft ไม่ตรวจค่า"
author: Thammanoon
date: 2026-11-18
branch: feature/currency-rate-inline
cost: { minutes: 30, tokens: 96267 }
id: l-0b7856b4
scope: repo
status: active
replaces: l-16f10629
src: agent
touches:
  - routes/procurement/purchase-order/po-edit-content.tsx
  - routes/procurement/purchase-order/po-form.tsx
  - routes/procurement/purchase-order/po-general-fields.tsx
  - components/share/setting-field.tsx
  - lib/form-helpers.ts
---

## Decided
- 2026-11-18 หัวเอกสาร PO ใช้ style เดียวกับ PR: โหมดดูช่องหัวใบเป็นข้อความ (SettingField, FieldGrid dense) · ช่องที่ล็อกถาวรในโหมดแก้ก็เป็นข้อความ (role อนุมัติ/ใบจบ, price list พ้น draft, ผู้ขายของ PO จาก PR, workflow พ้น draft) · สกุลเงินของ PO จาก PR ยังเป็นช่องกรอกเพราะเรต override ได้ · Description/Remarks โหมดข้อความกว้างคอลัมน์เดียวตั้งแต่ @md
- 2026-11-18 ผู้ใช้สั่งให้ช่องสกุลเงินโหมดดูแสดง "รหัส | เรต" บรรทัดเดียว (USD | 1.00000) แทนเรตเป็นบรรทัดรองใต้รหัส — ใช้กับ PO, GRN, CN ผ่าน prop `trailing` ของ SettingField (`example` ยังเป็นบรรทัดใต้สำหรับหน้าตั้งค่า)

## Tried and ruled out
- ตัดสินโหมดข้อความจาก `disabled`: prop นี้รวม isPending ช่องจะกลายเป็นข้อความชั่วขณะตอนกด Save — ส่ง `isView` แยก

## Watch out
- Save ของ PO draft ใช้ draftSaveHandler ซึ่งเรียก save(form.getValues()) ตรง ๆ ไม่ผ่าน zod (ตั้งใจให้ draft บันทึกไม่ครบได้ ตรวจจริงตอน Submit) — ขอบแดงเป็นแค่ validate onChange · กด Save ทดสอบบน dev = เขียน DB จริง (rev ขยับ + updated_at) · **แก้ข้อเท็จจริงจาก learning ก่อนหน้า:** ล้าง Order Date ของ PO20260500004 แล้วกด Save ค่าในฐานข้อมูลไม่ได้ถูกล้าง (โหลดใหม่ยังเป็น 2026-05-29) — "—" ที่เห็นหลังเซฟคือฟอร์มที่ถือค่าว่างค้างในหน้า ผลจริงมีแค่ rev. 5 → 6 · ทดสอบ validation ให้ใช้ Submit หรือใบใหม่ที่ยังไม่เคยเซฟ
- ช่องใน ribbon อ่าน error ผ่าน useFormState (React Compiler memo ribbon element)
- แถว Last updated ของ PO detail ว่างเพราะ micro-business findById ไม่ select updated_* — แก้แล้วใน backend #1087 (merge + dev 18 พ.ย.)

In the code: routes/procurement/purchase-order/po-general-fields.tsx (textMode / isView / contentLocked / workflowName) · components/share/setting-field.tsx (`trailing`) · cn-general-fields.tsx, grn-form-header.tsx ใช้ trailing={rateText} · lib/form-helpers.ts draftSaveHandler
