---
title: "ธีมกระจกต้องวางพื้นไล่สีที่ body ไม่ใช่ที่พื้นหลัก เพราะ sidebar เป็นคอลัมน์แยก"
author: Thammanoon
date: 2026-11-26
branch: feature/theme-color-presets
cost: { minutes: 21, tokens: 222044 }
id: l-8c0c6557
scope: repo
status: active
src: agent
touches:
  - routes/design-system/design-system.route.tsx
  - routes/design-system/sections/color-themes.tsx
  - components/navbar/color-theme-switch.tsx
  - components/navbar/user-profile.tsx
  - messages/en.json
  - messages/th.json
  - styles/color-themes.css
  - styles/globals.css
  - docker/30-render-security-headers.sh
  - index.html
---

## Decided
2026-11-26: ธีม Blue Glass วางพื้นไล่สีโทนน้ำเงินไว้ที่ body แล้วทำให้พื้นหลักโปร่ง sidebar กับ navbar เป็นพื้นโปร่งที่มี backdrop-filter blur ส่วนการ์ด ตาราง ฟอร์ม dialog และ popover ทึบเสมอ ผู้ใช้เลือกขอบเขต "สีและกระจกเฉพาะโครงหน้าจอ" แทนกระจกทั้งหน้า เพราะ blur ใต้ตารางยาวทำให้กระตุก และทำให้ contrast ไม่แน่นอน

## Tried and ruled out
- วางพื้นไล่สีที่พื้นหลักตามแผนเดิม: sidebar เป็นคอลัมน์ข้าง ๆ พื้นหลัก ไม่ได้ซ้อนอยู่บนมัน กระจกของ sidebar จึงไม่มีอะไรอยู่ข้างหลังให้เบลอ
- ให้ผู้ใช้เลือกสีเองด้วยตัวเลือกสีอิสระ: รับประกัน contrast ไม่ได้ ถ้าเลือกสีอ่อน ตัวหนังสือขาวบนปุ่มจะอ่านไม่ออก
- ตั้ง class ใน main.tsx อย่างเดียวเพื่อไม่ต้องแตะ CSP: main.tsx รันหลังจาก boot เรียก network ผู้ใช้จะเห็นสีเดิมแวบหนึ่งทุกครั้งที่รีโหลด
- ธีม Rose และ Amber: Rose ปนกับสีปุ่มลบ ส่วน Amber ทำให้ตัวหนังสือขาวบนปุ่มไม่ผ่าน AA

## Watch out
- สีหลักของ Classic คือ #0154bd อยู่แล้ว Blue Glass จึงแตกต่างที่กระจก โทน navy ในโหมดมืด และสีฟ้าสว่างในโหมดมืด ไม่ได้ต่างที่สีหลักในโหมดสว่าง
- เพิ่มหรือลบธีมต้องแก้รายชื่อในสคริปต์ของ index.html ด้วย และต้องอัปเดต CSP hash ทั้ง 4 ไฟล์ รายชื่อนี้ยังไม่มี test คอยตรวจว่าตรงกับในโค้ด
- ธีมต้องไม่ override สีสถานะ

In the code: lib/color-theme.ts (COLOR_THEMES, key carmen.color-theme, classic ไม่มี class) · styles/color-themes.css · index.html inline script · components/navbar/color-theme-switch.tsx · routes/design-system/sections/color-themes.tsx
