---
title: "ตาราง Report Schedules: คอลัมน์ที่ซ่อนตามความกว้างกล่องไปเป็นบรรทัดรองแบบไอคอน ไม่ใช่ป้ายข้อความ"
author: Thammanoon
date: 2026-11-18
branch: fix/report-schedules-layout
cost: { minutes: 7, tokens: 65734 }
id: l-46fd39da
scope: repo
status: active
src: agent
touches:
  - messages/en.json
  - messages/th.json
  - routes/report/schedules/schedule-cards.tsx
  - routes/report/schedules/schedule-component.tsx
  - routes/report/schedules/use-schedule-table.tsx
  - routes/report/list/report-component.tsx
  - routes/report/list/use-report-table.tsx
---

## Decided
ตาราง Report Schedules มี 10 คอลัมน์ ใส่ไม่พอในกล่อง 662px ที่จอ tablet จึงซ่อนคอลัมน์รองทีละขั้นตามความกว้างกล่อง (ทางเดียวกับหน้า Document) และย้ายค่าที่ซ่อนไปเป็นบรรทัดรองในช่องข้างเคียง: ประเภท·รูปแบบใต้ชื่อ, แจ้งเตือนใต้ความถี่, รอบล่าสุดใต้รอบถัดไป กล่องแคบกว่า 560px เป็นการ์ดแถวละใบ

## Tried and ruled out
บรรทัดรองแบบมีป้ายข้อความ ("Last Run: 11/17/2026, 9:00:00 AM", "Notify: As soon as the run finishes") — ยาวเกินช่อง 150–170px ถูกตัดทุกแถวที่ 768 และ 1366 จึงเปลี่ยนเป็นไอคอน (Bell / History) + title/aria-label, ใช้คำสั้น notifyImmediatelyShort ("Immediately"/"ทันที") และตัดวินาทีออกจากวันเวลา (dateStyle/timeStyle short)

## Watch out
เปลี่ยน size ของคอลัมน์ใด ต้องคำนวณผลรวมขั้นต่ำ (660) และจุดเปลี่ยนขั้นใน columnTier ใหม่ — ขั้นต่ำต้อง ≤ 662

In the code: routes/report/schedules/use-schedule-table.tsx (columnTier, SCHEDULE_CARD_BELOW = 560), schedule-cards.tsx, schedule-component.tsx (useElementWidth − 2px border)
