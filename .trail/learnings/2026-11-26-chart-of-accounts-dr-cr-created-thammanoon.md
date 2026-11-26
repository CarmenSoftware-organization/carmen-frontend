---
title: "ตาราง Chart of Accounts: Dr/Cr หลังชื่อบัญชี ชื่อบรรทัดสองขึ้นเฉพาะเมื่อไม่ซ้ำ และ Created/Updated ขึ้นเองเฉพาะกล่องกว้างมาก"
author: Thammanoon
date: 2026-11-26
branch: feature/coa-list-ledger-layout
cost: { minutes: 4, tokens: 35200 }
id: l-3292cdeb
scope: repo
status: active
replaces: l-c495a5d1
src: agent
touches:
  - routes/config/shared/use-config-list-table.ts
  - routes/config/chart-of-accounts/use-coa-table.tsx
---

## Decided
- 2026-11-26 ผู้ใช้อนุมัติแนวทาง A–G ของหน้า Chart of Accounts: Dr/Cr เป็นคอลัมน์ของตัวเอง, หมวดกับประเภทแยกคอลัมน์, "Not set" ใช้สีเตือนเหมือนการ์ด
- ลำดับคอลัมน์: รหัส → ชื่อบัญชี → Dr/Cr → หมวด → ประเภท → กลุ่ม → สถานะ (ผู้ใช้สั่งย้าย Dr/Cr จากถัดรหัสมาไว้หลังชื่อ)
- description_2 ของข้อมูลนำเข้าเกือบทั้งหมดซ้ำกับ description_1 — แสดงบรรทัดสองเฉพาะเมื่อไม่ซ้ำ แถวเหลือ 44px
- ผู้ใช้สั่งแก้ที่คอลัมน์ชื่อยืดเป็นพัน px บนจอใหญ่: Created/Updated ซ่อนไว้ก่อนเหมือนทุกหน้ารายการ แต่ขึ้นเองเมื่อกล่องกว้างพอที่ชื่อยังเหลือ ≥ 480px (กล่อง ≥ 1799: 1920 พับ sidebar, QHD, 4K) ผู้ใช้เปิด/ปิดเองจากเมนูคอลัมน์แล้วจะยึดค่าผู้ใช้
- การ์ดมือถือแสดงด้านบัญชีเป็นคำเต็ม (เดบิต/เครดิต) อย่างเดียว ตัวย่อ Dr/Cr ใช้ในตารางเท่านั้น

## Tried and ruled out
- Dr/Cr ถัดจากรหัส: ผู้ใช้ย้ายไปหลังชื่อบัญชี
- Active จาง / Inactive เด่น: ชนกับกติกาทีมเรื่องชิปสถานะแบบเดียวทุกตาราง
- จำกัดความกว้างคอลัมน์ชื่อ: grow ใน DataGrid เป็น % ของที่เหลือ ใช้วิธีเติมคอลัมน์แทน
- stat card KPI ของ COA: ไม่มีหน้าไหนใช้ นับเฉพาะหน้าปัจจุบัน จึงลบ

## Watch out
- ตัวเลือก extra ใน layout กลางต้องปิดคอลัมน์ extra ก่อนลูปซ่อน secondary ไม่งั้นความกว้าง audit 320 ถูกนับ ทำให้หมวดหายที่ 1180/1280 ทั้งที่พอ และต้องไม่แสดงตอนยังวัดกล่องไม่ได้ (Infinity) ไม่งั้นโผล่แวบแรก
- 4K ชื่อยังยืด ~2300px แม้มี audit แล้ว — เนื้อหาไม่พอเติมจอ ไม่ใช่บั๊ก
- ขนาดอิงคำแปลไทยยาวสุด (รวม padding 24): หมวด 156 · ประเภท 180 · หัว Debit / Credit 120
- วัดแล้ว (ไม่มี hscroll): 768 แกน · 1024 แกน · 1180/1280 + หมวด · 1366 + ประเภท · 1366 พับ/1920 ครบ · 1920 พับ/2318/3840 + Created/Updated · ปรับกล่องสด 900→1280→2600→1920 สลับถูก

In the code: routes/config/shared/use-config-list-table.ts (ConfigTableLayout.extra), routes/config/chart-of-accounts/use-coa-table.tsx (secondaryName, layout), coa-card.tsx
