---
title: "หน้าที่กด Save แล้วอยู่หน้าเดิม ค่าในโหมดดูต้องอ่านด้วย useWatch ไม่ใช่ getValues ไม่งั้นโชว์ค่าเก่าจนกว่าจะ reload · ตาราง Equipment ซ่อนคอลัมน์ตามกล่องลงบรรท…"
author: Thammanoon
date: 2026-11-19
branch: fix/equipment-header-card-tablet-list
cost: { minutes: 10, tokens: 104352 }
id: l-eb41f91a
scope: repo
status: active
src: agent
touches:
  - routes/operation-plan/equipment/use-eq-table.tsx
---

## Decided
2026-11-19 ผู้ใช้สั่งให้หน้ารายละเอียด Equipment ใช้หัวการ์ดแบบ PR และตรวจตาราง list ที่ iPad
- หัวการ์ด: โหมดดู ribbon = แถบสรุปเดิม (รูปย่อ · Category · Maintenance · Availability · Station) · โหมดแก้ ribbon = Code · Name · Category · General เหลือ Brand/Model/Serial/Description
- ตาราง list: เลือกคอลัมน์ตามความกว้างกล่อง (useElementWidth) คอลัมน์ที่ซ่อนลงบรรทัดรองใต้ชื่อ (Category · Brand Model · Station · Inactive) และ `2 / 2` ลงใต้รหัสในกล่องแคบสุด

## Tried and ruled out
- Availability แคบ 90 ที่ iPad: หัว "Available / Total" กว้าง 108 + padding ทับหัว Maintenance → ซ่อนคอลัมน์ในขั้นแคบสุด แทนการบีบ (ต้องใช้ 135)
- Maintenance 150: ป้าย "Overdue 264 days" กว้าง 128 + padding ถูกตัด → 160 ทุกขั้น

## Watch out
- หมวดโหมดดูที่อ่าน `form.getValues()` ตอน render: หน้าที่ Save แล้วไม่กลับ list (Equipment) ฟอร์ม reset เป็นค่าใหม่แต่หมวดไม่วาดใหม่ ข้อมูลบันทึกจริงแต่จอโชว์ค่าเก่าจนกว่าจะ reload — typecheck/เทสต์ไม่จับ เจอจากกด Save จริงแล้วดูโหมดดู ใช้ `useWatch({ control })` แทน หน้าที่ Save แล้วกลับ list (Cuisine, Recipe Category) ไม่เจอเพราะ mount ใหม่
- ตาราง audit ของ Equipment: "Last updated" ไม่มีชื่อ (—) น่าจะเป็นบั๊ก micro-business ไม่ส่ง updated_by แบบเดียวกับ Price List
- input file ที่ซ่อนในช่องรูป (eq-image-field) ยื่นเลยขอบขวาในโหมดแก้ (ของเดิม ไม่ทำให้หน้าเลื่อน)

In the code: routes/operation-plan/equipment/use-eq-table.tsx (columnTier ผลรวม 1378/1278/1158/918/768/563) · eq-component.tsx (useElementWidth) · eq-header-fields.tsx (ribbon + useFormState) · eq-toolbar.tsx · eq-*-section.tsx (useWatch แทน getValues)
