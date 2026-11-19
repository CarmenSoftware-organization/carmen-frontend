---
title: "หน้า Price List Template: General ย้ายเข้าการ์ดหัวแบบ PR ไม่วางคู่ Instructions แล้ว ตารางสินค้ายังให้ MOQ/หน่วยติดชื่อสินค้า"
author: Thammanoon
date: 2026-11-19
branch: fix/price-list-template-header-card
cost: { minutes: 1, tokens: 3380 }
id: l-81751648
scope: repo
status: active
replaces: l-35a1a179
src: agent
touches:
  - routes/vendor-management/price-list-template/plt-form.tsx
---

## Decided
- 2026-11-19 ผู้ใช้สั่งให้หน้า template ใช้หัวการ์ดแบบ PR: ช่อง General (Currency · Validity · Description) อยู่ใน ribbon ของการ์ดหัว + ตาราง audit · Instructions to vendor เป็นหมวดเดี่ยวหมวดแรกของฟอร์ม เลิก SECTION_PAIR (ไม่มีคู่แล้ว)
- โหมดแก้: Validity (stepper) กว้าง 2 ช่อง Description ช่องเดียว (เหมือนเดิม) · โหมดดู: Description ช่องเดียวตั้งแต่ @md ให้อยู่แถวเดียวกับช่องอื่นข้างตาราง audit
- ตารางสินค้าโหมดดู (plain table) ยังเหมือนเดิม: กล่อง ≥@3xl คอลัมน์ข้อมูลกว้างเท่าเนื้อหา (w-px) Note รับที่เหลือ · กล่องแคบชื่อสินค้าห่อบรรทัด

## Tried and ruled out
- จุดสลับ @xl ของตารางสินค้า: กว้างขั้นต่ำ ~734px ที่ tablet ล้น → ใช้ @3xl
- Validity + Description กว้าง 2 ช่องทั้งคู่ในโหมดแก้: ตกคนละแถวในกริด 3 คอลัมน์

## Watch out
- NameWithSubtext ตัดข้อความบรรทัดเดียว (nowrap) ในตาราง auto layout ต้องปลด [&_p]:whitespace-normal ตอนกล่องแคบ
- ยังไม่ได้ลอง: Save จริง, skeleton ในเบราว์เซอร์, ไทย, ไม่มีสินค้า, หลาย MOQ tier, หน้า /new

In the code: routes/vendor-management/price-list-template/plt-form.tsx (generalFields, ribbon, DocAuditLine) · plt-item-grouped-view.tsx (@container, @3xl) · plt-form-skeleton.tsx (การ์ดหัว)
