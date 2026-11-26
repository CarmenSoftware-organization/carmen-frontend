# COAM ยืนยันว่าตรวจแล้วทั้งแท็บ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ผู้ใช้หน้า `/config/chart-of-account-mapping` ยืนยันว่าตรวจแล้ว "ทุกแถวที่ตรงเงื่อนไขปัจจุบัน" (หลักพันแถว) ได้ด้วยคำขอเดียว

**Architecture:** micro-business เพิ่ม `reviewByFilter` ที่ใช้ SQL filter ชุดเดียวกับ `findAll` (ดึงออกมาเป็น method ร่วม) และตรวจ `expected_count` ก่อน update · gateway เปิด `POST account-mapping/review-by-filter` · FE เพิ่มโหมด `allMatching` ที่มีแถบ "เลือกทั้งหมด N แถว"

**Tech Stack:** NestJS + Prisma raw SQL + zod (BE) · React 19 + TanStack Table/Query + next-intl (FE)

**Spec:** `docs/superpowers/specs/2026-11-26-coam-review-all-matching-design.md`

## Global Constraints

- **ข้ามขั้นตอนเขียน/รันเทสใหม่** (ความต้องการของผู้ใช้): ไม่สร้าง `*.spec.ts` / `*.test.ts` ใหม่ ส่วน type-check / lint ยังต้องรัน และเทสที่มีอยู่แล้วต้องยังผ่าน
- commit message เขียนเป็นภาษาไทย ส่วน code/identifier เป็นอังกฤษ
- BE: branch `feature/coam-review-all-matching` แตกจาก `main` ใน `../carmen-turborepo-backend` ส่วน FE ทำบน branch เดียวกันที่มีอยู่แล้ว
- api_name ใหม่: `account-mapping.reviewByFilter` · RPC cmd: `account-mapping.review-by-filter` · path: `POST /api/:bu_code/account-mapping/review-by-filter`
- ไฟล์แปลห้ามมี `{{}}` หรือ `<คำ>` และต้องมีทั้ง `messages/en.json` และ `messages/th.json`
- `batch-update` ยังคงเพดาน 100 แถว ห้ามแตะ

## Review Focus

1. **filter ไม่ตรงกับ list:** `reviewByFilter` ต้องใช้ fragment เดียวกับ `findAll` (รวม `search` และ `status`) เพราะถ้าเงื่อนไขต่างกัน แถวที่ผู้ใช้ไม่เห็นจะถูกตรวจไปด้วย ให้ตรวจด้วย curl ว่า `total` ของ list เท่ากับ count ที่ endpoint ใหม่นับได้ (Task 1 Step 4)
2. **มีแถวเพิ่มระหว่างที่ดูอยู่:** ต้องได้ 409 `ACCOUNT_MAPPING_SCOPE_CHANGED` และไม่มีแถวไหนถูกแตะ (Task 1 Step 4)
3. **เปลี่ยน filter ขณะอยู่ในโหมด allMatching:** ต้องออกจากโหมด ห้ามส่ง filter ใหม่ไปพร้อม `expected_count` เก่า (Task 3 Step 3)
4. **แถวที่ตรวจแล้ว:** ห้ามนับซ้ำใน `updated` แต่ต้องนับรวมใน `expected_count` เพราะใช้ total เดียวกับ list (Task 1)
5. **รายการโหลดครบแล้ว** (`total <= rows.length`): ห้ามแสดงแถบ และให้ใช้ `review` ด้วย ids เหมือนเดิม (Task 3)

---

### Task 1: micro-business — `reviewByFilter` + error catalog

**Files:**
- Modify: `packages/error-catalog/src/catalog.ts` (ต่อจาก `ACCOUNT_MAPPING_NOT_FOUND` บรรทัดประมาณ 2625)
- Modify: `apps/micro-business/src/master/account-mapping/dto/account-mapping.dto.ts`
- Modify: `apps/micro-business/src/master/account-mapping/account-mapping.service.ts:186-235` (findAll) + method ใหม่ต่อจาก `review` (บรรทัด 481)
- Modify: `apps/micro-business/src/master/account-mapping/account-mapping.controller.ts` (ต่อจาก handler `review` บรรทัด 58)
- Regenerate: `packages/rpc-contract/src/contracts/account-mapping.ts` (ด้วย `bun run gen:rpc-contract` เท่านั้น)

**Interfaces:**
- Produces: catalog `ACCOUNT_MAPPING_SCOPE_CHANGED` (`http_status: 409`, `id: makeId(MODULE.ACCOUNT_MAPPING, 4)` ถ้าเลข 4 ถูกใช้แล้วให้ใช้เลขถัดไปที่ว่าง, en: `The list changed since it was loaded`, th: `รายการเปลี่ยนไปหลังจากที่โหลด`)
- Produces: `AccountMappingReviewByFilterSchema = AccountMappingListQuerySchema.omit({ page: true, perpage: true, sort: true }).extend({ expected_count: z.number().int().min(0) })`
- Produces: RPC `AccountMapping.reviewByFilter` · result `{ updated: number }`

- [ ] **Step 1:** เพิ่ม catalog entry และรัน build ของ package error-catalog ตามที่ repo ทำ (ดู script ใน `packages/error-catalog/package.json`)
- [ ] **Step 2:** ดึงการสร้าง `filters` ใน `findAll` ออกมาเป็น `private listFilters(q: { search?: string; location_id?: string[]; ... }): Prisma.Sql` (รับ type ที่เป็นส่วนร่วมของสอง schema เช่น `Omit<AccountMappingListQuery, 'page' | 'perpage' | 'sort'>`) แล้วให้ `findAll` เรียกใช้ โดยต้องได้ผลเหมือนเดิม และ `account-mapping.service.spec.ts` ที่มีอยู่ต้องยังผ่าน
- [ ] **Step 3:** เขียน `@TryCatch async reviewByFilter(payload: unknown): Promise<Result<unknown>>`
  - parse ด้วย `AccountMappingReviewByFilterSchema` · `cte = statusCte(q.mapping_type)` · `where = listFilters(q)` + `statusWhere(q.status)`
  - ทำใน `this.prismaService.$transaction(async (tx) => …)`:
    count แบบเดียวกับ `totals` ของ findAll → ถ้าไม่เท่ากับ `expected_count` ให้ `return Result.errorFromCatalog(ERROR_CATALOG.ACCOUNT_MAPPING_SCOPE_CHANGED)`
    → `tx.$executeRaw\`${cte} UPDATE ${this.t('tb_account_mapping')} SET is_reviewed = true, updated_by_id = ${this.userId}::uuid, updated_at = now() WHERE id IN (SELECT r.id FROM r WHERE true ${filters} ${statusWhere}) AND is_reviewed = false AND deleted_at IS NULL\``
  - คืน `Result.ok({ updated: <จำนวนจาก $executeRaw> })`
  - ถ้า `$executeRaw` ทำงานกับ CTE ที่นำหน้า UPDATE ไม่ได้ ให้ใช้ `SELECT r.id` ก่อน แล้วตามด้วย `updateMany({ where: { id: { in } } })` ภายใน tx เดียวกัน ซึ่งยังถือเป็นคำขอเดียวจากฝั่ง FE
- [ ] **Step 4:** เพิ่ม handler ใน controller ตามขั้น 3 ขั้นที่หัวไฟล์ `rpc-contract` บอกไว้ (literal `{ cmd: 'account-mapping.review-by-filter', service: 'micro-business' }` → `bun run gen:rpc-contract` → `AccountMapping.reviewByFilter.pattern`)
- [ ] **Step 5:** รัน `bun run typecheck` (หรือ `tsc --noEmit` ของ micro-business) และ `bun test` เฉพาะ `account-mapping` ต้องผ่านทั้งหมด
- [ ] **Step 6:** Commit `feat(account-mapping): เพิ่ม reviewByFilter ตรวจทุกแถวที่ตรงเงื่อนไขในคำขอเดียว`

### Task 2: gateway — `POST account-mapping/review-by-filter`

**Files:**
- Modify: `apps/backend-gateway/src/common/dto/account-mapping/account-mapping.dto.ts` (ต่อจาก `AccountMappingReviewDto` บรรทัด 132)
- Modify: `apps/backend-gateway/src/application/account-mapping/account-mapping.controller.ts` (ต่อจาก `review` บรรทัด 272)
- Modify: `apps/backend-gateway/src/application/account-mapping/account-mapping.service.ts` (ต่อจาก `review` บรรทัด 96)
- Modify: `apps/backend-gateway/src/application/account-mapping/swagger/request.ts` (+ `response.ts` ถ้าไม่มี response ของ review ให้ใช้ซ้ำ)
- Modify: `packages/prisma-shared-schema-backstage/prisma/permission.route-map.ts:372` → เพิ่ม `'app:account-mapping:review-by-filter': 'update'`
- Regenerate: `apps/backend-gateway/src/backstage/applications/app-api-catalog.generated.ts` ด้วย `bun run scripts/generate-app-api-catalog/run.ts`

**Interfaces:**
- Consumes: `AccountMapping.reviewByFilter` (Task 1)
- Produces: `AccountMappingReviewByFilterSchema` / `AccountMappingReviewByFilterDto` ของ gateway ที่ทำ omit/extend แบบเดียวกับ Task 1 โดยใช้ `AccountMappingListQuerySchema` ของ gateway (บรรทัด 67) แต่เนื่องจากเป็น body JSON ให้ `expected_count: z.number().int().min(0)` แบบไม่ coerce

- [ ] **Step 1:** เพิ่ม schema/DTO, `svc.reviewByFilter(user_id, bu_code, data, version)` และ controller `@Post('review-by-filter')` โดยลอก decorator ของ `review` ทุกตัว (`AppIdGuard('account-mapping.reviewByFilter')`, `@Permission({ [RESOURCE]: ['update'] })`, `HttpCode(OK)`) พร้อม swagger ทั้งสองภาษา, `operationId: 'accountMapping_reviewByFilter'` และ `@ApiResponse({ status: 409 })`
- [ ] **Step 2:** เพิ่ม route-map entry และ regenerate catalog จากนั้นรัน `bun run scripts/audit-app-api-catalog-drift/run.ts` ต้องไม่มี drift
- [ ] **Step 3:** typecheck gateway แล้วรันเทส account-mapping ที่มีอยู่ต้องผ่าน
- [ ] **Step 4 (ตรวจมือ):** รัน gateway + micro-business ในเครื่อง แล้วใช้ curl ตามนี้ (บัญชี dev ตาม memory local-backend-test-accounts, BU T02)
  1. `GET …/account-mapping?mapping_type=AP&status=unreviewed&perpage=1` แล้วจด `paginate.total` = N
  2. `POST …/review-by-filter` `{"mapping_type":"AP","status":"unreviewed","expected_count":N+1}` ต้องได้ 409 แล้ว list ซ้ำต้องได้ N เท่าเดิม
  3. ถ้า user ยอมให้แตะ dev DB (เป็น DB ที่ใช้ร่วมกัน ต้องถามก่อน) ให้ใช้ filter ที่แคบ เช่น `location_id` เดียว แล้วส่ง `expected_count` ที่ถูกต้อง ต้องได้ `{updated: N}` และ list ซ้ำต้องได้ 0
- [ ] **Step 5:** Commit `feat(gateway): เปิด POST account-mapping/review-by-filter` แล้ว push และเปิด PR (ภาษาอังกฤษ) ระบุลำดับ deploy ไว้ในตัว PR

### Task 3: FE — โหมดเลือกทั้งหมด + เรียก endpoint ใหม่

**Files:**
- Modify: `routes/config/chart-of-account-mapping/use-account-mapping.ts` (ต่อจาก `useReviewAccountMapping` บรรทัด 152)
- Create: `routes/config/chart-of-account-mapping/coam-select-all-banner.tsx`
- Modify: `routes/config/chart-of-account-mapping/coam-component.tsx:84-260` และบริเวณ `<DataGrid` (บรรทัด 342)
- Modify: `messages/en.json`, `messages/th.json` (namespace เดียวกับ `markReviewedDone` บรรทัดประมาณ 3419)

**Interfaces:**
- Consumes: endpoint ของ Task 2 + appCode `ACCOUNT_MAPPING_SCOPE_CHANGED`
- Produces: `useReviewAccountMappingByFilter()` ใช้ `useAccountMappingMutation<Omit<AccountMappingListParams, "page" | "perpage" | "sort"> & { expected_count: number }, { updated: number }>` ยิงไปที่ `…/review-by-filter` พร้อม `{ skipGlobalErrorToast: true }`
- Produces: `CoamSelectAllBanner({ loaded, total, allMatching, onSelectAll, onClear }: { loaded: number; total: number; allMatching: boolean; onSelectAll: () => void; onClear: () => void })`

- [ ] **Step 1:** เพิ่ม hook และ i18n keys ทั้ง en/th:
  `selectedLoaded` "Selected {count} rows shown" / "เลือก {count} แถวที่แสดงอยู่" · `selectAllMatching` "Select all {count} rows" / "เลือกทั้งหมด {count} แถว" · `allMatchingSelected` "All {count} rows selected" / "เลือกทั้งหมด {count} แถวแล้ว" · `clearSelection` "Clear selection" / "ล้างที่เลือก" · `scopeChanged` "The list changed while you were viewing it. Please check again." / "รายการเปลี่ยนไประหว่างที่ดูอยู่ กรุณาตรวจอีกครั้ง"
- [ ] **Step 2:** สร้าง banner โดยใช้ primitive จาก `components/ui/` (ข้อความ `text-sm` + `Button variant="link" size="sm"`) วางเหนือตาราง ต้องอ่านออกทั้ง light/dark และตัวเลขใช้ `tabular-nums` พร้อม format ด้วย `useNumberFormatter` ถ้าหน้าใช้อยู่
- [ ] **Step 3:** ใน `coam-component.tsx`:
  - `const [allMatching, setAllMatching] = useState(false)`
  - `showBanner = table.getIsAllRowsSelected() && totalRecords > rows.length` (ถ้า `allMatching` เป็นจริงก็ให้แสดงด้วย)
  - ให้ `useEffect` ที่ผูกกับ `scopeKey` และ `switchTab` เรียก `setAllMatching(false)` ด้วย · เมื่อ selection เปลี่ยนจนไม่ใช่ all-rows-selected แล้ว ให้ `setAllMatching(false)` (เขียนผ่าน handler ของ `onRowSelectionChange` หรือคำนวณ derived ก็ได้ ห้ามเกิด loop)
  - ใน `allMatching` ปุ่มยืนยันให้แสดง `({totalRecords})` และซ่อนปุ่ม "แก้ที่เลือก"
  - `markReviewed`: ถ้า `allMatching` ให้เรียก hook ใหม่ด้วย `{ ...queryWithoutSort, expected_count: totalRecords }` · ถ้าสำเร็จให้ขึ้น `markReviewedDone` แล้ว reset ทั้ง selection และ `allMatching` · ถ้า `err.appCode === "ACCOUNT_MAPPING_SCOPE_CHANGED"` ให้ขึ้น `toast.warning(t("scopeChanged"))` แล้ว reset ทั้งคู่ (refetch เกิดเองจาก invalidate ใน `useAccountMappingMutation`) · ถ้าเป็น error อื่นให้ส่งไป `errorToast(err)`
  - ถ้าไม่ได้อยู่ใน `allMatching` ให้ทำงานแบบเดิมทุกอย่าง
- [ ] **Step 4:** รัน `bun run typecheck`, lint และ `bun test:run routes/config/chart-of-account-mapping` (เทสเดิม) รวมถึง `components/ui/type-ladder.test.ts` ต้องผ่านทั้งหมด
- [ ] **Step 5 (ตรวจมือ):** เปิด `http://localhost:3000/config/chart-of-account-mapping` ที่ชี้ไปยัง backend ในเครื่องที่มี Task 1–2 แล้วตรวจว่า
  - ติ๊กหัวตารางแล้วแถบขึ้น และกดเลือกทั้งหมดแล้วปุ่มแสดงจำนวนรวม
  - เปลี่ยน filter แล้วโหมดหลุด
  - เอาติ๊กออกหนึ่งแถวแล้วโหมดหลุด
  - เมื่อรายการน้อยกว่า 50 แถว แถบไม่ขึ้น
  - ดูทั้ง light และ dark
- [ ] **Step 6:** Commit `feat(coam): เลือกทั้งหมดในแท็บแล้วยืนยันว่าตรวจแล้วในครั้งเดียว` จากนั้นรัน `trail check` แล้ว push และเปิด PR (ภาษาอังกฤษ) อ้าง BE PR และระบุลำดับ deploy

## ลำดับ deploy (ใส่ใน PR ทั้งสองใบ)

micro-business + gateway → เพิ่ม `account-mapping.reviewByFilter` ใน allowlist ของ app บน env ที่ไม่ได้ allow_all → FE (ไม่มี migration)
