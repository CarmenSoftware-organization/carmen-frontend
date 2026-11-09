---
title: "FE #503 + BE #1003 merge และ deploy dev แล้ว 5 Nov (BE Deploy Dev success, FE vercel…"
author: Thammanoon
date: 2026-11-09
id: l-3a847b49
scope: repo
status: active
touches:
  - docs/superpowers/plans/2026-11-05-ap-pages-real-backend.md
---

## Decided
เมื่อ 2026-11-05 ลงมือครบทั้ง 6 task ของแผน `docs/superpowers/plans/2026-11-05-ap-pages-real-backend.md` แล้ว รวมรอบแก้ของ final review (head `2cfdd1a9`, ยังไม่ push และยังไม่เปิด PR) ผลตรวจ: typecheck ผ่าน, test 263 files / 2196 passed

**ยังค้าง:**
- 5 Nov: merge แล้วทั้งสองฝั่ง (merge commit) และ deploy dev ครบ ส่วน UAT/prod ยังไม่ได้ทำ ต้อง allowlist ก่อน FE ทุก env ที่ไม่ใช่ allow_all
- backend: แก้ wht-preview ให้รับ `ap_payment_id` → excludePaymentId แล้ว PR BE #1003 (branch fix/ap-wht-preview-exclude-self) และต้อง deploy คู่กับ FE
- ตรวจ browser แล้ว 5 Nov: list/redirect/form/validation/outstanding-docs ใช้ได้ แต่สร้าง invoice บน T02 ไม่ได้ (gl_setting.ap_control_account_id ไม่ได้ตั้ง และ vendor ไม่มีบัญชี AP) และ T02 ไม่มีบัญชีธนาคาร ส่วน dark mode กับภาษาไทยยังไม่ได้ดู
- allowlist 22 ชื่อ: ap-invoice.{findAll,findOne,create,update,delete,submit,approve,review,reject,void} และ ap-payment.{findAll,findOne,outstandingDocuments,whtPreview,create,update,delete,submit,approve,review,reject,void}

**Why:** เปิดหน้า AP โดยไม่ allowlist ก่อน = user ถูก logout new-api-name-401-logs-users-out

## Watch out
ลำดับคือ allowlist → deploy FE; dashboard ยังเป็น mock (มีป้าย) · ดู grn-auto-ap-invoice

**5 Nov 03:30 (ตั้งค่าและทดสอบบน T02):**
- ตั้ง gl_setting แล้ว: fiscal year = Jan, reversal = RV, AP JV = JV, AP control = 2120005, Input VAT = 1112008, WHT payable = 2121002
- สร้าง draft APIV26110001 แล้ว (vendor A001, 1,000, Dr 4031008) แก้แล้ว Save ผ่าน
- submit ไม่ผ่าน เพราะ "GL period is not open"
- บัญชีธนาคารยังไม่ได้สร้าง: ฟอร์มบังคับใส่ GL แบบ asset แต่ COA ของ T02 ไม่มี category สักบัญชี และ classifier บล็อกการแก้ COA
…

_From Claude Code's memory of this repo, last updated Nov 5._
