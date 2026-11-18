---
title: "แถบแท็บของหน้ารายละเอียดบนมือถือต้องเลื่อนในแถบเอง มีขอบจางบอกว่ายังมีแท็บ และเลื่อนแท็บที่เลือกเข้าจอ"
author: Thammanoon
date: 2026-11-18
branch: fix/product-detail-header-card
cost: { minutes: 5, tokens: 61957 }
id: l-0d82a85b
scope: repo
status: active
src: agent
touches:
  - routes/product-management/product/pd-edit-content.tsx
  - routes/product-management/product/pd-form-toolbar.tsx
  - routes/product-management/product/pd-form.tsx
  - routes/product-management/product/pd-images.tsx
  - routes/product-management/product/pd-tab-general.tsx
  - routes/product-management/product/pd-tab-scroller.tsx
---

## Decided
- 2026-11-19 ตรวจหน้ารายละเอียดสินค้าที่ 390/360: 4 แท็บกว้าง ~424px ในกล่อง 334/304px ทำให้ทั้งหน้าเลื่อนซ้าย-ขวา และที่ 360 แท็บที่ 4 หายพ้นขอบพอดีโดยไม่มีอะไรบอก
- แก้: แถบเลื่อนในตัวเอง (ทรงเดียวกับ GRN) + ขอบจาง 24px เฉพาะด้านที่ยังมีแท็บซ่อน + แท็บที่เลือกถูกเลื่อนเข้าจอเมื่อเปลี่ยนแท็บ (รวมตอน onInvalid สลับแท็บเอง)

## Tried and ruled out
- scrollIntoView({ inline: "nearest" }) กับแท็บที่เลือก: เลื่อนทั้งหน้าแนวตั้งตามไปด้วย → คำนวณ scrollLeft ของแถบเองจาก offsetLeft (กล่องแถบต้อง relative ให้ offsetLeft นับจากมัน)

## Watch out
- วัดการล้นด้วย getBoundingClientRect หลอกได้: แถบแท็บที่อยู่ในตัวเลื่อนยังเกินขอบจอเสมอ ให้วัดว่ากล่องไหนมี overflow-x auto/scroll และ scrollWidth > clientWidth แทน
- GRN ใช้ตัวห่อเลื่อนแบบเดียวกันแต่ยังไม่มีขอบจาง/เลื่อนแท็บที่เลือกเข้าจอ — ถ้าจะใช้ซ้ำต้องยกขึ้น components/ ก่อน (ESLint ห้ามข้ามโมดูล)
- ตารางกรอกของแท็บ Unit (โหมดแก้) มีกล่องเลื่อนแนวนอนซ้อน 2 ชั้นจากโครง DataGrid ยังไม่ได้แก้

In the code:
- routes/product-management/product/pd-tab-scroller.tsx — PdTabScroller({ active }), FADE = 24, ResizeObserver บนกล่อง + TabsList, mask-image ตาม edge
- pd-form.tsx ห่อ <TabsList variant="line" className="w-max justify-start"> ด้วย <PdTabScroller active={tab}>
