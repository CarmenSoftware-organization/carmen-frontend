---
title: "หน้า landing ของ System Admin แสดงเฉพาะของจริง: ไม่มีตัวเลขสถิติตายตัว คำอธิบายมาจากหน้านั้นเอง การ์ดครบทุกหน้าในเมนูและตามสิทธิ์เดียวกับเมนู"
author: Thammanoon
date: 2026-11-13
branch: feature/system-admin-landing-compact
cost: { minutes: 24, tokens: 174035 }
id: l-88b23292
scope: repo
status: active
src: agent
touches:
  - hooks/use-profile.ts
  - routes/profile/user-profile-setting.tsx
  - routes/system-admin/system-admin-landing.tsx
  - routes/system-admin/landing-types.ts
  - messages/en.json
  - messages/th.json
---

## Decided
2026-11-13 ผู้ใช้สั่งบนหน้า landing ของ System Admin ทีละข้อ: จัดให้เต็มจอและกะทัดรัด → "ตัดตัวเลขปลอมออก และเพิ่มเครื่องมือที่ขาด" → "แก้ไขส่วนที่เหลือ" (ภาพประกอบที่มีข้อมูลสมมติ คำอธิบายที่อ้างเกินจริง ปุ่มที่กดแล้วไม่เกิดอะไร การ์ดที่ไม่กรองสิทธิ์)
- ตัวเลขบนการ์ดและบนหัวหน้าเคยเป็นข้อความตายตัวในไฟล์แปล ("14 roles · 87 permissions", "v2026.05", "5 chapters · 11 tools") — ตัดออกทั้งหมด จะมีตัวเลขได้ต้องดึงจาก API
- คำอธิบายของการ์ดใช้ข้อความเดียวกับคำอธิบายบนหัวของหน้านั้น ไม่เขียนข้อความโฆษณาแยก (ของเดิมอ้างความสามารถที่ไม่มี เช่น Running Code = "รัน JavaScript ตาม cron" ทั้งที่หน้าจริงคือรูปแบบเลขที่เอกสาร)
- ทุกหน้าในเมนูซ้ายมีการ์ด (เพิ่ม 6 ใบ รวม 17 ใบ 6 chapter) และสถานะสิทธิ์ของการ์ดมาจากตัวตรวจเดียวกับเมนูซ้าย: ถูกซ่อน = ไม่มีการ์ด · ล็อก/ไม่มีสิทธิ์ = การ์ดจาง กดแล้วบอกเหตุผล
- แถบท้ายหน้า (ปุ่ม handbook / sandbox) ลบทั้งแถบ — ไม่มีของจริงรองรับ

## Tried and ruled out
- กริด auto-fit สำหรับเรียง chapter: chapter สูงไม่เท่ากัน (2–5 การ์ด) กริดเหลือที่ว่างใต้ chapter ที่เตี้ยและช่องเปล่าในแถวสุดท้าย → ใช้ CSS multi-column
- ความกว้างคอลัมน์ขั้นต่ำ 22rem: ที่จอ 1366 (sidebar กาง) ได้แค่ 2 คอลัมน์ การ์ดกว้าง 533px → ใช้ 20rem ได้ 3 คอลัมน์
- ภาพประกอบสูง 96px: ภาพที่มี 3–4 แถวถูกตัดขอบบน → คง 112px และลดแถวของภาพ Dataset

## Watch out
- เพิ่มหน้าใหม่ในเมนู System Admin ต้องเพิ่มการ์ดที่ landing ด้วย (ไม่มีเทสต์ดัก)
- ภาพประกอบใหม่ใช้เส้นแทนข้อความ ห้ามใส่ชื่อคน เลขที่เอกสาร เวลา หรือเปอร์เซ็นต์สมมติ ป้ายในภาพต้องตรงกับหน้าจริง (Notification Template เหลือช่องทาง In-app ช่องทางเดียว)
- เลข chapter นับจากที่แสดงจริง — chapter ที่การ์ดถูกซ่อนหมดจะหายทั้งหมวด เลขต้องไม่กระโดด
- สถานะล็อก/ไม่มีสิทธิ์ของการ์ดตรวจด้วยการบังคับสถานะชั่วคราวในโค้ด ไม่ได้ลองด้วยบัญชี non-admin จริง

In the code:
- routes/system-admin/system-admin-landing.tsx — `columns: 20rem N`, `useVisibleModules(SYSTEM_ADMIN_SUBS)`, `MENU_PATHS`
- routes/system-admin/landing-types.ts `CHAPTERS` · landing-module-card.tsx (ลิงก์ทั้งใบ / ปุ่ม + `dispatchPermissionDenied`) · landing-visuals.tsx (`Line`, `ListViz`)
- messages/en.json, messages/th.json → `systemAdmin.landing.modules.<key>.{name,one}`; `one` คัดลอกจาก `systemAdmin.<page>.desc`
- ลบ routes/system-admin/landing-footer.tsx
- .claude/skills/carmen-blue-ui-design/values.md §รายการ (สูตร multi-column)
