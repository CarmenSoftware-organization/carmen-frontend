---
title: "เอกสาร API ขาเข้าย้ายเป็นหน้า public /developers/api ด้วย Scalar (PR #360 merge แล้ว 19…"
author: Thammanoon
date: 2026-11-09
id: l-ac20644b
scope: repo
status: active
touches:
  - lib/external-api/openapi.json
---

## Decided
PR #360 (FE) merge เข้า main แล้ว 19 ต.ค. 2026 (`fbec68d1`) ยังไม่ deploy — แทน Swagger UI ด้วย Scalar ที่หน้า public `/developers/api` (ไม่ต้องล็อกอิน, 5 stack, EN/TH) + ขัดเกลาหน้า External

**Why:** ผู้อ่านจริงคือนักพัฒนาฝั่งลูกค้าที่ไม่มีบัญชี Carmen; user อยากได้หน้าตาแบบ Stripe และหลาย stack

## Watch out
- Scalar `telemetry` **default = true** — ห้ามถอด `telemetry: false` (CSP `connect-src https:` ไม่บล็อก)
- pin `@scalar/api-reference-react` exact; `customCss` ซ่อน Generate SDK / Powered by / un-mask `.credential-value` — อัปเกรดแล้วต้องเปิดหน้าดู
- `forceDarkModeState` ไม่ reactive → component key ด้วย locale+theme
- อัปเดต spec จาก BE: copy ทับ `lib/external-api/openapi.json` → `bun run docs:i18n-check` → แปล `openapi.th.json`
- ค้าง: ตรวจ 375px, ตรวจบน Vercel/nginx จริง
…

_From Claude Code's memory of this repo, last updated Oct 18._
