---
title: API key ต่อ BU + export Dr/Cr ของ GRN/CN/SR/SI/SO
author: Thammanoon
date: 2026-11-09
id: l-df729a01
scope: repo
status: active
touches:
  - CLAUDE.md
  - package.json
---

## Decided
branch ของงานนี้ลบหมดแล้ว (local+remote) 16 ต.ค. · Spec/plan อยู่ใน FE `docs/superpowers/{specs,plans}/2026-10-16-*` (worktree ลบแล้ว 16 ต.ค.)

- ช่วง 1 เสร็จ 16 ต.ค. (BE 28dd49ae1..77707a375, FE 315da86b..b7b650ce) ผ่าน final review แล้ว — PR BE #855 + FE #348 (BE ก่อน) **merge แล้ว 16 ต.ค. ยังไม่ deploy / ยังไม่ migrate DB ไหนเลย / ยังไม่ตรวจ runtime สักข้อ**
- เช็กลิสต์ตรวจมือ + SQL parity อยู่ใน checkout หลัก FE `.superpowers/sdd/2026-10-16-contra-account-defaults/` (progress.md, task-3-report.md) — gitignored อย่าลบจนตรวจเสร็จ
- ลำดับ deploy: migration `20261016140000_account_mapping_contra_defaults` **ทุก BU ก่อน BE** (Prisma select คอลัมน์ใหม่ → BU ที่ไม่ migrate พังทั้ง adjustment type และ mapping list) → BE → FE; หน้า mapping บน dev จะเห็น incomplete พุ่ง (AP ไม่มี ap_control_account_id, adjustment type ไม่มีบัญชี) — ตั้งใจ
- ส่วน gl_setting ในหน้า External ต้องมี license `configuration.app_config` ด้วย (ไม่ใช่แค่ interface)
- การตัดสินใจ: vendor บัญชีตาย → ใช้ BU default (ตาม AP invoice); gl_setting ครั้งแรกตั้ง fiscal_year_start_month=1
- ข้อควรรู้สำหรับช่วง 2: `vendor_id` เป็น string|undefined (ต้อง map null), เรียก `loadContraCodes([])` แยกเพื่อเอา inputVat, dedupe+chunk key ก่อน `resolveKeys`, ต้องมี tenant ALS context; guard ต้องเขียน canActivate เอง (KeycloakGuard ตรวจ membership)
…

## Watch out
ก่อน push/merge/deploy ทำเช็กลิสต์มือให้ครบ และเคารพลำดับ migration → BE → FE; ช่วง 2 ใช้ plan `2026-10-16-inbound-api-key-inventory-posting.md`. ดู gl-ap-account-mapping local-backend-is-shared-dev-db

_From Claude Code's memory of this repo, last updated Oct 16._
