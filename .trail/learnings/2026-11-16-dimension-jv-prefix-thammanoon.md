---
title: "หน้ารายการ Dimension กับ JV Prefix: คอลัมน์ชื่อยืดเต็ม และแถบค้นหาไม่มีปุ่มเรียงกับเลือกคอลัมน์ เพราะตารางคุมเอง"
author: Thammanoon
date: 2026-11-16
branch: fix/dimension-list-layout
cost: { minutes: 6, tokens: 31152 }
id: l-221876cb
scope: repo
status: active
replaces: l-e8e73b31
src: agent
touches:
  - constant/list-page-keys.ts
  - routes/config/dimension/dimension-page.tsx
  - routes/config/jv-prefix/jv-prefix-page.tsx
  - routes/config/shared/status-list-filter.ts
  - routes/config/dimension/dimension-data-types.ts
---

## Decided
- 2026-11-16 คงคอลัมน์ชื่อ/คำอธิบายภาษาอังกฤษเป็นคอลัมน์ที่ยืดรับพื้นที่ที่เหลือ (Dimension: Dimension Name (EN), JV Prefix: Description (EN)) ถึงที่ 4K มันจะกว้าง ~2,788px จนภาษาไทยอยู่ไกลจากภาษาอังกฤษ ถ้าจะให้สองภาษาอยู่ติดกัน ต้องเปลี่ยนวิธีจัดคอลัมน์ของหน้า config ทั้งชุดพร้อมกัน
- 2026-11-16 ผู้ใช้ขอให้สองหน้านี้มีตัวกรองและ bookmark (saved view) เหมือนหน้าอื่น จึงใช้แถบค้นหากลาง (ช่องค้น → View → Filter) แต่ไม่ส่งตัวตารางให้แถบ จึงไม่มีปุ่มเรียงและปุ่มเลือกคอลัมน์ทางขวา เพราะตารางเรียงตาม code ตายตัว ไม่มี sorting state และซ่อนคอลัมน์รองเองตามความกว้างกล่อง ถ้าเปิดเมนูสองตัวนี้ กดแล้วจะไม่มีผล หรือจะทำงานขัดกับการซ่อนอัตโนมัติ

## Watch out
- คอลัมน์ภาษาไทยเป็นคอลัมน์รอง (ถูกซ่อนเมื่อกล่องแคบ) ถ้าย้ายให้มันเป็นคอลัมน์ที่ยืด พอถูกซ่อนก็จะไม่มีคอลัมน์ไหนยืด
- ป้ายประเภทข้อมูลของ Dimension แบบเต็มยาวเกินช่องตาราง ตารางจึงแสดงชื่อสั้น ส่วนชื่อเต็มอยู่ใน tooltip และ dropdown ของฟอร์ม ถ้าเพิ่มประเภทใหม่ ต้องใส่ชื่อสั้นด้วย
- สองหน้านี้โหลดข้อมูลมาทั้งหมดแล้วกรองในเบราว์เซอร์ ตัวกรองสถานะต้องแปลงค่าที่เก็บใน URL (`is_active|bool:true`) กลับเป็น boolean เอง ถ้าเพิ่มตัวกรองใหม่ ต้องเขียนการกรองฝั่ง client ด้วย หน้า config อื่นที่กรองในเบราว์เซอร์ใช้ตัวกรองกลางชุดเดียวกันได้
- page key ของ saved view ห้ามเปลี่ยนหลังขึ้นจริง ไม่งั้น view ที่ผู้ใช้บันทึกไว้จะหาย

In the code: routes/config/shared/status-list-filter.ts `STATUS_FILTER_FIELDS`, `activeFromFilter` · routes/config/dimension/dimension-page.tsx และ routes/config/jv-prefix/jv-prefix-page.tsx `<ListToolbar variant="row">` (ไม่ส่ง table), useMasterGridLayout grow "name" / "description" · routes/config/dimension/dimension-data-types.ts ฟิลด์ `short` · constant/list-page-keys.ts `DIMENSION: "dimension"`, `JV_PREFIX: "jv_prefix"` (app-config `list_views_<key>`) · PR #605
