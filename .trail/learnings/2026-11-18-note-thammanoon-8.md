---
title: "ผู้สร้างและผู้แก้ล่าสุดของเอกสารอยู่บรรทัดล่างสุดของแถบท้ายหน้า เป็นตัวเล็กสีจางบรรทัดเดียว"
author: Thammanoon
date: 2026-11-18
branch: feature/pr-audit-footer
cost: { minutes: 1, tokens: 2990 }
id: l-dbdbef50
scope: repo
status: active
src: agent
touches:
  - components/share/doc-audit-line.tsx
  - components/ui/summary-bar.tsx
  - routes/procurement/purchase-request/workflow/pr-footer-action.tsx
---

## Decided
2026-11-18 ผู้ใช้สั่งให้ข้อมูลผู้สร้าง/ผู้แก้ล่าสุดอยู่ในแถบท้ายหน้า (แถบเดียวกับยอดรวมและปุ่ม Submit) เรียงแนวนอนตัว 12px สีจาง รูปแบบ "สร้างโดย: ชื่อ (วันเวลา) | แก้ไขล่าสุด: ชื่อ (วันเวลา)" เพื่อไม่แย่งความสนใจจากปุ่ม Save/Submit อยู่บรรทัดล่างสุดใต้ยอดรวมกับปุ่ม

## Tried and ruled out
- การ์ดเส้นประใต้รายการสินค้า (PR #678): ผู้ใช้ดูแล้วสั่งย้ายไปแถบท้ายหน้า
- วางในแถวเดียวกับยอดรวม: เบียดยอดรวมและดันปุ่มตกบรรทัดเร็วขึ้นบนจอกลาง
- ใส่ในการ์ดหัวเอกสาร: การ์ดซ้อนการ์ด
- ใช้ชื่อผู้ขอแทนผู้สร้าง: อาจเป็นคนละคน จึงไปแก้ backend ให้ส่ง id (BE #1085)

## Watch out
- ตัวคั่นเป็น border-s ของช่องที่สอง ไม่ใช่ตัวอักษร "|" จะได้ไม่ค้างหัวบรรทัดเมื่อตัดบรรทัด
- ห้าม truncate บนมือถือ วันที่จะถูกตัดเป็น "…" ให้ข้อความตัดบรรทัดและวันที่ whitespace-nowrap
- ชื่อไม่ขึ้นมีแต่วันที่ = API ไม่ส่ง audit.created.name ให้ดู schema ตอบกลับฝั่ง micro ก่อน

In the code: components/share/doc-audit-line.tsx (DocAuditLine) · prop meta ของ SummaryFooterBar ใน components/ui/summary-bar.tsx · routes/procurement/purchase-request/workflow/pr-footer-action.tsx · key field.auditCreatedBy / field.auditUpdatedBy · PR #681
