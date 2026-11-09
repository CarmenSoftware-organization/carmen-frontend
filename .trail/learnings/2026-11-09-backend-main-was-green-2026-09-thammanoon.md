---
title: Backend main was green 2026-09-28
author: Thammanoon
date: 2026-11-09
id: l-ff0033a5
scope: repo
status: active
touches:
  - "scripts/bump.ts#main"
  - "scripts/gen-widget-docs.ts#main"
---

## Decided
**อัปเดต 2026-10-16:** micro-business แดง 2 ตัวที่มากับ commit `d87e2f724` (FIFO วันที่ใบรับ) บน main — `src/inventory/active-period.guard.spec.ts` (source scan เจอ `inventory/receipt-date-order.helper.ts` ที่ยังไม่อยู่ใน `DATE_LOOKUP_CALLERS`) และ `src/master/products/products.controller.spec.ts` · สรุปจากว่าไฟล์มาจาก commit บน main และ branch ที่รันไม่ได้แตะ — **ยังไม่ได้รันบน main ตรง ๆ** · gateway 475/475 (5566) เขียว · micro รวม 6928/6930

**อัปเดต 2026-09-28 — baseline แดงข้างล่างหมดอายุแล้ว:** รันบน worktree ของ `origin/main` (3ffeafa24) ด้วย `bun run test` (jest)
ได้ **gateway 473/473 suites (5289 tests) เขียวหมด**, micro-business 431/431 (6576), micro-cluster 43/43 (579)
⇒ ตอนนี้ gate ของทุก app คือ "เขียว 100%" แดงเมื่อไหร่ = regression ของงานตัวเองจนกว่าจะพิสูจน์บน main ว่าไม่ใช่
(gateway รันทั้ง suite ใช้เวลาหลายสิบนาที)

ประวัติ — Re-verified 2026-07-31 (รันเทียบ branch vs `main` โดยตรง):

- **Backend gateway** (`apps/backend-gateway`): **15 suites / 14 tests แดงบน `main`** — ตัวเลขเดียวกันเป๊ะเมื่อรันบน feature branch ที่ไม่ได้แตะไฟล์เหล่านั้น สรุปคือ pre-existing ทั้งชุด
  (dashboard-widgets, good-received-notes, my-pending/*, news.controller, user-business-units, user.controller, platform-migrations, `SWAGGER_TAGS has 59 entries`)
…

## Watch out
เจอ gateway แดง ให้รันชุดเดียวกันบน `main` ก่อนสรุปว่าเป็นของตัวเอง — วิธีที่เร็วคือ
`git checkout main && bun run test -- --testPathPattern "(...)"` แล้วเทียบจำนวน suite/test ที่แดง
ดู local-backend-is-shared-dev-db สำหรับ env ที่เทสต์เหล่านี้วิ่งใส่

_From Claude Code's memory of this repo, last updated Jul 31._
