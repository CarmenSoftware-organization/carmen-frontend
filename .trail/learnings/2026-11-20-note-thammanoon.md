---
title: "ตารางที่ปิดตัวช่วยปรับประสิทธิภาพอัตโนมัติ ต้องจำข้อมูลแถวเอง ไม่งั้นแท็บค้าง"
author: Thammanoon
date: 2026-11-20
standing: true
id: l-0de908eb
scope: repo
status: active
src: init-sessions
touches:
  - routes/store-operation/stock-replenishment/stock-repl-pr-wizard.tsx
---

## Watch out
- หน้าต่างสร้างใบขอซื้อในหน้าเติมสต็อกทำให้ทั้งแท็บค้างโดยไม่มี error เพราะตารางสร้างข้อมูลแถวใหม่ทุกครั้งที่วาดหน้า แล้ววนซ้ำไม่จบ
- In the code: ถ้าไฟล์มี "use no memo" และส่ง array แถวให้ useReactTable ต้องครอบด้วย useMemo เอง ตัวอย่างที่แก้คือ routes/store-operation/stock-replenishment/stock-repl-pr-wizard.tsx และ stock-repl-sr-wizard.tsx อาการคือแท็บค้างและ input ถูกเขียน attribute ซ้ำรัว

_From past Claude sessions here, Nov 19._
