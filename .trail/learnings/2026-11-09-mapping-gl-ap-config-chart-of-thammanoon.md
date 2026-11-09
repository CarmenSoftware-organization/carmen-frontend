---
title: "Mapping GL/AP (หน้า /config/chart-of-account-mapping) merge ครบ 2 รีโป 14 ต.ค. (BE #820,…"
author: Thammanoon
date: 2026-11-09
id: l-26df9e2d
scope: repo
status: active
touches:
  - "routes/system-admin/workflow/wf-header.test.tsx#counts"
---

## Decided
ทำเสร็จ 14 ต.ค. 2026 ผ่าน subagent-driven ครบ 11 task + final review แล้ว ทั้ง BE และ FE อยู่บน branch `feature/gl-ap-account-mapping` (merge แล้ว 14 ต.ค.: BE #820 = 743bbfbb3, FE #272 = be8c1101 — merge commit; branch ลบแล้ว; **deploy dev แล้ว 14 ต.ค.** BE 743bbfbb3 + migrate 11 BU + seed permission + FE vercel --prod; UAT/prod ยังไม่ deploy; ยังไม่ generate แถว/ยังไม่ตรวจในเบราว์เซอร์) spec และ plan อยู่ใน FE `docs/superpowers/{specs,plans}/2026-10-14-gl-ap-account-mapping*`

- ตาราง `tb_account_mapping` เก็บเฉพาะค่าที่แก้ทับ ค่า null แปลว่าสืบทอดสดจาก master ส่วน resolver ใน TS เป็นแหล่งเดียวของค่าที่แสดง และ SQL CTE มีไว้แค่กรอง นับ และแบ่งหน้า (ใช้ NULLIF + LATERAL LIMIT 1 ให้ตรงกับฝั่ง TS)
- จำนวนตาม status ส่งมาที่ `summary.counts` (ไม่ใช่ meta) เพราะ `handlePaginatedResult` ส่งต่อแค่ field นี้
- **ยังไม่เคยรันกับ DB หรือ backend จริง** เช็กลิสต์ Review Focus 1–5 (generate ซ้ำ, parity, consignment, 422, 409) ยังค้างอยู่ ก่อนทดสอบต้อง backup `tb_account_mapping`, `tb_location`, `tb_product_account_code_mapping` เพราะ dev DB เป็นของกลาง ดู local-backend-is-shared-dev-db
- ลำดับ deploy: migration ทุก BU → BE → permission seed → **ให้ role ได้สิทธิ์ `configuration.chart_of_account_mapping`** (ไม่อย่างนั้น non-admin ได้ 403) → FE โดย FE ห้ามขึ้นก่อน BE เพราะไม่มี mock สำรองแล้ว
…

## Watch out
ก่อน push / merge / deploy ให้ทำเช็กลิสต์ runtime และลำดับ deploy ข้างบนให้ครบก่อน
- `scripts/migrate-tenants.sh` บน main พังตั้งแต่ Prisma 7 (require generated/client ที่เป็น TS ไม่ได้ → ตายเงียบเพราะ set -e) — แก้ให้ใช้ `pg` ไว้บน branch `fix/migrate-tenants-prisma7` ในเครื่อง (ยังไม่ commit) และใช้ตัวนี้ migrate dev 14 ต.ค.; admin ใช้หน้าได้, role อื่นยังไม่ได้ grant (user ตัดสินใจ "admin ไปก่อน")
…

_From Claude Code's memory of this repo, last updated Oct 14._
