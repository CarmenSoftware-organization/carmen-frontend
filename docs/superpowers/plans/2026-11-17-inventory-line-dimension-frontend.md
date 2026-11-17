# Inventory line dimension (frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ผู้ใช้เลือก GL dimension รายบรรทัดใน SR (รวม transfer), stock-in และ stock-out ผ่านปุ่มที่เปิด popover ต่อบรรทัด และเปลี่ยน GRN จากแถว footer มาใช้ปุ่มแบบเดียวกัน

**Architecture:** สร้างคอมโพเนนต์ใหม่ตัวเดียว `LineDimensionPopover` ที่ครอบ `LineDimensionFields` เดิมของ #611 แล้วต่อสายในแต่ละเอกสารแบบเดียวกับ PR ของ #611 ได้แก่ schema (`dimensions`/`dimensions_dirty`) → payload (`lineDimensionsPayload`) → reset หลัง save (`clearDimensionsDirty`) และคอลัมน์ในตารางที่แสดงเฉพาะเมื่อ `useLineDimensionsEnabled()` เป็น true

**Tech Stack:** React + react-hook-form + zod + TanStack Table (DataGrid) + shadcn `Popover` (`components/ui/popover.tsx`), vitest

**Spec:** `docs/superpowers/specs/2026-11-17-inventory-line-dimension-frontend-design.md`
ผลสำรวจพร้อม file:line อยู่ที่ `.superpowers/inv-dim-fe-recon.md` (git ไม่ track)

## Global Constraints

- **ห้ามเขียนเทสต์ใหม่** (user สั่ง): ข้ามทุก step ประเภท "write failing test" ไม่สร้างไฟล์ `*.test.ts(x)` ใหม่ ส่วน static check ยังต้องรัน
- ตรวจด้วย `npx tsc --noEmit`, `npx eslint --no-fix <ไฟล์ที่แตะ>` (**ห้าม** `bun run lint` / `eslint .`) และ vitest ชุดเดิมของโฟลเดอร์ที่แตะ ต้องผ่าน
- request ต่อบรรทัด: `dimensions?: {gl_dimension_id, gl_dimension_value_id}[] | null` ถ้าไม่ส่งจะไม่แตะค่าเดิม ถ้าส่งมา (รวม `[]`) จะแทนที่ทั้งชุด
- response: เฉพาะ GET รายตัวที่คืน `dimensions: DimensionRef[]` ตอน map ให้ใช้ `d.dimensions ?? []`
- ใช้ของจาก #611 ตามเดิมโดยไม่แก้: `LineDimensionFields`, `useLineDimensionsEnabled`, `lineDimensionsPayload(item, enabled)`, `clearDimensionsDirty(values)`, `DimensionRef`/`DimensionPayload` (`types/gl-dimension.ts`)
- การแก้เฉพาะ dimension ต้องไม่ทำให้ `cost_per_unit`/`total_cost`/จำนวนของบรรทัดเปลี่ยน
- ห้ามเอา field JSON `dimension` (เอกพจน์) กลับมา
- ข้อความบนปุ่ม: `Dim N` เมื่อเลือกไว้ N ตัว และ `Dim —` เมื่อยังไม่ได้เลือก
- ตอน disabled ต้องยังเปิด popover ได้ แต่ช่องข้างในเป็น read-only
- BU ที่ไม่มี license ต้องไม่เห็นคอลัมน์และไม่ส่ง `dimensions`
- PR และ PO ห้ามแตะ
- `package.json` ที่ค้าง (ไม่ใช่งานเรา) ห้าม stage ให้ `git add` เป็นรายไฟล์เสมอ

## ข้อเท็จจริงจาก backend ที่ตรวจแล้ว (2026-11-17)

micro-business ใช้ zod 4 และ `StockInDetailUpdate = StockInDetailBaseSchema.omit(...).partial()` โดย base มี `cost_per_unit: z.number().optional().default(0)`
ลองรันแล้ว: `z.object({c: z.number().optional().default(0)}).partial().parse({})` ได้ `{"c":0}`
บรรทัด update จึงถูก spread `...updateData` ลง Prisma (`stock-in.service.ts:961-975`)
**ผล:** ถ้าไม่ส่ง cost หรือ qty ใน `update` ค่าจะถูกเขียนเป็น 0 ทางเลือก "ตัดต้นทุนออก" ใน spec จึงใช้ไม่ได้ ต้องส่งต้นทุนที่เก็บไว้เดิมกลับไปแทน (Task 3)

## Review Focus

1. **SO ใบร่างที่แก้แค่ dimension:** `CostProbe` (`use-ia-item-table.tsx:252-275`) เขียนต้นทุนประมาณการทับค่าที่เก็บไว้ (0) ตั้งแต่ตอน mount โดยไม่ mark dirty บรรทัดนี้ต้องส่งต้นทุนที่เก็บไว้เดิม ไม่ใช่ค่าประมาณการ
2. **SI ที่เปลี่ยนวันที่หรือคลัง แล้วแก้ dimension พร้อมกัน:** ต้นทุนที่ probe ดึงมาใหม่เป็นการเปลี่ยนที่ตั้งใจ จึงห้ามถูกย้อนเป็นค่าเดิม
3. **save สองครั้งติดกัน:** ถ้าไม่ล้าง `dimensions_dirty` หลัง reset รอบที่สองจะส่ง `dimensions` ซ้ำ ถึงไม่พังแต่ทำให้ทุกบรรทัดกลายเป็น update
4. **SR ที่ผ่านขั้น create ไปแล้ว:** ปุ่มต้องเป็น read-only สำหรับ approver และ issuer แต่ยังเปิดดูได้
5. **GRN:** หลังถอด footer row ออก การแก้ dimension ต้องยังส่ง payload และผ่าน `restoreStoredPricing` เหมือนเดิม

ทั้ง 5 ข้อไม่มีเทสต์อัตโนมัติ (ห้ามเขียนเทสต์ใหม่) จึงอยู่ในรายการตรวจมือตอนท้าย และให้ reviewer ไล่ดูทีละข้อ

---

### Task 1: `LineDimensionPopover`

**Files:**
- Create: `components/dimension/line-dimension-popover.tsx`

**Interfaces:**
- Consumes: `LineDimensionFields` (`components/dimension/line-dimension-fields.tsx:17-33`: `value: readonly DimensionRef[]`, `onChange(next: DimensionRef[])`, `disabled?`) และ `Popover`/`PopoverTrigger`/`PopoverContent` จาก `@/components/ui/popover`
- Produces: `export function LineDimensionPopover(props: { readonly value: readonly DimensionRef[]; readonly onChange: (next: DimensionRef[]) => void; readonly disabled?: boolean }): JSX.Element`

- [ ] **Step 1: เขียนคอมโพเนนต์**
  - trigger เป็น `Button` ขนาดเล็ก variant outline/ghost `type="button"` ข้อความ `Dim ${value.length}` หรือ `Dim —` เมื่อ `value.length === 0`
  - trigger กดได้เสมอแม้ `disabled` เป็น true
  - content: `<LineDimensionFields value onChange disabled />` กว้างพอให้ Select วางเรียงกัน (เช่น `w-80`)
  - คอมโพเนนต์ไม่เช็ค license เอง ผู้เรียกเป็นคนเช็ค
  - ใส่ JSDoc ภาษาไทยแบบไฟล์ข้างเคียง
- [ ] **Step 2: static check**
  Run: `npx tsc --noEmit && npx eslint --no-fix components/dimension/line-dimension-popover.tsx`
  Expected: ไม่มี error
- [ ] **Step 3: commit**
  `git add components/dimension/line-dimension-popover.tsx && git commit -m "feat(dimension): LineDimensionPopover ปุ่มเปิดเลือก dimension ต่อบรรทัด"`

### Task 2: GRN เปลี่ยนจากแถว footer มาเป็นคอลัมน์ popover

**Files:**
- Modify: `routes/procurement/goods-receive-note/use-grn-item-table.tsx:33,144-160`
- Modify: `routes/procurement/goods-receive-note/grn-item-cells/item-dimensions.tsx`

**Interfaces:**
- Consumes: `LineDimensionPopover` (Task 1)
- Produces: `GrnItemDimensions({form, index, disabled})` ใช้ signature เดิม แต่เปลี่ยนไป render `LineDimensionPopover` (ตัดสินใจ: เก็บ wrapper ไว้ เพราะ logic ของ `setValue` + `dimensions_dirty` อยู่ในนี้ และ IA/SR ใช้ wrapper แบบเดียวกัน)

- [ ] **Step 1:** ใน `item-dimensions.tsx` ให้เปลี่ยน `<div className="pb-2.5"><LineDimensionFields/></div>` เป็น `<LineDimensionPopover/>` พร้อม value, disabled และ onChange เดิม แล้วแก้ JSDoc ที่พูดถึง footer
- [ ] **Step 2:** ใน `use-grn-item-table.tsx`
  - ลบ `meta.footerContent`/`footerColSpan` ทั้งก้อน (บรรทัด 144-160) ไฟล์นี้ไม่มี `footerContent` ตัวอื่นแล้ว
  - เพิ่มคอลัมน์ `{ id: "dimensions", header: "Dim", size: เล็ก, cell: ({row}) => <GrnItemDimensions form={form} index={row.index} disabled={disabled || isLocked(row.index)} /> }` ไว้ก่อน action column และเพิ่มเฉพาะเมื่อ `dimensionsEnabled`
  - index ให้ใช้วิธีเดียวกับคอลัมน์ข้างเคียงในไฟล์นี้ (ถ้าคอลัมน์อื่นใช้ `itemFields.findIndex` ก็ใช้ตาม)
  - `dimensionsEnabled` ยังอยู่ใน deps array ที่ :423
- [ ] **Step 3: static check + เทสต์เดิม**
  Run: `npx tsc --noEmit && npx eslint --no-fix routes/procurement/goods-receive-note && npx vitest run routes/procurement/goods-receive-note`
  Expected: ผ่านทั้งหมด ถ้าเทสต์เดิมอ้าง footer row ให้แก้เทสต์นั้นให้ตรงกับคอลัมน์ใหม่ (เป็นการแก้เทสต์เดิม ไม่ใช่เขียนใหม่)
- [ ] **Step 4: commit**
  `git commit -m "refactor(grn): dimension ต่อบรรทัดย้ายจากแถว footer มาเป็นปุ่ม popover"`

### Task 3: Stock-in / Stock-out (หน้า inventory adjustment)

**Files:**
- Modify: `types/inventory-adjustment.ts:18-41` (`InventoryAdjustmentDetail` เพิ่ม `dimensions?: DimensionRef[]`), `:72-79` (`AdjustmentDetailItemPayload` เพิ่ม `dimensions?: DimensionPayload[]`)
- Modify: `routes/inventory-management/inventory-adjustment/ia-form-schema.ts` (`createDetailSchema` :8-31, `ADJ_ITEM` :72-81, `mapItemToPayload` :83-97, `getDefaultValues` items :142)
- Modify: `routes/inventory-management/inventory-adjustment/ia-form.tsx` (:178, :209-227, :309)
- Create: `routes/inventory-management/inventory-adjustment/ia-item-dimensions.tsx`
- Modify: `routes/inventory-management/inventory-adjustment/use-ia-item-table.tsx` (columns :640-700)

**Interfaces:**
- Consumes: `LineDimensionPopover` (Task 1), `lineDimensionsPayload`, `clearDimensionsDirty`, `useLineDimensionsEnabled`
- Produces:
  - `mapItemToPayload(item, options?: { dimensionsEnabled?: boolean }): AdjustmentDetailItemPayload` (เพิ่มพารามิเตอร์ตัวที่สองแบบเดียวกับ PR `pr-form-schema.ts:748-783`)
  - `restoreStoredCost<U extends { id: string }>(update: U[] | undefined, current: AdjFormValues, original: AdjFormValues): U[] | undefined` อยู่ใน `ia-form-schema.ts`
  - `IaItemDimensions({ form, index, disabled })` ใช้รูปแบบเดียวกับ `GrnItemDimensions`

- [ ] **Step 1: types และ schema**
  - zod line เพิ่ม `dimensions: z.array(dimensionRefSchema).optional()` และ `dimensions_dirty: z.boolean().optional()` โดยคัดลอก `dimensionRefSchema` แบบ PR (`pr-form-schema.ts:21-28`)
  - `ADJ_ITEM` เพิ่ม `dimensions: [] as DimensionRef[]` และ `dimensions_dirty: false`
  - `getDefaultValues` map `dimensions: d.dimensions ?? []` และ `dimensions_dirty: false`
- [ ] **Step 2: payload**
  - `mapItemToPayload` spread `...lineDimensionsPayload(item, options?.dimensionsEnabled ?? false)` ที่ท้าย object
  - `ia-form.tsx`: เรียก `const dimensionsEnabled = useLineDimensionsEnabled()` ใน component แล้วส่งเข้า `buildUpdatePayload`/`buildCreatePayload` ทั้งสองตัว
- [ ] **Step 3: `restoreStoredCost`**
  เงื่อนไขของบรรทัดใน `update` ที่ถือว่า "แก้แค่ dimension": ต้องครบทุกข้อต่อไปนี้
  - `cur.dimensions_dirty`
  - `product_id`, `qty`, `description` เท่ากับ `orig`
  - header `location_id` และ `date` ของ `current` เท่ากับ `original`

  เมื่อเข้าเงื่อนไข ให้แทน `cost_per_unit`/`total_cost` ด้วยค่าของ `orig` ถ้าไม่เข้าเงื่อนไข ให้คืน `u` เดิม
  ข้อ header กันไม่ให้ไปย้อนต้นทุนที่ probe ดึงใหม่เพราะเปลี่ยนวันที่หรือคลัง (Review Focus 2) ส่วนข้อ `qty` ครอบกรณีผู้ใช้แก้จำนวน
  ใน `buildUpdatePayload` ให้ครอบผลของ `buildItemChanges(...).update` ด้วย `restoreStoredCost(update, values, defaultValues)`
- [ ] **Step 4: reset หลัง save** ที่ `ia-form.tsx:178` และ `:309` ให้เปลี่ยน `form.reset(form.getValues())` เป็น `form.reset(clearDimensionsDirty(form.getValues()))`
- [ ] **Step 5: UI**
  - `ia-item-dimensions.tsx` ทำแบบ `GrnItemDimensions` แต่ใช้ type `AdjFormValues`
  - ใน `use-ia-item-table.tsx` เพิ่มคอลัมน์ `id: "dimensions"` ก่อน action เฉพาะเมื่อ `useLineDimensionsEnabled()` โดยใช้ `disabled={disabled}`
  - ตอน view `disabled` เป็น true แต่ปุ่มยังเปิดดูได้ คอลัมน์นี้ต้องไม่ถูกกรองออกตอน view (ต่างจาก action column ที่ :700)
- [ ] **Step 6: static check + เทสต์เดิม**
  Run: `npx tsc --noEmit && npx eslint --no-fix types/inventory-adjustment.ts routes/inventory-management/inventory-adjustment && npx vitest run routes/inventory-management/inventory-adjustment`
  Expected: ผ่าน รวมถึง `ia-item-fields.cost.test.tsx` และ `ia-item-fields.on-date.test.tsx` ที่มีอยู่แล้ว
- [ ] **Step 7: commit**
  `git commit -m "feat(inventory-adjustment): เลือก dimension ต่อบรรทัดใน stock-in/stock-out"`

### Task 4: Store requisition

**Files:**
- Modify: `types/store-requisition.ts:26-39` (`StoreRequisitionDetail` เพิ่ม `dimensions?: DimensionRef[]`), `:88-96` (`SrDetailPayload` เพิ่ม `dimensions?: DimensionPayload[]`)
- Modify: `routes/store-operation/store-requisition/sr-form-schema.ts` (line schema :5-50, `SR_ITEM` :99-114)
- Modify: `routes/store-operation/store-requisition/sr-form-helpers.ts` (`buildSrDefaultValues` :40-60, `buildSrDuplicateValues` :83-105, `mapSrItemToPayload` :168-178)
- Modify: `routes/store-operation/store-requisition/use-sr-form-actions.ts` (`buildSaveDetails` :191-212, reset :223)
- Create: `routes/store-operation/store-requisition/sr-item-dimensions.tsx`
- Modify: `routes/store-operation/store-requisition/use-sr-item-table.tsx` (columns :450-660)

**Interfaces:**
- Consumes: `LineDimensionPopover` (Task 1) และ helper ของ #611
- Produces: `mapSrItemToPayload(item, options?: { dimensionsEnabled?: boolean })` และ `SrItemDimensions({ form, index, disabled })`

- [ ] **Step 1: types และ schema** ทำแบบเดียวกับ Task 3 Step 1 โดย default map มาจาก `d.dimensions ?? []`
- [ ] **Step 2: duplicate** ใน `buildSrDuplicateValues` ให้คัดลอก `dimensions: d.dimensions ?? []` ของแต่ละบรรทัด และตั้ง `dimensions_dirty: false`
  บรรทัดที่ได้จากการ duplicate ไม่มี `id` จึงถูกส่งทุกครั้งผ่าน `lineDimensionsPayload` อยู่แล้ว
- [ ] **Step 3: payload และ reset**
  - `mapSrItemToPayload` spread `lineDimensionsPayload(item, options?.dimensionsEnabled ?? false)`
  - `use-sr-form-actions.ts` เรียก `useLineDimensionsEnabled()` แล้วส่งเข้า `buildItemChanges(values.items, defaultValues.items, (i) => mapSrItemToPayload(i, { dimensionsEnabled }))` จุดอื่นที่เรียก `mapSrItemToPayload` ให้ส่ง options เดียวกัน
  - เปลี่ยน `form.reset(values)` ที่ :223 เป็น `form.reset(clearDimensionsDirty(values))`
  - workflow actions (`SrStageDetail[]` ที่ :330, :404-453) ไม่ต้องแตะ
  - SR ไม่ต้องใช้ `restoreStoredCost` เพราะ payload ไม่มีต้นทุน และจำนวนส่งตามค่าที่อยู่ใน form ซึ่งไม่มี probe เขียนทับ
- [ ] **Step 4: UI**
  - `sr-item-dimensions.tsx` ใช้รูปแบบเดียวกับ Task 3
  - คอลัมน์ `id: "dimensions"` อยู่ก่อน action เฉพาะเมื่อ `useLineDimensionsEnabled()` โดยใช้ `disabled={disabled || lockNonApproved}` ซึ่งเป็น lock ตัวเดียวกับช่อง product/description ที่ :476/:506
  - **Ruling:** dimension เป็นข้อมูลที่ผู้ขอกรอกตอนสร้าง จึงใช้ lock ของฝั่งผู้ขอ ไม่ใช้ `lockApproved`/`lockIssued`
  - เพิ่ม `dimensionsEnabled` ใน deps ของ `useMemo` ที่ :665
- [ ] **Step 5: static check + เทสต์เดิม**
  Run: `npx tsc --noEmit && npx eslint --no-fix types/store-requisition.ts routes/store-operation/store-requisition && npx vitest run routes/store-operation/store-requisition`
  Expected: ผ่าน
- [ ] **Step 6: commit**
  `git commit -m "feat(store-requisition): เลือก dimension ต่อบรรทัดใน SR/transfer"`

## ตรวจมือบน dev (หลัง merge จะ deploy dev อัตโนมัติ)

ตรวจทั้ง SR, SI, SO และ GRN ตามข้อต่อไปนี้
- เลือก dimension แล้ว save จากนั้น reload ค่าต้องยังอยู่
- แก้แค่ dimension แล้วต้นทุนกับจำนวนต้องไม่เปลี่ยน โดยเฉพาะ SO ใบร่าง (Review Focus 1)
- save สองรอบติดกัน แล้วดูใน network ว่ารอบที่สองไม่มี `dimensions`
- BU ที่ไม่มี license ต้องไม่เห็นคอลัมน์
- โหมดดูเอกสาร และ SR ฝั่ง approver ต้องเปิด popover ดูค่าได้ แต่แก้ไม่ได้
- SI/SO ที่สร้างจาก physical count ต้องแสดง dimension ที่ server ตั้ง default ไว้
