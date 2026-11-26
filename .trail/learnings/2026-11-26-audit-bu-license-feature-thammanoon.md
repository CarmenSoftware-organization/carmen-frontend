---
title: "สวิตช์โชว์/ซ่อนตาราง audit ในหัวเอกสารเป็นค่าตั้งของ BU ไม่ใช่ license feature"
author: Thammanoon
date: 2026-11-26
branch: feature/doc-audit-toggle
cost: { minutes: 4, tokens: 90531 }
id: l-b27c52aa
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-26-doc-audit-toggle-design.md
  - components/share/doc-audit-line.tsx
---

## Decided
2026-11-26 ผู้ใช้เลือกให้การเปิด/ปิดตาราง audit (สร้างโดย/แก้ไขโดย + rev.) ในการ์ดหัวเอกสารเป็นค่าตั้งราย BU ที่ผู้ดูแล BU กดเองในหน้า Default Setting ค่าเริ่มต้นเปิด เพราะเป็นเรื่องที่ลูกค้าเลือกเอง ไม่ใช่ของขาย

## Tried and ruled out
ทำเป็น license feature ใน carmen-backstage: ต้อง seed และ assign ทุก BU ก่อน deploy FE และ LICENSE_ENFORCEMENT เปิดอยู่ทุก env ถ้าพลาดตารางจะหายทุก BU อีกทั้ง license ยังล็อกได้แค่ทั้งหน้า

## Watch out
ซ่อนแค่บนจอ ข้อมูล audit ยังมากับ API ตามเดิม คอลัมน์ Created/Updated ใน list และ activity sheet ไม่ได้อยู่ใต้สวิตช์นี้

In the code: คีย์ general.show-doc-audit (boolean, default "true") ใน company-profile-config-registry.ts; บังคับใน DocAuditLine/DocAuditButton (components/share/doc-audit-line.tsx); spec docs/superpowers/specs/2026-11-26-doc-audit-toggle-design.md
