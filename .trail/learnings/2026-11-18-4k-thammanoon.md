---
title: "ตารางใบสั่งซื้อ: ผู้ขายอยู่ต่อจากเลขที่เสมอ ไม่ย้ายไปท้ายแม้จอ 4K"
author: Thammanoon
date: 2026-11-18
branch: fix/po-list-4k
cost: { minutes: 1, tokens: 6181 }
id: l-b3dd6cc6
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-order/use-po-table.tsx
---

## Decided
2026-11-18 ผู้ใช้สั่ง "vendor ต่อ PO no เหมือนเดิม": คอลัมน์ผู้ขายต้องอยู่ถัดจากเลขที่ PO ทุกขนาดจอ แม้ที่ 4K ผู้ขาย (คอลัมน์ยืด) จะกว้าง ~2,600px แล้วผู้จัดซื้อ วันที่ สถานะ ยอดเงิน ไปอยู่ขวาสุด
สิ่งที่ทำได้: กล่อง ≥1400px (รวมช่องติ๊ก 55 ที่ไม่ได้แสดง) ผู้จัดซื้อกว้าง 90→200px ชื่อเต็มไม่ถูกตัด

## Tried and ruled out
- ย้ายผู้ขายไปเป็นคอลัมน์ท้ายเฉพาะกล่องกว้างมาก (แบบที่ PR ย้ายยอดเงินไปก่อนแผนก): ทำแล้ว ผู้ใช้สั่งถอยกลับ ผู้ขายต้องติดเลขที่
- ย้ายผู้ขายไปท้ายทุกขนาด: ที่ tablet ผู้ขายไปอยู่หลังยอดเงิน

## Watch out
- ระยะห่างที่ 4K ยังอยู่ ถ้าจะแก้ต้องหาทางอื่นที่ไม่ขยับผู้ขาย (เช่นให้คอลัมน์อื่นยืดแทน) และถามผู้ใช้ก่อน

In the code: routes/procurement/purchase-order/use-po-table.tsx columnTier() roomy: w >= 1400 → created_by size 200
