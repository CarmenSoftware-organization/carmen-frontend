---
title: "รายการสูตรอาหาร: สถานะสูตรเป็นคอลัมน์ของตัวเองชื่อ Lifecycle และการ์ดให้ภาพปกนำ"
author: Thammanoon
date: 2026-11-19
branch: feature/recipe-list-tablet-image-cards
cost: { minutes: 1, tokens: 2614 }
id: l-1a7656a6
scope: repo
status: active
src: agent
touches:
  - routes/operation-plan/recipe/use-recipe-table.tsx
  - routes/operation-plan/recipe/recipe-card.tsx
  - components/share/list-card.tsx
---

## Decided
2026-11-19 ผู้ใช้สั่งสองอย่างบนหน้ารายการสูตรอาหาร
- แยกสถานะสูตร (Draft/Published/Archived) ออกจากช่องชื่อเป็นคอลัมน์ของตัวเอง หัวคอลัมน์ใช้คำแปล lifecycle ("Lifecycle" / "สถานะสูตร") เพราะคอลัมน์ "Status" ท้ายตารางคือ Active ซึ่งเป็นคนละเรื่อง
- การ์ดเน้นรูปภาพ: ภาพปก 4:3 เต็มกว้างบนสุด ชิปสถานะทับมุมภาพ แล้วตามด้วยชื่อ เมตา และแถบตัวเลขราคาขาย/ต้นทุน/food cost

## Watch out
- กล่องตารางที่ iPad (742 / 662px) ใส่คอลัมน์ Lifecycle ไม่ได้ ถ้าไม่ตัด Selling Price ออก ขั้นแคบจึงให้ชิปกลับไปอยู่ข้างชื่อ ถ้าเปลี่ยน size คอลัมน์ใด ต้องคำนวณผลรวมและจุดเปลี่ยนในคอมเมนต์เหนือ columnTier ใหม่
- ป้ายบนภาพต้องใส่พื้นทึบที่ตัวชิปเอง ถ้าห่ออีกชั้น จะดูเป็นชิปซ้อนชิป
- ป้ายในแถบตัวเลขของการ์ดห้าม truncate: การ์ด 262px ที่ 1366 ตัด "Cost per Portion" เหลือ "Cost per P…" จึงให้ขึ้นบรรทัดใหม่แทน

In the code:
- routes/operation-plan/recipe/use-recipe-table.tsx `columnTier` (showLifecycle ≥868)
- routes/operation-plan/recipe/recipe-card.tsx `ON_PHOTO`, `RECIPE_CARD_GRID`, `RecipeCardSkeletonGrid`
- components/share/list-card.tsx prop `media`
