---
title: "รายการ CN โหมดดูเป็นการ์ดแถวละใบเมื่อกล่องแคบกว่า 900px ยอดตาม GRN อยู่ในการ์ดเดียวกัน"
author: Thammanoon
date: 2026-11-18
branch: feature/pr-item-responsive
cost: { minutes: 3, tokens: 36805 }
id: l-17da51a3
scope: repo
status: active
replaces: l-bbc7dc59
src: agent
touches:
  - routes/procurement/credit-note/cn-item-cards.tsx
  - routes/procurement/credit-note/cn-item.tsx
---

## Decided
2026-11-18 ตารางรายการ CN บนมือถือถูกบีบจนหัวคอลัมน์ทับกัน รอบแรกแก้ด้วยการล็อกความกว้างขั้นต่ำแล้วเลื่อนแนวนอน จากนั้นผู้ใช้สั่งให้โหมดดูบนมือถือและ tablet เป็นการ์ดแทน กล่องที่แคบกว่า 900px จะเป็นการ์ดแถวละใบ ส่วนแถวที่กางออก (ยอดตาม GRN) กลายเป็นส่วน "GRN Reference" ในการ์ดใบเดียวกัน กาง/ยุบตามปุ่ม Expand all เดิม โหมดแก้ยังเป็นตาราง

## Tried and ruled out
- ล็อกความกว้างขั้นต่ำแล้วเลื่อนแนวนอน: ใช้ได้ แต่ผู้ใช้เลือกการ์ด
- ใช้แถวกางเดิม (CnGrnRow) ในการ์ด: เป็นตารางซ้อนที่คิดความกว้างเป็น % ของคอลัมน์ตารางหลัก ใส่ในการ์ดแล้วไม่มีคอลัมน์ให้ตรง จึงวาด cell ฝั่ง GRN เป็นกริดมีป้ายแทน
- เทียบกับผลรวม size ตรง ๆ: HD 1366 ที่กาง sidebar ได้กล่อง ~1,080px ก็จะเป็นการ์ด ทั้งที่ตาราง % ยังอ่านได้

## Watch out
- flexRender ห่อ cell ที่เป็นฟังก์ชันเป็น element เสมอ ผลจึงไม่เคยเป็น null ถ้าจะเช็กว่าช่องว่าง (Received ของใบ amount_discount) ต้องเรียกฟังก์ชัน cell ตรง ๆ ซึ่งทำได้เพราะ cell ของ CN ไม่เรียก hook ถ้าเพิ่ม cell ที่เรียก hook ในฟังก์ชันเองจะพัง
- การ์ดไม่มีปุ่มลบ เพราะใช้เฉพาะโหมดดู ถ้าจะเปิดการ์ดให้โหมดแก้ ต้องเพิ่มคอลัมน์ action

In the code: routes/procurement/credit-note/cn-item-cards.tsx · CN_ITEM_CARDS_MAX_WIDTH ใน cn-item.tsx
