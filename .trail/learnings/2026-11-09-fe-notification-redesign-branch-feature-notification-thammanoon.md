---
title: FE notification redesign (branch feature/notification-frontend-redesign) must deploy…
author: Thammanoon
date: 2026-11-09
id: l-e26af4b6
scope: repo
status: active
touches:
  - "scripts/bump.ts#main"
  - "scripts/gen-widget-docs.ts#main"
---

## Decided
งานยกเครื่อง notification ฝั่ง frontend ให้ตรงสัญญาใหม่ของ `carmen-turborepo-backend-v2` **v2.1.0**
**merge เข้า `main` แล้วที่ `bbcf915` และ push ขึ้น origin แล้ว (2026-08-11)** — ยัง**ไม่ deploy**

**FE ชุดนี้ต้องขึ้นหลัง backend v2.1.0 เท่านั้น** backend รุ่นก่อนไม่มี `doc_type`/`source`/`summary`
หน้าจะไม่ crash แต่กลายเป็นรายการไร้ป้ายไร้ลิงก์และ badge เป็นศูนย์

วิธีเช็คว่า environment ไหนรันสัญญาใหม่แล้ว: `GET <gateway>/swagger/json` แล้วดูว่ามี
`enum_notification_doc_type` กับ `NotificationSummaryDto` หรือยัง (path คือ `/swagger/json`
ไม่ใช่ `/api-json`) — ยืนยันแล้ว**เฉพาะ gateway ที่เครื่อง `:4000`** ส่วน dev/uat เข้าไม่ถึงถ้าไม่ต่อ VPN

**งานที่ค้างอยู่ที่รีโปอื่น:** spec ฝั่ง backend บังคับ `end_at` ตอนสร้าง broadcast แล้ว รีโปนี้ไม่มี
ฟอร์มสร้างประกาศเลย — หน้าจอนั้นอยู่ที่ `carmen-platform` ถ้าที่นั่นยังไม่เพิ่มช่อง `end_at`
การสร้างประกาศจะถูกปฏิเสธหลัง backend deploy รอบสอง ต้องมีคนไปแจ้งทีมนั้น

เกี่ยวข้อง: gateway-strips-raw-audit-fields · platform-config-write-schema-deploy-pairing

**อัปเดต 2026-08-23 — deploy ขึ้นแล้ว** (ยืนยันโดย user) ลำดับ "หลัง backend v2.1.0" ผ่านไปแล้ว
**ยังค้าง: `carmen-platform` ยังต้องเพิ่มช่อง `end_at` ในฟอร์มสร้างประกาศ** ไม่งั้นสร้างประกาศแบบมีวันหมดอายุไม่ได้

_From Claude Code's memory of this repo, last updated Aug 11._
