---
title: "ตารางกรอกในแท็บสินค้า (หน่วย คลัง) โหมดแก้บนกล่องแคบเป็นการ์ดกรอกทีละแถว ไม่ใช่ตารางเลื่อนแนวนอนแล้ว"
author: Thammanoon
date: 2026-11-18
branch: fix/product-detail-header-card
cost: { minutes: 6, tokens: 63636 }
id: l-19db97eb
scope: repo
status: active
src: agent
touches:
  - messages/en.json
  - messages/th.json
  - routes/product-management/product/pd-form.tsx
  - routes/product-management/product/pd-tab-scroller.tsx
  - routes/product-management/product/pd-row-cards.tsx
  - routes/product-management/product/pd-tab-unit-conversion.tsx
---

## Decided
- 2026-11-19 ผู้ใช้สั่ง "fix on edit mode" แล้วเลือกการ์ดกรอกทีละแถว — แทนคำตัดสิน 13 พ.ย. ที่ให้ตารางโหมดแก้มีความกว้างขั้นต่ำแล้วเลื่อนแนวนอน (ตาราง 852–904px ในกล่อง 304–334px ของมือถือ และตารางหน่วยมีตัวเลื่อนซ้อน 2 ชั้นจากโครง DataGrid)
- เกณฑ์: โหมดแก้เป็นการ์ดเมื่อกล่องแคบกว่าความกว้างขั้นต่ำของตารางนั้นเอง (หน่วย 852 · คลัง 900) — ไม่มีขนาดไหนต้องเลื่อนแนวนอนอีก ตั้งแต่ขั้นต่ำขึ้นไปยังเป็นตาราง
- การ์ด render cell ของคอลัมน์ตัวเดิมผ่าน flexRender (lookup / ช่องจำนวน / radio / checkbox / ปุ่มลบ) — ช่องกรอกผูกฟอร์มที่ column def ที่เดียว ไม่มีชุดที่สอง · ป้ายมาจาก header ที่เป็น string · คอลัมน์ลำดับเป็น "#n" หัวการ์ด ปุ่มลบมุมขวาบน
- กริดในการ์ด auto-fill minmax(8rem): มือถือ 360 ได้ 2 ช่อง · tablet 768/1024 ได้ 4 · lookup คลังและ Conversion กินเต็มแถว

## Tried and ruled out
- กริด 2 คอลัมน์ตายตัว: ที่ 1024 ช่องกรอกยืดกว้าง ~230px การ์ดสูงเกินจำเป็น (ผิดกฎ "กว้างขึ้น = คอลัมน์มากขึ้น")
- minmax(9rem): ที่ 360 การ์ดในกว้าง ~278px เหลือคอลัมน์เดียว

## Watch out
- cell ใส่ justify-end / justify-center ไว้ให้ตรงหัวคอลัมน์ — การ์ดล้างด้วย *:justify-start ที่ตัวห่อชั้นในสุด (ใส่ชั้นนอกไม่โดน root ของ cell)
- header ที่เป็นฟังก์ชันไม่มีป้าย จะขึ้น column id แทน — คอลัมน์ใหม่ต้องใช้ header เป็น string
- พบระหว่างทดสอบ (ยังไม่ได้แก้ ยังไม่ได้ยืนยันในโหมดตาราง): แก้ To Qty 1→2 แล้วคืนเป็น 1 ปุ่ม Save ยังเปิดอยู่ น่าจะเพราะค่าจาก input เป็น string ไม่ใช่ number
- ชื่อสินค้าบนหัวโหมดแก้ที่ 1024 ถูกตัดท้ายเป็นการตัดสินใจของทีม (คอมเมนต์ใน doc-form-header) ไม่ใช่บั๊ก

In the code:
- routes/product-management/product/pd-row-cards.tsx — RowEditCards({ table, wide, titleColumnId="index", actionColumnId="action", empty })
- pd-tab-unit-conversion.tsx asEditCards (< 852, wide=["conversion"]) · pd-tab-locations.tsx asEditCards (< 900, wide=["location"])
