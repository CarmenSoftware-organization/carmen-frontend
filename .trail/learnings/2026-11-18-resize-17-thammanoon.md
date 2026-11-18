---
title: "ลำดับคอลัมน์ใบขอซื้อ: ยอดเงินอยู่ก่อนแผนก และจำนวนแถวต่อหน้าไม่ขึ้นกับความสูงจอ (ต่างจากเรื่องความกว้าง/resize ของวันที่ 17)"
author: Thammanoon
date: 2026-11-18
branch: fix/pr-list-mobile-cards
cost: { minutes: 1, tokens: 2438 }
id: l-a295a2d6
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-request/use-pr-table.tsx
---

## Decided
2026-11-18 ผู้ใช้เลือกย้ายคอลัมน์ยอดเงิน (Amount) ไปไว้ก่อนแผนก (Department) ทุกขนาดจอ เพราะแผนกเป็นคอลัมน์ยืดรับที่เหลือ ที่ 4K (กล่อง 3558px) ยอดเงินที่อยู่ขวาสุดห่างจากข้อมูลอื่นราว 2,700px
กล่องกว้างมาก (≥1400 หลังหักช่องติ๊กและปุ่มแถว) ให้คอลัมน์ผู้ขอกว้าง 200px แทน 110px ชื่อเต็มไม่ถูกตัด

## Tried and ruled out
- คงยอดเงินไว้ขวาสุดแล้วพึ่งแถวสลับสีให้ไล่สายตา: ระยะ 2,700px ไล่ไม่ไหว
- ตั้งจำนวนแถวต่อหน้าตามความสูงจอ (4K ≈ 50 แถว) ทั้งที่ 10 แถวกินแค่ ~30% ของความสูง: ผู้ใช้ไม่เอา เพราะกระทบทุก list และ URL/saved view ที่แชร์กันจะได้ผลต่างกันตามจอ ผู้ใช้เปลี่ยนเองได้ที่ Rows

## Watch out
- คนที่คุ้นกับยอดเงินขวาสุดต้องปรับตา การส่งออก (export) ยังเรียงคอลัมน์แบบเดิม

In the code: routes/procurement/purchase-request/use-pr-table.tsx — บล็อก base_total_amount อยู่ก่อน department_name; columnTier() roomy: w >= 1400 → requestor_name size 200
