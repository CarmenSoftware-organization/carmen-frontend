---
title: "แถบยอดรวมท้ายเอกสารชิดขวาทั้งแถบ ทั้งยอดรวมและปุ่ม ทุกขนาดจอ"
author: Thammanoon
date: 2026-11-18
branch: feature/pr-item-responsive
cost: { minutes: 1, tokens: 13870 }
id: l-f9e9cc10
scope: repo
status: active
src: agent
touches:
  - components/ui/summary-bar.tsx
---

## Decided
2026-11-18 ผู้ใช้สั่งให้ปุ่ม action ในแถบท้ายเอกสารชิดขวา แล้วสั่งต่อให้ยอด Subtotal / Discount / Net / Tax / Grand Total ชิดขวาด้วย แก้ที่ component กลางจุดเดียว มีผลกับทุกเอกสารที่ใช้แถบนี้ (PR, PO, GRN, CN, SR, IA, AR/AP, JV template, accounting document)

## Tried and ruled out
- ชิดขวาด้วยการใส่ justify-end อย่างเดียวแล้วให้ตัวคั่นอยู่ฝั่งซ้ายตามเดิม: บรรทัดที่ตกลงมาบนมือถือเริ่มกลางกล่อง เส้นคั่นซ้ายจึงค้างอยู่หน้าบรรทัด

## Watch out
- เมื่อชิดขวา ตัวคั่นต้องอยู่ฝั่งขวาของแต่ละช่อง (border-r + -mr-[17px]) ให้เส้นท้ายบรรทัดถูกตัดทิ้ง
- SummaryBar ที่ใช้เดี่ยว ๆ นอกแถบท้ายเอกสารยังชิดซ้าย (ค่าเริ่มต้น align="start")

In the code: components/ui/summary-bar.tsx — SummaryBar prop align, SummaryFooterBar ห่อปุ่มด้วย ms-auto
