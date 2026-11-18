---
title: "แถบบนบนมือถือเป็นบรรทัดเดียว ทุกปุ่มอยู่บนแถบตลอด ไม่ซ่อนไว้หลังปุ่ม ⋮"
author: Thammanoon
date: 2026-11-18
branch: feature/navbar-mobile
cost: { minutes: 6, tokens: 134420 }
id: l-f0f1bd11
scope: repo
status: active
src: agent
touches:
  - components/navbar/navbar.tsx
---

## Decided
2026-11-18 ผู้ใช้เลือกให้แถบบน (navbar) บนมือถือเป็นบรรทัดเดียว ปุ่ม BU, Apps, กระดิ่ง และโปรไฟล์อยู่บนแถบตลอดทุกขนาดจอ
บนแถบแคบ BU แสดงเป็นรหัส (alias) ให้รู้ว่าอยู่กิจการไหนโดยไม่ต้องกด และ breadcrumb เหลือแค่ชั้นสุดท้ายชั้นเดียว
ของรองโผล่ทีละขั้นตามความกว้างของแถบเอง (container query) ไม่ใช่ความกว้างจอ

## Tried and ruled out
- ปุ่ม ⋮ เปิดแผ่นจากด้านบน (ของเดิม): ชื่อ BU ถูกซ่อนบนมือถือ แผ่นมีแค่โลโก้ BU กับไอคอน Apps ที่ต้องกดซ้ำอีกชั้น
- เก็บ ⋮ ไว้แต่ทำแผ่นใหม่ให้เลือก BU และ Apps ได้ทันที: ผู้ใช้ไม่เลือก เพราะยังซ่อน BU ไว้หลังปุ่มอยู่ดี
- แถบล่างแบบแอปมือถือ (bottom tab bar): เปลี่ยนเยอะเกินไป และชนกับ status bar ที่อยู่ด้านล่างแล้ว

## Watch out
- class `@lg/navbar:` / `@2xl/navbar:` / `@4xl/navbar:` ใช้ได้เฉพาะใต้ header ที่ตั้ง `@container/navbar` ไว้ ถ้าย้าย BuSwitcher / UserProfile / PathBreadcrumb ไปใช้ที่อื่น ของจะถูกซ่อนตลอด และไม่มี error เตือน
- ที่ 320px ชื่อหน้ายาว ๆ ถูกตัดด้วย … ถือว่ายอมรับได้ เพราะทุกปุ่มต้องอยู่บนแถบ อย่าแก้ด้วยการเอา ⋮ กลับมา

In the code: components/navbar/navbar.tsx (header `@container/navbar`, สูง 3rem+safe-area, sm:h-14) · bu-switcher.tsx (แถบแคบแสดง alias, @2xl แสดงโลโก้+ชื่อเต็ม) · path-breadcrumb.tsx (flex-nowrap, ชั้นแม่ @lg 512px, ทุกชั้น @4xl 896px) · user-profile.tsx (ชื่อผู้ใช้และลูกศร @2xl 672px)
