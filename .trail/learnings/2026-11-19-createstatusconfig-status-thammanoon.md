---
title: "ป้ายสถานะจาก createStatusConfig เป็นอังกฤษตายตัว ต้องแปลที่จุดแสดงผลด้วยคำแปลกลุ่ม status"
author: Thammanoon
date: 2026-11-19
branch: main
cost: { minutes: 24, tokens: 297892 }
id: l-2a0fa16d
scope: repo
status: active
src: agent
touches:
  - routes/inventory-management/inventory-adjustment/ia-doc-info.tsx
  - routes/inventory-management/inventory-adjustment/ia-card.tsx
  - routes/inventory-management/inventory-adjustment/ia-component.tsx
  - routes/inventory-management/inventory-adjustment/ia-edit-content.tsx
  - routes/inventory-management/inventory-adjustment/ia-form-hero.tsx
  - routes/inventory-management/inventory-adjustment/ia-form.tsx
  - routes/inventory-management/inventory-adjustment/ia-item-cards.tsx
  - routes/inventory-management/inventory-adjustment/ia-item-fields.tsx
  - routes/inventory-management/inventory-adjustment/use-ia-table.tsx
  - constant/status-config.ts
---

## Decided
2026-11-19 ผู้ใช้สั่งแก้ป้ายสถานะของ Inventory Adjustment ที่ภาษาไทยยังขึ้น "Draft" ทั้งที่ป้ายชนิดใบแปลแล้ว
สาเหตุคือ `createStatusConfig` สร้าง label จากชื่อคีย์ (DRAFT, IN PROGRESS ...) เป็นค่าคงที่ ซึ่งเรียก useTranslations ไม่ได้
จึงแปลที่จุดแสดงผลด้วย `useTranslations("status")` + `ts(status)` แบบเดียวกับ SR และ Spot Check
ส่วน config ยังใช้สำหรับ className

## Watch out
- โมดูลอื่นที่ส่ง `XXX_STATUS_CONFIG[s].label` ให้ StatusChip จะเป็นอังกฤษในหน้าไทยเหมือนกัน
- dialog ของ Period End (pe-documents-dialog / pe-start-blocked-dialog) ยังอ่าน label จาก config ของหลายโมดูล ยังไม่ได้แก้
- คีย์ใน messages `status.*` ต้องมีครบทุกค่าของ doc_status ไม่งั้น ts() ขึ้นชื่อคีย์ดิบ

In the code:
- constant/status-config.ts `createStatusConfig` (label = status.toUpperCase())
- routes/inventory-management/inventory-adjustment: use-ia-table.tsx `IaStatusChip`, ia-card.tsx, ia-form-hero.tsx
