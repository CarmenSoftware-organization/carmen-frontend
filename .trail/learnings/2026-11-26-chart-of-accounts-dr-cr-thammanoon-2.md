---
title: "ตาราง Chart of Accounts: Dr/Cr เป็นคอลัมน์ของตัวเองหลังชื่อบัญชี ชื่อบรรทัดสองขึ้นเฉพาะเมื่อไม่ซ้ำ"
author: Thammanoon
date: 2026-11-26
branch: feature/coa-list-ledger-layout
cost: { minutes: 3, tokens: 41844 }
id: l-c495a5d1
scope: repo
status: active
replaces: l-cb36dbdd
src: agent
touches:
  - routes/config/chart-of-accounts/use-coa-table.tsx
---

## Decided
- 2026-11-26 ผู้ใช้อนุมัติแนวทาง A–G จาก design direction ของหน้า Chart of Accounts: ด้านบัญชี (Dr/Cr) เป็นคอลัมน์ของตัวเอง ไม่ใช่ป้ายเล็กต่อท้ายหมวด, หมวดกับประเภทแยกคอลัมน์, "Not set" ใช้สีเตือนเหมือนการ์ด
- ลำดับคอลัมน์: รหัส → ชื่อบัญชี → Dr/Cr → หมวด → ประเภท → กลุ่ม → สถานะ ผู้ใช้สั่งย้าย Dr/Cr จากถัดรหัสมาไว้หลังชื่อบัญชี (26 พ.ย.)
- ข้อมูลนำเข้าเกือบทั้งหมดกรอก description_2 เหมือน description_1 — แสดงบรรทัดสองเฉพาะเมื่อไม่ซ้ำ (trim + ไม่สนตัวพิมพ์) แถวเหลือบรรทัดเดียว (44px ทุกแถว ทั้งไทยและอังกฤษ)
- คอลัมน์ Created/Updated ยังซ่อนไว้ก่อน เพราะหน้ารายการอื่น 35 หน้าซ่อนเหมือนกันหมด จอ 4K คอลัมน์ชื่อจึงยืด ~2600px — ยอมตามกฎ grow คอลัมน์ข้อความยาว

## Tried and ruled out
- Dr/Cr ถัดจากรหัส (แบบสมุดบัญชีแยกประเภท): ผู้ใช้ย้ายไปหลังชื่อบัญชี
- ทำ Active เป็นจุดจาง / Inactive เป็น badge เด่น: ชนกับกติกาทีม (ชิปสถานะเทา + จุดสีแบบเดียวทุกตาราง) ถ้าอยากได้ต้องแก้ที่ statusColumn กลาง
- จำกัดความกว้างคอลัมน์ชื่อ: grow ใน DataGrid คิดเป็น % ของที่เหลือ จำกัดไม่ได้โดยไม่แตะของกลาง
- stat card KPI ของ COA: ไม่มีหน้าไหนใช้ และนับจากข้อมูลหน้าปัจจุบันเท่านั้น จึงลบทิ้ง

## Watch out
- ขนาดอิงคำแปลไทยที่ยาวสุด (รวม padding 24): หมวด 156 ("ส่วนของเจ้าของ (Equity)" 149) · ประเภท 180 ("Header (หัวข้อ - ไม่ลงรายการ)" พอดี 180) · หัว "Debit / Credit" ต้อง 120 (90 แล้วไอคอน sort ชน) ย่อกว่านี้ภาษาไทยขึ้นสองบรรทัด
- ลำดับซ่อนเมื่อกล่องแคบ: กลุ่ม → ประเภท → หมวด วัดแล้ว: 768 (662) เหลือแกน · 1024 ไม่มีหมวด · 1024 พับ sidebar มีหมวด · 1366 ไม่มีกลุ่ม · 1366 พับ / 1920+ ครบ ไม่มี hscroll ทุกขนาด

In the code: routes/config/chart-of-accounts/use-coa-table.tsx (secondaryName, layout.widths/secondary, nature column), coa-card.tsx, messages/*.json config.chartOfAccounts.natureShort
