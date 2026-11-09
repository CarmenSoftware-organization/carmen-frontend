---
title: Notification Template เหลือช่องทาง app เดียว
author: Thammanoon
date: 2026-11-09
id: l-483bf3c6
scope: repo
status: active
touches:
  - types/noti-tmpl.ts
---

## Decided
`/system-admin/notification-template` เหลือช่องทางเดียวคือ `app` (16 ก.ย. 2026) — email/line/sms
ถือว่า obsolete ตามที่ user สั่ง

**ข้อมูลใน DB ยังอยู่ครบ:** dev BU T02 มี 80 แถว = 20 เหตุการณ์ × 4 ช่องทาง (อย่างละ 20 พอดี)
หน้า list ยิง `filter=type:app` ตายตัวใน `noti-tmpl.tsx` จึงเห็นแค่ 20 แถว — **60 แถวที่เหลือ
ไม่ได้ถูกลบ** ถ้าไปลบทีหลังต้อง backup ก่อน (`:4000` ชี้ DB dev ที่ใช้ร่วมกัน ดู
local-backend-is-shared-dev-db)

**ห้ามหด type union กลับเป็น `"app"` เดียว** — `types/noti-tmpl.ts` ประกาศครบสี่ค่าเพราะ
API ยังคืนค่าทั้งสี่จริง เคยประกาศไว้ค่าเดียวแล้วเปิดเทมเพลต email ผ่านลิงก์ตรง = ช่อง Channel
ว่างเปล่า + กด Save ไม่ผ่าน zod เงียบ ๆ · `mapToPayload` ส่ง `type` เดิมกลับไป ไม่แปลงเป็น app
และไม่ล้าง `subject` เป็น null เพื่อไม่ทำข้อมูลแถวเก่าหาย

**ตัวแปรเทมเพลต 8 ตัว** (`noti-tmpl-variables.ts`) อ่านจากข้อมูลจริงและเรียงตามความถี่:
`docNo`(80) `actorName`(60) `recipientName`(40) `url`(40) `currentStage`(20) `department`(10)
`totalAmount`(10) `reason`(10) — backend เป็นคนเติมค่าจริง ฝั่ง FE เป็นแค่รายการที่รู้จัก
สำหรับปุ่มแทรก + พรีวิว ตัวที่ไม่อยู่ในรายการจะถูกเตือนว่าจะค้างเป็น `{{...}}` ถึงผู้รับ

**ป้ายชิปต้องประกอบในโค้ด ไม่ใช่ไฟล์แปล** — ดู icu-messages-cannot-contain-braces
เพิ่มอีกกับดัก: ข้อความแปลที่มี `<...>` (เช่น `Name <[email]>`) ICU อ่านเป็น rich-text tag
แล้ว fallback เป็นชื่อคีย์ดิบบนหน้าจอ

_From Claude Code's memory of this repo, last updated Sep 16._
