---
title: "หน้ารายละเอียดผู้ขายใช้หัวการ์ดแบบหัวเอกสาร PR และช่อง General ย้ายเข้าการ์ดหัว"
author: Thammanoon
date: 2026-11-18
branch: main
cost: { minutes: 4, tokens: 143626 }
id: l-9e0ad3ac
scope: repo
status: active
src: agent
touches:
  - routes/vendor-management/vendor/vendor-form.tsx
---

## Decided
2026-11-19 ผู้ใช้สั่งให้หน้ารายละเอียด vendor มี style คล้ายหน้า PR: หัวอยู่ในการ์ดมีพื้น (ชื่อ + สถานะ + ปุ่ม · บรรทัดตัวตน รหัส/ประเภทธุรกิจ · ช่อง General + ตาราง audit ชิดขวา) หมวด General ที่เคยเป็นการ์ดแยกเอาออก ที่อยู่/ผู้ติดต่อ/ข้อมูลเพิ่มเติม/ใบรับรองคงเดิม

## Watch out
- ช่อง General อยู่นอก <form> แล้ว (ทางเดียวกับ PR) กด Enter ในช่องเหล่านี้ไม่ submit แต่ RHF ยังเก็บค่าครบ
- ประเภทธุรกิจโหมดดูอยู่ในบรรทัดตัวตน ไม่อยู่ในกริด · รหัสข้างชื่อโชว์เฉพาะโหมดเพิ่ม (ใบที่บันทึกแล้วอยู่ในบรรทัดตัวตน ไม่งั้นซ้ำสองที่ตอนแก้)
- ช่องโหมดดูยังเป็น FieldPlainText (min-h-8) ไม่ใช่ SettingField จึงสูงกว่าหัว PR นิดหน่อย

In the code: routes/vendor-management/vendor/vendor-form.tsx (DOC_HEADER_CARD + inlineBack + ribbon) · vendor-general.tsx (FieldGrid dense ในโหมดดู ไม่มี CompactSection) · vendor-edit-content.tsx (skeleton หัวเป็นการ์ด)
