---
title: "หน้ารายละเอียดบทบาท: โหมดดูแสดงสิทธิ์ทุกรายการเหมือนโหมดแก้ ไม่ย่อเหลือเฉพาะสิทธิ์ที่ถืออยู่"
author: Thammanoon
date: 2026-11-13
branch: feature/role-detail-full-width
cost: { minutes: 18, tokens: 290062 }
id: l-458e08ae
scope: repo
status: active
src: agent
touches:
  - routes/system-admin/role/use-permission-labels.ts
  - routes/system-admin/role/permission-summary.tsx
  - routes/system-admin/role/role-form.tsx
---

## Decided
2026-11-13 ผู้ใช้ดูหน้ารายละเอียดบทบาทของ System Admin แล้วสั่ง: โหมดดูต้องโชว์สิทธิ์ทุกรายการของทะเบียนในโครงเดียวกับโหมดแก้ (แค่กดไม่ได้) ช่องค้นหาและตัวกรอง Granted / Missing ยังใช้ได้ในโหมดดู
หน้าเต็มความกว้างจอ การ์ดโมดูลไหลเป็นคอลัมน์ (1 / 1 / 2 / 3 / 6 ที่ 390 / 768 / 1366 / 1920 / 3840) ปุ่ม action อยู่ต่อจากชื่อ resource ไม่ชิดขวาการ์ด

## Tried and ruled out
โหมดดูที่โชว์เฉพาะสิทธิ์ที่ถืออยู่เป็นช่องของกริด (ชื่อ resource + action คั่นด้วยจุด) ตามแนว "โหมดดูของ checklist แสดงเฉพาะที่ถือ" ของหน้า user: ผู้ใช้บอกว่าอ่านแล้วงง — สิทธิ์เป็นตาราง resource × action คนดูต้องเห็นด้วยว่าอะไรที่ไม่ได้ให้ แนวนั้นใช้ได้กับรายการชื่อเดี่ยว (บทบาทของผู้ใช้) ไม่ใช่กับตารางสิทธิ์

## Watch out
ที่ 4K เบราว์เซอร์แบ่งได้ 7 คอลัมน์แต่การ์ดที่สูงสุด (Configuration) ทำให้ใช้จริง 6 เหลือคอลัมน์ว่างทางขวา จึงตั้งเพดาน 6 คอลัมน์เป็นค่าคงที่ (ไม่ใช่จำนวนโมดูล — กรองแล้วเหลือโมดูลเดียวการ์ดจะยืดเต็มจอ)

In the code: routes/system-admin/role/role-form.tsx, permission-picker.tsx (`columns: "30rem 6"`, ป้าย Grant all ซ่อนเมื่อการ์ดแคบกว่า `@xs`)
