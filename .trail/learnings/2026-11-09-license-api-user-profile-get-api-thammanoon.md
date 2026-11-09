---
title: "License ย้ายจาก /api/user/profile ไป GET /api/license (BE PR #549)"
author: Thammanoon
date: 2026-11-09
id: l-c69b7ff7
scope: repo
status: active
touches:
  - lib/http-client.ts
  - "components/ui/multi-select-filter.tsx#MultiSelectFilter.clear"
  - "vitest.setup.ts#makeMemoryStorage.clear"
  - "hooks/use-license-query.ts#useLicenseQuery"
---

## Decided
9 ก.ย. 2026 — backend-v2 PR #549 ถอด `business_unit[i].license` (รวม `seat`) ออกจาก
`GET /api/user/profile` แล้วย้ายไป `GET /api/license` ซึ่งคืน `{union, business_unit}`
พร้อมเปลี่ยน `resolveBatch` เป็น union ของทุกสัญญา active (เดิม best-pick ใบเดียว)
ฝั่ง FE inventory ตามใน branch `feature/license-union-endpoint` (`useLicenseQuery`)

**Why:** เป็น breaking change ที่ FE **ไม่ระเบิด** เมื่อ contract หาย — มัน fail-open เงียบ ๆ
(เมนูไม่ล็อก) ที่มองเห็นได้จริงช่วง deploy คร่อมคือ interface entitlement ซึ่งบังคับใช้เสมอ
ไม่ขึ้นกับสวิตช์ `LICENSE_ENFORCEMENT` → ทุก BU จะเห็นทุก brand ชั่วคราว

## Watch out
1. **เติม api_name `license.getForUser` ใน allowlist ของ app-id ทุก env ก่อนเสมอ** — ยังไม่ได้ทำ
   ณ วันที่จด · ถ้าไม่ทำ `AppIdGuard` ตอบ 401 → `lib/http-client.ts` `tokenStore.clear()`
   → **เตะผู้ใช้ออกทั้งแอป** ไม่ใช่แค่ฟีเจอร์ไม่ทำงาน (ดู new-api-name-401-logs-users-out)
2. deploy backend-v2 ก่อน แล้ว FE ทันที ให้ช่วงคร่อมสั้นที่สุด
3. ก่อน/หลัง deploy รันคิวรีนับ BU ที่มีใบ active > 1 ใบ — union จะขยายสิทธิ์ให้ BU กลุ่มนั้นทันที

_From Claude Code's memory of this repo, last updated Sep 8._
