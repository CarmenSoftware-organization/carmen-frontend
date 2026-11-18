---
title: "หัวเอกสาร PR อยู่ในการ์ดมีพื้นหลัง และปุ่มย้อนกลับย้ายเข้าไปอยู่ในแถวชื่อ"
author: Thammanoon
date: 2026-11-18
branch: feature/pr-item-responsive
cost: { minutes: 4, tokens: 58459 }
id: l-a27d4ba6
scope: repo
status: active
src: agent
touches:
  - components/loader/doc-page-skeleton.tsx
  - components/share/doc-form-header.tsx
  - components/share/form-toolbar.tsx
  - routes/procurement/purchase-request/pr-edit-content.tsx
  - routes/procurement/purchase-request/pr-form.tsx
  - routes/procurement/purchase-request/pr-header.tsx
  - routes/procurement/purchase-request/pr-new-content.tsx
---

## Decided
2026-11-18 ผู้ใช้สั่งให้หัวเอกสาร PR (ชื่อ ปุ่ม ผู้ขอ Workflow/Description) อยู่ในการ์ดที่มีพื้นหลัง เส้นคั่นใต้หัวจึงเอาออก ทำเฉพาะ PR เอกสารอื่นยังเป็นหัวแบบเดิม

## Tried and ruled out
- คงปุ่มย้อนกลับแบบลอยออกซ้ายของชื่อ แล้วเว้นที่ซ้ายของการ์ด (ps-11 / ps-10): แถวปุ่มบนมือถือ 390 เหลือที่ไม่พอ ปุ่ม Activity ตกไปบรรทัดสอง ซึ่งผิดกฎว่าปุ่มบนหัวต้องอยู่บรรทัดเดียว

## Watch out
- ปุ่มย้อนกลับอยู่ในแถวชื่อแล้ว บรรทัดผู้ขอ/แผนก/วันที่จึงเริ่มที่ขอบซ้ายของการ์ด ไม่ได้เริ่มตรงกับชื่อเอกสาร
- ถ้าจะทำการ์ดให้เอกสารอื่น ต้องส่ง inlineBack ให้ FormToolbar และส่ง headerCard ให้ DocPageSkeleton ของใบนั้นด้วย ไม่งั้นปุ่มย้อนกลับจะทับขอบการ์ด และเนื้อหาจะกระโดดตอนโหลดเสร็จ

In the code: DOC_HEADER_CARD + headerCard ใน components/loader/doc-page-skeleton.tsx · inlineBack ใน components/share/doc-form-header.tsx / form-toolbar.tsx · routes/procurement/purchase-request/pr-header.tsx
