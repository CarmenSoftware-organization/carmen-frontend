---
title: "ฟอร์มตั้งค่า interface ทุกแบรนด์เต็มความกว้างจอ: ช่องกรอกแสดงโหมดดูเป็นข้อความเอง และคำอธิบายหมวดที่ยาวอยู่ในการ์ด ไม่อยู่บนบรรทัดหัวข้อ"
author: Thammanoon
date: 2026-11-13
branch: feature/carmen-gl-interface-full-width
cost: { minutes: 25, tokens: 456611 }
id: l-0d4fe05c
scope: repo
status: active
src: agent
touches:
  - routes/system-admin/interface/CLAUDE.md
  - routes/system-admin/interface/accounting-interface-form.tsx
  - routes/system-admin/interface/carmen-gl-interface-form.tsx
  - routes/system-admin/interface/external-api-access-section.tsx
  - routes/system-admin/interface/external-api-docs-section.tsx
  - routes/system-admin/interface/external-interface-form.tsx
  - routes/system-admin/interface/interface-fields.tsx
  - routes/system-admin/interface/interface-page-layout.tsx
  - routes/system-admin/interface/interface-read-mode.ts
  - routes/system-admin/interface/pms-interface-form.tsx
---

## Decided
2026-11-13 ผู้ใช้สั่งจัดหน้า Carmen GL ตาม skill carmen-blue-ui-design แล้วสั่งต่อให้ทำแบรนด์อื่นทั้งชุด (Accounting ทั่วไป, POS ทั่วไป, PMS, Simphony, Micros 3700, External)

- หมวดเป็น CompactSection + FieldGrid และวางเป็นคู่บนจอ 1700px ขึ้นไป
- ช่องกรอกร่วมของหน้า interface แสดงโหมดดูเองเป็นข้อความ (ป้ายจาง ค่าเด่น ไม่มีกรอบ) สวิตช์เป็นช่องหนึ่งของกริด ค่าในโหมดดูเป็น Yes/No — เหลือแบบเดียว ไม่มีแบบ "ช่องกรอกถูกปิด" แล้ว (เป็นการตัดสินใจของ Claude ตอนทำทั้งชุด เพราะไม่เหลือฟอร์มไหนใช้แบบเก่า)
- คำอธิบายหมวดที่ยาวหลายประโยค (ซิงก์ผังบัญชีของ Carmen GL, SFTP และรอบดึงไฟล์ของ Simphony) อยู่ในการ์ดใต้ช่อง: บนบรรทัดหัวข้อมันห่อหลายบรรทัดไม่เท่ากัน หัวข้อของสองหมวดในคู่จึงสูงไม่เท่ากันและการ์ดเริ่มคนละระดับ

## Tried and ruled out
- ให้ช่อง API server ของ Carmen GL กินสองคอลัมน์: หมวดการเชื่อมต่อกลายเป็น 4 ช่องกริด แต่หมวดคู่ของมัน (ปลายทางข้อมูล) มี 3 การ์ดคู่จึงมีจำนวนแถวไม่เท่ากันทุกขนาดจอ และการ์ดที่เตี้ยกว่าถูกยืดจนมีที่ว่าง เลิกให้กินสองคอลัมน์ — คอลัมน์เดียวแคบสุดราว 270px URL ที่ยาวกว่านั้นห่อบรรทัดในโหมดดูและต้องเลื่อนในช่องตอนแก้
- ใส่ first ให้หมวดซ้ายของคู่แรก: ตอนวางเคียงกันหมวดขวายังมีระยะบน 20px หัวข้อสองฝั่งเหลื่อมกัน ใช้ระยะลบที่ตัวครอบคู่แทน

## Watch out
- BU ทดสอบ (ZB1/T02) มีสิทธิ์แค่ Carmen GL, Simphony, Micros 3700 และ External — BlueLedgers, POS ทั่วไป (infrasys/square) และ PMS (opera/protel) เปิดไม่ได้ ขึ้น "Interface not found" เป็นเรื่องสิทธิ์ ไม่ใช่บั๊ก
- จะดู layout ของแบรนด์ที่ไม่มีสิทธิ์ ต้องบังคับสองจุดพร้อมกัน: ข้ามด่านสิทธิ์ที่หน้า detail และบังคับ isError/isLoading เป็น false ที่โครงหน้า (backend ตอบ 403 ให้ GET ฟอร์มจึงขึ้นหน้า error ถ้าข้ามแค่ด่านแรก) ฟอร์มที่ได้เป็นค่าว่าง และมี dialog Permission Denied เด้งทับ — ถอดออกแล้ว grep ก่อน commit
- งานนี้ยังไม่เคยกด Save จริงสักหน้า และแบรนด์ที่ไม่มีสิทธิ์วัดได้แค่ layout ไม่ใช่ข้อมูลจริง
- เพิ่มฟอร์มแบรนด์ใหม่: ช่อง TextField ต้องส่งค่าปัจจุบันเข้าไปเอง ไม่งั้นโหมดดูไม่มีค่าให้แสดง (typecheck ดักให้ เพราะเป็น prop บังคับ)

In the code:
- routes/system-admin/interface/interface-fields.tsx — TextField (viewValue), EnumField, ToggleField, FIRST_SECTION_PAIR
- routes/system-admin/interface/interface-page-layout.tsx — prop skeleton, InterfaceReadModeContext
- routes/system-admin/interface/interface-detail.route.tsx — ด่าน entitlement === "none" และ canReadConfig
- ป้ายโค้ดชั่วคราว: __TEMP_VERIFY__
