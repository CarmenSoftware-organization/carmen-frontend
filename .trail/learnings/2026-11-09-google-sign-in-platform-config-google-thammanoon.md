---
title: "สวิตช์ google_sign_in ใน platform config คุมปุ่ม Google ต่อแอป"
author: Thammanoon
date: 2026-11-09
id: l-3f307257
scope: repo
status: active
touches:
  - "components/auth/google-sign-in-button.tsx#GoogleSignInButton"
---

## Decided
platform config key `google_sign_in` = `{ platform, app }` (default ทั้งคู่ false)  (2026-10-07) — PR BE #781 + platform #324 + inventory #249 merge เข้า main แล้ว 7 ต.ค. ยังไม่ deploy
- gateway `GET /api/auth/google/status?app=` → `{enabled}` = flag && env Google ครบ; authorize/callback redirect `?error=google_disabled` เมื่อปิด
- FE ทั้งสองแอป: ปุ่มแสดงเสมอแต่ disabled (ไม่มีข้อความใต้ปุ่ม — user สั่งตัด) เมื่อ status ไม่ใช่ true (user เปลี่ยนจาก hide → disable 7 ต.ค., platform #325 + inventory #250 merge แล้ว ยังไม่ deploy); การ์ดใน `/platform/configs`
- inventory FE PR #249: `GoogleSignInButton` (login + invitation) ซ่อนจนกว่า status `app=app` ตอบ true — ถ้า deploy ก่อน BE ปุ่มหายจนกว่า BE ขึ้น

- **inventory FE ขึ้น Vercel prod แล้ว 7 ต.ค.** (carmen-inventory.vercel.app → backend dev.blueledgers.com:4001 ที่ยังไม่มี endpoint = 404) → ปุ่ม Google disabled บน prod จนกว่า deploy BE #781 + เปิดสวิตช์ app

**Why:** user เลือก backend config + opt-in + บังคับที่ backend เพื่อกันปุ่มพังบน env ที่ไม่ตั้ง OAuth (ดู fe-deploy-blocked-google-signin)

## Watch out
deploy BE (micro-cluster + gateway) ก่อน FE แล้วเปิดสวิตช์บน dev ทันที; ตรวจในเครื่องครบแล้ว 7 ต.ค. (dummy GOOGLE_CLIENT_ID ชั่วคราว + บัญชีใน carmen-platform-e2e/.env): สวิตช์/authorize/callback/next/การ์ด/ปุ่ม inventory ถูกหมด — ที่ยังไม่เคยเห็นคือหน้า login ของ platform บนจอ และ sign-in Google จริงจนจบ; สวิตช์บน DB dev ตั้งกลับเป็นปิดทั้งคู่แล้ว (มีแถวอยู่)

_From Claude Code's memory of this repo, last updated Oct 7._
