---
title: "สูตรอาหาร 4 ช่วง"
author: Thammanoon
date: 2026-11-09
id: l-b695434f
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-10-16-recipe-cook-mode-costing-design.md
  - "hooks/use-navigation-guard.ts#useNavigationGuard.back"
---

## Decided
Design: `docs/superpowers/specs/2026-10-16-recipe-cook-mode-costing-design.md` (FE repo) — 4 ช่วง:
1. เพดาน food cost + Price Recommendations + plating/storage notes — **merge แล้ว 2026-10-16: BE #841, FE #338** ยังไม่ deploy; dev DB migrate แล้ว (user รันเอง) UAT/prod ยัง
2. ขั้นตอนทำในฟอร์ม + โหมดทำอาหาร (route `/:id` = cook view, ฟอร์มย้ายไป `/:id/edit`) — **merge แล้ว 2026-10-16: FE #339 + BE #842** ยังไม่ deploy; api_name preparation-steps 5 ตัวผ่าน guard บน dev แล้ว **UAT/prod ต้องเช็ก allowlist**
3–4. วัตถุดิบบันทึกจริง + คำนวณใหม่ + เช็กลิสต์ cook view — **merge แล้ว 2026-10-16: BE #843 (deploy ก่อน) + FE #340** ยังไม่ deploy; api_name `recipe.previewIngredientCosts` / `recipe.replaceIngredients` ต้องเช็ก allowlist UAT/prod; follow-up ปิดแล้วใน BE #844 + FE #341 (merge 16 ต.ค., ยังไม่ deploy): units/ingredient คิด to/from + กรอง deleted_at, ห้ามสินค้า inactive เป็นบรรทัดใหม่, ฟอร์มไม่ dirty ปลอม (ฟิลด์ derived เขียนด้วย resetField), เมนู ⋯ Edit · ยังค้าง: getAvailableUnitByProductId บั๊กเดียวกัน

**Why:** เชฟเปิดบนแท็บเล็ตในครัวอยากเห็นขั้นตอนก่อน; ผู้จัดการตั้งราคาจากเป้า food cost % รายเมนู + มีขั้นต่ำ

## Watch out
การตัดสินใจของ user ที่ห้ามถอย — ต้นทุนวัตถุดิบดึงจากต้นทุนเฉลี่ยคลัง (ทั้ง BU) แต่ **ห้ามขยับเองเงียบ ๆ** ต้องกด "คำนวณใหม่"; ของหมด → ต้นทุนเฉลี่ยตัวล่าสุด; ราคาต่ำกว่าขั้นต่ำ = เตือนไม่บล็อก; ไม่ทำ sub-recipe รอบนี้
ลำดับ deploy ช่วง 1: migrate ทุก BU → BE → FE (FE ก่อน = gateway ตัดฟิลด์เงียบ ๆ; BE ก่อน migrate = 500)
กับดักที่เจอ: `tb_recipe` ไม่มีคอลัมน์ `info` (FE ส่งแต่ถูกตัดทิ้ง); recipe PATCH รับ body ในฟิลด์ multipart `data` ไม่ใช่ JSON ระดับบน (ส่งผิด = 200 แต่ไม่เขียนอะไร); อ่าน `form.formState.errors` ตรง ๆ ใน sub-component = error ไม่ขึ้น/ค้าง ต้องใช้ `useFormState`
…

_From Claude Code's memory of this repo, last updated Oct 16._
