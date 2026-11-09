---
title: Email profile ส่ง SMTP ผ่าน Microsoft OAuth2 (Hotmail device code + M365 client…
author: Thammanoon
date: 2026-11-09
id: l-05c20892
scope: repo
status: active
touches:
  - docs/email-profile-microsoft-oauth2.md
---

## Decided
branch `feature/email-profile-ms-oauth2` ครบ 3 รีโป (micro-notification, carmen-turborepo-backend-v2, FE) merge ครบ 2026-10-15 (micro-notification #14, backend-v2 #828, FE #305) · deploy dev: backend 04b1a4c20 ✅ FE vercel ✅ · micro-notification ✅ ad85dc2 (หลังแก้ swc ดู micro-notification-dev-deploy-swc) · UAT/prod ยัง

**Why:** Microsoft ปิด basic auth SMTP ของ Hotmail ส่วนตัว ลูกค้าจึงต้องใช้ XOAUTH2 แทน ส่วน App registration เป็นของลูกค้าเอง

## Watch out
- ลำดับ deploy: micro-notification → backend → FE (FE ขึ้นก่อน = บันทึกโปรไฟล์ Microsoft ไม่ได้)
- **rollback backend ไม่ปลอดภัยเมื่อมีโปรไฟล์ Microsoft แล้ว:** schema เก่าบังคับ `password` ทำให้ PO email ของ BU นั้นพังทั้งหมด ต้องลบโปรไฟล์ Microsoft ก่อน rollback
- ตรวจมือข้อสำคัญ: **เชื่อมต่อครั้งแรกใน BU ที่ยังไม่มีแถว `email_profiles`** (เคยพังเพราะ CAS บน updated_at ความละเอียด µs; แก้เป็น window 1ms แล้ว แต่ยังไม่เคยลองกับ DB จริง)
- M365 (`oauth2_app`) ยังไม่ได้ทดสอบเลย เพราะไม่มี tenant ทดสอบ
…

_From Claude Code's memory of this repo, last updated Oct 15._
