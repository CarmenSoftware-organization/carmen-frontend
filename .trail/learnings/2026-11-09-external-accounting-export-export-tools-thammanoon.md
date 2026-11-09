---
title: External ย้ายจาก Accounting ไปหมวดใหม่ export (Export tools)
author: Thammanoon
date: 2026-11-09
id: l-9bd393bf
scope: repo
status: active
touches:
  - "lib/telemetry.ts#FragmentRedactingSpanExporter.export"
---

## Decided
18 ต.ค. 2026: ย้าย brand External ไปหมวดใหม่ `export` ("Export tools") เพื่อรองรับเครื่องมือ export ตัวอื่นในอนาคต
- config `interface_accounting_external` → `interface_export_external`; license `interface.accounting.external` → `interface.export.external` (parent ใหม่ `interface.export`); URL `/accounting/external` redirect ไป `/export/external`
- BE #862 (c1e3e89fa), FE #359, e2e #75 merge 18 ต.ค. · dev: platform migration+seed (user รัน) + tenant ครบ 12 schema (มีข้อมูลแค่ ZEBRA_AVG/T02 ซึ่งเป็น BU เดียวที่มีใบ INF External) · ตรวจผ่าน gateway :4000 ในเครื่อง + FE :3000 แล้ว (list/redirect/ฟอร์ม/API access/ภาษาไทย) · เครื่องนี้ต่อ dev.blueledgers.com ได้แค่ :6432 (443/4001 unreachable) จึงตรวจ dev server ตรง ๆ ไม่ได้ · FE ยังไม่ deploy · migration ตั้ง updated_at=now() → หน้า list ขึ้น "Updated 20:25 โดย Admin Torres" ทั้งที่ไม่มีใครแก้
- migration (ตรวจครั้งแรกบน Postgres ชั่วคราว): platform `20261018120000_move_external_interface_under_export` + tenant `20261018120000_rename_interface_external_config_key`

**Why:** license External มีแค่บน dev (user ยืนยัน) จึงยอมให้ dev 403 สั้น ๆ ระหว่าง deploy แทนการทำ migration สองจังหวะ

## Watch out
deploy ลำดับ platform migration → `db:seed.license-feature` → tenant migration ทุก BU → BE → FE ในรอบเดียว (seed ก่อน migration = state ที่ admin ตั้งหาย; BE ช้า = ext API 403 fail-closed). เพิ่มหมวด interface ใหม่ต้องเติม regex gateway `INTERFACE_CONFIG_KEY_RE` + micro-business `defaultFor`/`validateValue` ไม่งั้นไม่ตรวจ license ระดับ brand แบบเงียบ ๆ ดูแบบอย่าง mcp-license-under-ai

_From Claude Code's memory of this repo, last updated Oct 18._
