---
title: "กริด widget ของ dashboard ทุกโมดูลแบ่งคอลัมน์ตามความกว้างกล่อง ไม่ใช่ความกว้างจอ และช่องว่างท้ายแถวเป็นเรื่องของขนาดที่ตั้งต่อ widget"
author: Thammanoon
date: 2026-11-13
branch: fix/dashboard-grid-container-width
cost: { minutes: 8, tokens: 100925 }
id: l-2cef0c65
scope: repo
status: active
src: agent
touches:
  - components/dashboard-widget/widget-display.ts
  - routes/dashboard/dashboard-component.tsx
  - routes/config/config-dashboard.tsx
  - routes/operation-plan/operation-dashboard.tsx
  - components/dashboard-widget/dashboard-widget-grid.tsx
---

## Decided
2026-11-13 ผู้ใช้สั่งตรวจหน้า Dashboard ตามกติกา layout ของ CARMEN BLUE (การเลือกวิธีแก้เป็นของ Claude ผู้ใช้ยังไม่ได้ review):
- กริด widget แบ่ง 6 คอลัมน์เมื่อกล่องกว้าง 38rem ขึ้นไป และ 12 คอลัมน์เมื่อ 64rem ขึ้นไป โดยวัดจากกล่อง เพราะจอ 1024 ที่กาง sidebar เหลือกล่อง ~712px แบ่ง 12 คอลัมน์แล้วการ์ด KPI กว้าง 169px บรรทัดเทียบงวดก่อนโดนขอบล่างตัดหาย (การ์ดสูงตายตัวและซ่อนส่วนล้น จึงไม่มี error ให้เห็น)
- บรรทัดเทียบงวดก่อนของการ์ด KPI อยู่บรรทัดเดียวเสมอ: ไม่พอที่ให้ซ่อนคำว่า "เทียบงวดก่อน" ทั้งคำ ตัวเลขอยู่ครบ

## Tried and ruled out
- เติมช่องว่างท้ายแถว (เรียงแบบ dense หรือยืดใบสุดท้าย): ลำดับที่ผู้ใช้ลากไว้จะไม่ตรงกับตำแหน่งจริง และขนาดเป็นค่าที่ผู้ใช้ตั้งต่อ widget → ไม่แตะ ให้ปรับขนาดในหน้าตั้งค่า
- ตัดคำเทียบงวดก่อนด้วย ellipsis: เหลือ "vs. pr…" อ่านไม่รู้เรื่อง

## Watch out
- ตัวที่ห่อกริดต้องเป็น container ไม่งั้นกริดเป็นคอลัมน์เดียวทุกขนาดจอโดยไม่มี error — หน้า dashboard ใหม่ที่วางกริดเองต้องใส่ด้วย
- วัดการ์ดล้นด้วย scrollHeight เทียบ clientHeight ของการ์ด ที่ 768 และ 1024 (sidebar กาง) — สองขนาดนี้คือจุดที่พัง
- ยังไม่ได้เปิด dashboard ของ inventory / store-operation / product / vendor, dark mode, ภาษาไทย และการลากสลับ widget หลังเปลี่ยนกริด
- ชื่อการ์ดสรุปสถานะยังถูกตัดบนมือถือ (ยังไม่แก้)

In the code:
- `components/dashboard-widget/widget-display.ts` — `gridClasses()` คืน `@min-[38rem]:col-span-N @5xl:col-span-N`
- กริด: `grid auto-rows-[4rem] grid-cols-1 gap-3 @min-[38rem]:grid-cols-6 @5xl:grid-cols-12` ใน `bu-widget-section.tsx`, `dashboard-widget-grid.tsx`, `routes/dashboard/dashboard-component.tsx`, `routes/config/config-dashboard.tsx`, `routes/operation-plan/operation-dashboard.tsx` — ตัวห่อมี `@container`
- `DeltaIndicator` ใน `dashboard-widget-grid.tsx` — `h-4 flex-wrap overflow-hidden whitespace-nowrap`
