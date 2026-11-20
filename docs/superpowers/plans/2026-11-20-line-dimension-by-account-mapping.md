# Dimension ของบรรทัดตามบัญชีจาก Post to GL mapping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **ข้ามขั้นเขียนเทสต์** (ความต้องการของ user): ห้ามสร้าง `*.spec.ts` / `*.test.ts` ใหม่ ห้ามมีขั้น "เขียนเทสต์ให้ fail ก่อน" ให้ implement → type-check → lint → รันชุดเทสต์ที่มีอยู่ให้ผ่าน → commit ส่วนการตรวจด้วยมือ (curl / เบราว์เซอร์) ยังต้องทำ บอก subagent ทุกตัวเรื่องนี้ตรง ๆ เพราะ subagent ไม่รู้เอง

**Goal:** บรรทัดของ PR, PO, GRN, SR และ IA แสดงและบังคับเฉพาะ dimension ที่บัญชีของบรรทัดนั้น (หาจาก mapping ฝั่ง GL) อนุญาต ตรวจตอนพ้น draft และก่อนลงบัญชี เปิดหรือปิดได้ราย BU และหน้าตาเหมือน JV

**Architecture:** BE มีฟังก์ชันกลาง `resolveLineDimensionRules` (ใช้ `resolveAccountMapping` กับกฎ `tb_gl_account_dimension_rule`) ซึ่งใช้ทั้ง endpoint `POST /api/config/:bu_code/line-dimension-rules` และตัวบังคับ `enforceLineDimensions` ที่เรียกจากทุกจุดตรวจ FE ดึงกฎผ่าน hook เดียว แสดงผลด้วย component กลาง `LineDimensionStrip` ที่แยกออกมาจาก JV และตรวจซ้ำก่อนกดปุ่ม สวิตช์คือ config ของ BU ส่วน env `LINE_DIMENSIONS_ENABLED` ถูกลบทิ้ง

**Tech Stack:** BE: NestJS microservices, Prisma 7, `@repo/rpc-contract`, `Result` / `@repo/error-catalog` · FE: Vite + React 19 + React Router 7, TanStack Query, react-hook-form, Tailwind v4, use-intl

**Spec:** `docs/superpowers/specs/2026-11-20-line-dimension-by-account-mapping-design.md` (อ่านคู่กันเสมอ)

## Global Constraints

- รีโป: `carmen-turborepo-backend` (micro-business + backend-gateway + packages) และ `carmen-frontend` ใช้ branch `feature/line-dimension-by-account-mapping` ในทั้งสองรีโป แตกจาก `main`
- config ของ BU:
  - `dimension.start-from` เป็น enum `none` | `pr` | `po` | `grn` (ไม่มีค่าให้ถือเป็น `none`)
  - `dimension.sr.enabled` และ `dimension.ia.enabled` เป็น boolean (ไม่มีค่าให้ถือเป็น `false`)
- ขอบเขตของ `start-from`:
  - `pr` = เปิด PR, PO และ GRN
  - `po` = เปิด PO และ GRN
  - `grn` = เปิด GRN อย่างเดียว
  - `none` = ปิดทั้งหมด
- movement ที่ใช้หาบัญชี:
  - PR/PO/GRN = `grn`
  - SR = `sr_out` (from_location) และ `sr_in` (to_location)
  - IA = `adjustment` + `adjustment_type_id` ของหัวใบ
  - mapping_type = `GL` ทุกกรณี
- รวมกฎหลายบัญชี:
  - แสดงถ้ามีบัญชีใดอนุญาต
  - บังคับถ้ามีบัญชีใดบังคับ
  - ห้ามใช้ถ้ามีบัญชีใดห้าม
  - บังคับในบัญชีหนึ่งแต่ห้ามใช้ในอีกบัญชี = `conflict`
- ใบ draft ต้อง Save ได้เสมอ ห้ามตรวจตอน save draft และตอน update ที่ไม่ได้เปลี่ยนสถานะ
- บรรทัด `no_account` / `skipped` ห้ามทำให้ submit ไม่ผ่าน
- เติม default ของกฎ mandatory และ**บันทึกลงบรรทัด**ก่อนตรวจ
- error ใหม่ใช้ `Result.errorFromCatalog` และต้องเติม `errors.byCode.<CODE>` ใน `messages/en.json` + `messages/th.json` ของ FE
  - ข้อความแปลห้ามมี `{{` `}}` หรือ `<คำ>` เพราะ ICU จะพัง
- api_name ใหม่ `line-dimension-rules.resolve` ต้องเข้า allowlist ของทุก app id ที่ไม่ allow_all **ก่อน** deploy FE ไม่อย่างนั้น user จะโดน logout
- ลำดับ deploy: BE → allowlist → FE → ตั้ง config ราย BU
- FE:
  - token สถานะสำหรับข้อความใช้ `text-*-ink`
  - ขนาดฟอนต์ต้องอยู่ใน ladder
  - อ่านออกทั้ง light และ dark
  - import ข้ามโมดูลใต้ `routes/` ไม่ได้ ของที่ใช้ร่วมกันไปไว้ใน `lib/` / `hooks/` / `components/`
- chip ที่มาของบัญชีแสดงเฉพาะเมื่อ `isDevAppEnv()` เป็น true ข้อความเป็นค่าดิบ ไม่ผ่าน i18n
- commit message เป็นภาษาไทย

## Review Focus

1. **PR ที่มีบรรทัดผสม** บางบรรทัดยังไม่เลือก location และบางบรรทัดเป็น consignment → submit ต้องผ่าน และตรวจเฉพาะบรรทัดที่หาบัญชีได้ (Task 3 ตรวจมือ, Task 10 ตรวจมือ)
2. **เปลี่ยนสินค้าหรือ location หลังกรอก dimension แล้ว** → ค่าเดิมยังอยู่และยังมองเห็น ถ้าบัญชีใหม่ห้ามใช้ค่านั้น ต้องแจ้งตอน submit และห้ามลบเงียบ ๆ (Task 9 / Task 10)
3. **กฎถูกแก้ระหว่างที่หน้าเปิดค้าง** → BE ตอบ 422 แล้ว FE ต้องแสดงข้อความที่ระบุบรรทัดและ dimension ไม่ใช่ข้อความ error ทั่วไป (Task 10)
4. **BU ที่ตั้ง `start-from = po` แปลง PR ที่มีค่า dimension ค้างอยู่เป็น PO** → บรรทัด PO ต้องไม่ถูกแยกด้วยค่าที่มองไม่เห็น (Task 5)
5. **GRN commit ไม่ผ่าน** → หน้าต้องค้างโหมดแก้ไขและทำชิปเป็นสีแดง แก้ เซฟ แล้ว commit ใหม่ได้โดยไม่ต้องโหลดหน้าใหม่ (Task 10)

---

## Backend (`carmen-turborepo-backend`)

### Task 1: ขอบเขตจาก config ของ BU

**Files:**
- Create: `apps/micro-business/src/master/dimension/line-dimension/line-dimension-scope.ts`

**Interfaces:**
- Produces:
  ```ts
  export type LineDimensionDocType = 'pr' | 'po' | 'grn' | 'sr' | 'ia';
  export const LINE_DIMENSION_CONFIG_KEYS = {
    startFrom: 'dimension.start-from', sr: 'dimension.sr.enabled', ia: 'dimension.ia.enabled',
  } as const;
  export type ILineDimensionScope = Record<LineDimensionDocType, boolean>;
  export function lineDimensionScopeFromConfig(startFrom: unknown, sr: unknown, ia: unknown): ILineDimensionScope; // pure
  export async function loadLineDimensionScope(tenantService: TenantService, user_id: string, bu_code: string): Promise<ILineDimensionScope>;
  ```

- [ ] **Step 1:** เขียน `lineDimensionScopeFromConfig`
  - ค่าที่ไม่รู้จักให้ถือเป็น `none` / `false`
  - boolean รับทั้ง `true` และ `'true'`
- [ ] **Step 2:** เขียน `loadLineDimensionScope`
  - อ่าน key ทั้ง 3 ตัวผ่าน `tenantService.getdb_connection` + `getBuConfig` แบบเดียวกับ `isGroupByPrComment()` (`procurement/purchase-order/purchase-order.service.ts:3974`)
- [ ] **Step 3:** `bun run --filter micro-business typecheck` (หรือ `tsc --noEmit` ของแอป) แล้ว lint ต้องผ่าน
- [ ] **Step 4:** commit `feat(dimension): อ่านขอบเขตการใช้ dimension รายเอกสารจาก config ของ BU`

### Task 2: ฟังก์ชันกลาง `resolveLineDimensionRules`

**Files:**
- Create: `apps/micro-business/src/master/dimension/line-dimension/resolve-line-dimension-rules.ts`
- Create: `apps/micro-business/src/master/dimension/line-dimension/merge-account-rules.ts`
- Modify: `apps/micro-business/src/gl/gl-dimension/gl-dimension.defaults.ts` (export `loadMandatoryDefaultRules` ที่ `:58` เดิมเป็น private function)

**Interfaces:**
- Consumes: `resolveAccountMapping`, `MappingMovement`, `AccountSource`, `AccountIssue` (`master/account-mapping/account-mapping.resolver.ts`) · `IDimensionRef` · `LineDimensionDocType`
- Produces:
  ```ts
  export interface ILineDimensionRuleInput {
    key: string; doc_type: LineDimensionDocType; product_id: string | null;
    location_id: string | null; to_location_id?: string | null; adjustment_type_id?: string | null;
  }
  export interface ILineDimensionAccount {
    movement: MappingMovement; chart_of_accounts_id: string | null; account_code: string | null;
    source: AccountSource | null; issue: AccountIssue | 'missing_location' | 'missing_product' | 'consignment' | null;
    location_id: string | null; item_group_id: string | null; adjustment_type_id: string | null;
    account_mapping_id: string | null;
  }
  export type LineDimensionRequirement = 'mandatory' | 'optional' | 'prohibited';
  export interface ILineDimensionRule { dimension_id: string; requirement: LineDimensionRequirement; default_value: IDimensionRef | null; }
  export type LineDimensionStatus = 'resolved' | 'no_account' | 'skipped' | 'conflict';
  export interface ILineDimensionRuleResult {
    key: string; status: LineDimensionStatus; accounts: ILineDimensionAccount[];
    rules: ILineDimensionRule[];           // รวมแล้ว
    conflict_dimension_ids: string[];
  }
  export function mergeAccountRules(perAccount: ILineDimensionRule[][]): { rules: ILineDimensionRule[]; conflict_dimension_ids: string[] };
  export async function resolveLineDimensionRules(db: DimensionValidationDb & PrismaLike, lines: ILineDimensionRuleInput[]): Promise<ILineDimensionRuleResult[]>;
  ```

- [ ] **Step 1:** เขียน `mergeAccountRules` (pure)
  - กติกาการรวมตาม Global Constraints
  - `default_value` เลือกจากกฎ mandatory ตัวแรกที่มี default
  - `optional` + `prohibited` → `prohibited`
- [ ] **Step 2:** เขียน `resolveLineDimensionRules` ให้ทำทุกอย่างเป็นชุด (batch) ห้ามยิง query ต่อบรรทัด
  - อ่าน `tb_location` (type, cost center)
  - อ่าน `tb_product` → item group → sub-category → category พร้อมบัญชี inventory/direct ของแต่ละระดับ ให้ใช้ query เดียวกับที่ `account-mapping.service.ts` ใช้ป้อน `ResolveInput`
  - อ่านแถว `tb_account_mapping` (`mapping_type = GL`, `deleted_at IS NULL`, key = location × item group × movement × adjustment_type)
  - เรียก `resolveAccountMapping()` ต่อบัญชี
  - แปลงรหัสบัญชีเป็น id ของ `tb_chart_of_accounts` (ถ้าไม่มีในผังบัญชีให้ใส่ issue `account_not_in_coa`)
  - อ่าน `tb_gl_account_dimension_rule` ของทุกบัญชี และ default ผ่าน `loadMandatoryDefaultRules`
- [ ] **Step 3:** สถานะของแต่ละบรรทัด
  - ไม่มีบัญชีที่หาได้เลย → `no_account`
  - ทุกบัญชีเป็น consignment → `skipped`
  - `mergeAccountRules` คืน conflict → `conflict`
  - นอกนั้น → `resolved`
  - SR ที่ฝั่งหนึ่งหาบัญชีไม่ได้ให้รวมกฎเฉพาะฝั่งที่หาได้ แต่ยังใส่ทั้งสองฝั่งใน `accounts` (เพื่อให้ chip ของ dev แสดงครบ)
- [ ] **Step 4:** typecheck + lint ผ่าน
  - รันชุดเทสต์ที่มีอยู่ของ `gl-dimension` และ `account-mapping` ให้ผ่าน (`bun test:run` หรือ `jest` ตาม script ของแอป)
- [ ] **Step 5:** commit `feat(dimension): หาบัญชีและกฎ dimension ของบรรทัดจาก mapping ฝั่ง GL`

### Task 3: ตัวบังคับ `enforceLineDimensions` + error catalog

**Files:**
- Create: `apps/micro-business/src/master/dimension/line-dimension/enforce-line-dimensions.ts`
- Modify: `packages/error-catalog/src/...` (ไฟล์ catalog ของโดเมน dimension) เพิ่ม 3 รหัส

**Interfaces:**
- Consumes: Task 2 · `applyMandatoryDimensionDefaults`, `validateLineDimensions` (`gl/gl-dimension/`) · `replaceLineDimensions`, `LineDimensionTarget` (`master/dimension/line-dimension/`)
- Produces:
  ```ts
  export interface IEnforceLine extends ILineDimensionRuleInput { sequence_no: number; detail_id: string; dimensions: IDimensionRef[]; }
  export async function enforceLineDimensions(
    tx: LineDimensionDb & DimensionValidationDb,
    args: { target: LineDimensionTarget; lines: IEnforceLine[]; onDate: Date },
  ): Promise<Result<void>>;
  ```
  - error codes: `LINE_DIMENSION_REQUIRED` · `LINE_DIMENSION_PROHIBITED` · `LINE_DIMENSION_RULE_CONFLICT` (422) โดย payload มี `{ sequence_no, detail_id, dimension_id }`

- [ ] **Step 1:** เพิ่ม 3 รหัสใน error catalog (HTTP 422) แล้ว rebuild package ตามขั้นตอนของ repo
- [ ] **Step 2:** เขียน `enforceLineDimensions` ตามลำดับนี้
  1. `resolveLineDimensionRules`
  2. บรรทัดแรกที่เป็น `conflict` → `LINE_DIMENSION_RULE_CONFLICT`
  3. บรรทัด `resolved` ที่ขาด mandatory → เติมด้วย `applyMandatoryDimensionDefaults` แล้ว `replaceLineDimensions` เฉพาะบรรทัดที่ค่าเปลี่ยน
  4. ตรวจด้วย `validateLineDimensions`
     - ป้อนหนึ่ง `IDimensionLine` ต่อบัญชีของบรรทัด (SR = 2 รายการ, `line_key` = detail_id)
     - map error ของตัวตรวจเป็นรหัสใหม่พร้อม `sequence_no` / `detail_id` / `dimension_id`
  5. บรรทัด `no_account` / `skipped` ข้าม
  - `IEnforceLine` หลายรายการที่มี `detail_id` เดียวกัน (PO เก่าที่มีหลาย location) ให้รวมเป็นบรรทัดเดียว: รวม `accounts` และรวมกฎด้วย `mergeAccountRules` ก่อนเริ่มข้อ 2
- [ ] **Step 3:** typecheck + lint + ชุดเทสต์ `gl-dimension` เดิมผ่าน
- [ ] **Step 4:** commit `feat(dimension): ตัวบังคับ dimension ของบรรทัดตามกฎบัญชี พร้อมเติม default`

### Task 4: endpoint `line-dimension-rules`

**Files:**
- Create: `apps/micro-business/src/master/dimension/line-dimension/line-dimension-rules.controller.ts` (+ ลงทะเบียนใน module ของ dimension)
- Modify: `packages/rpc-contract/src/contracts/*` (generate)
- Create: `apps/backend-gateway/src/config/config_line-dimension-rules/{controller,service,module}.ts` + `swagger/request.ts` / `swagger/response.ts`
- Modify: `apps/backend-gateway/src/config/route-config.ts`

**Interfaces:**
- Consumes: Task 2
- Produces: `POST /api/config/:bu_code/line-dimension-rules`
  - body `{ lines: ILineDimensionRuleInput[] }` (สูงสุด 500 บรรทัด)
  - ตอบ `{ data: ILineDimensionRuleResult[] }`
  - RPC `LineDimensionRule.resolve` (`line-dimension-rule.resolve`, micro-business)

- [ ] **Step 1:** สร้าง RPC handler ด้วย literal ชั่วคราว → `bun run gen:rpc-contract` → แทนด้วย contract reference (ทำ 3 ขั้นตามหัวไฟล์ contract)
  - handler ทำงานใน `TenantContextRunner` แบบ `account-dimension-rule.controller.ts`
- [ ] **Step 2:** gateway controller ลอกแบบ `config_account-dimension-rules.controller.ts`
  - ใช้ `@UseGuards(KeycloakGuard)` + `new AppIdGuard('line-dimension-rules.resolve')`
  - **ไม่มี** `@Permission` (ผู้ใช้ทุกคนที่เปิดเอกสารต้องเรียกได้)
  - validate body ด้วย DTO: `lines` เป็น array ไม่เกิน 500 รายการ id เป็น uuid หรือ null และ `doc_type` อยู่ใน 5 ค่า
- [ ] **Step 3:** เพิ่ม `line-dimension-rules.resolve` ใน seed หรือ allowlist ของ application ที่ repo ใช้ (ค้น `account-dimension-rules.findAll` เพื่อหาไฟล์ seed แล้วเพิ่มต่อจากนั้น)
- [ ] **Step 4:** typecheck + lint ทั้ง micro-business และ gateway ผ่าน
- [ ] **Step 5:** ตรวจมือบน local:
  ```bash
  curl -s -X POST "http://localhost:4000/api/config/<BU>/line-dimension-rules" \
    -H "Authorization: Bearer $TOKEN" -H "x-app-id: $APP_ID" -H 'content-type: application/json' \
    -d '{"lines":[{"key":"1","doc_type":"grn","product_id":"<id>","location_id":"<id>"}]}'
  ```
  ผลที่ถูกต้อง: `data[0].status` เป็นหนึ่งใน 4 ค่า และ `accounts[0].movement` เป็น `"grn"`
- [ ] **Step 6:** commit `feat(dimension): endpoint หากฎ dimension ของบรรทัดสำหรับหน้าเอกสาร`

### Task 5: จุดตรวจสายซื้อ (PR · PO · GRN)

**Files:**
- Modify: `apps/micro-business/src/procurement/purchase-request/purchase-request.service.ts` (`submit()` :1055)
- Modify: `apps/micro-business/src/procurement/purchase-order/purchase-order.service.ts` (`submit()` :3230, `confirmPrToPo()` :4264, `buildPoLineMergeKey()` :3828, `pickCreateLineDimensions()` :1405)
- Modify: `apps/micro-business/src/inventory/good-received-note/good-received-note.logic.ts` (`save()` :79, `commit()` :172, `approve()` :345)
- Modify: `apps/micro-business/src/inventory/good-received-note/good-received-note.service.ts` (`planLineDimensions` / `canCopyFromPo`)

**Interfaces:**
- Consumes: `loadLineDimensionScope` (Task 1) · `enforceLineDimensions` (Task 3)

- [ ] **Step 1:** PR `submit()`
  - ถ้า `scope.pr` เปิด ให้เรียก `enforceLineDimensions` ใน transaction เดิม **ก่อน** update สถานะ
  - target `purchase_request`, `onDate` = `pr_date`, location = `location_id` ของบรรทัด
  - ถ้าได้ error ให้ throw หรือคืน Result ให้ transaction rollback ตามแบบที่ไฟล์นี้ใช้อยู่
  - ห้าม throw ใน logic layer โดยไม่ห่อ (throw = 503) ต้องคืน `Result`
- [ ] **Step 2:** PO `submit()`
  - เมื่อ `scope.po` เปิด target `purchase_order`, `onDate` = `po_date`
  - location มาจากแถว junction ของบรรทัด ส่ง `IEnforceLine` หนึ่งรายการต่อแถว junction โดยใช้ `detail_id` เดียวกัน (ปกติมีแค่แถวเดียว)
- [ ] **Step 3:** `confirmPrToPo()`
  - ถ้า `scope.pr` **ปิด**: `buildPoLineMergeKey` ไม่ต่อท้ายลายเซ็นของ dimension และ `pickCreateLineDimensions` คืน `[]` (ไม่คัดค่าของ PR)
  - ถ้า `scope.po` เปิด: เรียก `enforceLineDimensions` กับ PO ทุกใบที่จะสร้างใน transaction เดียวกัน ถ้าไม่ผ่านก็ไม่สร้างใบใดเลย
- [ ] **Step 4:** GRN
  - `save()` (draft → saved) และ `commit()` / `approve()` (ก่อน `postReceipt`) เรียก `enforceLineDimensions` เมื่อ `scope.grn` เปิด
  - target `good_received_note`, `onDate` = `grn_date`
  - ใน `commit()` / `approve()` ต้องหาบัญชีใหม่ทุกครั้ง (ฟังก์ชันกลางไม่ cache อยู่แล้ว)
  - GRN คัด dimension จาก PO (`canCopyFromPo`) เฉพาะเมื่อ `scope.po` เปิด
- [ ] **Step 5:** typecheck + lint ผ่าน และชุดเทสต์เดิมของ purchase-request / purchase-order / good-received-note ผ่าน
  - ถ้าเทสต์เดิมแตกเพราะ mock ของ `tenantService.getBuConfig` ยังไม่มี key ใหม่ ให้แก้ mock (ค่า default ปิด) ห้ามแก้ assertion
- [ ] **Step 6:** ตรวจมือบน dev DB (ของกลาง ใช้ใบทดสอบแล้ว void ทิ้ง)
  - ตั้ง `dimension.start-from = pr` ให้ BU ทดสอบ
  - submit PR ที่ขาด mandatory ต้องได้ 422 `LINE_DIMENSION_REQUIRED`
  - บรรทัดที่ไม่มี location หรือเป็น consignment ต้องผ่าน
- [ ] **Step 7:** commit `feat(procurement): ตรวจ dimension ตามบัญชีตอน PR/PO submit, แปลง PR เป็น PO และ GRN save/commit`

### Task 6: จุดตรวจ SR · IA

**Files:**
- Modify: `apps/micro-business/src/inventory/store-requisition/store-requisition.service.ts` (`submit()` :901, `approve()` :1532)
- Modify: `apps/micro-business/src/inventory/stock-in/stock-in.service.ts` (`commit()` :665)
- Modify: `apps/micro-business/src/inventory/stock-out/stock-out.service.ts` (`commit()` :582)

- [ ] **Step 1:** SR
  - `submit()` และ `approve()` ในขั้นที่ตัดสต๊อกหรือลงบัญชี (ไล่ใน `approve()` ว่ากิ่งไหนเรียกการตัดสต๊อก แล้วตรวจก่อนจุดนั้น) เรียก `enforceLineDimensions` เมื่อ `scope.sr` เปิด
  - target `store_requisition`, `location_id` = `from_location_id`, `to_location_id` = `to_location_id`
- [ ] **Step 2:** ตรวจว่าขั้น approve ที่ลงบัญชีให้ผู้อนุมัติแก้บรรทัด (dimension) ได้หรือไม่
  - **ถ้าแก้ไม่ได้ ให้หยุดแล้วรายงาน controller** (spec สั่งให้กลับไปถาม user)
- [ ] **Step 3:** stock-in / stock-out `commit()`
  - เมื่อ `scope.ia` เปิด target `stock_in` / `stock_out`
  - `location_id` และ `adjustment_type_id` มาจากหัวใบ
- [ ] **Step 4:** typecheck + lint + ชุดเทสต์เดิมของ 3 service ผ่าน (แก้ mock ของ config ได้เหมือน Task 5)
- [ ] **Step 5:** commit `feat(inventory): ตรวจ dimension ตามบัญชีตอน SR submit/approve และ IA commit`

---

## Frontend (`carmen-frontend`)

### Task 7: config ราย BU แทน env

**Files:**
- Modify: `routes/system-admin/company-profile/company-profile-config-registry.ts` (เพิ่ม section `dimension`)
- Modify: `messages/en.json`, `messages/th.json` (`defaultSetting.sections.dimension*`, `defaultSetting.config.*`)
- Modify: `hooks/use-line-dimensions-enabled.ts`, `lib/runtime-config.ts:58,98`, `public/config.sample.json`, `docs/deploy.md`
- Modify: ทุกไฟล์ที่เรียก `useLineDimensionsEnabled()` (13 ไฟล์ใน `routes/procurement`, `routes/store-operation/store-requisition`, `routes/inventory-management/inventory-adjustment`)

**Interfaces:**
- Produces:
  ```ts
  export type LineDimensionDocType = "pr" | "po" | "grn" | "sr" | "ia";
  export function lineDimensionScope(config: BusinessUnitDetail["config"] | undefined): Record<LineDimensionDocType, boolean>; // lib/line-dimension-scope.ts (pure)
  export function useLineDimensionsEnabled(docType: LineDimensionDocType): boolean;
  ```

- [ ] **Step 1:** ใช้ skill `add-business-setting-config` เพิ่ม section `dimension`
  - enum `dimension.start-from` (ค่า `none`/`pr`/`po`/`grn`, default `none`)
  - boolean `dimension.sr.enabled` และ `dimension.ia.enabled` (default `false`)
  - เพิ่ม i18n ทั้ง en และ th
  - ถ้า registry มีเทสต์ที่นับ key อยู่แล้วและแดง ให้อัปเดตตัวเลขที่คาดไว้
- [ ] **Step 2:** สร้าง `lib/line-dimension-scope.ts`
  - อ่าน config ด้วย `resolveBuConfigValue` (`lib/print-form-config.ts:57`)
  - ใช้กติกาเดียวกับ BE Task 1
- [ ] **Step 3:** เขียน `useLineDimensionsEnabled(docType)` ใหม่
  - ใช้ license `configuration.dimension` + `lineDimensionScope(useBusinessUnit(defaultBu?.id).data?.config)[docType]` + มี dimension active
  - ลบ `isLineDimensionsSwitchOn`
  - ลบ `LINE_DIMENSIONS_ENABLED` ออกจาก `RuntimeConfig` และ `config.sample.json`
  - แก้ `docs/deploy.md` ให้บอกว่าสวิตช์ย้ายไปอยู่ที่ config ของ BU
- [ ] **Step 4:** อัปเดตผู้เรียกทั้ง 13 ไฟล์ให้ส่ง `docType` ที่ถูกต้อง
  - IA ใช้ `"ia"` ทั้ง stock-in และ stock-out
- [ ] **Step 5:** `bun run typecheck` และ `bun run lint` ผ่าน แล้ว `bun test:run routes/system-admin hooks` ผ่าน
- [ ] **Step 6:** ตรวจในเบราว์เซอร์: `/system-admin/default-setting` มี section ใหม่ กด Save แล้วค่ายังอยู่ ตรวจทั้งไทยและอังกฤษ
- [ ] **Step 7:** commit `feat(dimension): เปิดปิด dimension รายเอกสารด้วย config ของ BU แทน env LINE_DIMENSIONS_ENABLED`

### Task 8: ข้อมูลกฎ + ตัวตรวจฝั่ง FE

**Files:**
- Create: `lib/line-dimension-rules.ts` (types + API + pure functions)
- Move: `routes/accounting/documents/journal-line-dimensions.ts` → `lib/visible-line-dimensions.ts` (ย้ายเทสต์ `journal-line-dimensions.test.ts` ตามไปด้วย และแก้ import ของ JV, AR และ AP)
- Create: `hooks/use-line-dimension-rules.ts`
- Modify: `constant/api-endpoints.ts` (เพิ่ม `LINE_DIMENSION_RULES` ต่อจาก `ACCOUNT_DIMENSION_RULES` :211)

**Interfaces:**
- Produces:
  ```ts
  // lib/line-dimension-rules.ts — ชื่อ field ตรงกับ BE Task 2 ทุกตัว
  export interface LineDimensionRuleInput { key: string; doc_type: LineDimensionDocType; product_id: string | null; location_id: string | null; to_location_id?: string | null; adjustment_type_id?: string | null; }
  export interface LineDimensionAccount { movement: string; chart_of_accounts_id: string | null; account_code: string | null; source: string | null; issue: string | null; location_id: string | null; item_group_id: string | null; adjustment_type_id: string | null; account_mapping_id: string | null; }
  export interface LineDimensionRule { dimension_id: string; requirement: "mandatory" | "optional" | "prohibited"; default_value: DimensionRef | null; }
  export interface LineDimensionRuleResult { key: string; status: "resolved" | "no_account" | "skipped" | "conflict"; accounts: LineDimensionAccount[]; rules: LineDimensionRule[]; conflict_dimension_ids: string[]; }
  export async function fetchLineDimensionRules(buCode: string, lines: LineDimensionRuleInput[]): Promise<LineDimensionRuleResult[]>;
  export function visibleDimensionsForRules(dimensions: DimensionMaster[], result: LineDimensionRuleResult | undefined, selected: DimensionRef[]): DimensionMaster[];
  export function fillRuleDefaults(selected: DimensionRef[], result: LineDimensionRuleResult | undefined): DimensionRef[] | null; // null = ไม่มีอะไรต้องเติม
  export interface LineDimensionViolation { key: string; dimension_id: string; kind: "required" | "prohibited" | "conflict"; }
  export function findLineDimensionViolations(lines: { key: string; dimensions: DimensionRef[] }[], results: Map<string, LineDimensionRuleResult>): LineDimensionViolation[];
  // hooks/use-line-dimension-rules.ts
  export function useLineDimensionRules(docType: LineDimensionDocType, lines: LineDimensionRuleInput[]): { byKey: Map<string, LineDimensionRuleResult>; isPending: boolean; isError: boolean; refetch: () => void };
  ```

- [ ] **Step 1:** ย้าย `visibleLineDimensions` ไป `lib/visible-line-dimensions.ts` โดยไม่เปลี่ยน behavior แล้วแก้ import ของผู้เรียกทั้ง 3 ที่
- [ ] **Step 2:** เขียน `lib/line-dimension-rules.ts`
  - `visibleDimensionsForRules`: แสดง dimension active ที่มีกฎ mandatory หรือ optional และค่าที่ selected ไว้แล้วต้องแสดงเสมอ
  - `findLineDimensionViolations` รายงานเฉพาะบรรทัด `resolved` / `conflict`:
    - mandatory ที่**ไม่มี default** และไม่มีค่า (ใช้ `dimensionRefHasValue`) → `required`
    - มีค่าของ dimension ที่ prohibited → `prohibited`
- [ ] **Step 3:** เขียน `useLineDimensionRules`
  - `enabled` = `useLineDimensionsEnabled(docType)` และต้องมีบรรทัดอย่างน้อยหนึ่งบรรทัด
  - query key = `["line-dimension-rules", bu, docType, <input ที่ dedupe แล้วเรียงตาม key>]`
  - `staleTime` 60s
  - คืน `byKey` เป็น Map
- [ ] **Step 4:** typecheck + lint + `bun test:run lib routes/accounting` ผ่าน (เทสต์ที่ย้ายมาต้องผ่านเหมือนเดิม)
- [ ] **Step 5:** commit `feat(dimension): hook และตัวตรวจกฎ dimension ของบรรทัดฝั่งหน้าเว็บ`

### Task 9: `LineDimensionStrip` (แยกจาก JV) + JV ใช้ตัวกลาง

**Files:**
- Create: `components/dimension/line-dimension-strip.tsx`
- Create: `components/dimension/line-dimension-source-chip.tsx` (chip ของ dev)
- Modify: `routes/accounting/documents/accounting-document-detail.tsx` (แถบชิป :2516–2690 และ dialog "All Dimensions" :3301–)
- Modify: `messages/en.json`, `messages/th.json` (ย้ายข้อความที่ฝังไว้ เช่น "Select accounting dimensions for this journal line.")

**Interfaces:**
- Consumes: `DimensionValueInput`, `useGlDimensionValues`, `useDimensionValueFormatter`, `isDevAppEnv()` (`lib/runtime-config.ts:118`), `LineDimensionAccount`
- Produces:
  ```ts
  export interface LineDimensionStripProps {
    dimensions: DimensionMaster[];          // ที่มองเห็นแล้ว
    value: DimensionRef[];
    onChange: (next: DimensionRef[]) => void;
    readOnly: boolean;                       // ใช้ flag ของโหมดดู ห้ามใช้ disabled (disabled รวม isPending)
    disabled?: boolean;
    requiredIds?: ReadonlySet<string>;
    invalidIds?: ReadonlySet<string>;
    accounts?: LineDimensionAccount[];       // ส่งมาเมื่อมี — chip ของ dev แสดงเมื่อ isDevAppEnv()
    rowLabel: string;                        // ใช้ใน aria-label
    message?: string;                        // ข้อความสถานะ เช่น conflict / load error
  }
  export function LineDimensionStrip(props: LineDimensionStripProps): JSX.Element | null;
  ```

- [ ] **Step 1:** ย้าย markup ของแถบชิปของ JV มาเป็น `LineDimensionStrip` ให้หน้าตาเหมือนเดิมทุกจุด
  - โหมดแก้: lookup เป็น `Select` ขนาด xs มี `CODE:` นำหน้า, ตัวเลือก "ล้างค่า" และ label `code — name` · typed เป็น `DimensionValueInput` ขนาด xs
  - โหมดดู: ชิป outline xs กดแล้วเปิด dialog "All Dimensions" ภายใน component
  - เพิ่มของใหม่: `*` ต่อท้าย code ของตัวที่อยู่ใน `requiredIds` และ `aria-invalid` + เส้นสี destructive บนตัวที่อยู่ใน `invalidIds`
  - ทั้งแถบใช้ `flex flex-wrap`
- [ ] **Step 2:** `LineDimensionSourceChip`
  - render เฉพาะเมื่อ `isDevAppEnv()` แสดงก่อนชิป dimension หนึ่งชิปต่อ account
  - ข้อความ `GL <movement>: <account_code ?? "—"> · <source ?? issue>` (IA ต่อด้วยรหัส adjustment type ถ้ามี)
  - ใช้ `font-mono` + outline สีจาง + `tabIndex={-1}`
  - เป็นลิงก์ไป `/config/chart-of-account-mapping?tab=GL&location_id=…&product_item_group_id=…&movement=…&adjustment_type_id=…` (ใช้ชื่อ query param ที่ `coam-filter-fields.ts` อ่านจริง ตรวจที่ :35, :56, :124 ก่อนเขียน)
- [ ] **Step 3:** เปลี่ยน JV ให้ใช้ `LineDimensionStrip`
  - `requiredIds` = กฎ mandatory ของบัญชีบรรทัดนั้น (มีอยู่แล้วที่ :899–910)
  - เพิ่ม `invalidIds` ให้ตรงกับเงื่อนไขที่ใช้ toast ตอน Submit
  - ลบโค้ดที่ซ้ำออก
- [ ] **Step 4:** typecheck + lint ผ่าน
  - `bun test:run routes/accounting/documents` ต้องผ่าน **โดยเฉพาะ** `accounting-jv-edit-lines.test.tsx` ห้ามแก้ assertion ของเทสต์นี้ ถ้าแดงให้แก้ component
  - `bun test:run components/ui/type-ladder.test.ts lib/__tests__/status-ink-contrast.test.ts` ผ่าน
- [ ] **Step 5:** ตรวจในเบราว์เซอร์: หน้า JV detail ทั้งโหมดแก้และโหมดดู ทั้ง light และ dark ต้องเหมือนก่อนแก้ ส่วนบน dev (`APP_ENV: "dev"`) ต้องมี chip ที่มาของบัญชี
- [ ] **Step 6:** commit `refactor(dimension): แยกแถบชิป dimension ของ JV เป็น component กลาง เพิ่มเครื่องหมายบังคับและ chip ที่มาของบัญชีบน dev`

### Task 10: PR · PO · GRN ใช้แถบกลาง + ตรวจก่อนส่ง

**Files:**
- Modify: `routes/procurement/purchase-request/pr-item-dimensions.tsx`, `use-pr-form-actions.ts`
- Modify: `routes/procurement/purchase-order/po-item-cells/item-dimensions.tsx`, `use-po-form-handlers.ts`
- Modify: `routes/procurement/goods-receive-note/grn-item-cells/item-dimensions.tsx`, `use-grn-item-table.tsx`, `use-grn-form-actions.ts`
- Create: `routes/procurement/shared/use-procurement-line-dimensions.ts`
- Modify: `messages/en.json`, `messages/th.json` (`errors.byCode.LINE_DIMENSION_REQUIRED|PROHIBITED|RULE_CONFLICT`, toast นับบรรทัด, ข้อความ conflict)

**Interfaces:**
- Consumes: Task 7–9
- Produces (shared ภายใน procurement):
  ```ts
  export function useProcurementLineDimensions<T extends FieldValues>(args: {
    docType: "pr" | "po" | "grn"; form: UseFormReturn<T>;
    toInput: (item: unknown, index: number) => LineDimensionRuleInput;  // key = id ของบรรทัด หรือ index ของบรรทัดใหม่
  }): {
    resultFor: (key: string) => LineDimensionRuleResult | undefined;
    invalidFor: (key: string) => ReadonlySet<string>;
    validateBeforeSubmit: () => boolean;   // false = toast + set invalid + ขยายแถว
    applyServerError: (err: ApiError) => boolean; // true = เป็น 422 ของ dimension และจัดการแล้ว
  };
  ```

- [ ] **Step 1:** เขียน `useProcurementLineDimensions`
  - ห่อ `useLineDimensionRules`
  - เมื่อผลของกฎมาถึง ให้เรียก `fillRuleDefaults` ต่อบรรทัด ถ้าได้ค่าที่ไม่ใช่ null ให้ `setValue(items.i.dimensions)` + `dimensions_dirty = true`
  - เก็บ invalid ไว้ใน state ภายใน hook และล้างของบรรทัดนั้นเมื่อผู้ใช้แก้
- [ ] **Step 2:** แทน `LineDimensionFields` / `LineDimensionPopover` ใน 3 เอกสารด้วย `LineDimensionStrip` ที่วางเป็นแถวย่อยใต้บรรทัด
  - GRN เลิกใช้ popover แล้วเพิ่มแถวย่อยใน `use-grn-item-table.tsx`
  - ใช้ตาราง `"use no memo"` พร้อม memo ข้อมูลแถวเองตาม `routes/CLAUDE.md`
  - `readOnly` มาจาก flag ของโหมดดู ไม่ใช่ `disabled`
  - สถานะ `no_account` / `skipped` ไม่แสดงแถบ ยกเว้นมีค่าบันทึกไว้แล้ว
  - สถานะ `conflict` แสดง `message`
  - PR wizard บนมือถือ (การ์ด) วางแถบไว้ท้ายการ์ด
- [ ] **Step 3:** ตรวจก่อนส่ง
  - เรียก `validateBeforeSubmit()` ก่อน Submit ของ PR/PO, ก่อน Save ที่ทำให้ GRN ออกจาก draft และก่อน commit/approve ของ GRN
  - ห้ามเรียกใน Save draft และห้ามใส่ใน zod schema หลัก (Save ของ PO draft ใช้ `draftSaveHandler`)
  - ใน `onError` ของ mutation เดียวกัน ให้เรียก `applyServerError` ก่อน toast error ทั่วไป
- [ ] **Step 4:** GRN commit ไม่ผ่าน (ทั้งจาก FE และ 422 จาก BE) → คงโหมดแก้ไขไว้และไม่ reset ฟอร์ม ผู้ใช้แก้ → Save → commit ใหม่ได้ในหน้าเดิม
- [ ] **Step 5:** typecheck + lint + `bun test:run routes/procurement` ผ่าน
- [ ] **Step 6:** ตรวจในเบราว์เซอร์บน dev (BU ทดสอบตั้ง `start-from = pr`)
  - PR ที่บัญชีบังคับ DEPT: ชิปมี `*` · Save draft ผ่านทั้งที่ว่าง · Submit ที่ว่างได้ toast + ชิปแดง · กรอกแล้ว Submit ผ่าน
  - ตั้ง `start-from = grn` แล้ว PR/PO ต้องไม่มีแถบ
  - GRN: commit ที่ขาดค่าต้องค้างอยู่ในโหมดแก้
  - ตรวจทั้ง light, dark, ไทย และ 1366px
  - void ใบทดสอบทิ้ง
- [ ] **Step 7:** commit `feat(procurement): แถบ dimension แบบ JV กรองตามบัญชีและตรวจก่อนส่งใน PR/PO/GRN`

### Task 11: SR · IA ใช้แถบกลาง + ลบ component เก่า

**Files:**
- Modify: `routes/store-operation/store-requisition/sr-item-dimensions.tsx`, `use-sr-item-table.tsx`, `use-sr-form-actions.ts`
- Modify: `routes/inventory-management/inventory-adjustment/ia-item-dimensions.tsx`, `use-ia-item-table.tsx`, `ia-form.tsx`
- Create: `routes/store-operation/store-requisition/use-sr-line-dimensions.ts`, `routes/inventory-management/inventory-adjustment/use-ia-line-dimensions.ts` (ห่อ `useLineDimensionRules` + ตัวตรวจ ในรูปเดียวกับ Task 10 Step 1 โดยห้าม import จาก `routes/procurement/` ถ้าโค้ดเหมือนกันเกินครึ่ง ให้ย้าย hook ของ Task 10 ไป `hooks/use-document-line-dimensions.ts` แล้วให้ทั้ง 3 โมดูลใช้ร่วมกัน)
- Delete: `components/dimension/line-dimension-fields.tsx`, `components/dimension/line-dimension-popover.tsx` (หลังไม่มีผู้เรียกเหลือ ตรวจด้วย `trail grep` / `grep -rn`)

- [ ] **Step 1:** SR
  - input = `{ doc_type: "sr", location_id: from_location_id, to_location_id }` จากหัวใบ
  - หัวใบเปลี่ยน location แล้วต้องดึงกฎใหม่ทุกบรรทัด
  - ตรวจก่อน Submit และก่อน approve ขั้นที่ลงบัญชี
- [ ] **Step 2:** IA
  - input = `{ doc_type: "ia", location_id, adjustment_type_id }` จากหัวใบ
  - เปลี่ยน adjustment type แล้วต้องดึงกฎใหม่
  - ตรวจก่อน commit
- [ ] **Step 3:** ลบ `LineDimensionFields` และ `LineDimensionPopover` ถ้าไม่มีผู้เรียกเหลือแล้ว
- [ ] **Step 4:** typecheck + lint + `bun test:run routes/store-operation routes/inventory-management components/dimension` ผ่าน
- [ ] **Step 5:** ตรวจในเบราว์เซอร์บน dev
  - ตั้ง `dimension.sr.enabled` / `dimension.ia.enabled` = true
  - SR ที่สองฝั่งมีกฎ ต้องเห็นกฎที่รวมแล้ว และ chip ของ dev 2 อัน (`sr_out`, `sr_in`)
  - IA ที่ mapping ของ adjustment type ว่าง ต้องไม่มีแถบ และ chip ของ dev แสดง `missing_adjustment_account`
- [ ] **Step 6:** commit `feat(inventory): แถบ dimension ตามบัญชีใน SR และ IA ลบ component dimension แบบเก่า`

### Task 12: ปิดงาน

- [ ] **Step 1:** ทั้งสองรีโป: `bun run typecheck`, `bun run lint` และชุดเทสต์เต็มผ่าน
  - FE: `bun test:run`
  - BE: เทสต์ของ micro-business + gateway (เทียบกับรายการที่แดงอยู่แล้วบน main ตาม memory `known-failing-tests-on-main` ห้ามมีตัวใหม่แดงเพิ่ม)
- [ ] **Step 2:** `trail check` ในรีโป FE แล้วบันทึก learning ใหม่แทน learning เรื่องซ่อน dimension ด้วย env (2026-11-17) ด้วย `trail note --replaces <id>`
- [ ] **Step 3:** เปิด PR 2 ใบ (ภาษาอังกฤษ) ที่ลิงก์หากัน ในคำอธิบายต้องมี:
  - ลำดับ deploy: BE → allowlist `line-dimension-rules.resolve` → FE → ตั้ง config ราย BU
  - คำเตือนใน **PR ของ FE**: ถ้ายังไม่ได้เติม allowlist user จะโดน logout
  - คำเตือนว่าหลังลบ env แล้ว BU บน dev ที่เคยเปิดไว้ต้องตั้ง config ใหม่
