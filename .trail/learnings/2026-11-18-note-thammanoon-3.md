---
title: "หน้าหมวดหมู่สินค้าบนจอกว้าง: ใช้ที่ว่างข้างต้นไม้เป็นแผงรายละเอียดของแถวที่เลือก ไม่แบ่งต้นไม้เป็นหลายคอลัมน์"
author: Thammanoon
date: 2026-11-18
branch: feature/category-detail-panel
cost: { minutes: 7, tokens: 181087 }
id: l-f5b4f686
scope: repo
status: active
src: agent
touches:
  - routes/product-management/category/category-detail-panel.tsx
  - routes/product-management/category/category-component.tsx
---

## Decided
- 2026-11-18 วัด 5 ขนาดแล้ว Full HD ต้นไม้ใช้ 976 จากการ์ด 1640px และ 4K ใช้ราว ¼ ของการ์ด ผู้ใช้เลือก "แผงรายละเอียดข้าง" จาก 3 ทาง (แผงข้าง / แบ่งต้นไม้หลายคอลัมน์ / ปล่อยไว้)
- แผงขึ้นเมื่อกล่องของหน้ากว้าง ≥ 1408px (วัดกล่อง ไม่ใช่จอ) ต้นไม้กว้างไม่เกิน 62rem ที่เหลือเป็นของแผง HD 1366, tablet และมือถือยังเป็นแบบเดิม
- แผงไม่ mount เมื่อกล่องแคบ (ใช้ useElementWidth ไม่ใช่ซ่อนด้วย CSS) จึงไม่ยิง GET รายตัวเพื่อเอา account_codes บนจอแคบ
- ยังไม่เลือกแถว = ภาพรวม (จำนวนหมวด/หมวดย่อย/กลุ่ม/สินค้า) · คลิกรายการย่อยหรือ path ในแผง = เลือกแถวนั้นและกางบรรพบุรุษในต้นไม้

## Tried and ruled out
- แบ่งต้นไม้เป็นหลายคอลัมน์: Full HD ยังได้แค่ 1 คอลัมน์ (แถวเต็มกว้าง ~976px) จึงแก้ได้แค่ 4K ผู้ใช้ไม่เลือก

## Watch out
- กล่องเลื่อนของต้นไม้กับของแผงต้องใช้ความสูงชุดเดียวกัน การ์ดสองใบจึงสูงเท่ากัน
- section ในแผงต้องเป็น frameless ไม่งั้นเป็นการ์ดซ้อนในการ์ด

In the code:
- routes/product-management/category/category-detail-panel.tsx — CategoryDetailPanel, InheritField
- routes/product-management/category/category-component.tsx — DETAIL_PANEL_MIN_WIDTH 1408, TREE_SCROLL_HEIGHT, findWithAncestors, selectFromPanel
