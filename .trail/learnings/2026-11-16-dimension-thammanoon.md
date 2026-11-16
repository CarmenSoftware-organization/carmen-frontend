---
title: "หน้ารายการ Dimension: คอลัมน์ชื่ออังกฤษยืดเต็ม และแถบค้นหาไม่มีปุ่มเรียงกับเลือกคอลัมน์ เพราะตารางคุมเอง"
author: Thammanoon
date: 2026-11-16
branch: fix/dimension-list-layout
cost: { minutes: 1, tokens: 2680 }
id: l-e8e73b31
scope: repo
status: active
replaces: l-deddbb57
src: agent
touches:
  - routes/config/dimension/dimension-page.tsx
  - routes/config/dimension/dimension-data-types.ts
  - constant/list-page-keys.ts
---

## Decided
- 2026-11-16 คงคอลัมน์ Dimension Name (EN) เป็นคอลัมน์ที่ยืดรับพื้นที่ที่เหลือ ให้เหมือนหน้า config อื่น (JV Prefix ก็เป็นแบบนี้) ถึงที่ 4K มันจะกว้าง ~2,788px จนชื่อไทยอยู่ไกลจากชื่ออังกฤษ ถ้าจะให้สองชื่ออยู่ติดกัน ต้องเปลี่ยนวิธีจัดคอลัมน์ของหน้า config ทั้งชุดพร้อมกัน
- 2026-11-16 เปลี่ยนมาใช้แถบค้นหากลาง (ช่องค้น → View → Filter) ตามที่ผู้ใช้ขอ แต่ไม่ส่งตัวตารางให้แถบ จึงไม่มีปุ่มเรียงและปุ่มเลือกคอลัมน์ทางขวา เพราะตารางเรียงตาม code ตายตัว ไม่มี sorting state และซ่อนคอลัมน์รองเองตามความกว้างกล่อง ถ้าเปิดเมนูสองตัวนี้ กดแล้วจะไม่มีผล หรือจะทำงานขัดกับการซ่อนอัตโนมัติ

## Watch out
- ชื่อไทยเป็นคอลัมน์รอง (ถูกซ่อนเมื่อกล่องแคบ) ถ้าย้ายให้มันเป็นคอลัมน์ที่ยืด พอถูกซ่อนก็จะไม่มีคอลัมน์ไหนยืด
- ป้ายประเภทข้อมูลแบบเต็มยาวเกินช่องตาราง ตารางจึงแสดงชื่อสั้น ส่วนชื่อเต็มอยู่ใน tooltip และ dropdown ของฟอร์ม ถ้าเพิ่มประเภทใหม่ ต้องใส่ชื่อสั้นด้วย
- ข้อมูลโหลดมาทั้งหมดแล้วกรองในเบราว์เซอร์ ตัวกรองสถานะต้องแปลงค่าที่เก็บใน URL (`is_active|bool:true`) กลับเป็น boolean เอง ถ้าเพิ่มตัวกรองใหม่ ต้องเขียนการกรองฝั่ง client ด้วย
- page key ของ saved view ห้ามเปลี่ยนหลังขึ้นจริง ไม่งั้น view ที่ผู้ใช้บันทึกไว้จะหาย

In the code: routes/config/dimension/dimension-page.tsx useMasterGridLayout({ grow: "name", secondary: ["name_local","data_type","index"] }), `DIMENSION_FILTER_FIELDS`, `activeFromFilter`, `<ListToolbar variant="row">` (ไม่ส่ง table) · routes/config/dimension/dimension-data-types.ts ฟิลด์ `short` · constant/list-page-keys.ts `DIMENSION: "dimension"` (app-config `list_views_dimension`) · PR #605
