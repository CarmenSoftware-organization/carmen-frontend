---
title: "ตาราง PR list เลิกให้ลากปรับความกว้างคอลัมน์ เพื่อให้คอลัมน์แผนกยืดรับที่เหลือและซ่อนคอลัมน์รองตามความกว้างกล่อง"
author: Thammanoon
date: 2026-11-17
branch: main
cost: { minutes: 6, tokens: 197582 }
id: l-baedc0c2
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-request/use-pr-table.tsx
---

## Decided
2026-11-18 ผู้ใช้เลือกปิดการลากปรับความกว้างคอลัมน์ (columnsResizable) ของตาราง PR list
เพราะโหมดนั้น DataGrid ข้าม meta.grow: ตารางกว้างตามผลรวม size (1075px ล้นกล่อง 662px ที่ tablet)
และ min-w-full ยืดทุกคอลัมน์ตามสัดส่วนที่ 4K (ช่องติ๊ก 182px วันที่ 314px)
ให้แผนกเป็นคอลัมน์ grow แทน ส่วนคอลัมน์อื่นกว้างคงที่ และซ่อนคอลัมน์รองตามความกว้างกล่อง: # → Workflow → ผู้ขอ → วันที่
ผู้ขอที่ซ่อนย้ายไปเป็นบรรทัดรองใต้แผนก วันที่และป้ายส่งกลับย้ายไปอยู่ใต้เลขที่

## Tried and ruled out
- เปิด resize ไว้แล้วซ่อนคอลัมน์อย่างเดียว: tablet หายล้นแต่ 4K ยังยืดห่างกันเหมือนเดิม
- แก้ DataGrid ให้ grow ใช้ได้ในโหมด resizable: แตะของกลาง กระทบอีก 7 หน้าที่เปิด resizable

## Watch out
- จะเปิด resize กลับมาต้องแก้ DataGrid ก่อน ไม่งั้น grow พังเงียบ ๆ
- columnVisibility เป็นแบบ controlled: ค่าที่ผู้ใช้เลือกเปิด/ปิดอยู่ใน state ของ hook แล้วขั้นตามความกว้างทับเฉพาะคอลัมน์ที่บังคับซ่อน
  ห้ามเขียนทับทั้งก้อนแบบ my-approval เพราะเมนู Toggle Columns (และ audit ที่ซ่อนเป็น default) จะใช้ไม่ได้
- โหมด All Documents ไม่มีช่องติ๊ก 55 + ปุ่มแถว 60 จุดเปลี่ยนจึงลบ 115

In the code: routes/procurement/purchase-request/use-pr-table.tsx columnTier() — จุดเปลี่ยน (หัก 115 แล้ว) 965/905/805/695;
pr-component.tsx หุ้ม DataGrid ด้วย useElementWidth แล้วลบขอบ 2px ออกก่อนส่ง containerWidth
