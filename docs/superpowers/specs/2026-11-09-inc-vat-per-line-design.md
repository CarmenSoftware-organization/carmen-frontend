# Inc VAT รายบรรทัด — Price List / PR / PO / GRN / AP

วันที่: 2026-11-09 · รีโป: `carmen-turborepo-backend` (schema + micro-business + gateway) และ `carmen-frontend`

## ทำไม

วันนี้ทุกเอกสารคิดภาษีแบบ **บวกเพิ่ม** อย่างเดียว: tax profile ที่เป็น none = ไม่มีภาษี,
tax profile ที่มี rate = net × rate ÷ 100 บวกทับ ผู้ขายจำนวนมากเสนอราคาที่ **รวม VAT แล้ว**
ผู้ใช้ไม่มีทางบันทึกราคานั้นตรง ๆ ต้องถอดในหัวเอง และ Price List Compare ที่เทียบราคาประมูล
จะผิดทันทีถ้าบางเจ้ากรอกราคารวม VAT ปนกับเจ้าที่ไม่รวม

## เป้าหมาย

1. ช่องติ๊ก **Inc VAT** ต่อบรรทัด ที่ราคาของ Price List, PR, PO, GRN, AP Invoice
2. ติ๊กแล้ว = ราคาที่กรอกรวม VAT แล้ว ระบบ **ถอด** VAT ออก แทนการบวกเพิ่ม
3. Price List Compare เทียบด้วยราคา **ก่อน VAT** เสมอ
4. ค่าติ๊กและราคาที่กรอก **ไหลตามเอกสาร**: Price List 107 + ติ๊ก → PR ได้ 107 + ติ๊ก → PO → GRN → AP (ผู้ใช้ตัดสิน)

## ไม่ทำ (non-goals)

- ไม่แตะ tax profile — Inc VAT **แยกจาก tax profile โดยสิ้นเชิง** (ผู้ใช้กำหนด) tax profile
  ยังให้แค่อัตรา; ช่องติ๊กบอกแค่ว่าราคาที่กรอกรวม VAT หรือยัง ไม่เพิ่มชนิดใน `enum_tax_profile_tax_type`
- ไม่มีช่องติ๊กระดับหัวเอกสาร (ผู้ใช้เลือกทีละบรรทัด)
- ไม่ย้อนแก้เอกสารเก่า — ทุกแถวเดิม `is_tax_included = false` ตัวเลขไม่เปลี่ยน
- Credit Note, AR, PR Template, Extra cost, Store Requisition — นอกขอบเขตรอบนี้ (ดู "ที่ปล่อยให้ผู้สร้าง")

## Anti-goals (ถ้าเกิดถือว่าล้มเหลวแม้โค้ดจะทำงาน)

- ยอด FE กับยอดที่ backend บันทึกไม่ตรงกัน (สองฝั่งคิดซ้ำทั้งคู่)
- ต้นทุนสินค้าเข้าคลังจาก GRN รวม VAT เข้าไป
- Compare เลือกผู้ขายผิดเจ้าเพราะเอา 107 ไปเทียบกับ 100
- ความหมายของ `net_amount` / `total_price` เปลี่ยนตามช่องติ๊ก ทำให้รายงาน/JV/ยอดท้ายใบเพี้ยน

## สูตร (ข้อเสนอที่ผู้ใช้ OK แล้ว)

ตัวอย่าง: ราคา 107 × 2, ส่วนลด 10%, rate 7%, ติ๊ก Inc VAT

| ขั้น | สูตร | ผล |
|---|---|---|
| subtotal | price × qty (ยังรวม VAT) | 214.00 |
| discount | subtotal × disc% — **หักจากยอดรวม VAT** | 21.40 |
| gross | subtotal − discount | 192.60 |
| tax | gross × rate ÷ (100 + rate) | 12.60 |
| net_amount | gross − tax (**ก่อน VAT**) | 180.00 |
| total_price | = gross (**ไม่บวกซ้ำ**) | 192.60 |

- ไม่ติ๊ก: สูตรเดิมทุกตัวอักษร (net = subtotal − discount, tax = net × rate ÷ 100, total = net + tax)
- `is_tax_adjustment` (กรอกภาษีเอง) + ติ๊ก: tax = ค่าที่กรอก, net = gross − tax, total = gross
- rate = 0 หรือไม่มี tax profile: ติ๊กไม่มีผล (tax = 0, net = total = gross)
- round2 ทุกชั้น ลำดับเดียวกับ `computeLineAmounts` ปัจจุบัน
- ฟิลด์ `base_*` = ค่าข้างบน × exchange_rate ตามเดิม
- **invariant:** `net_amount` = ก่อน VAT, `total_price` = รวม VAT เสมอ ไม่ว่าติ๊กหรือไม่
- `price` เก็บตัวเลขตามที่กรอก (107) ไม่ normalize

## ข้อมูล (schema tenant)

เพิ่ม `is_tax_included Boolean @default(false)` ใน:

- `tb_pricelist_detail`
- `tb_purchase_request_detail`
- `tb_purchase_order_detail` (และ `tb_purchase_order_detail_tb_purchase_request_detail` ถ้ามันถือ tax ของตัวเอง — มี `tax_rate`/`tax_amount` อยู่)
- `tb_good_received_note_detail_item`
- `tb_ap_invoice_detail` (ฝั่ง VAT: ชื่อคอลัมน์ให้สอดคล้อง `vat_*` ได้ เช่น `vat_is_included` — ผู้สร้างเลือก)

ไม่ใช้ `enum_tax_type { none, included, add }` ที่มีใน schema แต่ไม่มีตารางไหนใช้ —
เพราะ none/add ซ้อนกับ tax profile อยู่แล้ว (ผู้ใช้ต้องการให้แยก) boolean เดียวจึงพอ

**Price List:** `price` = ที่กรอก, `price_without_tax` = ก่อน VAT **จริง** (ติ๊ก: price × 100 ÷ (100+rate);
ไม่ติ๊ก: = price ตามเดิม), `tax_amt` = ภาษีต่อหน่วย. migration ไม่ต้อง backfill
เพราะแถวเดิมทุกแถว `price_without_tax = price` อยู่แล้ว (ผู้สร้างควร verify บน dev ก่อน — ดูข้อเสี่ยง)

ลำดับ deploy: migration → backend → FE (ตามธรรมเนียมรีโป; FE ส่ง field ใหม่ก่อน BE รับ = field ถูกทิ้งเงียบ)

## จุดที่ต้องแก้ (จาก recon)

### สูตร — ต้องเหมือนกันทุกจุด
- FE `lib/line-pricing.ts` `computeLineAmounts` — เพิ่ม input `isTaxIncluded`. ผู้เรียก: PR (`pr-form-schema.ts`, `pr-hidden-fields.ts`), PO (`po-form-schema.ts`, `po-item-pricing.ts`, `po-item-cells/row-pricing-cells.tsx`), GRN (`grn-item-table.tsx`, `grn-summary.ts`, `grn-item-cells/use-grn-item-line.ts`), CN (`cn-item-compute.ts` — ส่ง false)
- FE `lib/price-list-tax.ts` `priceListTaxParts` — เพิ่มโหมด include (ใช้ทั้งหน้า PL ภายใน, portal `/pl/:token`, Excel import ใน `routes/external/pl/`)
- FE AP `routes/accounting/accounts-payable/invoice/ap-invoice-form.ts` `lineAmounts` (~L201)
- BE `micro-business/src/common/pricing/calculate-price-info.logic.ts` `getCalculatePriceInfo` (PR + `common/verify/amount.check.ts`)
- BE `micro-business/src/ap/ap-invoice/ap-invoice.logic.ts` `computeLine`
- BE PO / GRN service ที่คิดยอดเอง (ผู้สร้างตรวจ `purchase-order.service.ts`, `good-received-note.service.ts`)

### Compare
- BE `master/price-list/price-list.service.ts` `priceCompare` (~L725): `orderBy` และ sort ใน JS (~L765) เปลี่ยนจาก `price` → `price_without_tax`; filter `price: { gt: 0 }` คงเดิมได้
- entry ที่คืนต้องมี `is_tax_included` + ราคาเดิม (107) เพื่อให้ PR ดึงไปพร้อมติ๊ก
- FE `routes/procurement/purchase-request/pr-pricelist-compare.tsx` / `pr-pricelist-dialog.tsx` — แสดงราคาที่กรอก + ป้าย Inc VAT และราคาก่อน VAT ที่ใช้เรียง (ผู้สร้างจัดหน้าตา)
- ตรวจ `master/check-price-list/check-price-list.service.ts` และ `common/pricing/last-price.logic.ts` ว่าเทียบ/คืนราคาแบบไหน ถ้าเทียบระหว่างแถว ต้องใช้ราคาก่อน VAT

### การไหลของค่าติ๊ก
Price List → PR (ตอนเลือกจาก compare) → PO (สร้างจาก PR และ wizard `po/from-price-list/step-select-items.tsx`) → GRN (จาก PO) → AP (สร้างเอง และ auto จาก GRN `good-received-note.ap-link.ts`, `accounting-export/builders/grn.ap-builder.ts`) — ทุกจุดคัดลอก `price` + `is_tax_included` คู่กัน

### ผลข้างเคียงที่ recon เจอ
- **ต้นทุนคลัง:** `stockCostOf` (`inventory-transaction.service.ts:111`) = `base_net_amount + base_extra_cost_amount` → ถ้า net เป็นก่อน VAT ตาม invariant ต้นทุนถูกเอง ไม่ต้องแก้ แต่ต้อง verify
- **AP variance:** `ap-invoice.writer.ts` ~L458 คิด `variance = net_amount − qty × received_price` ถ้า GRN บรรทัดนั้นติ๊ก `received_price` เป็นราคารวม VAT → variance ผิด ต้องใช้ราคาก่อน VAT ต่อหน่วยของ GRN
- **Price mask / hidden fields** (`pr-price-mask.ts`, `po-price-mask.ts`, `pr-hidden-price-guard.ts`, FE `pr-hidden-fields.ts`): ถ้าซ่อนราคา ต้องซ่อน/คิดสอดคล้อง
- **Serializer สองชั้น:** ฟิลด์ใหม่ต้องเพิ่มทั้ง micro-business และ gateway serializer/DTO ไม่งั้นถูกตัดทิ้ง (เคยพลาดมาแล้ว)

## UI

- ช่องติ๊ก `Inc VAT` ข้าง/ใต้ช่องราคาในแต่ละบรรทัด ทั้ง 5 หน้าฟอร์ม + portal vendor price list + Excel import/export ของ price list (คอลัมน์ใหม่)
- disabled เมื่อเอกสาร read-only ตามกฎเดิมของแต่ละหน้า
- บรรทัดที่ดึงมาจากเอกสารต้นทาง: ติ๊กตามต้นทางเป็นค่าตั้งต้น ผู้ใช้ยังแก้ได้ถ้าราคานั้นแก้ได้ (ผู้สร้างตามกฎ editable ของแต่ละฟิลด์ราคาเดิม)
- ข้อความผ่าน i18n (en/th) ใช้คีย์เดียวกันทุกหน้า
- design system: ใช้ `Checkbox` primitive ที่มี อย่าตั้งสี/ขนาดใหม่

## ความเสี่ยง / สิ่งที่ต้องยืนยันก่อน merge

- verify บน dev ว่า `tb_pricelist_detail.price_without_tax = price` ทุกแถวจริง (ถ้าไม่ จะต้อง backfill ก่อนเปลี่ยน orderBy)
- print form / report (micro-report) ที่แสดงราคาต่อหน่วย อาจต้องแสดงป้าย Inc VAT — ไม่อยู่ในขอบเขตรอบนี้ แต่ต้องตรวจว่าไม่คิดภาษีซ้ำเอง
- allowlist: ไม่มี endpoint ใหม่ คาดว่าไม่ต้องเพิ่ม api_name

## คำตัดสินจาก builder check (เป็น call ของ Claude — ผู้ใช้ตรวจตอนอ่าน)

1. **rate เดินทางคู่กับราคา:** ตอนดึงราคาจาก Price List → PR (และทุก hop ถัดไป) คัดลอก
   `tax_profile_id` / `tax_rate` ไปพร้อม `price` + `is_tax_included` (ตามพฤติกรรมเดิมที่ compare
   entry คืน tax profile อยู่แล้ว) ถ้าผู้ใช้เปลี่ยน tax profile ในเอกสารปลายทางเอง ราคาที่กรอก (107)
   คงเดิม ภาษีคิดใหม่ด้วย rate ใหม่ — ยอมรับว่า net จะต่างจากที่ Compare จัดอันดับ
2. **รวม/แยกบรรทัด:** จุดที่รวมหลายบรรทัดต้นทางเป็นบรรทัดเดียว (PR→PO, PO→GRN, GRN→AP auto)
   ให้ `is_tax_included` เป็นส่วนหนึ่งของ key ที่ใช้จัดกลุ่ม — บรรทัดที่ติ๊กต่างกันไม่ถูกรวม
   ถ้าโค้ดเดิมรวมโดยไม่ดูราคาอยู่แล้ว ให้ผู้สร้างรายงานก่อนเปลี่ยน
3. **AP variance:** ไม่เพิ่มคอลัมน์ ใช้ราคาก่อน VAT ต่อหน่วยที่ derive จาก GRN item
   (`net_amount ÷ received_qty` ในหน่วยเดียวกับ matched_qty) เทียบกับ `net_amount` ของ AP → net เทียบ net
4. **สกุลเงิน:** Compare เทียบในสกุลของ price list เหมือนวันนี้ การเทียบข้ามสกุลอยู่นอกขอบเขต
5. **Excel / portal ไฟล์เก่า:** ไม่มีคอลัมน์ Inc VAT หรือช่องว่าง = **คงค่าเดิม** (ตามกติกาเดิมของ
   `price-list-external-excel.ts` ที่ "ไม่รู้จัก/ว่าง = คงเดิม") แถวใหม่ = false
6. **ความละเอียด:** `price_without_tax` เก็บ 5 ตำแหน่ง (ตามคอลัมน์) ไม่ round2; round2 ใช้กับยอดเงิน
   ในเอกสารเท่านั้น Compare เรียงด้วยค่า 5 ตำแหน่ง

## ที่ปล่อยให้ผู้สร้าง

- ชื่อคอลัมน์ที่แน่นอนใน AP, ตำแหน่ง/หน้าตาช่องติ๊กในตาราง
- Credit Note: ใช้ `computeLineAmounts` ร่วม — ส่ง `isTaxIncluded: false` ไว้ก่อน (คุณสมบัติ CN แยกรอบ)
- การแบ่ง PR/branch ระหว่างสองรีโป (คาดว่า BE 1 + FE 1 หรือแยกตามเอกสาร)
