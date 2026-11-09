---
title: User ที่ไม่มี BU ที่ is_default=true ติดตาย
author: Thammanoon
date: 2026-11-09
id: l-b36ecfa5
scope: repo
status: active
touches:
  - hooks/use-profile.ts
  - components/navbar/bu-switcher.tsx
  - "hooks/use-profile.ts#useProfile"
---

## Decided
ถ้า `/api/user/profile` คืน `business_unit` ที่ **ไม่มีตัวไหน `is_default: true`** เลย ผู้ใช้จะติดตาย:

- `hooks/use-profile.ts` — `defaultBu = business_unit.find(is_default) ?? business_unit[0]`
  → FE fallback เป็นตัวแรก แอปจึง "ดูเหมือนปกติ" (navbar โชว์ชื่อ BU)
- backend `/api/business-units` หา current BU จาก `is_default=true` เท่านั้น
  → ตอบ **404 `"No current business unit set for user"`** (ไม่ใช่ route หาย — ยิงโดยไม่มี token ยังได้ 401)
  → หน้า `/system-admin/company-profile` ขึ้น ErrorState "Failed to load business unit settings"
- `components/navbar/bu-switcher.tsx:134` — `isActive = bu.id === currentDept.id` โดย `currentDept = defaultBu`
  → BU ตัวนั้นถูก `disabled` + `if (isActive) return;` → **กดสลับไม่ได้ ตั้ง default เองไม่ได้**

**Why:** FE กับ BE ตีความ "BU ปัจจุบัน" คนละแบบ — FE fallback เงียบ ๆ, BE ยืนยัน flag จริง อาการจึงโผล่เป็น "หน้าพัง" ที่ดูเหมือนบั๊กของหน้านั้น

## Watch out
เจอ 404 จาก `/api/business-units` ให้เช็ค `is_default` ใน profile ก่อนอย่างอื่น
แก้ข้อมูลได้ด้วย `POST /api/business-units/default` payload **`{ tenant_id: "<buId>" }`**
(ใส่ `business_unit_id` จะได้ 200 แต่ไม่เขียนอะไรเลย — NestJS ทิ้ง key แปลกปลอม ดู platform-config-write-schema-deploy-pairing)
แก้เชิงโค้ดแล้ว (FE PR #166 **merge เข้า main แล้ว 21 ก.ย. ยังไม่ deploy**): `useProfile` แยก `hasDefaultBu` ออกมา (`defaultBu` ยัง fallback ไว้สำหรับแสดงผล) และ `bu-switcher` คิด `isActive` จาก `hasDefaultBu` ปุ่มจึงกดได้เมื่อไม่มี default จริง — ตัวปลดล็อกอยู่ที่ FE แล้ว แต่ข้อมูลที่ค้างอยู่ต้องตั้ง
…

_From Claude Code's memory of this repo, last updated Sep 21._
