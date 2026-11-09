---
title: "เลิก perpage=-1"
author: Thammanoon
date: 2026-11-09
id: l-ad09f32b
scope: repo
status: active
touches:
  - components/ui/transfer.tsx
  - lib/fetch-all-pages.ts
  - CLAUDE.md
  - "components/lookup/paged-checklist.tsx#PagedChecklist"
  - "hooks/use-entities-by-ids.ts#useEntitiesByIds"
  - "hooks/use-lookup-pagination.ts#useLookupPagination"
  - "hooks/use-lookup-pagination.ts#useLookupPagination.loadMore"
  - "hooks/use-lookup-resource.ts#useLookupResource.loadMore"
  - "lib/__tests__/security-headers.test.ts#read"
  - "lib/fetch-all-pages.ts#fetchAllPages"
---

## Decided
ช่วง 1–2 (components/lookup, components/filter, chip ใน use-list-filters) merge เข้า main แล้ว 2026-09-29 (PR #197, merge commit 8e84370e) — FE ล้วน ไม่มี backend change จึง deploy FE ได้เลย

ช่วง 3a merge เข้า main 29 ก.ย. (PR #199, merge 41df057a) — ตัวกรอง `control:"entity"`, id→ชื่อ, lookup เก่า 16 ตัว → `selectedIds`, แก้ physical-count-period; **ยังไม่ได้ตรวจในเบราว์เซอร์เลย** (checklist อยู่ใน PR) · ค่า URL ตัวกรองเปลี่ยนเป็น `col|string:A,B` (อ่านรูปเก่าได้) · แผนกหน้าผู้ใช้เป็น multi · follow-up: StrictMode dev ข้ามหน้า 2 ตอน auto-loadMore (แก้ `loadMore` ให้ idempotent)

ช่วง 3b merge 29 ก.ย. (PR #200) — `PagedChecklist` กลางใน `components/lookup/` + `loadMore` idempotent (แก้ StrictMode ข้ามหน้า) · "Transfer" ในขอบเขตเดิมคือ widget `components/ui/transfer.tsx` ไม่ใช่ฟีเจอร์โอนสินค้า (product picker เอกสาร paged อยู่แล้ว)

ช่วง 4 แตกเป็นสามช่วง (ตัดสินกับ user 29 ก.ย.) — เป้า backend = **400 เมื่อ `-1` + เพดาน perpage 100** (probe: backend ไม่มีเพดานเลย `perpage=5000` ได้ครบ ห้ามแค่ `-1` จึงไม่มีความหมาย)
- **4a = PR #201 (merge 455e5aab, ยังไม่ตรวจมือ)** — `lib/fetch-all-pages.ts` (`MAX_PERPAGE=100`) + `createConfigCrud().useListAll` · ทะเบียนเล็ก 9 จุดวนหน้า · `useAll*` วนหน้าชั่วคราว (ต้นไม้สินค้า ~26 request) · ประวัติ spot-check กรอง/ค้นที่ server · แก้จุด >100 เดิมสองจุด (role matrix, `useEntitiesByIds` จำกัด 100 id)
- กับดัก spot-check: status `voided`/`cancelled` ไม่อยู่ใน enum backend → filter 400 · search ไม่ค้นรหัส location
…

## Watch out
- ข้อเท็จจริงของ filter: หลายเงื่อนไขคั่น `,` ใน `filter` เดียว (AND); ส่ง `filter` ซ้ำไม่ได้; `is_active` ส่งให้ credit-note-reasons / physical-count-periods (400) และ users (0 แถว) ไม่ได้
- entity ที่ไม่มี `id` ต้องส่ง `getId` ให้ `useLookupPagination` ไม่งั้น dedupe ทิ้งหน้า 2+
- lookup ที่แปลงจาก `<Select>` ต้องใส่ `allowDeselect={false}` (คลิกซ้ำเคยล้าง tax rate เป็น 0)
…

_From Claude Code's memory of this repo, last updated Sep 29._
