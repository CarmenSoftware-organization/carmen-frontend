---
title: "GL, AP, AR และ Asset เป็นสี่โมดูลแยกกันจริง ใช้ URL ระดับบนสุด แต่โค้ดยังอยู่โฟลเดอร์บัญชีโฟลเดอร์เดียว"
author: Thammanoon
date: 2026-11-26
branch: feature/accounting-top-level-routes
cost: { minutes: 21, tokens: 477545 }
id: l-2680abdc
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-26-accounting-top-level-routes-design.md
  - routes/router.tsx
  - constant/module-list.ts
  - components/sidebar/side-main.tsx
  - components/navbar/module-app.tsx
  - components/navbar/path-breadcrumb.tsx
  - routes/accounting/accounts-payable/invoice/ap-document-page.test.ts
  - routes/accounting/accounts-payable/invoice/ap-document-page.ts
  - routes/accounting/accounts-payable/invoice/ap-invoice-detail.tsx
  - routes/accounting/accounts-payable/invoice/ap-invoice-panels.tsx
---

## Decided
2026-11-26 ผู้ใช้ยืนยันว่า General Ledger, Accounts Payable, Accounts Receivable และ Asset "ควรเป็นคนละโมดูลกันจริง ๆ" จึงย้าย URL จาก /accounting/* ขึ้นไปเป็น /general-ledger, /accounts-payable, /accounts-receivable, /asset และวางสี่โมดูลเป็นรายการบนสุดของ moduleList แทน wrapper "accounting" (เลือกทางเลือก A)
URL เก่า /accounting/* ต้องพาไปที่ใหม่ (เก็บ query string) ห้ามกลายเป็น 404 · permission/license key (accounting.gl/ap/ar/asset) คงเดิม เปลี่ยนแค่ URL
2026-11-26 (แยก GL/AP/AR/Asset เป็นโมดูลบนสุด): `findActiveModule` เดิมใช้ `pathname.startsWith(mod.path)` เปล่า ๆ พอมีโมดูล path สั้นอย่าง `/asset` แล้ว URL ที่ขึ้นต้นเหมือนกัน (`/assets…`) จะถูกนับเป็นโมดูลผิด จึงเปลี่ยนเป็น `pathname === mod.path || pathname.startsWith(mod.path + "/")`
breadcrumb สร้าง `PATH_TO_KEY` จาก moduleList โดยเดินแม่ก่อนลูก — dashboard ของสี่โมดูลบัญชีใช้ path เดียวกับโมดูล (เช่น glDashboard = `/general-ledger`) ถ้าลูกทับ breadcrumb ระดับแรกจะขึ้น "Dashboard" แทนชื่อโมดูล จึงใช้ `??=` ให้แม่ชนะ (แทน `keyOverride` + `findAccountingSection` ที่ลบไป)

## Tried and ruled out
- แยกโฟลเดอร์โค้ดเป็น routes/<module>/ ด้วย: ESLint ห้าม import ข้ามโมดูล แต่ dashboard/ กับ documents/ ใช้ร่วมกันสี่หมวด และ AP ใช้ hook ของ JV จึงต้องย้ายของชิ้นใหญ่ไปชั้น shared — diff ใหญ่ ผู้ใช้ไม่เห็นความต่าง
- เปลี่ยนแค่ URL แล้วคง wrapper: ขัดเจตนา "คนละโมดูลจริง"

## Watch out
โฟลเดอร์ routes/accounting/ ไม่ตรงกับชื่อ URL อีกต่อไปโดยตั้งใจ — อย่าสรุปว่าเป็นของค้างที่ต้องย้าย
/accounting/financial-reports ไปอยู่ใต้ /general-ledger

In the code:
spec docs/superpowers/specs/2026-11-26-accounting-top-level-routes-design.md · routes/router.tsx · constant/module-list.ts (findAccountingSection ถูกลบ) · special case "accounting" ใน components/sidebar/side-main.tsx, components/navbar/module-app.tsx, components/navbar/path-breadcrumb.tsx · e2e carmen-frontend-e2e/tests/820-accounting-settings.spec.ts
ตอนนั้นมีแค่สี่โมดูลบัญชีที่ sub ใช้ path เดียวกับแม่ — โมดูลใหม่ที่ทำแบบเดียวกันจะได้ชื่อโมดูลใน breadcrumb ไม่ใช่ชื่อหน้า dashboard
แทน path ด้วย regex ระวังไปโดน `import("./accounting/…")` ใน router (เคยทำ tsc แดง 9 จุด)

constant/module-list.ts findActiveModule · components/navbar/path-breadcrumb.tsx addModuleSegments · เทสต์ constant/accounting-navigation.test.ts (เคส /assetx)
