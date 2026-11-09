# Inc VAT รายบรรทัด Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ช่องติ๊ก Inc VAT ต่อบรรทัดใน Price List / PR / PO / GRN / AP Invoice ที่ถอด VAT ออกจากราคาที่กรอก แทนการบวกเพิ่ม และให้ Price List Compare เรียงด้วยราคาก่อน VAT

**Architecture:** เพิ่มคอลัมน์ boolean ต่อบรรทัด (แยกจาก tax profile) · สูตรอยู่ 3 จุดที่ต้องเหมือนกันทุกตัวอักษร: FE `computeLineAmounts`, BE `getCalculatePriceInfo`, AP `computeLine` (FE+BE) · ค่าติ๊กเดินทางคู่กับ `price` + tax profile ทุก hop

**Tech Stack:** BE: NestJS + Prisma (tenant schema), micro-business + backend-gateway · FE: Vite + React 19 + RHF + zod

**Spec:** `docs/superpowers/specs/2026-11-09-inc-vat-per-line-design.md` (อ่านคู่กัน โดยเฉพาะตารางสูตร และ "คำตัดสินจาก builder check")

## Global Constraints

- **ไม่เขียน test ใหม่** (ความต้องการของผู้ใช้): ข้ามขั้น test ทุกขั้น · ห้ามสร้าง `*.spec.ts` / `*.test.ts` ใหม่ · แต่ test เดิมต้องผ่าน และต้องรัน typecheck + lint ทุก task
- Branch `feature/inc-vat-per-line` ทั้งสองรีโป แตกจาก `main` (ไม่มี `develop`)
- commit message เป็นภาษาไทย, PR เป็นภาษาอังกฤษ
- ชื่อคอลัมน์: `is_tax_included Boolean @default(false)` ทุกตาราง ยกเว้น `tb_ap_invoice_detail` ใช้ `vat_is_included` (ให้เข้าชุดกับ `vat_*`)
- invariant: `net_amount` = ก่อน VAT, `total_price`/`total_amount` = รวม VAT เสมอ · `price` เก็บตัวเลขตามที่กรอก
- สูตรเมื่อติ๊ก: `gross = round2(subtotal − discount)` · `tax = isTaxAdj ? taxAmt : round2(gross × rate ÷ (100 + rate))` · `net = round2(gross − tax)` · `total = gross` · ไม่ติ๊ก = สูตรเดิมไม่เปลี่ยน
- `price_without_tax` ของ price list เก็บ 5 ตำแหน่ง ไม่ round2
- ฟิลด์ใหม่ต้องเพิ่ม **ทั้ง** micro-business serializer/DTO **และ** gateway serializer/DTO (ไม่งั้นถูกตัดทิ้งเงียบ ๆ)
- ลำดับ deploy: migration → BE → FE

## Review Focus

(ไม่มี test อัตโนมัติ — แต่ละข้อเป็นการตรวจมือที่ task เจ้าของต้องทำผ่าน curl/เบราว์เซอร์)

1. ติ๊ก Inc VAT แต่ tax profile เป็น none / rate 0 → tax 0, net = total = gross (ต้องไม่หารศูนย์หรือเพี้ยน) — Task 2, 9
2. ติ๊ก + `is_tax_adjustment` (กรอกภาษีเอง) → net = gross − ภาษีที่กรอก, total = gross — Task 2, 9
3. สลับติ๊กบนบรรทัดที่บันทึกแล้ว → ยอดคิดใหม่ทันทีทั้ง FE และหลังบันทึก BE verify ไม่ฟ้อง amount mismatch — Task 2, 11
4. นำเข้า Excel price list ไฟล์เก่าที่ไม่มีคอลัมน์ Inc VAT บนแถวที่ติ๊กอยู่ → ค่าติ๊กคงเดิม — Task 10
5. PR สองบรรทัดสินค้าเดียวกัน ราคา 107 เท่ากัน แต่ติ๊กต่างกัน → แปลงเป็น PO ได้ 2 บรรทัด ไม่ยุบรวม — Task 5

---

# Part A — Backend (`carmen-turborepo-backend`)

### Task 1: Migration คอลัมน์ใหม่

**Files:**
- Modify: `packages/prisma-shared-schema-tenant/prisma/schema.prisma` — models `tb_pricelist_detail`, `tb_purchase_request_detail`, `tb_purchase_order_detail`, `tb_purchase_order_detail_tb_purchase_request_detail`, `tb_good_received_note_detail_item`, `tb_ap_invoice_detail`
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261109120000_inc_vat_per_line/migration.sql`

**Interfaces:**
- Produces: คอลัมน์ `is_tax_included` (5 ตาราง) + `vat_is_included` (AP) ทั้งหมด `BOOLEAN NOT NULL DEFAULT false`

- [ ] **Step 1:** เพิ่มฟิลด์ใน schema วางถัดจาก `is_tax_adjustment` (AP: ถัดจาก `vat_is_override`)
- [ ] **Step 2:** เขียน migration SQL `ALTER TABLE ... ADD COLUMN ... BOOLEAN NOT NULL DEFAULT false` 6 คำสั่ง (ไม่มี backfill)
- [ ] **Step 3:** generate client ตามวิธีของรีโป (ดู skill `build-and-turbo` ของ trail หรือ README ของ package) แล้ว `bun run build` ของ package ผ่าน
- [ ] **Step 4:** query ตรวจบน dev (อ่านอย่างเดียว ทุก schema ของ tenant): `SELECT count(*) FROM tb_pricelist_detail WHERE deleted_at IS NULL AND price_without_tax IS DISTINCT FROM price;` — ผลต้องเป็น 0 ทุก schema ถ้าไม่ใช่ **หยุดและรายงาน** (spec §ความเสี่ยง) · ห้ามรัน migration บน dev เอง (มนุษย์เป็นคนรัน)
- [ ] **Step 5:** commit `feat(schema): เพิ่ม is_tax_included ต่อบรรทัด price list/PR/PO/GRN/AP`

### Task 2: สูตรกลาง BE (PR/PO/GRN verify + AP)

**Files:**
- Modify: `apps/micro-business/src/common/pricing/calculate-price-info.logic.ts`
- Modify: `apps/micro-business/src/common/verify/amount.check.ts` (~L131-230)
- Modify: `apps/micro-business/src/ap/ap-invoice/ap-invoice.logic.ts` (`computeLine`, `IComputeLineContext`)

**Interfaces:**
- Produces: `getCalculatePriceInfo(qty, price, currency_rate = 1, tax_rate = 7, is_tax_adjustment = false, tax_amount_adjustment = 0, discount_rate = 0, is_discount_adjustment = false, discount_amount_adjustment = 0, is_tax_included = false)` — พารามิเตอร์ใหม่ต่อท้าย ผู้เรียกเดิมไม่ต้องแก้
- Produces: `IComputeLineContext.vat_included: boolean` (required — ให้ tsc ชี้ผู้เรียกทุกจุด)
- Produces: `IAmountCheckConfig` อ่าน flag จากบรรทัดผ่าน field `is_tax_included` (AP ไม่ใช้ amount.check)

- [ ] **Step 1:** แก้ `getCalculatePriceInfo` ตามสูตรใน Global Constraints; ค่า `basePrice` ยังเป็น `price × currency_rate` (ราคาที่กรอก)
- [ ] **Step 2:** แก้ `amount.check.ts` ให้ส่ง `Boolean(line.is_tax_included)` เข้า `getCalculatePriceInfo` และ cap `tax_exceeds_line` เทียบกับ gross เมื่อติ๊ก
- [ ] **Step 3:** แก้ `computeLine` ของ AP: เมื่อ `vat_included` → `gross = sub − disc`, `vat = override ?? round2(gross × rate ÷ (100+rate))`, `net = gross − vat`, `total = gross`; `wht_estimate` คิดจาก net (ก่อน VAT) ตามเดิม; base_* ตามเดิม
- [ ] **Step 4:** `bun run typecheck` (หรือ `tsc --noEmit` ของ micro-business) — แก้ผู้เรียก `computeLine` ทุกจุดให้ส่ง `vat_included` (Task 7 ใช้ค่าจริง; ระหว่างนี้ส่งจากบรรทัด `l.vat_is_included ?? false`) · test เดิมของ pricing/verify/ap-invoice ต้องผ่าน
- [ ] **Step 5:** commit `feat(pricing): สูตรถอด VAT เมื่อบรรทัดติ๊ก Inc VAT`

### Task 3: Price List — บันทึก + Compare

**Files:**
- Modify: `apps/micro-business/src/master/price-list/price-list.service.ts` (save paths ~L1120, ~L1333, ~L1406, ~L2020; `priceCompare` ~L671-800; select blocks ~L88, ~L308, ~L549)
- Modify: `apps/micro-business/src/master/price-list/dto/price_list.dto.ts`, `dto/price-list.serializer.ts`
- Modify: `apps/micro-business/src/master/check-price-list/check-price-list.service.ts`, `dto/check-price-list.serializer.ts`
- Modify: `apps/backend-gateway/src/common/dto/pricelist/pricelist.dto.ts`, `pricelist-external.dto.ts`, `apps/backend-gateway/src/application/pricelists/` (serializer/swagger ที่มี `price_without_tax`)
- Create: `apps/micro-business/src/master/price-list/price-list-tax.ts`

**Interfaces:**
- Produces: `priceListTaxParts(price: number, rate: number, isTaxIncluded: boolean): { price_without_tax: number; tax_amt: number }` — ติ๊ก: `price_without_tax = round5(price × 100 ÷ (100+rate))`, `tax_amt = round5(price − price_without_tax)`; ไม่ติ๊ก: `price_without_tax = price`, `tax_amt = round2(price × rate ÷ 100)` (ตรงกับ FE เดิม)
- Produces: compare entry เพิ่ม `is_tax_included: boolean`, `price_without_tax: number`

- [ ] **Step 1:** สร้าง `price-list-tax.ts` แล้วให้ทุก save path คำนวณ `price_without_tax`/`tax_amt` ฝั่ง server จาก `price` + rate ของ tax profile + `is_tax_included` (ไม่เชื่อค่าที่ FE ส่งมา) และบันทึก `is_tax_included`
- [ ] **Step 2:** DTO รับ `is_tax_included: z.boolean().optional()` (ไม่ส่ง = คงค่าเดิมตอน update, false ตอน create) · serializer ทั้งสองชั้นคืนฟิลด์
- [ ] **Step 3:** `priceCompare`: `where.price_without_tax: { gt: 0 }` แทน `price`, `orderBy: [{ is_preferred: 'desc' }, { price_without_tax: 'asc' }]`, sort ใน JS (~L765) ใช้ `price_without_tax`, entry เพิ่มสองฟิลด์ใน Interfaces
- [ ] **Step 4:** อ่าน `check-price-list.service.ts` และ `common/pricing/last-price.logic.ts` — จุดที่เทียบ/เรียงราคาระหว่างแถวเปลี่ยนเป็น `price_without_tax`; จุดที่แค่คืนราคา ให้คืน `is_tax_included` คู่ไปด้วย
- [ ] **Step 5:** typecheck + test เดิมผ่าน · curl: บันทึกบรรทัด 107 ติ๊ก rate 7 → GET คืน `price_without_tax: 100`, `tax_amt: 7`; compare ระหว่างเจ้านั้นกับเจ้า 101 ไม่ติ๊ก → เจ้า 107-ติ๊ก ชนะ
- [ ] **Step 6:** commit `feat(price-list): Inc VAT ต่อบรรทัด + compare เรียงด้วยราคาก่อน VAT`

### Task 4: PR

**Files:**
- Modify: `apps/micro-business/src/procurement/purchase-request/purchase-request.service.ts`, `dto/purchase-request.serializer.ts`, `interface/purchase-request.interface.ts`, `pr-price-mask.ts`, `pr-hidden-price-guard.ts`
- Modify: `apps/micro-business/src/common/shared-interface/purchase-request/purchase-request.interface.ts`, `common/dto/embedded.dto.ts` (~L197), `common/enrichment/enrichment.overrides.ts` (~L53-70)
- Modify: gateway DTO/serializer ของ purchase-request (หาด้วย `trail grep "is_tax_adjustment"` ใน `apps/backend-gateway/src`)

**Interfaces:**
- Consumes: `getCalculatePriceInfo(..., is_tax_included)` (Task 2)
- Produces: PR detail อ่าน/เขียน `is_tax_included`

- [ ] **Step 1:** DTO + serializer ทั้งสองชั้น + interface เพิ่ม `is_tax_included`
- [ ] **Step 2:** ทุกจุดที่ service เรียก `getCalculatePriceInfo` ส่ง flag ของบรรทัด
- [ ] **Step 3:** enrichment: เมื่อ `pricelist_price` ถูกเติมจาก `tb_pricelist_detail.price` ให้เติม `is_tax_included` จากแถวเดียวกันด้วย (คู่กันเสมอ รวมถึงกฎ manual_input ที่ L70)
- [ ] **Step 4:** price mask / hidden guard: ถ้าซ่อน `pricelist_price` ไม่ต้องซ่อน flag แต่ guard ต้องไม่ยอมให้ผู้ใช้ที่มองไม่เห็นราคาเปลี่ยน flag (เพิ่ม `is_tax_included` ในรายชื่อฟิลด์ที่ guard)
- [ ] **Step 5:** typecheck + test เดิมผ่าน · curl บันทึก PR บรรทัด 107×2 ติ๊ก rate 7 → `net_amount 200`, `tax_amount 14`, `total_price 214`
- [ ] **Step 6:** commit `feat(pr): Inc VAT ต่อบรรทัด`

### Task 5: PO (+ PR→PO)

**Files:**
- Modify: `apps/micro-business/src/procurement/purchase-order/purchase-order.service.ts` (`buildPoLineMergeKey` ~L3556, `groupPrForPo` ~L3713, `confirmPrToPo` ~L3969, select ~L3792/~L4051), `dto/purchase-order.dto.ts`, `dto/create-purchase-order.dto.ts`, `dto/purchase-order.serializer.ts`, `interface/purchase-order.interface.ts`, `po-price-mask.ts`, `po-hidden-price-guard.ts`
- Modify: gateway DTO/serializer ของ purchase-order

- [ ] **Step 1:** DTO/serializer ทั้งสองชั้น + interface
- [ ] **Step 2:** `buildPoLineMergeKey` เพิ่ม `prDetail.is_tax_included ? '1' : '0'` เข้า key (ถัดจาก taxProfileId) · อัปเดต JSDoc ทั้งสองภาษา
- [ ] **Step 3:** `groupPrForPo` / `confirmPrToPo` คัดลอก `is_tax_included` จาก PR detail ไป PO detail และแถว junction
- [ ] **Step 4:** จุดที่ PO service คิดยอดเอง (ถ้ามี) ส่ง flag เข้าสูตร Task 2 · mask/guard แบบเดียวกับ Task 4
- [ ] **Step 5:** typecheck + test เดิมผ่าน · ตรวจ Review Focus #5 ผ่าน preview `groupPrForPo`
- [ ] **Step 6:** commit `feat(po): Inc VAT ต่อบรรทัด + แยกบรรทัดตามค่าติ๊กตอนแปลง PR→PO`

### Task 6: GRN

**Files:**
- Modify: `apps/micro-business/src/inventory/good-received-note/good-received-note.service.ts` (~L994 default จาก PO, ~L1343/~L1407/~L1856 write, ~L3460 select), `dto/good-received-note.dto.ts` (~L136), `dto/good-received-note.serializer.ts`, `interface/good-received-note.interface.ts`, `good-received-note.deviation.ts`
- Modify: gateway DTO/serializer ของ good-received-note

- [ ] **Step 1:** DTO/serializer/interface + write paths ทั้งสามจุด
- [ ] **Step 2:** ถัดจาก ~L994: ถ้า item ไม่ส่ง `is_tax_included` มาและมี `poDetail` → ใช้ `poDetail.is_tax_included`
- [ ] **Step 3:** `deviation.ts` เทียบ `order_price` กับ `received_price` — ถ้าสองฝั่งติ๊กต่างกัน ให้เทียบราคาก่อน VAT (แปลงด้วย rate ของบรรทัด) แทนตัวเลขดิบ
- [ ] **Step 4:** ตรวจ `stockCostOf` (`inventory/inventory-transaction/inventory-transaction.service.ts:111`) — ไม่ต้องแก้ ถ้า `base_net_amount` ถูกตาม invariant; ยืนยันด้วย curl ว่า GRN 107×2 ติ๊ก commit แล้ว `cost_per_unit = 100`
- [ ] **Step 5:** typecheck + test เดิมผ่าน
- [ ] **Step 6:** commit `feat(grn): Inc VAT ต่อบรรทัด สืบค่าจาก PO`

### Task 7: AP Invoice (+ GRN→AP)

**Files:**
- Modify: `apps/micro-business/src/ap/ap-invoice/ap-invoice.service.ts` (candidate list ~L600-640, auto lines ~L725-765, ~L1584), `ap-invoice.writer.ts` (~L266, ~L383, variance ~L455-468), `ap-invoice.validation.ts`, `dto/ap-invoice.serializer.ts`, `ap-invoice.from-grn.ts`
- Modify: gateway DTO/serializer ของ ap-invoice

**Interfaces:**
- Consumes: `IComputeLineContext.vat_included` (Task 2)
- Produces: `IApInvoiceLineInput.vat_is_included?: boolean`; candidate item เพิ่ม `is_tax_included`
- Produces: `grnUnitPriceExVat(item: GrnItemMoney): Prisma.Decimal` ใน `ap-invoice.from-grn.ts` = `net_amount ÷ received_qty` (0 เมื่อ qty = 0)

- [ ] **Step 1:** DTO/serializer/writer รับ-เก็บ-คืน `vat_is_included`; writer ส่งเข้า `computeLine`
- [ ] **Step 2:** auto lines (~L755): `unit_price = received_price`, `vat_is_included = i.is_tax_included`, คง `vat_is_override: true` + `vat_amount` เดิม → net = gross − vat ตรงกับ GRN
- [ ] **Step 3:** variance (~L458): `grn_unit_price` = `grnUnitPriceExVat(item)` เพื่อให้ `variance = net − qty × ราคาก่อน VAT` (spec คำตัดสินข้อ 3) · `grnRemainingAmounts` ไม่ต้องแก้ (สัดส่วนจากยอดที่เก็บไว้)
- [ ] **Step 4:** candidate list (~L623) คืน `is_tax_included`
- [ ] **Step 5:** typecheck + test เดิมผ่าน · curl: GRN 107×2 ติ๊ก → AP auto ได้ net 200, vat 14, total 214, variance 0
- [ ] **Step 6:** commit `feat(ap): Inc VAT ต่อบรรทัด + variance เทียบราคาก่อน VAT`

### Task 8: BE wrap-up

- [ ] **Step 1:** `trail check` + lint + typecheck ทั้ง workspace · test เดิมทั้งหมดผ่าน
- [ ] **Step 2:** อัปเดต Bruno (`carmen-turborepo-backend-bruno`) ถ้า request body ของ 5 เอกสารถูกเก็บไว้ที่นั่น (skill `bruno-sync` ของ trail)
- [ ] **Step 3:** เปิด PR (ภาษาอังกฤษ) ระบุลำดับ migration → BE → FE และ query ตรวจใน Task 1 Step 4

---

# Part B — Frontend (`carmen-frontend`)

### Task 9: สูตรกลาง FE

**Files:**
- Modify: `lib/line-pricing.ts`
- Modify: `lib/price-list-tax.ts`
- Modify: `routes/procurement/credit-note/cn-item-compute.ts` (ส่ง `isTaxIncluded: false`)

**Interfaces:**
- Produces: `LineAmountInput.isTaxIncluded?: boolean` (optional, default false) — `computeLineAmounts` คืน shape เดิม
- Produces: `priceListTaxParts(price, rate, isTaxIncluded = false)` คืน `{ price, priceWithoutTax, taxAmt, total }` — ติ๊ก: `priceWithoutTax = price × 100 ÷ (100+rate)` (ไม่ round2), `taxAmt = round2(price − priceWithoutTax)`, `total = price`
- Produces: i18n key `common.incVat` = "Inc VAT" / "รวม VAT" (ทั้ง en/th)

- [ ] **Step 1:** แก้ทั้งสองฟังก์ชันตาม Global Constraints · อัปเดตคอมเมนต์ที่เขียนว่า "add VAT อย่างเดียว ไม่มีโหมด include"
- [ ] **Step 2:** เพิ่ม i18n key (ห้ามมี `{}` หรือ `<คำ>` ในข้อความ)
- [ ] **Step 3:** `bun run typecheck` + `bun run lint` + `bun test:run lib` (test เดิมผ่าน)
- [ ] **Step 4:** commit `feat(pricing): สูตรถอด VAT สำหรับบรรทัดที่ติ๊ก Inc VAT`

### Task 10: Price List (ภายใน + portal + Excel)

**Files:**
- Modify: `types/price-list.ts`, `types/price-list-external.ts`
- Modify: `routes/vendor-management/price-list/pl-form-schema.ts` (~L15-20, ~L144, ~L165, ~L177-192), ฟอร์ม/ตารางบรรทัดในโฟลเดอร์เดียวกัน, `pl-product-grouping.ts`, `pl-item-grouped-view.tsx`
- Modify: `routes/external/pl/use-price-list-external.ts`, `routes/external/pl/price-list-external-excel.ts` (~L159-236) และหน้า portal ในโฟลเดอร์เดียวกัน

**Interfaces:**
- Consumes: `priceListTaxParts(price, rate, isTaxIncluded)` (Task 9)

- [ ] **Step 1:** type + schema `is_tax_included: z.boolean().default(false)`; payload ส่งฟิลด์นี้
- [ ] **Step 2:** ช่องติ๊กข้างช่องราคาในตารางบรรทัด (ใช้ `Checkbox` จาก `components/ui/`) ทั้งหน้าภายในและ portal · คอลัมน์ "Price" แสดงตัวเลขที่กรอก และแสดงราคาก่อน VAT ในคอลัมน์/tooltip ที่มีอยู่
- [ ] **Step 3:** Excel: export เพิ่มคอลัมน์ Inc VAT (Y/N) · import: ไม่มีคอลัมน์หรือช่องว่าง = คงค่าเดิม, แถวใหม่ = false (Review Focus #4)
- [ ] **Step 4:** typecheck + lint + test เดิม · ตรวจในเบราว์เซอร์: 107 ติ๊ก rate 7 → ก่อน VAT 100, ภาษี 7, รวม 107
- [ ] **Step 5:** commit `feat(price-list): ช่องติ๊ก Inc VAT ต่อบรรทัด + คอลัมน์ Excel`

### Task 11: PR

**Files:**
- Modify: `routes/procurement/purchase-request/pr-form-schema.ts` (~L88-92, ~L252, ~L342 + payload mapper), `pr-hidden-fields.ts`, `pr-summary.ts`, `pr-item-fields.tsx`, `pr-item-expand.tsx`, `pr-pricelist-compare.tsx`, `pr-pricelist-dialog.tsx`, `pr-auto-allocate.ts`, `workflow/pr-footer-action.tsx` (จุดที่เซ็ต `pricelist_price`)

**Interfaces:**
- Consumes: `computeLineAmounts({ ..., isTaxIncluded })` (Task 9); compare entry `is_tax_included`, `price_without_tax` (Task 3)

- [ ] **Step 1:** schema/default/mapper เพิ่ม `is_tax_included`; ทุกจุดเรียก `computeLineAmounts` ส่ง flag
- [ ] **Step 2:** ทุกจุดที่เซ็ต `pricelist_price` จาก compare/auto-allocate เซ็ต `is_tax_included` จาก entry เดียวกันด้วย (ค่าคู่กันเสมอ)
- [ ] **Step 3:** ช่องติ๊กในแถวสินค้าข้างราคา · editable ตามกฎเดียวกับช่องราคา (รวม hidden fields)
- [ ] **Step 4:** compare dialog แสดงราคาที่กรอก + ป้าย Inc VAT และราคาก่อน VAT (ตัวที่ใช้เรียง)
- [ ] **Step 5:** typecheck + lint + test เดิม · ตรวจในเบราว์เซอร์ Review Focus #1-3 บน PR
- [ ] **Step 6:** commit `feat(pr): ช่องติ๊ก Inc VAT ต่อบรรทัด สืบค่าจาก price list`

### Task 12: PO

**Files:**
- Modify: `routes/procurement/purchase-order/po-form-schema.ts` (~L48-52, ~L150, ~L255, ~L318-353), `po-item-pricing.ts`, `po-item-cells/row-pricing-cells.tsx`, `from-price-list/step-select-items.tsx`

- [ ] **Step 1:** schema/default/mapper + ส่ง flag เข้า `computeLineAmounts` ทุกจุด
- [ ] **Step 2:** ช่องติ๊กใน `row-pricing-cells.tsx` ข้างราคา
- [ ] **Step 3:** wizard PO จาก price list: คัดลอก `is_tax_included` จากบรรทัด price list และเลิกคิดภาษีเองในไฟล์ (ใช้ `computeLineAmounts`)
- [ ] **Step 4:** typecheck + lint + test เดิม · เบราว์เซอร์: PR ที่ติ๊ก → แปลงเป็น PO แล้วค่าติ๊ก/ยอดตรง
- [ ] **Step 5:** commit `feat(po): ช่องติ๊ก Inc VAT ต่อบรรทัด`

### Task 13: GRN

**Files:**
- Modify: `routes/procurement/goods-receive-note/grn-form-schema.ts` (~L58, ~L171, ~L310), `grn-item-table.tsx`, `grn-summary.ts`, `grn-item-cells/use-grn-item-line.ts`, cell ราคาใน `grn-item-cells/`, `from-po/from-po-content.tsx`, `use-grn-form-actions.ts`

- [ ] **Step 1:** schema/default/mapper + flag เข้า `computeLineAmounts` ทุกจุด (`use-grn-item-line.ts` ต้องเพิ่ม flag ในรายการค่าที่ watch)
- [ ] **Step 2:** สร้าง GRN จาก PO: คัดลอก `is_tax_included` จาก PO detail
- [ ] **Step 3:** ช่องติ๊กข้างราคารับ · ปฏิบัติตามกฎแก้ไขหลัง commit เดิม (`HEADER_EDITABLE_KEYS` — GRN ที่ commit แล้วแก้ไม่ได้)
- [ ] **Step 4:** typecheck + lint + test เดิม · เบราว์เซอร์: PO ติ๊ก → GRN ติ๊ก ยอดตรง
- [ ] **Step 5:** commit `feat(grn): ช่องติ๊ก Inc VAT ต่อบรรทัด`

### Task 14: AP Invoice

**Files:**
- Modify: `routes/accounting/accounts-payable/invoice/ap-invoice-form.ts` (~L35, ~L101, ~L128, `lineAmounts` ~L201-209), `ap-invoice-lines.tsx`, `ap-invoice-detail.tsx`, `routes/accounting/accounts-payable/shared/ap-http-repository.ts`

**Interfaces:**
- Consumes: BE `vat_is_included` บนบรรทัด, candidate `is_tax_included` (Task 7)

- [ ] **Step 1:** form line เพิ่ม `vat_is_included: boolean` · repository map ไป/กลับ
- [ ] **Step 2:** `lineAmounts` ใช้สูตรเดียวกับ BE `computeLine` (ติ๊ก: vat = gross × rate ÷ (100+rate), net = gross − vat, total = gross; override ยังมีผล)
- [ ] **Step 3:** ช่องติ๊กข้าง unit price ใน `ap-invoice-lines.tsx` · แสดงใน detail · บรรทัดที่เลือกจาก GRN ใช้ค่าจาก candidate
- [ ] **Step 4:** typecheck + lint + test เดิม · เบราว์เซอร์: AP auto จาก GRN ที่ติ๊ก แสดง net 200 / vat 14 / total 214
- [ ] **Step 5:** commit `feat(ap): ช่องติ๊ก Inc VAT ต่อบรรทัด`

### Task 15: FE wrap-up

- [ ] **Step 1:** `trail check` + `bun run typecheck` + `bun run lint` + `bun test:run` ทั้งหมดผ่าน
- [ ] **Step 2:** commit spec + plan (`docs/superpowers/specs/2026-11-09-inc-vat-per-line-design.md`, `docs/superpowers/plans/2026-11-09-inc-vat-per-line.md`) ถ้ายังไม่ได้ commit
- [ ] **Step 3:** เปิด PR (ภาษาอังกฤษ) อ้าง BE PR และระบุว่าต้อง deploy BE ก่อน
