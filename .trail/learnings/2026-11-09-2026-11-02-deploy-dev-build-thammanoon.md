---
title: "(แก้แล้ว) 2026-11-02 Deploy Dev (build.yml) รันอัตโนมัติตอน push main แล้ว"
author: Thammanoon
date: 2026-11-09
id: l-3a0e95d8
scope: repo
status: active
touches:
  - "scripts/bump.ts#main"
  - "scripts/gen-widget-docs.ts#main"
---

## Decided
ทุก job ใน GitHub Actions ของ `carmen-turborepo-backend-v2` ขึ้น fail ภายใน 2–3 วินาที
พร้อม annotation `The job was not started because recent account payments have failed or
your spending limit needs to be increased` (พบ 2026-09-21 กับ PR #655)

**Why:** check สีแดงบน PR ของรีโปนี้จึงไม่ใช่สัญญาณว่าโค้ดมีปัญหา — job ไม่เคยเริ่มรันเลย
การไล่อ่าน log จะได้แค่ `log not found` เสียเวลาเปล่า และถ้าเชื่อว่าโค้ดพังจะไปแก้ของที่ไม่ได้เสีย

## Watch out
ยืนยันด้วยการรันในเครื่องแทน CI ก่อน merge —
`cd apps/backend-gateway && npx jest <path>` (ใช้ jest config ของแอป ห้ามรันจาก root
เพราะจะกวาด `apps/*/dist/**/*.spec.js` ที่พังอยู่แล้วเข้ามาด้วย) และ
`bunx tsc --noEmit -p apps/<app>/tsconfig.json` แล้วเขียนผลนั้นไว้ในตัว PR ·
`main` ไม่มี branch protection (บัญชีไม่ใช่ GitHub Pro — API ตอบ 403) จึง merge ทับ
check แดงได้ตรง ๆ · ถ้าวันไหน job เริ่มรันจริงให้ลบบันทึกนี้ทิ้ง ·
เทสต์ที่แดงจริงบน main อยู่ที่ known-failing-tests-on-main

**Deploy Dev ก็โดนด้วย (ยังเป็นอยู่ 2026-10-06)** — push เข้า main ไม่ deploy dev ให้ ต้องทำมือ:
…

_From Claude Code's memory of this repo, last updated Sep 21._
