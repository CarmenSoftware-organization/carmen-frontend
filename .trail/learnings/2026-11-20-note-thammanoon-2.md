---
title: "รูปโปรไฟล์ผู้ใช้ทุกจุด"
author: Thammanoon
date: 2026-11-20
id: l-96ab9c1a
scope: repo
status: active
touches:
  - public/config.local.json
---

## Decided
BE #1051 (976b8aa26) + FE #542 (66999992) merge 11 พ.ย. 2026 · dev backend `/version` = 976b8aa26 · FE `vercel --prod` v2.5.59

**ตรวจจริงบน dev แล้ว (11 พ.ย.):** `/api/T02/users` มี `avatar_url` ครบทุกแถว (2/11 มีรูป; cold 2.7s, warm 0.34s) ·
PR detail `requestor_avatar` เป็น URL · activity-logs `actor_avatar` 27/27 · comment `audit.created.avatar` → URL โหลดได้ 200 image/png ·
ไม่มี `avatar_file_token` หลุด · เบราว์เซอร์: workflow config / comment / หัว PR 12px / status bar ขึ้นรูป ทั้ง dark+light, คนไม่มีรูปเหมือนเดิม
— PO/GRN/SR ยังไม่เจอใบที่ผู้ซื้อ/ผู้รับมีรูป (โค้ดทางเดียวกับ PR)

**Why:** ต้นเหตุคือ micro-cluster `resolveByIds` คืน `avatar: null` ตายตัว

## Watch out
- UAT/prod: deploy gateway + micro-cluster ก่อน FE · ไม่มี migration / api_name ใหม่
- Backend CI ยังโดน billing (11 พ.ย.) → deploy dev ต้อง SSH มือ (ดู backend-ci-blocked-by-billing)
- ตรวจ FE ในเครื่องกับ dev backend: สลับ `public/config.local.json` ให้ `BACKEND_URL: ""` ชั่วคราว + `VITE_DEV_PROXY_TARGET=https://dev.blueledgers.com:4001` (CONFIG_ENV รับแค่ local/dev/uat/prod, dev:dev ตรง ๆ โดน CORS) แล้วคืนไฟล์

ดู local-backend-test-accounts

_From Claude Code's memory of this repo, last updated Nov 10._
