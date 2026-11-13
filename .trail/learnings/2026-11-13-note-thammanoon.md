---
title: "การ์ดที่วางเคียงกันในแถวเดียวต้องสูงเท่ากัน ไม่ปล่อยให้ใบที่เนื้อหาน้อยกว่าเตี้ยกว่า"
author: Thammanoon
date: 2026-11-13
branch: feature/profile-setting-layout
cost: { minutes: 14, tokens: 102582 }
id: l-a9b17f7c
scope: repo
status: active
src: agent
touches:
  - components/loader/loader-profile.tsx
  - components/navbar/navbar.tsx
  - components/navbar/path-breadcrumb.tsx
  - components/share/setting-field.tsx
  - components/sidebar/side-main.test.tsx
  - components/sidebar/side-main.tsx
  - constant/module-list.ts
  - routes/profile/bu-section.tsx
  - routes/profile/user-profile-details.tsx
  - routes/root-layout.tsx
---

## Decided
2026-11-13 ผู้ใช้ดูหน้า Profile Settings บนจอกว้าง (Personal Information คู่กับ Signature สูง 163 กับ 144px) แล้วสั่งว่า "ถ้ามีการแบ่งการ์ดออกเป็น 2 column ควรทำให้ความสูงในระนาบเดียวกันสูงเท่ากัน" — เป็นกติกาทั่วไปของการจัดหน้า ไม่ใช่เฉพาะหน้านี้ จึงแก้ที่ของกลางและมีผลกับหน้า Company Profile ด้วย

## Watch out
- การ์ดคู่จะเริ่มที่ระดับเดียวกันได้ หัวข้อหมวดต้องสูงเท่ากันก่อน: หมวดที่มีปุ่มบนบรรทัดหัวข้อสูง 32px หมวดที่ไม่มีสูง 28px การ์ดเลยเหลื่อมกัน 4px — ความสูงขั้นต่ำของบรรทัดหัวข้อจึงเป็น 32px ทุกหมวด
- หน้าที่ครอบหมวดด้วย div อีกชั้นในคู่ การยืดหยุดอยู่ที่ชั้นครอบ การ์ดข้างในยังเตี้ยเท่าเนื้อหา (เจอที่ Company Profile: 135 กับ 184px ทั้งที่แก้ของกลางแล้ว)
- กริดหลายคอลัมน์ที่เขียนเองห้ามใส่ items-start ถ้าลูกเป็นการ์ดมีขอบ

In the code:
- components/share/compact-section.tsx — `SECTION_PAIR` (ไม่มี items-start, มี `[&>div]:flex [&>div]:flex-col`), `CompactSection` (section `flex flex-1 flex-col`, การ์ด `flex-1`, หัวข้อ `min-h-8`)
- .claude/skills/carmen-blue-ui-design/SKILL.md กติกาข้อ 4
- วัด: ขอบบน-ล่างของการ์ดสองใบในคู่ที่ 1920px ต้องเท่ากัน (profile/setting 318-481 ทั้งคู่ · company-profile 485-669, 729-955)
