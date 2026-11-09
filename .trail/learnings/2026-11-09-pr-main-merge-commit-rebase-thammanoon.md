---
title: "ทุก PR เข้า main ต้อง merge commit หรือ rebase"
author: Thammanoon
date: 2026-11-09
id: l-f4cc905c
scope: repo
status: active
touches:
  - changelog.json
  - CHANGELOG.md
  - "routes/root-error-boundary.tsx#RootErrorBoundary"
  - "scripts/bump.ts#assertUpToDate"
  - "scripts/changelog.ts#recordRelease"
---

## Decided
`bun run build:bump` generate `changelog.json` + `CHANGELOG.md` เองตั้งแต่ PR #102
(`feature/build-env-scripts-changelog`) ซึ่ง **merge เข้า main แล้วที่ `8b1a9b5`** (2026-08-10)
พร้อม `bun run build:{local,dev,uat,prod}`

**ทุก PR ที่เข้า main ต้องเป็น "Create a merge commit" หรือ "Rebase and merge" — ห้าม "Squash and merge"**
`recordRelease()` สร้างช่วง git จาก `changelog.json.versions[0].commit` ถึง HEAD การ squash
จะยุบหลาย commit เหลือตัวเดียว changelog รอบหน้าจะได้ 1 รายการตามหัวข้อ squash หรือ
0 รายการถ้าหัวข้อไม่เป็น conventional commit นี่ไม่ใช่กฎเฉพาะ PR #102 แต่ใช้กับทุก PR
หลังจากนั้นตลอดไป (PR #103 merge แบบ merge commit `5d5f3d4` แล้ว)

**Why:** ไม่มีอะไรในโค้ดหรือ CI บังคับเรื่องนี้ และความเสียหายไม่แสดงตอน merge —
มันโผล่ตอน release ถัดไปในรูป changelog ที่ว่างเปล่าโดยไม่มี error

## Watch out
เลือก merge commit หรือ rebase เท่านั้นตอน merge (`gh pr merge --merge`) ·
หลัง merge ให้ `git fetch` ก่อนรัน `build:bump` เสมอ เพราะ `assertUpToDate()` อ่านแค่
remote-tracking ref ที่ค้างอยู่ ไม่ยิง fetch เอง

Follow-up ที่ park ไว้: ถ้า changelog chunk โหลดไม่สำเร็จตอนผู้ใช้กดปุ่มเวอร์ชันที่ footer
`React.lazy` จะโยน error หลุด `<Suspense>` ไปถึง `RootErrorBoundary` = จอ error เต็มหน้า
(ตอนโหลดหน้าปกติไม่กระทบแล้ว) แก้ด้วย error boundary ห่อ `<Suspense>` นั้น

เกี่ยวข้อง: known-failing-tests-on-main

_From Claude Code's memory of this repo, last updated Aug 10._
