---
title: "แอปรู้ว่าเป็นสภาพแวดล้อม dev จากคีย์ APP_ENV ใน config ไม่ตั้งถือว่าไม่ใช่ dev"
author: Thammanoon
date: 2026-11-20
standing: true
id: l-bf5c0fa7
scope: repo
status: active
src: init-sessions
touches:
  - lib/runtime-config.ts
  - public/config.sample.json
---

## Decided
- ไม่มีค่าใดบอกชนิดสภาพแวดล้อมได้ และ config.prod ชี้ไปที่ backend ของ dev จึงใช้ดูจาก URL ไม่ได้ ทีมเลือกเพิ่มคีย์ใหม่เพื่อโชว์ config key ใต้ป้ายเฉพาะ dev
- In the code: ใช้ isDevAppEnv() ใน lib/runtime-config.ts (ค่า local|dev|uat|prod) ไม่ใช้ import.meta.env.DEV, BACKEND_URL หรือ OTEL_ENVIRONMENT public/config*.json ถูก gitignore ต้องเติม "APP_ENV": "dev" ในไฟล์ของ env ที่ deploy ด้วยมือ ตัวอย่างอยู่ใน public/config.sample.json

_From past Claude sessions here, Nov 20._
