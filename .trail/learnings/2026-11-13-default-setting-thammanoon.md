---
title: "หน้า Default Setting โหมดดู: แบบฟอร์มการพิมพ์ที่ยังใช้ค่าระบบรวมเป็นรายชื่อ ช่องเต็มเหลือเฉพาะใบที่ตั้งเอง"
author: Thammanoon
date: 2026-11-13
branch: feature/default-setting-design-direction
cost: { minutes: 9, tokens: 219040 }
id: l-67a02def
scope: repo
status: active
src: agent
touches:
  - routes/system-admin/company-profile/company-profile-ui.tsx
  - routes/system-admin/default-setting/default-setting-component.tsx
  - components/share/compact-section.tsx
---

## Decided
2026-11-13 บนหน้า Default Setting ของ System Admin (ผู้ใช้สั่งให้กำหนดทิศทางดีไซน์ แล้วสั่ง ship ผลลัพธ์ — การเลือกแบบเป็นของ Claude ผู้ใช้ยอมรับด้วยการ merge):
- โหมดดูของ Print Forms แสดง "ข้อยกเว้น ไม่ใช่ค่าเริ่มต้น": ใบที่ค่าว่าง (ใช้ค่าระบบ) รวมเป็นกริดรายชื่อ (รหัส + ชื่อเอกสาร) ใต้หัวเดียว ช่องเต็มมีเฉพาะใบที่ตั้งเอง เพราะ 13 ช่องที่เขียนข้อความเดียวกันซ้ำเป็นเสียงรบกวน และบนมือถือยาวมาก โหมดแก้ยังเห็น dropdown ครบทุกใบ
- หมวด Document behavior มีไม่กี่ค่า จึงให้ค่าที่มีแบ่งเต็มแถว แทนกริดคอลัมน์ตายตัวที่เหลือครึ่งการ์ดว่างบนจอกว้าง ส่วนคอนโทรลจำกัดความกว้างไว้ ไม่ยืดตามช่อง (จอกว้างขึ้น = คอลัมน์เพิ่ม ไม่ใช่ช่องกรอกกว้างขึ้น)

## Tried and ruled out
- รายชื่อแบบไหลต่อกันแล้วห่อบรรทัด (flex-wrap): บนมือถือบางบรรทัดมี 1 ชื่อ บางบรรทัด 2 ชื่อ ดูไม่เป็นระเบียบ → ใช้กริดที่คอลัมน์ตรงกัน ยอมสูงขึ้นหนึ่งแถวบนจอ 1366

## Watch out
- สถานะที่มีทั้งใบตั้งเองและใบค่าระบบปนกัน (เส้นคั่นระหว่างสองกลุ่ม) ยังไม่เคยเห็นในเบราว์เซอร์จริง เพราะ BU บน dev ตั้งเอง 0 จาก 13 และไม่ได้ Save ลง DB ที่ใช้ร่วมกัน
- `trail check` จะเตือน auto-fit เทียบกับ learning ของหน้า landing System Admin — คนละกรณี: ที่นั่นกลุ่มสูงไม่เท่ากัน ที่นี่เป็นช่องสูงเท่ากัน

In the code:
- `routes/system-admin/default-setting/default-setting-component.tsx` — `printShown` / `printDefaults`; รายชื่อใช้ `grid-cols-[repeat(auto-fill,minmax(min(100%,10.5rem),1fr))]`; Document behavior ใช้ `repeat(auto-fit,minmax(min(100%,15rem),1fr))`
- `routes/system-admin/company-profile/company-profile-ui.tsx` — `ConfigCode` (`min-w-7`), คอนโทรลของ `ConfigField` ห่อด้วย `max-w-sm`
