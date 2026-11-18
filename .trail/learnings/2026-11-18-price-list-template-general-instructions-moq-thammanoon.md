---
title: "หน้า Price List Template: General คู่ Instructions บนจอกว้าง และตารางสินค้าให้ MOQ/หน่วยติดชื่อสินค้า"
author: Thammanoon
date: 2026-11-18
branch: main
cost: { minutes: 1, tokens: 2666 }
id: l-35a1a179
scope: repo
status: active
src: agent
touches:
  - routes/vendor-management/price-list-template/plt-form.tsx
  - routes/vendor-management/price-list-template/plt-item-grouped-view.tsx
---

## Decided
- 2026-11-18 ผู้ใช้สั่งจัดหน้า price list template detail ตาม skill carmen-blue-ui-design: เลิก SettingSection (หัวข้อซ้าย 1/3) เฉพาะหน้านี้ เปลี่ยนเป็น CompactSection + FieldGrid · General คู่กับ Instructions to vendor ด้วย SECTION_PAIR (≥1700px)
- ตารางสินค้าโหมดดู (plain table): กล่อง ≥@3xl คอลัมน์ข้อมูลกว้างเท่าเนื้อหา (w-px) Note รับที่เหลือ · กล่องแคบชื่อสินค้าห่อบรรทัด และ Note ไม่ยืด (ไม่งั้นชื่อสินค้าถูกบีบเหลือ ~115px ขณะ Note ได้ 400px)

## Tried and ruled out
- จุดสลับ @xl ตามตัวอย่างใน skill: ตารางนี้กว้างขั้นต่ำแบบไม่ห่อ ~734px ที่ tablet (กล่อง 630) ล้น 104px → ใช้ @3xl
- Validity + Description กว้าง 2 ช่องทั้งคู่: ตกคนละแถวในกริด 3 คอลัมน์ → Description ช่องเดียว

## Watch out
- คู่ section ที่อยู่บนสุดของฟอร์ม: ก้อนซ้ายเป็น first (ไม่มี mt-5) ก้อนขวาต้องตัด mt-5 ตอนวางคู่ (min-[1700px]:[&>section]:mt-0) ไม่งั้นการ์ดขวาต่ำกว่า 20px — company-profile ไม่เจอเพราะคู่ของมันไม่ใช่ก้อนแรก
- คำอธิบายหมวดยาว (Instructions โหมดแก้) ห่อบนหัวข้อคู่ → ย้ายเข้าการ์ดเป็น FieldDescription
- NameWithSubtext ตัดข้อความบรรทัดเดียว (nowrap) → ใน table auto layout ดันคอลัมน์กว้างเท่าข้อความ ต้องปลด [&_p]:whitespace-normal ในเซลล์เองตอนกล่องแคบ
- ยังไม่ได้ลอง: Save จริง, skeleton ในเบราว์เซอร์, ไทย, ไม่มีสินค้า, หลาย MOQ tier, หน้า /new

In the code:
- routes/vendor-management/price-list-template/plt-form.tsx — SECTION_PAIR + wrapper ก้อนขวา
- routes/vendor-management/price-list-template/plt-item-grouped-view.tsx — @container, @3xl
- routes/vendor-management/price-list-template/plt-form-skeleton.tsx (ใหม่)
- ผลวัด: ตาราง 300/300 · 630/630 · 1052/1052 · 1606/1606 · 3526/3526; คู่การ์ด 1920 top 140/140 สูง 162/162, หัวข้อ 32/32
