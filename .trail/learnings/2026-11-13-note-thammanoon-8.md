---
title: "ตารางรายการผู้ขาย: คอลัมน์สั้นกว้างคงที่ ชื่อผู้ขายยืด กล่องแคบซ่อนประเภทธุรกิจ แล้วคะแนน แล้วเลขลำดับ ส่วนผู้ติดต่ออยู่จนสุดท้าย"
author: Thammanoon
date: 2026-11-13
branch: fix/vendor-list-column-widths
cost: { minutes: 1, tokens: 3842 }
id: l-d50192f5
scope: repo
status: active
src: agent
touches:
  - routes/vendor-management/vendor/use-vendor-table.tsx
  - routes/vendor-management/vendor/vendor-component.tsx
  - components/ui/data-grid/use-config-table.ts
---

## Decided
2026-11-13 ผู้ใช้สั่งจัดหน้ารายการผู้ขายตาม skill carmen-blue-ui-design ตารางเดิมแบ่งความกว้างตามสัดส่วน: ที่ tablet ดาวคะแนนกับป้ายสถานะถูกตัด ที่ 4K ค่าสั้น ๆ ห่างกันหลายร้อยพิกเซล จึงให้คอลัมน์สั้นกว้างคงที่ ชื่อผู้ขายรับที่เหลือ และเลือกคอลัมน์จากความกว้างของกล่องตารางเอง

ลำดับการซ่อนเป็นการตัดสินใจของ Claude (ผู้ใช้ยังไม่ได้ยืนยัน): ประเภทธุรกิจ → คะแนน → เลขลำดับ ผู้ติดต่ออยู่ถึงขั้นสุดท้าย เพราะคอมเมนต์เดิมในโค้ดบอกว่าจัดซื้อเปิดหน้านี้เพื่อหาว่าจะโทรหาใคร

คอลัมน์รองถูกตัดออกจากรายการคอลัมน์ ไม่ได้ตั้งผ่าน state การมองเห็นของตาราง เพื่อไม่ทับสิ่งที่ผู้ใช้เลือกในเมนูเปิด/ปิดคอลัมน์

## Tried and ruled out
- คะแนนกว้าง 120px: ดาว 5 ดวงกับ "5/5" กว้าง 102px บวก padding เซลล์ 24px ยังถูกตัด ต้อง 130px
- ให้ทั้งผู้ติดต่อและคะแนนอยู่ที่ tablet: ไม่พอในกล่อง 662px แม้ตัดเลขลำดับแล้ว

## Watch out
- ป้าย (Badge) ในเซลล์ตารางที่ต้องหดและตัดด้วย … ต้องทำครบสามอย่าง: กล่อง flex ที่ห่อต้องมี data-slot (ไม่งั้น wrapper ของเซลล์ใส่ line-clamp ทับ flex), ป้ายต้องใส่ shrink เพื่อปลด shrink-0 ของตัวมันเอง, และตัดคำที่ span ข้างในป้าย (ป้ายเป็น inline-flex ใส่ truncate ที่ตัวป้ายไม่ออก …) ก่อนแก้ ป้ายชื่อยาวถูกตัดกลางตัวอักษรและตัวนับ "+N" หลุดออกนอกเซลล์โดยไม่มี error
- คอลัมน์ที่ผู้ใช้เปิดเพิ่มเอง (เครดิตเทอม, สร้าง, แก้ไข) ไม่ได้นับในงบความกว้าง และยังไม่ได้ลองเปิดบนกล่องแคบ
- มุมมองการ์ดยังใช้ breakpoint ของจอ (class ชุดเดียวกันราว 26 หน้า) ยังไม่ได้แก้

In the code:
- routes/vendor-management/vendor/use-vendor-table.tsx — columnTier(): ประเภทธุรกิจ ≥1060 · คะแนน ≥890 · เลขลำดับ ≥770; ผลรวม size 1025 / 865 / 735 / 655 (นับ select 55 ที่ไม่เรนเดอร์)
- routes/vendor-management/vendor/vendor-component.tsx — useElementWidth() วัดกล่องรอบ DataGrid
- components/ui/data-grid/use-config-table.ts — option hideIndex
