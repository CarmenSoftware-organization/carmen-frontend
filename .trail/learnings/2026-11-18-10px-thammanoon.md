---
title: "ผู้สร้างและผู้แก้ล่าสุดของเอกสารอยู่บรรทัดล่างสุดของแถบท้ายหน้า ตัว 10px สีจาง"
author: Thammanoon
date: 2026-11-18
branch: feature/pr-audit-footer
cost: { minutes: 1, tokens: 3196 }
id: l-de04709e
scope: repo
status: active
replaces: l-dbdbef50
src: agent
touches:
  - components/share/doc-audit-line.tsx
  - components/ui/summary-bar.tsx
  - routes/procurement/purchase-request/workflow/pr-footer-action.tsx
---

## Decided
2026-11-18 ผู้ใช้สั่งให้ข้อมูลผู้สร้าง/ผู้แก้ล่าสุดอยู่ในแถบท้ายหน้า (แถบเดียวกับยอดรวมและปุ่ม Submit) เรียงแนวนอน สีจาง รูปแบบ "สร้างโดย: ชื่อ (วันเวลา) | แก้ไขล่าสุด: ชื่อ (วันเวลา)" อยู่บรรทัดล่างสุดใต้ยอดรวมกับปุ่ม แล้วสั่งให้เล็กลงอีก จึงใช้ 10px (text-micro-legal ขั้นของ ladder สำหรับ inline meta/timestamp) แทน 12px

## Tried and ruled out
- 12px (text-xs): ผู้ใช้ดูแล้วว่าใหญ่ไป สั่งให้เล็กลง
- การ์ดเส้นประใต้รายการสินค้า (PR #678): ผู้ใช้สั่งย้ายไปแถบท้ายหน้า
- วางในแถวเดียวกับยอดรวม: เบียดยอดรวมและดันปุ่มตกบรรทัดเร็วขึ้นบนจอกลาง
- ใช้ชื่อผู้ขอแทนผู้สร้าง: อาจเป็นคนละคน จึงไปแก้ backend ให้ส่ง id (BE #1085)

## Watch out
- ขั้นที่เล็กกว่า 10px (9px micro-eyebrow) ตั้งไว้ให้ป้ายตัวพิมพ์ใหญ่ ภาษาไทยอ่านยาก อย่าลดต่อ
- ตัวคั่นเป็น border-s ของช่องที่สอง ไม่ใช่ตัวอักษร "|" จะได้ไม่ค้างหัวบรรทัดเมื่อตัดบรรทัด
- ห้าม truncate บนมือถือ ให้ข้อความตัดบรรทัดได้ และวันที่ whitespace-nowrap
- ชื่อไม่ขึ้นมีแต่วันที่ = API ไม่ส่ง audit.created.name ให้ดู schema ตอบกลับฝั่ง micro ก่อน

In the code: components/share/doc-audit-line.tsx (DocAuditLine) · prop meta ของ SummaryFooterBar ใน components/ui/summary-bar.tsx · routes/procurement/purchase-request/workflow/pr-footer-action.tsx · key field.auditCreatedBy / field.auditUpdatedBy · PR #681
