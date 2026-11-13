---
title: "หน้าที่ไม่อยู่ในโมดูลไหน (โปรไฟล์ การแจ้งเตือน) ไม่มี sidebar ซ้าย เนื้อหาเต็มความกว้างจอ และโลโก้ย้ายไปอยู่บนแถบบน"
author: Thammanoon
date: 2026-11-13
branch: feature/profile-page-layout
cost: { minutes: 11, tokens: 327378 }
id: l-fbacd594
scope: repo
status: active
src: agent
touches:
  - constant/module-list.ts
  - routes/root-layout.tsx
  - components/sidebar/side-main.tsx
  - components/navbar/navbar.tsx
  - components/navbar/path-breadcrumb.tsx
  - components/sidebar/side-main.test.tsx
  - routes/profile/mcp-tokens-section.tsx
---

## Decided
2026-11-13 ผู้ใช้ดูหน้า /profile แล้วสั่งว่า "left menu ไม่มี ทำให้เต็มเลย" — หน้าที่ path ไม่อยู่ใต้โมดูลใดไม่มีเมนูซ้ายให้แสดง sidebar จึงเหลือแต่โลโก้กินที่ 224px เปล่า ๆ ตอนนี้ shell ไม่วาด sidebar บนหน้าพวกนี้เลย และแถบบนแสดงโลโก้ (ลิงก์กลับหน้าแรก) แทนปุ่มพับ sidebar
การใช้กฎนี้กับทุกหน้าที่ไม่มีโมดูล (ไม่ใช่เฉพาะ /profile) เป็นการตีความของ Claude — ผู้ใช้สั่งบนหน้า /profile หน้าเดียว

## Watch out
- "มี sidebar ไหม" กับ "sidebar แสดงเมนูอะไร" ต้องตอบจากฟังก์ชันเดียวกัน ไม่งั้นได้ sidebar เปล่าหรือเมนูหาย
- /dashboard ยังมี sidebar เพราะนับเป็นโมดูล (มีแค่หัวโมดูล ไม่มีเมนูย่อย) — ผู้ใช้ยังไม่ได้สั่งเรื่องหน้านี้
- เทสต์ที่ mock รายการโมดูลทั้งไฟล์ต้องใส่ฟังก์ชันหาโมดูลเข้า mock ด้วย ไม่งั้นเมนูทั้งชุดแดง (14 เทสต์) ด้วย error ที่ไม่บอกสาเหตุตรง ๆ
- breadcrumb ของ path ที่ไม่ใช่โมดูลตกไปหาจากชื่อ segment ซึ่งชนกับโมดูลอื่นได้ (/profile เคยขึ้น "AR Profile") — เพิ่มหน้าใหม่นอกโมดูลต้องลงทะเบียน path เต็ม

In the code:
- constant/module-list.ts `findActiveModule(pathname)` — ใช้ทั้ง routes/root-layout.tsx (`hasSidebar`) และ components/sidebar/side-main.tsx
- components/navbar/navbar.tsx prop `hasSidebar`
- components/navbar/path-breadcrumb.tsx `EXTRA_PATH_KEY`
- components/sidebar/side-main.test.tsx mock ของ `@/constant/module-list`
- หน้าที่เข้าข่ายตอนนี้: /profile, /profile/setting, /notifications, /design-system, /qr/:type/:id
