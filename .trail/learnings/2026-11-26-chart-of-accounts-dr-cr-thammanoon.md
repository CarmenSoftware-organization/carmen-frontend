---
title: "ตาราง Chart of Accounts อ่านแบบสมุดบัญชีแยกประเภท: Dr/Cr เป็นคอลัมน์ถัดรหัส ชื่อบรรทัดสองขึ้นเฉพาะเมื่อไม่ซ้ำ"
author: Thammanoon
date: 2026-11-26
branch: feature/coa-list-ledger-layout
cost: { minutes: 6, tokens: 193612 }
id: l-cb36dbdd
scope: repo
status: active
src: agent
touches:
  - messages/en.json
  - messages/th.json
  - routes/config/chart-of-accounts/coa-card.tsx
  - routes/config/chart-of-accounts/coa-guardrail.test.tsx
  - routes/config/chart-of-accounts/use-coa-table.test.tsx
  - routes/config/chart-of-accounts/use-coa-table.tsx
---

## Decided
- 2026-11-26 ผู้ใช้อนุมัติแนวทาง A–G จาก design direction ของหน้า Chart of Accounts: ด้านบัญชี (Dr/Cr) เป็นคอลัมน์ของตัวเองถัดจากรหัส ไม่ใช่ป้ายเล็กต่อท้ายหมวด, หมวดกับประเภทแยกคอลัมน์, "Not set" ใช้สีเตือนเหมือนการ์ด
- ข้อมูลนำเข้าเกือบทั้งหมดกรอก description_2 เหมือน description_1 (ทั้ง 10 แถวหน้าแรกบน T02) — แสดงบรรทัดสองเฉพาะเมื่อไม่ซ้ำ (trim + ไม่สนตัวพิมพ์) แถวเหลือบรรทัดเดียว
- คอลัมน์ Created/Updated ยังซ่อนไว้ก่อน เพราะหน้ารายการอื่น 35 หน้าซ่อนเหมือนกันหมด ถึงจอกว้าง 2318px คอลัมน์ชื่อจะยังกว้าง ~1100px ก็ยอม

## Tried and ruled out
- ทำ Active เป็นจุดจาง / Inactive เป็น badge เด่น: ชนกับกติกาทีม (ชิปสถานะเทา + จุดสีแบบเดียวทุกตาราง) ถ้าอยากได้ต้องแก้ที่ statusColumn กลาง
- จำกัดความกว้างคอลัมน์ชื่อ (max ~480px): คอลัมน์ grow ใน DataGrid คิดเป็น % ของที่เหลือ จำกัดไม่ได้โดยไม่แตะของกลาง — ใช้วิธีเพิ่มคอลัมน์จริงมาเติมแทน
- ตัว stat card KPI ของ COA: ไม่มีหน้าไหนใช้ และนับจากข้อมูลหน้าปัจจุบันเท่านั้น (ตัวเลขผิดถ้าเอากลับมา) จึงลบทิ้ง

## Watch out
- หัวคอลัมน์ "Debit / Credit" ต้องกว้าง 120px ที่ 90px ไอคอน sort ชนคอลัมน์ถัดไป
- ลำดับซ่อนเมื่อกล่องแคบ: กลุ่มบัญชี → ประเภท → หมวด (ตรวจแล้ว: กล่อง 1100px ซ่อนกลุ่ม, 780px เหลือรหัส/Dr-Cr/ชื่อ/สถานะ ไม่มีแถบเลื่อนแนวนอน)

In the code: routes/config/chart-of-accounts/use-coa-table.tsx (secondaryName, layout.secondary, nature column), coa-card.tsx, messages/*.json config.chartOfAccounts.natureShort
