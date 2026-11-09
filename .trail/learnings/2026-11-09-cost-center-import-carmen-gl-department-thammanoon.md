---
title: Cost center import จาก Carmen GL (department_path)
author: Thammanoon
date: 2026-11-09
id: l-1c3eb6bc
scope: repo
status: active
touches:
  - styles/toast.css
---

## Decided
ปุ่ม "นำเข้าจาก Carmen GL" ที่ `/config/cost-center` — BE #903 (merge `7fa4e7ee0`) + FE #434 (merge `50f5f4a6`) merge 2026-10-22 **ยังไม่ deploy / ยังไม่ทดสอบในเบราว์เซอร์**

ลำดับ deploy: BE → เติม api_name `cost-centers.import-from-interface.carmen-gl` ใน allowlist ทุก env (ถ้าไม่ `allow_all`) → FE. ลืม allowlist = user ถูก logout (ดู new-api-name-401-logs-users-out)

**Why:** ใช้ `sync_policy` ชุดเดียวกับผังบัญชี (user เลือก); `delete` ข้ามตัวที่ยังถูกใช้แล้วแจ้งใน `in_use_codes`; `upsert` เปิดใช้งานตัวที่ปิดไว้ (ให้เหมือน Carmen GL)
BE ย้ายโค้ดเรียก Carmen 4 ไปที่ helper กลาง `micro-business/src/master/carmen-gl-interface/` — ผังบัญชีใช้ร่วม ไม่มีเทสครอบการ import ผังบัญชีจาก interface

## Watch out
หลัง deploy dev ให้กด import ผังบัญชีหนึ่งครั้งด้วย เพื่อยืนยัน refactor · `styles/toast.css` เพิ่ม `white-space: pre-line` ให้ description ของ toast ทั้งแอป

_From Claude Code's memory of this repo, last updated Oct 22._
