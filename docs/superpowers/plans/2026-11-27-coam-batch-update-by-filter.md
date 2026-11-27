# COAM batch-update-by-filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แก้ cost center / account ของทุกแถวที่ตรงตัวกรองบนหน้า `/config/chart-of-account-mapping` ได้ในคำขอเดียว (เกิน 50 แถวที่โหลดไว้)

**Architecture:** endpoint ใหม่ `POST account-mapping/batch-update-by-filter` ลอกแบบ `review-by-filter` ทุกชั้น (rpc-contract → micro-business service/controller → gateway DTO/service/controller/swagger → app-api-catalog) แล้ว FE ให้ sheet แก้หลายแถวเดิมยิง endpoint นี้เมื่ออยู่ในโหมด "เลือกทุกแถวที่ตรงตัวกรอง"

**Tech Stack:** NestJS + Prisma raw SQL + zod (backend) · React 19 + TanStack Query + use-intl (frontend)

**Spec:** `docs/superpowers/specs/2026-11-27-coam-batch-update-by-filter-design.md`

## Global Constraints

- **ข้ามขั้นตอนเขียนเทส / รันเทสแบบ TDD** ตามคำสั่ง user (CLAUDE.md global) — implement → typecheck/lint → commit; ห้ามสร้างไฟล์ `*.spec.ts` / `*.test.tsx` ใหม่ แต่เทสเดิมที่ mock hook ต้องยังผ่าน (แก้ mock ถ้าจำเป็น)
- branch: `feature/coam-batch-update-by-filter` ทั้งสองรีโป (แตกจาก `main`, ไม่มี `develop`)
- commit message ภาษาไทย; PR ภาษาอังกฤษ
- api_name: `account-mapping.batchUpdateByFilter` · rpc pattern: `account-mapping.batch-update-by-filter` · path: `batch-update-by-filter`
- permission เดียวกับ batch-update: `@Permission({ [RESOURCE]: ['update'] })`
- 409 ใช้ `ERROR_CATALOG.ACCOUNT_MAPPING_SCOPE_CHANGED` ที่มีอยู่แล้ว (ไม่สร้าง error ใหม่) · 422 จาก `invalidTarget()` เดิม
- ผลลัพธ์ `{ updated: number }`
- UPDATE ต้อง `doc_version = doc_version + 1`, `is_reviewed = true`, `updated_by_id`, `updated_at = now()`, เฉพาะ `deleted_at IS NULL`
- ไม่เช็ก doc_version รายแถว (user ยอมรับแล้ว)
- ลำดับ deploy: BE (micro-business + gateway) → allowlist `account-mapping.batchUpdateByFilter` → FE

## Review Focus

1. ส่ง `account_code: null` อย่างเดียว (คืนค่าเริ่มต้น) — SQL ต้องตั้ง `account_code = NULL` และไม่แตะ `cost_center_id`; ส่งเฉพาะ cost center ก็ห้ามแตะ account
2. ตัวกรองที่ตัวเองเป็นเป้าการแก้ (เช่น status = unmapped แล้วตั้ง account) — นับ+UPDATE อยู่ใน transaction เดียวและเลือก id จาก CTE ก่อนเขียน จึงต้องแก้ครบทุกแถวที่นับได้
3. แท็บ GL vs AP — `mapping_type` ต้องเข้า `statusCte(q.mapping_type)` เสมอ ไม่งั้นแก้ข้ามแท็บ
4. FE ต้องไม่ส่ง `sort` (schema `omit` ไว้ — ส่งมา zod strip หรือ 400) ใช้ helper เดียวกับ markReviewed
5. sheet โหมดตัวกรองเปิดค้าง แล้วผู้ใช้เปลี่ยนตัวกรอง — `scopeKey` effect ล้าง selection; sheet ต้องใช้ค่าตัวกรอง/จำนวนที่ snapshot ตอนกดเปิด (เหมือน `batchRows`) ไม่ใช่ค่าสดล่าสุด

---

### Task 1: Backend — endpoint batch-update-by-filter

รีโป: `../carmen-turborepo-backend`

**Files:**
- Modify: `packages/rpc-contract/src/contracts/account-mapping.ts` (เพิ่มบรรทัดถัดจาก `reviewByFilter` บรรทัด 23)
- Modify: `apps/micro-business/src/master/account-mapping/dto/account-mapping.dto.ts` (ถัดจาก `AccountMappingReviewByFilterSchema` ~บรรทัด 155)
- Modify: `apps/micro-business/src/master/account-mapping/account-mapping.service.ts` (method ใหม่ถัดจาก `batchUpdate()` ~บรรทัด 545)
- Modify: `apps/micro-business/src/master/account-mapping/account-mapping.controller.ts` (handler ถัดจาก `batchUpdate` ~บรรทัด 84)
- Modify: `apps/backend-gateway/src/common/dto/account-mapping/account-mapping.dto.ts` (ถัดจาก `AccountMappingBatchUpdateDto` ~บรรทัด 183)
- Modify: `apps/backend-gateway/src/application/account-mapping/account-mapping.service.ts` (ถัดจาก `batchUpdate` ~บรรทัด 135)
- Modify: `apps/backend-gateway/src/application/account-mapping/account-mapping.controller.ts` (ถัดจาก `batchUpdate` ~บรรทัด 368)
- Modify: `apps/backend-gateway/src/application/account-mapping/swagger/request.ts`
- Regenerate: `apps/backend-gateway/src/backstage/applications/app-api-catalog.generated.ts`

**Interfaces:**
- Produces: HTTP `POST /api/{bu_code}/account-mapping/batch-update-by-filter` (prefix เดียวกับ batch-update)
  body `{ mapping_type: 'AP'|'GL', expected_count: number, search?, location_id?, …ตัวกรอง list ที่เหลือ, status?, account_code?: string|null, cost_center_id?: uuid|null }` → `200 { data: { updated: number } }` · 409 `ACCOUNT_MAPPING_SCOPE_CHANGED` · 422 account/cost center invalid · 400 ไม่ส่งทั้ง account_code และ cost_center_id

- [ ] **Step 1: rpc contract** — `batchUpdateByFilter: rpc('account-mapping.batch-update-by-filter', 'micro-business').restTodo(),`

- [ ] **Step 2: zod schema ทั้งสองฝั่ง** — `AccountMappingBatchUpdateByFilterSchema` = `AccountMappingReviewByFilterSchema.extend({ account_code: z.string().min(1).nullable().optional(), cost_center_id: z.string().uuid().nullable().optional() })` + `.refine` "account_code or cost_center_id is required" (path `['account_code']`) แบบเดียวกับ batch-update · export type `IAccountMappingBatchUpdateByFilter` · gateway เพิ่ม `AccountMappingBatchUpdateByFilterDto extends createZodDto(...)` · JSDoc สองภาษาตามแบบไฟล์

- [ ] **Step 3: `batchUpdateByFilter(payload: unknown): Promise<Result<unknown>>` ใน micro-business service** (`@TryCatch`)
  parse → `invalidTarget(q.account_code, q.cost_center_id)` (คืนก่อน transaction) → `$transaction(async tx => …, { timeout: 25_000, maxWait: 10_000 })` นับแบบเดียวกับ `reviewByFilter()` → count ≠ expected_count คืน SCOPE_CHANGED → `$executeRaw` UPDATE.
  SET ต่อฟิลด์ประกอบด้วย `Prisma.sql` ตามที่ส่งมา (undefined = ไม่ใส่ในชุด SET; null = `= NULL`) แล้ว join ด้วย `Prisma.join(sets, ', ')`:
  ```ts
  const sets: Prisma.Sql[] = [];
  if (q.account_code !== undefined) sets.push(Prisma.sql`account_code = ${q.account_code}`);
  if (q.cost_center_id !== undefined) sets.push(Prisma.sql`cost_center_id = ${q.cost_center_id}::uuid`);
  sets.push(Prisma.sql`is_reviewed = true`, Prisma.sql`doc_version = m.doc_version + 1`,
            Prisma.sql`updated_by_id = ${this.userId}::uuid`, Prisma.sql`updated_at = now()`);
  ```
  WHERE: `m.id IN (SELECT r.id FROM r ${where}) AND m.deleted_at IS NULL` (ไม่กรอง is_reviewed) · คืน `Result.ok({ updated })` · comment ว่าทำไมต้องบวก doc_version เอง (raw SQL ข้าม client extension)
  (`NULL::uuid` ใช้ได้ใน Postgres จึงใช้ cast เดียวทั้งกรณีตั้งค่าและคืนค่าเริ่มต้น) · ตรวจชื่อคอลัมน์จริงกับ schema prisma ก่อน

- [ ] **Step 4: micro controller** — `@MessagePattern(AccountMapping.batchUpdateByFilter.pattern)` handler `batchUpdateByFilter` แบบเดียวกับ `reviewByFilter`

- [ ] **Step 5: gateway service + controller + swagger**
  service `batchUpdateByFilter(user_id, bu_code, data: IAccountMappingBatchUpdateByFilter, version)` → `this.rpc.call(AccountMapping.batchUpdateByFilter, …)`
  controller `@Post('batch-update-by-filter')` + `@UseGuards(new AppIdGuard('account-mapping.batchUpdateByFilter'))` + decorators ชุดเดียวกับ reviewByFilter (operationId `accountMapping_batchUpdateByFilter`, response `AccountMappingReviewResponseDto`, เพิ่ม `@ApiResponse` 400/422 แบบ batchUpdate)
  swagger `AccountMappingBatchUpdateByFilterRequest extends AccountMappingReviewByFilterRequest` + `account_code?` / `cost_center_id?` (nullable, อธิบาย null = คืนค่าเริ่มต้น)

- [ ] **Step 6: regenerate catalog** — Run: `bun run scripts/generate-app-api-catalog/run.ts` แล้ว `bun run audit:app-api-catalog-drift` · Expected: catalog มี `'account-mapping.batchUpdateByFilter'` และ audit ไม่รายงาน drift

- [ ] **Step 7: static checks** — Run typecheck/lint ของ `apps/micro-business`, `apps/backend-gateway`, `packages/rpc-contract` (ดู script ใน package.json ของแต่ละตัว) และ `bun test apps/micro-business/src/master/account-mapping` (เทสเดิมต้องผ่าน) · Expected: 0 error

- [ ] **Step 8: commit** — `feat(account-mapping): เพิ่ม batch-update-by-filter แก้บัญชี/cost center ทุกแถวที่ตรงตัวกรอง`

---

### Task 2: Frontend — ปุ่มแก้ไขในโหมดทุกแถว

รีโป: `carmen-frontend` (ไฟล์อยู่ใน `routes/config/chart-of-account-mapping/`)

**Files:**
- Modify: `routes/config/chart-of-account-mapping/use-account-mapping.ts` (ถัดจาก `useBatchUpdateAccountMapping` ~บรรทัด 213)
- Modify: `routes/config/chart-of-account-mapping/coam-batch-edit-sheet.tsx`
- Modify: `routes/config/chart-of-account-mapping/coam-component.tsx` (~บรรทัด 87–91 state, 230–275 markReviewed, 302–317 ปุ่ม, 453–459 sheet)
- Modify: `messages/en.json`, `messages/th.json` (namespace `config.chartOfAccountMapping`)
- Modify (ถ้าเทสเดิมพัง): `coam-component.test.tsx`, `coam-batch-edit-sheet.test.tsx` — เติม mock hook ใหม่เท่านั้น

**Interfaces:**
- Consumes: endpoint จาก Task 1
- Produces:
  ```ts
  export type BatchUpdateAccountMappingByFilterVariables =
    ReviewAccountMappingByFilterVariables & { account_code?: string | null; cost_center_id?: string | null };
  export function useBatchUpdateAccountMappingByFilter(); // mutation → { updated: number }, skipGlobalErrorToast
  ```
  sheet props: `rows` เดิม เปลี่ยนเป็น `target: { kind: "rows"; rows: AccountMappingRow[] } | { kind: "filter"; filter: ReviewAccountMappingByFilterVariables }`
  และ `onDone` เปลี่ยนเป็น `onDone: (result: BatchUpdateAccountMappingResult | { updated: number }) => void` — หรือแยก `onFilterDone(updated: number)` / `onScopeChanged()` (ผู้ลงมือเลือก ให้ type ชัด)

- [ ] **Step 1: hook** — `useBatchUpdateAccountMappingByFilter()` ยิง `${API_ENDPOINTS.ACCOUNT_MAPPING(buCode)}/batch-update-by-filter` ผ่าน `useAccountMappingMutation` แบบ `useReviewAccountMappingByFilter`

- [ ] **Step 2: helper ตัวกรองไม่มี sort** — ใน `coam-component.tsx` ดึง `const { sort: _sort, ...filters } = query` ที่ markReviewed ใช้ออกเป็นค่าเดียวที่ทั้ง markReviewed และปุ่มแก้ไขใช้ร่วม

- [ ] **Step 3: sheet โหมดตัวกรอง** — `kind: "filter"`: หัว `batchEditTitle` ด้วย `count = filter.expected_count`, คำบรรยายใช้คีย์ใหม่ `batchEditDescAllMatching`; save ส่ง `{ ...filter, ...ค่าตาม mode เดิม }` เข้า hook ใหม่ · 409 `ApiError.appCode === "ACCOUNT_MAPPING_SCOPE_CHANGED"` → แจ้ง caller ให้ toast `scopeChanged` + ล้างการเลือก + ปิด sheet · error อื่น → `errorToast` ไม่ปิด (เหมือนเดิม) · `canSave` ใช้ count > 0 แทน `rows.length > 0` · โหมด rows ไม่เปลี่ยนพฤติกรรม

- [ ] **Step 4: component** — เลิกเงื่อนไข `!allMatching` ของปุ่ม "แก้ไขที่เลือก" ตัวเลขแสดง `matchCount ?? selectedIds.length` · ตอนกด snapshot target ลง state (แทน `batchRows`): allMatching → `{ kind: "filter", filter: { ...filters, expected_count: matchCount } }` ไม่งั้น `{ kind: "rows", rows: selectedRows }` · สำเร็จโหมดตัวกรอง → `toast.success(t("batchEditDone", { count: updated }))` + `clearSelection()` + ปิด sheet · โหมด rows ใช้ `batchDone` เดิม

- [ ] **Step 5: i18n** — `batchEditDescAllMatching` en: `"All rows matching the current filters. Rows edited by someone else in the meantime will be overwritten."` th: `"ทุกแถวที่ตรงตัวกรองปัจจุบัน แถวที่มีคนแก้ระหว่างนี้จะถูกเขียนทับ"` (ห้ามมี `{{ }}` หรือ `<คำ>` ในข้อความ)

- [ ] **Step 6: static checks** — Run: `bun run typecheck && bunx eslint routes/config/chart-of-account-mapping && bun test:run routes/config/chart-of-account-mapping` · Expected: 0 error, เทสเดิมผ่าน

- [ ] **Step 7: commit** — `feat(coam): แก้ไขบัญชี/cost center ทุกแถวที่ตรงตัวกรองได้ในคำขอเดียว` (รวม spec + plan ใน commit แรกของ branch)

---

### Task 3: ตรวจมือ (ไม่ใช่เทส)

- [ ] รัน gateway + micro-business ในเครื่อง (`:4000` ชี้ dev DB ที่ใช้ร่วมกัน — ทำบน BU ทดสอบ T02/TEST เท่านั้น)
- [ ] curl `batch-update-by-filter` ด้วย `expected_count` ผิด → 409, ถูก → 200 `{updated}`, `cost_center_id` ไม่มีจริง → 422, ไม่ส่งค่าทั้งสอง → 400
- [ ] เสนอ user ตรวจในเบราว์เซอร์: กรองให้ได้ > 50 แถว → ติ๊กหัวตาราง → "เลือกทุกแถวที่ตรงตัวกรอง" → แก้ไขที่เลือก → ตั้ง cost center → ทุกแถวเปลี่ยน; ทั้ง light/dark
