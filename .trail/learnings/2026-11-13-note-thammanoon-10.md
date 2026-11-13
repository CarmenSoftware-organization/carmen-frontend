---
title: "สถานะแสดงเป็นชิปเทา + จุดสีแบบเดียวกันทุกที่ ทั้งตาราง การ์ด และหัวฟอร์ม และคอลัมน์สถานะในตารางชิดซ้ายทุกตาราง"
author: Thammanoon
date: 2026-11-13
branch: fix/status-chip-cards-headers-align
cost: { minutes: 17, tokens: 84036 }
id: l-667e3d16
scope: repo
status: active
replaces: l-6ffacc08
src: agent
touches:
  - docs/DESIGN.md
  - components/share/on-order-dialog.tsx
  - components/share/sendback-status.tsx
  - components/ui/data-grid/columns.tsx
  - components/ui/status-chip.tsx
  - components/ui/status-dot-badge.tsx
  - components/ui/status-icon-label.tsx
  - routes/accounting/accounts-payable/invoice/use-ap-invoice-table.tsx
  - routes/accounting/accounts-payable/payment/use-ap-payment-table.tsx
  - routes/accounting/accounts-receivable/ar-invoice-list.route.tsx
---

## Decided
2026-11-13 ผู้ใช้สั่งสองรอบ รอบแรก "check style of badge status in grid column with all datagrid make all of it same style" แล้วเลือก "ทุกตารางเป็นชิปจุดสี" · รอบสองสั่ง fix สองข้อที่ Claude รายงานว่าค้าง: การ์ดและหัวฟอร์มยังเป็นไอคอน + ข้อความ กับการจัดตำแหน่งชิปต่างกันในแต่ละตาราง

ผล: สถานะเอกสารทุกที่ (คอลัมน์ตาราง การ์ดมุมมอง grid หัวฟอร์ม หน้ารายละเอียด ป้าย Send back) เป็นชิปเทา + จุดสีนำหน้า ทรงเดียวกับ Active/Inactive ขนาดเดียว (สูง 22px) ป้ายเป็น sentence case ด้วย CSS · ไอคอน + ข้อความเหลือไว้ให้ "ชนิดเอกสาร" และตัวเลือกใน dropdown สถานะเท่านั้น

นี่ย้อนการตัดสินใจเดิม (ไอคอน + ข้อความไม่มีกรอบสำหรับสถานะเอกสาร เหตุผลเดิม: สิบแถวเป็นก้อนเทาสิบก้อน และจุดสีพึ่งสีอย่างเดียว) ผู้ใช้เห็นเหตุผลเดิมแล้วยังเลือกชิป

การจัดตำแหน่ง: ผู้ใช้สั่งแค่ให้เหมือนกัน ทิศทางเป็นการเลือกของ Claude — ชิดซ้ายทุกตาราง เพราะจุดสีของทุกแถวเรียงตรงกันเป็นแนวดิ่ง ป้ายไม่ลอยห่างจากคอลัมน์ก่อนหน้าเมื่อคอลัมน์กว้าง และสถานะที่มีชื่อ stage เป็นบรรทัดรอง (PR/PO/SR) ชิดซ้ายอยู่แล้ว ค่าตั้งต้นของคอลัมน์สถานะกลางจึงเปลี่ยนจากกึ่งกลางเป็นชิดซ้าย

## Tried and ruled out
- จัดกลางทุกตาราง (ตามค่าตั้งต้นเดิม): ชิปยาวไม่เท่ากันทำให้จุดสีเหลื่อมกันทุกแถว และต้องแก้ตารางเอกสารที่ชิดซ้ายอยู่ราว 26 ไฟล์ทีละไฟล์
- จัดกลางด้วย CSS จากเซลล์ที่มีชิป: เซลล์ที่ชิปอยู่ต่อท้ายชื่อ (Recipe) หรือมีป้ายอื่นร่วม (Report Schedules) จะถูกจัดกลางผิด

## Watch out
- ตารางใหม่: ใช้คอลัมน์สถานะกลาง หรือชิปกลางตัวเดียว ไม่ใส่ class จัดกลาง ไม่เขียน Badge + className จาก config เอง
- คอลัมน์ชนิดเอกสาร (GRN/CN type, Stock In/Out, Transaction type) ยังจัดกลางตามเดิม ไม่ได้แตะ
- ตารางในแท็บของหน้ารายละเอียด (Product tabs, Sales Consumption, Stock Replenishment) และหน้า config บัญชีที่มีสวิตช์สถานะ ยังไม่ได้ไล่จัดตำแหน่ง
- skeleton ของชิปในตารางชิดซ้ายตามไปด้วย (เดิมอยู่กลาง)

In the code:
- components/ui/status-chip.tsx — StatusChip({ status, label, size, className })
- components/ui/status-dot-badge.tsx — prop dotColor
- components/ui/data-grid/columns.tsx — statusColumn() ค่าตั้งต้น align start (`align: "center"` สำหรับข้อยกเว้น), sendbackColumn() ชิดซ้าย, columnSkeletons.badge ไม่มี mx-auto
- components/share/sendback-status.tsx — เป็นชิปเสมอ (ไม่มี prop chip แล้ว)
- components/share/list-card.tsx — ListCardStatusRow / ListCardSendBackRow ใช้ StatusChip
- docs/DESIGN.md — หัวข้อ "Status chip"
