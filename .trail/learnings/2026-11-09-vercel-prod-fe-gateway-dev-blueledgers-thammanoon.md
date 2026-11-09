---
title: "ห้าม vercel --prod ของ FE จนกว่า gateway บน dev.blueledgers.com จะตอบ google/authorize ได้"
author: Thammanoon
date: 2026-11-09
id: l-d2ad68fa
scope: repo
status: active
touches:
  - components/auth/google-sign-in-button.tsx
  - "scripts/bump.ts#main"
  - "scripts/gen-widget-docs.ts#main"
---

## Decided
ตั้งแต่ 2026-10-02 main ของ carmen-inventory-frontend-react มีงาน Google sign-in (ปุ่มหน้า login + หน้าคำเชิญ, `components/auth/google-sign-in-button.tsx`) **ไม่มี flag ซ่อน** — เข้ามาทาง PhiranatCsb merge `main` เข้า `prod` (`0d9bee00`) ที่ไปอยู่บน first-parent ของ main โดยไม่ผ่าน PR
ตอนตรวจ `https://dev.blueledgers.com:4001/api/auth/google/authorize` (BACKEND_URL ของ Vercel prod) ตอบ 404 · gateway local :4000 ก็ 404 · โค้ด endpoint มีแล้วใน backend main/prod
User เลือก "รอ backend" — ไม่ซ่อนปุ่ม ไม่ deploy ทั้งที่พัง

**Why:** deploy FE ตอนนี้ = ผู้ใช้กดปุ่ม Google แล้วเจอ JSON 404 ของ gateway; gateway ที่ขึ้นแล้วแต่ไม่มี `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` จะตอบ 503 แทน

## Watch out
ก่อน `vercel --prod` ทุกครั้ง curl `$BACKEND_URL/api/auth/google/authorize?app=app&locale=en` ต้องได้ 302 ไป Google — ถ้ายังไม่ใช่ ห้าม deploy และบอก user · checklist อยู่ใน `carmen-accounting-task/tasklist.md` หัวข้อ ⛔ · #222 (permission ระดับ resource) ตรวจผ่านแล้ว รอขึ้นรอบเดียวกัน
เกี่ยวข้อง: vercel-deploy-cli-only permission-key-audit-against-db
…

_From Claude Code's memory of this repo, last updated Oct 2._
