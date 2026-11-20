---
title: "แอปรู้ว่ารันอยู่ env ไหนจากคีย์ APP_ENV ใน runtime config ไม่ตั้ง = ไม่ใช่ dev"
author: Thammanoon
date: 2026-11-20
branch: feature/default-vat-service-rate
cost: { minutes: 3, tokens: 37826 }
id: l-65f7e6b7
scope: repo
status: active
src: agent
touches:
  - messages/en.json
  - messages/th.json
  - routes/system-admin/company-profile/company-profile-config-registry.test.ts
  - routes/system-admin/company-profile/company-profile-config-registry.ts
  - routes/system-admin/company-profile/company-profile-form-schema.test.ts
  - routes/system-admin/company-profile/company-profile-form-schema.ts
  - routes/system-admin/company-profile/company-profile-ui.tsx
  - routes/system-admin/default-setting/default-setting-component.tsx
  - lib/runtime-config.ts
  - public/config.sample.json
---

## Decided
2026-11-20 ผู้ใช้สั่งให้หน้า Default Setting โชว์ config key ใต้ป้ายเฉพาะตอนอยู่ env dev แล้วเลือกให้เพิ่มคีย์ใหม่ `APP_ENV` (local | dev | uat | prod) ใน runtime config เป็นตัวบอก env ของ deployment ถ้าค่าเป็น dev หรือ local ถือว่าเป็นของทีมและเปิดของสำหรับทีมได้ ถ้าไม่ตั้งหรือเป็นค่าอื่นจะไม่เปิด เพื่อให้ prod ปลอดภัยไว้ก่อน

## Tried and ruled out
- `import.meta.env.DEV`: เปิดแค่ตอนรัน `bun dev` ในเครื่อง ส่วน dev ที่ deploy ไว้ไม่เห็นเลย
- เดาจาก BACKEND_URL (มีคำว่า dev/localhost): ตอนนี้ build prod (`config.prod.json`) ก็ชี้ไปที่ backend dev อยู่ Vercel จึงจะโชว์ไปด้วย
- ใช้ `OTEL_ENVIRONMENT`: ถ้าไม่ตั้ง ค่าจะเป็น "dev" ทำให้ prod ที่ลืมตั้งเผยของสำหรับทีม และคีย์นี้มีผลเฉพาะตอนเปิด telemetry

## Watch out
- `public/config*.json` ถูก gitignore ต้องเติม `"APP_ENV": "dev"` ด้วยมือใน env ที่อยากเปิด ถ้าลืมเติม ของสำหรับทีมจะซ่อนเงียบ ๆ โดยไม่มี error (ซึ่งเป็นด้านที่ปลอดภัย)
- อยากให้ Vercel โชว์ด้วยต้องตั้งใน config.prod.json ซึ่งใช้ build ขึ้น Vercel

In the code: `isDevAppEnv()` ใน lib/runtime-config.ts (trim+lowercase, ยังไม่โหลด config = false); ConfigField prop `showKey`; default-setting-component ส่ง `showKey={isDevAppEnv()}` ให้ ConfigField ทุกตัว; ตัวอย่างอยู่ใน public/config.sample.json
