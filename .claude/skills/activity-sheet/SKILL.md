---
name: activity-sheet
description: ใช้เมื่อเพิ่มหรือแก้จุดเข้าถึง activity sheet (ประวัติ "ใครแก้อะไร") บนหน้า list, form หรือ tree ใด ๆ
---

# Activity sheet (ประวัติ "ใครแก้อะไร" ของรายการเดียว)

`components/share/activity-sheet.tsx` เป็นของกลาง ใช้ได้กับทุก entity — เปิดด้วย
`openActivity(id, label?)` จาก `components/share/activity-sheet-host.tsx` ซึ่ง mount
ครั้งเดียวใน `routes/root-layout.tsx` (กลไก CustomEvent ชุดเดียวกับ
`dispatchPermissionDenied`) **อย่าถือ state หรือ render sheet เองในหน้าใหม่**

จุดเข้าถึงมีสามทาง: ปุ่มในหัวหน้า (21 หน้า) · เมนู ⋯ ในแถว list ผ่าน option
`activity: { id, label }` ของ `useConfigTable` / `actionColumn` (32 list) · ปุ่มไอคอนใน
`tree-node.tsx` ของหมวดสินค้า

เปิดเฉพาะ entity ที่ backend บันทึกให้จริง — ทะเบียนอยู่ที่
`carmen-turborepo-backend-v2/apps/micro-business/src/common/activity/activity-registry.ts`
ตอนนี้ **ไม่เปิด** 6 list ที่ไม่มีในทะเบียน (certification · eco · equipment ·
period · activity-log · user-activity) เปิดไปจะได้เมนูที่กดแล้วว่างเปล่า

หัวข้อของแต่ละ action อยู่ใน `ACTION_TITLE_KEY` ของ activity-sheet ซึ่งต้องเป็นสับเซตของ
enum `enum_activity_action` ฝั่ง DB — ค่าที่ไม่มีในเอนัมจะเขียนลงไม่ได้เลย
