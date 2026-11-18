---
title: "ตารางรายการสินค้า: เลือกคอลัมน์และคอลัมน์ที่ยืดตามความกว้างกล่อง ไม่ตั้งความกว้างขั้นต่ำตายตัว และการ์ดเรียงตามความกว้างกล่อง"
author: Thammanoon
date: 2026-11-18
branch: main
cost: { minutes: 8, tokens: 81798 }
id: l-d52abbec
scope: repo
status: active
src: agent
touches:
  - messages/en.json
  - messages/th.json
  - routes/product-management/category/category-component.tsx
  - routes/product-management/category/category-detail-panel.tsx
  - routes/product-management/product/use-product-table.tsx
  - routes/product-management/product/pd-component.tsx
---

## Decided
- 2026-11-18 ผู้ใช้สั่งจัดหน้า Product list ตาม skill carmen-blue-ui-design ให้ดีทุกขนาด (mobile, tablet, HD, Full HD, 4K)
- ตารางเลือกชุดคอลัมน์จากความกว้างกล่อง 4 ขั้น และคอลัมน์ที่ยืดเปลี่ยนตามขั้น: ≥1500 Status ยืด · 1050–1500 Category ยืด · 780–1050 ซ่อน Category ให้ Name ยืด · <780 ซ่อน Category กับ Unit ให้ Name ยืด
- เหตุผลที่ตัวยืดต้องเปลี่ยนตามขั้น: คอลัมน์ไหนยืด ที่ว่างจะไปกองหลังคอลัมน์นั้น ถ้าชื่อยืดในขั้นกลาง หน่วยจะห่างจากชื่อ ~450px ต้องให้ตัวยืดเป็นคอลัมน์ที่ถูกตัดบ่อยที่สุดในขั้นนั้น (ขั้นกลางคือเส้นทางหมวด)
- การ์ดเรียงด้วย auto-fill ขั้นต่ำ 18rem ตามความกว้างกล่อง ได้ tablet 2 · Full HD 5 · 4K 11 ใบต่อแถว

## Tried and ruled out
- Status ยืดทุกขั้น: tablet กับ HD ได้ที่ว่างเปล่า 180–200px ใน Status ขณะที่ชื่อและหมวดถูกตัดทุกแถว
- ชื่อยืดในขั้นกลาง (1050–1500): หน่วยหลุดห่างจากชื่อ ผิดกฎข้อ 2
- การ์ดขั้นต่ำ 22rem: tablet (กล่อง 664) เหลือแถวละใบเดียว ป้ายกับค่าห่างกันทั้งใบ

## Watch out
- visibility ของคอลัมน์ต้องคุมเอง (useState + onColumnVisibilityChange) แล้วรวมกับคอลัมน์ที่กล่องแคบบังคับซ่อน ถ้าใช้ initialState เหมือนเดิม การบังคับซ่อนจะทับสิ่งที่ผู้ใช้เลือกในเมนูคอลัมน์
- ผลรวม size ของแต่ละขั้นนับ select 55 (ไม่ได้เรนเดอร์) + # 60 + ปุ่ม 60 ด้วย และต้องน้อยกว่าจุดสลับขั้นของตัวเอง แก้ size คอลัมน์ไหนต้องคำนวณใหม่
- ผู้ใช้เปิดคอลัมน์เสริม (Local Name, audit) บน tablet แล้วตารางเลื่อนแนวนอน เป็นพฤติกรรมที่ตั้งใจ

In the code:
- routes/product-management/product/use-product-table.tsx — columnTier(), userVisibility, meta.grow ตาม sizes.grow
- routes/product-management/product/pd-component.tsx — useElementWidth รอบ DataGrid (containerWidth = วัดได้ − 2), เอา min-w-240 ออก, grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))]
