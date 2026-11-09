---
title: AP/GL export + COA mapping ใช้ mapping อย่างเดียว (ตัด fallback vendor/BU/adjustment…
author: Thammanoon
date: 2026-11-09
id: l-2e2beb83
scope: repo
status: active
touches:
  - "lib/__tests__/list-filter-encode.test.ts#view"
---

## Decided
2026-10-20: merge แล้ว BE #877 (2fcf0458a) + FE #378 (16840d90) แบบ merge commit, branch ลบแล้ว — **ยังไม่ deploy และยังไม่ตรวจในเบราว์เซอร์**

- AP contra = override เท่านั้น, GL adjustment = override เท่านั้น; product chain item group → sub-category → category คงเดิม (user กลับคำตัดสินเองให้คงไว้)
- AP export ไม่มี `tax_account_code` / `missing_input_vat_account` แล้ว (บัญชีภาษีซื้อตั้งที่ระบบบัญชีภายนอก)
- หน้า External เหลือแค่ API zone ไม่บันทึก `interface_export_external` อีก
- `/accounting/settings` แก้ `gl_setting` ครบ 15 ช่อง ผูก permission `configuration.app_config.view` — **role Accounting ที่ seed ไว้ไม่มีสิทธิ์นี้** ต้อง grant ก่อน user ปกติจะเห็นเมนู

**Why:** user ต้องการให้ export เอาบัญชีจาก Chart of Account mapping อย่างเดียว ไม่ให้ระบบเดาบัญชีให้

## Watch out
deploy BE ก่อน FE; release note ต้องเตือนว่าแถว AP และแถว adjustment ที่ไม่มี override จะขึ้น "ไม่ครบ" หลัง deploy (ไม่มี backfill — user เลือกเอง) ดู gl-ap-account-mapping

_From Claude Code's memory of this repo, last updated Oct 20._
