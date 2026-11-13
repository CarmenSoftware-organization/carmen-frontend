---
title: "ทดสอบลากสลับ widget บน dashboard ผ่านเบราว์เซอร์อัตโนมัติ: ใช้ pointer event จำลองที่ค้างไว้ที่ปลายทางก่อนปล่อย และต้องคืนลำดับเดิมเพราะบันทึกลง dev DB ที่ใช้ร…"
author: Thammanoon
date: 2026-11-13
branch: fix/module-dashboard-skeleton-span
cost: { minutes: 11, tokens: 48649 }
id: l-a12ff4ce
scope: repo
status: active
src: agent
touches:
  - components/dashboard-widget/__tests__/widget-display.test.ts
  - components/dashboard-widget/bu-widget-section.tsx
  - components/dashboard-widget/dashboard-widget-grid.tsx
  - components/dashboard-widget/widget-display.ts
  - routes/config/config-dashboard.tsx
  - routes/dashboard/dashboard-component.tsx
  - routes/operation-plan/operation-dashboard.tsx
  - components/dashboard-widget/sortable-widget-item.tsx
---

## Decided
2026-11-13 ตรวจการลากสลับ widget หลังเปลี่ยนกริด dashboard เป็นแบบวัดจากความกว้างกล่อง: ลากได้ตรงช่องทั้งกริด 12 และ 6 คอลัมน์ (ส่วน Saved widgets)
- วิธีที่ใช้ได้: ยิง pointerdown ที่ปุ่มจับ → pointermove ไปกลางการ์ดปลายทางเป็นขั้น ๆ → ยิง pointermove ซ้ำที่จุดเดิมอีกราว 1 วินาที → pointerup เพราะการ์ดขยับที่ระหว่างลาก ต้องให้ระบบคำนวณเป้าหมายใหม่หลังการ์ดเข้าที่ก่อนปล่อย

## Tried and ruled out
- ลากเป็นเส้นตรงแล้วปล่อยทันที: การ์ดกำลังขยับ เป้าหมายตอนปล่อยไม่ใช่ใบที่เล็ง widget ไปลงผิดช่อง (ไม่ใช่บั๊กของหน้า เป็นวิธีทดสอบที่ผิด)
- ลากด้วยเมาส์จริงผ่านเครื่องมือของ extension: timeout 30 วินาที ไม่มีอะไรขยับ
- กดคีย์บอร์ดจำลอง (Space + ลูกศร): ไม่มีผล

## Watch out
- ทุกการลากบันทึกลำดับลง dev DB ที่ใช้ร่วมกันทันที — จดลำดับก่อน ลากคืน แล้ว reload ยืนยัน
- การ์ดโหลดเมื่อเลื่อนถึง ต้องเลื่อนรายการเข้าจอก่อนอ่านชื่อ ไม่งั้นได้ชื่อว่าง
- skeleton ของ dashboard โมดูลที่วางกริดเองต้องบอกขนาดช่องเอง ไม่ใส่ = กว้าง 1 คอลัมน์ (เจอที่ dashboard ของ config และ operation-plan)

In the code:
- ปุ่มจับ: `[aria-label='Drag to reorder']` ใน `components/dashboard-widget/sortable-widget-item.tsx`; รายการ Saved widgets คือ `ul` ตัวที่สองที่มี `auto-rows-[4rem]`
- skeleton: `className="row-span-2 @min-[38rem]:col-span-2 @5xl:col-span-3"` ใน `routes/config/config-dashboard.tsx`, `routes/operation-plan/operation-dashboard.tsx`
