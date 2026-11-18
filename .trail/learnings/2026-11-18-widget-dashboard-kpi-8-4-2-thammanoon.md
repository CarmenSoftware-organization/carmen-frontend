---
title: "กริด widget ของ dashboard นับ KPI ต่อแถวเป็น 8 / 4 / 2 / 1 ตามความกว้างกล่อง (4K / Full HD+HD / tablet / mobile)"
author: Thammanoon
date: 2026-11-18
branch: feature/dashboard-grid-columns
cost: { minutes: 7, tokens: 61594 }
id: l-1d5d31e4
scope: repo
status: active
replaces: l-2cef0c65
src: agent
touches:
  - components/dashboard-widget/__tests__/widget-display.test.ts
  - components/dashboard-widget/bu-widget-section.tsx
  - components/dashboard-widget/dashboard-widget-grid.tsx
  - components/dashboard-widget/widget-display.ts
  - routes/config/config-dashboard.tsx
  - routes/dashboard/dashboard-component.tsx
  - routes/operation-plan/operation-dashboard.tsx
  - routes/root-layout.tsx
  - components/ui/sidebar.tsx
  - bun.lock
---

## Decided
2026-11-18 ผู้ใช้สั่งให้กริด widget แบ่งเป็น 8 คอลัมน์บน 4K, 4 บน Full HD และ HD, 2 บน tablet, 1 บนมือถือ แล้วเลือกแบบ "ขยายตามสัดส่วน": นับ widget ขนาดเล็กสุด (KPI กว้าง 3) เป็นหนึ่งคอลัมน์ ส่วนขนาดที่ตั้งต่อ widget ยังใช้อยู่
- กล่องกว้าง ≥ 150rem (2400px) เป็น 24 คอลัมน์ widget ใช้ความกว้างเท่าเดิม ทุกใบจึงกว้างเป็นครึ่งหนึ่งของบน Full HD (KPI 8 ใบต่อแถว กราฟครึ่งแถวเดิม 4 ใบต่อแถว) ส่วนจอ QHD 2560 กล่องราว 2250px ยังเป็น 12 คอลัมน์
- ≥ 64rem: 12 คอลัมน์ (เหมือนเดิม) · ≥ 38rem: 6 คอลัมน์ · ต่ำกว่านั้น: 1 คอลัมน์
- กล่องกลาง (tablet) มีแค่สองขนาด: widget ที่เล็กกว่าครึ่งแถว (กว้าง < 6) ได้ครึ่งแถว ที่เหลือเต็มแถว เดิมใช้ความกว้างครึ่งหนึ่งปัดขึ้น ทำให้ KPI ได้ 3 ใบต่อแถว และกราฟกว้าง 9 ได้ 5/6 แถว
- ยังวัดจากความกว้างกล่อง ไม่ใช่ความกว้างจอ เหตุผลเดิม: จอ 1024 ที่กาง sidebar เหลือกล่อง ~712px ถ้าแบ่ง 12 คอลัมน์ การ์ด KPI กว้างแค่ 169px

## Tried and ruled out
- ให้ทุก widget กว้างเท่ากันหนึ่งคอลัมน์ (8/4/2/1 ช่องเท่ากัน): ผู้ใช้ไม่เลือก เพราะตารางและกราฟกว้างจะแคบเท่า KPI และตัวเลือกขนาดในฟอร์มจะไม่มีผล
- เติมช่องว่างท้ายแถว (เรียงแบบ dense หรือยืดใบสุดท้าย): ลำดับที่ผู้ใช้ลากไว้จะไม่ตรงกับตำแหน่งจริง (ตัดสินไว้ตั้งแต่ 2026-11-13)

## Watch out
- class ของตัวห่อกริดอยู่ที่ `WIDGET_GRID_CLASS` ที่เดียว อย่าเขียนกริดเองในหน้า dashboard ใหม่ และตัวห่อต้องอยู่ใต้ `@container` ไม่งั้นได้คอลัมน์เดียวทุกขนาดโดยไม่มี error
- skeleton ต้องใช้ `gridClasses()` ตัวเดียวกับการ์ดจริง เดิมเขียน class ตายตัวไว้ พอแก้กริด skeleton ไม่ตาม การ์ดเลยกระโดดตอนข้อมูลมา
- ยังไม่ได้ลองลากสลับ widget บนกริด 24 คอลัมน์ และยังไม่ได้เปิดหน้า dashboard ของ Config / Operation Plan บน 4K

In the code: components/dashboard-widget/widget-display.ts (`WIDGET_GRID_CLASS` = `grid auto-rows-[4rem] grid-cols-1 gap-3 @min-[38rem]:grid-cols-6 @5xl:grid-cols-12 @min-[150rem]:grid-cols-24`, `gridClasses()` กล่องกลางใช้ `COL_SPAN_MID_HALF` / `COL_SPAN_MID_FULL`) · ใช้ที่ bu-widget-section.tsx, dashboard-widget-grid.tsx (รวม `WidgetSkeletonCards`), routes/dashboard/dashboard-component.tsx, routes/config/config-dashboard.tsx, routes/operation-plan/operation-dashboard.tsx
