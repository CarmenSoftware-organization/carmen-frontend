---
title: "บล็อก @theme inline ใน styles/badge-status.css ไม่สร้าง Tailwind utility เลย"
author: Thammanoon
date: 2026-11-09
id: l-7f088d68
scope: repo
status: active
touches:
  - styles/badge-status.css
  - main.tsx
  - styles/globals.css
  - docs/superpowers/specs/2026-08-03-workflow-track-chevron-design.md
---

## Decided
`styles/badge-status.css` มีบล็อก `@theme inline` ราว 70 บรรทัดชื่อ `TAILWIND THEME REGISTRATION`
ที่ map `--color-status-*: var(--status-*)` — **มันไม่สร้าง utility class ใด ๆ เลย** เพราะไฟล์นี้
ถูก `import` ตรงจาก `main.tsx` เป็น CSS ธรรมดา ไม่ได้ผ่าน `styles/globals.css` ซึ่งเป็นไฟล์เดียว
ที่มี `@import "tailwindcss"` — Tailwind v4 ประมวลผล `@theme` เฉพาะใน CSS entry ที่มันคอมไพล์

**Why:** ชื่อบล็อกกับเนื้อหาบอกว่ามันลงทะเบียนสีให้ Tailwind ซึ่งอ่านแล้วเชื่อสนิท เขียน
`bg-status-approved` ไปแล้ว tsc/eslint/test ผ่านหมด แต่ component ออกมาไม่มีสีเลย
เพราะไม่มี CSS rule ถูกสร้าง — ไม่มี static check ตัวไหนจับได้

## Watch out
ใช้ arbitrary value เสมอ — `bg-[var(--status-approved)]` /
`text-[var(--status-approved-fg)]` ตามที่ codebase ใช้อยู่แล้ว 78 ที่ · ตรวจว่า utility
ถูกสร้างจริงด้วย `bun run build` แล้ว `grep -o 'bg-.\{0,4\}var.\{0,3\}--status-x.\{0,4\}' dist/assets/*.css`
(Tailwind escape ทั้ง `[` `]` `(` `)` — grep ที่ escape ผิดจะได้ 0 แล้วหลงคิดว่าพัง)

กับดักคู่กัน: `color-mix(in oklch, …)` interpolate **มุม hue** — ผสมกับ `--card` ที่เป็น
`oklch(1 0 0)` (ระบุ hue = 0 ไม่ใช่ `none`) แล้ว 14% ของเขียว h=155 จะกลายเป็น h≈21 (ชมพู)
ใช้ `in oklab` แทนเสมอเมื่อผสมสีเข้าหา neutral
…

_From Claude Code's memory of this repo, last updated Aug 3._
