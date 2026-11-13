---
title: "ต้นไม้หมวดหมู่สินค้า: เลือกสิ่งที่แสดงจากความกว้างการ์ด ค่าอยู่ติดชื่อ คลิกแถวเพื่อไฮไลต์ และปุ่มของแถวอยู่ท้ายแถว"
author: Thammanoon
date: 2026-11-13
branch: fix/category-tree-box-width
cost: { minutes: 17, tokens: 334871 }
id: l-52c0ff39
scope: repo
status: active
src: agent
touches:
  - routes/product-management/category/category-component.tsx
  - routes/product-management/category/tree-columns.tsx
  - routes/product-management/category/tree-content.tsx
  - routes/product-management/category/tree-node.tsx
---

## Decided
- 2026-11-13 ผู้ใช้สั่งจัดหน้า Category ตาม skill carmen-blue-ui-design แล้วสั่งต่ออีกสองอย่าง: "add hilight row on select" และ "move action button to last of row"
- แถวของต้นไม้เลือกสิ่งที่แสดงจากความกว้างของการ์ด ไม่ใช่ของจอ เพราะการ์ด = จอ − sidebar: จอ 1024 ที่ sidebar กางเหลือการ์ด 744px ของเดิมที่ใช้ breakpoint ของจอทำให้ชื่อทั้ง 134 แถวถูกบีบเหลือ 0px
- ช่องชื่อกว้างคงที่สูงสุดและไม่ยืด ค่าจึงอยู่ติดชื่อ ที่ว่างไปอยู่ท้ายแถว (ของเดิมค่าห่างจากชื่อ 987px ที่ Full HD, 2,907px ที่ 4K)
- คลิกส่วนไหนของแถวก็เลือกแถวนั้น ทีละแถว สีเดียวกับแถวที่เลือกของตารางทั่วไป
- ปุ่มของแถวเป็นคอลัมน์สุดท้าย ต่อจากจำนวนสินค้า ไม่ใช่สุดขอบขวาของการ์ด — ข้อนี้เป็นการตีความของ Claude ว่า "last of row" คือคอลัมน์สุดท้ายของข้อมูล ผู้ใช้ยังไม่ได้ยืนยัน (ที่ 4K ขอบการ์ดอยู่ห่างออกไปราว 2,600px)
- ปุ่มขึ้นค้างบนแถวที่เลือก (Claude เพิ่มเอง เพราะปุ่มอยู่ไกลจากชื่อแล้ว)

## Tried and ruled out
- ช่องชื่อ 20rem: ชื่อยาวสุดระดับ category ถูกตัดที่ tablet ทั้งที่มีที่เหลือ → ใช้ 22rem
- แบ่งต้นไม้เป็น 2 คอลัมน์บนจอกว้างมากเพื่อไม่ให้ท้ายแถวว่าง: ไม่ได้ทำ ลำดับหมวดอ่านยากขึ้นและสองฝั่งสูงไม่เท่ากันเมื่อกางทั้งหมด เสนอผู้ใช้ไว้แล้ว ยังไม่ได้คำตอบ

## Watch out
- หัวตารางกับแถวเป็น flex คนละกล่อง จะตรงกันก็ต่อเมื่อมีชิ้นที่ "ไม่หด" ชุดเดียวกันทุกชิ้น ลืมชิ้นเดียว (คอลัมน์จำนวนในหัวไม่ได้ใส่ shrink-0 · หัวไม่ได้จองที่คอลัมน์ปุ่ม) คอลัมน์จะเหลื่อมเฉพาะช่วงที่ช่องชื่อกำลังหด คือการ์ด ~896–1000px (จอ 1180) จอกว้างกว่านั้นดูปกติ จึงต้องวัดที่ 1180 ทุกครั้งที่เพิ่ม/ลดคอลัมน์
- มือถือ: ชื่อถูกตัดเพิ่มจาก 29 เป็น 38 แถว (เหลืออย่างน้อย 97px) เพราะคอลัมน์ปุ่มกว้างเท่ากันทุกระดับ
- ยังไม่ได้ตรวจ: คอลัมน์คำอธิบายและป้าย Inactive (BU ทดสอบไม่มีข้อมูล), dark mode และภาษาไทยหลังย้ายปุ่ม

In the code:
- routes/product-management/category/tree-columns.tsx — NAME_CELL (flex-[0_1_22rem]), META_COL, COL.actions, ขั้น @xl 576 / @4xl 896 / @7xl 1280
- routes/product-management/category/tree-node.tsx — data-state="selected" + bg-selected, onClick ที่แถว
- routes/product-management/category/category-component.tsx — @container ที่การ์ด, state selectedId
