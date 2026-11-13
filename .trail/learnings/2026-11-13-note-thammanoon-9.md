---
title: "คอลัมน์สถานะในตารางทุกตารางเป็นชิปเทา + จุดสีแบบเดียวกัน รวมสถานะเอกสารที่เคยเป็นไอคอน + ข้อความ"
author: Thammanoon
date: 2026-11-13
branch: fix/datagrid-status-chip-unify
cost: { minutes: 12, tokens: 100381 }
id: l-6ffacc08
scope: repo
status: active
src: agent
touches:
  - components/ui/status-dot-badge.tsx
  - components/share/sendback-status.tsx
---

## Decided
2026-11-13 ผู้ใช้สั่ง "check style of badge status in grid column with all datagrid make all of it same style" Claude สำรวจแล้วถามว่าจะรวมถึงระดับไหน ผู้ใช้เลือก "ทุกตารางเป็นชิปจุดสี" — สถานะเอกสารในตาราง (PR, PO, GRN, CN, SR, JV, AP, AR, Price List, Inventory Period, Report History ฯลฯ) เลิกใช้ไอคอน + ข้อความไม่มีกรอบ เปลี่ยนเป็นชิปเทา + จุดสีนำหน้า ทรงเดียวกับ Active/Inactive

นี่ย้อนการตัดสินใจเดิมที่เขียนไว้ในคอมเมนต์ของป้ายไอคอน (เหตุผลเดิม: สิบแถวกลายเป็นก้อนเทาสิบก้อน และจุดสีพึ่งสีอย่างเดียว) ผู้ใช้เห็นตัวเลือกนั้นพร้อมเหตุผลเดิมแล้วยังเลือกชิป

ขอบเขตที่ Claude ตีความเอง: เฉพาะคอลัมน์ของตาราง หัวฟอร์ม การ์ดมุมมอง grid และหน้ารายละเอียดยังเป็นไอคอน + ข้อความ (ผู้ใช้พูดถึง grid column เท่านั้น) · คอลัมน์ "ชนิดเอกสาร" (GRN/CN type, Stock In/Out) ไม่ใช่สถานะ จึงไม่แตะ · ป้ายถูกจัดเป็น sentence case ด้วย CSS ("IN PROGRESS" → "In progress") ให้เข้าชุดกับ "Active"

## Watch out
- ตารางใหม่ที่มีสถานะเอกสาร ใช้ชิปกลางตัวเดียว อย่าเขียน Badge + className จาก config เอง และอย่าใช้ป้ายไอคอนในเซลล์ตาราง
- class จัดตำแหน่ง (flex w-full justify-center) ต้องลงที่กล่องนอกของชิป ถ้าลงที่ตัวชิป ชิปจะยืดเต็มคอลัมน์
- ชิปในตารางต้องขนาด sm (สูง 22px) ขนาด xs สงวนไว้ให้การ์ด — Recipe กับ Request Price List เคยส่ง xs ในตารางจนเตี้ยกว่าเพื่อน
- มุมมองการ์ดของหน้ารายการเดียวกันยังเป็นไอคอน + ข้อความ สลับ list/grid แล้วสถานะหน้าตาไม่เหมือนกัน ยังไม่ได้ถามผู้ใช้ว่าจะเปลี่ยนด้วยไหม
- สถานะ PO sent_or_print เคยไม่มีในตารางไอคอน/สี จึงตกไปเป็นสีเทาของ fallback — เพิ่มแล้ว

In the code:
- components/ui/status-chip.tsx — StatusChip({ status, label, size, className })
- components/ui/status-dot-badge.tsx — prop dotColor (สีจาก --status-* แทน semantic tone)
- components/share/sendback-status.tsx — prop chip (คอลัมน์ send back ใน columns.tsx และ my-approval ส่งแล้ว)
- ตารางที่เคยเขียนป้ายเอง: accounting-document-list, pe-documents-dialog, on-order-dialog (→ StatusChip), report schedules (→ StatusBadge)
