---
title: "ตาราง PO list เลิกลากปรับความกว้างคอลัมน์ ให้ผู้ขายยืดรับที่เหลือ และซ่อนคอลัมน์รองตามความกว้างกล่อง เหมือน PR list"
author: Thammanoon
date: 2026-11-17
branch: fix/po-list-table-columns
cost: { minutes: 4, tokens: 62015 }
id: l-2cdb30f2
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-request-template/prt-component.tsx
  - routes/procurement/purchase-request-template/use-prt-table.tsx
  - routes/procurement/purchase-order/use-po-table.tsx
---

## Decided
2026-11-18 ผู้ใช้สั่งจัดหน้า PO list ตาม skill carmen-blue-ui-design ใช้ทางเดียวกับ PR list: ปิด columnsResizable (โหมดนั้น DataGrid ข้าม meta.grow), ผู้ขายเป็นคอลัมน์ grow, ซ่อน # → Workflow → ผู้จัดซื้อ → วันที่สั่ง ตามความกว้างกล่อง ผู้จัดซื้อที่ถูกซ่อนลงบรรทัดรองใต้ผู้ขาย วันที่สั่งลงใต้เลขที่ (บรรทัดละอย่าง)
ยอดรวมเดิม 115px ตัดสกุลเงินของยอด 6 หลัก ("242,490.20 USD" = 121px + padding 24) จึงเป็น 150 · วันที่สั่ง 145 ให้ "Delivery 2026-06-26" (118px) ไม่ถูกตัด

## Tried and ruled out
ช่องเลขที่ในกล่องแคบแบบ "ชนิด · วันที่" บรรทัดเดียว: "Purchase Request · 2026-06-25" ต้องการ 179px ทำให้งบ 662px ที่ tablet ไม่พอ จึงแยกบรรทัด

## Watch out
ส่ง columnVisibility/onColumnVisibilityChange ผ่าน tableConfig ของ useConfigTable แบบ object literal แล้ว tsc แดง (type ของ tableConfig ประกาศ state แค่ pagination/sorting — excess property check) ต้องประกาศเป็นตัวแปรก่อนแล้วส่งเข้าไป
แถบเครื่องมือ (ListToolbar ของกลาง) ล้นขวา ~8px ที่ viewport 791 ทั้ง PO และ PR list เพราะ sm:flex-nowrap ตัดสินจากจอ — ยังไม่แก้

In the code: routes/procurement/purchase-order/use-po-table.tsx (columnTier, responsiveTableConfig), po-component.tsx (useElementWidth ห่อ DataGrid)
