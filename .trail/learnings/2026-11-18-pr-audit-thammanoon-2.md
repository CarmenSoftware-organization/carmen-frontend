---
title: "หน้ารายละเอียดผู้ขายใช้หัวการ์ดแบบ PR ตาราง audit ปิดท้ายการ์ดชิดขวา และช่องโหมดดูแน่นกว่ากริดฟอร์มปกติ"
author: Thammanoon
date: 2026-11-18
branch: fix/vendor-detail-header-card
cost: { minutes: 2, tokens: 11213 }
id: l-7c559eb6
scope: repo
status: active
replaces: l-5ef11852
src: agent
touches:
  - routes/vendor-management/vendor/vendor-form.tsx
  - routes/vendor-management/vendor/vendor-general.tsx
---

## Decided
2026-11-19 ผู้ใช้สั่งให้หน้ารายละเอียด vendor มี style แบบหัว PR: หัวเป็นการ์ดมีพื้น (ชื่อ + สถานะ + ปุ่ม · บรรทัดรหัส/ประเภทธุรกิจใต้ชื่อ · ช่อง General) การ์ด General แยกเอาออก ต่อมาสั่งให้กระชับที่ HD: ช่องโหมดดูใช้กริดของตัวเอง 2 → 4 (@2xl) → 8 (96rem) คอลัมน์ ค่าไม่สูงเท่าช่องกรอก แล้วสั่งให้ตาราง audit ไปอยู่ล่างสุดของการ์ดหัว ชิดขวา การ์ดที่ HD = 219px (เริ่มต้น 279px)

## Tried and ruled out
- ตาราง audit ข้างกริดชิดขวาล่าง (ทรงหัว PR): vendor มี 8 ช่อง ตารางกิน ~280px กริดที่ HD เหลือ 3 คอลัมน์ 3 แถว
- ตาราง audit แถวเดียวกับรหัส (ขวาบน): การ์ดเตี้ยสุด (187px) แต่ผู้ใช้เลือกให้อยู่ล่างสุดของการ์ด
- FieldGrid dense + Description @md:col-span-1: แพ้ selector [&>[data-wide]]:col-span-2 ของ dense ช่องยังกิน 2 ช่อง

## Watch out
- ช่อง General อยู่นอก <form> (ทางเดียวกับ PR) กด Enter ไม่ submit แต่ RHF ยังเก็บค่าครบ
- ประเภทธุรกิจโหมดดูอยู่ในบรรทัดรหัส ไม่อยู่ในกริด · รหัสข้างชื่อโชว์เฉพาะโหมดเพิ่ม
- มือถือซ่อนตาราง audit เหลือไอคอนท้ายบรรทัดรหัส · ยังไม่ได้ดูที่ 1920 จริง, tablet, มือถือหลังย้าย audit, ธีมสว่าง

In the code: routes/vendor-management/vendor/vendor-form.tsx (DOC_HEADER_CARD + inlineBack + subtitle=identityLine + ribbon โหมดดู = VendorGeneral แล้ว DocAuditLine ms-auto) · vendor-general.tsx (fields(): โหมดดู grid-cols-2 @2xl:grid-cols-4 @min-[96rem]:grid-cols-8 + [&_[data-slot=field-plain-text]]:min-h-0, โหมดแก้ FieldGrid) · vendor-edit-content.tsx (skeleton หัวเป็นการ์ด)
