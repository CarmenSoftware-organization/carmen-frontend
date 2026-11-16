---
title: "หน้ารายการ Dimension ให้คอลัมน์ชื่ออังกฤษยืดเต็ม แม้จอ 4K ชื่อไทยจะอยู่ห่างไกล"
author: Thammanoon
date: 2026-11-16
branch: fix/dimension-list-layout
cost: { minutes: 5, tokens: 200843 }
id: l-deddbb57
scope: repo
status: active
src: agent
touches:
  - routes/config/dimension/dimension-data-types.ts
  - routes/config/dimension/dimension-page.tsx
---

## Decided
2026-11-16 คงคอลัมน์ Dimension Name (EN) เป็นคอลัมน์ที่ยืดรับพื้นที่ที่เหลือ ให้เหมือนหน้า config อื่น (JV Prefix ก็เป็นแบบนี้) ถึงที่ 4K มันจะกว้าง ~2,788px จนชื่อไทยไปอยู่ไกลจากชื่ออังกฤษ
ถ้าจะให้สองชื่ออยู่ติดกัน ต้องเปลี่ยนวิธีจัดคอลัมน์ของหน้า config ทั้งชุดพร้อมกัน ไม่ใช่แก้หน้านี้หน้าเดียว

## Watch out
- ชื่อไทยเป็นคอลัมน์รอง (ถูกซ่อนเมื่อกล่องแคบ) ถ้าย้ายให้คอลัมน์นี้เป็นคอลัมน์ที่ยืด พอคอลัมน์ถูกซ่อนก็จะไม่มีคอลัมน์ไหนยืด ต้องเปลี่ยนคอลัมน์ที่ยืดตามความกว้างกล่องด้วย
- ป้ายประเภทข้อมูลแบบเต็มยาวเกินช่องตาราง ในตารางจึงแสดงชื่อสั้น ส่วนชื่อเต็มอยู่ใน tooltip และใน dropdown ของฟอร์ม ถ้าเพิ่มประเภทข้อมูลใหม่ ต้องใส่ชื่อสั้นให้ด้วย

In the code: routes/config/dimension/dimension-page.tsx useMasterGridLayout({ grow: "name", secondary: ["name_local", "data_type", "index"] }) · routes/config/dimension/dimension-data-types.ts ฟิลด์ `short` · PR #605
