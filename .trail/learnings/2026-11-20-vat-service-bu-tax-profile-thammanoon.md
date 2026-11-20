---
title: "VAT% และ Service% ตั้งต้นของ BU เป็นตัวเลขที่กรอกเอง ยังไม่ผูกกับ Tax Profile และยังไม่มีใครอ่าน"
author: Thammanoon
date: 2026-11-20
branch: feature/default-vat-service-rate
cost: { minutes: 8, tokens: 249495 }
id: l-4874a16e
scope: repo
status: active
src: agent
---

## Decided
2026-11-20 ผู้ใช้เลือกให้ Default VAT% เป็นช่องกรอกตัวเลข 0–100 ไม่ได้เลือกจาก Tax Profile และให้ Default Service% "เก็บค่าไว้ก่อน" ยังไม่ต้องมี flow ไหนนำไปใช้ ทั้งสองค่าอยู่ในการ์ด "General" แยกออกมาบนสุดของหน้า Default Setting เพราะเป็นค่าของทั้ง BU ไม่ใช่ของเอกสารใบใด

## Tried and ruled out
- dropdown เลือก Tax Profile (เก็บ id) ตัวนี้ผมแนะนำเพราะใช้ข้อมูลชุดเดียวกับเอกสาร แต่ผู้ใช้เลือกกรอกเลขเอง
- เอาไปไว้ใน section "Tax" หรือรวมกับการ์ด Document behavior: ผู้ใช้เลือก General แทน ส่วนการ์ด Document behavior จะติดป้ายชื่อ section หน้าค่าแต่ละตัว ซึ่งไม่เข้ากับค่าระดับ BU

## Watch out
- VAT ในเอกสารยังมาจาก Tax Profile ที่ผูกกับสินค้า/หมวด เลข 7 ตรงนี้จึงอาจไม่ตรงกับ Tax Profile ถ้าวันหน้าจะนำค่านี้ไปใช้ ต้องตัดสินก่อนว่าค่าไหนชนะ
- ค่าตั้งต้น (7 / 0) จะส่งไป backend ก็ต่อเมื่อผู้ใช้แก้ค่า ถ้าไม่มีใครแตะ ใน DB จะไม่มีค่านี้ ส่วนที่จะอ่านค่านี้ต้องใช้ค่าตั้งต้นชุดเดียวกัน

In the code: keys `general.default-vat-rate` (default "7"), `general.default-service-rate` (default "0"); datatype "number" ใหม่ใน ConfigField (company-profile-ui.tsx) ตรวจ min/max ใน superRefine ของ config (company-profile-form-schema.ts) ข้อความ validation.numberRange; section "general" อยู่ท้าย CONFIG_SECTIONS (เทสต์เดิมนับ index ว่า pr อยู่ตัวแรก) แต่ default-setting-component.tsx แสดงไว้บนสุด
