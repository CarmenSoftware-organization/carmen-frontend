---
title: "ชื่อไฟล์แนบภาษาไทยเพี้ยนเพราะ multer latin1"
author: Thammanoon
date: 2026-11-09
id: l-34036d90
scope: repo
status: active
touches:
  - "routes/accounting/accounts-payable/shared/ap-http-repository.ts#attachments"
---

## Decided
ชื่อไฟล์แนบที่ไม่ใช่ ASCII (เช่น `ภาษาไทย.png`) แสดงเป็น mojibake ทุกโมดูลที่มี comment
เพราะ multer ตั้ง `defParamCharset` เป็น `latin1` เป็นค่าเริ่มต้น (`multer/index.js:22`)
แก้แล้วที่ `carmen-turborepo-backend-v2` — `MulterUtf8Module` (`@Global()` +
`MulterModule.register({ defParamCharset: 'utf8' })`) ใน `apps/backend-gateway/src/common/multer/`
**PR #329 merge เข้า main แล้ว (2026-08-13) ยังไม่ deploy uat/prod**

**Why:** ปัญหาอยู่ฝั่ง backend ล้วน ๆ — frontend ส่งชื่อไฟล์ถูกต้องอยู่แล้ว (ยืนยันด้วยการวัด
`File.name` ก่อนส่งเทียบกับ `fileName` ที่ API คืนกลับ) การไปแก้ที่ frontend คือการเดา decode
กลับและปิดบังบั๊ก ขณะที่ DB ยังเก็บชื่อผิดอยู่ดี

## Watch out
- ต้อง `@Global()` เท่านั้น — `FilesInterceptor` inject `MULTER_MODULE_OPTIONS` แบบ `@Optional()`
  ถ้า provider มองไม่เห็นในโมดูลนั้นมันจะ **เงียบ ๆ** ถอยไปใช้ latin1 ไม่มี error ให้จับ
- **สคริปต์ซ่อมข้อมูลเก่า (PR #330 merged)** — `bun run fix:mojibake-filenames` (dry-run เป็นค่าเริ่มต้น
  ต้อง `--apply` ถึงเขียน) ซ่อมทั้ง `attachments` jsonb ทุก tenant schema และ
  `tb_file_tag.original_name` **apply ไปแล้วเฉพาะ `--schema=BL_AVG` (4 ค่า)** ที่เหลือ
  (`ZEBRA_AVG` 6 + `tb_file_tag` อีก 9) ยังไม่ได้รัน — ฐาน dev ใช้ร่วมกัน ดู
  local-backend-is-shared-dev-db
…

_From Claude Code's memory of this repo, last updated Aug 12._
