---
title: "ชื่อ relation field ใน Prisma schema กลายเป็น key ใน JSON response ตรง ๆ"
author: Thammanoon
date: 2026-11-09
id: l-c4122c82
scope: repo
status: active
touches:
  - "components/navbar/font-scale-switch.tsx#FontScaleSwitch.select"
---

## Decided
ชื่อ **relation field** ใน `schema.prisma` โผล่เป็น key ใน JSON ที่ gateway ส่งออกไปตรง ๆ
เพราะ service ใช้ `include`/`select` แล้วส่ง object นั้นกลับทั้งก้อน การเปลี่ยนชื่อ model
(ซึ่งลากชื่อ relation field เปลี่ยนตาม) จึงเป็น **breaking API change** ทั้งที่ `bunx tsc --noEmit`
ฝั่ง backend เขียวสนิท

เคสจริง (16 ก.ย. 2026, rename Period → Inventory Period): `tb_period` → `tb_inventory_period`
ทำให้ payload ของ `GET /api/{bu}/physical-count-periods{,/:id,/current}` เปลี่ยน key จาก
`tb_period` → `tb_inventory_period` ซึ่งมีคนอ่านอยู่ 2 ราย —
`carmen-inventory-mobile/src/lib/api/physical-count.ts` และ
`carmen-inventory-frontend-react/routes/inventory-management/physical-count/pc-component.tsx`
**mobile ที่ผู้ใช้ติดตั้งไว้แล้วจะพังทันที** เพราะอัปเดตตามไม่ได้ทันที

**Why:** เส้นทางเหล่านี้ไม่มี DTO/serializer คั่นระหว่างผลลัพธ์ Prisma กับ HTTP response
ชื่อใน schema จึงกลายเป็นสัญญากับ client โดยไม่มีใครตั้งใจให้เป็น (ตรงข้ามกับเส้นที่มี
`@Serialize` ซึ่งกลับมีปัญหาอีกแบบใน backend-add-field-serializer-gotcha)

## Watch out
ก่อนเปลี่ยนชื่อ model หรือ relation field ใด ๆ ให้ค้นข้ามรีโปเสมอ
`grep -rn "<ชื่อ field>" carmen-inventory-mobile carmen-inventory-frontend-react`
ถ้ามีคนอ่าน ต้องเลือกจงใจระหว่าง (ก) คงชื่อ field เดิมไว้ทั้งที่ model เปลี่ยน — Prisma
อนุญาตให้ชื่อ field ต่างจากชื่อ model (ข) เปลี่ยนแล้วแก้ consumer + deploy เรียงลำดับ
(ค) ส่งควบสองคีย์ชั่วคราว · ดูคู่กับ gateway-strips-raw-audit-fields

_From Claude Code's memory of this repo, last updated Sep 16._
