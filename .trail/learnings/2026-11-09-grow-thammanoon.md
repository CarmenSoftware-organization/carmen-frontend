---
title: "ตารางแก้ไขที่มีหลายคอลัมน์ ให้กันการบีบบนจอแคบด้วยความกว้างขั้นต่ำของตาราง อย่าใช้คอลัมน์ grow"
author: Thammanoon
date: 2026-11-09
branch: fix/pl-detail-edit-narrow
cost: { minutes: 1, tokens: 2518 }
id: l-5fdfa186
scope: repo
status: active
src: agent
touches:
  - routes/vendor-management/price-list/pl-item-table.tsx
  - components/ui/data-grid/data-grid-table.tsx
  - components/share/doc-form-header.tsx
---

## Decided
- ตารางแก้ไขของ Price List (13 คอลัมน์) บนจอแคบเคยถูกบีบจนหัวคอลัมน์ทับกันและช่องกรอกยุบ เพราะ DataGrid แปลง size ของทุกคอลัมน์เป็น % ของ table-fixed แก้ด้วย `tableClassNames.base = "min-w-[1100px]"` ทำให้ desktop แบ่ง % เหมือนเดิม ส่วนจอแคบเลื่อนแนวนอนแทนการบีบ

## Tried and ruled out
- ตั้ง `meta.grow` ให้คอลัมน์ Product ใช้ไม่ได้ เพราะ grow ทำให้คอลัมน์อื่นเป็น px และล็อกความกว้างขั้นต่ำไว้ที่ผลรวม size (~1,500px) ซึ่งกว้างกว่าพื้นที่ desktop จริง (~1,250px) ผลคือ desktop ก็ต้องเลื่อนแนวนอน และคอลัมน์ Preferred/ลบหลุดออกนอกกรอบ

## Watch out
- ตัวห่อปุ่มบนหัวเอกสาร (`DocFormHeader`) เป็น `shrink-0` ถ้าไม่ใส่ `max-w-full` บนจอแคบปุ่มท้ายแถวอย่าง Activity จะล้นออกนอกจอแทนที่จะขึ้นบรรทัดใหม่ แก้ตัวนี้แล้วมีผลทุกหน้าฟอร์ม
- เช็กจอแคบตอน Chrome เต็มจอได้ด้วย iframe กว้าง 390px ที่ฉีดเข้าไปในหน้า เพราะ resize_window ไม่มีผล

In the code: routes/vendor-management/price-list/pl-item-table.tsx, components/ui/data-grid/data-grid-table.tsx (headerWidthPercent, growMinWidth), components/share/doc-form-header.tsx
