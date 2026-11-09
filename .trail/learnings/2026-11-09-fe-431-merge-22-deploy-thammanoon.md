---
title: "FE #431 (merge 22 ต.ค. ยังไม่ deploy)"
author: Thammanoon
date: 2026-11-09
id: l-1e02b469
scope: repo
status: active
touches:
  - components/share/form-primary-action.tsx
  - "components/share/form-primary-action.tsx#useClaimFormPrimary"
  - "components/share/form-primary-action.tsx#useFormPrimaryClaimed"
---

## Decided
FE PR #431 merge เข้า main 2026-10-22 (merge commit f001a3b4) **ยังไม่ deploy** — ผู้ใช้จะเห็นสีปุ่มเปลี่ยนหลายหน้าทันทีที่ขึ้น

กฎที่ user เลือก: หน้าเอกสารมีปุ่มพื้นน้ำเงินได้ตัวเดียว ถ้า footer มีปุ่ม workflow ที่กดได้
(Submit/Approve/Commit) → Edit/Save บนหัวเป็น outline · ไม่มีปุ่ม workflow → หัวเป็นปุ่มหลักตามเดิม
Delete บนหัวเป็น outline สีแดง (ไม่ใช่พื้นแดง)

**Why:** footer คือ "ขั้นถัดไปของใบ" และ Submit บันทึกให้อยู่แล้ว · footer เป็นคน claim
(`useClaimFormPrimary` ใน `components/share/form-primary-action.tsx`) เพราะเงื่อนไขปุ่มอยู่ใน footer แต่ละโมดูล

## Watch out
footer ใหม่ที่มีปุ่ม workflow ต้องเรียก `useClaimFormPrimary(มีปุ่มกดได้)` ·
หน้าที่ส่ง `submitSlot` ให้ FormToolbar ต้องอ่าน `useFormPrimaryClaimed()` เองเพราะ toolbar ไม่คุมสี slot
(เจอจริงที่ IA) · ตรวจในเบราว์เซอร์ทั้ง view และ edit — Commit ของ GRN โผล่เฉพาะ view, ของ IA เฉพาะ edit

_From Claude Code's memory of this repo, last updated Oct 22._
