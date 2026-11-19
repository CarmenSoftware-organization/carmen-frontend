---
title: "ตารางในคอมโพเนนต์ที่ปิด React Compiler ต้อง memo ข้อมูลแถวเอง ไม่งั้นหน้าค้างทั้งแท็บ"
author: Thammanoon
date: 2026-11-19
branch: main
cost: { minutes: 10, tokens: 230470 }
id: l-e604d54c
scope: repo
status: active
src: agent
touches:
  - routes/store-operation/stock-replenishment/stock-repl-pr-wizard.tsx
  - routes/store-operation/stock-replenishment/stock-repl-sr-wizard.tsx
---

## Decided
2026-11-19 wizard สร้าง PR/SR จากหน้า Stock Replenishment ค้างทั้งแท็บหลังกดช่อง Workflow สาเหตุคือส่ง array แถวใหม่ทุก render ให้ useReactTable ในคอมโพเนนต์ที่มี "use no memo" แก้ด้วยการ useMemo ตัว data

## Tried and ruled out
- ResizeObserver/Radix layout loop (กลไกใน learning เดิมเรื่อง memoize columns): ตัด RO ที่ 300 callback แล้วยังวน และ RO นิ่ง
- setState ของ wizard / parent re-render: นับแล้วยิงครั้งเดียว parent ไม่วน

## Watch out
- กลไก: getCoreRowModel เห็น data เปลี่ยน → _autoResetPageIndex → setPagination ได้ object ใหม่เสมอ → render → array ใหม่ → วนไม่จบ ไม่มี error ใน console
- ลายเซ็น: <input> ถูกเขียน attribute name/type ซ้ำ ~900 ครั้ง/วินาที (React 19 เขียนซ้ำทุกครั้งที่ input update) แท็บค้างตอน Select/Popover เปิด
- "use no memo" ปิด auto-memo ของคอมไพเลอร์ คอมโพเนนต์ที่ใส่ directive นี้ต้อง useMemo data ของตารางเอง

In the code:
- routes/store-operation/stock-replenishment/stock-repl-pr-wizard.tsx (tableRows → useMemo [rows, removed, drafts])
- routes/store-operation/stock-replenishment/stock-repl-sr-wizard.tsx (tableRows → useMemo [products, removed, qtys])
- node_modules/@tanstack/table-core/build/lib/features/RowPagination.js:41
