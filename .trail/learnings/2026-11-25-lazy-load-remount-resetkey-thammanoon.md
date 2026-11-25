---
title: "รายการที่โหลดสะสมด้วย lazy load ต้อง remount หลังเพิ่ม/ลบ ใช้ resetKey ของตัวโหลดไม่ได้"
author: Thammanoon
date: 2026-11-25
branch: feature/running-code-lazy-load
cost: { minutes: 8, tokens: 242200 }
id: l-09637cc7
scope: repo
status: active
src: agent
touches:
  - routes/system-admin/running-code/running-code-component.tsx
  - routes/system-admin/running-code/running-code-dialog.tsx
  - docs/superpowers/plans/2026-11-25-running-code-lazy-load.md
  - docs/superpowers/specs/2026-11-25-running-code-lazy-load-design.md
  - hooks/use-grid-pagination.ts
---

## Decided
หน้า Running Code (2026-11-25) เลิกแบ่งหน้าบน desktop ใช้ lazy load แบบเดียวกับ mobile ผู้ใช้ขอแค่หน้านี้หน้าเดียว ไม่ทำเป็นของกลางให้ DataGrid หลังเพิ่ม/แก้/ลบ/init ให้ remount ส่วนรายการทั้งก้อนด้วย `key`

## Tried and ruled out
- ส่ง resetKey ใหม่ให้ useGridPagination: ถ้าอยู่ชุดแรกอยู่แล้ว hook ล้างแถวทิ้งแต่ page ยังเป็น 1 ถ้า refetch ได้ข้อมูลเหมือนเดิม (structural sharing คืน reference เดิม) effect ที่เติมแถวจะไม่รัน ตารางว่างค้าง
- ไม่ทำอะไรเลย: invalidate จะ refetch แค่ชุดที่เปิดอยู่แล้ว merge ต่อท้าย แถวที่ลบไปในชุดก่อนหน้าค้างอยู่ใน state ที่สะสม (บั๊กนี้มีอยู่แล้วในมุมการ์ด mobile ทุกหน้า)

## Watch out
- เลขลำดับในตาราง lazy load ต้องส่ง params ที่ตั้ง page: 1 ให้ table hook ไม่งั้น indexColumn คิด offset ผิด
- ต้องใส่ "use no memo" ในคอมโพเนนต์ เพราะแถวมาจาก state ที่สะสมไว้

In the code: routes/system-admin/running-code/running-code-component.tsx (RunningCodeComponent → RunningCodeList key), hooks/use-grid-pagination.ts (reset effect + append effect), running-code-dialog.tsx onSaved
