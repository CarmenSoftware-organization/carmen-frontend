# Dimension ของบรรทัด PR · PO · GRN · SR · IA ตามบัญชีจากผังการผูกบัญชี (Post to GL mapping)

สถานะ: ออกแบบแล้ว รออนุมัติ · 2026-11-20
แทนที่ backlog `2026-11-17-line-dimension-by-product-account-design.md` (ตอบคำถามที่ค้างไว้ครบทั้ง PR/PO/GRN/SR/IA)
และ**ยกเลิก** env `LINE_DIMENSIONS_ENABLED` จาก `2026-11-17-hide-line-dimensions-design.md` (user สั่ง 2026-11-20)
รีโป: `carmen-turborepo-backend` (micro-business + backend-gateway) และ `carmen-frontend`

## เจตนา

ตอนนี้บรรทัดของ PR, PO, GRN, SR และ IA แสดง dimension ที่ active **ทุกตัว** ของ BU (`components/dimension/line-dimension-fields.tsx` / popover)
ผู้ใช้จึงเห็นช่องที่ไม่เกี่ยวกับบัญชีของบรรทัดนั้น และไม่รู้ว่าต้องกรอกช่องไหน ส่วนตอนลงบัญชี (JV/AP) ระบบตรวจตามกฎผังบัญชี
ข้อมูลที่ขาดจึงเพิ่งมาเจอปัญหาตอนท้ายสาย

สิ่งที่ต้องการ:
1. แต่ละบรรทัดแสดงเฉพาะ dimension ที่**บัญชีของบรรทัดนั้น**อนุญาตตามกฎ (`tb_gl_account_dimension_rule`: แสดง mandatory และ optional, ไม่แสดง prohibited) แบบเดียวกับที่ AR, AP และ JV ทำอยู่
2. บัญชีของบรรทัดได้มาจาก**ผังการผูกบัญชีฝั่ง GL (Post to GL mapping)** ซึ่งรวม mapping ตาม adjustment type ด้วย
3. ใบ draft กด Save ได้เสมอแม้ dimension ยังไม่ครบ
4. ตอนเอกสารพ้น draft และก่อนลงบัญชี ต้องตรวจว่า dimension ที่บัญชีบังคับมีครบ และไม่มี dimension ที่บัญชีห้ามใช้ ตรวจทั้ง FE และ BE
5. แต่ละ BU เลือกเองว่าจะเริ่มใช้ dimension ที่เอกสารไหน
6. หน้าตาของช่อง dimension เหมือนกับใน JV

## เป้าหมาย / ไม่ใช่เป้าหมาย / ต่อต้าน

**เป้าหมาย**: ข้อ 1–6 ข้างบน ครบ 5 ชนิดเอกสาร คือ PR, PO, GRN, SR และ IA (stock-in / stock-out)

**ไม่ใช่เป้าหมาย**
- ไม่บันทึกบัญชีที่หาได้ลงในบรรทัด คำนวณสดทุกครั้ง
- ไม่เปลี่ยนกติกาของ JV/AP/AR ตอนลงบัญชี (ส่วน JV แก้แค่ UI ให้ใช้ component กลาง)
- ไม่แก้ปัญหาที่ BU ตั้ง config เป็นปิด แต่บัญชีบังคับ dimension แล้วไปติดที่ JV (เป็นพฤติกรรมเดิม)

**ต่อต้าน (ถ้าเกิดข้อใดข้อหนึ่งถือว่าล้มเหลว แม้ระบบจะทำงานได้)**
- Save ใบ draft ไม่ผ่านเพราะ dimension
- FE บอกว่าครบ แต่ BE ตอบว่าขาด หรือกลับกัน (กติกาเพี้ยนกันสองที่)
- บรรทัดที่หาบัญชีไม่ได้ทำให้ submit ไม่ผ่าน (ปัญหา mapping ไม่ครบเป็นของฝ่ายตั้งค่า ไม่ใช่ของคนเปิดเอกสาร)
- ค่าที่ผู้ใช้กรอกไว้หายไปเงียบ ๆ เมื่อเปลี่ยนสินค้าหรือ location
- deploy แล้ว BU ที่ไม่ได้เปิด config เห็นช่อง dimension หรือโดนบังคับ

## แนวทางที่พิจารณา

1. **Endpoint ใหม่ของ BE + ฟังก์ชันกลาง** ← **เลือกทางนี้** (user เลือก)
   BE หาบัญชีและกฎให้ทั้ง FE และตัวตรวจ กติกาจึงอยู่ที่เดียว
   ข้อเสีย: ต้องมี endpoint ใหม่ และต้องเพิ่ม allowlist ใน gateway
2. **FE คำนวณบัญชีเอง** — ตัดทิ้ง
   resolver จะมีสองชุดที่ต้องดูแลให้ตรงกัน และ FE ต้องรู้ลำดับชั้นหมวดหมู่ของสินค้าทุกตัว
3. **แนบกฎมากับ response ของ detail** — ตัดทิ้ง
   บรรทัดใหม่หรือบรรทัดที่เปลี่ยนสินค้ายังต้องถามแยก สุดท้ายจึงต้องมีทางที่ 1 อยู่ดี

UI: แยกแถบชิปของ JV ออกมาเป็น component กลาง แล้วให้ทุกเอกสารรวมถึง JV ใช้ร่วมกัน (user เลือก) ไม่ลอกแบบไปทำแยกในแต่ละโมดูล

## บัญชีของบรรทัด (mapping ฝั่ง GL)

resolver เดิม `resolveAccountMapping()` (`micro-business/src/master/account-mapping/account-mapping.resolver.ts`) เป็นฟังก์ชันล้วน
- movement `grn` / `sr_in` / `sr_out`: ใช้ค่าที่แก้ทับ → item group → sub-category → category โดยเลือก inventory หรือ direct ตาม `location_type`
- movement `adjustment`: ใช้บัญชีในแถว mapping (location × item group × adjustment type) อย่างเดียว ไม่ย้อนไปหาบัญชีตามหมวดสินค้า และบัญชีที่ได้เป็นบัญชีฝั่งตรงข้ามกับสต๊อก ถ้าแถวไม่มีค่าจะได้ `missing_adjustment_account`
- consignment → `skip`

| เอกสาร | location | movement | บัญชีที่ใช้ |
|---|---|---|---|
| PR | `tb_purchase_request_detail.location_id` (null ได้) | `grn` | บัญชีที่ GRN จะลงจริง (user เลือก) ค่าที่กรอกตั้งแต่ PR จึงตรงกับตอนลงบัญชี |
| PO | location ของแถว junction `tb_purchase_order_detail_tb_purchase_request_detail` (ทั้ง PO จาก PR และ PO manual) | `grn` | เหมือน PR |
| GRN | `location_id` ของบรรทัด | `grn` | |
| IA stock-in / stock-out | `location_id` ของหัวใบ + `adjustment_type_id` ของหัวใบ | `adjustment` | user สั่งให้ใช้ mapping ตาม adjustment type |
| SR | `from_location_id` (`sr_out`) **และ** `to_location_id` (`sr_in`) ของหัวใบ | `sr_out` + `sr_in` | **รวมกฎของสองบัญชี** (user เลือก) ดูข้างล่าง |

**การรวมกฎหลายบัญชี** (ใช้กับ SR และ PO เก่าที่บังเอิญมีหลาย location ในบรรทัดเดียว):
- แสดงถ้ามีบัญชีใดอนุญาต
- บังคับถ้ามีบัญชีใดบังคับ
- ห้ามใช้ถ้ามีบัญชีใดห้าม
- ถ้าบัญชีหนึ่งบังคับแต่อีกบัญชีห้ามใช้ ถือว่า**ตั้งค่าขัดกัน** ให้ส่ง `status: "conflict"` แล้ว FE แสดงข้อความว่า mapping หรือกฎขัดกัน ส่วน BE ตอบ 422 เป็น error ของการตั้งค่า (ใช้ค่าใดก็ผ่าน JV ไม่ได้)
- เหตุผลที่ SR ต้องรวม: SR ออก JV สองฝั่งด้วย dimension ชุดเดียวกัน ทั้งสองฝั่งจึงต้องผ่านตัวตรวจ

**PO แยกบรรทัดตามค่าของ dimension ด้วย** (user ย้ำ: ห้องอาหารสั่งน้ำให้ project งานแต่งกับ project งานบวช ต้องเป็นคนละบรรทัด)
- PO แยกตามลำดับ vendor → currency → delivery date → product → location → dimension
- โค้ดทำอยู่แล้ว: `buildPoGroupKey` แยกใบ และ `buildPoLineMergeKey` แยกบรรทัด + `buildDimensionSignature()` ใช้คีย์ `dimension_id=v:<dimension_value_id>` (ค่าแบบ typed ใช้รหัสที่ normalize แล้ว)
- บรรทัด PO หนึ่งบรรทัดจึงมี location เดียวและ dimension ชุดเดียว และ GRN คัด dimension จากบรรทัด PO มาทีละบรรทัด
- **ห้ามทำให้พัง**: default ต้องถูกเติมและบันทึกลงบรรทัด PR ตอน submit ก่อนแปลงเป็น PO มิฉะนั้นบรรทัดที่ว่างกับบรรทัดที่ได้ default ซึ่งเป็นค่าเดียวกัน จะแยกเป็นคนละบรรทัด

## Config ระดับ BU (user สั่ง 2026-11-20)

เก็บใน `config` ของ business unit และเพิ่มในหน้า `/system-admin/default-setting` ด้วย skill `add-business-setting-config` (แก้ registry กับ i18n ไม่ต้องแก้ component)
ฝั่ง BE อ่านแบบเดียวกับ `po.group-by-pr-comment` (`PO_GROUP_BY_PR_COMMENT_KEY` ใน `purchase-order.service.ts`)

**`dimension.start-from`** (enum) ใช้กับสายซื้อ

| ค่า | PR | PO | GRN |
|---|---|---|---|
| `none` (default เมื่อไม่ได้ตั้ง) | – | – | – |
| `pr` (ทั้งหมด) | ✓ | ✓ | ✓ |
| `po` | – | ✓ | ✓ |
| `grn` | – | – | ✓ |

**`dimension.sr.enabled`** และ **`dimension.ia.enabled`** (boolean, default `false`) เพราะ SR และ IA เป็นเอกสารที่เริ่มต้นเอง ไม่อยู่ในสายซื้อ

✓ / true = แสดงแถบชิปและตรวจที่จุดตรวจของเอกสารนั้น · – / false = ไม่แสดง ไม่ตรวจ และไม่เรียก endpoint กฎ

- **ลบ env `LINE_DIMENSIONS_ENABLED` ทิ้ง** (user สั่ง) config ระดับ BU เป็นสวิตช์เดียว ทั้ง FE และ BE ใช้ค่าเดียวกัน
  - แก้ `lib/runtime-config.ts`, `hooks/use-line-dimensions-enabled.ts`, `public/config.sample.json` และ `docs/deploy.md`
  - เดิม env ตัวนี้ซ่อน dimension ของทั้ง 5 เอกสาร ตอนนี้ทั้ง 5 ใช้ config ของ BU แทน ค่า default ปิดทั้งหมด จึงไม่มี BU ไหนเห็นอะไรเปลี่ยนหลัง deploy
  - `useLineDimensionsEnabled()` เปลี่ยนเป็นรับชนิดเอกสาร (`pr|po|grn|sr|ia`) แล้วดูจาก license (`configuration.dimension`) + config ของ BU + มี dimension active อย่างน้อยหนึ่งตัว
  - BE ไม่ต้องอ่าน license เพราะถ้า BU ไม่มี license ก็ไม่มี dimension active ให้บังคับอยู่แล้ว
  - learning เรื่องซ่อน dimension ด้วย env (2026-11-17) จะล้าสมัย ให้บันทึก learning ใหม่แทนตอนทำงานจริง
- **ระดับที่ปิดไม่ส่ง dimension ต่อ**:
  - `confirmPrToPo()` คัด dimension ของ PR และใช้ใน merge key เฉพาะเมื่อตั้งเป็น `pr`
  - GRN คัดจาก PO เฉพาะเมื่อตั้งเป็น `pr` หรือ `po`
  - เหตุผล: ถ้าคัดค่าที่ค้างอยู่ไปด้วย บรรทัดจะถูกแยกด้วยค่าที่ผู้ใช้มองไม่เห็น
- **เปลี่ยนค่ากลางทาง**: ใช้ค่า ณ ตอนที่ถึงจุดตรวจเสมอ เหมือนกฎผังบัญชี

## จุดตรวจ (ตรวจในโค้ด 2026-11-20)

ทุกทางที่ทำให้เอกสารพ้น draft และทุกจุดที่ลงบัญชีต้องเรียกตัวตรวจ (เมื่อ config ของเอกสารนั้นเปิดอยู่):

| เอกสาร | ทาง | ตรวจที่ |
|---|---|---|
| PR | draft → `submit()` รวมการ submit ซ้ำหลังถูกส่งกลับ (in_progress + last_action = reviewed) | `PurchaseRequestService.submit()` |
| PO manual | `create()` → draft → `submit()` | `PurchaseOrderService.submit()` |
| PO จาก PR | `confirmPrToPo()` สร้างใบเป็น **in_progress ทันที** ไม่ผ่าน `submit()` | `confirmPrToPo()` ถ้าไม่ผ่าน ไม่สร้าง PO ใดเลยทั้งชุด |
| GRN (manual และจาก PO) | `create()` → draft → `save()` → saved (ได้เลขจริง) | `GoodReceivedNoteLogic.save()` |
| GRN | saved → `commit()` / `approve()` → committed (ลงสต๊อก ออก JV และ AP ผ่าน `postReceipt`) | **ตรวจซ้ำ** (user เลือก) ดู §GRN ด่านสุดท้าย |
| SR | draft → `submit()` | `StoreRequisitionService.submit()` |
| SR | `approve()` ขั้นที่ตัดสต๊อกและลงบัญชี | **ตรวจซ้ำ** ก่อนตัดสต๊อก (builder หาให้แน่ว่า approve ขั้นไหนเป็นขั้นที่ลงบัญชี) |
| IA stock-in / stock-out | draft → `commit()` (ลงสต๊อกและออก JV) | `StockInService.commit()` / `StockOutService.commit()` |

- PO manual, GRN manual, SR และ IA ไม่มีเอกสารต้นทาง ผู้ใช้จึงกรอก dimension ครั้งแรกที่ตัวเอกสารนั้นเลย
- จุดตรวจทุกจุดใช้**กฎปัจจุบันและ mapping ปัจจุบัน** PO ที่มาจาก PR ซึ่งผ่านแล้วอาจไม่ผ่าน ถ้ากฎถูกแก้ระหว่างทาง (user ยอมรับ)
- ห้ามตรวจตอน save draft และห้ามตรวจตอน update ที่ไม่ได้เปลี่ยนสถานะ

### GRN ด่านสุดท้ายก่อนลง JV (user สั่ง 2026-11-20)

- ตอน `commit()` / `approve()` หาบัญชีใหม่จาก mapping ปัจจุบัน แล้วตรวจกับกฎปัจจุบัน ห้ามใช้ผลที่ได้ตอน `save()` ทำใน transaction เดียวกันก่อน `postReceipt` ถ้าไม่ผ่าน จะไม่ลงสต๊อก ไม่ออก JV และไม่สร้าง AP
- **คนบันทึก GRN แก้ dimension ได้เสมอ**ตราบที่ใบยังไม่ committed ทั้งใบ draft และใบ saved แม้ค่าจะคัดมาจาก PO ก็ไม่ล็อก
  - BE รองรับอยู่แล้ว: `update()` ของใบ saved ผ่าน `planLineDimensions` ได้
  - ใบ committed แก้ได้แค่หัวใบตามเดิม
- เมื่อ commit ไม่ผ่านเพราะ dimension ให้ FE เปิดโหมดแก้ไขค้างไว้และทำชิปที่ผิดเป็นสีแดง ผู้ใช้แก้ กด Save แล้วกด commit ใหม่ได้ในหน้าเดิม ไม่ต้องย้อนไปแก้ PO
- SR ที่ approve ขั้นลงบัญชีไม่ผ่าน: ผู้อนุมัติแก้ dimension ในขั้นนั้นไม่ได้ (payload ของ approve/issue รับแค่จำนวนและสถานะ `store-requisition.detail.dto.ts:41-67`) **user เลือก 2026-11-20 ให้ส่งกลับหรือ reject ให้ผู้ขอแก้แล้ว submit ใหม่** ไม่ขยาย payload ของ approve

## การออกแบบ BE

### ฟังก์ชันกลาง `resolveLineDimensionRules`

วางข้าง resolver หรือใน `master/dimension/line-dimension/` (builder เลือก)
- รับรายการบรรทัด `{ key, doc_type: "pr"|"po"|"grn"|"sr"|"ia", product_id, location_id?, to_location_id?, adjustment_type_id? }` และ prisma client หรือ tx
  - SR ส่ง `location_id` = from และ `to_location_id` = to
  - IA ส่ง `adjustment_type_id`
- คืนต่อบรรทัด:
  ```ts
  {
    key: string;
    status: "resolved" | "no_account" | "skipped" | "conflict";
    accounts: { chart_of_accounts_id: string | null; account_code: string | null; movement: string;
                source: string | null; issue: string | null; location_id: string;
                item_group_id: string | null; adjustment_type_id: string | null;
                account_mapping_id: string | null }[];   // ใช้กับ chip ที่มาของบัญชีบน dev ด้วย
    rules: { dimension_id: string; requirement: "mandatory" | "optional" | "prohibited";
             default_value: IDimensionRef | null }[];   // รวมแล้วตาม §การรวมกฎหลายบัญชี
  }
  ```
- อ่าน location, สินค้า (item group → sub-category → category) และแถว `tb_account_mapping` (mapping_type = GL ตาม movement และ adjustment type) เป็นชุด ห้ามยิง query ทีละบรรทัด แล้วเรียก `resolveAccountMapping()` แปลงรหัสบัญชีเป็น id ของผังบัญชี และอ่านกฎของบัญชีนั้น
- ไม่มี location หรือสินค้า, resolver มี `issue`, หรือรหัสบัญชีไม่มีในผังบัญชี → `no_account`
- consignment → `skipped`
- SR ที่ฝั่งหนึ่งหาบัญชีได้แต่อีกฝั่งหาไม่ได้: ใช้เฉพาะฝั่งที่หาได้

### endpoint สำหรับ FE

`POST /api/:bu_code/line-dimension-rules`
- body: `{ lines: [...] }` (รูปเดียวกับ input ของฟังก์ชันกลาง) ตอบ `{ data: [...] }`
- เป็นการอ่านอย่างเดียว ใช้ POST เพราะส่งได้หลายบรรทัด
- ต้องเพิ่ม api_name ใหม่ใน **allowlist** ของทุก app id ที่ไม่ allow_all **ก่อน deploy FE** มิฉะนั้น user จะโดน 401 แล้วเด้งออกจากระบบ (เคยเกิดมาแล้ว)
- สิทธิ์: user ที่เปิดเอกสารชนิดนั้นได้ต้องเรียก endpoint นี้ได้ ไม่ต้องใช้สิทธิ์ config วางที่ gateway แล้วส่ง RPC ไป micro-business (builder เลือก guard ที่เหมาะกับการใช้ข้ามโมดูล)

### ลำดับการตรวจในจุดตรวจ

ทำใน transaction เดียวกับการเปลี่ยนสถานะหรือการลงบัญชี:
1. ถ้า config ของเอกสารนั้นปิด → ข้ามทั้งหมด
2. เรียกฟังก์ชันกลางกับทุกบรรทัดที่ยังมีชีวิต (`deleted_at` เป็น null)
3. บรรทัด `no_account` / `skipped` → ข้าม · `conflict` → 422 error การตั้งค่า
4. บรรทัด `resolved`:
   - **เติม default ก่อน** ด้วย `applyMandatoryDimensionDefaults()` แล้วบันทึกลง `*_dimension` ของบรรทัด
   - จากนั้นตรวจด้วย `validateLineDimensions()` ทีละบัญชีของบรรทัด (SR มี 2 บัญชี)
   - `onDate`: PR = `pr_date` · PO = `po_date` · GRN = `grn_date` · SR / IA = วันที่เอกสารของตัวเอง
5. ไม่ผ่าน → rollback แล้วตอบ **422** ด้วย error catalog ใหม่ (`Result.errorFromCatalog` เช่น `LINE_DIMENSION_REQUIRED` / `LINE_DIMENSION_PROHIBITED` / `LINE_DIMENSION_RULE_CONFLICT`) พร้อมบอกบรรทัด (sequence_no หรือ detail id) และ dimension และเติม `errors.byCode.<CODE>` ใน messages ของ FE
   - คืน violation แรกเหมือน JV/AP (FE นับบรรทัดที่ผิดเองก่อนส่ง)
   - ช่อง mandatory ที่ไม่มีทั้งค่าและ default → 422

## การออกแบบ FE

### ข้อมูล

- hook `useLineDimensionRules(docType, lines)` เรียก endpoint ด้วย TanStack Query
  - query key มาจากชุด input ของบรรทัดที่ไม่ซ้ำกัน
  - เปลี่ยนสินค้า, location หรือ adjustment type แล้วต้องดึงกฎใหม่
  - ใช้ข้าม 3 โมดูล (procurement, store-operation, inventory-management) จึงวางใน `hooks/`
- ย้าย `visibleLineDimensions()` จาก `routes/accounting/documents/journal-line-dimensions.ts` ไป `lib/` (ติดกฎ module boundary ของ ESLint) แล้วเพิ่ม overload ที่รับ `rules` ที่ BE รวมมาแล้ว
- ช่องของบรรทัด:
  - `resolved` → แสดงตาม `visibleLineDimensions()` และค่าที่บันทึกไว้แล้วยังแสดงอยู่แม้กฎจะเปลี่ยน
  - `no_account` / `skipped` → ไม่แสดง ยกเว้นบรรทัดที่มีค่าบันทึกไว้แล้ว
  - `conflict` → ข้อความว่าการตั้งค่าบัญชีขัดกัน
  - โหลดไม่สำเร็จ → ข้อความ error พร้อมปุ่มลองใหม่ ไม่ล้างค่า
- **ค่า default**: เมื่อกฎมาถึงและช่อง mandatory ยังว่าง FE เติม default ให้เห็นและแก้ได้ แล้วตั้ง `dimensions_dirty` ให้ payload ส่งค่าไป (*การตัดสินใจของผม*: BE เติมซ้ำตอนตรวจอยู่แล้ว ฝั่ง FE ทำเพื่อให้ผู้ใช้เห็นค่าก่อน)

### หน้าตา = แบบเดียวกับ JV (user สั่ง)

แยกแถบชิป dimension ของ JV (`routes/accounting/documents/accounting-document-detail.tsx` แถวย่อย `colSpan` ใต้แต่ละบรรทัด) ออกมาเป็น `components/dimension/line-dimension-strip.tsx` แล้วให้ **PR, PO, GRN, SR, IA และ JV ใช้ตัวเดียวกัน**

```
│ 1 │ น้ำดื่ม 600ml · ห้องอาหาร │ 24 ขวด │ ...          │
│   │ [DEPT*: F&B ▾] [PRJ*: WED-01 ▾] [EVT: 2026-11-30 📅]  ⧉ │
```

- **แก้ไขได้**: แบบ lookup เป็น `Select` ขนาด xs มีป้าย `CODE:` นำหน้า ตัวเลือกแรกคือ "ล้างค่า" ส่วนแบบ typed ใช้ `DimensionValueInput` ขนาด xs
- **ดูอย่างเดียว**: ชิป `CODE: ค่า` กดแล้วเปิด dialog "All Dimensions" (`รหัส — ชื่อ`) ย้าย dialog นี้เข้าไปใน component กลางด้วย
- **ของที่เพิ่มใหม่** (JV ได้ไปด้วย): ช่อง mandatory ติด `*` และชิปที่ตรวจไม่ผ่านเป็นสีแดง (`aria-invalid`)
- props ขั้นต่ำ: dimension ที่มองเห็น, ชุด id ที่บังคับ, ชุด id ที่ผิด, `value`, `onChange`, `readOnly`
- **chip บอกที่มาของบัญชี เฉพาะ `APP_ENV = dev`** (user สั่ง 2026-11-20, ใช้ `isDevAppEnv()` ใน `lib/runtime-config.ts` ถ้าไม่ได้ตั้งถือว่าไม่ใช่ dev production จึงไม่เห็น)
  - อยู่ต้นแถบชิป หน้าตาต่างจากชิป dimension ชัดเจน (เช่น outline สีจาง ฟอนต์ mono) และไม่รับ focus ตอนกรอก
  - `resolved`: แสดง `GL <movement>: <account_code> · <source>` เช่น `GL grn: 5101-01 · item_group` (SR แสดงสองชิป `sr_out` และ `sr_in`, IA ต่อท้ายด้วยรหัส adjustment type)
  - `no_account` / `skipped` / `conflict`: แสดงสถานะกับ `issue` เช่น `GL grn: — · missing_direct_account` หรือ `consignment`
  - กดชิปแล้วเปิดหน้า `/config/chart-of-account-mapping` ที่กรองไว้แล้วตาม location, item group, movement และ adjustment type ของบรรทัด (แท็บ GL) เพื่อให้ไปแก้ mapping ได้ทันที
  - ข้อความในชิปเป็นค่าดิบ ไม่ผ่าน i18n (เป็นเครื่องมือ dev แบบเดียวกับการโชว์ config key ใต้ป้ายในหน้า Default Setting)
  - ต้องขยาย response ของฟังก์ชันกลาง/endpoint: แต่ละรายการใน `accounts` เพิ่ม `source` (`override` | `item_group` | `sub_category` | `category`), `issue`, `location_id`, `item_group_id`, `adjustment_type_id` และ `account_mapping_id` (ถ้ามีแถว) BE ส่งเสมอไม่ขึ้นกับ env เพราะเป็นข้อมูลที่ไม่ลับ และหน้า mapping ก็เปิดให้ดูอยู่แล้ว
- ทุกเอกสารใช้แถวย่อยใต้บรรทัด GRN เลิกใช้ `LineDimensionPopover` และลบ `LineDimensionFields` กับ popover ทิ้งเมื่อไม่มีผู้เรียกเหลือ
- จอมือถือที่เป็นการ์ด (เช่น PR wizard): แถบชิปขึ้นบรรทัดใหม่ได้ (`flex-wrap`) และอยู่ท้ายการ์ด
- ข้อความภาษาอังกฤษที่ฝังไว้ใน JV (เช่น description ของ sheet) ให้ย้ายเข้า i18n ตอนแยก component
- `accounting-jv-edit-lines.test.tsx` ต้องผ่านเหมือนเดิม
- ต้องอ่านออกทั้ง light และ dark theme

### ตรวจก่อนส่ง

- ปุ่มที่พาเอกสารผ่านจุดตรวจ (Submit ของ PR/PO/SR, Save ที่ทำให้ GRN ออกจาก draft, commit/approve ของ GRN, approve ขั้นลงบัญชีของ SR, commit ของ IA) ต้องตรวจทุกบรรทัด `resolved` ก่อนส่ง:
  - ช่อง mandatory ที่**ไม่มี default** ต้องมีค่า
  - ต้องไม่มีค่าของ dimension ที่ prohibited
  - ไม่ผ่าน → ไม่ส่ง request, ขยายแถวและทำให้ชิปที่ผิดเป็นสีแดง แล้ว toast บอกจำนวนบรรทัดที่ผิด
- ถ้า BE ตอบ 422 ด้วย catalog ใหม่ ให้แสดงข้อความแปลที่ระบุบรรทัดและ dimension (กันกรณีกฎเปลี่ยนระหว่างที่หน้าเปิดค้างอยู่)
- Save ใบ draft ไม่เรียกตัวตรวจ
  - ระวัง: Save ของ PO draft ใช้ `draftSaveHandler` ซึ่งไม่ผ่าน zod ห้ามใส่การตรวจนี้ใน zod schema หลัก

## ลำดับ deploy / ข้อจำกัด

- ลำดับ: BE (micro-business + gateway) → allowlist api_name ใหม่ → FE → ตั้ง config ระดับ BU ที่ต้องการเปิด
  - FE ขึ้นก่อน BE = ได้ 404/401 และ user อาจโดน logout
- หลังลบ env แล้ว dimension ของทุกเอกสารจะปิดจนกว่าจะตั้ง config ของ BU รวมถึง BU บน dev ที่เคยเปิด env ไว้ทดสอบ ต้องตั้ง config ใหม่
- dev DB เป็นของกลาง ทดสอบ submit/commit จริงแล้วต้อง void ใบทดสอบทิ้ง

## สิ่งที่ปล่อยให้ builder ตัดสิน

- ตำแหน่งไฟล์ของฟังก์ชันกลางฝั่ง BE, ชื่อ error catalog และ guard ของ endpoint
- รูปแบบการไฮไลต์บรรทัดที่ผิดในแต่ละหน้า (ใช้ของที่แต่ละหน้ามีอยู่)
- การแบ่งงานเป็นหลาย PR (แนะนำ: BE ฟังก์ชันกลาง + endpoint → FE component กลาง + JV → สายซื้อ → SR/IA)
