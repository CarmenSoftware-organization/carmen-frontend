---
title: "PR Template: มือถือใช้การ์ดกระชับแบบ PR/PO แต่ตารางที่ 4K คงให้คำอธิบายยืดอยู่กลางตามเดิม"
author: Thammanoon
date: 2026-11-18
branch: fix/prt-mobile-card
cost: { minutes: 3, tokens: 23453 }
id: l-62519467
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-order/use-po-table.tsx
  - routes/procurement/purchase-request-template/prt-card.tsx
---

## Decided
2026-11-18 ผู้ใช้เลือกให้หน้า PR Template บนมือถือใช้การ์ดกระชับแบบเดียวกับ PR/PO: หัวเป็นชื่อ + ชิป Active ตามด้วยบรรทัด workflow · คำอธิบาย และบรรทัดผู้สร้าง + วันที่แก้ล่าสุด ที่ 320px การ์ดสูงลดจาก 218–240 เหลือ 148px โหมด grid บนจอกว้างยังใช้การ์ดเต็ม
ตารางที่ 4K คงลำดับเดิม คำอธิบายยืด (~2,800px ส่วนใหญ่เป็น "—") อยู่ก่อน Created By/Status ตามกฎ skill ที่ให้คอลัมน์ข้อความยาวเป็นคอลัมน์ยืดแม้มีคอลัมน์ตามหลัง

## Tried and ruled out
- ย้ายคำอธิบายไปเป็นคอลัมน์ท้ายทุกขนาด เพื่อให้ Created By/Status ไม่ไปอยู่ขวาสุดที่ 4K: ผู้ใช้เลือกคงลำดับเดิม (เหมือน PO ที่ไม่ยอมย้าย Vendor)

## Watch out
- การ์ดกระชับใช้เฉพาะเส้นทาง infinite scroll (มือถือ) ใน prt-component ส่วนโหมด grid ที่มีแบ่งหน้ายังเป็นการ์ดเต็ม

In the code: routes/procurement/purchase-request-template/prt-card.tsx prop `compact`; prt-component.tsx ส่ง compact เฉพาะบล็อก useInfiniteScroll
