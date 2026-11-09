---
title: Gateway เคยใช้ body limit default 100kb ทำ workflow save พัง
author: Thammanoon
date: 2026-11-09
id: l-2fd872c9
scope: repo
status: active
touches:
  - "scripts/bump.ts#main"
  - "scripts/gen-widget-docs.ts#main"
---

## Decided
`apps/backend-gateway/src/main.ts` เดิมไม่เคยตั้ง body-parser limit จึงใช้ค่า default ของ Express
คือ **100 KB** — PUT `/api/config/{bu}/workflows/{id}` ที่ผูกสินค้าทั้ง BU พังทันที (T02 มี 2,594
สินค้า: id ล้วน = 101 KB, อ็อบเจ็กต์เต็มแบบที่ FE เคยส่ง = 1.4 MB) แก้แล้ว 2026-08-14 เป็น `2mb`
ทั้ง appHttp/appHttps และให้ `exception.fillter.ts` อ่าน `.status`/`.statusCode` จาก Error ธรรมดา
เพื่อคืน **413** แทน 500 · ฝั่ง FE เปลี่ยน `data.products` เป็น `string[]` ตามสัญญา backend
(`micro-business/src/common/workflow/workflow.types.ts`) พร้อม zod union อ่านรูปแบบอ็อบเจ็กต์เก่าได้

**Why:** เพดานนี้เป็นด่านตรวจขนาด**ด่านเดียว**ในสาย — RPC ที่ต่อไป micro-service อ่าน body ด้วย
`Buffer.concat` ธรรมดา และ client ตั้ง `maxBodyLength: Infinity` จึงไม่มีชั้นถัดไปตรวจซ้ำ

## Watch out
merge เข้า `main` แล้วทั้งคู่ 2026-08-14 (BE `6d6ebba24` · FE `0fe96ff`)
**ยังไม่ deploy** และ **backend ต้องขึ้นก่อนหรือพร้อม FE** —
แก้ FE อย่างเดียวไม่พอเพราะ id ล้วนก็ยัง 108 KB ทะลุ 100 KB · workflow ที่เคยเซฟ products เป็น
อ็อบเจ็กต์จะยุบเหลือ id เองตอน save ครั้งถัดไป ไม่ต้องเขียน migration · เจอ endpoint อื่นที่ 500
"request entity too large" ให้ดูเพดาน 2mb นี้ก่อน · ทดสอบขนาดกับ :4000 ให้ใช้ body ที่ตั้งใจให้
invalid จะได้ไม่เขียนลง local-backend-is-shared-dev-db

**อัปเดต 2026-08-23 — deploy ขึ้นแล้วทั้งคู่** (ยืนยันโดย user) เงื่อนไข "backend ต้องขึ้นก่อนหรือพร้อม FE" ใช้ไปแล้ว

_From Claude Code's memory of this repo, last updated Aug 14._
