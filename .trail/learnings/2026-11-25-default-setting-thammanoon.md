---
title: "หน้า Default Setting: ค่าของเอกสารแยกการ์ดตามเรื่อง (จัดซื้อและคลัง / มิติ / ผู้สร้างอนุมัติเอง) ไม่รวมเป็นการ์ดการทำงานของเอกสารใบเดียว"
author: Thammanoon
date: 2026-11-25
branch: docs/trail-vercel-partial-deploy
cost: { minutes: 4, tokens: 46994 }
id: l-489a19bd
scope: repo
status: active
replaces: l-67a02def
src: agent
touches:
  - routes/system-admin/default-setting/default-setting-component.tsx
---

## Decided
2026-11-25 ผู้ใช้บอกว่าการ์ด "การทำงานของเอกสาร" (Document behavior) อ่านแล้วปนกัน แม้จะแบ่งกลุ่มด้วยหัวตัวเล็กในการ์ดเดียวแล้วก็ตาม จึงเลือกเองว่า "แยกการ์ดตามเรื่อง":
- หัว Document behavior ถูกยุบ เหลือการ์ดตามเรื่อง ได้แก่ จัดซื้อและคลัง (PR/SI/PO ใช้ป้ายรหัสเอกสาร), มิติ (Dimension) และ "ผู้สร้างอนุมัติเอกสารของตัวเองได้"
- การ์ดการอนุมัติถามคำถามครั้งเดียวที่หัวการ์ด ส่วนค่าข้างในใช้ชื่อเอกสาร (AP Invoice / AP Payment / AR Invoice / AR Receipt) เพราะเดิมคำถามเดียวกันซ้ำ 4 ครั้ง ชื่อยาวจนตัดบรรทัดทุกช่อง
- การ์ดการอนุมัติใช้กริดตายตัว 4 / 2 / 1 ตามความกว้างการ์ด (container query) ส่วนการ์ดอื่นใช้ auto-fit 15rem
- ยังใช้ของเดิม: โหมดดูของ Print Forms รวมใบที่ใช้ค่าระบบเป็นกริดรายชื่อ และคอนโทรลไม่ยืดตามช่อง (max-w-sm ใน ConfigField)

## Tried and ruled out
- กริดแบนในการ์ดเดียว (คำตัดสิน 13 พ.ย.): ตอนนั้นมี 3 ค่า พอเป็น 10 ค่าจาก 6 หมวดค่าก็ปนกัน และป้าย "มิติ (Dimension)" กว้างจนบีบชื่อค่า
- การ์ดเดียวที่แบ่งกลุ่มเป็นคอลัมน์ มีหัวตัวเล็กและเส้นใต้: ผู้ใช้ดูแล้วบอกว่า "ยังรู้สึกว่ามันปนกัน อ่านเข้าใจยาก" ตาแยกไม่ออกว่ากลุ่มจบตรงไหน
- auto-fit กับการ์ดการอนุมัติ: ที่ 1366 ได้ 3+1 ทำให้ AR Receipt ตกไปอยู่แถวเดียว

## Watch out
- หมวดใหม่ใน registry จะกลายเป็นการ์ดของตัวเองโดยอัตโนมัติ ถ้าจะรวมเข้าการ์ดที่มีอยู่ ต้องเพิ่มใน DOC_CARD_OF_SECTION
- ชื่อค่า AP/AR และมิติใน messages เขียนให้อ่านใต้หัวการ์ด ถ้าเอาไปใช้ที่อื่นที่ไม่มีหัวการ์ด ความหมายจะไม่ครบ
- สถานะที่มีทั้งใบพิมพ์ที่ตั้งเองและใบที่ใช้ค่าระบบปนกันยังไม่เคยเห็นในเบราว์เซอร์จริง

In the code:
- `routes/system-admin/default-setting/default-setting-component.tsx` — `DOC_CARD_OF_SECTION`, `groupDocSections`; การ์ดอนุมัติ `grid-cols-1 @sm:grid-cols-2 @3xl:grid-cols-4`; `printShown` / `printDefaults`
- `messages/{th,en}.json` — `defaultSetting.sections.purchasing(Desc)`, `selfApprove(Desc)` (ลบ `documents`/`documentsDesc` ออก), ชื่อ config ของ dimension/AP/AR
