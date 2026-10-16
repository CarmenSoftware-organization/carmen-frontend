# Inbound API key + Inventory Posting Export — Design

วันที่: 2026-10-16 · รีโป: `carmen-turborepo-backend-v2` (หลัก) + `carmen-inventory-frontend-react`

## เจตนา (ทำไม)

ลูกค้ามีระบบบัญชีของตัวเอง และต้องการดึงรายการบัญชีที่เกิดจาก inventory ใน Carmen ผ่าน REST
ตอนนี้ทำได้ทางเดียวคือใช้ user/password ของคนที่ login ซึ่ง (1) เลือก BU ตรง ๆ ไม่ได้
(2) ได้สิทธิ์ทั้งระบบเท่ากับ user คนนั้น งานนี้จึงสร้าง **API key ต่อ BU** ที่ admin ของลูกค้าสร้าง
ดู และ regenerate เองได้ที่หน้า Interface โดย key เรียกได้เฉพาะ API ส่งออกชุดนี้เท่านั้น

มุมมองของงาน: **Carmen Blue เป็นแค่ระบบ inventory** ระบบบัญชีของลูกค้าเป็นผู้ลงบัญชี
Carmen ส่งคู่เดบิต/เครดิตพร้อมรหัสบัญชีและ cost center ที่ resolve จาก Chart of Account Mapping
ให้ระบบบัญชีเอาไปลงได้เลย

## เป้าหมาย

1. key หนึ่งใบต่อ BU — ผูก BU ตายตัว ผู้เรียกไม่ต้องส่ง/เลือก BU
2. ชุด API ส่งออกแบบอ่านอย่างเดียว ครอบคลุมเอกสาร GRN, CN, SR, SI, SO ในรูปคู่ Dr/Cr ที่ balance
   พร้อม account code + cost center
3. บัญชีฝั่งตรงข้ามมี **ค่า default ที่ตั้งได้** (ไม่ต้องกรอก override ทุกแถว): AP ต่อ vendor → BU,
   ภาษีซื้อของ BU, บัญชีต่อ adjustment type
4. หน้า System Config → Interface → Accounting → **External**: สร้าง / ดู (ได้ตลอด) / regenerate / ปิดใช้งาน
5. การกด View secret ทุกครั้งถูกบันทึกลง activity log (ใคร เมื่อไหร่)
6. ระบบบัญชีรู้ได้ว่าเอกสารไหนถูกแก้หรือถูก void หลังจากดึงไปแล้ว

## ไม่ใช่เป้าหมาย

- ไม่มี API เขียนกลับ (ไม่แจ้งผล post, ไม่ mark ว่าดึงไปแล้ว) — ระบบบัญชีกันดึงซ้ำเอง
- ไม่ส่ง AP invoice / GL JV / payment ของ Carmen (เป็นงานของระบบบัญชีลูกค้า)
- ไม่มีเอกสาร EOP แยก — EOP มาในรูป SI/SO ที่ adjustment type มี `type` = `eop_in` / `eop_out`
- ไม่มีหลาย key ต่อ BU, ไม่มี scope เลือกประเภทเอกสารต่อ key
- ไม่มี grace period ตอน regenerate
- Carmen ไม่สร้างรายการกลับรายการ (reversal) ให้ — ส่งสถานะ `voided` แล้วระบบบัญชีกลับรายการเอง

## สิ่งที่ห้ามเกิด (anti-goals)

- key เรียก endpoint อื่นของ Carmen ได้ (นอกชุดส่งออก) หรือเรียกด้วย method อื่นนอกจาก GET
- key ของ BU หนึ่งอ่านข้อมูล BU อื่นได้ — ไม่ว่าจะส่ง `bu_code` ใน path/query มาอย่างไร
  (กับดักเดิม: KeycloakGuard ตรวจ `query.bu_code` แต่ handler ใช้ path → ข้าม tenant ได้)
- บรรทัดที่หา mapping ไม่เจอหายไปเงียบ ๆ — ต้องส่งออกพร้อมธงเสมอ (ยกเว้น consignment เท่านั้น)
- รายการที่ Dr = Cr เป็นบัญชีเดียวกันเพราะ fallback ตกไปที่บัญชีสินค้าทั้งสองฝั่ง
- secret เก่าใช้ได้หลัง regenerate หรือหลังปิดใช้งาน
- secret เก็บเป็น plaintext หรือโผล่ใน log / response ของ list
- เอกสารที่ถูกแก้หรือ void หลังเสร็จ หายจากมุมมองของระบบบัญชีโดยไม่มีสัญญาณ

## การตัดสินใจที่ user ตัดสินแล้ว

| เรื่อง | ตัดสิน |
|---|---|
| การจำกัด API | key ทุกใบได้ชุดส่งออกเดียวกันทั้งชุด; ห้ามเรียก API อื่นของ Carmen |
| ข้อมูลที่ส่ง | GRN, CN, SR, SI, SO (EOP = SI/SO type eop_in/eop_out) |
| รูปข้อมูล | คู่ Dr/Cr พร้อม account code + cost center ตาม mapping |
| คู่บัญชี | ตามตารางข้างล่าง — user ยืนยันครบทุกแถว |
| บัญชีฝั่งตรงข้าม | เพิ่มแหล่ง default ใหม่ (ไม่พึ่ง override มือ) |
| บัญชีเจ้าหนี้ | ต่อ vendor; vendor ไม่ได้ตั้ง → ค่าของ BU |
| VAT | ส่งยอดรวมภาษี และแยกบรรทัด Dr/Cr ภาษีซื้อ |
| แก้/void หลังเสร็จ | ส่งเวลาแก้ไขล่าสุด, ดึงตามเวลาแก้ไขได้, เอกสาร void ส่งออกพร้อมสถานะ `voided` |
| regenerate | secret เก่าหยุดใช้ทันที |
| ตำแหน่ง UI | ในแบรนด์ Accounting → External ที่มีอยู่ (license `interface.accounting.external`) |
| จำนวน key | ใบเดียวต่อ BU |
| ดู secret | กด View ดูได้ตลอด + บันทึก log ทุกครั้ง (user เลือกหลังรับทราบความเสี่ยง) |

## กติกาคู่บัญชี

| เอกสาร | Dr | Cr |
|---|---|---|
| GRN | สินค้า (GL `grn` @ location ของบรรทัด) ยอดก่อนภาษี + **ภาษีซื้อ** (บัญชีภาษีซื้อของ BU) | **เจ้าหนี้** (AP ของ vendor → BU) ยอดรวมภาษี |
| CN | **เจ้าหนี้** ยอดรวมภาษี | สินค้า (GL `cn`) ยอดก่อนภาษี + **ภาษีซื้อ** |
| SR | GL `sr_in` @ `to_location` | GL `sr_out` @ `from_location` |
| SI | สินค้า (GL `grn` @ location) | **บัญชีของ adjustment type** |
| SO | **บัญชีของ adjustment type** | สินค้า (GL `grn` @ location) |

ฝั่งสินค้าใช้ resolver เดิม (`resolveAccountMapping` — override → item group → sub category → category
เลือก inventory/direct ตาม `location_type`; cost center = override → location)

## แหล่ง default ใหม่ของบัญชีฝั่งตรงข้าม

ปัญหาที่พบ: resolver ปัจจุบันไม่ดู `mapping_type` / `movement` เลย ถ้าไม่มี override ทุกแถว (รวม AP และ adjustment)
ได้บัญชีสินค้าเดียวกันหมด → Dr สินค้า / Cr สินค้า งานนี้จึงต้องให้ resolver แยกตามชนิดก่อน:

| ฝั่ง | ลำดับ resolve (ตัวแรกที่มีค่าชนะ) |
|---|---|
| เจ้าหนี้ (AP `grn`/`cn`) | override ในแถว mapping → `tb_vendor.ap_chart_of_accounts_id` (**มีฟิลด์อยู่แล้ว** และ AP invoice ใช้อยู่ แต่ฟอร์ม vendor ฝั่ง FE ยังไม่มีช่อง) → บัญชีเจ้าหนี้ default ของ BU (ใหม่) |
| adjustment (SI/SO) | override ในแถว mapping → บัญชีของ adjustment type (ฟิลด์ใหม่บน `tb_adjustment_type`) |
| ภาษีซื้อ | บัญชีภาษีซื้อของ BU (ใหม่) |
| สินค้า / SR | resolver เดิม |

หมายเหตุ: แถว mapping AP ผูก location × item group ไม่ใช่ vendor — override ระดับแถวจึงชนะ vendor
(ผู้ออกแบบคงลำดับนี้ไว้เพื่อให้หน้า mapping เดิมยังมีความหมาย; ถ้า builder เห็นว่าควรให้ vendor ชนะ ให้ยกขึ้นมาถาม)

UI ที่ต้องเพิ่ม:
- ฟอร์ม vendor: ช่องบัญชีเจ้าหนี้ (เลือกจาก chart of accounts)
- adjustment type: ช่องบัญชี
- ค่าระดับ BU (บัญชีเจ้าหนี้ default + บัญชีภาษีซื้อ): **call ของผู้ออกแบบ** — วางในหน้า External เดียวกับ API key
  หรือ default-setting ของ BU ก็ได้ ให้ builder เลือกตามที่เก็บค่าที่เข้ากับ resolver ที่สุด
- หน้า mapping: แสดงค่าที่ resolve ตามกติกาใหม่ (AP / adjustment จะไม่โชว์บัญชีสินค้าอีก) และ
  เพิ่ม movement GL `grn` / GL `cn` ให้ generate และ override ได้ (ตอนนี้ `movementsSql` ไม่สร้างสองตัวนี้)
  — ต้องแก้ทั้ง resolver TS และ `statusCte` ใน SQL ให้ตรงกัน (คอมเมนต์ในไฟล์บังคับไว้)

## การขยายในอนาคต (ออกแบบรองรับไว้ ยังไม่สร้าง UI)

user แจ้งว่าในอนาคต base endpoint นี้อาจเปิดให้เรียก API อื่นเพิ่มได้ โดย **ตั้งค่าใน platform อนุญาตเป็นตัว ๆ**
ดังนั้น:

- ทุก endpoint ที่ key เรียกได้อยู่ใต้ prefix เดียว (เช่น `api/ext/v1/...`) และแต่ละตัวมี `api_name` ของตัวเอง
- Guard ตรวจ "api_name นี้เปิดให้ key ใช้หรือไม่" จาก **รายการที่เก็บใน platform DB** (แบบเดียวกับ
  `tb_application_api` + snapshot/refresh ของ app allowlist) ไม่ hardcode ในโค้ด guard
- งานนี้ seed รายการด้วย endpoint ส่งออกชุดเดียว เปิดให้ทุก key; **หน้า carmen-platform สำหรับเปิด/ปิดทีละตัว
  ไม่อยู่ในงานนี้** (ไม่ใช่เป้าหมายรอบนี้) แต่โครงตารางต้องรองรับการเพิ่มโดยไม่แก้ guard
- กติกา GET-only ผูกกับรายการ (method ต่อ api_name) ไม่ใช่กฎตายตัวทั้ง guard — รอบนี้ทุกแถวเป็น GET
- การอนุญาตเป็นระดับทั้งระบบหรือต่อ BU/ต่อ key: รอบนี้ทั้งระบบ (ทุก key ได้ชุดเดียวกันตามที่ user ตัดสิน);
  ถ้าโครงตารางเผื่อคอลัมน์ต่อ BU ได้โดยไม่ซับซ้อน ให้ builder พิจารณา — call ผู้ออกแบบ

## ส่วนที่เหลือให้ builder (พร้อม call ของผู้ออกแบบ)

ทุกข้อในส่วนนี้เป็น **call ของผู้ออกแบบ** ไม่ใช่ข้อตกลงกับ user — เปลี่ยนได้ถ้ามีเหตุผล

### Backend — ตัว key

- ตารางใหม่ฝั่ง **platform** (ข้าง `tb_mcp_token` / `tb_application`) เช่น `tb_bu_api_key`:
  `business_unit_id` (unique ต่อแถวที่ยังไม่ลบ), `client_id` (สุ่ม, public), `secret_hash` (sha256 ใช้ตรวจ),
  `secret_enc` (AES-GCM ผ่าน `packages/secret-crypto` ใช้สำหรับ View), `secret_last4`, `is_active`,
  `last_used_at`, audit fields
- credential: header `x-client-id` + `x-client-secret` (ตรวจด้วย hash + timingSafeEqual)
- Guard ใหม่ตามแบบ `McpTokenGuard` (extends `KeycloakGuard`, override `resolveIdentity`):
  บังคับ BU = BU ของ key (ไม่สนใจ `bu_code` ที่ผู้เรียกส่งมา), อนุญาตเฉพาะ api_name + method
  ที่อยู่ในรายการของ platform (ดู "การขยายในอนาคต"), ตรวจ INF license `interface.accounting.external` (หมดอายุ/ไม่มี = 403),
  rate limit ต่อ key, อัปเดต `last_used_at` แบบ throttle
- tenant: micro-business หา connection ด้วย `getdbConnectionByCode(user_id, bu_code)` ซึ่งอิงสมาชิก BU
  → ผู้ออกแบบเลือก resolver ใหม่ที่หา connection จาก BU ของ key โดยตรง จำกัดใช้เฉพาะ path นี้
  และรันในนาม system identity (ไม่สร้าง service user ในตาราง user) — builder ตรวจว่า service ที่ reuse
  ทน `userId` เป็น null/system ได้
- Endpoint ชุดส่งออกไม่ผ่าน `AppIdGuard` / allowlist ของ x-app-id (ผู้เรียกไม่ใช่แอปของเรา)
- Endpoint จัดการ key (Keycloak user ปกติ + AppIdGuard + allowlist): get (ไม่มี secret), create,
  regenerate, deactivate/activate, view-secret (log `view` ลง `tb_activity` ผ่าน `logTenantEvent`)
- regenerate = เขียนทับ hash/enc ในแถวเดิม → secret เก่าตายทันที

### Backend — API ส่งออก

- ตัวกรอง: ช่วงวันที่เอกสาร (`grn_date` / `cn_date` / `sr_date` / `si_date` / `so_date`) **หรือ** ช่วงเวลาแก้ไขล่าสุด,
  ประเภทเอกสาร, แบ่งหน้า
- สถานะที่ส่ง: สุดท้าย (GRN `committed`; CN/SR/SI/SO `completed`) + `voided` (ส่งพร้อมสถานะ ให้ระบบบัญชีกลับรายการ)
  — builder ยืนยันว่า "เวลาแก้ไขล่าสุด" ที่ใช้ขยับจริงเมื่อแก้หลัง commit (BE #694) และเมื่อ void
- ต่อเอกสาร: หัว (id, เลขที่, วันที่, ประเภท, สถานะ, เวลาแก้ไขล่าสุด, vendor สำหรับ GRN/CN,
  adjustment type code + type สำหรับ SI/SO, สกุลเงิน/อัตราแลกเปลี่ยน) + บรรทัด Dr/Cr
  (account_code, cost_center code, amount ในสกุลเงินฐาน, location, product/item group อ้างอิง,
  ธง `unmapped` + เหตุผลจาก resolver)
- จำนวนเงิน: GRN/CN ใช้ base amount ของบรรทัดเอกสาร (ยอดสุทธิหลังส่วนลด ไม่แยกบรรทัดส่วนลด — call ผู้ออกแบบ);
  SR/SI/SO ใช้ต้นทุนจาก `tb_inventory_transaction_cost_layer` ผ่าน `inventory_transaction_id`
  (SR ไม่มีต้นทุนบนบรรทัด); `extra_cost_amount` ใน cost layer — builder ตัดสินว่ารวมในยอดสินค้าหรือไม่
  แล้วระบุใน API doc
- ส่งต่อบรรทัดสินค้า ไม่รวมยอด — ระบบบัญชีรวมเอง
- resolver แบบอ่านอย่างเดียว — **ห้ามใช้ `resolveForPosting`** เพราะมัน insert แถว mapping
- `skip`: ตัดเฉพาะ location consignment; skip ด้วยเหตุอื่น (หา location/item group ไม่เจอ) → ส่งพร้อมธง
- ทุกเอกสารต้อง Dr รวม = Cr รวม (ยกเว้นบรรทัดที่ unmapped ก็ยังต้องมียอด แค่ account เป็น null)

### Frontend

- `routes/system-admin/interface/`: แบรนด์ `external` ใช้ฟอร์มเฉพาะ (`brandDef.form`) ที่มีส่วน "API Access":
  Base URL, Client ID, secret ปิดไว้ (เห็น last4) + ปุ่ม View (เรียก view-secret) + Copy,
  ผู้สร้าง/ใช้ล่าสุด, ปุ่ม Regenerate (confirm dialog), ปิด/เปิดใช้งาน; ยังไม่มี key = ปุ่ม "สร้าง key"
- ใช้กติกา license เดิม (`use-interface-entitlement`): expired = อ่านอย่างเดียว ซ่อนปุ่มเขียน
- สิทธิ์: ใครเปิดหน้า Interface ได้ก็จัดการ key ได้ (หน้านี้ไม่มี permission key อยู่แล้ว)
- ฟอร์ม vendor + adjustment type + ค่าระดับ BU + หน้า mapping ตามหัวข้อ "แหล่ง default ใหม่"
- ไม่มีปุ่ม copy กลางใน `components/` — ทำ helper เล็ก ๆ ได้ (ของเดิมมีแค่ inline ใน `error-state.tsx`)

## ข้อจำกัด / ลำดับ deploy

- migration tenant (ฟิลด์ adjustment type, ค่าระดับ BU ถ้าเก็บใน tenant) ทุก BU + migration platform (ตาราง key)
  → BE → เติม allowlist api_name ของ endpoint ใหม่ทุก env (**ไม่งั้น user โดน logout**) → FE
- env ต้องมี `SECRET_ENCRYPTION_KEY`
- dev DB เป็นของกลาง — backup `tb_account_mapping` และตารางที่แตะก่อนเขียน
- งานแบ่งเป็นสองช่วงที่ส่งแยกได้: (1) แหล่ง default + resolver ใหม่ + UI mapping/vendor/adjustment type
  (2) API key + export + หน้า External — ช่วง 2 พึ่งช่วง 1 เพื่อให้คู่บัญชี balance
