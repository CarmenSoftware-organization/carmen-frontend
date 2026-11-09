---
title: "@EnrichAuditUsers ลบ created_at/updated_at ดิบด้วย delete ใน interceptor (ไม่ใช่ .omit…"
author: Thammanoon
date: 2026-11-09
id: l-425903e9
scope: repo
status: active
touches:
  - CLAUDE.md
  - "routes/inventory-management/spot-check/sc-form-schema.test.ts#paths"
  - "routes/procurement/goods-receive-note/grn-form-schema.test.ts#paths"
  - "routes/vendor-management/price-list-template/plt-form-schema.test.ts#paths"
---

## Decided
Response ของ backend gateway **ไม่มี** `created_at` / `updated_at` / `created_by_id` /
`updated_by_id` / `deleted_at` / `deleted_by_id` ดิบ — มีแต่
`audit.{created,updated,deleted}.{ at, id, name }`

**ยืนยันด้วยการยิง API จริงครบ 9/9 เคสแล้ว (2026-08-04)** — ทำนายถูก 8 พลาด 1
(PR list ซึ่งกลายเป็นบั๊ก backend ด้านล่าง) ไม่มีเคสไหนค้างอีก

**กลไกจริงคือ interceptor ไม่ใช่ serializer** (ไล่ตรวจครบ 2026-08-03):
`mutateToAuditShape` ใน `apps/backend-gateway/src/common/enrichment/audit-shape.ts:100-101`
เรียก `delete target[at]` / `delete target[byId]` ตรง ๆ ตาม `KIND_MAP`
(created/updated/deleted) ส่วน `.omit(AUDIT_RAW_FIELDS)` ใน 38 serializer เป็นแค่การ
ทำให้ *schema* ตรงกับสิ่งที่ interceptor ทำไปแล้ว **ไม่ใช่ตัวลบ**

**Why:** ไม่ใช่บั๊ก — ออกแบบให้ได้ชื่อผู้กระทำมาพร้อมเวลา เคยเข้าใจผิดว่าเป็นบั๊ก
backend เกือบส่งรายงานผิดไปให้ทีมเขา

## Watch out
- อ่านเวลาเสมอผ่าน `x.audit?.created?.at` / `x.audit?.updated?.at`
- **ห้ามประกาศ `created_at: string` ใน type ของ entity ที่มาจาก endpoint พวกนี้** —
  ประกาศแล้ว tsc จะเงียบทั้งที่ค่าคือ `undefined` (เคยหลุด 5 จุด PR #92)
- **เกณฑ์ตัดสินคือ controller handler ติด `@EnrichAuditUsers` ไหม** ไม่ใช่ว่า serializer
  omit ไหม — controller หลายตัว (periods / spot-checks / physical-counts /
  physical-count-periods / running-codes / app-config / my-approve /
  purchase-request-templates) **ไม่มี serializer เลย** แต่ติด decorator จึงโดนลบเหมือนกัน
…

_From Claude Code's memory of this repo, last updated Aug 3._
