---
title: "ตาราง CN โหมดดู: กล่องแคบกว่า 900px เลื่อนแนวนอน ไม่บีบคอลัมน์ตาม %"
author: Thammanoon
date: 2026-11-18
branch: feature/pr-item-responsive
cost: { minutes: 3, tokens: 29019 }
id: l-bbc7dc59
scope: repo
status: active
src: agent
touches:
  - routes/procurement/credit-note/cn-item.tsx
---

## Decided
2026-11-18 ผู้ใช้สั่งแก้ตารางรายการ CN บนมือถือ ซึ่งหัวคอลัมน์ทับกัน (Location/Product/Received ซ้อน) โหมดดูของตารางนี้แปลงความกว้างคอลัมน์เป็น % ของกล่องเพื่อให้พอดีจอ บนมือถือคอลัมน์ 12 ตัวในกล่อง ~330px จึงถูกบีบ แก้โดยล็อกความกว้างขั้นต่ำของตารางเท่าผลรวม size เมื่อกล่องแคบกว่า 900px แล้วให้เลื่อนแนวนอน

## Tried and ruled out
- ล็อกขั้นต่ำทุกครั้งที่กล่องแคบกว่าผลรวม size: HD 1366 ได้กล่อง ~1,080px ซึ่งน้อยกว่าผลรวม คอลัมน์ Tax/Total จึงถูกดันออกนอกจอ ทั้งที่แบบ % ที่ HD อ่านได้ปกติ

## Watch out
- แถว "คืน" เป็นตารางซ้อนที่คิด % จาก CN_COL ชุดเดียวกัน การล็อกขั้นต่ำไม่ทำให้แถวเหลื่อม เพราะ % ของความกว้างขั้นต่ำก็คือ px ชุดเดียวกัน
- เปิด scroll (pb-3) เฉพาะตอนเลื่อนจริง จอกว้างที่ไม่มีแถบเลื่อนจะไม่มีช่องว่างค้าง

In the code: CN_VIEW_MIN_WIDTH_BELOW + viewOverflows + --cn-table-min ใน routes/procurement/credit-note/cn-item.tsx
