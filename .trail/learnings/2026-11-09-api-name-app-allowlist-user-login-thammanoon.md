---
title: Api_name ใหม่ที่ยังไม่อยู่ใน app allowlist ทำให้ user ถูกเตะออกหน้า login ไม่ใช่แค่…
author: Thammanoon
date: 2026-11-09
id: l-c0676885
scope: repo
status: active
touches:
  - lib/http-client.ts
  - "components/auth/require-auth.tsx#RequireAuth"
  - "components/ui/multi-select-filter.tsx#MultiSelectFilter.clear"
  - "vitest.setup.ts#makeMemoryStorage.clear"
  - "lib/auth/auth-api.ts#refreshTokens"
---

## Decided
ทุกครั้งที่เพิ่ม endpoint ใหม่พร้อม `new AppIdGuard('<api_name>')` ใน backend-gateway — ถ้า
`api_name` นั้นยังไม่อยู่ใน allowlist ของ application ใน DB ผลไม่ใช่ "ฟีเจอร์นั้นไม่ทำงาน"
แต่คือ **user ถูก logout เด้งไปหน้า `/login` ทุกครั้งที่เปิดหน้าที่เรียก endpoint นั้น**

เส้นทาง: `AppIdGuard` (`app-id.guard.ts:81`) โยน 401 พร้อมข้อความ
`"This application id (x-app-id) is not found or not allowed to access this api"` →
frontend `lib/http-client.ts:232` เช็ค `message?.toLowerCase().includes("permission")`
ซึ่งข้อความนี้**ไม่มีคำว่า permission** → หลุด branch ที่ควรจะเป็น 403 → `refreshTokens()`
สำเร็จ (token ไม่ได้มีปัญหาเลย) → retry → 401 ซ้ำ → `tokenStore.clear()` (`:251`) →
`RequireAuth` `<Navigate to="/login">`

`retry: false` ของ TanStack Query ช่วยไม่ได้ — logout เกิดใน `httpClient` ซึ่งอยู่ใต้ query layer
การเขียน error handling ให้ hook "ซ่อน UI เงียบ ๆ ตอน error" ก็ช่วยไม่ได้ด้วยเหตุผลเดียวกัน

**Why:** เคยเขียนลง spec ว่า "ลืมเติม allowlist แล้วแค่ feature ไม่ขึ้น หน้ายังใช้ได้" แล้ว
final review จับได้ว่าผิด — ไล่โค้ดยืนยันแล้วว่าผิดจริง สมมติฐานนี้ผ่าน per-task review
มาได้ทุกด่านเพราะทุกด่านตรวจ implementation เทียบกับ plan ไม่มีใครตรวจตัว plan เอง

## Watch out
เมื่อวางแผน endpoint ใหม่ที่มี api_name ของตัวเอง —
(1) เขียนใน PR ของ **frontend** ด้วย ไม่ใช่แค่ backend เพราะ deploy frontend คือตัวจุดชนวน
(2) เช็คก่อนว่าแถว application ของ env นั้นตั้ง `allow_all: true` ไหม —
`AppAllowlistStore.isAllowed` (`app-allowlist.store.ts:51-57`) ลัดวงจรถ้าเปิดไว้ ถ้าเปิดก็ไม่ต้องเติมอะไร
(3) ทดสอบที่ให้ข้อมูลมากที่สุด: เปิดหน้านั้น**ก่อน**เติมแถว ดูว่าโดนเตะออกไหม
(4) การ "แข็งแรงขึ้น" ที่แท้จริงคือแก้ `http-client` ให้เลิกถือว่า 401 ที่อธิบายไม่ได้ = ทำลาย session
    หรือให้ `AppIdGuard` ใช้ข้อความที่ branch permission จับได้ — ยังไม่ได้ทำ เป็นงานแยก
…

_From Claude Code's memory of this repo, last updated Aug 12._
