---
title: "แอป carmen-inventory-mobile ยังเป็น internal/ทดสอบ ยังไม่ live จึง break API ได้…"
author: Thammanoon
date: 2026-11-09
id: l-2456a513
scope: repo
status: active
touches:
  - CLAUDE.md
---

## Decided
ณ 2026-09-17 แอป `carmen-inventory-mobile` **ยังไม่ปล่อยให้ผู้ใช้จริง** — อยู่ขั้น
internal/ทดสอบเท่านั้น (ยืนยันจาก user โดยตรง) `eas.json` production track ตั้ง
`releaseStatus: "draft"` และ CLAUDE.md ของรีโปสั่งให้ขึ้น track `internal` ก่อนเสมอ

**สำคัญ:** แอปนี้ **ไม่มี force-update และไม่มี expo-updates (OTA)** — ถ้าปล่อย live
เมื่อไหร่ เครื่องที่ผู้ใช้ไม่กดอัปเดตเองจะค้างกับ API เวอร์ชันเก่าถาวร

**Why:** ตอนออกแบบการเปลี่ยน API contract ครั้งใหญ่ (flat → object) คำถามชี้ขาดคือ
"break mobile ได้ไหม" ถ้าไม่รู้ข้อนี้จะต้องออกแบบ dual-emit หรือ versioned endpoint
ซึ่งใหญ่กว่ามากและทำให้ contract สกปรกกว่าเดิมในช่วงเปลี่ยนผ่าน

## Watch out
ตราบใดที่ยังไม่ live → breaking change ที่ API ทำได้ ขอแค่ปล่อย
mobile build ใหม่ตามไปด้วย · **แต่ทันทีที่ปล่อย live ข้อสมมตินี้ตายทันที** ต้องถาม
ผู้ใช้ยืนยันสถานะใหม่ก่อนออกแบบ breaking change รอบถัดไป และควรผลัก force-update
เข้าแอปก่อนปล่อยจริง ดู api-flat-to-object-contract

_From Claude Code's memory of this repo, last updated Sep 16._
