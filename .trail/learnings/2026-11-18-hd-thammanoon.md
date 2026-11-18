---
title: "หน้ารายละเอียดผู้ขายโหมดดู: หมวดว่างเหลือบรรทัดเดียว ที่อยู่คู่ผู้ติดต่อตั้งแต่ HD แต่โหมดแก้ยังซ้อนกัน"
author: Thammanoon
date: 2026-11-18
branch: fix/vendor-detail-header-card
cost: { minutes: 9, tokens: 84439 }
id: l-2527cd1f
scope: repo
status: active
src: agent
touches:
  - routes/vendor-management/vendor/vendor-form.tsx
---

## Decided
2026-11-19 ผู้ใช้เลือกให้หน้ารายละเอียด vendor โหมดดู: (1) หมวดที่ไม่มีรายการ (ที่อยู่ ผู้ติดต่อ ข้อมูลเพิ่มเติม) เหลือบรรทัดเดียว ข้อความว่างขึ้นแทนคำอธิบายบนบรรทัดหัวหมวด (2) ที่อยู่ | ผู้ติดต่อ วางคู่ตั้งแต่กล่อง 56rem (HD 1366) แทน 1700px ของ SECTION_PAIR ตัดสินจาก @container ไม่ใช่จอ

## Tried and ruled out
- วางคู่ที่ HD ในโหมดแก้ด้วย: หัวหมวดผู้ติดต่อ (คำอธิบาย + ปุ่ม Add Contact) ตกสองบรรทัด การ์ดสองฝั่งเริ่มคนละระดับ ช่องอีเมล/โทรศัพท์ถูกบีบ → โหมดแก้กลับไปใช้ SECTION_PAIR
- -mt-5 บนตัวห่อคู่เพื่อลดช่องว่างใต้การ์ดหัว: วัดแล้วไม่มีผล (ช่องห่าง 24px เท่าเดิม) จึงเอาออก

## Watch out
- "Created by: —" บนหน้าผู้ขายไม่ใช่บั๊ก FE: VendorDetailResponseSchema ของ micro-business ไม่มี created_by_id / updated_by_id zod ตัดทิ้ง gateway จึงประกอบชื่อไม่ได้ (เหมือน product #1088) แก้ที่ branch backend fix/vendor-detail-audit — ชื่อขึ้นเมื่อ micro-business deploy แล้ว
- ใบรับรองยังใช้กล่องว่างของตาราง (ไม่ได้ทำบรรทัดเดียว)
- dev DB 30 รายแรกไม่มีผู้ขายที่มีที่อยู่/ผู้ติดต่อ โหมดดูของการ์ดคู่จึงยังไม่เคยเห็นกับข้อมูลจริง

In the code: VENDOR_SECTION_PAIR = "grid gap-x-5 @4xl:grid-cols-2" ใน routes/vendor-management/vendor/vendor-form.tsx (ใช้เมื่อ isView) · description={isView && fields.length === 0 ? t(noX) : t(desc)} ใน vendor-address/contact/info.tsx · backend apps/micro-business/src/master/vendors/dto/vendor.serializer.ts
