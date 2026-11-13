---
title: "หน้า 404 แสดงในแอป (เมนูซ้ายยังอยู่) และคนที่ยังไม่ล็อกอินถูกพาไปหน้าล็อกอินก่อน · ลบหน้า Dashboard Dataset แต่เก็บตัวดึงรายการ dataset ไว้"
author: Thammanoon
date: 2026-11-13
branch: fix/workflow-header-thai-mobile-counts
cost: { minutes: 22, tokens: 347952 }
id: l-9c917936
scope: repo
status: active
src: agent
touches:
  - components/icons/tiles/sub-tiles.tsx
  - components/not-found-component.tsx
  - components/ui/type-ladder.test.ts
  - constant/module-list.ts
  - docs/modules/README.md
  - messages/en.json
  - messages/th.json
  - routes/router.tsx
---

## Decided
2026-11-13 ผู้ใช้สั่งลบหน้า Dashboard Dataset ของ System Admin แล้วสั่งออกแบบหน้า 404 ใหม่ (ไม่ได้ระบุรายละเอียด ทิศทางด้านล่างเป็นการตัดสินใจของ Claude ซึ่งผู้ใช้สั่ง merge ต่อโดยไม่ได้ค้าน)

- หน้า 404 อยู่ใน shell ของแอป ไม่ใช่หน้าเต็มจอนอก shell: คนที่ล็อกอินอยู่แล้วเปิด bookmark เก่าหรือพิมพ์ URL ผิดยังเห็นเมนูของโมดูลนั้น ซึ่งเป็นทางหาหน้าที่ถูกได้เร็วที่สุด หน้าโชว์ที่อยู่ที่เปิดมา และปุ่มหลักพากลับหน้าแรกของโมดูลเดียวกัน ถ้าเข้าโมดูลนั้นไม่ได้หรือ URL ไม่อยู่ในโมดูลไหน ปุ่มพาไปหน้าแรกที่ผู้ใช้เปิดได้จริง (ไม่ตายตัวที่แดชบอร์ด เพราะแดชบอร์ดถูกล็อกด้วย license ได้)
- ผลข้างเคียงที่ยอมรับ: คนที่ยังไม่ล็อกอินแล้วเปิด URL ที่ไม่มีอยู่ ไม่เห็นหน้า 404 แล้ว ถูกพาไปหน้าล็อกอินพร้อม next ก่อน
- ลบเฉพาะ "หน้า" Dashboard Dataset ตัวดึงรายการ dataset, type, endpoint และคีย์ permission/license ยังอยู่ เพราะหน้า Dashboard กับตัวเพิ่ม widget ยังใช้

## Tried and ruled out
- ทำรายการลิงก์หน้าของโมดูลไว้ในหน้า 404: ซ้ำกับเมนูซ้ายที่อยู่ข้าง ๆ อยู่แล้ว
- คงตัวเลข 404 ขนาด 88px: เป็นข้อยกเว้นของ type ladder ตัวเดียวที่มีไว้เพื่อหน้านี้ และไม่เข้ากับ error state อื่นในแอป

## Watch out
- ลบภาพประกอบของการ์ดบน landing ของ System Admin ต้องแก้ตัวเลขข้อยกเว้นในเทสต์ type ladder ตาม ไม่งั้นเทสต์แดง (นับจำนวนขนาดตัวอักษรนอก ladder ต่อไฟล์แบบเท่ากันพอดี)
- ตัวช่วยวาดเส้น (Line) ในไฟล์ภาพประกอบ landing ถูกประกาศคั่นอยู่ระหว่างภาพสองภาพ ตัดภาพทิ้งทั้งช่วงจะลบมันไปด้วย แล้วภาพอื่นอีก 8 จุดพัง
- คำโปรยของกลุ่มบน landing อ้างถึงหน้าในกลุ่ม ลบการ์ดแล้วต้องอ่านคำโปรยซ้ำ
- breadcrumb บนแถบบนแปลงชื่อจาก URL ตรง ๆ จึงยังขึ้นชื่อหน้าที่ไม่มีอยู่ในหน้า 404 (ยังไม่ได้แก้)
- ยังไม่ได้ตรวจ: ปุ่มย้อนกลับของหน้า 404, ทางของคนไม่ล็อกอิน, บัญชีที่ไม่ใช่ admin

In the code:
- routes/router.tsx — catch-all `{ path: "*" }` เป็นลูกตัวสุดท้ายของ `ProtectedShell`
- components/not-found-component.tsx — `findActiveModule`, `useVisibleModules`, `useLandingPath`; ปุ่มย้อนกลับดูจาก `history.state.idx > 0`
- components/ui/type-ladder.test.ts — `ALLOWED_OFF_LADDER`, `ALLOWED_SUB_10PX` (`routes/system-admin/landing-visuals.tsx`: 10 → 6)
- hooks/use-dashboard-dataset.ts, types/dashboard-dataset.ts — ยังใช้โดย `routes/dashboard/` และ `components/dashboard-widget/`
- messages/{en,th}.json — `notFound.*`, `systemAdmin.landing.groups.data.lede`
