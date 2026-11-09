---
title: "Bun run docs:widgets (PR #432)"
author: Thammanoon
date: 2026-11-09
id: l-68b427d7
scope: repo
status: active
touches:
  - scripts/gen-widget-docs.ts
  - docs/dashboard-widgets.md
  - "lib/__tests__/security-headers.test.ts#read"
---

## Decided
`scripts/gen-widget-docs.ts` (`bun run docs:widgets`) merge เข้า main แล้ว 2026-10-22 (PR #432) ฉบับแรกของ `docs/dashboard-widgets.md` user รันเองด้วยบัญชี superadmin ของ platform แล้วเปิด PR #433 — endpoint `api-system/dashboard-templates*` ต้องใช้บัญชี platform ที่มี `dashboard_template.read` ผ่าน env `WIDGET_DOC_EMAIL`/`WIDGET_DOC_PASSWORD`; บัญชี zebra ได้ 403 (ดู local-backend-test-accounts)

**Why:** user อยากได้เอกสาร widget สำหรับทีม dev + support เป็นภาพถ่ายจาก dev.blueledgers.com:4001 ("prod" ของ FE ตอนนี้)

## Watch out
เมื่อ user ให้บัญชี platform มา → รันสคริปต์ ตรวจไฟล์ แล้ว commit ผ่าน PR ใหม่ · ตรวจ render แบบไม่มีบัญชี platform ได้ผ่าน `/api/T02/dashboard-lab/datasets` (payload เดียวกับ catalog) + `/api/T02/dashboard-widgets/<module>/config` · dataset `lab.*` ถูกกรองออกจากแคตตาล็อกตามที่ user สั่ง

_From Claude Code's memory of this repo, last updated Oct 22._
