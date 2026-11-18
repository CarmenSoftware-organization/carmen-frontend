---
title: "แถบท้ายเอกสาร: ยอดรวมชิดซ้าย ปุ่ม action ชิดขวาเสมอ แม้ปุ่มตกบรรทัดใหม่บนจอแคบ"
author: Thammanoon
date: 2026-11-18
branch: feature/pr-item-responsive
cost: { minutes: 1, tokens: 5427 }
id: l-9e99e670
scope: repo
status: active
replaces: l-f9e9cc10
src: agent
touches:
  - components/ui/summary-bar.tsx
---

## Decided
2026-11-18 ผู้ใช้สั่งให้ปุ่ม action ในแถบท้ายเอกสารชิดขวา ปุ่มต้องชิดขวาแม้บนมือถือหรือ tablet ที่ปุ่มตกลงไปบรรทัดใหม่ แก้ที่ component กลาง จึงมีผลกับทุกเอกสารที่ใช้แถบนี้ (PR, PO, GRN, CN, SR, IA, AR/AP, JV template, accounting document)

## Tried and ruled out
- ให้ยอด Subtotal–Grand Total ชิดขวาไปพร้อมปุ่ม: ลองทำแล้ว ผู้ใช้ดูแล้วสั่งกลับเป็นชิดซ้าย จึง revert ออก ยอดรวมชิดซ้าย ปุ่มชิดขวา

## Watch out
- justify-between ของแถวไม่มีผลกับลูกที่ตกลงไปอยู่บรรทัดใหม่เพียงตัวเดียว ปุ่มจึงต้องห่อด้วย ms-auto

In the code: components/ui/summary-bar.tsx, SummaryFooterBar
