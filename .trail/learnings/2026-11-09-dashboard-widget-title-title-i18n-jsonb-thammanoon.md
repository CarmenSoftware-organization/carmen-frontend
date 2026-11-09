---
title: Dashboard widget title หลายภาษา (title_i18n jsonb)
author: Thammanoon
date: 2026-11-09
id: l-f4d3fe8a
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-10-08-widget-title-i18n-design.md
---

## Decided
2026-10-08: title_i18n `{en, th?}` เพิ่มข้าง `title` (dual-write = en) แบบ expand/contract ใน 3 ตาราง
(template platform, BU, personal) — commit อยู่บน `feature/widget-title-i18n` ของ micro-data,
backend-v2, carmen-platform, inventory FE — **merge เข้า main ครบแล้ว 8 ต.ค. (merge commit): micro-data #16, backend-v2 #790, platform #329, FE #260** branch ลบแล้ว
ยังไม่ตรวจมือ (Task 10: migration+seed บน dev DB ต้องขออนุญาตก่อน) / ยังไม่ deploy สักที่
spec: `docs/superpowers/specs/2026-10-08-widget-title-i18n-design.md` (§6 มี runbook)

**Why:** seed เดิม 58/71 title เป็นไทยปน — backfill เป็น `{en: title}` ช่อง en จะเป็นไทย seeder จึง retitle แถวที่ title ยังตรงไฟล์

## Watch out
- deploy: migration (backup 3 ตารางก่อน) → micro-data + backend-v2 → `db:seed.dashboard-widget-template` → platform + FE
- หลัง roll-forward/rollback ทุกครั้งรัน reconcile SQL ใน spec §6 (title กับ title_i18n.en drift ได้ถ้าโค้ดเก่าเขียนช่วงรอยต่อ)
- build micro-cluster/gateway ต้อง `db:generate` + `build` ใน packages/prisma-shared-schema-platform ไม่งั้น type ไม่มี title_i18n
- หลัง seed ขยับ bu_default version → ต้อง deploy ลง BU ใหม่ BU widget เดิมถึงได้ชื่อสองภาษา
- ชื่อ dataset แปลอยู่ `messages/*.json` → `dashboard.datasets.<id>` (94 ตัวจาก catalogue dev) — dataset ใหม่ต้องเติมเอง
…

_From Claude Code's memory of this repo, last updated Oct 8._
