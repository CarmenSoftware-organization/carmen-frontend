---
title: "Cuisine Type redesign (tag input, Info key/value, region dots, recipe_count)"
author: Thammanoon
date: 2026-11-09
id: l-435fa684
scope: repo
status: active
touches:
  - components/ui/tag-input.tsx
  - "lib/form-helpers.ts#keyValuesToObject"
---

## Decided
FE #366 + BE #865 merge แล้ว 19 ต.ค. 2026 (merge commit) **ยังไม่ deploy** — ขึ้นก่อนหลังได้ทั้งคู่ (FE แสดง "—" จนกว่า BE ส่ง `recipe_count`)

- ยังไม่เคยกด Save บนหน้า Cuisine หลังเปลี่ยน schema (DB dev ใช้ร่วม) — ข้อความ error หัวข้อ Info ซ้ำยังไม่เคยเห็นบนจอ, ยังไม่ดู 375px
- `components/ui/tag-input.tsx` เป็น primitive ใหม่ ยังไม่อยู่ในหน้า `/design-system`
- `keyValuesToObject` ตอนนี้ JSON.parse ค่าที่ขึ้นต้นด้วย `{`/`[` — กระทบทุกที่ที่เรียก helper นี้

**Why:** งานค้างที่ต้องตามไป deploy/ตรวจมือ

## Watch out
ก่อนบอกว่าหน้า Cuisine "เสร็จ" ให้กด Save จริงหนึ่งครั้งและ deploy ทั้งคู่; ตาราง DataGrid ที่ใส่ inline-flex ต้องมี data-slot (ดู vendor-rating-tax-fields)

_From Claude Code's memory of this repo, last updated Oct 18._
