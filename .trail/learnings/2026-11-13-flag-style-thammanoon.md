---
title: "หน้ารายละเอียดสินค้า: หมวดกะทัดรัดเต็มจอ รูปอยู่คู่กับชื่อ flag เป็นป้ายในโหมดดู และตารางในแท็บใช้ style เดียวกับตารางหน้ารายการ"
author: Thammanoon
date: 2026-11-13
branch: fix/product-form-compact-layout
cost: { minutes: 47, tokens: 261506 }
id: l-879b3410
scope: repo
status: active
src: agent
touches:
  - routes/product-management/category/tree-columns.tsx
  - routes/product-management/category/tree-node.tsx
  - routes/product-management/product/pd-tab-general.tsx
  - routes/product-management/product/pd-form.tsx
---

## Decided
- 2026-11-13 ผู้ใช้สั่งจัดหน้ารายละเอียดสินค้าตาม skill carmen-blue-ui-design แล้วสั่งต่อทีละข้อ: ทำ 3 แท็บที่เหลือ → อนุญาตให้จัดลำดับช่อง/หมวดใหม่ → ย้ายรูปไปอยู่คู่กับชื่อ + flag โหมดดูเป็นป้ายสถานะ → "style ของ table ไม่เหมือนปกติ ปรับให้เหมือนกัน" → "สีหัวตาราง"
- แท็บ General: 8 หมวดเหลือ 5 — ตัวระบุสินค้า (ชื่อ ชื่อท้องถิ่น รหัส SKU บาร์โค้ด คำอธิบาย + รูป) · การจัดประเภทและหน่วย (4 ช่อง) คู่กับ ภาษี ราคา ค่าเบี่ยงเบน (4 ช่อง) · flag · attribute เหตุที่คู่กลางมี 4 ช่องเท่ากัน: การ์ดคู่บน Full HD ได้ 2 คอลัมน์ หมวด 3 ช่องจะค้างแถวที่มีช่องเดียว
- โหมดดูเป็นข้อความไม่มีกรอบ · flag โหมดดูเป็นป้ายจุดสี (Active/Inactive, Yes/No) โหมดแก้เป็นสวิตช์ — สวิตช์ที่กดไม่ได้อ่านเป็นฟอร์มที่ถูกล็อก
- รูปสินค้าอยู่ซ้ายของการ์ดตัวระบุสินค้า เลิกหมวดรูปแยก · การ์ดแคบกว่า 672px รูปขึ้นไปอยู่เหนือช่อง
- คำอธิบายหมวดที่แค่ทวนชื่อช่องถูกตัด (คีย์แปลยังอยู่ในไฟล์ภาษา)
- ตารางในแท็บ (หน่วย คลัง ฉลากสิ่งแวดล้อม attribute) ใช้ style มาตรฐานของตาราง: ไม่ตั้ง padding แถวเอง ไม่ใช้ขอบแถวโค้ง ข้อความในเซลล์ไม่เยื้องจากหัวคอลัมน์ และหัวตารางมีพื้นเดียวกับตารางหน้ารายการ
- จอกว้าง: คอลัมน์กว้างคงที่ คอลัมน์เดียวรับที่เหลือ (วัดจากกล่องตาราง) · จอแคบโหมดดู: การ์ดทีละแถว · จอแคบโหมดแก้ของตารางที่กรอกในแถว: ตารางมีความกว้างขั้นต่ำแล้วเลื่อนแนวนอน

## Tried and ruled out
- ให้คอลัมน์ชื่อคลังเป็นตัวยืด: โหมดแก้ช่องนั้นเป็น lookup ยืดแล้วช่องกรอกกว้างเป็นพันพิกเซลบนจอกว้าง → ให้คอลัมน์สถานะ (สุดท้าย) ยืดแทน
- ความกว้างขั้นต่ำของตารางคลังโหมดแก้ = ผลรวมคอลัมน์ 1112px: เกินกล่อง 1052px ของจอ 1366 desktop ต้องเลื่อนแนวนอน → ใช้ 900px
- จุดเปลี่ยนเป็นการ์ด 560px สำหรับตารางคลัง: 8 คอลัมน์ ที่กล่อง 632px (tablet) ป้ายประเภทล้นช่อง → ตารางนี้ใช้ 760px
- รูปข้างช่องตั้งแต่การ์ด 576px: ช่องข้างรูปเหลือคอลัมน์เดียว การ์ดสูงขึ้น → 672px
- ภาพประกอบ "ยังไม่มีข้อมูล" เต็มการ์ดในโหมดดูของ attribute: กินที่มากกว่าเนื้อหา → บรรทัดเดียว

## Watch out
- หัวตารางจะได้พื้นสีก็ต่อเมื่อเปิดตัวเลือกตรึงหัว (headerSticky) — ไม่เปิดแล้วหัวโปร่งใส เห็นพื้นขาวของกรอบตาราง ตารางในหน้ารายละเอียดที่เขียนใหม่ต้องเปิดด้วย ไม่งั้นสีหัวไม่ตรงกับหน้ารายการ
- ข้อมูลหน่วยในตารางเดิมไม่ตรงกัน (ยังไม่ได้แก้): แถว Order Unit แสดง CAN → BOOK แต่คอลัมน์ Conversion แสดง "1 CAN = 1 CARTON" เพราะช่องหน่วยปลายทางแสดงหน่วยนับของสินค้า ส่วน Conversion อ่าน to_unit_id ของแถว
- เทสต์ตรวจคีย์ permission ของหน้าฟอร์มแดงอยู่ก่อนแล้วบน main (4 หน้าใต้ config ใช้คีย์ accounting.config*) ไม่เกี่ยวกับงานนี้
- ยังไม่ได้ตรวจ: สินค้าที่มีรูปจริง/หลายรูป, ตาราง attribute ที่มีข้อมูล, หน้าสร้างสินค้าใหม่, Save หลังแก้แถวในแท็บหน่วย/คลัง, หลายแถว/ชื่อยาว, skeleton ตอนโหลดยังเป็นโครงกลาง

In the code:
- routes/product-management/product/pd-tab-general.tsx — CompactSection/FieldGrid/SECTION_PAIR, SettingField, ToggleCell (on/onLabel/offLabel), รูปใน @container + @2xl:flex-row
- routes/product-management/product/pd-row-cards.tsx — RowCards / RowCard / RowCardField, ROW_CARDS_BELOW = 560
- pd-tab-unit-conversion.tsx (คงที่ ≥830/870, min-w 852), pd-tab-locations.tsx (คงที่ ≥1090/1130, การ์ด <760, min-w 900), pd-tab-eco.tsx (คงที่ ≥890/975, ปุ่ม 84)
- tableLayout: headerSticky: true ทุกตาราง, rowClamp: isDisabled
- messages: productManagement.product.sectionClassificationUnit, sectionTaxPriceThresholds
