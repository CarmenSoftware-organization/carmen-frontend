---
title: "หัวหน้า PR Template เป็นการ์ดหัวเอกสารแบบ PR (ช่องข้อมูลเป็น ribbon) และช่องใน ribbon ต้อง subscribe error ด้วย useFormState เอง"
author: Thammanoon
date: 2026-11-18
branch: main
cost: { minutes: 10, tokens: 253226 }
id: l-e40c7d68
scope: repo
status: active
replaces: l-0df80718
src: agent
touches:
  - routes/procurement/purchase-request-template/use-prt-item-table.tsx
  - routes/procurement/purchase-request-template/prt-general-fields.tsx
  - routes/procurement/purchase-request-template/prt-form-skeleton.tsx
  - routes/procurement/purchase-request-template/prt-form.tsx
---

## Decided
- 2026-11-18 ผู้ใช้สั่งให้หน้า PR Template detail ใช้ style เดียวกับ PR: การ์ดหัวเอกสารใบเดียว (DOC_HEADER_CARD + FormToolbar inlineBack) มีชื่อ + ป้าย Active (คั่นเส้นแบบ pr-header) + ปุ่ม แล้วช่องข้อมูลเป็น ribbon — ไม่มีการ์ด General แยกอีกใบ
- โหมดดู ribbon = Workflow + Description (dense) + ตาราง audit/rev. ชิดขวา (มือถือเป็นไอคอน DocAuditButton) ชื่ออยู่ที่ title สถานะอยู่ที่ badge จึงไม่ซ้ำใน ribbon · โหมดแก้ = Workflow · Name · Status switch · Description
- ตารางรายการ (คงจาก learning เดิม): กล่อง < 1140px = แบ่งสัดส่วน + min-w-[760px] เลื่อนแนวนอน · กล่อง ≥ 1140px = คอลัมน์ข้อมูลกว้างคงที่ แล้ว grow คอลัมน์สุดท้าย (โหมดดู = จุดส่งของ, โหมดแก้ = ปุ่มลบ) · โหมดดูชุดกว้างสินค้า 440 (ผลรวม 1130)

## Tried and ruled out
- อ่าน `form.formState.errors` จาก prop ในคอมโพเนนต์ที่ส่งเป็น ribbon: React Compiler memo element นั้นไว้ (props คงที่) กด Save ชื่อว่างแล้ว submit ยิงจริงแต่ช่องไม่ขึ้นแดงเลย — ต้องใช้ `useFormState({ control })` ในคอมโพเนนต์เอง
- ใช้ DocPageSkeleton: มีแถบสรุปยอดด้านล่างที่แม่แบบไม่มี จึงเขียนโครงเองให้ตรงการ์ดหัว
- grow ตลอดเวลา / grow จุดส่งของในโหมดแก้ (จาก learning เดิม): ล้นที่ tablet / lookup ยืดพันกว่า px ที่ 4K

## Watch out
- ช่องใน ribbon อยู่นอก <form> — Enter ไม่ submit (เหมือน PR) ส่วนปุ่ม Save ผูก form="prt-form" ค่าส่งครบเพราะ register กับ RHF
- เปลี่ยน size คอลัมน์ต้องคำนวณ PRT_ITEM_WIDE_BOX ใหม่
- แก้ ribbon ต้องแก้ prt-form-skeleton.tsx ตาม

In the code: routes/procurement/purchase-request-template/prt-form.tsx (header card), prt-general-fields.tsx (ribbon, useFormState), prt-form-skeleton.tsx, use-prt-item-table.tsx (PRT_ITEM_WIDE_BOX), prt-item-fields.tsx
