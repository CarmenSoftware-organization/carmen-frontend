---
title: "ต้นไม้หมวดหมู่สินค้า: เลือกสิ่งที่แสดงจากความกว้างการ์ด ค่าอยู่ติดชื่อ คลิกแถวเพื่อไฮไลต์ และปุ่มของแถวชิดขอบขวาของการ์ด"
author: Thammanoon
date: 2026-11-13
branch: fix/category-tree-box-width
cost: { minutes: 2, tokens: 14061 }
id: l-c1ee39c2
scope: repo
status: active
replaces: l-52c0ff39
src: agent
touches:
  - routes/product-management/category/tree-columns.tsx
  - routes/product-management/category/tree-node.tsx
  - routes/product-management/category/category-component.tsx
---

## Decided
- 2026-11-13 ผู้ใช้สั่งจัดหน้า Category ตาม skill carmen-blue-ui-design แล้วสั่งต่อ: "add hilight row on select", "move action button to last of row" และหลังเห็นผล "move action button to right edge of card"
- แถวของต้นไม้เลือกสิ่งที่แสดงจากความกว้างของการ์ด ไม่ใช่ของจอ เพราะการ์ด = จอ − sidebar: จอ 1024 ที่ sidebar กางเหลือการ์ด 744px ของเดิมที่ใช้ breakpoint ของจอทำให้ชื่อทั้ง 134 แถวถูกบีบเหลือ 0px
- ช่องชื่อกว้างคงที่สูงสุดและไม่ยืด ค่าจึงอยู่ติดชื่อ ที่ว่างไปอยู่ท้ายแถว (ของเดิมค่าห่างจากชื่อ 987px ที่ Full HD, 2,907px ที่ 4K)
- คลิกส่วนไหนของแถวก็เลือกแถวนั้น ทีละแถว สีเดียวกับแถวที่เลือกของตารางทั่วไป
- ปุ่มของแถวอยู่ชิดขอบขวาของการ์ด หลังที่ว่างท้ายแถว ทุกขนาดจอ — ผู้ใช้สั่งเอง แม้ที่ 4K จะห่างจากข้อมูลราว 2,600px
- ปุ่มขึ้นค้างบนแถวที่เลือก (Claude เพิ่มเอง เพราะปุ่มอยู่ไกลจากชื่อ) ไฮไลต์ของแถวจึงเป็นสิ่งที่โยงปุ่มกลับไปหาชื่อ

## Tried and ruled out
- ปุ่มเป็นคอลัมน์ต่อจากจำนวนสินค้า (ติดกับข้อมูล): Claude ตีความ "last of row" แบบนี้ก่อน ผู้ใช้ไม่เอา สั่งย้ายไปขอบการ์ด
- ช่องชื่อ 20rem: ชื่อยาวสุดระดับ category ถูกตัดที่ tablet ทั้งที่มีที่เหลือ → ใช้ 22rem
- แบ่งต้นไม้เป็น 2 คอลัมน์บนจอกว้างมากเพื่อไม่ให้ท้ายแถวว่าง: ไม่ได้ทำ ลำดับหมวดอ่านยากขึ้นและสองฝั่งสูงไม่เท่ากันเมื่อกางทั้งหมด เสนอผู้ใช้ไว้แล้ว ยังไม่ได้คำตอบ

## Watch out
- หัวตารางกับแถวเป็น flex คนละกล่อง จะตรงกันก็ต่อเมื่อมีชิ้นชุดเดียวกันทุกชิ้น ทั้งชิ้นที่ไม่หดและชิ้นที่ยืด ลืมชิ้นเดียว (คอลัมน์จำนวนในหัวไม่ได้ใส่ shrink-0 · หัวไม่ได้จองที่คอลัมน์ปุ่ม) คอลัมน์จะเหลื่อมเฉพาะช่วงที่ช่องชื่อกำลังหด คือการ์ด ~896–1000px (จอ 1180) จอกว้างกว่านั้นดูปกติ จึงต้องวัดที่ 1180 ทุกครั้งที่เพิ่ม/ลดคอลัมน์
- มือถือ: ชื่อถูกตัด 38 แถว (เดิมก่อนงานนี้ 29) เหลืออย่างน้อย 97px เพราะคอลัมน์ปุ่มกว้างเท่ากันทุกระดับ
- ยังไม่ได้ตรวจ: คอลัมน์คำอธิบายและป้าย Inactive (BU ทดสอบไม่มีข้อมูล), ภาษาไทยหลังย้ายปุ่ม

In the code:
- routes/product-management/category/tree-columns.tsx — NAME_CELL (flex-[0_1_22rem]), META_COL, COL.actions, ขั้น @xl 576 / @4xl 896 / @7xl 1280, หัวตารางมี span flex-1 + span จองที่ปุ่ม
- routes/product-management/category/tree-node.tsx — ลำดับในแถว: ชื่อ · ค่า · จำนวน · ที่ว่าง/คำอธิบาย (flex-1) · ปุ่ม; data-state="selected" + bg-selected
- routes/product-management/category/category-component.tsx — @container ที่การ์ด, state selectedId
