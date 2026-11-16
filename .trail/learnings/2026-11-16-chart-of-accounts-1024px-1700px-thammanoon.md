---
title: "หน้ารายละเอียด Chart of Accounts จับคู่การ์ดตั้งแต่ฟอร์มกว้าง 1024px ไม่รอจอ 1700px เหมือนหน้าอื่น"
author: Thammanoon
date: 2026-11-16
branch: fix/coa-form-full-width
cost: { minutes: 30, tokens: 333827 }
id: l-0a3530ec
scope: repo
status: active
src: agent
touches:
  - routes/operation-plan/recipe/recipe-cook-view.tsx
  - routes/config/chart-of-accounts/coa-form.tsx
---

## Decided
2026-11-16 ผู้ใช้เลือกเอง (ตอบคำถามตัวเลือก "จับคู่การ์ดเร็วขึ้น") ให้หน้ารายละเอียด Chart of Accounts จับคู่การ์ดเร็วกว่ากฎข้อ 4 ของ skill carmen-blue-ui-design (1700px) เฉพาะหน้านี้ เพราะสี่หมวดล่าง (กลุ่มบัญชี, Cost Center, Dimension, ข้อมูลอ้างอิงภายนอก) มักมีเนื้อหาบรรทัดเดียว เรียงซ้อนเต็มความกว้างที่จอ 1366 แล้วโล่ง

ลำดับหมวดผู้ใช้กำหนดเองเช่นกัน: กลุ่มบัญชี → Cost Center → Dimension → ข้อมูลอ้างอิงภายนอก (คู่บน: กลุ่มบัญชี | Cost Center, คู่ล่าง: Dimension | อ้างอิงภายนอก) และกลุ่มบัญชีแสดงเป็น tree

## Tried and ruled out
ใช้ SECTION_PAIR กลาง (จอ 1700px): ที่ 1366 ได้การ์ดเต็มความกว้างสี่ใบที่มีข้อความบรรทัดเดียว

## Watch out
จุดสลับวัดจากความกว้างของฟอร์มเอง (container query) ไม่ใช่จอ — พับ sidebar แล้วจับคู่ได้ที่จอแคบกว่า · หัวหมวดของการ์ดคู่ต้องอยู่บรรทัดเดียวที่การ์ดกว้าง ~500px ไม่งั้นการ์ดสองใบเริ่มไม่ตรงระดับ จึงตัดคำอธิบายหัวหมวดกลุ่มบัญชีออก อย่าใส่คำอธิบายยาวกลับที่หัวหมวดเหล่านี้ · อย่า "แก้" กลับไปใช้ SECTION_PAIR โดยอ้างกฎข้อ 4

In the code: `COA_SECTION_PAIR` ใน routes/config/chart-of-accounts/coa-form-skeleton.tsx (`@5xl:grid @5xl:grid-cols-2`), `<form className="@container">` ใน coa-form.tsx
