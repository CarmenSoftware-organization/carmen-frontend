# Dimension ของบรรทัด PR · PO · GRN ตามบัญชีจากผังการผูกบัญชี

สถานะ: ออกแบบแล้ว รออนุมัติ · 2026-11-20
แทนที่ backlog `2026-11-17-line-dimension-by-product-account-design.md` (ตอบคำถามที่เปิดค้างไว้ในนั้นสำหรับ PR/PO/GRN; SR/IA ยังอยู่ใน backlog)
รีโป: `carmen-turborepo-backend` (micro-business + backend-gateway) และ `carmen-frontend`

## เจตนา

ตอนนี้บรรทัดของ PR, PO และ GRN แสดง dimension ที่ active **ทุกตัว** ของ BU (`components/dimension/line-dimension-fields.tsx`)
ผู้ใช้จึงเห็นช่องที่ไม่เกี่ยวกับบัญชีของบรรทัดนั้น และไม่รู้ว่าต้องกรอกช่องไหนบ้าง ส่วนตอนลงบัญชี (JV หรือ AP ที่สร้างจาก GRN) ระบบตรวจตามกฎผังบัญชี
ทำให้ข้อมูลที่ขาดเพิ่งมาเจอปัญหาตอนท้ายสาย

สิ่งที่ต้องการคือ:
1. ทุกบรรทัดแสดงเฉพาะ dimension ที่**บัญชีของบรรทัดนั้น**อนุญาตตามกฎ (`tb_gl_account_dimension_rule`: แสดง mandatory และ optional, ไม่แสดง prohibited) แบบเดียวกับที่ AR, AP และ JV ทำอยู่
2. ใบ draft กด Save ได้เสมอแม้ dimension ยังไม่ครบ
3. ตอนเอกสารออกจาก draft ต้องตรวจว่า dimension ที่บัญชีบังคับมีครบ และไม่มี dimension ที่บัญชีห้ามใช้ ตรวจทั้ง FE และ BE

## เป้าหมาย / ไม่ใช่เป้าหมาย / ต่อต้าน

**เป้าหมาย**
- บัญชีของบรรทัดหามาจาก**ผังการผูกบัญชี movement `grn` ฝั่ง GL** (location × item group ของสินค้า) ใช้ตัวเดียวกันทั้ง PR, PO และ GRN (user เลือก) dimension ที่กรอกตั้งแต่ PR จึงตรงกับที่ GRN จะลงบัญชีจริง
- ใช้จุดตรวจ 3 จุด (user เลือก):
  - PR `submit()` รวมทั้งการ submit ซ้ำหลังถูกส่งกลับ (in_progress + last_action = reviewed)
  - PO `submit()`
  - GRN ตอนเปลี่ยนสถานะจาก draft เป็น saved ผ่าน `GoodReceivedNoteLogic.save()` (จังหวะที่ใบได้เลขจริง)
  - ครอบคลุมทั้งเอกสารที่มาจากต้นทาง (PR → PO → GRN) และเอกสารที่สร้างเอง (PO manual, GRN manual) user ย้ำว่าต้องตรวจทั้งสองแบบ ดู §ทางออกจาก draft
- FE กับ BE ใช้กติกาจากที่เดียวกัน: endpoint ใหม่ของ BE กับตัวตรวจตอน submit เรียกฟังก์ชันกลางตัวเดียว

**ไม่ใช่เป้าหมาย**
- SR และ IA (stock-in/out) ยังไม่ทำในรอบนี้
- ไม่บันทึกบัญชีที่หาได้ลงในบรรทัด คำนวณสดทุกครั้ง
- ไม่เปลี่ยนสวิตช์ `LINE_DIMENSIONS_ENABLED` เมื่อสวิตช์ปิด FE ไม่แสดงอะไรเหมือนเดิม (ดูเรื่อง BE ใน §ข้อจำกัด)
- ไม่แก้หน้า AR, AP และ JV

**ต่อต้าน (ถ้าเกิดข้อใดข้อหนึ่งถือว่าล้มเหลว แม้ระบบจะทำงานได้)**
- Save ใบ draft ไม่ผ่านเพราะ dimension
- FE บอกว่าครบ แต่ BE ตอบว่าขาด หรือกลับกัน (กติกาเพี้ยนกันสองที่)
- บรรทัดที่หาบัญชีไม่ได้ทำให้ submit ไม่ผ่าน (ปัญหา mapping ไม่ครบเป็นของฝ่ายตั้งค่า ไม่ใช่ของคนเปิดเอกสาร)
- ค่าที่ผู้ใช้กรอกไว้หายไปเงียบ ๆ เมื่อเปลี่ยนสินค้าหรือ location

## ระบบตอนนี้ (ที่ต้องแตะ)

- **FE แสดงผล**: `routes/procurement/purchase-request/pr-item-dimensions.tsx` · `routes/procurement/purchase-order/po-item-cells/item-dimensions.tsx` · `routes/procurement/goods-receive-note/grn-item-cells/item-dimensions.tsx` ทั้งสามไฟล์ใช้ `LineDimensionFields` หรือ `LineDimensionPopover` ซึ่งแสดงทุกตัว และถูกครอบด้วย `useLineDimensionsEnabled()`
- **FE helper ที่ใช้ซ้ำได้**: `visibleLineDimensions()` ใน `routes/accounting/documents/journal-line-dimensions.ts` (ไฟล์นี้อยู่ใต้ `routes/accounting/` ถ้าจะใช้จาก `routes/procurement/` ต้องย้ายไป `lib/` หรือ `components/dimension/` เพราะติดกฎ module boundary ของ ESLint)
- **BE resolver ของบัญชี**: `resolveAccountMapping()` ใน `micro-business/src/master/account-mapping/account-mapping.resolver.ts` เป็นฟังก์ชันล้วน ลำดับการหาคือ ค่าที่แก้ทับ → item group → sub-category → category โดยเลือก inventory หรือ direct ตาม `location_type` ส่วน consignment ระบบจะ `skip`
- **BE ตัวตรวจ**: `validateLineDimensions()` ใน `gl/gl-dimension/gl-dimension.validator.ts` ซึ่ง JV, facade และ AP ใช้ร่วมกัน (คืน violation แรก) และ `applyMandatoryDimensionDefaults()` ใน `gl-dimension.defaults.ts` ซึ่งเติม default ของกฎ mandatory
- **BE จุดตรวจ**: `PurchaseRequestService.submit()` (`procurement/purchase-request/purchase-request.service.ts`) · `PurchaseOrderService.submit()` (`procurement/purchase-order/purchase-order.service.ts`) · `GoodReceivedNoteLogic.save()` / `commit()` / `approve()` (`inventory/good-received-note/good-received-note.logic.ts`) · `PurchaseOrderService.confirmPrToPo()`

## แนวทางที่พิจารณา

1. **Endpoint ใหม่ของ BE + ฟังก์ชันกลาง** ← **เลือกทางนี้** (user เลือก)
   BE หาบัญชีและกฎให้ทั้ง FE และตัวตรวจตอน submit กติกาจึงอยู่ที่เดียว
   ข้อเสีย: ต้องมี endpoint ใหม่ และต้องเพิ่ม allowlist ใน gateway
2. **FE คำนวณบัญชีเอง** — ตัดทิ้ง
   resolver จะมีสองชุดที่ต้องดูแลให้ตรงกัน และ FE ต้องรู้ลำดับชั้นหมวดหมู่ของทุกสินค้า ซึ่งขัดกับต่อต้านข้อ "กติกาเพี้ยนกันสองที่"
3. **แนบกฎมากับ response ของ detail** — ตัดทิ้ง
   ใช้ได้กับบรรทัดที่บันทึกแล้วเท่านั้น บรรทัดใหม่ยังต้องถามแยก สุดท้ายจึงต้องมีทางที่ 1 อยู่ดี

## การออกแบบ

### BE: ฟังก์ชันกลาง `resolveLineDimensionRules`

วางไว้ข้าง resolver หรือใน `master/dimension/line-dimension/` (ให้ builder เลือก)
- รับ: รายการ `{ key, location_id, product_id }` และ prisma client หรือ tx
- คืนต่อบรรทัด:
  ```ts
  {
    key: string;
    status: "resolved" | "no_account" | "skipped";   // skipped = consignment
    chart_of_accounts_id: string | null;
    account_code: string | null;
    rules: { dimension_id: string; requirement: "mandatory" | "optional" | "prohibited";
             default_value: IDimensionRef | null }[];
  }
  ```
- วิธีทำ: อ่าน location (type, cost center) กับสินค้า (item group → sub-category → category) และแถว `tb_account_mapping` ที่ mapping_type = GL, movement = grn ถ้ามี แล้วเรียก `resolveAccountMapping()` จากนั้นแปลงรหัสบัญชีเป็น id ของผังบัญชี แล้วอ่านกฎของบัญชีนั้น
- อ่านเป็นชุด (batch) ห้ามยิง query ทีละบรรทัด
- บรรทัดที่ไม่มี location หรือสินค้า หรือมีแต่ resolver หาบัญชีไม่ได้ (`issue` ไม่เป็น null) หรือรหัสบัญชีไม่มีในผังบัญชี → `no_account`

### BE: endpoint สำหรับ FE

`POST /api/:bu_code/line-dimension-rules`
- body: `{ lines: { key, location_id, product_id }[] }`
- ตอบ: `{ data: <ผลของฟังก์ชันกลาง>[] }`
- เป็นการอ่านอย่างเดียว ใช้ POST เพราะส่งได้หลายบรรทัด
- **ต้องเพิ่ม api_name นี้ใน allowlist ของทุก app id ที่ไม่ allow_all ก่อน deploy FE** มิฉะนั้น user จะโดน 401 แล้วเด้งออกจากระบบ (เคยเกิดมาแล้ว)
- สิทธิ์: user ที่เปิดเอกสาร PR/PO/GRN ได้ ต้องเรียก endpoint นี้ได้ ไม่ต้องใช้สิทธิ์ config

### BE: ตรวจที่ 3 จุด

ทำใน transaction เดียวกับการเปลี่ยนสถานะ ตามลำดับนี้:
1. เรียกฟังก์ชันกลางกับทุกบรรทัดที่ยังมีชีวิต (`deleted_at` เป็น null)
2. บรรทัด `no_account` / `skipped` → ข้าม ไม่ตรวจ
3. บรรทัด `resolved` → **เติม default ก่อน** ด้วย `applyMandatoryDimensionDefaults()` แล้วบันทึกค่าที่เติมลง `*_dimension` ของบรรทัด จากนั้นตรวจด้วย `validateLineDimensions()` (ใช้วันที่ของเอกสารเป็น `onDate`)
4. ไม่ผ่าน → rollback แล้วตอบ **422** ด้วย error catalog ใหม่ (เช่น `LINE_DIMENSION_REQUIRED` / `LINE_DIMENSION_PROHIBITED`) โดยบอกให้รู้ว่าเป็นบรรทัดไหน (sequence_no หรือ detail id) และ dimension ไหน ต้องเพิ่ม key แปลใน FE error catalog ด้วย

- จุดตรวจทั้งสามใช้**กฎปัจจุบัน**เสมอ PO ที่มาจาก PR ซึ่งผ่านแล้วอาจไม่ผ่านถ้ากฎหรือ mapping ถูกแก้ระหว่างทาง (user ยอมรับ เพราะสุดท้ายต้องลงบัญชีตามกฎปัจจุบัน)
- ห้ามตรวจตอน save draft และห้ามตรวจตอน update ที่ไม่ได้เปลี่ยนสถานะ

### FE: แสดงผล

- hook ใหม่ `useLineDimensionRules(lines)` เรียก endpoint ข้างบนด้วย TanStack Query โดย query key มาจากคู่ (location_id, product_id) ที่ไม่ซ้ำกัน
  - ยิงเฉพาะเมื่อ `useLineDimensionsEnabled()` เป็น true
  - เปลี่ยนสินค้าหรือ location แล้วต้องดึงกฎใหม่
  - hook นี้ใช้ทั้ง PR, PO และ GRN ซึ่งเป็นโมดูลเดียวกัน (procurement) จึงวางไว้ที่ `routes/procurement/shared/`
- ช่อง dimension ของบรรทัด:
  - `resolved` → แสดงตาม `visibleLineDimensions()` ช่อง mandatory ติด `*` และค่าที่บันทึกไว้แล้วยังแสดงอยู่แม้กฎจะเปลี่ยน (พฤติกรรมเดิมของ helper)
  - `no_account` / `skipped` → ไม่แสดงช่อง dimension ยกเว้นบรรทัดที่มีค่าบันทึกไว้แล้ว ให้แสดงค่าเหล่านั้นต่อ
  - ระหว่างโหลด หรือโหลดไม่สำเร็จ → ทำแบบเดียวกับ `ArLineDimensions` (ข้อความ error พร้อมปุ่มลองใหม่ ไม่ล้างค่า)
- **ค่า default**: เมื่อกฎของบรรทัดมาถึงและช่อง mandatory ยังว่าง FE เติม default ให้เห็นและแก้ได้ ถ้ามีการเติม ต้องตั้ง `dimensions_dirty` เพื่อให้ payload ส่งค่าไปด้วย (*การตัดสินใจของผม* — BE เติมซ้ำตอน submit อยู่แล้ว ฝั่ง FE จึงทำเพื่อให้ผู้ใช้เห็นค่าก่อนเท่านั้น)

### FE: หน้าตา = แบบเดียวกับ JV (user สั่ง 2026-11-20)

แยกแถบชิป dimension ของ JV (`routes/accounting/documents/accounting-document-detail.tsx` แถวย่อย `colSpan` ใต้แต่ละบรรทัด) ออกมาเป็น component กลาง `components/dimension/line-dimension-strip.tsx` แล้วให้ **PR, PO, GRN และ JV ใช้ตัวเดียวกัน** (user เลือกทางนี้แทนการลอกแบบไปทำใน procurement เพื่อให้หน้าตาไม่เพี้ยนจากกัน)

```
│ 1 │ น้ำดื่ม 600ml · ห้องอาหาร │ 24 ขวด │ ...          │
│   │ [DEPT*: F&B ▾] [PRJ*: WED-01 ▾] [EVT: 2026-11-30 📅]  ⧉ │
```

- **แก้ไขได้**: dimension แบบ lookup เป็น `Select` ขนาด xs มีป้าย `CODE:` นำหน้า และตัวเลือกแรกเป็น "ล้างค่า" ส่วนแบบ typed ใช้ `DimensionValueInput` ขนาด xs (เหมือน JV ทุกอย่าง)
- **ดูอย่างเดียว**: เป็นชิป `CODE: ค่า` กดแล้วเปิด dialog "All Dimensions" (`รหัส — ชื่อ`) ให้ย้าย dialog นี้เข้าไปใน component กลางด้วย
- **ของที่เพิ่มใหม่** (JV ได้ไปด้วย): ช่อง mandatory ติด `*` และเมื่อตรวจไม่ผ่านชิปนั้นเป็นสีแดง (`aria-invalid`)
- props ขั้นต่ำ: รายการ dimension ที่มองเห็น (มาจาก `visibleLineDimensions()`), ชุด id ของ dimension ที่บังคับ, ชุด id ที่ผิด, `value`, `onChange`, `readOnly`
- ใช้แถวย่อยใต้บรรทัดเหมือนกันทั้ง 3 เอกสาร GRN **เลิกใช้ popover** (`LineDimensionPopover`) ส่วน `LineDimensionFields` กับ popover ให้ลบทิ้งเมื่อไม่มีผู้เรียกเหลือแล้ว
- PR บนมือถือ (wizard แบบการ์ด): แถบชิปขึ้นบรรทัดใหม่ได้ (`flex-wrap`) วางไว้ท้ายการ์ด
- ข้อความยังเป็นภาษาอังกฤษตายตัวใน JV บางจุด (เช่น description ของ sheet) ให้ย้ายเข้า i18n ตอนแยก component
- `accounting-jv-edit-lines.test.tsx` ต้องผ่านเหมือนเดิมหลังให้ JV เปลี่ยนมาใช้ component กลาง

### FE: ตรวจก่อนส่ง

- ตอนกด Submit (PR/PO) และกด Save ที่ทำให้ GRN ออกจาก draft:
  - ตรวจทุกบรรทัด `resolved` ว่าช่อง mandatory ที่**ไม่มี default** มีค่า และไม่มีค่าของ dimension ที่ prohibited
  - ไม่ผ่าน → ไม่ส่ง request, ไฮไลต์บรรทัดที่ผิด (ขยายแถวและทำให้ช่องเป็นสีแดง) และแสดง toast บอกจำนวนบรรทัดที่ผิด
- ถ้า BE ตอบ 422 ด้วย error catalog ใหม่ ให้แสดงข้อความแปลที่ระบุบรรทัดและ dimension ไว้ด้วย (ใช้กันกรณีกฎเปลี่ยนระหว่างที่หน้าเปิดค้างอยู่)
- Save ของใบ draft ไม่เรียกตัวตรวจนี้
  ระวัง: Save ของ PO draft ใช้ `draftSaveHandler` ซึ่งไม่ผ่าน zod อยู่แล้ว ห้ามเอาการตรวจนี้ไปใส่ใน zod schema หลัก ไม่อย่างนั้น Save draft จะโดนตรวจไปด้วย

## ข้อจำกัด / ลำดับ deploy

- ลำดับ: BE (micro-business + gateway) → allowlist api_name ใหม่ → FE
  ถ้า FE ขึ้นก่อน BE จะได้ 404 หรือ 401 ซึ่งอาจทำให้ user โดน logout
- **การตรวจฝั่ง BE ต้องปิดได้ด้วย**: ตอนนี้ dimension ของบรรทัดยังซ่อนจากลูกค้าอยู่ (`LINE_DIMENSIONS_ENABLED` ปิด) ถ้า BE บังคับ mandatory ทั้งที่ลูกค้ามองไม่เห็นช่องให้กรอก ลูกค้าจะ submit ไม่ได้เลยหากบัญชีมีกฎ mandatory ที่ไม่มี default
  → ใช้ config ระดับ BU `dimension.start-from` (default `none`) แทนสวิตช์ BE ดู §Config ระดับ BU
- dev DB เป็นของกลาง ทดสอบ submit จริงแล้วต้อง void ใบทดสอบทิ้ง

## ข้อสรุปหลัง builder check (การตัดสินใจของผม เว้นแต่จะระบุไว้)

- **location ของบรรทัด**
  - PR: ใช้ `tb_purchase_request_detail.location_id` (ค่า null ได้ ถ้าเป็น null ถือเป็น `no_account`)
  - GRN: ใช้ `location_id` ของบรรทัด (มีค่าเสมอ)
  - PO: ตัวบรรทัดไม่มี location เก็บอยู่ใน junction `tb_purchase_order_detail_tb_purchase_request_detail` ทั้ง PO ที่มาจาก PR และ PO ที่สร้างเอง (`buildJunctionLocation`)
    - user ยืนยันว่า PO แยกตามลำดับ vendor → currency → delivery date → product → location → dimension ตรงกับโค้ด: `buildPoGroupKey` (แยกใบ) และ `buildPoLineMergeKey` (แยกบรรทัดตาม product, location, … และ `buildDimensionSignature`)
    - **บรรทัด PO หนึ่งบรรทัดจึงมี location เดียวและ dimension ชุดเดียว** ให้ใช้ location ของแถว junction นั้น
    - การแยกตาม dimension **นับค่า (value) ด้วย** (user ย้ำ: ห้องอาหารสั่งน้ำให้ project งานแต่งกับ project งานบวช ต้องเป็นคนละบรรทัด)
      - โค้ดทำอยู่แล้ว: `buildDimensionSignature()` สร้างคีย์จาก `dimension_id=v:<dimension_value_id>` (ค่าแบบ typed ใช้รหัสที่ normalize แล้ว) และ GRN คัด dimension จากบรรทัด PO มาทีละบรรทัด
      - **ห้ามทำให้พัง**: default ต้องถูกเติมและบันทึกลงบรรทัด PR ตอน submit (§ตรวจที่ 3 จุด ข้อ 3) ก่อนจะแปลงเป็น PO มิฉะนั้นบรรทัดที่ว่างกับบรรทัดที่ได้ค่า default ซึ่งเป็นค่าเดียวกัน จะได้คีย์ต่างกันและแยกเป็นคนละบรรทัดโดยไม่ตั้งใจ
    - ข้อมูลเก่าที่บังเอิญมีหลาย location ในบรรทัดเดียว (*การตัดสินใจของผม*): ให้ resolve ทุก location แล้วรวมกฎ คือแสดงถ้ามีบัญชีใดอนุญาต, บังคับถ้ามีบัญชีใดบังคับ, ห้ามใช้เฉพาะเมื่อทุกบัญชีห้าม
- **สวิตช์ฝั่ง BE**: ใน BE ไม่มี `DIMENSION_LICENSE_FEATURE` (เป็นค่าคงที่ฝั่ง FE `"configuration.dimension"`) จึงไม่อ่าน license ข้าม service ถ้า BU ไม่มี license ก็ไม่มี dimension active ให้บังคับอยู่แล้ว ส่วนการเปิดหรือปิดใช้ config ระดับ BU (§Config ระดับ BU)
- **จุดตรวจ**
  - ตรวจทุกครั้งที่เรียก `submit()` ของ PR/PO รวมถึงการ submit ซ้ำหลังถูกส่งกลับ
  - ดู §ทางออกจาก draft (ฉบับก่อนเขียนผิดว่า PO จาก PR เริ่มที่ draft และ GRN ออกจาก draft ทาง `update()` แก้แล้ว)
- **ป้อนข้อมูลให้ตัวตรวจ**: แปลงบรรทัดเป็น `IDimensionLine` โดยใช้ `chart_of_accounts_id` จากฟังก์ชันกลาง และใช้ sequence_no หรือ detail id เป็น key
  - BE คืนแค่ violation แรกเหมือน JV/AP (FE เป็นฝ่ายนับจำนวนบรรทัดที่ผิดเองก่อนส่ง ส่วน 422 ใช้กันเฉพาะกรณีที่หลุดมาถึง BE)
  - ค่า typed ใช้ตามที่ตัวตรวจรองรับอยู่แล้ว
  - ช่อง mandatory ที่ไม่มีทั้ง default และค่า → 422
- **onDate**: PR = `pr_date` · PO = `po_date` · GRN = `grn_date`
- **endpoint**: วางที่ gateway ฝั่ง procurement และใช้ api_name กับ guard แบบเดียวกับ endpoint lookup ของ PR (อ่านได้ถ้าเข้าโมดูล procurement ได้) แล้วส่ง RPC ไป micro-business

## ทางออกจาก draft (ตรวจในโค้ด 2026-11-20)

ทุกทางที่ทำให้เอกสารพ้น draft ต้องเรียกตัวตรวจ:

| เอกสาร | ทาง | สถานะ | ตรวจ |
|---|---|---|---|
| PO manual | `create()` → draft → `submit()` → in_progress | | ที่ `submit()` |
| PO จาก PR | `confirmPrToPo()` สร้างใบเป็น **in_progress ทันที** ไม่ผ่าน `submit()` | | **ต้องตรวจใน `confirmPrToPo()` ด้วย** (กฎอาจเปลี่ยนหลัง PR ผ่าน) ไม่ผ่าน = ไม่สร้าง PO ใดเลยทั้งชุด (transaction เดียว) |
| GRN manual และ GRN จาก PO | `create()` → draft → `save()` → saved | ได้เลขจริง | ที่ `save()` |
| GRN | saved → `commit()` / `approve()` → committed | ลงสต๊อก ออก JV และ AP อัตโนมัติ (`postReceipt`) | **ตรวจซ้ำ** (user เลือก 2026-11-20) ทั้ง FE ตอนกดปุ่ม commit/approve และ BE ใน transaction เดียวกับ `postReceipt` ก่อนลงสต๊อก เพราะใบ saved ยังแก้บรรทัดได้ และกฎอาจเปลี่ยนก่อน commit ถ้าไม่ตรวจ ข้อมูลที่ผิดจะไปพังตอนลงบัญชี |

- PO manual และ GRN manual ไม่มีต้นทาง จึงกรอก dimension ครั้งแรกที่ตัวเอกสารนั้นเลย FE ต้องกรองช่องและติด `*` แบบเดียวกับ PR
- GRN ที่รับจาก PO คัด dimension จากบรรทัด PO มา ถ้ากฎเปลี่ยนตั้งแต่ตอน PO ระบบจะจับได้ที่ `save()` หรือ `commit()`

## Config ระดับ BU: เริ่มใช้ dimension ที่เอกสารไหน (user สั่ง 2026-11-20)

key ใหม่ `dimension.start-from` แบบ enum เก็บใน `config` ของ business unit เพิ่มในหน้า `/system-admin/default-setting` ด้วย skill `add-business-setting-config` (ทำ registry กับ i18n ไม่ต้องแก้ component) ฝั่ง BE อ่าน key นี้แบบเดียวกับ `po.group-by-pr-comment` (`PO_GROUP_BY_PR_COMMENT_KEY` ใน `purchase-order.service.ts`)

| ค่า | PR | PO | GRN |
|---|---|---|---|
| `none` (default เมื่อไม่ได้ตั้ง) | – | – | – |
| `pr` (ทั้งหมด) | ✓ | ✓ | ✓ |
| `po` | – | ✓ | ✓ |
| `grn` | – | – | ✓ |

✓ = แสดงแถบชิปและตรวจที่จุดตรวจของเอกสารนั้น · – = ไม่แสดงและไม่ตรวจ (endpoint กฎก็ไม่ต้องเรียก)

- **key นี้ใช้แทนสวิตช์ BE** ที่เคยวางไว้ เพราะ default `none` ทำให้ไม่มี BU ไหนถูกบังคับจนกว่าจะเปิดเอง
- `LINE_DIMENSIONS_ENABLED` (env ฝั่ง FE) ยังเป็นประตูชั้นนอกสุดจนกว่าจะปล่อยฟีเจอร์ ถ้าปิด FE จะทำงานเหมือน `none` ทุก BU
  - ระวัง: env นี้ไม่มีผลกับ BE ถ้า env ปิดแต่ BU ตั้ง `pr`/`po`/`grn` ไว้ BE จะยังตรวจ ทั้งที่ FE ไม่แสดงช่อง ให้ตั้ง BU key หลังเปิด env เท่านั้น และเขียนข้อนี้ไว้ในคู่มือ deploy
- **ระดับที่ปิดไม่ส่ง dimension ต่อ**: `confirmPrToPo()` คัด dimension ของ PR และใช้เป็นส่วนหนึ่งของ merge key ก็ต่อเมื่อ PR เปิดอยู่ (`pr`) ส่วน GRN คัดจาก PO ก็ต่อเมื่อ PO เปิดอยู่ (`pr`/`po`) ถ้าคัดค่าที่ค้างอยู่ไป บรรทัด PO จะถูกแยกด้วยค่าที่ผู้ใช้มองไม่เห็น
- **เปลี่ยนค่ากลางทาง**: ใช้ค่า ณ ตอนที่ถึงจุดตรวจเสมอ
- **JV/AP ไม่ขึ้นกับ key นี้**: ยังตรวจตามกฎผังบัญชีเหมือนเดิม ถ้าตั้ง `none` แต่บัญชีบังคับ dimension ที่ไม่มี default การลงบัญชีจาก GRN จะติดที่ JV เหมือนตอนนี้ (พฤติกรรมเดิม งานนี้ไม่ได้แก้)

## GRN ด่านสุดท้ายก่อนลง JV (user สั่ง 2026-11-20)

- ตอน `commit()` / `approve()` ตรวจ dimension ของทุกบรรทัดกับ**กฎปัจจุบัน**ของบัญชีปัจจุบัน (หา account ใหม่จาก mapping ปัจจุบัน ห้ามใช้ผลที่ได้ตอน `save()`) ใน transaction เดียวกัน**ก่อน** `postReceipt` ไม่ผ่าน = ไม่ลงสต๊อก ไม่ออก JV ไม่สร้าง AP
- **คนบันทึก GRN แก้ dimension ได้เสมอ**ตราบที่ใบยังไม่ committed ทั้งใบ draft และใบ saved แม้ค่าจะคัดมาจาก PO ก็ไม่ล็อก (BE รองรับอยู่แล้ว: `update()` ของใบ saved ผ่าน `planLineDimensions` ได้) ใบ committed แก้ได้แค่หัวใบตามเดิม
- เมื่อ commit ไม่ผ่านเพราะ dimension ให้ FE เปิดโหมดแก้ไขของใบนั้นค้างไว้ ชิปที่ผิดเป็นสีแดง ผู้ใช้แก้ กด Save แล้วกด commit ใหม่ได้ในหน้าเดิม โดยไม่ต้องย้อนไปแก้ PO
- ด่านนี้ใช้เมื่อ `dimension.start-from` ไม่ใช่ `none` (ทุกค่าที่ไม่ใช่ `none` เปิด GRN อยู่แล้ว)

## สิ่งที่ปล่อยให้ builder ตัดสิน

- ตำแหน่งไฟล์ของฟังก์ชันกลางฝั่ง BE และชื่อ error catalog
- จะย้าย `visibleLineDimensions()` ไป `lib/` หรือ `components/dimension/`
- UI ไฮไลต์บรรทัดที่ผิดในแต่ละเอกสาร ให้ใช้ของที่แต่ละหน้ามีอยู่ (PR เป็น card หรือแถวกาง, PO เป็นแถวกาง, GRN เป็น popover)
