---
title: "รายการสินค้าแบบการ์ดบนมือถือ/tablet ใช้คอมโพเนนต์กลางร่วมกันระหว่าง PR กับ PR Template โดยตั้ง column id ตามสัญญา"
author: Thammanoon
date: 2026-11-18
branch: feature/prt-header-pr-style
cost: { minutes: 5, tokens: 59976 }
id: l-50e5f785
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-request-template/prt-form-skeleton.tsx
  - routes/procurement/purchase-request-template/prt-form.test.tsx
  - routes/procurement/purchase-request-template/prt-form.tsx
  - routes/procurement/purchase-request-template/prt-general-fields.tsx
  - routes/procurement/purchase-request-template/prt-item-fields.tsx
  - routes/procurement/purchase-request-template/use-prt-item-table.tsx
  - routes/procurement/shared/item-cards.tsx
---

## Decided
- 2026-11-18 ผู้ใช้สั่งให้รายการสินค้าของ PR Template บนมือถือ + tablet เป็นการ์ดแถวละใบแบบ PR เกณฑ์เดียวกับ PR: กล่อง < 900px = การ์ด (วัดกล่อง ไม่ใช่จอ — กาง sidebar ที่จอ ~1170 กล่อง ~860 ก็เป็นการ์ด)
- ไม่ copy การ์ดของ PR แต่ยกขึ้นเป็นคอมโพเนนต์กลางของโมดูล procurement ที่รับ table ชนิดใดก็ได้ แต่ละหน้าส่งป้ายช่อง (column id → คีย์ใต้ `field`) และจำนวนคอลัมน์ของตัวเอง
- PR Template มี 4 ช่อง จึงให้เรียงแถวเดียวตั้งแต่การ์ดกว้าง @xl (~576px, tablet) แทนค่าเริ่มต้นของ PR (@md 3 / @2xl 4) ที่ทำให้ Delivery Point ตกไปโดด ๆ แถวสอง

## Watch out
- การ์ดอ่าน column id ตามสัญญา: `index` + `product_id` อยู่หัวการ์ด, `select`/`action` (ถ้ามี) อยู่หัว, ที่เหลือเป็นช่องในกริด — ตารางใหม่ที่จะใช้การ์ดต้องตั้ง id ตามนี้ ไม่งั้นชื่อสินค้าไปอยู่ในกริด
- ค่าที่มาจาก lookup โหมดอ่าน (FieldPlainText มี min-h-8) ลอยต่ำกว่าค่าข้อความธรรมดาครึ่งบรรทัด การ์ดล้าง min-h ใน dd แล้ว — ในตารางยังต้องคง min-h ไว้ให้แถวตรงกัน
- selector หาแถวแรกตอนเพิ่มรายการของ PR เปลี่ยนจาก data-pr-item-card เป็น data-item-card
- โหมดแก้ ชื่อคลังในการ์ดถูกตัด ("A&G-Accou…") ที่ช่องกว้าง 1/3–1/4 ของการ์ด ยังไม่ได้แก้ (ทางเลือก: Location เต็มแถวในโหมดแก้ แลกกับการ์ดสูงขึ้นหนึ่งแถว)

In the code: routes/procurement/shared/item-cards.tsx (ItemCards, labelKeys, columnsClassName; ย้ายมาจาก purchase-request/pr-item-cards.tsx) · purchase-request/pr-item-fields.tsx (PR_ITEM_CARD_LABELS, ITEM_CARDS_MAX_WIDTH = 900) · purchase-request-template/prt-item-fields.tsx (PRT_ITEM_CARD_LABELS, ITEM_CARDS_MAX_WIDTH = 900, columnsClassName="@xl:grid-cols-4")
