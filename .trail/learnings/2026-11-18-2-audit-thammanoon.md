---
title: "หน้ารายละเอียดสินค้าโหมดดู: หัวการ์ดเหลือ 2 แถว (ตัวตนคู่ audit) และตัดของที่มีประโยชน์เฉพาะตอนแก้"
author: Thammanoon
date: 2026-11-18
branch: main
cost: { minutes: 24, tokens: 225749 }
id: l-0d99f370
scope: repo
status: active
src: agent
touches:
  - routes/product-management/product/pd-form-toolbar.tsx
---

## Decided
- 2026-11-19 ผู้ใช้สั่งให้หัวหน้าสินค้าเหมือน PR (การ์ดมีพื้น ปุ่มย้อนกลับในแถวชื่อ ตาราง audit + rev.) แล้วเลือกทั้ง 4 ข้อจากการตรวจ design: หัวการ์ด 2 แถว · ซ่อนกรอบ "No images" ในโหมดดู · ตัดคำอธิบายใต้หัว Additional Attributes ในโหมดดู · ตัดคำอธิบายใต้ flag ในโหมดดู
- โหมดดูที่มี audit: บรรทัดรหัส/หมวด/หน่วย ย้ายจาก subtitle ไปอยู่ใน ribbon ซ้าย ตาราง audit ขวา แถวเดียวกัน · โหมดแก้/ไม่มี audit ยังเป็น subtitle
- ป้ายสถานะไม่มีเส้นคั่นแบบหัว PR: ชื่อสินค้ายาวไม่แน่นอน ที่ 768–820 ป้ายตกบรรทัดแล้วเส้นคั่นค้างหน้าป้าย (container query ตรวจการตกบรรทัดไม่ได้)
- backend: micro-business products findOne ไม่ส่ง created_at/created_by_id/updated_at/updated_by_id gateway จึงประกอบ audit ไม่ได้ (branch fix/product-detail-audit ทรงเดียวกับ PO #1087)

## Watch out
- ซ่อน/ตัดของโหมดดูต้องใช้ isView ไม่ใช่ isDisabled — isDisabled ของ useEntityForm = isView || isPending ใช้แล้วกด Save ช่องรูปหายและช่องข้างรูปกระโดด
- ribbon ของ DocFormHeader มี pt-4 — ฝั่งสินค้าใช้ -mt-3.5 หักล้าง และตาราง audit ต้องมี mt-1.5 ไม่งั้นชิดแถวปุ่มเหลือ ~2px
- ตอนโหลดรูปยังขึ้น skeleton สี่เหลี่ยมก่อน แล้วหายไปถ้าไม่มีรูป (ช่องข้างรูปขยายตาม)

In the code:
- routes/product-management/product/pd-form-toolbar.tsx — DOC_HEADER_CARD + inlineBack, identityLine, hasAudit → ribbon
- pd-images.tsx prop hideWhenEmpty · pd-tab-general.tsx prop isView, ToggleCell desc optional, wrapper empty:hidden
- pd-edit-content.tsx PdPageSkeleton (หัวเป็นการ์ด)
