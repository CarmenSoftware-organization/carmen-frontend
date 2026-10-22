# POS Sale Interface — Oracle Simphony + Micros 3700 → ตัดสต็อกตามสูตร recipe

วันที่: 2026-10-22 · สถานะ: รอ user อนุมัติ

ต้นทาง (clone ฟีเจอร์จาก BlueLedgers มาไว้ใน Carmen Blue แล้วต่อยอดจนตัดสต็อกจริง):
- **Simphony** — FRD "Symphony to BlueLedgers Field Mapping" v1.4
  `../interface/POS/symphony/frd_symphony_to_blueledgers_field_mapping_v1_4.md` (+ Google Doc
  `1m0BV27eXaFb8PHJ4RMHLLDVJno0v2FBYPq-7M9Uc9pc`), ไฟล์ตัวอย่างจริง `symphony/20260918/*.txt`,
  สเปก Oracle `Symphony-Spec for Restaurant Enterprise Back Office_F77908_15.pdf`
- **Micros 3700** — FRD "Carmen Cloud ERP Micros 3700 to BlueLedgers" v1.2
  `../interface/POS/Micros 3700/frd_carmen_cloud_erp_micros_3700_to_blueledgers.md`, PDF ตัวอย่าง
  `RVC Menu Item Sales Detail Report/Viewer20–30.pdf`, POC อ่าน PDF ด้วย pdf.js
  `WebApp-POC-PDF Text Extraction Library.html`

(path อ้างจาก `carmensoftware-organize/`)

## 1. เจตนาและเหตุผล

โรงแรมที่ใช้ POS ของ Oracle ขายอาหาร/เครื่องดื่มทุกวัน แต่สต็อกวัตถุดิบใน Carmen Blue ไม่รู้เรื่องยอดขาย —
ยอดคงเหลือสูงกว่าความจริง และวัด food cost ไม่ได้จนกว่าจะนับสต็อก งานนี้ทำให้ยอดขายรายวันจาก POS ไหลเข้า
Carmen Blue แล้ว **ตัดวัตถุดิบออกจาก location ที่ถูกต้องตามสูตร recipe** ผ่านเอกสาร Stock Out ที่มีอยู่แล้ว
โดย Cost Controller ตรวจก่อนทุกครั้ง

FRD ทั้งสองฉบับจบที่ "ส่ง payload เข้า BlueLedgers Recipe Module" — ใน Carmen Blue ส่วนนั้นคือของที่เราสร้างเอง
(master POS + ผูกสูตร + Stock Out) ไม่มีการยิง API ภายนอก

POS สองแบรนด์ในรอบนี้ อ่านไฟล์ต่างกันสิ้นเชิงแต่ปลายทางเหมือนกัน — ออกแบบเป็น **แกนกลางร่วม + ตัวอ่านไฟล์ต่อแบรนด์**
Infrasys / Square ตามมาทีหลังด้วยเอกสารของแต่ละตัว

## 2. เป้าหมาย / ไม่ใช่เป้าหมาย / ห้ามเกิด

**เป้าหมาย**
1. Simphony: นำเข้าไฟล์ Standard Export (pipe-separated) สองทาง — ดึงจาก SFTP ตามเวลา และอัปโหลดเอง
2. Micros 3700: นำเข้า PDF รายงาน RVC Menu Item Sales Detail (`MI_R001.RPT v5.6.100`) ทางอัปโหลดเอง
3. ตรวจไฟล์ตามกติกาของ FRD แต่ละตัว (§4.3, §4.4) และเก็บประวัติทุกครั้ง รวมครั้งที่ถูกปฏิเสธ
4. เก็บ master ของ POS (Store, Outlet, Department, Item) และบรรทัดยอดขาย (Sale)
5. ผู้ใช้ผูก Outlet → location (1:1) และ POS Item → recipe
6. Cost Controller ตรวจวัตถุดิบที่จะตัด แล้ว **ยืนยันทีละ Outlet** → Stock Out 1 ใบต่อ Outlet
7. เมนูที่มาผูก recipe ทีหลังตัดย้อนหลังได้ (Stock Out ใบเพิ่ม)

**ไม่ใช่เป้าหมาย**
- JV / GL จาก SUM, กระทบยอดรับชำระจาก TND, ภาษีขายจาก TAX/CGST (Simphony FRD §2.2.2); GL JV (Micros FRD §2.2.2)
- การแก้ตัวเลขยอดขายรายบรรทัดในหน้าจอนำเข้า
- PDF ที่สแกนจากกระดาษ (raster) — ไม่ทำ OCR
- POS แบรนด์อื่น — แต่โครงต้องเพิ่มแบรนด์ได้โดยไม่แตะแกนกลาง
- ตัดสต็อกแบบไม่ผ่านสูตร (`consumption_posting: direct`)

**ห้ามเกิด**
- ตัดสต็อกซ้ำ: ยอดขายชุดเดียวกันถูกตัดสองรอบ หรือบรรทัดเดียวถูกนับในสองใบ
- สต็อกติดลบจากยอด POS — ต้องบล็อก
- ตัดสต็อกโดยไม่มีคนยืนยัน (รวมรอบ SFTP ตี 3)
- รหัส SFTP เก็บเป็น plain text (Simphony FRD §6.1 `password_raw` — **ไม่ทำตาม**)
- เก็บไฟล์ PDF ของ Micros 3700 ไว้ในระบบ (Micros FRD §11.2)

## 3. ข้อจำกัดที่มีอยู่แล้วในระบบ

- **Stock Out** (`tb_stock_out`) มี location เดียวต่อใบ, `doc_status` เริ่ม `draft`, มี `adjustment_type_id/code`;
  `so_date` ต้องอยู่ใน **งวดคลังที่เปิดอยู่** (`assertDateInCurrentPeriod` → `STOCK_OUT_DATE_NOT_CURRENT_PERIOD` /
  `STOCK_OUT_NO_OPEN_PERIOD`); commit ตัดเกินของที่มีไม่ได้ (`STOCK_OUT_INSUFFICIENT_STOCK`); มี void —
  `apps/micro-business/src/inventory/stock-out/stock-out.service.ts`
- **Recipe** (`tb_recipe`, `tb_recipe_ingredient`): ingredient เป็น `product_id` หรือ `sub_recipe_id`; มี `qty` +
  `ingredient_unit_id`, `inventory_qty` + `inventory_unit_id` + `conversion_factor`, `wastage_percentage`; recipe มี
  `base_yield` + yield variant (`default_variant_id`)
- **Interface config**: แถว `tb_application_config` คีย์ `interface_pos_<brand>`; secret ถูก encrypt+mask
  (`***ENCRYPTED***`) ใน `apps/micro-business/src/app-config/app-config.service.ts` — **Prod/UAT ต้องตั้ง
  `SECRET_ENCRYPTION_KEY`**; schema ฟิลด์ใหม่ใช้ `.optional()` ห้าม `.default()` (บั๊ก PR #319)
- **FE ปัจจุบัน**: registry POS มีแบรนด์ `micros`, `infrasys`, `square` (`routes/system-admin/interface/interface-registry.ts`)
  ฟอร์มเดียว `pos-interface-form.tsx` เก็บ `endpoint / api_key / sync_frequency / default_location_code /
  consumption_posting` — ยังไม่มีใครใช้จริง
- **License**: `interface_pos_*` ผูก feature `interface` (ใบ INF) ใน `license-catalog.generated.ts` (มี entry ของ
  `micros/infrasys/square`); `LICENSE_ENFORCEMENT` เปิดทุก env — ผูก key ใหม่ = หน้าล็อกทันทีที่ deploy
- **Cron**: `micro-cronjobs` (Go) ยิง endpoint ภายในของ gateway ต่อ BU ด้วย `x-internal-token` (แบบ
  `internal/executor/gl_run_due.go`); job มี schedule ของตัวเอง + รายการ `bu_codes`
- logic layer ห้าม throw (throw = 503) — คืน `Result` / `Result.errorFromCatalog`; error ใหม่ลง error catalog + i18n FE
- api_name ใหม่ต้องเติม allowlist ก่อน deploy FE ไม่งั้นผู้ใช้โดน logout
- CSP ของแอป: script โหลดจาก bundle เท่านั้น — pdf.js ต้องเป็น dependency ใน bundle (รวม worker) ไม่ใช่ CDN แบบ POC
- ลำดับ deploy: migration → BE (+catalog/allowlist) → cron → FE

## 4. สิ่งที่ตัดสินใจแล้ว

### 4.1 ที่ user ตัดสินเอง
| ข้อ | การตัดสินใจ |
|---|---|
| ขอบเขต | ตัดสต็อกจริงตามสูตร recipe ในรอบนี้ |
| แบรนด์ | Simphony **และ** Micros 3700 ในรอบนี้ |
| Outlet → location | ผูก 1 Outlet ต่อ 1 location |
| จังหวะตัด | นำเข้าแล้ว **ไม่ตัดทันที** — Cost Controller ตรวจแล้วกดยืนยัน |
| หน่วยของเอกสาร | Stock Out **1 ใบต่อ Outlet** (2 outlet ผูก location เดียวกัน = 2 ใบ) |
| เมนูยังไม่ผูก recipe | ยืนยันส่วนที่ผูกแล้วไปก่อน; ที่ผูกทีหลังออก Stock Out ใบเพิ่ม |
| สต็อกไม่พอ | **บล็อก** การยืนยันของ Outlet นั้นจนกว่าจะลงรับ/โอนของให้พอ |
| Simphony Export Version < 1.17 | **รับเข้าได้ แต่แจ้งเตือน** (ไม่ปฏิเสธตาม FRD) — ดู §4.3 |

### 4.2 ที่ผมตัดสินเอง (แย้งได้)
- **Stock Out ลงวันที่ = DocDate (วันขาย)** — วันขายไม่อยู่ในงวดที่เปิด = ยืนยันไม่ได้ (กติกา period เดิม)
- **คำนวณวัตถุดิบตอนกดยืนยัน** แล้วเก็บผลไว้ในใบ; หน้าตรวจแสดง preview จากสูตรปัจจุบัน
- Stock Out ใช้ adjustment type **"POS Sale"** (seed ต่อ BU) และอ้างกลับไปที่การนำเข้า/Outlet ต้นทาง
- **ยืนยัน = สร้างและ commit Stock Out ทันที** — การกดของ Cost Controller คือการตรวจแล้ว ไม่มีขั้นอนุมัติซ้ำ
- void Stock Out ที่มาจาก POS → บรรทัดยอดขายของใบนั้นกลับเป็น "ยังไม่ตัด" (ยืนยันใหม่ได้)
- **ยกเลิกการนำเข้า** ได้เมื่อยังไม่มีบรรทัดใดถูกยืนยัน → นำเข้าไฟล์วันเดียวกันใหม่ได้ (FRD ไม่มี; ไม่งั้นไฟล์ผิดที่ SUCCESS
  แก้ได้ทางเดียวคือแก้ DB)
- **บรรทัดติดลบ (void / refund / `Adj … -`)**: หักกลบตาม Outlet + Item ก่อนบันทึก (Micros FRD §6.3) — ใช้กับ
  Simphony ด้วย; ยอดสุทธิที่ยังติดลบหรือ Qty = 0 → เก็บไว้แต่ **ไม่ตัดสต็อก**
- **แบรนด์**: แทน `micros` ตัวเดิมด้วย `simphony` และ `micros3700` (ฟอร์มเดิมไม่มีใครใช้ — ไม่มีข้อมูลต้องย้าย;
  เอา `micros` ออกจาก registry และ license catalog, เพิ่มสองตัวใหม่ใต้ feature `interface` เดิม) — ไม่เพิ่ม license
  feature key ใหม่
- **ร้าน (Store)**: BU หนึ่งมีได้หลายร้าน (Simphony FRD §2.1/§5.2/TC-BL-003; Micros มี Hotel Name) → master ทุกตัว
  อยู่ใต้ร้าน; คีย์ร้าน = Simphony **Store Number (GLID#2)** / Micros 3700 **Hotel Name** — ไม่ใช้ Source เป็นคีย์
  เพราะ Source ของ Simphony มี POS Version อยู่ข้างใน อัปเกรด POS แล้ว mapping จะหาย
- **SFTP schedule**: cron ยิงทุกชั่วโมง BE ตัดสินเองว่า BU ถึง `schedule_time` ของตัวเองแล้วและยังไม่ได้ดึงรอบวันนี้
- **อ่าน PDF ใน browser** ด้วย pdf.js ตาม POC → ส่งผลที่อ่านได้ (JSON) ขึ้น BE; ไฟล์ไม่ขึ้นเซิร์ฟเวอร์ (FRD §11.2);
  BE ตรวจกติกาทั้งหมดซ้ำ (วันเดียว, ตัดบรรทัดสรุป, หักกลบ, footing) — ไม่เชื่อผลจาก browser อย่างเดียว

### 4.3 กติกาของ Simphony (จาก FRD v1.4 — ยกมาทั้งชุด)
index นับแบบ 1-based รวมช่องชนิดบรรทัด (ตรวจกับไฟล์ตัวอย่างจริงแล้วตรง: MID#2 = 101, #4 = 2206132, #7 = 1, #33 = 18.3)

- **Header (GLID)**: DocDate = Last Business Date (#5, `YYYYMMDD`) → ISO; Source = `GLID[10] + " " + GLID[11] + " " + GLID[3]`
  (เช่น `"Simphony 19.9.2 THMY Sunway Velocity"`); Description = `"Daily POS Sales Import - " + StoreName`;
  Export Version = #8; Store Number = #2
- **Outlet**: Code = MID#2 (≤20), Desc = MID#15 (ว่าง → `"Outlet " + #2`)
- **Department**: Code = MID#21, Desc1 = MID#20, Desc2 = MID#24
- **Item**: Code = MID#4, Desc1 = MID#5, Desc2 = MID#18 (ไม่มี → `""`)
- **Sale**: Qty = MID#7, Total = MID#33 (Gross Sales After Discount ก่อนภาษี), หักกลบตาม Outlet + Item,
  UnitPrice = Total / Qty (Qty = 0 → 0); Total = 0 และ Qty > 0 → UnitPrice 0 แต่ตัดสต็อกตามปกติ (Complimentary)
- **ตรวจตามลำดับ** — ปฏิเสธทั้งไฟล์ ไม่มีข้อมูลบางส่วนค้าง:
  1. ไม่มีบรรทัด `GLID` → `MISSING_GLID_HEADER`
  2. First Business Date ≠ Last Business Date → `MULTI_DAY_GLID_REJECT`
  3. DocDate + BU + Source เคย `SUCCESS` (และยังไม่ถูกยกเลิก) → `REJECTED_DUPLICATE` — ต่าง Source วันเดียวกันได้
  4. บรรทัด MID มีน้อยกว่า 40 ฟิลด์ → `FORMAT_ERROR`
  5. **Export Version < 1.17 → รับเข้า (SUCCESS) พร้อมคำเตือน `LEGACY_EXPORT_VERSION`** เก็บใน log และแสดงในประวัติ/หน้าตรวจ
     (ไฟล์ตัวอย่างจริงทั้งสองไฟล์เป็น `1.00`; ไฟล์หนึ่งมี 40 ฟิลด์ อีกไฟล์ 47 — ทั้งคู่มีทุกคอลัมน์ที่ใช้)
- master + sale ของไฟล์หนึ่งบันทึกใน transaction เดียว
- บรรทัดชนิดอื่น (SUM, TND, TAX, CHDR, CMI, …) ข้าม
- `RemoveDelimiterFromStrings` — ถ้าชื่อมี `|` ติดมา จำนวนฟิลด์จะเพี้ยน → ตกที่กติกาข้อ 4
- SFTP ต่อไม่ได้ใน 30 วิ → retry 3 ครั้ง เว้น 60 วิ แล้วบันทึก log + แจ้งเตือน
- ไฟล์ปกติ 1,000–5,000 บรรทัด MID

### 4.4 กติกาของ Micros 3700 (จาก FRD v1.2 — ยกมาทั้งชุด)
- **อ่าน PDF แบบ text stream** (ไม่ OCR): จัดบรรทัดด้วย Y-tolerance ≤ 4 (เรียง Y จากบนลงล่าง, ในบรรทัดเรียง X);
  ในบรรทัดสินค้า Sales Qty = ตัวเลขก่อน `%` ตัวแรก, Net Sales = ตัวเลขก่อน `%` ตัวสุดท้าย
- **บรรทัดสินค้า** = ขึ้นต้นด้วยตัวเลข ∧ มี `%` ∧ ไม่มีคำว่า `Total` ∧ ไม่มีคำว่า `Subtotal`
  (กัน `88 Bar Total 70 …` ถูกอ่านเป็นสินค้า)
- **Header**: DocDate = `Period From` (`MM/DD/YYYY` → ISO); `Period From ≠ Period To` → `REJECTED_MULTI_DAY`;
  Hotel Name จากหัวรายงาน; Source = `"Micros 3700 PDF - " + HotelName + " - " + OutletCode`;
  Description = `"Daily POS Sales Import - " + HotelName + " (" + DocDate + ")"`
- **Outlet**: จากหัวบล็อก `1 - Gold Teak` → Code = ก่อน ` - `, Desc = หลัง ` - ` (PDF เดียวหลาย Outlet)
- **Department**: จากบรรทัด Family Group Subtotal → Code = `"DEP-" + ชื่อ`, Desc1 = ชื่อ, Desc2 = ชื่อเดียวกัน
- **Item**: Code = Item Code (เช่น `10101`), Desc1 = ชื่อ, Desc2 = `""`
- **Sale**: หักกลบตาม Outlet + Item (Qty = ΣSales Qty, Total = ΣNet Sales); UnitPrice ตามกติกาเดียวกับ Simphony
  (ตัวอย่าง: 8 ชิ้น 1,699.20 → 212.40; 559 ชิ้น 0.00 → 0.00 ตัดสต็อกตามปกติ)
- **Footing**: |Σ ยอดสุทธิทุก Outlet − Grand Total ท้ายรายงาน| ≤ 0.05 THB ไม่งั้น `FORMAT_ERROR`
  (FRD ให้ตรวจยอดต่อ Outlet ด้วย — builder ตรวจเทียบบรรทัด `<Outlet> Total` ได้ถ้ารายงานมี)
- **ไม่ตรงเทมเพลต `MI_R001.RPT`** (หาหัวรายงาน/Period ไม่เจอ, ไม่มีบรรทัดสินค้าเลย) → `FORMAT_ERROR`
- **นำเข้าซ้ำ = ถามแล้วเขียนทับ ต่อ Outlet** (FRD §6.5): DocDate + BU + Store + Outlet มีอยู่แล้ว → แสดง dialog ต่อ Outlet;
  "เขียนทับ" = ยกเลิกชุดเดิมของ Outlet นั้น (ถ้ายืนยันตัดสต็อกไปแล้ว → **void Stock Out เดิมก่อน** — ถ้า void ไม่ได้
  เพราะงวดปิด ให้ล้มเฉพาะ Outlet นั้นพร้อมเหตุผล) แล้วบันทึกชุดใหม่เป็น "รอยืนยัน"; "ข้าม" = ไม่แตะ Outlet นั้น
  ไม่กระทบ Outlet อื่นในไฟล์เดียวกัน
- ไม่เก็บไฟล์ PDF; log เก็บเวลาประมวลผล (ms) ด้วย; เป้า ≤ 0.5 วิ ต่อไฟล์ 10–20 หน้า

## 5. รูปร่างของงาน

### 5.1 ข้อมูล (tenant schema — ชื่อเป็นข้อเสนอ builder ปรับได้)
- `tb_pos_store` — `brand` (`simphony`/`micros3700`), `store_key` (Store Number / Hotel Name), `store_name`; unique (brand, store_key)
- `tb_pos_outlet` — store_id, code, name, `location_id?` (1:1), unique (store, code)
- `tb_pos_department` — store_id, code, desc1, desc2
- `tb_pos_item` — store_id, code, desc1, desc2, `department_code?`, `recipe_id?`, (ตัวเลือก) `yield_variant_id?`
- master upsert ตาม code: ของใหม่เพิ่ม, ของเดิมอัปเดตชื่อ, ไม่ลบ
- `tb_pos_sale_import` — log ต่อไฟล์: brand, store_id, doc_date, source, file_name, detected_version, ingest_method
  (`manual`/`sftp`), total_records, total_sales_amount, processing_ms, status, warnings, error_message,
  `cancelled_at/by`, audit — การนำเข้าที่ถูกปฏิเสธก็เป็นแถวในนี้ (ไม่มีบรรทัด sale)
- `tb_pos_sale_line` — import_id, outlet_id, item_code, qty, unit_price, total (หลังหักกลบ), **`stock_out_id?`**
  (null = ยังไม่ตัด) — ตัวกันตัดซ้ำระดับบรรทัด
- สถานะต่อ (import, outlet) คำนวณจากบรรทัด: `รอยืนยัน` / `ยืนยันบางส่วน` / `ยืนยันครบ` / `ยกเลิก`
- config ใน `interface_pos_simphony`: `enabled`, `sftp_host`, `sftp_port` (22), `sftp_username`, `sftp_password`
  (**secret**), `remote_folder_path` (`/export/`), `file_pattern` (`GLExport_*.txt`), `schedule_time` (`03:00`)
- config ใน `interface_pos_micros3700`: `enabled` อย่างเดียว (ไม่มีการเชื่อมต่อ)

### 5.2 การคำนวณวัตถุดิบ (ใช้ทั้ง preview และตอนยืนยัน)
สำหรับบรรทัด sale ที่ Qty > 0, item ผูก recipe (active) แล้ว และ outlet ผูก location แล้ว:
- ปริมาณต่อ ingredient = Qty × (ingredient.qty ÷ recipe.base_yield) × (1 + wastage%/100) → หน่วยคลังด้วย
  `conversion_factor` / `inventory_unit_id`
- sub-recipe → แตกต่อ recursive จนถึง product (กันวนซ้ำ)
- รวมต่อ product ต่อ Outlet → บรรทัด Stock Out

### 5.3 การยืนยัน (ต่อ Outlet)
1. ปุ่มยืนยันของ Outlet ปิดเมื่อ: ไม่ได้ผูก location, ไม่มีบรรทัดพร้อมตัด, DocDate ไม่อยู่ในงวดที่เปิด, หรือการนำเข้าถูกยกเลิก
2. กดแล้ว BE ใน transaction เดียว: lock บรรทัดที่ `stock_out_id IS NULL` และพร้อมตัด → คำนวณ → สร้าง Stock Out
   (location ของ Outlet, `so_date` = DocDate, adjustment type "POS Sale", อ้าง import + outlet) → commit ผ่าน service เดิม
   → set `stock_out_id` ให้บรรทัด
3. ของไม่พอแม้ตัวเดียว → ล้มทั้งใบ คืนรายการสินค้าที่ขาด (ต้องการ / คงเหลือ ณ DocDate)
4. ผูก recipe/location ทีหลังแล้วยืนยันอีก → ใบใหม่เฉพาะบรรทัดที่ยังไม่ตัด
5. กดซ้ำ / สองคนกดพร้อมกัน → ไม่เกิดใบที่สอง

### 5.4 การนำเข้า
- **Simphony อัปโหลด**: FE ส่งไฟล์ .txt (multipart) → gateway → micro-business parse + ตรวจ + บันทึก → คืนสถานะ + สรุป + คำเตือน
- **Simphony SFTP**: `micro-cronjobs` executor ใหม่แบบ `gl_run_due` ยิง `POST /api/internal/pos/simphony/pull` ต่อ BU ทุกชั่วโมง;
  BE เช็ก `enabled` + ถึงเวลา → ต่อ SFTP → ดึงไฟล์ตาม pattern ที่ยังไม่เคยนำเข้า (ชื่อไฟล์ + กติกา duplicate) → parse ทีละไฟล์
  (ไฟล์หนึ่งพังไม่หยุดไฟล์อื่น) — ไม่ลบ/ย้ายไฟล์บน SFTP (builder ตัดสินได้)
- **Micros 3700 อัปโหลด**: FE อ่าน PDF ด้วย pdf.js → แสดงสรุปต่อ Outlet (จำนวนรายการ, ชิ้น, ยอด) + footing → ส่ง JSON ขึ้น BE;
  BE ตอบ Outlet ที่ซ้ำ → FE แสดง dialog เขียนทับ/ข้ามต่อ Outlet → ส่งคำตอบ → BE บันทึก
- **ไม่ตัดสต็อกในขั้นนำเข้าเลย**

### 5.5 หน้าจอ (FE)
ใต้ `/system-admin/interface/pos/<brand>` (`simphony`, `micros3700`):
1. **ตั้งค่า** — Simphony: ฟอร์ม SFTP (secret แสดงเป็น mask); Micros 3700: เปิด/ปิด — ทั้งคู่มีปุ่มอัปโหลด
2. **ประวัติการนำเข้า** — วันขาย, ร้าน, Source, ไฟล์, ช่องทาง, สถานะ (+คำเตือน version), บรรทัด, ยอดขาย, สถานะการยืนยัน,
   ปุ่มยกเลิก (เมื่อยังไม่ยืนยัน)
3. **ตรวจและยืนยัน** — ตาม mockup ที่ user ดูแล้ว: หัว (วันขาย · Source · ไฟล์ · version · ยอด) → การ์ดสรุป (Outlet ค้างผูก,
   เมนูค้างผูก, วัตถุดิบ/มูลค่า/สต็อกไม่พอ) → แท็บ ยอดขาย / วัตถุดิบที่จะตัด (แยกตาม Outlet → location, คงเหลือ ณ DocDate,
   ขาดไฮไลต์) / ค้างผูก; ปุ่มยืนยันต่อ Outlet + ลิงก์ Stock Out ที่ออกแล้ว
4. **ผูก Outlet** — ร้าน, Outlet → dropdown location; กรองตามร้าน
5. **ผูกเมนู** — ร้าน, POS Item → recipe (lazy lookup, ไม่ใช้ `perpage=-1`); กรอง "ยังไม่ผูก"
หน้า 2–5 ใช้ร่วมกันทุกแบรนด์ ต่างแค่หน้า 1 และขั้นอัปโหลด

ใช้ของกลาง (`DataGrid`, `ListToolbar`, `SettingSection`, status token) ตาม `docs/DESIGN.md`; ข้อความผ่าน i18n
(ห้าม `{}` ในไฟล์แปล); อ่านออกทั้ง light/dark; ปุ่มหลักหนึ่งปุ่มต่อหน้า (ปุ่มยืนยันต่อ Outlet เป็นปุ่มรอง หรือ builder จัดให้ไม่ชนกฎ)

### 5.6 สิทธิ์
- อ่าน/ตั้งค่า/อัปโหลด/ผูก/ยกเลิกการนำเข้า: สิทธิ์ของหน้า Interface เดิม
- **ยืนยันตัดสต็อก / เขียนทับที่ต้อง void**: ต้องมีสิทธิ์สร้าง/void Stock Out ด้วย — ตรวจคีย์ permission กับ DB จริง
- license: ใต้ feature `interface` ทั้งหมด

## 6. การทดสอบรับงาน
Simphony TC-BL-001 … 008 ผ่าน **ยกเว้น TC-BL-000** ซึ่งเปลี่ยนเป็น: ไฟล์ version 1.00 → SUCCESS พร้อมคำเตือน
Micros TC-MIC-001 … 008 ผ่าน (TC-MIC-005 ตามกติกาเขียนทับ §4.4) และ:
- ไฟล์ตัวอย่างจริงทั้งหมด (`symphony/20260918/*.txt`, `Viewer20–30.pdf`) นำเข้าได้ ยอดตรง
- ยืนยัน Outlet → Stock Out 1 ใบ, location ถูก, วันที่ = DocDate, ยอดตามสูตร (รวม sub-recipe + wastage)
- ยืนยันซ้ำ / พร้อมกัน → ไม่เกิดใบที่สอง
- เมนูค้างผูก → ยืนยันได้เฉพาะที่ผูก; ผูกแล้วยืนยันอีก → ใบที่สองมีแค่เมนูนั้น
- ของไม่พอ → ไม่มีใบเกิด, บอกสินค้าที่ขาด
- DocDate นอกงวดที่เปิด → ยืนยันไม่ได้
- void ใบ POS → บรรทัดกลับเป็นยังไม่ตัด
- ยกเลิกการนำเข้า → นำเข้าไฟล์เดิมใหม่ได้
- บรรทัดติดลบหักกลบถูก; ยอดสุทธิติดลบไม่ถูกตัด
- Micros เขียนทับ Outlet ที่ยืนยันแล้ว → Stock Out เดิมถูก void, ชุดใหม่รอยืนยัน
- รหัส SFTP ไม่ออกมาใน GET; PDF ไม่ถูกส่งขึ้นเซิร์ฟเวอร์

ขั้นทำตามแผนไม่เขียน test ใหม่ (ความต้องการของ user) — ตรวจด้วย typecheck/lint + curl + เบราว์เซอร์;
ยกเว้นตัวอ่านไฟล์สองตัวที่ builder อาจเสนอ fixture test จากไฟล์ตัวอย่าง — ต้องถาม user ก่อน

## 7. ลำดับงานและ deploy (ข้อเสนอ)
1. BE แกนกลาง: migration ตาราง POS + seed "POS Sale" + endpoint ประวัติ/master/ผูก/ยกเลิก
2. BE Simphony: parser + อัปโหลด
3. BE ตรวจและยืนยัน: preview + ยืนยันต่อ Outlet + hook ตอน void
4. FE: ย้ายแบรนด์ (`simphony`, `micros3700`) + ตั้งค่า/อัปโหลด Simphony → ประวัติ → ผูก → ตรวจและยืนยัน
5. Micros 3700: ตัวอ่าน PDF ใน FE (pdf.js ใน bundle) + endpoint รับ JSON + เขียนทับ
6. SFTP: BE pull + internal endpoint; `micro-cronjobs` executor + job
7. error catalog + allowlist api_name ใหม่ + license catalog (แบรนด์ใหม่) ในช่วงที่ใช้

deploy: migration → BE (+catalog/allowlist/license catalog, `SECRET_ENCRYPTION_KEY`) → micro-cronjobs → FE

## 8. ที่เหลือให้ builder ตัดสิน
- ชื่อตาราง/endpoint/คอลัมน์จริง; อ้าง import/outlet จาก Stock Out ด้วย FK หรือ `info` JSON
- ไลบรารี SFTP ฝั่ง Node; จัดการไฟล์บน SFTP หลังดึง
- โครงหน้าจอ (แท็บในหน้าแบรนด์หรือหน้าย่อย) ตราบที่อยู่ใต้แบรนด์และทำตาม design system
- การเลือก yield variant ของ recipe (ค่าเริ่มต้น = `default_variant_id` / base_yield)
- รายละเอียดการหาหัวรายงาน/Hotel Name/Family Group ใน PDF — ดู POC และ PDF ตัวอย่าง
