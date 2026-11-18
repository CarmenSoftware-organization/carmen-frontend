---
title: "หัวเอกสาร GRN: โหมดดูเป็นข้อความ และช่องที่ถูกล็อกในโหมดแก้ก็เป็นข้อความด้วย ตารางรายการคงเดิม"
author: Thammanoon
date: 2026-11-18
branch: fix/grn-detail-header-view-text
cost: { minutes: 5, tokens: 239398 }
id: l-512ed3cf
scope: repo
status: active
src: agent
touches:
  - components/loader/doc-page-skeleton.tsx
  - routes/procurement/goods-receive-note/grn-edit-content.tsx
  - routes/procurement/goods-receive-note/grn-form-header.tsx
  - routes/procurement/goods-receive-note/grn-form.tsx
  - routes/procurement/purchase-request/pr-edit-content.tsx
  - routes/procurement/purchase-request/pr-new-content.tsx
---

## Decided
- 2026-11-18 ผู้ใช้สั่งจัดหน้า GRN detail ตาม skill carmen-blue-ui-design: ช่องหัวใบโหมดดูเป็นป้ายจาง + ค่าเด่น ใน FieldGrid (คอลัมน์ตามความกว้างกล่อง) ผู้ขาย/คำอธิบายกว้าง 2 ช่อง
- ในโหมดแก้ ช่องที่ล็อก (ผู้ขาย+วันที่รับของของใบ saved หรือใบจาก PO, สกุลเงินของใบ committed) เป็นข้อความเหมือนโหมดดู — กรอบมีเฉพาะช่องที่แก้ได้จริง ตำแหน่งช่องไม่ย้ายเวลาสลับโหมด
- ตารางรายการสินค้าคงเดิม (ตามแนวเดียวกับ PR detail)

## Tried and ruled out
- ทดสอบกด Save จริงบนใบ saved ใน dev DB: ไม่ทำ เพราะ Save ของใบ saved ทำให้หลังบ้านลงสต๊อกใหม่ ต้องใช้ใบร่างที่สร้างเพื่อทดสอบแทน

## Watch out
- เงื่อนไขล็อกใช้ isView ไม่ใช่ disabled — disabled รวม isPending ด้วย ถ้าใช้ช่องจะกลายเป็นข้อความชั่วขณะตอนกดบันทึก
- โครงตอนโหลด GRN ใช้ ribbon="text" แล้ว: เพิ่ม/ย้ายช่องหัวใบต้องแก้ fields ที่จุดเรียกด้วย
- ยังไม่ได้ดู: ภาษาไทย, ใบ committed/ร่าง, โครงตอนโหลดในเบราว์เซอร์

In the code:
- routes/procurement/goods-receive-note/grn-form-header.tsx — prop isView, vendorLocked/grnDateLocked/currencyLocked
- components/loader/doc-page-skeleton.tsx — ribbon="text" รับ fields/tabs/toolbar; PR ส่ง fields={[1, 2]} tabs={false} toolbar
- ผลวัดโหมดดู: 390/768/1366/1920/4K = 1/2/4/6/6 คอลัมน์ ไม่มีหน้าเลื่อนแนวนอน
