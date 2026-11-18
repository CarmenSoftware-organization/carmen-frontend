---
title: "หัวเอกสาร PO โหมดดูเป็นข้อความแบบ PR และปุ่ม Save ของ PO draft ไม่ตรวจค่า กดทดสอบช่องว่างแล้วบันทึกลงฐานข้อมูลจริง"
author: Thammanoon
date: 2026-11-18
branch: main
cost: { minutes: 4, tokens: 58623 }
id: l-16f10629
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-request-template/prt-item-fields.tsx
  - routes/procurement/purchase-request/pr-item-fields.tsx
  - routes/procurement/shared/item-cards.tsx
  - routes/procurement/purchase-order/po-general-fields.tsx
  - lib/form-helpers.ts
---

## Decided
- 2026-11-18 ผู้ใช้สั่งให้หัวเอกสาร PO ใช้ style เดียวกับ PR: โหมดดูช่องหัวใบเป็นข้อความ (SettingField ป้ายจาง + ค่าเด่น, FieldGrid dense) แทนช่องกรอกที่ disabled · ช่องที่ล็อกถาวรในโหมดแก้ก็เป็นข้อความ (role อนุมัติ/ใบจบ, price list พ้น draft, ผู้ขายของ PO จาก PR, workflow พ้น draft) · สกุลเงินของ PO จาก PR ยังเป็นช่องกรอกเพราะเรต override ได้
- ทั้งสองโหมดใช้ FieldGrid (container query) แทน grid sm:/lg:6 เดิม · Description/Remarks โหมดข้อความกว้างคอลัมน์เดียวตั้งแต่ @md (เต็มแถวบนมือถือ) แบบ PR — กิน 2 ช่องแล้วหัวใบสูงเป็น 5 แถว ส่วนใหญ่เป็น —

## Tried and ruled out
- ตัดสินโหมดข้อความจาก `disabled`: prop นี้รวม isPending ช่องจะกลายเป็นข้อความชั่วขณะตอนกด Save — ส่ง `isView` แยกมาแทน

## Watch out
- Save ของ PO draft ใช้ draftSaveHandler ซึ่งเรียก save(form.getValues()) ตรง ๆ ไม่ผ่าน zod (ตั้งใจให้ draft บันทึกไม่ครบได้ ตรวจจริงตอน Submit) — ขอบแดงที่เห็นเป็นแค่ validate onChange · ทดสอบ "ล้างช่องแล้วกด Save" บน dev = เขียนลง DB จริง: 2026-11-18 ทำ PO20260500004 order_date ว่าง (เดิม 2026-05-29) rev. 5 → 6 · ทดสอบ validation ของ PO ให้ใช้ปุ่ม Submit หรือใบใหม่ที่ยังไม่เคยเซฟ
- ช่องใน ribbon อ่าน error ผ่าน useFormState (ไม่ใช่ form.formState จาก prop) ด้วยเหตุผลเดียวกับ PR Template — React Compiler memo ribbon element

In the code: routes/procurement/purchase-order/po-general-fields.tsx (textMode / vendorText / workflowText, isView, contentLocked, workflowName) · po-form.tsx ส่ง isView / contentLocked={isPriceListLocked} · po-edit-content.tsx DocPageSkeleton ribbon="text" · lib/form-helpers.ts draftSaveHandler
