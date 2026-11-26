---
title: "สวิตช์โชว์/ซ่อน audit และ rev. ในหัวเอกสารเป็นค่าตั้งของ BU สองตัวแยกกัน ไม่ใช่ license feature"
author: Thammanoon
date: 2026-11-26
branch: feature/doc-audit-toggle
cost: { minutes: 1, tokens: 2276 }
id: l-59e2d1c8
scope: repo
status: active
replaces: l-b27c52aa
src: agent
touches:
  - components/share/doc-audit-line.tsx
  - docs/superpowers/specs/2026-11-26-doc-audit-toggle-design.md
---

## Decided
2026-11-26 ผู้ใช้เลือกให้การเปิด/ปิดตาราง audit (สร้างโดย/แก้ไขโดย) ในการ์ดหัวเอกสารเป็นค่าตั้งราย BU ที่ผู้ดูแล BU กดเองในหน้า Default Setting ค่าเริ่มต้นเปิด และสั่งแยกเลข rev.x เป็นอีกสวิตช์หนึ่ง ไม่ผูกกับ audit

## Tried and ruled out
ทำเป็น license feature ใน carmen-backstage: ต้อง seed และ assign ทุก BU ก่อน deploy FE และ LICENSE_ENFORCEMENT เปิดอยู่ทุก env ถ้าพลาดตารางจะหายทุก BU อีกทั้ง license ยังล็อกได้แค่ทั้งหน้า
ให้ rev. หายไปพร้อม audit ในสวิตช์เดียว: ผู้ใช้ไม่เอา

## Watch out
ซ่อนแค่บนจอ ข้อมูล audit ยังมากับ API ตามเดิม คอลัมน์ Created/Updated ใน list และ activity sheet ไม่ได้อยู่ใต้สวิตช์นี้
ปิด audit แต่เปิด rev. = เหลือกล่อง rev. x ช่องเดียว

In the code: คีย์ general.show-doc-audit และ general.show-doc-revision (boolean, default "true") ใน company-profile-config-registry.ts; บังคับใน DocAuditLine/DocAuditButton (components/share/doc-audit-line.tsx); spec docs/superpowers/specs/2026-11-26-doc-audit-toggle-design.md
