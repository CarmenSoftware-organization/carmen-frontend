---
title: Activity log ของเอกสารเก็บ action ของ workflow (save/approve/...) ปนกับ CRUD ไม่ใช่แค่…
author: Thammanoon
date: 2026-11-09
id: l-b536d64b
scope: repo
status: active
touches:
  - types/stage-role.ts
  - "hooks/use-activity-log.ts#useActivityLogByRecord"
  - "routes/accounting/journal-voucher/journal-voucher-http-repository.ts#action"
  - "routes/accounting/journal-voucher/journal-voucher-mock-repository.ts#action"
  - "types/stage-role.ts#ActionPr"
---

## Decided
`GET /api/activity-log` (ผ่าน `useActivityLogByRecord`) คืน `action` ที่มีทั้งชุด CRUD
(`create` / `update` / `delete`) **และชุด workflow** — `ActionPr` ใน `types/stage-role.ts`
คือ `save | submit | approve | purchase | review | reject | send_back` เก็บเป็น**รูปฐาน**
(ต่างจาก `workflow_history` ที่เก็บรูปอดีต `rejected` / `sent_back` — ดู workflow-history-real-shape)

ในเอกสารจริงแถวส่วนใหญ่เป็น action ของ workflow ไม่ใช่ CRUD — ใบทดสอบใบหนึ่งมี
`save` 3 แถว `approve` 1 แถว ต่อ `create`/`update` อย่างละแถว

**Why:** ตอนออกแบบ activity timeline (PR #97, 2026-08-04) สมมติจาก schema ว่ามีแค่
CRUD จึงทำแผนที่แปลหัวข้อไว้ 3 ตัว ผลคือ 4 ใน 6 แถวตกไปที่ fallback แล้วค้างเป็น
ภาษาอังกฤษแม้ผู้ใช้สลับเป็นไทย จับได้ตอนเปิดดูของจริงในเบราว์เซอร์เท่านั้น
ทั้ง unit test และการอ่านโค้ดไม่เห็น เพราะ test mock ตัวแปลให้คืน key

## Watch out
เขียนอะไรที่ map `action` ของ activity log ต้องครอบ `ActionPr`
ให้ครบด้วยเสมอ และเปิดหน้าจริงดูก่อนปิดงาน — schema กับ type ฝั่งหน้าบ้านไม่บอก
ว่าค่าไหนโผล่จริงบ่อยแค่ไหน

_From Claude Code's memory of this repo, last updated Aug 3._
