---
title: POS Sale Interface (Simphony + Micros 3700 + SFTP ตัดสต็อกตาม recipe)
author: Thammanoon
date: 2026-11-09
id: l-9f9bf0f6
scope: repo
status: active
touches:
  - "hooks/use-data-grid-state.ts#useDataGridState"
  - "hooks/use-url.ts#useURL"
---

## Decided
แผน A–D merge เข้า main ครบเมื่อ 2026-10-22: FE #437 (`9c989656`), BE #912 (`e0be6b87e`), micro-cronjobs #15 (`dfcfe536`) — branch + worktree ลบแล้ว · **ยังไม่ deploy ที่ไหน, migration `20261022130000_pos_sale` + `20261022140000_pos_sftp_pull` ยังไม่เคย apply, ยังไม่เคยทดสอบในเบราว์เซอร์/กับ DB**

- BE test ตอน merge: micro-business 7001 ผ่าน / 4 ล้ม (active-period guard, purchase-request, products controller — มาจาก main ไม่เกี่ยว POS) · gateway ชุดเต็มไม่ได้รันจบ (user สั่ง merge ไม่รอ) · CI ของ BE ไม่รันเพราะ billing
- แผน/spec: `docs/superpowers/{specs,plans}/2026-10-22-pos-sale-*` ใน FE · ลำดับ deploy อยู่ท้ายแผน D
- สคริปต์ตรวจ/เช็กลิสต์อยู่ใน scratchpad ของเซสชัน 4b7733b9 (`pos-sale/`) — หายได้ ถ้าหายให้สร้างใหม่จากแผน

**Why:** ทดสอบจริงได้แค่ dev DB ที่ใช้ร่วม (local-backend-is-shared-dev-db) — ต้องขออนุญาตก่อนลง DDL

## Watch out
deploy gate: migration ราย BU + seed `SALE` → BE (env `SECRET_ENCRYPTION_KEY`, `INTERNAL_JOB_API_ENABLED`/`INTERNAL_JOB_TOKEN`, `POS_SFTP_DENY_CIDRS`) → `db:seed.license-feature` + assign `interface.pos(.simphony/.micros3700)` (ตัว `.micros` หายแล้ว) → allowlist `posSale.*` ให้แอปที่ไม่ใช่ allow_all (new-api-name-401-logs-users-out) → cron job ผ่าน API → FE; BE กับ FE ต้องขึ้นคู่กัน · เรื่องที่ user ยังไม่ตัดสิน: RBAC upload/cancel/remap/import, allowlist ปลายทาง SFTP, `voidStockOut` ไม่ตรวจงวด + `stock-outs.controller` ไม่มี PermissionGuard (ของเดิม) · กับดัก: `useSearchParams` ห้ามผสม `useUR
…

_From Claude Code's memory of this repo, last updated Oct 22._
