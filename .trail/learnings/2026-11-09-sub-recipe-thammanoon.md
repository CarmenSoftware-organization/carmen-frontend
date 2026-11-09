---
title: Sub-recipe เป็นวัตถุดิบ
author: Thammanoon
date: 2026-11-09
id: l-cec1ec27
scope: repo
status: active
touches:
  - "hooks/use-lookup-resource.ts#useLookupResource"
---

## Decided
สูตรใช้สูตรอื่นเป็นวัตถุดิบ (ข้าวผัดหมู = ข้าวผัด 1 จาน + หมู) — spec/plan ใน FE `docs/superpowers/{specs,plans}/2026-10-19-recipe-sub-recipe-ingredient*`
สถานะ 19 ต.ค.: **merge แล้ว BE #867 (3ea051021) + FE #372 (b22b92e4) ยังไม่ deploy**; branch/worktree ลบแล้ว
ตรวจมือบน dev T02 ผ่าน 5 ข้อ (ต้นทุน, ไม่ขยับเอง, สูตรวน, บล็อก+รายชื่อ, cook view ลิงก์) — ยังไม่ตรวจ 375px / dark mode
ค้าง: แท็บฟอร์มสูตรที่มีแถวสูตรยังไม่บันทึก ค้าง (main thread) หลังทิ้งไว้ ~50 นาที ครั้งเดียว ทำซ้ำในแท็บใหม่ไม่ได้ — ถ้ามีคนเจออีก เริ่มจาก token refresh/refetch ชนแถวสูตร

**Why:** การตัดสินใจของ user ที่ห้ามถอย — ต้นทุนบรรทัดสูตรใช้ snapshot เหมือนสินค้า ไม่ cascade (ต้องกด "คำนวณใหม่"); ปริมาณเป็นหน่วยผลผลิตของสูตรฐาน; cook view บรรทัดเดียว+ลิงก์; ลบ/ปิด/archive/เปลี่ยนหน่วยผลผลิตของสูตรที่ถูกใช้ = บล็อก+รายชื่อเมนู

## Watch out
deploy BE ก่อน FE (FE ก่อน = `useLookupResource` throw เพราะ LOOKUP_EXTRA_FIELDS.recipe), build `packages/error-catalog` dist, rollback ต้องเป็นคู่; ไม่มี migration/api_name ใหม่แต่ต้องเช็กคอลัมน์ `ingredient_type`/`sub_recipe_id` ทุก BU บน UAT/prod
กับดัก: lookup extra ชื่อ `status` ถูก core status ทับเงียบ ๆ → ใช้ `recipe_status`; ข้อความ catalog >160 ตัวอักษร FE ตกไปข้อความกลาง → ต้องมี `errors.byCode.<CODE>`; CORS local รับแค่ :3000 — FE worktree ที่พอร์ตอื่นต้องใช้ BACKEND_URL "" + VITE_DEV_PROXY_TARGET

_From Claude Code's memory of this repo, last updated Oct 19._
