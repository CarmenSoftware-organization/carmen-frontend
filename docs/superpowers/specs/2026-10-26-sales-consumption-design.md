# Sales Consumption + Import POS — ย้ายงาน POS รายวันมาไว้ที่ Operational Planning

วันที่: 2026-10-26 · สถานะ: รอ user อนุมัติ

ต่อยอดจาก `docs/superpowers/specs/2026-10-22-pos-sale-interface-design.md` (POS Sale Interface — FE #437,
BE #912, micro-cronjobs #15 merge แล้ว **ยังไม่ deploy และ migration ยังไม่เคย apply**) เอกสารนี้อธิบายเฉพาะ
ส่วนที่เปลี่ยน ของที่ไม่ได้พูดถึง (parser, กติกาตรวจไฟล์, SFTP, การคำนวณวัตถุดิบ §5.2) ใช้ตาม spec เดิม

ตัวอย่างอ้างอิงหน้าตา: `https://carmen-inventory-dev.vercel.app/store-operations/sales-consumption`
(prototype — ใช้แค่เป็นแนวทางของ list/detail **ไม่ใช่สเปก**; ต่างจากเอกสารนี้ตรงที่ prototype auto-post,
แบ่งตาม shift และมีสถานะ "Posted with Exceptions" — ทั้งสามข้อ **ไม่ทำ**)

POC (ข้อมูลสมมติ, ไม่ใช่สเปก): `https://claude.ai/artifact/7vPnwzcJGKNFSXHjU1ZD5o`

## 1. เจตนาและเหตุผล

spec เดิมวางงานทั้งหมดไว้ใต้ System Admin → Interface: นำเข้า, ผูก, ตรวจ แล้วกด "ยืนยัน" ต่อ Outlet เพื่อออก
Stock Out ทันที แต่คนที่ทำงานนี้ทุกวันคือ **พนักงานคลัง** ไม่ใช่ admin ที่ตั้งค่า interface

user ต้องการแยกเป็นสองขั้นชัด ๆ:
1. **Import POS = ถังพักข้อมูล** — ไฟล์ยอดขายเข้ามา (อัปโหลดเอง หรืออัตโนมัติผ่าน SFTP ตาม config) แล้วพักไว้
   เป็น raw transaction **ไม่แตะสต็อก**
2. **Sales Consumption = ตรวจแล้ว post** — พนักงานคลังเห็นยอดขายของ**ทั้งวัน**แตกเป็นวัตถุดิบ ผูกที่ค้าง ตรวจ
   แล้วกด Post จึงตัดสต็อกจริง

ทั้งสองเมนูอยู่ใต้ Operational Planning (`operationPlan` — โมดูลเดียวกับ Recipe ที่ใช้ผูกรายการขาย)

```
① Operational Planning → Import POS    ② Operational Planning → Sales Consumption          ③ Inventory
   อัปโหลด / ประวัติ / SFTP ล่าสุด  ──►     SC = 1 วันขาย (ทุกไฟล์ทุก outlet ของวันนั้น)  ──►   Stock Out (SALE)
   transaction ดิบจาก POS                    ปฏิทิน: 1 ช่อง = 1 SC                              1 ใบต่อ location
   (ไม่มี mapping)                           Mapping (master): Outlet→location, Item→recipe/Ignored  วันที่ = วันขาย
                                             Verify → Post / Void
        ▲
   System Admin → Interface: ตั้งค่าการเชื่อมต่อเท่านั้น (เปิด/ปิด, SFTP)
```

## 2. เป้าหมาย / ไม่ใช่เป้าหมาย / ห้ามเกิด

**เป้าหมาย**
1. เมนูใหม่สองตัวใต้ Operational Planning: **Import POS** และ **Sales Consumption**
2. หน้า Interface ของแบรนด์ POS เหลือเฉพาะ **ตั้งค่าการเชื่อมต่อ**
3. POS Item มีสถานะที่สาม **Ignored** — ของที่ขายแต่ไม่ตัดวัตถุดิบ (เช่น ของชำร่วย) ตั้งครั้งเดียวจำต่อ item
4. เอกสาร **Sales Consumption (SC)** หนึ่งใบ = **หนึ่งวันขายของ BU** — รวมทุกการนำเข้าของวันนั้น ทุกแบรนด์ ทุก store
   ทุก outlet ทุก location
5. **ปฏิทิน** ของ BU: หนึ่งช่อง = หนึ่งวัน = SC ใบเดียว บอกสถานะ 4 แบบ (§4.3)
6. **Post** ได้เมื่อทุกบรรทัดของ SC ผูกครบ (outlet มี location, item มี recipe หรือ Ignored) → Stock Out
   adjustment type `SALE` **หนึ่งใบต่อ location** ที่มีวัตถุดิบต้องตัด ทั้งหมดในครั้งเดียว
7. **Void** SC → Stock Out ทุกใบของ SC ถูก void (สต็อกคืน) → SC ใหม่รอ post → แก้แล้ว post ใหม่ได้

**ไม่ใช่เป้าหมาย**
- แบ่ง SC ตาม shift หรือตาม location
- post บางส่วน (บาง location / บางบรรทัด) / สถานะ "Posted with Exceptions"
- auto-post โดยไม่มีคนกด (รวมรอบ SFTP)
- แก้ตัวเลขยอดขายรายบรรทัด
- เปลี่ยน parser, กติกาตรวจไฟล์, การคำนวณวัตถุดิบของ spec เดิม

**ห้ามเกิด**
- ตัดสต็อกซ้ำ: บรรทัดยอดขายเดียวถูกนับในสอง SC / สอง Stock Out ที่ยัง active
- post SC ที่ยังมีบรรทัดค้างผูก
- SC posted ค้างครึ่งทาง: Stock Out บาง location ออก บาง location ไม่ออก
- void SC ที่วันขายอยู่ในงวดคลังที่ปิดแล้ว
- ไฟล์ใหม่เขียนทับข้อมูลของวันที่ post แล้วโดยเงียบ ๆ
- ผูก leaf ใหม่กับ license feature key ที่ยังไม่มีใน DB/ยังไม่ assign — `LICENSE_ENFORCEMENT` เปิดทุก env
  หน้าจะล็อกทันทีที่ deploy

## 3. ข้อจำกัดที่มีอยู่แล้ว

- ทุกข้อใน §3 ของ spec เดิม ยังใช้อยู่ (**Stock Out location เดียวต่อใบ**, `so_date` ต้องอยู่ในงวดเปิด,
  commit ตัดเกินของที่มีไม่ได้, logic layer ห้าม throw, api_name ใหม่ต้องเติม allowlist ก่อน FE, ลำดับ deploy)
- ของที่ BE #912 สร้างไว้แล้ว (ชื่อตามโค้ดจริง): `tb_pos_store`, `tb_pos_outlet` (`location_id?`), `tb_pos_item`
  (`recipe_id?`), `tb_pos_sale_import`, `tb_pos_sale_line` (`stock_out_id?`), endpoint ยืนยันต่อ
  (import, outlet) = `POS_SALE_OUTLET_CONFIRM`, hook ตอน void Stock Out คืนบรรทัดเป็น "ยังไม่ตัด"
- **migration ของ POS ยังไม่เคย apply ที่ไหน** → แก้ schema ได้โดยไม่ต้องย้ายข้อมูล (แก้ migration เดิมหรือเพิ่มใหม่
  — builder เลือก)
- `voidStockOut` ปัจจุบัน **ไม่ตรวจงวด** และ `stock-outs.controller` ไม่มี PermissionGuard (ของเดิม) — งานนี้
  ต้องตรวจงวดเองที่ทาง void ของ SC อย่างน้อย
- FE: โค้ด POS อยู่ที่ `routes/system-admin/interface/pos/` — กฎ module boundary ห้าม `routes/operation-plan/`
  import จาก `routes/system-admin/` → ต้อง **ย้ายไฟล์** มา ไม่ใช่ import ข้ามโมดูล; ของที่ทั้งสองฝั่งยังใช้ร่วม
  (เช่น `pos-sale-types.ts`) ย้ายไป `types/` / `hooks/`
- เมนู Operational Planning อยู่ที่ `constant/module-list.ts` (`operationPlan`, path `/operation-plan`) — leaf เดิมทั้งหมดผูก license `operation_plan.*`

## 4. สิ่งที่ตัดสินใจแล้ว

### 4.1 ที่ user ตัดสินเอง
| ข้อ | การตัดสินใจ |
|---|---|
| ผู้ใช้ | พนักงานคลัง ดูรายการตัดสต็อกจากยอดขายแต่ละวัน แล้ว post |
| ขั้นตอน | Interface นำเข้าเป็นถังพัก → Sales Consumption verify → post ตัดสต็อกจริง |
| เอกสารปลายทาง | Stock Out, adjustment type `SALE` (ตามเดิม) |
| หน่วยของ SC | **หนึ่งวัน = ทุกการนำเข้า POS ของวันนั้น** (ทุก location ในใบเดียว) — user เลือกเองหลังผมแย้งว่า Stock Out มี location เดียวต่อใบ จึงต้องแตกเป็นหลายใบตอน post (เดิมตกลงกันที่ วัน × location) |
| ตำแหน่งเมนู | ทั้ง Import POS และ Sales Consumption อยู่ใต้ **Operational Planning** (เดิมคุยว่า Store Operations — user ย้าย) |
| หน้า Import POS | ย้ายงานนำเข้ามาที่เมนูใหม่ Import POS แทนที่จะอยู่ในหน้า config interface — **มีแค่ raw transaction จาก POS** (ไม่มี mapping) |
| ที่อยู่ของ mapping | Outlet → location และ Item → recipe / Ignored อยู่ใน **Sales Consumption** — แท็บ Mapping = **master mapping** (`tb_pos_outlet.location_id`, `tb_pos_item.recipe_id` / `is_ignored`) ไม่ใช่ mapping ราย SC — เป็น**ค่าเริ่มต้น**ของทุกบรรทัด |
| location รายบรรทัด | **sales line เลือกเปลี่ยน location ได้ตลอด** — ค่าเริ่มมาจาก outlet mapping แต่แก้ทีละบรรทัดได้ |
| recipe รายบรรทัด | **mapping recipe ก็เปลี่ยนได้ตลอด** ที่บรรทัด — **ค่าเริ่มต้นจาก master mapping** (item → recipe / Ignored) |
| ตรวจ on-hand | แท็บ Ingredients to deduct มี**ปุ่มตรวจสอบกับ on-hand** ของ product ใน location นั้น ๆ เพื่อดูว่าตัดสต็อกได้หรือไม่ — **ก่อน post ต้อง verify on-hand ก่อน** (ปุ่ม Post เปิดได้เมื่อผลตรวจล่าสุดผ่านครบทุก location) |
| เปิดใช้เมนู | **ถ้า BU ไม่มี interface POS ไม่ต้อง active Import POS กับ Sales Consumption** |
| Ignored | เพิ่มสถานะ ignored ให้ item ที่ไม่มี recipe เช่น ของชำร่วย |
| กติกา post | ทุกรายการต้องผูกหรือ ignored ก่อน — **ไม่มี post บางส่วน** |
| ปฏิทิน | 1 ช่อง = 1 วัน = ทุก import ของวันนั้น · สถานะ posted / pending post / ไม่มียอดขาย / ไม่มีไฟล์ — **แยก "ไม่มีไฟล์" กับ "มีไฟล์แต่ไม่มียอด"** |
| แก้หลัง post | void SC → Stock Out ถูก void → post ใหม่ได้ |
| งวดปิด | **ห้าม void** ถ้างวดของวันขายปิดแล้ว |

### 4.2 ที่ผมตัดสินเอง (แย้งได้)
**หน้าจอ**
- **Import POS** (raw อย่างเดียว): อัปโหลด (ทั้งสองแบรนด์), ประวัติการนำเข้า + ยกเลิกการนำเข้า, สถานะรอบ SFTP
  ล่าสุด, ดูบรรทัด transaction ดิบของการนำเข้า (วันขาย, store, outlet code/ชื่อ, item code/ชื่อ, qty, ยอด) ตามที่ POS ส่งมา
  — ไม่แสดงสถานะ mapping และไม่มีปุ่มผูก
- **Sales Consumption → Mapping**: แท็บ Outlet → Location และ POS item → Recipe / Ignored (ย้ายจากแท็บ outlets/items
  ของ `PosOperations`) + ผูก/ignore บรรทัดค้างได้ทันทีในหน้า SC detail
- **คงไว้ที่ Interface**: ฟอร์มตั้งค่า (เปิด/ปิด, SFTP host/user/password/folder/pattern/เวลา) — งาน admin
- **ตัดหน้า "ตรวจและยืนยัน" ราย import** (`pos-import-review.route.tsx`, `pos-confirm-dialog.tsx`,
  `pos-outlet-review-card.tsx`) และ endpoint ยืนยันต่อ (import, outlet) ออก — แทนด้วย SC
- **SC detail แบ่งกลุ่มตาม location** (user สั่ง: "ingredients to deduct group ตาม location") — แท็บวัตถุดิบเป็นกลุ่มละ
  location: หัวกลุ่มบอกชื่อ location, outlet ที่มา, จำนวนสินค้า, มูลค่ารวม และเลข Stock Out (ก่อน post = "ออกตอน post");
  แถวในกลุ่ม = สินค้า × qty หน่วยคลัง × ต้นทุนต่อหน่วย × **Total cost** (= qty × ต้นทุนต่อหน่วย; user ให้ใช้ชื่อนี้แทน "Extended cost") × คงเหลือ × "ตัดได้ไหม"
  · **ปุ่ม "Verify on-hand"** (user สั่ง) อยู่**ที่หัวหน้า ข้างหน้าปุ่ม "Post & deduct stock"** (ปุ่มรอง; Post เป็นปุ่มหลักตัวเดียว)
    กดแล้วเปิดแท็บวัตถุดิบให้เห็นผล · ปิดไว้ขณะยังมีบรรทัดค้างผูก · ยิงตรวจคงเหลือ ณ วันขายของทุก product ในทุกกลุ่มตาม location ของกลุ่ม → แต่ละแถวขึ้น
  OK / ขาด X หน่วย, หัวกลุ่มขึ้น "ตัดได้" หรือ "ขาด N รายการ" — ก่อนกด คอลัมน์คงเหลือเป็น "—" (ไม่ดึงทุกครั้งที่เปิดหน้า เพราะ
  คงเหลือ ณ วันที่ต้องคำนวณ) · แก้ location/recipe ของบรรทัดหลังตรวจ = ผลตรวจหมดอายุ ต้องกดใหม่ (ผมตัดสินเอง)
  · **Post ต้องมีผลตรวจที่ผ่าน**: ปุ่ม Post ปิดจนกว่าจะกด Check on-hand แล้วไม่มีรายการขาด (user สั่ง); ผลตรวจผูกกับสถานะบรรทัด
  ณ ตอนตรวจ — BE เก็บ `onhand_verified_at` + ลายเซ็นของบรรทัด (location/recipe/qty) ไว้ที่ SC และ **post ปฏิเสธ** ถ้ายังไม่ verify
  หรือบรรทัดเปลี่ยนหลัง verify · ตอน Post ระบบยังตรวจซ้ำใน transaction เสมอ (กันของถูกตัดไประหว่างนั้น) — ผมตัดสินเอง — แต่ละกลุ่ม = Stock Out
  หนึ่งใบตอน post; บรรทัดที่ยังไม่มี location ไม่อยู่ในกลุ่มใด แสดงเป็นแถบเตือนใต้กลุ่ม · คำนวณตาม location ของบรรทัด
  ย้าย location ที่บรรทัดแล้วกลุ่มเปลี่ยนตาม; แท็บยอดขายกรองตาม outlet / location ได้; หลัง post แสดงรายการ Stock Out ทุกใบพร้อมลิงก์

**เอกสาร SC**
- **SC เป็นเอกสารจริงในตาราง** (ไม่ใช่ view คำนวณสด) เพราะต้องมีเลขที่, สถานะ, ผู้ post/void, ลิงก์ Stock Out
  และประวัติใบที่ void แล้ว — สร้าง/อัปเดตอัตโนมัติเมื่อมีการนำเข้าสำเร็จของวันนั้น
- **เลขที่ SC**: `SC-<YYYYMMDD>` + ลำดับ (ใบใหม่หลัง void ได้ลำดับถัดไป) — builder ปรับรูปแบบได้
- **สถานะ SC**: `pending` (รอ post) → `posted` → (void) → ใบนั้นเป็น `voided`; บรรทัดยอดขายถูกปล่อยกลับ
  และ **SC ใบใหม่สถานะ `pending`** ของวันเดียวกันเกิดขึ้นรับบรรทัดเหล่านั้น — มี SC active ได้ใบเดียวต่อวันต่อ BU
- **location ของบรรทัด** = `line.location_id` (ค่าที่แก้ที่บรรทัด) ถ้ามี ไม่งั้น = location ของ outlet (master) ·
  "ได้ตลอด" = ตลอดเวลาที่ SC ยัง `pending`; SC `posted` แก้ไม่ได้เพราะ Stock Out ออกไปแล้ว — void ก่อนแล้วแก้
  (ผมตีความเอง) · แก้ outlet mapping (master) ทีหลัง มีผลกับบรรทัดที่ยังไม่ตัดและไม่ได้แก้ location รายบรรทัดไว้เท่านั้น
  · ตั้งกลับเป็น "ตาม outlet" ได้ (ล้าง override)
- **recipe ของบรรทัด** = override ที่บรรทัด (`line.recipe_id` หรือ `line.is_ignored`) ถ้ามี ไม่งั้น = master ของ item ·
  แก้ได้ตลอดเวลาที่ SC `pending` (posted ต้อง void ก่อน — ผมตีความเหมือน location) · แก้ที่บรรทัด = มีผลบรรทัดนั้นเท่านั้น
  เว้นแต่ติ๊ก **"ตั้งเป็นค่าเริ่มต้นของ item ด้วย"** (ผมเพิ่มเอง) ซึ่งเขียนลง master แล้วมีผลกับบรรทัดอื่นที่ยังไม่ตัดและไม่มี override
  · dropdown recipe ของบรรทัดมีตัวเลือก "Ignore" ด้วย; ล้าง override กลับไปตาม master ได้
- **บรรทัดค้าง** (บล็อก post) = Qty สุทธิ > 0 ∧ (location ของบรรทัดว่าง ∨ (recipe ของบรรทัดว่าง ∧ ไม่ ignored))
  — บรรทัดของ outlet ที่ยังไม่ผูก location จึงบล็อก post ของทั้งวัน จนกว่าจะผูก outlet หรือเลือก location ที่บรรทัด
- **บรรทัดที่ไม่นับ** (ไม่บล็อก ไม่ตัด): Qty สุทธิ ≤ 0 (หักกลบต่อ Outlet + Item ตามเดิม) และ item Ignored
- **Ignored เก็บที่ `tb_pos_item`** (ระดับ item ของร้าน) — ตั้งครั้งเดียวใช้ทุกวัน; ยกเลิก ignore ได้;
  ผูก recipe = ล้าง ignored อัตโนมัติ (สองอย่างอยู่พร้อมกันไม่ได้)

**Post / Void**
- **Post = all-or-nothing ทั้งวัน** ใน transaction เดียว: คำนวณวัตถุดิบ → จัดกลุ่มตาม location ของบรรทัด → สร้าง + commit
  Stock Out หนึ่งใบต่อ location → set `stock_out_id` ของบรรทัด → SC `posted` · **สต็อกไม่พอแม้ location เดียว** = ไม่มี
  ใบไหนออกเลย คืนรายการสินค้าที่ขาดแยก location · **วันขายนอกงวดเปิด** = post ไม่ได้ (ผลของการเลือก "วันละใบ":
  location หนึ่งของขาด ทั้งวันรอ — user รับทราบแล้วตอนเลือก)
- **Void** = ตรวจงวดของ `sale_date` (ปิด → ปฏิเสธ) → void Stock Out ทุกใบของ SC → SC `voided` → SC ใหม่ `pending`
  — ทั้งหมดใน transaction เดียว ใบใดใบหนึ่ง void ไม่ได้ = ไม่ void เลย
- **ต้นทุนเป็น 0** ไม่บล็อก post — แสดงเตือนเท่านั้น
- **void Stock Out ที่มาจาก SC ตรงจากหน้า Stock Out** → บล็อกที่ **service layer** (ทุกทางที่เรียก) ด้วย error catalog
  "void ที่ Sales Consumption" · hook void ของ #912 เลิกใช้กับใบที่มาจาก SC · void SC เรียก service void Stock Out เอง
- **หน้า SC ที่ posted/voided** แสดงวัตถุดิบจาก **Stock Out** ที่ออกจริง ไม่คำนวณใหม่ (ไม่ต้องมี snapshot แยก)
- **แก้ master mapping หลัง post** ทำได้เสมอ (outlet และ item) มีผลกับบรรทัดที่ยังไม่ตัดเท่านั้น — บรรทัดที่ตัดแล้วจำ
  location/ปริมาณไว้ใน Stock Out

**ไฟล์ที่เข้ามาชนวันที่ post แล้ว**
- Simphony ไฟล์ซ้ำ → `REJECTED_DUPLICATE` ตามเดิม
- ยกเลิกการนำเข้า (cancel) ที่มีบรรทัดอยู่ใน SC `posted` → **ไม่อนุญาต** ต้อง void SC ก่อน
- Micros 3700 เขียนทับ Outlet ที่บรรทัดอยู่ใน SC `posted` → ล้มเฉพาะ Outlet นั้น พร้อมเหตุผล "void SC ก่อน"
  (spec เดิมให้ void Stock Out อัตโนมัติ — **เปลี่ยน**)
- ไฟล์ใหม่ (Source/store ต่างกัน) ของวันที่ post แล้ว → บรรทัด **late**: `sales_consumption_id = NULL`,
  `stock_out_id = NULL`, หาเจอจาก `sale_date`; SC ขึ้นเตือน "มียอดขายเข้ามาหลัง post" — void แล้ว SC ใหม่รับทั้งบรรทัดเดิม
  และ late · ยกเลิกการนำเข้าที่มีแต่บรรทัด late ทำได้
- SC `pending` ที่ไม่เหลือบรรทัด (ยกเลิก/เขียนทับจนหมด) → ลบทิ้ง; ปฏิทินคิดสถานะใหม่จากข้อมูลจริง

**ปฏิทิน**
- **ทั้ง BU ไม่มีตัวเลือก location** แบบรายเดือน; คลิกวัน → เปิด SC ของวันนั้น (ไม่มี SC → บอกเหตุผล + ลิงก์ไป Import POS ของวันนั้น)
- **"ไม่มีไฟล์"** = ไม่มีการนำเข้าสำเร็จของวันนั้นเลย นับเฉพาะตั้งแต่วันแรกที่ BU เคยนำเข้าสำเร็จ จนถึงเมื่อวานตาม
  timezone ของ BU (วันนี้ยังไม่ถือว่าขาด) — กันปฏิทินแดงทั้งเดือนก่อนเริ่มใช้
- **มีบาง store/แบรนด์ที่ไฟล์ไม่มา** (เช่น Simphony มา Micros ไม่มา) → ช่องยังเป็นสถานะตาม SC แต่ขึ้นเครื่องหมายเตือน
  "ไฟล์ไม่ครบ" เมื่อ store ที่เคยนำเข้าในช่วง 7 วันก่อนไม่มีไฟล์วันนี้ — SC detail แสดงรายการไฟล์ที่เข้ามาและ store ที่ขาด
- **"ไม่มียอดขาย"** = มีการนำเข้าสำเร็จแต่ไม่มีบรรทัด Qty สุทธิ > 0

**สิทธิ์ / license / อื่น ๆ**
- Import POS (อัปโหลด/ยกเลิก): สิทธิ์ของหน้า Interface POS เดิม — builder ตรวจคีย์กับ DB
- Sales Consumption ดู: `stock_out.view` · Post **และผูก/ignore**: `stock_out.create` · Void: `stock_out.delete`
  — คนที่ post ต้องแก้บรรทัดค้างเองได้ ไม่งั้นติดทาง
- **เปิดใช้เมื่อ BU มี interface POS** (user สั่ง) — "มี" = BU ได้ license POS interface (`interface.pos.*` ใต้ INF) **และ** เปิด
  (`enabled`) แบรนด์ POS อย่างน้อยหนึ่งตัวในหน้าตั้งค่า Interface (ผมตีความเอง) · ไม่มี → สองเมนูไม่ขึ้นในเมนู Operational Planning
  และเข้าทาง URL ตรงได้หน้า "ยังไม่ได้เปิด POS interface" พร้อมบอกให้ admin ตั้งค่า (ไม่ใช่หน้า error) · BE ตอบ endpoint ของ SC ด้วย
  error catalog เดียวกันเมื่อ BU ไม่มี POS interface · Import POS แสดงปุ่มอัปโหลดเฉพาะแบรนด์ที่เปิด
- **License**: ใช้ license feature ของ POS interface เดิม — **ไม่เพิ่ม key ใหม่** ไม่งั้นหน้าล็อกทันทีที่ deploy; builder ดูว่า
  `licenseFeature` ใน `module-list.ts` รับ key ของ interface ได้หรือไม่ ถ้าไม่ได้ ให้ไม่ใส่ `licenseFeature` แล้ว gate ด้วยเงื่อนไขข้างบน
- SC ที่เกิดจากรอบ SFTP: `created_by` = system user แบบเดียวกับการนำเข้า SFTP

### 4.3 ปฏิทิน — กติกาสถานะต่อวัน (ทั้ง BU)
| สถานะ | เงื่อนไข | สี (token) |
|---|---|---|
| **Posted** | SC ของวันนั้น `posted` | success |
| **Pending post** | SC `pending` (มียอดขาย) — แสดงจำนวนบรรทัดค้างผูกถ้ามี | warning |
| **ไม่มียอดขาย** | มีการนำเข้าสำเร็จแต่ไม่มียอด Qty > 0 | neutral |
| **ไม่มีไฟล์** | ไม่มีการนำเข้าสำเร็จเลย (ในช่วงตาม §4.2) | destructive/แดง |

เครื่องหมายเสริม: "มียอดขายเข้ามาหลัง post" และ "ไฟล์ไม่ครบ" · สีใช้ token ของ design system อ่านออกทั้ง light/dark
และมีข้อความกำกับ ไม่ใช้สีอย่างเดียว

## 5. รูปร่างของงาน

### 5.1 ข้อมูล (ข้อเสนอ — builder ปรับชื่อได้)
- `tb_pos_item` + `is_ignored boolean default false` (check: ignored ⇒ `recipe_id IS NULL`)
- `tb_sales_consumption` — `sc_no`, `sale_date` (date), `status` (`pending`/`posted`/`voided`),
  `posted_at/by`, `voided_at/by`, `void_reason?`, audit; unique partial (`sale_date`) where `status <> 'voided'`
- ความสัมพันธ์ SC ↔ Stock Out (หลายใบ): ตาราง link หรือ `sales_consumption_id` บน Stock Out (อ้าง SC แบบเดียวกับที่
  spec เดิมอ้าง import/outlet) — builder เลือก
- `tb_pos_sale_line` + `location_id?`, `recipe_id?`, `is_ignored?` (override รายบรรทัด; null = ตาม master) — แก้ได้เมื่อบรรทัดยังไม่ตัด (`stock_out_id IS NULL`)
- `tb_pos_sale_line` + `sales_consumption_id?` — บรรทัดอยู่ได้ใน SC ที่ไม่ voided ใบเดียว; ตอน void ล้าง FK แล้วผูกกับ
  SC ใบใหม่; `stock_out_id` เดิมยังเป็นตัวกันตัดซ้ำระดับบรรทัด (บอกด้วยว่าบรรทัดนั้นไปลงใบของ location ไหน)
- เวลา (`*_at`) เป็น `TIMESTAMPTZ` UTC; `sale_date` เป็น date ของ BU (= DocDate ของไฟล์)

### 5.2 BE
- สร้าง/อัปเดต SC ของวันนั้นเมื่อการนำเข้าสำเร็จ (ใน transaction เดียวกับการบันทึกบรรทัด)
- `GET` list SC (กรองวันที่ช่วง, status) · `GET` SC detail: หัว + สรุป + ไฟล์ที่เข้ามา/store ที่ขาด + บรรทัดยอดขาย
  (item, outlet, location, qty, ยอด, สถานะ mapping) + วัตถุดิบที่จะตัด/ที่ตัดแล้ว **แยก location** (product, qty หน่วยคลัง,
  ต้นทุน, คงเหลือ ณ วันขาย, ขาด) + รายการ Stock Out
- `POST` on-hand verify ของ SC (บันทึกผล + เวลา + ลายเซ็นบรรทัด): คืนต่อ (location, product) {ต้องใช้, คงเหลือ ณ sale_date, ขาด} — ใช้ logic เดียวกับที่ post ใช้ตรวจ
- `GET` calendar: (month) → รายวัน {status, sc_id?, pending_mapping_count, late_lines, missing_stores}
- `POST` post SC และ `POST` void SC ตาม §4.2 — lock SC + บรรทัด, กดซ้ำ/พร้อมกันไม่เกิดชุดที่สอง
- บล็อก void Stock Out ที่มาจาก SC ที่ service layer
- master mapping: endpoint ผูก outlet/item ที่มีอยู่ + ignore/unignore item; list item กรอง `unmapped` / `mapped` / `ignored`
- endpoint ตั้ง/ล้าง location และ recipe/ignore รายบรรทัด (+ ธง "ตั้งเป็นค่าเริ่มต้นของ item") (ทีละบรรทัดหรือหลายบรรทัด) — ปฏิเสธถ้าบรรทัดตัดไปแล้วหรือ SC ไม่ใช่ `pending`
- ลบ endpoint ยืนยันต่อ (import, outlet) และ preview ราย import ที่ไม่มีคนใช้แล้ว
- error ใหม่ลง error catalog + i18n FE; api_name ใหม่ลง allowlist

### 5.3 FE
- `routes/operation-plan/import-pos/` — ย้ายจาก `routes/system-admin/interface/pos/`: ปุ่มอัปโหลดทั้งสองแบรนด์
  (แสดงเฉพาะแบรนด์ที่ BU เปิดไว้), สถานะ SFTP, ประวัติการนำเข้า, ดูบรรทัดดิบของการนำเข้า (เปิดจากแถวประวัติ);
  ลิงก์จากประวัติไป SC ของวันนั้น (แทนหน้า review เดิม) — ไม่มี mapping
- `routes/operation-plan/sales-consumption/` — list (การ์ดสรุป + ปฏิทิน / ตาราง SC + แท็บ **Mapping** (master):
  Outlet → Location, POS item → Recipe พร้อม Ignore/Unignore และตัวกรอง unmapped/mapped/ignored, ย้ายจาก
  `pos-outlet-mapping.tsx` / `pos-item-mapping.tsx`) และ `sales-consumption-detail` (หัว: วันขาย · ไฟล์ของวัน · ยอดขาย · Stock Out — **ไม่แสดงรายชื่อ locations / outlets ที่หัว**
  (user สั่ง; ดูได้จากคอลัมน์ในแท็บยอดขายและกลุ่มในแท็บวัตถุดิบ) · การ์ดสรุป ·
  แท็บ ยอดขาย (ลำดับคอลัมน์ตามที่ user กำหนด: **Outlet · Location · POS item · Recipe · Net qty · Amount**; Location เป็น dropdown ทุกบรรทัด บอกว่า "ตาม outlet" หรือ "แก้ที่บรรทัด") / วัตถุดิบแยก location / ประวัติ ·
  ผูก recipe หรือ Ignore บรรทัดค้างในตาราง · ปุ่ม Post หรือ Void ·
  รายการ Stock Out)
- หน้า Interface POS (`/system-admin/interface/pos/<brand>`) เหลือฟอร์มตั้งค่า + ลิงก์ "ไปที่ Import POS"
- เมนู: `importPos` และ `salesConsumption` ใต้ `operationPlan` ใน `module-list.ts` + i18n
- ใช้ `DataGrid`, `ListToolbar`, `VoidDialog` (`components/share/void-dialog.tsx`), status token ตาม `docs/DESIGN.md`;
  ปุ่มหลักหนึ่งปุ่มต่อหน้า; ข้อความผ่าน i18n (ห้าม `{}`); activity sheet ถ้า backend บันทึก SC ใน activity log
- ระวังกับดักเดิม: `useSearchParams` ห้ามผสม `useURL`/`useDataGridState`; editable DataGrid ต้อง memo columns

## 6. การรับงาน (ตรวจด้วย typecheck/lint + curl + เบราว์เซอร์ — ไม่เขียน test ใหม่ตามความต้องการของ user)
- นำเข้าสองไฟล์ (Simphony + Micros 3700) ของวันเดียวกัน → SC ใบเดียวของวันนั้นมีบรรทัดจากทั้งสองไฟล์
- Import POS ไม่มีปุ่มผูกใด ๆ; item ไม่ผูกและไม่ ignore อยู่บรรทัดเดียว → Post ปิด; outlet ไม่มี location → Post ปิด;
  ผูก/ignore ครบ → Post เปิด; ignore จำได้ในไฟล์วันถัดไป
- เปลี่ยน location ของบรรทัดหนึ่งเป็น BQ01 (outlet ผูก FB01) → ตอน post บรรทัดนั้นไปลงใบของ BQ01; แก้ outlet mapping
  ทีหลังไม่ทับ override; SC posted แก้ location ไม่ได้
- เปลี่ยน recipe ของบรรทัดหนึ่ง → บรรทัดอื่นของ item เดียวกันไม่เปลี่ยน; ติ๊กตั้งเป็นค่าเริ่มต้น → master เปลี่ยน
  และบรรทัดอื่นที่ไม่มี override เปลี่ยนตาม
- Post วันที่มี 2 location → Stock Out 2 ใบ `SALE` location ละใบ วันที่ = วันขาย ยอดตามสูตร; กดซ้ำ/พร้อมกันไม่เกิดชุดที่สอง
- กด Verify on-hand (ข้างปุ่ม Post) → เปิดแท็บวัตถุดิบ ทุกแถวขึ้น OK/ขาด ถูก location; แก้บรรทัดแล้วผลตรวจหาย
- ยังไม่ verify → ปุ่ม Post ปิด และยิง API post ตรง ๆ ถูกปฏิเสธ; verify ผ่านแล้วแก้บรรทัด → post ถูกปฏิเสธจนกว่าจะ verify ใหม่
- location หนึ่งสต็อกไม่พอ → ไม่มี Stock Out ออกเลยสักใบ บอกสินค้าที่ขาดแยก location; วันขายนอกงวดเปิด → post ไม่ได้
- Void ในงวดเปิด → Stock Out ทุกใบ void, สต็อกคืน, SC ใบใหม่ `pending`; void ในงวดปิด → ถูกปฏิเสธ
- void Stock Out ที่มาจาก SC จากหน้า Stock Out → ถูกปฏิเสธ
- ยกเลิกการนำเข้า / Micros เขียนทับ ที่ชน SC `posted` → ถูกปฏิเสธ บอกให้ void SC ก่อน
- ปฏิทินแสดงครบ 4 สถานะถูกวัน + เครื่องหมาย late / ไฟล์ไม่ครบ; "ไม่มีไฟล์" ไม่ขึ้นก่อนวันแรกที่เคยนำเข้า
- หน้า Interface ไม่มีปุ่มยืนยันตัดสต็อกเหลือ; เมนูใหม่ไม่ล็อกด้วย license ใน env ที่เปิด POS interface
- BU ที่ไม่มี POS interface (ไม่มี license หรือไม่ได้เปิดแบรนด์ไหน) → ไม่เห็นสองเมนู; เข้าทาง URL ได้หน้าแจ้งว่ายังไม่เปิด; เปิดแบรนด์แล้วเมนูขึ้น

## 7. ลำดับงานและ deploy (ข้อเสนอ)
1. BE: schema (`is_ignored`, `tb_sales_consumption`, SC↔Stock Out, FK บรรทัด) + สร้าง SC ตอนนำเข้า + ignore endpoint
2. BE: list/detail/calendar + post (หลายใบต่อ location) + void (ตรวจงวด) + บล็อก void Stock Out ตรง + error catalog +
   allowlist; ลบ confirm เดิม
3. FE: ย้ายโค้ด POS → Import POS (raw); หน้า Interface เหลือตั้งค่า
4. FE: Sales Consumption list + ปฏิทิน + Mapping + detail + post/void

deploy ตามลำดับเดิมของ POS (migration ราย BU + seed `SALE` → BE + env → license/allowlist → cron → FE) —
เนื่องจาก POS ยังไม่เคย deploy งานนี้ควรเข้าก่อนหรือพร้อม deploy ครั้งแรก ไม่ต้องรองรับข้อมูลเก่า

## 8. ที่เหลือให้ builder ตัดสิน
- ชื่อตาราง/endpoint/คอลัมน์จริง, รูปแบบเลขที่ SC, ความสัมพันธ์ SC ↔ Stock Out
- จะแก้ migration POS เดิม (ยังไม่เคย apply) หรือเพิ่ม migration ใหม่
- โครง list: ตาราง + ปฏิทินเป็นแท็บ/สลับมุมมอง หรือปฏิทินอยู่เหนือตาราง
