---
title: "รูปโปรไฟล์คนอื่นไม่เคยขึ้นเพราะต้นทางส่ง avatar เป็น null ตายตัว ไม่ใช่หน้าบ้านลืมแสดง"
author: Thammanoon
date: 2026-11-10
branch: feature/user-avatar-everywhere
id: l-e3b1f7c9
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-11-user-avatar-everywhere-design.md
---

## Decided
รูปผู้ใช้ที่ไม่ใช่ตัวเองไม่ขึ้นที่ไหนเลยในแอป เพราะต้นทางที่ระบบ enrichment ใช้หาชื่อผู้ใช้คืน avatar เป็น null ตายตัว (stub) ทั้งที่ช่องทางฝั่ง gateway → audit.*.avatar รองรับครบแล้ว
แก้ที่ต้นทางจุดเดียว (ให้คืน file token แล้ว gateway แปลงเป็น presigned URL) ทุกที่ที่อ่าน audit.*.avatar ได้รูปพร้อมกัน
ผู้ใช้ตัดสิน 11 พ.ย.: ทุกคนใน BU เห็นรูปของกันและกันได้ (presigned URL อายุ 1 ชม. เป็น bearer link ยอมรับได้)

## Watch out
- รายชื่อผู้ใช้ /api/:bu_code/users ไม่ผ่าน audit enrichment ต้องเติมรูปแยก
- presign ของ micro-file ไม่เช็คเจ้าของไฟล์ จึง presign รูปของคนอื่นได้
- cache ชื่อผู้ใช้ TTL 60s สั้นกว่าอายุ URL 1 ชม. จึงไม่มี URL หมดอายุค้างใน cache

In the code:
- micro-cluster apps/micro-cluster/src/cluster/user/user.service.ts resolveByIds (avatar: null stub)
- gateway common/enrichment/user-name-resolver.service.ts, audit-shape.ts mutateToAuditShape
- micro-file src/files/files.controller.ts getPresignedUrl
- spec docs/superpowers/specs/2026-11-11-user-avatar-everywhere-design.md
