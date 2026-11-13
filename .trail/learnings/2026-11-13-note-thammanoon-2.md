---
title: "ปุ่มบนหัวฟอร์มอยู่บรรทัดเดียวบนมือถือ: ปุ่มรองเหลือไอคอน ปุ่มหลักเก็บป้าย และตารางในหน้ารายละเอียดเป็นการ์ดเมื่อกล่องแคบ"
author: Thammanoon
date: 2026-11-13
branch: fix/unverified-followups
cost: { minutes: 73, tokens: 351695 }
id: l-f67e4fe7
scope: repo
status: active
src: agent
touches:
  - messages/en.json
  - messages/th.json
  - routes/system-admin/landing-chapter.tsx
  - routes/system-admin/landing-hero.tsx
  - routes/system-admin/landing-module-card.tsx
  - routes/system-admin/landing-types.ts
  - routes/system-admin/landing-visuals.tsx
  - routes/system-admin/system-admin-landing.tsx
  - components/share/form-toolbar.tsx
---

## Decided
2026-11-13 ผู้ใช้สั่งบนหน้ารายละเอียด vendor ที่ความกว้างมือถือ:
- "top button เวลาที่เป็น mobile … ไม่อยากให้แสดงหลายบรรทัด แนะนำด้วย" → หัวฟอร์มแคบกว่า 576px ปุ่มรอง (Cancel, Delete, Print, Comment, Activity) เหลือแต่ไอคอน ปุ่มหลัก (Edit / Save) เก็บป้าย ลำดับปุ่มไม่เปลี่ยน การเลือกทางนี้เป็นคำแนะนำของ Claude ที่ผู้ใช้รับ
- "ที่ mobile scale ปรับ certificate table ให้เป็น card แทน" → ตารางใบรับรองเป็นการ์ดทีละใบเมื่อกล่องตารางแคบกว่า 560px
- หน้ารายละเอียดผู้ใช้และ vendor จัดตามกติกาเต็มความกว้างจอ: โหมดดูแสดงข้อความ ไม่ใช่ฟอร์มเดิมที่ disable ทุกช่อง

## Tried and ruled out
- เรียงลำดับปุ่มใหม่อย่างเดียว: ปุ่ม 5 ตัวมีป้ายกว้าง ~440px ไม่พอในกล่อง 300px เรียงยังไงก็ตกบรรทัด
- ยุบปุ่มเป็นเมนู ⋯: ผู้ใช้สั่งกลับเรื่องนี้ไปแล้วเมื่อ 2026-10-29
- คอลัมน์ยืดกับตารางใบรับรองทุกความกว้าง: คอลัมน์ยืดล็อกความกว้างขั้นต่ำของตารางไว้ที่ผลรวมคอลัมน์ ตารางจึงล้นกล่องบนมือถือ → ใช้เฉพาะเมื่อกล่องกว้างพอ
- จำลองสถานะล็อก/ไม่มีสิทธิ์ที่ชั้นของหน้า landing: จับบั๊กไม่ได้ เพราะข้ามตัวตรวจสิทธิ์จริง — ต้องลองด้วยบัญชี non-admin จริง

## Watch out
- การ์ดใน landing ของ System Admin ต้องดูสิทธิ์ของเมนูทุกชั้น: Notification Template เป็นเมนูชั้นสองใต้ Workflows ดูแค่ชั้นแรกแล้วการ์ดกดได้ทั้งที่เมนูซ้ายบล็อก (เจอด้วยบัญชี purchase@zebra.com)
- แก้ไฟล์ภาพประกอบของ landing แล้วต้องรันเทสต์ทั้ง suite: มี allowlist นับจำนวนตัวอักษรเล็กกว่า 10px ต่อไฟล์ จำนวนเปลี่ยนแล้วเทสต์แดง (เคย merge ทั้งที่แดงเพราะรันเฉพาะโฟลเดอร์ที่แตะ)
- ปุ่มเฉพาะหน้าที่บางหน้าใส่เพิ่มบนหัวฟอร์มยังมีป้าย อาจตกบรรทัดบนมือถือ — ยังไม่ได้ไล่ดูทุกหน้า
- Company Profile / Default Setting หลัง Save น่าจะโชว์ค่าเก่า 1–3 วินาที (รอ refetch) — ยังไม่ได้ยืนยันและยังไม่ได้แก้

In the code:
- components/share/form-toolbar.tsx `LABEL_HIDE` = `@max-xl/doc-header:sr-only` · components/share/doc-form-header.tsx `@container/doc-header` · components/print-document-button.tsx
- routes/vendor-management/vendor/vendor-certificate-section.tsx `CertificateCards`, `asCards` (< 560), `fixedColumns` (≥ 690 ดู / 760 แก้)
- routes/vendor-management/vendor/vendor-address.tsx `AddressView` · กริด `auto-fill minmax(min(100%, 18rem|26rem), 1fr)`
- routes/system-admin/user/user-assigned-locations.tsx `columnTier` (590 / 440) · user-assigned-roles.tsx (โหมดดู = FieldGrid ของบทบาทที่ถือ)
- components/share/compact-section.tsx prop `frameless`
- routes/system-admin/system-admin-landing.tsx `flatten()` · components/ui/type-ladder.test.ts allowlist 17 → 10
