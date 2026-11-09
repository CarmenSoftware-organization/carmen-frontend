---
title: Gateway เลิกอ่าน BU จาก claim ของ Keycloak แล้ว อ่านจาก tb_user_tb_business_unit…
author: Thammanoon
date: 2026-11-09
id: l-48aac4ec
scope: repo
status: active
touches:
  - "types/profile.ts#BusinessUnit"
---

## Decided
**สถานะปัจจุบัน (23 ส.ค. 2026):** `KeycloakGuard` อ่าน BU ของผู้ใช้จาก `tb_user_tb_business_unit`
ผ่าน `PermissionService.getUserBusinessUnits()` (cache 60 วิ) แล้ว — **ไม่อ่าน claim `bu` ของ Keycloak
อีกต่อไป** `user.bu` ที่ `keycloak.strategy.ts:50` ยังเติมมาให้แต่ไม่มีใครใช้ (คงไว้ให้ revert ง่าย)

**Why:** claim มาจาก user attribute `BusinessUnit` ซึ่งเป็นสำเนาที่ sync แบบ best-effort
(`business-unit.service.ts` ส่ง RPC `manageBu` ใน `try {}` ที่พังเงียบได้ และ seed/สร้าง BU
ไม่ผ่านเส้นนั้น) ตอนย้ายมาอ่าน DB สำเนานั้นผิดอยู่ **16 จุดจาก 34 user**: 5 สิทธิ์ที่ DB ให้แต่
claim ไม่มี (ผู้ใช้ถูกล็อกออกจาก BU ตัวเอง), 10 สิทธิ์ค้างที่ DB ไม่มีแล้ว, 1 role ไม่ตรง
อาการที่เจ็บสุดคือ `bu_id` ค้างที่ชี้ไป BU ที่ถูกลบแล้ว → `LicenseService.resolveBatch` คืน
`state:'none'` → **403 LICENSE_REQUIRED ทุก route ที่ติด license พร้อมสิทธิ์ว่างเปล่า** ทั้งที่
`/api/user/profile` (resolve จาก id จริงของ micro-business) รายงาน `active` + features ครบ
FE เลย render หน้าได้ปกติแล้วไปพังตอนยิง API เป็น dialog "Feature Not Licensed"

## Watch out
- เจอ 403 LICENSE_REQUIRED ที่ขัดกับ profile → **ไม่ใช่เคสนี้แล้ว** ให้ไปดู `tb_subscription_bu` จริง ๆ
- attribute `BusinessUnit` ใน Keycloak ยังมีข้อมูลเก่าค้างอยู่ (ยังไม่ได้ล้าง) แต่**ไม่มีผลต่อระบบแล้ว**
  อย่าเอาไปใช้ debug และอย่าเชื่อว่ามันสะท้อนสิทธิ์จริง — `tb_user_tb_business_unit` คือคำตอบเดียว
- `tb_user.id` = Keycloak `sub` ตรงกันเสมอ ใช้ join ได้ตรง ๆ
- **ขั้น 2 ทำแล้ว:** ลบ RPC `manageBu`/`getBuList` (contract + handler), `addUserBu`/`removeUserBu`/
  `getUserBuList`/`manageUserBu` และ dual-write 2 จุดใน `business-unit.service.ts` ออกหมดแล้ว —
…

_From Claude Code's memory of this repo, last updated Aug 23._
