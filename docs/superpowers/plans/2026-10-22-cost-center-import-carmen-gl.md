# Cost Center — ดึงจาก Carmen GL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปุ่ม "นำเข้าจาก Carmen GL" ในหน้า `/config/cost-center` ที่ sync department ของ Carmen 4 ลง `tb_cost_center` ตาม `sync_policy` ของคอนฟิก Carmen GL

**Architecture:** แยกส่วน "อ่านคอนฟิก → ถอด token → เรียก Carmen 4 → ตรวจ Paging" ออกจาก `ChartOfAccountsService` เป็น helper กลางใน micro-business แล้วให้ `CostCenterService.importFromInterfaceCarmenGl()` เรียกใช้ helper นั้น การตรวจว่า cost center ถูกใช้อยู่หรือไม่ใช้นิยามเดียวกับการลบปกติ โดยปรับเป็นแบบ batch gateway เปิด `POST .../cost-centers/import-from-interface/carmen-gl` ฝั่ง FE ทำปุ่มตามแบบปุ่มของผังบัญชี

**Tech Stack:** NestJS + Prisma (micro-business, backend-gateway), `@repo/error-catalog`, `@repo/rpc-contract` · React 19 + TanStack Query + use-intl (FE)

**Spec:** `docs/superpowers/specs/2026-10-22-cost-center-import-carmen-gl-design.md`

## Global Constraints

- **ไม่เขียนเทสใหม่** (ความต้องการของ user) ทุก task จบด้วย typecheck + lint + commit แต่ **เทสเดิมที่เกี่ยวข้องต้องผ่าน** (ระบุในแต่ละ task)
- รีโป backend: `../carmen-turborepo-backend-v2` · รีโป FE: `carmen-inventory-frontend-react` · ทั้งสองรีโปใช้ branch ชื่อ `feature/cost-center-import-carmen-gl` แตกจาก `main`
- commit message เขียนภาษาไทย แบบ conventional (`feat(cost-center): …`) ส่วน PR เขียนภาษาอังกฤษ
- คอมเมนต์ในโค้ด backend ใช้รูปแบบ JSDoc สองภาษา (EN / TH) ตามไฟล์ข้างเคียง ส่วน FE ใช้ภาษาไทยตามไฟล์ข้างเคียง
- ค่าที่ spec กำหนด: `MAX_IMPORT_ROWS = 2000`, `MAX_CODE_LENGTH = 50`, `MAX_SUMMARY_ERRORS = 100` (import จาก `chart-of-accounts.import.ts` ห้ามประกาศซ้ำ) · คีย์คอนฟิก `interface_accounting_carmen_gl` · path key `department_path`
- api_name: `cost-centers.import-from-interface.carmen-gl` · RPC pattern: `cost-center.import-from-interface-carmen-gl`
- token ที่ถอดรหัสแล้วห้ามถูก log ห้ามข้าม RPC และห้ามอยู่ใน response · ถ้าต้นทางตอบ error ห้ามแนบ response body มากับ error
- i18n ห้ามมี `{{…}}` หรือ `<คำ>`

## Review Focus

ผู้ใช้สั่งว่าไม่ต้องเขียนเทส จึงตรวจรายการนี้ด้วยมือใน Task 6 แทน เรียงจากที่น่าจะเจอบ่อยที่สุด

1. `DeptCode` ต่างกันแค่ตัวพิมพ์หรือมีช่องว่างท้าย (`"gen "` เทียบกับ `GEN`) ต้องจับคู่กับแถวเดิมได้ ห้ามสร้างแถวซ้ำ
2. ตั้ง `on_local_only = delete` แล้ว Carmen 4 ตอบ `Data: []` ต้องได้ `COST_CENTER_IMPORT_EMPTY` และ**ห้ามลบอะไรเลย**
3. cost center ที่ถูกอ้างถึงเฉพาะใน `tb_gl_balance` / `tb_ap_payment_expense` (สองตารางนี้ไม่มี `deleted_at`) ต้องนับว่าถูกใช้อยู่ จึงห้ามลบ
4. ตัวที่ผู้ใช้ปิดใช้งานไว้ เมื่อตั้ง `upsert` ต้องกลับมาใช้งานและนับเป็น updated ส่วนตอน `skip` ต้องคงสถานะเดิม
5. กดปุ่มซ้ำระหว่างกำลังนำเข้า ต้องไม่ยิงคำขอที่สอง (ปุ่มและ dialog ต้อง disabled ตอน pending)

---

### Task 1: Error catalog — รหัสชุด cost center import

**Files:**
- Modify: `packages/error-catalog/src/catalog.ts` (ต่อจาก `COST_CENTER_IN_USE` บรรทัดราว 1415)
- Regenerate: `packages/error-catalog/reference/error-codes.json`, `error-codes.md`

**Interfaces:**
- Produces: `ERROR_CATALOG.COST_CENTER_IMPORT_EMPTY` (id 5), `COST_CENTER_IMPORT_TOO_MANY_ROWS` (6, `{max}`), `COST_CENTER_IMPORT_REJECTED` (7, `{rows}`), `COST_CENTER_INTERFACE_NOT_CONFIGURED` (8), `COST_CENTER_INTERFACE_DISABLED` (9), `COST_CENTER_INTERFACE_REQUEST_FAILED` (10, 502, `{status}`), `COST_CENTER_INTERFACE_MULTI_PAGE` (11, `{pages}`), `COST_CENTER_INTERFACE_TOKEN_UNREADABLE` (12) ทั้งหมดใช้ `makeId(MODULE.COST_CENTER, n)`

- [ ] **Step 1: เพิ่ม 8 entry** — `http_status` และข้อความ EN/TH ให้ล้อตาม `CHART_OF_ACCOUNTS_*` ตัวที่คู่กัน แต่เปลี่ยนคำว่า "chart of accounts / ผังบัญชี" เป็น "cost centers / ศูนย์ต้นทุน" และเปลี่ยน "Import file" เป็น "Accounting interface" เพราะไม่มีไฟล์ เช่น `COST_CENTER_IMPORT_EMPTY` → `'Accounting interface returned no departments'` / `'ระบบบัญชีไม่ได้คืนรายการแผนกมาเลย'`
- [ ] **Step 2:** `cd packages/error-catalog && bun run gen:reference && bun run check-types && bun run test` — คาดว่า reference ถูกสร้างใหม่ และไม่มี id ชนกัน
- [ ] **Step 3: Commit** `feat(error-catalog): เพิ่มรหัส error การนำเข้าศูนย์ต้นทุนจาก Carmen GL`

### Task 2: Helper กลางสำหรับเรียก Carmen GL + ย้ายผังบัญชีมาใช้

**Files:**
- Create: `apps/micro-business/src/master/carmen-gl-interface/carmen-gl-interface.ts`
- Modify: `apps/micro-business/src/master/chart-of-accounts/chart-of-accounts.service.ts` — ส่วน `importFromInterfaceCarmenGl` (บรรทัดราว 859–994) รวมถึงค่าคงที่ `CARMEN_GL_CONFIG_KEY` และ `CARMEN_FETCH_TIMEOUT_MS` ที่ย้ายออกไปด้วย

**Interfaces:**
- Produces:
```ts
export type CarmenGlPathKey = 'account_code_path' | 'department_path';
export interface CarmenGlSyncPolicy {
  on_duplicate: 'skip' | 'upsert' | 'error';
  on_local_only: 'keep' | 'delete';
}
export interface CarmenGlErrorCodes {
  notConfigured: CatalogEntry; disabled: CatalogEntry; tokenUnreadable: CatalogEntry;
  requestFailed: CatalogEntry; multiPage: CatalogEntry; empty: CatalogEntry; tooManyRows: CatalogEntry;
}
export async function fetchCarmenGlRows(
  prisma: <ชนิดของ this.prismaService>,   // ต้องมี tb_application_config อยู่
  pathKey: CarmenGlPathKey,
  codes: CarmenGlErrorCodes,
): Promise<{ ok: true; rows: unknown[]; policy: CarmenGlSyncPolicy } | { ok: false; result: Result<unknown> }>;
```
  (`CatalogEntry` ให้ใช้ชนิดเดียวกับที่ `Result.errorFromCatalog` รับ ไม่ต้องประกาศใหม่ถ้ามี export อยู่แล้ว)

- [ ] **Step 1: ย้ายโค้ดลง `fetchCarmenGlRows`** — ย้ายลำดับเดิมทั้งหมดมาแบบไม่แก้พฤติกรรม: ไม่มีแถว config → notConfigured · `enabled !== true` → disabled · ไม่มี `api_server` / `config[pathKey]` / `authorize_token` → notConfigured · `decryptSecret` throw → tokenUnreadable (ทิ้ง error ทั้งก้อน) · ต่อ URL โดยตัด `/` ส่วนเกิน · fetch พร้อม `AbortSignal.timeout(20000)` · `!ok` → requestFailed `{status}` · throw → requestFailed `{status: 0}` · `PageCount > 1` → multiPage `{pages}` · `Data` ว่าง → empty · เกิน `MAX_IMPORT_ROWS` → tooManyRows `{max}` · `policy` default เป็น `skip`/`keep` คอมเมนต์อธิบาย "ทำไม" ทุกจุดให้ย้ายตามมาด้วย
- [ ] **Step 2: แก้ `ChartOfAccountsService.importFromInterfaceCarmenGl`** ให้เรียก `fetchCarmenGlRows(this.prismaService, 'account_code_path', { …CHART_OF_ACCOUNTS_* })` แล้วทำต่อเฉพาะส่วน map → ตรวจรหัสซ้ำ → `reconcileAndPersist` ส่วน `IChartOfAccountsSyncPolicy` ต้องยังรับ `CarmenGlSyncPolicy` ได้ (ถ้าชนิดตรงกันอยู่แล้วก็ไม่ต้องแก้)
- [ ] **Step 3: ตรวจ** `cd apps/micro-business && bunx tsc --noEmit -p . && bunx eslint src/master/carmen-gl-interface src/master/chart-of-accounts && bunx jest src/master/chart-of-accounts` — คาดว่าผ่านทั้งหมด ผังบัญชีต้องทำงานเหมือนเดิม
- [ ] **Step 4: Commit** `refactor(chart-of-accounts): แยกการเรียก Carmen GL เป็น helper กลาง`

### Task 3: CostCenterService.importFromInterfaceCarmenGl + RPC handler

**Files:**
- Create: `apps/micro-business/src/master/cost-center/cost-center.import.ts`
- Modify: `apps/micro-business/src/master/cost-center/cost-center.service.ts` (`countReferences` บรรทัด 269, `delete` บรรทัด 314)
- Modify: `apps/micro-business/src/master/cost-center/cost-center.controller.ts`
- Modify: `apps/micro-business/src/master/cost-center/interface/*.ts` (ชนิดของผลลัพธ์)
- Regenerate: `packages/rpc-contract/src/contracts/cost-center.ts` (ผ่าน `bun run gen:rpc-contract` ที่ root ห้ามแก้ไฟล์นี้เอง)

**Interfaces:**
- Consumes: `fetchCarmenGlRows`, `CarmenGlSyncPolicy` (Task 2) · `ERROR_CATALOG.COST_CENTER_*` (Task 1)
- Produces:
```ts
// cost-center.import.ts
export interface ICarmenDepartmentMappedRow { row: number; code: string; name: string }
export function mapCarmenDepartment(raw: unknown, row: number):
  { ok: true; value: ICarmenDepartmentMappedRow } | { ok: false; error: IChartOfAccountsImportRowError };
// cost-center.service.ts
private async countReferencesMany(ids: string[]): Promise<Map<string, { locations: number; account_mappings: number; accounting_records: number }>>;
async importFromInterfaceCarmenGl(): Promise<Result<unknown>>;
// ผลลัพธ์ data (ใช้ทั้งตอนสำเร็จและใน details ของ 400 REJECTED)
interface ICostCenterImportResult {
  summary: { total_rows: number; created: number; updated: number; skipped: number; deleted: number; in_use: number; errors: number };
  errors: { row: number; column?: string; message: string }[];
  deleted_codes: string[];
  in_use_codes: string[];
}
```
  RPC: `CostCenter.importFromInterfaceCarmenGl` → pattern `cost-center.import-from-interface-carmen-gl` แอป `micro-business` (`.restTodo()`)

- [ ] **Step 1: `mapCarmenDepartment`** — `DeptCode` ให้ trim ถ้าว่างเป็น error `('DeptCode', 'DeptCode must not be empty')` ถ้ายาวเกิน `MAX_CODE_LENGTH` เป็น error · `Description` ให้ trim ถ้าว่างเป็น error `('Description', …)` · ถ้า raw ไม่ใช่ object เป็น error · ฟิลด์อื่นไม่ต้องอ่าน
- [ ] **Step 2: `countReferencesMany`** — นับตารางชุดเดียวกับ `countReferences` เดิมทุกตาราง โดยใช้ตัวกรองเดิมทุกตัว (`tb_gl_balance` กับ `tb_ap_payment_expense` นับทุกแถว ตัวอื่นนับเฉพาะ `deleted_at: null`) และใช้ `cost_center_id: { in: ids }` ร่วมกับ `groupBy` (AP/AR invoice detail ทำ `groupBy` แยกตามคอลัมน์ `dr_`/`cr_`/`vat_`/`tax2_` แล้วรวมผล) id ที่ไม่มีการอ้างอิงเลยต้องได้ `{0,0,0}` ไม่ใช่ undefined · ให้ `countReferences(id)` เดิมเรียก `countReferencesMany([id])` แทน เพื่อให้ `delete()` ได้ผลเหมือนเดิม
- [ ] **Step 3: `importFromInterfaceCarmenGl`** — `@TryCatch` และ logger แบบเดียวกับผังบัญชี:
  1. เรียก `fetchCarmenGlRows(this.prismaService, 'department_path', {…COST_CENTER_*})` ถ้าได้ `!ok` ให้คืน `result`
  2. map ทุกแถว แล้วตรวจรหัสซ้ำภายในชุด (ไม่สนตัวพิมพ์) แถวซ้ำได้ error `('DeptCode', 'Duplicate of row N in the same response')`
  3. อ่านแถว live ทั้งหมด (`deleted_at: null`, select `id, code, name, is_active`) แล้วจับคู่ด้วย `code.toLowerCase()` ตาม `on_duplicate`:
     - `error` → แถว error `('DeptCode', 'Cost center code X already exists')`
     - `skip` → skipped
     - `upsert` → ถ้า `name` ตรงอยู่แล้วและ `is_active === true` ให้นับ skipped ไม่ตรงก็ใส่ toUpdate `{ id, name, is_active: true }`
     - ค่าที่ไม่รู้จัก → แถว error (ห้ามตกไปทับข้อมูล)
  4. มี error อย่างน้อยหนึ่งแถว → คืน `Result.errorFromCatalog(COST_CENTER_IMPORT_REJECTED, { rows }, null, { summary (ตัวนับเป็น 0 ทั้งหมด ยกเว้น total_rows/errors), errors: slice(0, MAX_SUMMARY_ERRORS) })`
  5. ถ้า `on_local_only === 'delete'`: candidates คือแถว live ที่ไม่อยู่ในชุดที่ดึงมา ให้นับด้วย `countReferencesMany` ตัวที่ผลรวมเป็น 0 จะถูกลบ ส่วนตัวอื่นเข้า `in_use_codes`
  6. ทำทั้งหมดใน `$transaction` เดียว (ใช้ `{ timeout: 25000, maxWait: 8000 }` เท่ากับผังบัญชี): `createMany` (code, name, `is_active: true`, `created_by_id`) · update ทีละแถว (`name`, `is_active: true`, `updated_by_id`, `updated_at`; ไม่ต้องเช็ก doc_version แต่ต้อง `doc_version: { increment: 1 }` ถ้า `update()` เดิมของ service ทำแบบนั้นด้วย ให้ไปดูของเดิมก่อน) · ลบแถวที่ไม่มีใครใช้ (`deleted_at`, `deleted_by_id`, `is_active: false`) พร้อม soft delete `tb_cost_center_account` ที่ `cost_center_id in` ชุดเดียวกัน
  7. ถ้าเจอ P2002 → `COST_CENTER_DUPLICATE_CODE` (ใช้ duck-typing แบบ `isUniqueConstraintViolation` ของผังบัญชี ถ้าย้าย helper นี้ไปไว้ที่ `carmen-gl-interface.ts` ก็ได้)
  8. คืน `Result.ok(ICostCenterImportResult)` โดยตัด `deleted_codes` / `in_use_codes` ที่ `MAX_SUMMARY_ERRORS`
- [ ] **Step 4: handler** — เพิ่ม `@MessagePattern` ใน `cost-center.controller.ts` ตามแบบ `ChartOfAccountsController.importFromInterfaceCarmenGl` (บรรทัด 135) โดยทำตามสามขั้นที่หัวไฟล์ `rpc-contract/src/contracts/cost-center.ts` เขียนไว้ คือใส่ literal ชั่วคราว → รัน `bun run gen:rpc-contract` ที่ root → เปลี่ยนเป็น `CostCenter.importFromInterfaceCarmenGl.pattern`
- [ ] **Step 5: ตรวจ** `cd apps/micro-business && bunx tsc --noEmit -p . && bunx eslint src/master/cost-center src/master/carmen-gl-interface && bunx jest src/master/cost-center src/master/chart-of-accounts` — คาดว่าผ่าน
- [ ] **Step 6: Commit** `feat(cost-center): นำเข้าศูนย์ต้นทุนจาก Carmen GL ตาม sync_policy (ข้ามตัวที่ยังถูกใช้)`

### Task 4: Gateway endpoint

**Files:**
- Modify: `apps/backend-gateway/src/config/config_cost-centers/config_cost-centers.controller.ts`
- Modify: `apps/backend-gateway/src/config/config_cost-centers/config_cost-centers.service.ts`
- Modify: `apps/backend-gateway/src/config/config_cost-centers/swagger/response.ts`

**Interfaces:**
- Consumes: `CostCenter.importFromInterfaceCarmenGl` (Task 3)
- Produces: `POST /api/config/:bu_code/cost-centers/import-from-interface/carmen-gl` → 201 `{ data: ICostCenterImportResult }` · `operationId: configCostCenters_importFromInterfaceCarmenGl` · `AppIdGuard('cost-centers.import-from-interface.carmen-gl')`

- [ ] **Step 1:** ทำ `CostCenterImportResponseDto` ใน `swagger/response.ts` ให้ตรงกับ `ICostCenterImportResult` โดยดูแบบจาก `ChartOfAccountsImportResponseDto` (`config_chart-of-accounts/swagger/response.ts`) และเพิ่ม `in_use` / `in_use_codes`
- [ ] **Step 2:** เพิ่ม controller method กับ service method โดยคัดลอกโครงจาก `ConfigChartOfAccountsController.importFromInterfaceCarmenGl` (controller บรรทัดราว 575–632, service บรรทัดราว 227–248) ทั้ง decorator ชุดเดิม คำอธิบาย Swagger สองภาษา และการเช็ก `response.response.status !== HttpStatus.CREATED` คำอธิบายต้องระบุว่าตัวที่ยังถูกใช้งานจะถูกข้ามและแจ้งใน `in_use_codes` ส่วน guard และ decorator ของ class ให้เหมือน endpoint อื่นในไฟล์เดียวกัน
- [ ] **Step 3: ตรวจ** `cd apps/backend-gateway && bunx tsc --noEmit -p . && bunx eslint src/config/config_cost-centers` — คาดว่าผ่าน
- [ ] **Step 4: Commit** `feat(gateway): เปิด endpoint นำเข้าศูนย์ต้นทุนจาก Carmen GL`
- [ ] **Step 5:** push แล้วเปิด PR ของ backend (ภาษาอังกฤษ) ต้องมีหัวข้อ **Deploy** ระบุว่า "add `cost-centers.import-from-interface.carmen-gl` to the application allowlist in every env unless the app row has `allow_all: true` — otherwise users who press the button are logged out (401 → token cleared), and the cache TTL is 60s"

### Task 5: Frontend — ปุ่ม, hook, i18n

**Files (FE repo):**
- Modify: `constant/api-endpoints.ts` (ต่อจาก `GL_COST_CENTER_GROUPS` บรรทัดราว 169)
- Create: `routes/config/cost-center/use-cost-center-import.ts`
- Create: `routes/config/cost-center/cost-center-import-carmen-gl-button.tsx`
- Modify: `routes/config/cost-center/cost-center-component.tsx` (prop `extraActions` ของ `ConfigListTemplate`)
- Modify: `messages/th.json`, `messages/en.json` (`config.costCenter.importCarmenGl.*` และ `syncPolicyDesc` ของหน้าคอนฟิก Carmen GL บรรทัดราว 2701)

**Interfaces:**
- Consumes: endpoint ของ Task 4
- Produces:
```ts
API_ENDPOINTS.GL_COST_CENTERS_IMPORT_CARMEN_GL(buCode: string): string
  // `/api/proxy/api/config/${buCode}/cost-centers/import-from-interface/carmen-gl`
export interface CostCenterImportResult { summary: {…+ in_use}; errors: …; deleted_codes: string[]; in_use_codes: string[] }
export function useImportCostCenterFromCarmenGl(): UseApiMutation<void, { data: CostCenterImportResult }>
export function CostCenterImportCarmenGlButton(): JSX.Element | null
```

- [ ] **Step 1:** เพิ่ม endpoint (ใส่ JSDoc แบบเดียวกับ `CHART_OF_ACCOUNTS_IMPORT_CARMEN_GL`) และ hook ตามแบบ `useImportCoaFromCarmenGl` (`routes/config/chart-of-accounts/use-coa.ts:42`) โดยใช้ `invalidateKeys: [QUERY_KEYS.COST_CENTERS]` กับ `meta: { skipGlobalErrorToast: true }`
- [ ] **Step 2: ปุ่ม** — ใช้โครงเดียวกับ `coa-import-carmen-gl-button.tsx` ทั้ง entitlement `("accounting", "carmen_gl") === "entitled"` + `canWrite` · AlertDialog ยืนยัน · disabled ตอน pending · `rowErrorsOf` · ข้อยกเว้นข้อความ 502 ที่ใช้ `COST_CENTER_INTERFACE_REQUEST_FAILED` ต่างกันแค่ toast ตอนสำเร็จ: ถ้า `summary.in_use > 0` ให้ต่อบรรทัด `inUse` (`{count}` และ `{codes}` เป็นรหัส 5 ตัวแรกคั่นด้วย `, ` ถ้าเกินให้ต่อ ` … +n`) ส่วนจะแยก component กลางออกมาให้ปุ่มทั้งสองใช้ร่วมกันหรือไม่ ให้คนลงมือตัดสิน ถ้าแยก ให้วางไว้ที่ `components/` เท่านั้น (ห้าม import ข้ามโมดูล)
- [ ] **Step 3:** วาง `<CostCenterImportCarmenGlButton />` ใน `extraActions` ของ `cost-center-component.tsx`
- [ ] **Step 4: i18n** `config.costCenter.importCarmenGl` (ทั้ง th และ en คีย์ต้องตรงกัน):
  - th: `action` "นำเข้าจาก Carmen GL" · `importing` "กำลังนำเข้า…" · `confirmTitle` "นำเข้าศูนย์ต้นทุนจาก Carmen GL?" · `confirmDesc` "ระบบจะดึงรายการแผนกจาก interface Carmen GL ที่ตั้งค่าไว้ของหน่วยธุรกิจนี้มาเป็นศูนย์ต้นทุน แล้วเขียนในทรานแซกชันเดียวแบบทั้งหมดหรือไม่เขียนเลย การจัดการรหัสซ้ำและรหัสที่มีเฉพาะในระบบนี้เป็นไปตามนโยบายการซิงก์ในหน้าตั้งค่า interface ศูนย์ต้นทุนที่ยังถูกใช้งานจะไม่ถูกลบ" · `success` "นำเข้าศูนย์ต้นทุนแล้ว" · `summary` "เพิ่ม {created} · แก้ไข {updated} · ข้าม {skipped} · ลบ {deleted}" · `inUse` "ไม่ได้ลบ {count} รายการเพราะยังถูกใช้งาน: {codes}" · `failed` "นำเข้าไม่สำเร็จ" · `failedDesc` "นำเข้าศูนย์ต้นทุนไม่สำเร็จ ไม่มีการเปลี่ยนแปลงข้อมูล"
  - en: แปลความหมายเดียวกัน
  - `syncPolicyDesc` (th) → "กำหนดว่าการนำเข้าจะปรับข้อมูลของ Carmen 4 เข้ากับผังบัญชีและศูนย์ต้นทุนที่นี่อย่างไร มีผลทั้งกับปุ่มนำเข้าในสองหน้านั้นและการรันตามกำหนดเวลา ศูนย์ต้นทุนที่ยังถูกใช้งานจะไม่ถูกลบ" และ en ให้แปลความหมายเดียวกัน
- [ ] **Step 5: ตรวจ** `bun run typecheck && bunx eslint routes/config/cost-center constant/api-endpoints.ts && bun test:run lib/__tests__/i18n-key-parity.test.ts components/ui/type-ladder.test.ts` — คาดว่าผ่าน
- [ ] **Step 6: Commit** `feat(cost-center): ปุ่มนำเข้าศูนย์ต้นทุนจาก Carmen GL`
- [ ] **Step 7:** push แล้วเปิด PR ของ FE (ภาษาอังกฤษ) ต้องระบุว่าขึ้นกับ BE PR และมีหัวข้อ **Deploy** เรื่อง allowlist ข้อความเดียวกับ Task 4 Step 5 พร้อมลำดับ BE → allowlist → FE

### Task 6: ตรวจด้วยมือ (user ทำเอง หรือทำผ่าน browser หลัง BE ขึ้น dev แล้ว)

- [ ] BU ที่มี Carmen GL (ตั้ง `skip`/`keep`) กดนำเข้า → เพิ่ม 27 รายการ · กดซ้ำ → ข้าม 27 รายการ
- [ ] Review Focus ข้อ 1–5 ทุกข้อ
- [ ] ตั้ง `upsert` แล้วแก้ชื่อหนึ่งตัว ปิดใช้งานอีกตัว → กดแล้วทั้งสองตัวกลับเป็นตามต้นทาง ส่วนกลุ่มและหมายเหตุยังอยู่
- [ ] ตั้ง `delete` แล้วสร้างสองตัวที่ไม่มีใน Carmen GL (ให้ตัวหนึ่งผูก location) → ตัวที่ไม่ได้ผูกถูกลบ ตัวที่ผูกขึ้นใน toast
- [ ] ผังบัญชียังนำเข้าได้เหมือนเดิม (เพื่อยืนยัน refactor ใน Task 2)
- [ ] BU ที่ไม่มีสิทธิ์ `carmen_gl` ต้องไม่เห็นปุ่ม · ตรวจทั้งธีมสว่าง/มืด และหน้าจอมือถือ
