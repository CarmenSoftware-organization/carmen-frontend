---
title: "หัวเอกสารใบลดหนี้: โหมดดูเป็นข้อความ ช่องที่ตามมาจาก GRN เป็นข้อความเสมอ แต่สกุลเงินกลับเป็นกล่องล็อกเมื่อเลือก GRN ใหม่"
author: Thammanoon
date: 2026-11-18
branch: main
cost: { minutes: 4, tokens: 42461 }
id: l-ad1aa80c
scope: repo
status: active
src: agent
touches:
  - routes/procurement/credit-note/cn-general-fields.tsx
  - routes/procurement/credit-note/cn-edit-content.tsx
---

## Decided
- 2026-11-18 ผู้ใช้สั่งจัดหน้า CN detail ตาม skill carmen-blue-ui-design แบบเดียวกับ GRN: โหมดดูทุกช่องเป็นป้ายจาง + ค่าเด่น ใน FieldGrid (คอลัมน์ตามความกว้างกล่อง) ผู้ขาย/คำอธิบายกว้าง 2 ช่อง ตารางรายการคงเดิม
- GRN Date / Invoice No. / Invoice Date ตามมาจาก GRN ที่เลือก ไม่มีโหมดไหนแก้ได้ → ข้อความทั้งสองโหมด

## Tried and ruled out
- สกุลเงินเป็นข้อความเสมอในโหมดแก้: ทำไม่ได้ เพราะฟอร์มถือแค่ id สกุลเงิน และ lookup GRN ของ CN (endpoint vendor/:id/cn) ส่งมาแค่ currency_id แบน ไม่มีรหัส — จึงใช้รหัสจากข้อมูลใบเฉพาะเมื่อยังเป็น GRN ใบเดิม เลือก GRN ใหม่แล้วกลับไปใช้ LookupCurrency ที่ล็อกไว้ (มันแปลง id เป็นรหัสเอง)

## Watch out
- ชื่อเหตุผลกับรหัสสกุลเงินของโหมดดูมาจาก prop (creditNote.cn_reason.name / currency.code) ไม่ใช่จากฟอร์ม
- ยังไม่ได้ลอง: กด Save จริง, เลือก GRN ใบใหม่ในโหมดแก้, โครงตอนโหลด, ภาษาไทย

In the code:
- routes/procurement/credit-note/cn-general-fields.tsx — props isView/reasonName/currencyCode, sameGrn → currencyText
- routes/procurement/credit-note/cn-edit-content.tsx — DocPageSkeleton ribbon="text" fields [2,1×10,2]
- ผลวัดโหมดดู 390/768/1366/1920/4K = 1/2/4/6/6 คอลัมน์ ไม่มีหน้าเลื่อนแนวนอน
