---
title: "ผังการผูกบัญชี"
author: Thammanoon
date: 2026-11-09
id: l-c63c56dd
scope: repo
status: active
touches:
  - "components/ui/data-grid/columns.tsx#selectColumn"
---

## Decided
`/config/chart-of-account-mapping` ได้ 3 อย่างบน branch `feature/coam-column-sort` (ทั้ง 2 รีโป): sort ฝั่ง server
(`sort=<key>:asc|desc` whitelist 9 คอลัมน์), ป้ายเตือนสั้นลิงก์ไปแก้ที่ต้นทาง, และ batch edit
(`POST /account-mapping/batch-update` บันทึกเท่าที่ได้ → updated/conflicts/not_found) — PR BE #825 (8973b298c), FE #282 (30db4c13) merge เข้า main แล้ว 2026-10-15 ยังไม่ deploy ทุก env (มีเทสต์ BE 101 / FE 42 แล้ว)

**Why:** ลำดับ deploy พลาดแล้วเจ็บ — api_name ใหม่ `account-mapping.batchUpdate` ไม่อยู่ใน allowlist = user โดนเด้งไป
login ตอนกด Save (new-api-name-401-logs-users-out); FE ก่อน BE = กด sort แล้วไม่มีอะไรเกิดแบบเงียบ ๆ

## Watch out
allowlist (เช็กด้วย POST `{"items":[]}` ต้องได้ 400 ไม่ใช่ 401) → BE (rebuild rpc-contract) → FE
- เจอระหว่างทำ: หน้านี้ไม่เคยแสดงคอลัมน์ checkbox เลย (`tableLayout.checkbox` หาย — DataGridTable ซ่อน id "select")
  ปุ่ม "ยืนยันว่าตรวจแล้ว" จึงใช้ไม่ได้มาตั้งแต่แรก แก้ใน #282 แล้ว — หน้าอื่นที่ใช้ `selectColumn` ควรเช็กแบบเดียวกัน
- ยังไม่ทดสอบในเบราว์เซอร์: เส้น conflict ของ batch edit (ทดสอบแค่ curl)

_From Claude Code's memory of this repo, last updated Oct 14._
