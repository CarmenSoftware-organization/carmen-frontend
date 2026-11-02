# Period End Review Documents Dialog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dialog เอกสารบนหน้า Period End Review จัด 4 กลุ่มสถานะ, กรองใบค้างเป็นค่าเริ่มต้น และโหลดทีละหน้าจาก endpoint ใหม่ ส่วน review เลิกส่งรายชื่อเอกสาร

**Architecture:** micro-business เป็นเจ้าของนิยามกลุ่มสถานะ (`period-end.validate.ts`) และใช้กับทั้ง `group_counts` ใน review และ handler ใหม่ `findReviewDocuments` ที่แบ่งหน้าโดยไล่ทีละกลุ่มตาม rank แล้วคำนวณ offset ข้ามกลุ่ม gateway เพิ่ม route + serializer + AppIdGuard ส่วน FE ใช้ `useInfiniteQuery` + IntersectionObserver ใน dialog

**Tech Stack:** NestJS microservices + Prisma (tenant schema), Zod serializer · React 19, TanStack Query/Table, use-intl

**Spec:** `docs/superpowers/specs/2026-11-02-period-end-review-documents-dialog-design.md` (อ่านคู่กับแผนนี้)

## Global Constraints

- **ไม่เขียน test ใหม่** (CLAUDE.md ของ user override TDD) ห้ามสร้าง `*.spec.ts` / `*.test.ts` ทุก task ต้องรัน typecheck + lint และ suite เดิมของไฟล์ที่แตะต้องผ่าน
- ห้ามแก้กฎการปิดงวด: `*_COMPLETE`, `complete_count`, `incomplete_count`, `is_complete` ต้องได้ค่าเท่าเดิม
- กลุ่ม (rank): `draft`=0, `in_progress`=1, `complete`=2, `cancelled`=3 · status null (PR/PO) นับเป็น `draft`
- เรียงภายในกลุ่ม: วันที่เอกสาร asc แล้วตามด้วย `id` asc
- `group` query ∈ `incomplete | complete | cancelled | all` ค่าเริ่มต้น `incomplete` · `perpage` ค่าเริ่มต้น 50 เพดาน 100
- api_name ใหม่: `period_end.findReviewDocuments`
- commit message เป็นภาษาไทย (conventional prefix อังกฤษได้) · ไม่ squash-merge
- BE และ FE ทำบน branch `feature/period-end-review-documents` ของแต่ละรีโป (แตกจาก `main`) ส่วน Task 6 ใช้ branch แยก `feature/period-end-review-drop-documents`
- FE: ข้อความแปลห้ามมี `{{}}` หรือ `<คำ>` · ใช้ primitive ใน `components/ui/` · อ่านออกทั้ง light/dark

## Review Focus

1. **แบ่งหน้าคร่อมรอยต่อกลุ่ม**: หน้าที่เริ่มกลาง draft แล้วจบใน in_progress ต้องไม่มีแถวซ้ำหรือหาย → ตรวจด้วย curl ใน Task 2 Step 4 (perpage=2 ไล่ทุกหน้า เทียบกับ perpage=100)
2. **PR/PO ที่ status เป็น null** ต้องอยู่ในกลุ่ม draft ทั้งใน count และในรายการ → Task 1 รวม null เข้า where ของ draft, Task 2 Step 4 เทียบ `group_counts.draft + in_progress` = `incomplete_count`
3. **ปิดแล้วเปิด dialog ใหม่ / เปลี่ยนโมดูล**: ตัวกรองต้องกลับเป็น "ยังไม่เสร็จ" และไม่เห็นแถวของโมดูลเก่าค้าง → Task 5 Step 3 ตรวจในเบราว์เซอร์
4. **โหลดหน้าถัดไปล้มเหลว**: แถวที่โหลดแล้วต้องยังอยู่ และมีปุ่มลองใหม่ → Task 5 Step 3 (ปิด network ใน devtools แล้วเลื่อน)
5. **ไม่มีงวดปัจจุบัน / module ไม่ถูกต้อง**: ตอบ `PERIOD_END_NO_CURRENT_PERIOD` / 400 ไม่ใช่ 500 → Task 3 Step 4 curl `:module=xx`

---

## ส่วน A — Backend PR 1 (`carmen-turborepo-backend`, branch `feature/period-end-review-documents`)

### Task 1: นิยามกลุ่มสถานะ

**Files:**
- Modify: `apps/micro-business/src/inventory/period-end/period-end.validate.ts` (ต่อท้ายชุด `*_COMPLETE` ราวบรรทัด 18–67)

**Interfaces:**
- Produces:
  - `export type ReviewModuleKey = 'pr' | 'po' | 'grn' | 'cn' | 'sr' | 'si' | 'so'`
  - `export type ReviewDocumentGroup = 'draft' | 'in_progress' | 'complete' | 'cancelled'`
  - `export const REVIEW_GROUP_ORDER: readonly ReviewDocumentGroup[] = ['draft','in_progress','complete','cancelled']`
  - `export type ReviewGroupFilter = 'incomplete' | 'complete' | 'cancelled' | 'all'`
  - `export const REVIEW_FILTER_GROUPS: Record<ReviewGroupFilter, readonly ReviewDocumentGroup[]>` (incomplete → draft+in_progress, all → ทั้ง 4)
  - `export const REVIEW_STATUS_GROUPS: Record<ReviewModuleKey, Record<ReviewDocumentGroup, readonly string[]>>` ตามตารางใน spec §นิยามกลุ่มสถานะ (ใช้ค่าจาก Prisma enum ไม่พิมพ์ string เอง)
  - `export function reviewGroupOf(module: ReviewModuleKey, status: string | null): ReviewDocumentGroup` (null หรือ `''` → `'draft'` · status ที่ไม่รู้จัก → `'in_progress'` เพื่อให้ตรงกับโค้ดเดิมที่นับเป็น incomplete)

- [ ] **Step 1: เพิ่ม type/ค่าคงที่/ฟังก์ชันตาม Interfaces** และเขียนคอมเมนต์ (อังกฤษ + ไทยตามสไตล์ไฟล์) ว่า `complete ∪ cancelled` ของแต่ละโมดูลต้องเท่ากับ `*_COMPLETE`
- [ ] **Step 2: ตรวจ invariant ด้วยมือ** ไล่ทีละโมดูลว่า `complete ∪ cancelled` = ชุด `*_COMPLETE` เดิม และทั้ง 4 กลุ่มรวมกันได้ทุกค่าใน enum
- [ ] **Step 3: typecheck + lint**
  Run: `cd apps/micro-business && bunx tsc --noEmit -p tsconfig.json && bun run lint`
  Expected: ไม่มี error
- [ ] **Step 4: Commit** `git commit -m "feat(period-end): นิยามกลุ่มสถานะเอกสารสำหรับหน้า review"`

### Task 2: micro-business — `group_counts` ใน review + handler `findReviewDocuments`

**Files:**
- Modify: `apps/micro-business/src/inventory/period-end/period-end.service.ts` (`findReview` ราวบรรทัด 553–810, `buildTx` ราว 720)
- Modify: `apps/micro-business/src/inventory/period-end/period-end.controller.ts` (ต่อจาก handler `findReview` ราวบรรทัด 119)
- Modify (generated): `packages/rpc-contract/src/contracts/period-ends.ts` ผ่าน `bun run gen:rpc-contract`

**Interfaces:**
- Consumes: ทุกอย่างจาก Task 1
- Produces:
  - `PeriodEndReviewTransactionItem` เพิ่ม `group_counts: Record<ReviewDocumentGroup, number>` (ยังคงมี `documents`)
  - `PeriodEndService.findReviewDocuments(user_id: string, tenant_id: string, module: ReviewModuleKey, group: ReviewGroupFilter, page: number, perpage: number): Promise<Result<{ data: { id: string; no: string; status: string; date: Date; group: ReviewDocumentGroup }[]; paginate: { total: number; page: number; perpage: number; pages: number }; summary: Record<ReviewDocumentGroup, number> }>>`
  - RPC `PeriodEnds.findReviewDocuments` (pattern `period-ends.find-review-documents`) payload `{ user_id, tenant_id, module, group, page, perpage }`

- [ ] **Step 1: `findReview` ใส่ `group_counts`** ให้ `buildTx` รับ module key แล้วนับด้วย `reviewGroupOf` จาก documents ที่ดึงมาอยู่แล้ว (PR 1 ยังดึงทุกแถว ค่อยเปลี่ยนเป็น `groupBy` ใน Task 6) ค่าเดิมทุกฟิลด์ต้องไม่เปลี่ยน
- [ ] **Step 2: เขียน `findReviewDocuments`**
  - แยก lookup ของงวดปัจจุบันออกจาก `findReview` เป็น private `findCurrentReviewPeriod(prisma)` แล้วใช้ร่วมกัน (ไม่มีงวด → `PERIOD_END_NO_CURRENT_PERIOD`)
  - ทำ private config ต่อโมดูล (switch หรือ map) ที่บอก delegate, ชื่อคอลัมน์เลข/สถานะ/วันที่ และ where ฐานเดิมของ `findReview` (date range, `deleted_at: null`, `NUMBERED_DOC` เฉพาะ PR/SR) **ต้องเป็นเงื่อนไขเดียวกับ `findReview` ทุกตัว**
  - where ของแต่ละกลุ่ม = `status in REVIEW_STATUS_GROUPS[module][g]` และกลุ่ม `draft` ของ PR/PO ให้ OR กับ `status: null` ด้วย
  - อัลกอริทึมการแบ่งหน้า (ฟังก์ชันล้วน ไม่ใช้ raw SQL):
    ```
    counts = count ต่อกลุ่มทั้ง 4 (ส่งกลับเป็น `summary` เสมอ ไม่ขึ้นกับ filter)
    groups = REVIEW_FILTER_GROUPS[group] ตามลำดับ REVIEW_GROUP_ORDER
    total = sum(counts[g] for g in groups)
    offset = (page-1)*perpage; remaining = perpage; rows = []
    for g in groups:
      if offset >= counts[g]: offset -= counts[g]; continue
      rows += findMany(where g, orderBy [date asc, id asc], skip offset, take remaining)
      remaining -= taken; offset = 0
      if remaining == 0: break
    ```
  - map แถวเป็น `{ id, no, status: status ?? '', date, group: reviewGroupOf(...) }` · `pages = total === 0 ? 1 : ceil(total/perpage)` เหมือน `findAll`
  - clamp `perpage` ให้อยู่ใน 1–100 และ `page` ≥ 1
- [ ] **Step 3: เพิ่ม handler** ตามขั้นตอน 3 ขั้นที่หัวไฟล์ `period-ends.ts` อธิบายไว้ (literal ชั่วคราว → `bun run gen:rpc-contract` → แทนด้วย `PeriodEnds.findReviewDocuments.pattern`) โครงเหมือน handler `findReview` (audit context, `handleResult`)
- [ ] **Step 4: typecheck + lint + suite เดิม**
  Run: `cd apps/micro-business && bunx tsc --noEmit -p tsconfig.json && bun run lint && bunx jest src/inventory/period-end`
  Expected: ผ่าน (ถ้า spec เดิมพังเพราะ shape ของ `findReview` เปลี่ยน ให้แก้ fixture เดิมให้รวม `group_counts` เท่านั้น ห้ามเพิ่ม test)
- [ ] **Step 5: Commit** `git commit -m "feat(period-end): เพิ่ม group_counts ใน review และ handler ดึงรายการเอกสารแบบแบ่งหน้า"`

### Task 3: gateway — route ใหม่ + serializer + catalog

**Files:**
- Modify: `apps/backend-gateway/src/application/period-end/period-end.controller.ts` (วางถัดจาก `findReview` ราวบรรทัด 186–220)
- Modify: `apps/backend-gateway/src/application/period-end/period-end.service.ts` (ถัดจาก `findReview` ราวบรรทัด 123)
- Modify: `apps/backend-gateway/src/common/dto/period-end/period-end.serializer.ts`
- Modify (generated): `apps/backend-gateway/src/backstage/applications/app-api-catalog.generated.ts` ผ่าน `bun run scripts/generate-app-api-catalog/run.ts`
- Modify: swagger ใต้ `apps/backend-gateway/src/application/period-end/swagger/` ถ้ามีตัวอย่าง response ของ review

**Interfaces:**
- Consumes: RPC `PeriodEnds.findReviewDocuments` จาก Task 2
- Produces: `GET /api/:bu_code/period-ends/review/:module/documents?group=&page=&perpage=&version=` → envelope มาตรฐาน `{ data: ReviewDocumentRow[], paginate, summary }` (StdResponse เก็บแค่ data/paginate/summary) (FE ใน Task 4 อ่านตามนี้)

- [ ] **Step 1: serializer** เพิ่ม `group_counts` (`z.object({draft,in_progress,complete,cancelled: z.number().int().nonnegative()})`) ใน transaction item schema และเพิ่ม `PeriodEndReviewDocumentsResponseSchema` (row = `{id, no, status, date, group: z.enum([...])}`) + paginate + group_counts
- [ ] **Step 2: route** `@Get(':bu_code/period-ends/review/:module/documents')` + `@UseGuards(new AppIdGuard('period_end.findReviewDocuments'))` + `@Serialize(...)` + Swagger ครบเหมือน `findReview` · ตรวจ `:module` และ `group` ด้วย DTO/ParseEnum → ค่านอกชุดตอบ 400 · `page`/`perpage` ใช้ `PaginateQuery` เหมือน `findAll`
  **สำคัญ:** route นี้ต้องอยู่**ก่อน**ทุก route ที่ match `period-ends/:id` (ถ้ามี) เพื่อไม่ให้ชนกัน
- [ ] **Step 3: regenerate catalog** แล้วตรวจว่า `'period_end.findReviewDocuments'` ขึ้นทั้งในรายการและในบรรทัด module `period_end` และ `bun run audit:app-api-catalog-drift` ผ่าน
- [ ] **Step 4: typecheck + lint + suite เดิม + curl**
  Run: `cd apps/backend-gateway && bunx tsc --noEmit -p tsconfig.json && bun run lint && bunx jest src/application/period-end`
  แล้วรัน gateway (:4000) + micro-business บนเครื่อง ใช้บัญชี dev (admin@zebra.com) และตรวจตาม Review Focus:
  - `.../review/si/documents` → `group` เริ่มต้นเป็น incomplete, ลำดับ draft ก่อน in_progress, `group_counts` ตรงกับ `review`
  - `perpage=2` ไล่ทุกหน้าของ `group=all` แล้วเทียบ id กับ `perpage=100`: ต้องไม่มีซ้ำหรือหาย
  - `draft + in_progress` = `incomplete_count` และ `complete + cancelled` = `complete_count` ทุกโมดูล
  - `:module=xx` → 400 · `group=foo` → 400
  Expected: ทุกข้อตรง
- [ ] **Step 5: Commit + เปิด PR (BE PR 1)** `git commit -m "feat(period-end): เพิ่ม endpoint รายการเอกสาร review แบบแบ่งหน้าตามกลุ่มสถานะ"` ใน PR body ให้เขียนลำดับ deploy และขั้น allowlist (spec §ลำดับการ rollout ข้อ 1–2)

> **งานที่ user ต้องทำก่อนส่วน B ขึ้น env ไหนก็ตาม:** deploy BE PR 1 แล้วเติม `period_end.findReviewDocuments` ใน allowlist ของแถว application ทุก env ที่ไม่ได้ตั้ง `allow_all` (ดู `AppAllowlistStore.isAllowed`)

---

## ส่วน B — Frontend (`carmen-frontend`, branch `feature/period-end-review-documents`)

### Task 4: types + endpoint + hook

**Files:**
- Modify: `constant/api-endpoints.ts` (ถัดจาก `PERIOD_END_REVIEW` บรรทัด 281)
- Modify: `types/period-end.ts` (`ReviewDocument` บรรทัด 40, `ReviewTransactionStat` บรรทัด 47)
- Modify: `routes/inventory-management/period-end/use-period-end.ts` (`usePeriodEndReview` บรรทัด 62)
- Create: `routes/inventory-management/period-end/use-review-documents.ts`

**Interfaces:**
- Consumes: response ของ Task 3
- Produces:
  - `API_ENDPOINTS.PERIOD_END_REVIEW_DOCUMENTS(buCode: string, module: ReviewTransactionKey) => "/api/proxy/api/${buCode}/period-ends/review/${module}/documents"`
  - `export type ReviewDocumentGroup = "draft" | "in_progress" | "complete" | "cancelled"`
  - `export type ReviewGroupFilter = "incomplete" | "complete" | "cancelled" | "all"`
  - `export type ReviewGroupCounts = Record<ReviewDocumentGroup, number>`
  - `ReviewDocument` เพิ่ม `group: ReviewDocumentGroup` · `ReviewTransactionStat` เพิ่ม `group_counts: ReviewGroupCounts` และ**ถอด** `documents`
  - `useReviewDocuments(module: ReviewTransactionKey | null, group: ReviewGroupFilter, enabled: boolean)` คืนค่า `UseInfiniteQueryResult` ที่แต่ละหน้าเป็น `PaginatedResponse<ReviewDocument> & { summary: ReviewGroupCounts }`
  - `REVIEW_DOCUMENTS_PERPAGE = 50` (export จากไฟล์ hook)

- [ ] **Step 1: endpoint + types** ตาม Interfaces
- [ ] **Step 2: `usePeriodEndReview`** เลิก map `documents` และส่ง `group_counts` ผ่านไปตรง ๆ
- [ ] **Step 3: `useReviewDocuments`** ใช้ pattern ของ `hooks/use-comment-crud.ts:78` (`initialPageParam: 1`, `getNextPageParam` จาก `paginate.page < paginate.pages`) · queryKey `[QUERY_KEYS.PERIOD_ENDS, buCode, "review", module, "documents", group]` (prefix เดียวกับ review เพื่อให้ invalidate ทีเดียวได้) · `enabled: enabled && !!module && !!buCode` · url สร้างด้วย `buildUrl` ใส่ `group`, `page`, `perpage`
- [ ] **Step 4: typecheck + lint**
  Run: `bun run typecheck && bun run lint`
  Expected: error ที่เหลือมีแค่ `pe-documents-dialog.tsx` ที่อ่าน `stat.documents` (Task 5 แก้) ถ้าขึ้นที่อื่นให้หยุดแล้วรายงาน
- [ ] **Step 5: Commit** รวมกับ Task 5 (ห้าม commit ตอน typecheck แดง)

### Task 5: dialog — ตัวกรอง, infinite scroll, i18n

**Files:**
- Modify: `routes/inventory-management/period-end/pe-documents-dialog.tsx`
- Modify: `routes/inventory-management/period-end/pe-review.tsx` (จุดเรียก dialog บรรทัด ~307)
- Modify: `messages/en.json`, `messages/th.json` (namespace `inventoryManagement.periodEnd` ราวบรรทัด 3793)

**Interfaces:**
- Consumes: `useReviewDocuments`, `ReviewGroupFilter`, `ReviewGroupCounts`, `REVIEW_DOCUMENTS_PERPAGE` จาก Task 4
- Produces: props ของ `PeDocumentsDialog` คงเดิม (`stat` ยังส่งมาเพื่อเป็นตัวเลขชั่วคราวระหว่างหน้าแรกโหลด)

- [ ] **Step 1: i18n** เพิ่มคีย์ (ทั้ง en/th) แล้วเปลี่ยน `documentsSummary` ให้มี 4 กลุ่ม:
  - `documentsFilter.incomplete` "Incomplete" / "ยังไม่เสร็จ" · `.complete` "Complete" / "เสร็จแล้ว" · `.cancelled` "Cancelled / Void" / "ยกเลิก / Void" · `.all` "All" / "ทั้งหมด"
  - `documentsSummary` en: `"{draft} draft · {inProgress} in progress · {complete} complete · {cancelled} cancelled/void · {total} total"` th: `"ร่าง {draft} · กำลังดำเนินการ {inProgress} · เสร็จ {complete} · ยกเลิก/Void {cancelled} · รวม {total}"`
  - `noIncompleteDocuments` "No outstanding documents. Everything is done." / "ไม่มีใบค้าง ทุกใบเสร็จแล้ว"
  - `loadMoreFailed` "Couldn't load more documents." / "โหลดรายการเพิ่มไม่สำเร็จ" · `retry` ใช้คีย์ common ที่มีอยู่ถ้ามี
- [ ] **Step 2: dialog**
  - state `filter: ReviewGroupFilter` เริ่มที่ `"incomplete"` และ reset เป็น `"incomplete"` ทุกครั้งที่ `open` เปลี่ยนเป็น true หรือ `moduleKey` เปลี่ยน
  - ตัวกรองใช้ `components/ui/tabs.tsx` (หรือ toggle group ที่มีอยู่) ป้ายแต่ละอันแสดงจำนวน ลำดับ incomplete · complete · cancelled · all
  - ตัวเลขใช้ `summary` ของหน้าแรกจาก `useReviewDocuments` และระหว่างที่ยังไม่มี ใช้ `stat.group_counts` แทน
  - ตอนเปิด dialog ให้ `refetch` รายการ และ `queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PERIOD_ENDS, buCode, "review"], exact: true })`
  - `data` ของตาราง = แบนทุกหน้า (memo) และ columns memo เหมือนเดิม คอลัมน์ `#` ใช้ `row.index + 1` ซึ่งต่อเนื่องข้ามหน้าเพราะแบนแล้ว ตรวจกับดักใน `routes/CLAUDE.md` แล้วใส่ `"use no memo";` ถ้าเข้าข่าย
  - sentinel `<div>` ท้าย `DataGridScrollArea` + IntersectionObserver (root = scroll area) → `fetchNextPage()` เมื่อ `hasNextPage && !isFetchingNextPage` · แถว loading ท้ายตารางขณะโหลด · error ของหน้าถัดไป → ข้อความ `loadMoreFailed` + ปุ่มลองใหม่ โดยแถวเดิมยังอยู่
  - empty state: filter `incomplete` + ว่าง → `noIncompleteDocuments` · กรณีอื่น → `noDocuments` เดิม · โหลดหน้าแรก → skeleton/loading ของ DataGrid ที่มีอยู่
- [ ] **Step 3: ตรวจในเบราว์เซอร์** (`VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev` กับ BE จาก Task 3) ที่ `/inventory-management/period-end/review`:
  - เปิด Stock In → เห็นแค่ใบค้าง โดย draft มาก่อน · สลับไปดูทุกตัวกรองแล้วจำนวนตรงกับป้าย
  - เลื่อนจนโหลดหน้า 2 (ถ้าข้อมูลไม่ถึง 50 ใบ ให้ลด `REVIEW_DOCUMENTS_PERPAGE` ชั่วคราวเป็น 2 **แล้วคืนค่าก่อน commit**)
  - ปิด network แล้วเลื่อน → แถวเดิมยังอยู่ + ปุ่มลองใหม่ใช้ได้
  - ปิดแล้วเปิดโมดูลอื่น → ตัวกรองกลับเป็น "ยังไม่เสร็จ" และไม่มีแถวเก่าค้าง
  - กดเลขเอกสาร → ไปหน้าเอกสาร กลับมาเปิดใหม่แล้วตัวเลขอัปเดต · ดูทั้ง light/dark
- [ ] **Step 4: typecheck + lint + test suite เดิม**
  Run: `bun run typecheck && bun run lint && bun test:run`
  Expected: ผ่านทั้งหมด (`type-ladder.test.ts` / `status-ink-contrast.test.ts` ต้องเขียว)
- [ ] **Step 5: Commit + เปิด PR** `git commit -m "feat(period-end): dialog เอกสาร review กรองใบค้าง เรียงตามกลุ่มสถานะ และโหลดทีละหน้า"` ใน PR body ต้องเขียนว่า **deploy BE PR 1 และเติม allowlist `period_end.findReviewDocuments` ก่อน** ไม่อย่างนั้นผู้ใช้จะโดน logout

---

## ส่วน C — Backend PR 2 (หลัง FE ขึ้นทุก env แล้วเท่านั้น, branch `feature/period-end-review-drop-documents`)

### Task 6: review เลิกส่ง `documents` และนับด้วย `groupBy`

**Files:**
- Modify: `apps/micro-business/src/inventory/period-end/period-end.service.ts` (`findReview`, `buildTx`, type `PeriodEndReviewTransactionItem`)
- Modify: `apps/backend-gateway/src/common/dto/period-end/period-end.serializer.ts` (ถอด `documents`)
- Modify: swagger/fixture ของ spec เดิมที่อ้าง `documents`

**Interfaces:**
- Consumes: `REVIEW_STATUS_GROUPS`, `reviewGroupOf` (Task 1)
- Produces: review transaction item = `{ count, complete_count, incomplete_count, is_complete, group_counts }`

- [ ] **Step 1:** แทน `findMany` ทั้ง 7 ตัวใน `findReview` ด้วย `groupBy({ by: [<status col>], where: <where เดิม>, _count: { _all: true } })` แล้วรวมเป็น `group_counts` ด้วย `reviewGroupOf` · `count` = ผลรวม, `complete_count` = complete + cancelled, `incomplete_count` = draft + in_progress, `is_complete` = สูตรเดิม (`count > 0 && complete_count === count`)
- [ ] **Step 2:** ถอด `documents` จาก type และ serializer และแก้ fixture ของ spec เดิมให้ตรง
- [ ] **Step 3: typecheck + lint + suite + curl**
  Run: `bunx tsc --noEmit` ทั้งสองแอป, `bun run lint`, `bunx jest src/inventory/period-end` (micro) และ `bunx jest src/application/period-end` (gateway)
  แล้ว curl review เทียบตัวเลขทุกโมดูลกับก่อนแก้ (เก็บ response ก่อนแก้ไว้ใน scratchpad) ต้องเท่ากันทุกฟิลด์ยกเว้น `documents` ที่หายไป
- [ ] **Step 4: Commit + PR** `git commit -m "perf(period-end): review ส่งแค่ตัวเลขสรุป เลิกดึงรายชื่อเอกสารทุกใบ"`
