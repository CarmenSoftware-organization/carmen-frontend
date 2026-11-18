---
title: "หน้าโปรไฟล์: โลโก้กับ avatar ของ BU เป็นสองไทล์เคียงกัน และการ์ด BU เรียงเป็นคอลัมน์บนจอกว้าง"
author: Thammanoon
date: 2026-11-18
branch: fix/profile-bu-layout
cost: { minutes: 17, tokens: 191842 }
id: l-5711fb00
scope: repo
status: active
src: agent
touches:
  - routes/profile/bu-section.tsx
  - routes/profile/user-profile-details.tsx
---

## Decided
- 2026-11-18 ผู้ใช้เลือกเอง: โลโก้กับ avatar ของแต่ละ BU เป็นสองไทล์เท่ากัน (ช่องรูปสูงคงที่ + ชื่อ + ปุ่มไอคอนอัปโหลด/ลบ) ตรงแนวกันทุกขนาด คำแนะนำชนิดไฟล์โชว์เฉพาะตอนยังไม่มีรูป
- การ์ด BU เรียงเป็นกริด auto-fit ขั้นต่ำ 56rem: 4K 3 ใบต่อแถว, Full HD 2, HD ลงไป 1 — ผู้ใช้เลือกแทนการ์ดเต็มจอที่มีรูปเป็นแถบซ้าย
- ข้อมูลส่วนตัวและช่องหลักของ BU ใช้ FieldGrid dense (2 คอลัมน์บนมือถือ)

## Tried and ruled out
- Hotel/Company แบบ dense: อีเมลถูกตัดกลางคำ ชื่อบริษัทยาว 4 บรรทัด — คงคอลัมน์เดียวบนมือถือ
- จัดแนวด้วย subgrid (รูปซ้าย ข้อความขวา): ยังเปลืองความสูง ~220px ต่อ BU และปุ่ม Remove ตกบรรทัด

## Watch out
- อย่าใส่ items-start ที่กริดการ์ด BU — การ์ดในแถวเดียวกันต้องสูงเท่ากัน
- ปุ่มไอคอนต้องมี aria-label + title

In the code: routes/profile/bu-section.tsx (ImageUploadField), routes/profile/user-profile-details.tsx (กริด BU)
