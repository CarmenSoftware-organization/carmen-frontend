---
title: "ช่องผู้รับ current_approve ถูกตัดทุก action (BE #901 + FE #428 merge 22 ต.ค. ยังไม่…"
author: Thammanoon
date: 2026-11-09
id: l-a6966d89
scope: repo
status: active
touches:
  - "routes/system-admin/workflow/wf-form-schema.ts#clearCurrentApprover"
---

## Decided
ช่อง `current_approve` ใน recipients ของ action (submit/approve/reject/sendback) ถูกตัดทิ้งทั้งสองฝั่ง
เพราะ dispatcher resolve ช่องนี้เป็น "คนที่เพิ่งกด" — ตอน submit คือผู้ขอ ผู้ขอจึงได้แจ้งเตือน 2 ฉบับ

- BE #901 (`3f2bdb730`): dispatcher ข้ามช่องนี้เสมอ (skip reason `slot_is_actor`) — reject ก็ข้ามด้วย (การตัดสินใจของ Claude, user ไม่ได้สั่งตรง ๆ)
- FE #428 (`e797601f`): ซ่อนแถวในทุก action + `clearCurrentApprover` ปิดค่าค้างตอนโหลดฟอร์ม
- แถว current approver ของ **SLA warning** ไม่ได้แตะ ยังใช้อยู่

**Why:** user เจอผู้ขอได้แจ้งเตือนซ้ำ แล้วสั่งตัด approve/sendback เพิ่ม

## Watch out
deploy แล้ว 22 ต.ค. — BE dev `3f2bdb730` (ติด #900 ไปด้วย) + FE Vercel prod จาก `e797601f` · ยังไม่ทดสอบด้วยมือ · ยังไม่ได้กด seed `move-reject-previous` ของ #900 → workflow เดิมที่ reject ติ๊ก current_approve จะเงียบ (#901 ข้ามช่องนี้) จนกว่าจะ seed หรือเปิดหน้าแล้ว Save ต่อจาก workflow-notification-template-seed

_From Claude Code's memory of this repo, last updated Oct 21._
