---
title: "ป้ายบนหัวเอกสารที่รวมเป็นกลุ่มต้องห่อได้ทุกขนาดจอ และหัวแคบให้ปุ่มลงบรรทัดถัดไปแทนการบีบป้ายข้างปุ่ม"
author: Thammanoon
date: 2026-11-13
branch: fix/workflow-header-tablet-and-skill-english
cost: { minutes: 45, tokens: 404716 }
id: l-ec04f7a0
scope: repo
status: active
src: agent
touches:
  - components/share/doc-form-header.tsx
  - components/share/form-toolbar.tsx
  - routes/system-admin/workflow/wf-header.tsx
  - messages/en.json
  - messages/th.json
---

## Decided
2026-11-13 บนหัวหน้า Workflow: ป้ายจำนวนเอกสาร (In progress / Draft / Done) รวมเป็นกลุ่มเดียวเพื่อให้อยู่บรรทัดเดียวบนมือถือ กลุ่มนี้ต้องห่อได้ทุกขนาดจอ ไม่ใช่เฉพาะมือถือ และเมื่อหัวแคบกว่า 768px ให้ชื่อ + ป้ายกินทั้งบรรทัด แล้วปุ่มลงบรรทัดถัดไป เหตุผล: กล่องชื่อบนหัวกลางกว้างขั้นต่ำแค่ 192px และแบ่งที่กับปุ่ม ป้ายยาวจึงถูกบีบข้างปุ่มจนห่อ 4 บรรทัดที่ tablet และมือถือแนวนอน

บนหัวแคบ (มือถือ) คำว่า DOCUMENTS เหลือเป็นไอคอน ตัดเส้นคั่น และลดชนิด workflow กับตัวเลขรองเป็นตัวเล็ก เพื่อให้ชื่อ + สถานะ + ชนิดอยู่บรรทัดเดียวที่จอ 360

## Tried and ruled out
- กลุ่มป้ายที่ห่อไม่ได้บนจอกว้าง (PR #573): ที่ tablet กลุ่มกว้าง ~340px แต่ที่ว่างข้างปุ่มมี ~290px จึงล้นไปทางปุ่ม — regression ที่หลุดเพราะวัดแค่มือถือกับ 1366
- เปลี่ยนกล่องชื่อของหัวกลางให้กว้างตามเนื้อหา (flex-basis auto) เพื่อให้ปุ่มตกบรรทัดเองทุกหน้า: กระทบหัวเอกสารทุกโมดูล (หน้าที่ badge เยอะบนจอ 1366 ปุ่มจะตกบรรทัดสอง) จึงเปิดเป็น prop ที่หน้าเลือกใช้เองแทน
- จุดตัด 576px และ 672px สำหรับ "ปุ่มลงบรรทัดถัดไป": ที่หัว 684px (จอ 820) ป้ายยังขาดที่ 3px แล้วห่อ ต้องการจริง ~690px ภาษาไทยยาวกว่า จึงใช้ 768px

## Watch out
- แก้ป้ายหรือปุ่มบนหัวเอกสารแล้วต้องวัดที่ 486 / 768 / 820 / 1024 ด้วย ไม่ใช่แค่ 360 / 390 / 1366 — ช่วงนี้คือช่วงที่ป้ายกับปุ่มแย่งที่กัน
- จำนวนเอกสารหลักพันที่จอ 360 ยาวเกินหัว ถังท้ายจะลงบรรทัดใหม่ (ตั้งใจ ไม่ใช่บั๊ก)
- หัว JV template ที่ 486 ชื่อกับ badge ยังห่อ 3 บรรทัดข้างปุ่ม (พฤติกรรมเดิมของหัวกลาง ยังไม่ได้เปิดใช้ prop นี้)

In the code:
- routes/system-admin/workflow/wf-header.tsx — กลุ่มป้าย `flex flex-wrap … @max-xl/doc-header:basis-full`, `titleClassName="@max-3xl/doc-header:basis-full"` เฉพาะโหมดดูที่มีป้ายจำนวนเอกสาร
- components/share/doc-form-header.tsx, components/share/form-toolbar.tsx — prop `titleClassName` (ไม่บังคับ)
