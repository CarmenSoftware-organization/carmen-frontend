---
title: "โปรไฟล์อีเมลผู้ส่งเหลือแค่ sender+SMTP"
author: Thammanoon
date: 2026-11-09
id: l-50b00dbc
scope: repo
status: active
touches:
  - types/email-profile.ts
---

## Decided
2026-09-16: ตัด `reply_to` · `default_cc` · `subject_template` · `body_template` · `note`
ออกจากโปรไฟล์อีเมล (`/system-admin/email-profile`) ทั้งฟอร์ม, `types/email-profile.ts`,
schema และ fallback ใน po-send-email-dialog / rfp-send-email-dialog — หัวเรื่อง/เนื้อความ/CC
มาจากคลังข้อความ (email-template-store-and-rfp-send) ทางเดียว

**Why:** โปรไฟล์ควรตอบแค่ "ส่งจากใคร ผ่าน SMTP ไหน" ส่วนข้อความเป็นของคลังตาม doc type

## Watch out
- `EmailProfileSchema` ฝั่ง backend (`micro-business/src/app-config/app-config.service.ts`)
  **ยังมีฟิลด์เหล่านี้ครบและเป็น `.default('')`** → FE ไม่ส่งมาก็ไม่ 400 แต่ค่าเดิมจะถูกทับเป็น
  ค่าว่างทันทีที่ผู้ใช้กด Save โปรไฟล์นั้น (โปรไฟล์ที่ไม่ได้แก้ผ่าน dialog ยังคงคีย์เดิมไว้
  เพราะ FE ส่ง object ที่ได้จาก GET กลับไปทั้งก้อน)
- **`reply_to` ยังถูกใช้ตอนส่งจริง** (`purchase-order.service.ts`, `request-for-pricing.service.ts`)
  แต่ตอนนี้ไม่มี UI ตั้งค่าแล้ว — ถ้า BU ไหนอยากได้ Reply-To ต้องเพิ่ม UI กลับหรือแก้ที่ DB
…

_From Claude Code's memory of this repo, last updated Sep 16._
