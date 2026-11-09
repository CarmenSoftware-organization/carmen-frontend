---
title: "PR #332 (BE) + #106 (FE) merged เข้า main แล้ว ยังไม่ deploy และ endpoint…"
author: Thammanoon
date: 2026-11-09
id: l-39566c0f
scope: repo
status: active
touches:
  - routes/system-admin/document/document-summary-bar.tsx
  - "scripts/bump.ts#main"
  - "scripts/gen-widget-docs.ts#main"
---

## Decided
แถบสรุปขนาดไฟล์แนบรวมของ BU เหนือตารางหน้า `/system-admin/document` + Sheet แจกแจงตาม
`reference_type` — **merge เข้า `main` ทั้งสองรีโปแล้ว (2026-08-13) ยังไม่ deploy**

- BE `carmen-turborepo-backend-v2#332` → merge commit `50f46ee4f` —
  `files.summary` (micro-file) + `GET /api/:bu_code/documents/summary` (gateway)
- FE `carmen-inventory-frontend-react#106` → merge commit `5c1694e`
- branch ลบหมดแล้วทั้ง local และ remote · spec + plan อยู่ใน `docs/superpowers/` ของรีโป FE

**deploy backend ก่อน frontend เสมอ** และก่อน deploy frontend ต้องเคลียร์เรื่อง allowlist —
ดู new-api-name-401-logs-users-out ว่าทำไมการลืมแถว `documents.summary` ไม่ใช่แค่ฟีเจอร์
ไม่ขึ้น แต่เด้ง user ออกหน้า login และ local-backend-is-shared-dev-db ว่าทำไมไม่ให้ agent
เขียนแถวนั้นเอง

**สิ่งที่ยังไม่เคยตรวจเลย:** endpoint นี้ **ไม่เคยถูกยิงจริงสักครั้ง** ไม่มีทั้ง curl และ browser
check ทั้ง 11 ข้อ ติดที่ต้องมีแถว allowlist ในฐานข้อมูลที่ใช้ร่วมกัน

**Why:** static check เขียวหมดตอน merge (FE 842/842, BE check-types ทั้งสอง app, CI ผ่าน)
แต่ความถูกต้องของตัวเลขจริงยังไม่มีอะไรพิสูจน์ — ไม่มีเทสต์ไหนแตะ `$queryRaw` กับ Postgres จริง
การที่ `Prisma.sql` type-check ผ่านไม่ได้พิสูจน์ว่าคิวรีรันได้

## Watch out
ตรวจอันดับแรกหลังมีแถว allowlist — (1) curl แล้วดูว่า `data.total_size`
เป็น JSON **number** ไม่ใช่ string/null (เคลียร์ทั้ง BigInt, raw SQL, envelope ในนัดเดียว)
(2) เทียบกับ `SELECT count(*), sum(size) FROM <schema>.tb_file_tag WHERE bu_code='<BU>'
AND deleted_at IS NULL` — ไม่มีอย่างอื่นพิสูจน์ตัวเลข

**ค้างไว้ 1 อย่างบน main:** JSDoc ของ `routes/system-admin/document/document-summary-bar.tsx`
(~บรรทัด 19-21) ยังเขียนข้อความเท็จชุดเดิมว่า 401 จาก allowlist จะซ่อนแถบเงียบ ๆ — แก้ใน spec
แล้วแต่ JSDoc ตกค้าง merge ติดเข้าไปด้วย เป็นงานแก้ 3 บรรทัด
…

_From Claude Code's memory of this repo, last updated Aug 12._
