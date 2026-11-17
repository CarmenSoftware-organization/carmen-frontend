---
title: "หน้า My Approval บนมือถือเป็นการ์ด ตัดสินจากความกว้างกล่อง และยังแบ่งหน้าเหมือนตาราง ไม่ใช้ infinite scroll"
author: Thammanoon
date: 2026-11-17
branch: fix/my-approval-mobile-cards
cost: { minutes: 4, tokens: 231167 }
id: l-29a86a76
scope: repo
status: active
src: agent
touches:
  - routes/procurement/my-approval/approve-queue-list.tsx
---

## Decided
2026-11-18 ผู้ใช้สั่งให้หน้า My Approval บนมือถือแสดงเป็น card view
- สลับเป็นการ์ดเมื่อกล่องตารางที่วัดได้แคบกว่า 650px (จุดเดียวกับที่เคยตัดคอลัมน์รายละเอียด) ไม่ใช้ breakpoint ของจอ ตามกฎข้อ 3 ของ carmen-blue-ui-design
- การ์ดถือทุกช่องของตาราง (ตารางที่บีบเหลือสามคอลัมน์ซ่อนผู้ขอ ขั้น และคำอธิบาย ผู้อนุมัติบนมือถือจึงไม่เห็นข้อมูลพวกนี้)
- ยังแบ่งหน้าด้วย DataGridPagination เดิม query เดียว ไม่ต้องแยกเส้นทางโหลดข้อมูล

## Tried and ruled out
- ทำตามแพทเทิร์นของ PR list (useIsMobile + useGridPagination แบบ infinite scroll): แบบนั้นตัดสินจากความกว้างจอ และต้องมี query ชุดที่สองแยกออกมา ส่วนหน้านี้ยังใช้ query ตัวเดียวกันนับจำนวนใบที่ถูกตีกลับ (perpage 1) และ invalidate พร้อมกันหลังอนุมัติ จึงไม่คุ้มที่จะทำแบบนั้น

## Watch out
- DataGridPagination ต้องการแค่ context ของ DataGrid ไม่จำเป็นต้องอยู่ใน DataGridContainer การ์ดจึงอยู่ใน <DataGrid> ได้ โดยให้ pagination เป็นกรอบของมันเอง
- div ที่ผูก ref ของ useElementWidth ต้องครอบทั้งโหมดการ์ดและโหมดตาราง ไม่อย่างนั้นวัดความกว้างไม่ได้และสลับกลับเป็นตารางไม่ได้

In the code: routes/procurement/my-approval/approve-queue-list.tsx — columnTier().cardView, ApprovalAmount / WaitingDays / StageValue ใช้ร่วมกันทั้งตารางและการ์ด
