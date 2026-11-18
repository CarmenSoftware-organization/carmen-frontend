---
title: "หัวเอกสาร PR PO GRN CN SR อยู่ในการ์ดมีพื้นหลัง รวมช่องข้อมูลหัวใบไว้ในการ์ดเดียวกับชื่อและปุ่ม"
author: Thammanoon
date: 2026-11-18
branch: feature/pr-item-responsive
cost: { minutes: 1, tokens: 3897 }
id: l-9b51261d
scope: repo
status: active
replaces: l-a27d4ba6
src: agent
touches:
  - components/loader/doc-page-skeleton.tsx
  - components/share/doc-form-header.tsx
  - routes/procurement/credit-note/cn-form.tsx
  - routes/procurement/credit-note/cn-header.tsx
  - routes/procurement/goods-receive-note/grn-form.tsx
  - routes/procurement/goods-receive-note/grn-header.tsx
  - routes/procurement/purchase-order/po-form.tsx
  - routes/procurement/purchase-order/po-header.tsx
  - routes/procurement/purchase-request/pr-edit-content.tsx
  - routes/procurement/purchase-request/pr-header.tsx
---

## Decided
2026-11-18 ผู้ใช้สั่งให้หัวเอกสาร PR อยู่ในการ์ดมีพื้นหลัง แล้วสั่งต่อให้ทำแบบเดียวกันกับ PO, GRN, CN, SR การ์ดรวมชื่อเอกสาร ปุ่ม บรรทัดผู้ขอ และช่องข้อมูลหัวใบ (ผู้ขาย วันที่ สกุลเงิน ฯลฯ) เส้นคั่นใต้หัวเอาออก ปุ่มย้อนกลับย้ายเข้าไปอยู่ในแถวชื่อ

## Tried and ruled out
- คงปุ่มย้อนกลับแบบลอยออกซ้ายของชื่อ แล้วเว้นที่ซ้ายของการ์ด (ps-11 / ps-10): แถวปุ่มบนมือถือ 390 เหลือที่ไม่พอ ปุ่มตกไปบรรทัดสอง ผิดกฎว่าปุ่มบนหัวต้องอยู่บรรทัดเดียว
- ย้ายหัวเอกสารเข้าไปอยู่ใน <form> เพื่อห่อการ์ดรวมกับช่องข้อมูล: Button ไม่ได้ตั้ง type ไว้ ปุ่มบนหัวทุกตัวจะกลายเป็น submit จึงส่งช่องข้อมูลขึ้นไปเป็น ribbon ของหัวแทน (ทางเดียวกับ PR)

## Watch out
- ช่องข้อมูลหัวใบตอนนี้อยู่นอก <form> แล้ว การกด Enter ในช่องเหล่านี้จึงไม่ submit (PR ตั้งใจกันไว้แบบนี้อยู่แล้ว)
- ปุ่มย้อนกลับในแถวชื่อใช้ self-start เพราะเลขที่เอกสารยาวจน badge ตกบรรทัด ปุ่มจะไปอยู่กลางสองบรรทัด
- บรรทัดผู้ขอ/แผนก/วันที่เริ่มที่ขอบซ้ายของการ์ด ไม่ได้เริ่มตรงกับชื่อเอกสาร
- DocPageSkeleton วาดหัวเป็นการ์ดทุกเอกสารแล้ว (ไม่มี prop headerCard อีก) เอกสารใหม่ที่ใช้ skeleton นี้ต้องเป็นการ์ดด้วย

In the code: DOC_HEADER_CARD ใน components/loader/doc-page-skeleton.tsx · inlineBack ใน components/share/doc-form-header.tsx และ form-toolbar.tsx · prop ribbon ของ po-header / grn-header / cn-header / sr-header ซึ่งฟอร์มของแต่ละใบส่งช่องข้อมูลเข้ามา
