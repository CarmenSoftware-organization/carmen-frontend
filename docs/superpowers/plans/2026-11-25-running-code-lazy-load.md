# Running Code Lazy Load Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** หน้า Running Code บน desktop แสดงทุกรายการในตารางเดียว เลื่อนถึงท้ายแล้วโหลดชุดถัดไป ไม่มีแถบแบ่งหน้า

**Architecture:** ใช้ `useGridPagination` (ตัวเดียวกับที่ mobile ใช้) ทุกขนาดจอ วาง sentinel ไว้ท้าย `DataGridScrollArea` แทน `DataGridPagination`

**Tech Stack:** React 19 + React Compiler, TanStack Table, TanStack Query

**Spec:** `docs/superpowers/specs/2026-11-25-running-code-lazy-load-design.md`

## Global Constraints
- แก้หน้านี้หน้าเดียว ห้ามแตะ `useGridPagination` / `DataGrid` ตัวกลาง
- ไม่เขียนเทสต์ใหม่ (ค่ากำหนดของผู้ใช้) แต่ typecheck + lint + เทสต์เดิมต้องผ่าน

## Review Focus
- เปลี่ยน sort หรือ search หลังเลื่อนโหลดไปหลายชุดแล้ว ต้องกลับไปเริ่มชุดแรก ไม่เอาแถวเก่ามาปน
- เลขลำดับต้องเรียง 1..N ต่อเนื่องกันข้ามชุด
- ข้อมูลน้อยกว่าหนึ่งชุด ต้องไม่ยิงโหลดซ้ำวน (hook กันไว้ด้วย `hasMore`)
- หลังเพิ่ม ลบ หรือ init ต้องเห็นรายการใหม่ (invalidate query แล้ว hook ต้อง append หน้า 1 ใหม่)
- ตารางต้องไม่ค้างเพราะ React Compiler

---

### Task 1: ใช้ lazy load ใน DataGrid ของหน้า Running Code

**Files:**
- Modify: `routes/system-admin/running-code/running-code-component.tsx`

- [ ] **Step 1:** ใส่ `"use no memo";` บรรทัดแรกของ `RunningCodeComponent`
- [ ] **Step 2:** ลบ `useRunningCode(params, …)` แบบเรียกตรง และ `useInfiniteScroll` ให้ `useGridPagination({ useListHook: useRunningCode, params, enabled: true })` ใช้ได้ทุกจอ ให้ `runningCodes = grid.items` และ `totalRecords = grid.totalRecords` ส่วน error/retry ของหน้าใช้ `grid.error` / `grid.refetch`
- [ ] **Step 3:** ส่ง `params: { ...params, page: 1 }` ให้ `useRunningCodeTable` (เลขลำดับต่อเนื่อง) การ์ด mobile ให้ `rowNo={rowNumber(undefined, i)}`
- [ ] **Step 4:** ใน DataGrid: `isLoading={grid.isLoading}` ลบ `<DataGridPagination />` และ import ทิ้ง แล้ววาง `{grid.hasMore && <div ref={grid.sentinelRef} …>{grid.isLoadingMore && <Loader2/>}</div>}` ไว้ใต้ `<DataGridTable />` ภายใน `DataGridScrollArea`
- [ ] **Step 5:** รัน `bun run typecheck && bunx eslint routes/system-admin/running-code && bun test:run routes/system-admin/running-code` ต้องผ่านทั้งหมด
- [ ] **Step 6:** ตรวจในเบราว์เซอร์ที่ `http://localhost:3000/system-admin/running-code` ต้องไม่มีแถบแบ่งหน้า เลื่อนแล้วได้แถวครบตาม count และ sort/search แล้วรีเซ็ต
- [ ] **Step 7:** Commit `feat(running-code): แสดงทุกรายการด้วย lazy load ไม่แบ่งหน้า`
