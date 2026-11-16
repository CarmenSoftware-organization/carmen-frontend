---
title: "ก่อนตัด release ให้ทิ้งเลขเวอร์ชันที่ build ในเครื่องเพิ่มเองไว้ และ commit ที่ไม่ใช่ฟีเจอร์ของแอปอย่าใช้ feat"
author: Thammanoon
date: 2026-11-16
branch: main
cost: { minutes: 14, tokens: 84357 }
id: l-0e9736ac
scope: repo
status: active
src: agent
touches:
  - CHANGELOG.md
  - changelog.json
  - package.json
  - messages/en.json
  - messages/th.json
  - routes/procurement/purchase-request/pr-auto-allocate.test.ts
  - routes/procurement/purchase-request/pr-auto-allocate.ts
  - routes/procurement/purchase-request/pr-item-fields.tsx
  - routes/procurement/purchase-request/pr-last-vendor-notice.tsx
  - routes/procurement/purchase-request/pr-pricelist-compare.tsx
---

## Decided
- ก่อนรัน build:bump ให้ทิ้งการเปลี่ยนเลข patch ใน package.json ที่ `bun run build` ในเครื่องทำค้างไว้ (ทั้งที่อยู่ใน working tree และที่ commit แล้วแต่ยังไม่ push) แล้ว sync main กับ origin ก่อน เพราะ build:bump กำหนดเลขเวอร์ชันใหม่เองอยู่แล้ว (minor = x.(y+1).0)

## Tried and ruled out
- เก็บ commit ที่เปลี่ยนแค่เลขเวอร์ชันแล้วเขียนข้อความเป็น `feat:` ไว้ ไม่ทำ เพราะ changelog generator จะนับเป็นรายการ Added ใน What's New

## Watch out
- `bun run build` ในเครื่องเพิ่มเลข patch เองทุกครั้ง ทำให้ tree ไม่สะอาด และ build:bump จะไม่ยอมรัน
- commit `feat:` ที่ไม่ใช่ฟีเจอร์ของแอป (ไฟล์ skill ของ agent, mock) จะไปขึ้นใน What's New ด้วย ถ้าเป็นงาน tooling ให้ใช้ `chore:` หรือ `docs:` (generator ข้าม type เหล่านี้)

In the code: scripts/changelog.ts (เฉพาะ feat→added, fix→fixed นอกนั้นถูกทิ้ง) · ตัวอย่างใน v2.7.0: 43a9dbc4, 9710b519
