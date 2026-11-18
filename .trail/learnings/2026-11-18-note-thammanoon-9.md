---
title: "ผู้สร้างและผู้แก้ล่าสุดของเอกสารเป็นตารางเล็กในการ์ดหัวเอกสาร มือถือเหลือไอคอน"
author: Thammanoon
date: 2026-11-18
branch: feature/pr-audit-footer
cost: { minutes: 1, tokens: 3283 }
id: l-55051db6
scope: repo
status: active
replaces: l-de04709e
src: agent
touches:
  - components/share/doc-audit-line.tsx
---

## Decided
2026-11-18 ผู้ใช้ไล่ปรับข้อมูลผู้สร้าง/ผู้แก้ล่าสุดของ PR, PO, GRN, CN, SR จนจบที่: ตารางเล็กตารางเดียว 2 แถว (สร้างโดย | ชื่อ | วันเวลา / แก้ไขล่าสุด | ชื่อ | วันเวลา) ตัว 10px สีจาง วางชิดขวาล่างในการ์ดหัวเอกสาร เฉพาะโหมดดู · บนมือถือ (< sm) ซ่อนตาราง เหลือไอคอน Info ท้ายบรรทัดเมตา (ผู้ขอ · แผนก · วันที่) แตะเปิด popover / เมาส์ hover เปิด

## Tried and ruled out
- บรรทัดเดียวคั่นด้วย | ในแถบท้ายหน้า: ผู้ใช้ว่ายังไม่สวย ขอเป็นตาราง
- กล่องแยกต่อรายการ (สองกล่องเรียงข้างกัน): ผู้ใช้ขอให้อยู่ตารางเดียวกัน
- ตารางในแถบท้าย: ค้างบนจอตลอดและทำแถบท้ายสูงขึ้นสองบรรทัด ผู้ใช้เลือกย้ายขึ้นหัวเอกสาร
- ลดเป็น 9px บนมือถือ: ขั้น micro-eyebrow line-height 1.2 ตัดสระบนภาษาไทย ใช้ไอคอนแทน
- ให้ตารางวางข้าง grid ฟิลด์เสมอ (PO/GRN/CN/SR): บีบ grid จาก 4 เหลือ 2 คอลัมน์ หัว GRN ที่ HD สูงเกือบเท่าตัว

## Watch out
- PR มีแค่ Workflow/Description จึงวางข้างกันได้เสมอ (grid basis-72) แต่ Description ต้องไม่กิน 2 ช่องตั้งแต่ @md ไม่งั้นตกเป็นสองแถว
- PO/GRN/CN/SR ใช้ basis-[min(100%,64rem)] กัน grid ไว้ 4 คอลัมน์ ที่ HD ตารางจึงตกบรรทัดใหม่ใต้ฟิลด์ ที่ Full HD ขึ้นไปอยู่ข้างกัน
- ซ่อนในโหมด Edit: ช่องกรอกต้องการความกว้างเต็ม
- hover เปิด popover เฉพาะ pointerType mouse — นิ้วแตะยิง pointerenter ก่อน click แล้ว toggle ปิดทันที
- ห้าม truncate ชื่อ (overflow-hidden ตัดสระบน) ให้ break-words

In the code: components/share/doc-audit-line.tsx (DocAuditLine, DocAuditButton) · ribbon ใน pr-header.tsx / po-header.tsx / grn-header.tsx / cn-header.tsx / sr-header.tsx · key field.auditInfo · PR #681
