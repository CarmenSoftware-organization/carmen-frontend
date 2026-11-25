---
title: "วันที่ของ dimension ใช้รูปแบบวันที่จากโปรไฟล์ ไม่มีรูปแบบแยกราย dimension แล้ว"
author: Thammanoon
date: 2026-11-25
branch: fix/dimension-edit-dialog
cost: { minutes: 1, tokens: 1981 }
id: l-76db008d
scope: repo
status: active
src: agent
touches:
  - types/accounting-master.ts
  - lib/dimension-value.ts
  - hooks/use-dimension-value-formatter.ts
  - components/dimension/dimension-value-input.tsx
  - docs/superpowers/plans/2026-11-25-dimension-edit-dialog.md
---

## Decided
2026-11-25 ผู้ใช้สั่งตัดช่อง Date Format ของ dimension ชนิด date ออก และเลิกใช้ค่านี้ทั้งระบบ
วันที่ของ dimension (ช่องกรอกในบรรทัด JV/AR และข้อความแสดงผล) ใช้รูปแบบวันที่จากโปรไฟล์ เหมือนช่องวันที่อื่นทั้งแอป
ค่าที่เก็บยังเป็น YYYY-MM-DD; BE และคอลัมน์ใน DB ไม่ได้แตะ ค่าเดิมค้างอยู่แต่ไม่มีใครอ่าน

## Tried and ruled out
ซ่อนช่องใน dialog อย่างเดียว: dimension เก่าที่เคยตั้งรูปแบบไว้จะยังใช้รูปแบบนั้นต่อ แต่ไม่มีใครเห็นหรือแก้ได้ ผลลัพธ์จึงต่างกันตามว่า dimension นั้นสร้างเมื่อไร

## Watch out
อย่าเอา date_format ของ dimension กลับมาอ่านอีก เพราะ BE ยังส่งค่าเก่ามาใน response
date_format ของ BU config (useProfile) เป็นคนละตัว และยังใช้อยู่

In the code: types/accounting-master.ts (DimensionMaster), lib/dimension-value.ts (formatDimensionValue, labels.formatDate), hooks/use-dimension-value-formatter.ts, components/dimension/dimension-value-input.tsx (DateInput ไม่ส่ง displayFormat). แผน: docs/superpowers/plans/2026-11-25-dimension-edit-dialog.md Task 1
