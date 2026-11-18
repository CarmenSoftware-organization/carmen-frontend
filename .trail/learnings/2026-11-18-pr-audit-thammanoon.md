---
title: "หน้ารายละเอียดผู้ขายใช้หัวการ์ดแบบ PR ตาราง audit อยู่แถวรหัส และช่องโหมดดูแน่นกว่ากริดฟอร์มปกติ"
author: Thammanoon
date: 2026-11-18
branch: fix/vendor-detail-header-card
cost: { minutes: 7, tokens: 38639 }
id: l-5ef11852
scope: repo
status: active
replaces: l-9e0ad3ac
src: agent
touches:
  - routes/vendor-management/vendor/vendor-edit-content.tsx
  - routes/vendor-management/vendor/vendor-form.tsx
  - routes/vendor-management/vendor/vendor-general.tsx
---

## Decided
2026-11-19 ผู้ใช้สั่งให้หน้ารายละเอียด vendor มี style แบบหัว PR: หัวเป็นการ์ดมีพื้น (ชื่อ + สถานะ + ปุ่ม · บรรทัดรหัส/ประเภทธุรกิจ · ช่อง General) การ์ด General แยกเอาออก แล้วสั่งต่อให้หัวกระชับที่ HD: ตาราง audit ย้ายไปอยู่แถวเดียวกับรหัส (ขวา) ช่องโหมดดูใช้กริดของตัวเอง 2 → 4 (@2xl) → 8 (96rem) คอลัมน์ ค่าไม่สูงเท่าช่องกรอก การ์ดหัวที่ HD ลดจาก 279 → 187px (2 แถว) จอกว้างเหลือแถวเดียว

## Tried and ruled out
- วางตาราง audit ข้างกริดชิดขวาล่าง (ทรงหัว PR): PR มีแค่ 2 ช่องจึงพอ แต่ vendor มี 8 ช่อง ตารางกิน ~280px กริดที่ HD เหลือ 3 คอลัมน์ 3 แถว
- ใช้ FieldGrid dense แล้วให้ Description ช่องเดียวด้วย @md:col-span-1: แพ้ selector [&>[data-wide]]:col-span-2 ของ dense ช่องยังกิน 2 ช่อง (PR ใช้ ! ถึงจะชนะ)

## Watch out
- ช่อง General อยู่นอก <form> (ทางเดียวกับ PR) กด Enter ไม่ submit แต่ RHF ยังเก็บค่าครบ
- ประเภทธุรกิจโหมดดูอยู่ในบรรทัดรหัส ไม่อยู่ในกริด · รหัสข้างชื่อโชว์เฉพาะโหมดเพิ่ม
- ยังไม่ได้ดูที่ 1920 จริง, tablet, ธีมสว่าง และคำอธิบายยาวในช่องเดียว

In the code: routes/vendor-management/vendor/vendor-form.tsx (DOC_HEADER_CARD + inlineBack + ribbon: โหมดดู = identityLine + DocAuditLine แล้วตามด้วยกริด, -mt-3.5 หักล้าง pt-4) · vendor-general.tsx (fields(): โหมดดู grid-cols-2 @2xl:grid-cols-4 @min-[96rem]:grid-cols-8 + [&_[data-slot=field-plain-text]]:min-h-0, โหมดแก้ FieldGrid) · vendor-edit-content.tsx (skeleton หัวเป็นการ์ด)
