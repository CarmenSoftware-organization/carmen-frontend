---
title: "ฟอร์มที่ผูกค่ากับข้อมูลจากเซิร์ฟเวอร์: แก้ช่องหลังกด Save ไม่กี่วินาทีแล้วปุ่ม Save ค้างกดไม่ได้ ถ้าไม่เขียน cache ทันทีและไม่กันการ reset ทับ"
author: Thammanoon
date: 2026-11-13
branch: fix/profile-form-save-race
cost: { minutes: 19, tokens: 122917 }
id: l-02cfc26b
scope: repo
status: active
src: agent
touches:
  - components/share/compact-section.tsx
  - routes/profile/mcp-tokens-section.tsx
  - routes/profile/user-profile-details.tsx
  - routes/profile/user-profile-setting.tsx
  - hooks/use-profile.ts
  - routes/accounting/settings/accounting-settings-form.tsx
---

## Decided
2026-11-13 ฟอร์ม Personal Information ของหน้า Profile Settings: กด Save แล้วแก้ช่องเดิมกลับเป็นค่าเก่าภายใน 1–3 วินาที ปุ่ม Save disabled และค่าที่พิมพ์ไม่ถูกบันทึก ต้องพิมพ์ซ้ำอีกรอบ แก้สองจุดพร้อมกัน: (1) mutation เขียนค่าที่เพิ่งบันทึกลง cache ของ query ทันทีก่อนสั่ง refetch (2) ฟอร์มไม่ให้ refetch เบื้องหลังทับช่องที่ผู้ใช้กำลังแก้

## Tried and ruled out
- คิดว่าเป็นเรื่อง reset(values) ไม่เขียนค่ากลับ DOM (learning เดิมของ Discard) — ไม่ใช่: react-hook-form 7.88 ส่ง keepFieldsRef ให้เองเมื่อ reset มาจาก prop values ต้นตอคือช่วงที่ prop values ยังเป็นค่าเก่า ฟอร์มคืน defaultValues กลับไปเป็นค่าเก่าทุก render ค่าที่แก้กลับจึงเท่ากับ default = ไม่ dirty
- ใส่แค่ keepDirtyValues อย่างเดียวไม่พอ: กัน refetch ทับได้ แต่ช่วงรอ refetch ฟอร์มยังถือ default เก่าอยู่ ปุ่ม Save ยัง disabled

## Watch out
- อาการนี้วัด layout ครบทุกขนาดจอก็ไม่เจอ ต้องลองกดจริง: Save → รอ ~2 วินาที → แก้กลับเป็นค่าเดิม → ปุ่มต้องกดได้ → reload แล้วค่าต้องถูกบันทึก
- ยังมีอีก 28 ไฟล์ที่ผูก values กับ useForm โดยไม่มี keepDirtyValues — ยังไม่ได้ไล่ว่าไฟล์ไหนเป็นจริง (ฟอร์มที่สลับเป็นโหมดดูหลัง Save ไม่เจอ)
- ตอนทดสอบด้วยสคริปต์ ตัวตั้งค่า input ข้าม disabled ได้: แก้ช่องระหว่าง mutation pending แล้วค่าถูกทับ ไม่ใช่บั๊ก (ผู้ใช้จริงพิมพ์ไม่ได้ตอนนั้น)

In the code:
- hooks/use-profile.ts `useUpdateProfile` onSuccess: `setQueryData(profileQueryKey, …)` แล้วค่อย `invalidateQueries`
- routes/profile/user-profile-setting.tsx `useForm({ values, resetOptions: { keepDirtyValues: true } })`
- ตัวอย่างเดิมที่ทำถูกอยู่แล้ว: routes/accounting/settings/accounting-settings-form.tsx
- node_modules/react-hook-form/dist/index.esm.mjs บรรทัด ~3664 (effect ของ props.values: ไม่เท่า → _reset, เท่า → _resetDefaultValues)
- .claude/skills/carmen-blue-ui-design/verify.md หัวข้อ "ตรวจการกดจริง"
