---
title: "ตาราง view แบบ w-full ที่ซ่อนคอลัมน์ยืดได้ ต้องมีคอลัมน์ว่างรับที่เหลือ ไม่งั้นตัวเลขกระจายเต็มจอ"
author: Thammanoon
date: 2026-11-09
branch: feature/pl-detail-design-direction
cost: { minutes: 1, tokens: 2215 }
id: l-e208153c
scope: repo
status: active
src: agent
touches:
  - routes/vendor-management/price-list/pl-item-grouped-view.tsx
  - components/ui/setting-section.tsx
---

## Decided
- ตารางราคาโหมดดูของ Price List ซ่อนคอลัมน์ Note เมื่อไม่มีโน้ตสักแถว และใส่ `<th aria-hidden />` / `<td aria-hidden />` ว่างแทน เพราะ Note เป็นคอลัมน์เดียวที่ไม่มีความกว้างตายตัว จึงเป็นตัวรับที่ว่างทั้งหมดของตาราง `w-full` ถ้าเอาออกเฉย ๆ เบราว์เซอร์จะกระจายที่เหลือให้ทุกคอลัมน์ จน Price/Tax/Total ห่างกันเกือบเต็มจอ (เห็นจริงตอนทดสอบในเบราว์เซอร์)

## Tried and ruled out
- ยุบปุ่ม Void/Delete ลงเมนู ⋯ ถูกตัดทิ้ง เพราะขัดกฎปุ่มบนหัวเอกสารที่ผู้ใช้กำหนดไว้เมื่อ 29 ต.ค. (ปุ่มรองต้องอยู่ในแถบ)

## Watch out
- `SettingSection` ทุกอันที่ไม่ใช่ `first` จะมีเส้นคั่นบน ถ้าการ์ดข้างบนเปลี่ยนรูปในบางโหมด (เช่นแถบสรุปของโหมดดู) ต้องตั้ง `first` ตามโหมดนั้น ไม่งั้นจะได้เส้นลอยที่ไม่ได้แบ่งอะไร

In the code: routes/vendor-management/price-list/pl-item-grouped-view.tsx (filler column), pl-item-table.tsx (showNote คิดจากข้อมูลจริง), pl-item-fields.tsx (`first={isView}`), components/ui/setting-section.tsx
