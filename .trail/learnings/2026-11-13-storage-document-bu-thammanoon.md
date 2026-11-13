---
title: "หน้า Storage รวมเข้าหน้า Document แล้ว: โควตาวัดเป็นรอบแสดงคู่กับยอดไฟล์สด และปุ่มวัดใหม่ต้องรีเซ็ตเมื่อสลับ BU"
author: Thammanoon
date: 2026-11-13
branch: feature/merge-storage-into-document
cost: { minutes: 1, tokens: 4066 }
id: l-2543db2e
scope: repo
status: active
src: agent
touches:
  - routes/system-admin/document/document-storage-bar.tsx
  - routes/router.tsx
  - docs/superpowers/specs/2026-11-13-merge-storage-into-document-design.md
---

## Decided
2026-11-13 ผู้ใช้สั่งรวมหน้า Storage เข้าหน้า Document เพราะ admin ต้องเปิดสองหน้าที่ไม่เชื่อมกันเพื่อดูเรื่องเดียวกัน หน้า Document มีกล่องพื้นที่เหนือช่องค้นหา: แถบโควตา (ไฟล์แนบก่อน แล้ว database) กับบรรทัดแจกแจงตามชนิดเอกสาร ปุ่มวัดใหม่อยู่ข้างปุ่ม Upload เห็นเฉพาะผู้มี system_admin.view

ยอดบนแถบโควตาเป็นผลวัดเป็นรอบ ส่วนยอดแจกแจงเป็นยอดสด สองตัวนี้ต่างกันได้หลังอัปโหลด/ลบไฟล์ ผู้ใช้เลือกให้แสดงตามจริงทั้งคู่โดยกำกับ "วัดล่าสุด" ไม่สั่งวัดอัตโนมัติ (backend จำกัดวัด 10 นาทีต่อครั้งอยู่ดี)

แจกแจงตามชนิดเหลือชุดเดียวคือชุดยอดสดของหน้า Document ชุดที่มากับผลวัดไม่ได้ใช้ในหน้าแล้ว

## Tried and ruled out
- ทำเป็นแท็บในหน้า Document: admin ยังต้องสลับสองมุมมอง คือปัญหาเดิม
- คงไฟล์หน้า Storage ไว้แล้ว import มาใช้: เหลือโฟลเดอร์ที่ไม่มีหน้า และการ์ดเดิมเป็นหน้าเต็มต้องรื้ออยู่ดี

## Watch out
- สถานะ "เพิ่งวัดไป" (429) อยู่ใน error ของ mutation ซึ่งค้างตราบที่ปุ่มยัง mount — สลับ BU แล้วปุ่มยังถูกปิดถ้าไม่ key ตาม BU ยังเหลือ: ไม่ปลดเองหลังครบ 10 นาทีจนกว่าจะ reload
- 429 ยังมี toast กลาง "going a bit too fast" ขึ้นคู่กับปุ่มถูกปิด (พฤติกรรมเดิม)
- ความสูงตารางเผื่อกล่องเต็มสองแถว (78px) เสมอ ถ้าแก้เนื้อหากล่องต้องวัดใหม่ และกล่องต้องไม่ห่อเป็นหลายแถวบนจอ tablet ที่ยังแสดงตาราง (ตรวจที่ 820 และ 1024)
- ยังไม่เคยตรวจจริง: จอ 390 และ 4K, โควตาโหลดไม่ได้, BU ไม่มีไฟล์, บัญชีไม่มี system_admin.view

In the code:
- routes/system-admin/document/document-storage-bar.tsx, document-measure-button.tsx, document-component.tsx (storageSlotVisible, max-h 16.75rem / 19.75rem, key={buCode})
- /system-admin/storage เป็น redirect ใน routes/router.tsx; ลิงก์ในแบนเนอร์เตือนโควตาชี้ /system-admin/document
- spec: docs/superpowers/specs/2026-11-13-merge-storage-into-document-design.md
