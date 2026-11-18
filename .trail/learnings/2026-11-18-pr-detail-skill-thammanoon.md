---
title: "หน้า PR detail จัดตาม skill แค่หัวเอกสาร ตารางรายการสินค้าคงเดิม และโครงตอนโหลดของเอกสารต้องตรงกับหน้าจริงรายเอกสาร"
author: Thammanoon
date: 2026-11-18
branch: main
cost: { minutes: 25, tokens: 311718 }
id: l-2d8c25bf
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-request/pr-header.tsx
  - components/loader/doc-page-skeleton.tsx
---

## Decided
- 2026-11-18 ผู้ใช้สั่งจัดหน้า PR detail ตาม skill carmen-blue-ui-design แล้วเลือกให้จบที่หัวเอกสาร: Workflow/Description โหมดดูเป็นข้อความ (ป้ายจาง + ค่าเด่น ไม่มีกรอบ) ใน FieldGrid ตัดสินคอลัมน์จากความกว้างกล่อง ช่องที่แก้ไม่ได้ไม่มีดาว required
- ตารางรายการสินค้า (แก้ในตัว 9 คอลัมน์ มีแถวขยาย กว้างขั้นต่ำ 1165px / edit 1290px) คงไว้ให้เลื่อนแนวนอนในกรอบของตัวเองที่ 390/768/1366 — หน้าไม่ล้น จึงไม่ผิดกฎ 10
- ผู้ใช้สั่งแก้โครงตอนโหลดของหน้าเอกสาร: DocPageSkeleton รับค่าตามหน้าจริงของแต่ละเอกสาร ไม่ใช้โครงเดียวกันทุกใบ

## Tried and ruled out
- ซ่อนคอลัมน์รองของตาราง PR ตามความกว้างกล่อง (แบบ PR list): ไม่ทำรอบนี้ ตารางผูก workflow/approve/split เยอะ เสี่ยงสูง ให้เปิดเป็นงานแยก
- การ์ดต่อแถวเมื่อกล่อง < 560px (สูตร table on detail page): งานใหญ่ ต้องทำทั้งโหมดดู/แก้ + ปุ่ม split/approve/review ต่อบรรทัด
- ใช้ grow กับตารางนี้: skill ห้ามบนตารางแก้ไขได้หลายคอลัมน์

## Watch out
- ที่ 4K คอลัมน์ตาราง PR ยังห่างกันหลายร้อย px และชื่อสินค้าถูกตัดที่ 1366–1920 — ยังเปิดอยู่ ไม่ใช่ของที่ลืม
- โครงตอนโหลดตรงกับใบโหมดดูที่ไม่มีแถบขั้นตอน workflow; ใบที่ In progress หน้าจริงสูงกว่า ~50px (ตอนโหลดไม่รู้สถานะ)
- แก้/เพิ่มช่องบนหัวเอกสารใบไหน ต้องแก้ `fields` ที่จุดเรียกโครงตอนโหลดของใบนั้นด้วย ไม่งั้นเนื้อหากระโดดตอนข้อมูลมา
- โหลดเร็วจนจับภาพโครงไม่ทัน: บังคับโชว์ชั่วคราวด้วยเงื่อนไขติด tag __TEMP_VERIFY__ แล้วเทียบตำแหน่ง (จำนวนแถวของ grid · ขอบบนตาราง) ในสอง iframe ข้างกัน — ลบแล้ว grep ก่อน commit

In the code:
- routes/procurement/purchase-request/pr-header.tsx — ribbon ใช้ SettingField + FieldGrid; pr-form.tsx description `@md:col-span-2`
- components/loader/doc-page-skeleton.tsx — props `ribbon` ("inputs" | "text"), `fields` (span 1|2 ต่อช่อง), `tabs`, `toolbar`
- ค่าที่วัด (6 คอลัมน์ที่ lg): SR [1,1,1,1,2]+tabs · PO [1,2,1,1,1,1,2,2] toolbar ไม่มี tabs · GRN [2,1,1,1,1,1,1,1,2]+tabs · CN [2,1×10,2]+tabs+toolbar · PR ribbon="text"
