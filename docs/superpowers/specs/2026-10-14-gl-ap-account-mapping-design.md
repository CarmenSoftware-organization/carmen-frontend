# Mapping GL/AP (Chart of Account Mapping) — design

**วันที่:** 2026-10-14 · **สถานะ:** รอรีวิว spec
**repo:** carmen-turborepo-backend-v2 (tenant prisma schema · micro-business · backend-gateway) · carmen-inventory-frontend-react
**FE branch:** `feature/gl-ap-account-mapping`

## 1. เป้าหมาย

ทำหน้า `/config/chart-of-account-mapping` ที่ตอนนี้อ่าน mock (`coam-mock.ts`) ให้เป็นของจริง หน้านี้บอกว่าธุรกรรมคลังของแต่ละ
**location × item group × movement** จะลงบัญชีด้วย **account code** ไหนและ **cost center** ไหน ผลลัพธ์ชุดเดียวกันถูกใช้ 2 ทาง
คือการลงบัญชีภายใน (AP/GL ของ Carmen Blue) และการส่งออกไประบบบัญชีภายนอก ทั้งสองทางเรียก resolver ตัวเดียวกัน (§4)

### ข้อตกลงกับผู้ใช้ (brainstorm + ประชุมทีม 2026-10-14)

- **Location ผูกแค่ cost center** ส่วน **Category / Sub-category / Item group ผูก account code 2 ชนิด** คือ Inventory account
  และ Direct account ระดับล่างที่ไม่ตั้งค่าจะสืบทอดจากระดับบน (item group → sub-cat → cat)
- **เลือก Inventory หรือ Direct ตาม location type:** location `inventory` ใช้ Inventory account ส่วน location `direct` ใช้
  Direct account ("direct" เป็นศัพท์ฝั่ง operation หมายถึงเบิกแล้วใช้หมด ฝ่ายบัญชีจะตั้งบัญชีนี้เป็น expense หรือ COGS ก็ได้)
- **consignment ไม่ post อะไรเลย** ทั้ง AP และ GL จึงไม่มีแถว mapping และไม่ส่งออกใน JSON ไปฝั่งบัญชี
- **grain ของแถว = Location × Item Group** แล้วแยกย่อยตาม movement
- **AP มาจาก GRN และ CN** ส่วน **GL มาจาก Adjustment (stock in/out ตาม adjustment type) และ SR** โดย SR แยกเป็น
  **SR out = คลังต้นทาง** และ **SR in = คลังปลายทาง** ถ้า SR in ลงคลังที่เป็น inventory จะมีความหมายเป็น transfer ถ้าลงคลัง direct
  จะเป็น issue ความหมายนี้อ่านได้จากคอลัมน์ location type โดยไม่ต้องมี logic เพิ่ม
- **แต่ละแถวแก้ได้ 2 ช่อง** คือ account code และ cost center ทั้งสองช่องโหลดค่า default มาให้ แล้วผู้ใช้แก้ทับได้
- **adjustment type ไม่มีบัญชี default** เพราะ type ตัวเดียวใช้กับทุกหมวด แต่บัญชีค่าใช้จ่ายต้องแยกอาหารกับเครื่องดื่ม จึงละเอียดไม่พอ
- **แถวเก็บแค่ค่าที่แก้ทับ (แนวทาง A):** ช่องที่เป็น null แปลว่าสืบทอดสดจาก master ถ้าแก้ master ภายหลัง แถวที่ไม่ได้แก้ทับจะตามไปเอง
- **สร้างแถวได้ 2 โหมด:** "ทั้งหมดล่วงหน้า" หรือ "เฉพาะที่ใช้" โดย "ที่ใช้" = สินค้าที่ผูกกับ location รวมกับธุรกรรมที่เกิดขึ้นแล้ว
- **combination ที่ยังไม่มีแถว** (ในเฟส posting): ลงบัญชีด้วยค่า default แล้วสร้างแถว `is_reviewed = false` ให้ เอกสารไม่ติด
- **แบ่งหน้าไม่เกิน 100 แถว** ตัวเลือก 10 / 20 / 50 / 100 และมีตัวกรอง cat / sub-cat / location type

### นอกขอบเขต (spec ถัดไป)

- การต่อเข้า posting จริง (GRN/CN → AP invoice, Adjustment/SR → JV) และรูปไฟล์/JSON ที่ส่งออกไประบบภายนอก
- ขั้น contract ที่ถอด `tb_location.department_account_code`
- activity sheet ของแถว mapping

## 2. คำถามค้าง (ต้องได้คำตอบก่อนเริ่ม spec posting)

1. **ขาที่สองของ adjustment GL:** แถว GL ของ adjustment (เช่น stock out · Food · คลัง A) มีบัญชีเดียว บัญชีนั้นคือฝั่งไหน
   และขาตรงข้ามมาจากไหน เช่น ใช้บัญชีคลังจากแถว AP-GRN ของ location × item group เดียวกัน หรือให้ฝั่ง accounting ประกอบเอง
   **ต้องถามทีมบัญชี** งานใน spec นี้ (ตาราง + หน้าจอ) ไม่ขึ้นกับคำตอบนี้
2. ฝั่งเจ้าหนี้ของ AP (Cr ของ GRN, Dr ของ CN) ใช้บัญชีจาก vendor หรือ AP setting เดิม ไม่ได้อยู่ในตาราง mapping ต้องยืนยันตอนทำ spec posting

## 3. Schema (tenant · expand เท่านั้น)

### 3.1 แก้ของเดิม

| ตาราง / enum | การเปลี่ยนแปลง |
|---|---|
| `enum_account_type` | เพิ่มค่า `direct` ต่อจาก `inventory, cogs, revenue, purchase` |
| `tb_location` | เพิ่ม `cost_center_id uuid?` FK → `tb_cost_center(id)` + index ส่วน `department_account_code` ยังเก็บไว้ (§7) |

cat / sub-cat / item group ใช้ตาราง `tb_product_account_code_mapping` เดิม (`account_type` + FK เจ้าของ 1 ใน 4 ตัว) ไม่ต้องสร้างตารางใหม่
บัญชี Inventory เป็นแถว `account_type = inventory` และบัญชี Direct เป็นแถว `account_type = direct`

### 3.2 ตารางใหม่ `tb_account_mapping`

```prisma
enum enum_account_mapping_type { AP GL }
enum enum_account_mapping_movement { grn cn adjustment sr_in sr_out }
enum enum_account_mapping_origin { generated_all generated_used auto_posting }

model tb_account_mapping {
  id                    String                        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  mapping_type          enum_account_mapping_type
  location_id           String                        @db.Uuid
  product_item_group_id String                        @db.Uuid
  movement              enum_account_mapping_movement
  adjustment_type_id    String?                       @db.Uuid   // บังคับมีค่าเมื่อ movement = adjustment, เป็น null ในกรณีอื่น

  account_code          String?                       @db.VarChar // null = สืบทอดจาก master
  cost_center_id        String?                       @db.Uuid    // null = สืบทอดจาก location

  origin                enum_account_mapping_origin
  is_reviewed           Boolean                       @default(false)

  doc_version   Int       @default(0) @db.Integer
  created_at    DateTime? @default(now()) @db.Timestamptz(6)
  created_by_id String?   @db.Uuid
  updated_at    DateTime? @default(now()) @db.Timestamptz(6)
  updated_by_id String?   @db.Uuid
  deleted_at    DateTime? @db.Timestamptz(6)
  deleted_by_id String?   @db.Uuid
  // relations → tb_location, tb_product_item_group, tb_adjustment_type, tb_cost_center
  @@index([mapping_type, location_id])
  @@index([product_item_group_id])
}
```

- **unique key** เป็น partial unique index ใน SQL migration แบบเดียวกับ `glbalance`
  เพราะ `adjustment_type_id` เป็น null ได้ และ null ไม่ชนกันเอง:
  `UNIQUE (mapping_type, location_id, product_item_group_id, movement, COALESCE(adjustment_type_id, '00000000-0000-0000-0000-000000000000')) WHERE deleted_at IS NULL`
- **CHECK constraint:** `(movement = 'adjustment') = (adjustment_type_id IS NOT NULL)`
  และ `mapping_type = 'AP'` ต้องคู่กับ `movement IN ('grn','cn')` ส่วน `GL` ต้องคู่กับ `movement IN ('adjustment','sr_in','sr_out')`
- ตารางนี้ไม่เก็บค่า default ที่ resolve แล้ว คอลัมน์ `account_code` / `cost_center_id` มีค่าเฉพาะเมื่อผู้ใช้แก้ทับเท่านั้น

## 4. Resolver (micro-business · `account-mapping` module)

ฟังก์ชันเดียวที่ทั้ง list, resolve endpoint และ posting ในอนาคตเรียกใช้

**อินพุต:** key (`mapping_type, location_id, product_item_group_id, movement, adjustment_type_id?`) หรือแถว `tb_account_mapping`

**ลำดับการหา account:**
1. `row.account_code` ถ้ามีค่า → `source: "override"`
2. ถ้าไม่มี ให้ดู `location_type` ก่อน: `inventory` ใช้ `account_type = inventory` ส่วน `direct` ใช้ `account_type = direct`
3. หาแถวใน `tb_product_account_code_mapping` ที่มีชนิดนั้น ไล่จาก item group → sub-category → category
   แล้วตั้ง `source` เป็น `"item_group" | "sub_category" | "category"` ตามระดับที่เจอ
4. ถ้าไม่เจอ คืน `account: null, issue: "missing_inventory_account" | "missing_direct_account"`

**ลำดับการหา cost center:** `row.cost_center_id` (`override`) → `tb_location.cost_center_id` (`location`)
→ ถ้าไม่มีทั้งคู่ คืน `null, issue: "missing_cost_center"`

**location consignment:** resolver คืน `skip: true` ไม่มี account ทั้ง list และ generate ไม่สร้างหรือแสดงแถวนี้

**ชื่อบัญชี:** join `tb_chart_of_accounts` ด้วย `code` เพื่อเอา `description_1` ถ้ารหัสไม่มีใน COA แล้ว
ให้คืน `issue: "account_not_in_coa"` (เกิดได้เมื่อ COA ถูกลบหลังตั้งค่า)

**ประสิทธิภาพ:** resolve เป็นชุดต่อหน้า (≤ 100 แถว) โดยโหลด location / item group (+ sub-cat, cat) / account-code mapping / COA / cost center
ของ id ที่เกี่ยวข้องอย่างละ 1 query แล้วคำนวณในหน่วยความจำ ห้าม query ทีละแถว

**`resolveForPosting()`** (สร้างไว้ใน spec นี้ แต่ยังไม่มีผู้เรียกจนกว่าจะถึง spec posting): ทำงานเหมือน resolve
แต่ถ้า key ยังไม่มีแถว จะ insert แถว `origin = auto_posting, is_reviewed = false` (ใช้ `ON CONFLICT DO NOTHING`)
ใน transaction ที่ส่งเข้ามา

## 5. API (gateway `/api/:bu_code/account-mapping` → micro-business)

| method · path | หน้าที่ |
|---|---|
| `GET /account-mapping` | list + resolve ค่าจริง |
| `PATCH /account-mapping/:id` | แก้ทับหรือคืนค่า default |
| `POST /account-mapping/review` | ยืนยันว่าตรวจแล้วทีละหลายแถว |
| `POST /account-mapping/generate` | สร้างแถว (idempotent) |
| `POST /account-mapping/resolve` | resolve key ที่ส่งมา แบบ read-only |

### 5.1 `GET`

query: `mapping_type` (บังคับ) · `page` · `perpage` (server จำกัดเพดาน 100 เอง ถ้าส่งเกินจะกดลง ไม่ตอบ 400) · `search`
(code/name ของ location, item group, account) · `location_id` · `location_type` · `category_id` · `sub_category_id` ·
`product_item_group_id` · `movement` · `adjustment_type_id` · `status` = `incomplete | overridden | default | unreviewed`

- `incomplete` = resolve แล้ว account หรือ cost center ยังเป็น null
- `overridden` = มีอย่างน้อยหนึ่งช่องที่แก้ทับ
- `default` = ไม่มีช่องไหนแก้ทับ
- `unreviewed` = `is_reviewed = false`

`incomplete` คำนวณได้หลัง resolve เท่านั้น จึงใช้ SQL view หรือ CTE ที่ทำ resolve แบบ COALESCE ตามลำดับเดียวกับ §4
เพื่อให้กรองและนับได้ฝั่ง DB และ pagination ถูกต้อง ต้องมีเทสต์ที่ยืนยันว่า view กับ resolver ใน TS ให้ผลตรงกัน (§8)

response (envelope list เดิม `data.items` + `paginate`) ต่อแถว:

```jsonc
{
  "id": "…", "mapping_type": "GL", "movement": "adjustment", "doc_version": 3,
  "location": { "id": "…", "code": "1MK01", "name": "…", "location_type": "inventory" },
  "category": { "id": "…", "code": "1", "name": "Food" },
  "sub_category": { "id": "…", "code": "10", "name": "Meat" },
  "item_group": { "id": "…", "code": "1001", "name": "…" },
  "adjustment_type": { "id": "…", "code": "SPOIL", "name": "Spoilage", "type": "stock_out" },  // null ถ้าไม่ใช่ adjustment
  "account": { "code": "1106002", "name": "INVENTORY - …", "source": "item_group", "issue": null },
  "cost_center": { "id": "…", "code": "F&B", "name": "…", "source": "location", "issue": null },
  "origin": "generated_used", "is_reviewed": true,
  "audit": { … }
}
```

`meta` คืนจำนวนแยกตาม status ของ `mapping_type` นั้นด้วย (`counts: { incomplete, overridden, default, unreviewed }`) เพื่อเอาไปแสดงบนหัวแท็บและ chip

### 5.2 `PATCH /:id`

body: `{ account_code?: string | null, cost_center_id?: string | null, doc_version: number }`

- ส่ง `null` = กลับไปสืบทอด ส่วน field ที่ไม่ส่งมาจะไม่ถูกแตะ
- `account_code` ต้องมีอยู่ใน `tb_chart_of_accounts` และ active ถ้าไม่ผ่านตอบ 422 พร้อม field
  ส่วน `cost_center_id` ต้องมีอยู่และ active ถ้าไม่ผ่านตอบ 422
- ถ้า `doc_version` ไม่ตรงตอบ 409
- หลังบันทึกตั้ง `is_reviewed = true`, `doc_version + 1` แล้วคืนแถวที่ resolve แล้ว (รูปเดียวกับ §5.1)

### 5.3 `POST /review`

body: `{ ids: string[] }` (สูงสุด 100) ตั้ง `is_reviewed = true` แล้วคืน `{ updated }`

### 5.4 `POST /generate`

body: `{ mapping_type?: "AP" | "GL", mode: "all" | "used" }` (ไม่ส่ง `mapping_type` = ทั้งสอง)

- **ชุดคู่ (location, item group):**
  - `all` = location ที่ active และไม่ใช่ consignment × item group ที่ active
  - `used` = (1) `tb_product_location` join product → item group รวมกับ (2) บรรทัด GRN, CN, Adjustment และ SR
    (SR นับทั้ง location ต้นทางและปลายทาง) ที่ไม่ถูกลบ โดยตัด consignment ออกเสมอ
- **ขยายเป็น movement:**
  - AP → `grn`, `cn`
  - GL → `sr_in`, `sr_out` และ `adjustment` × adjustment type ที่ active ทุกตัว (รวม `eop_in` / `eop_out`)
- ทำด้วย `INSERT … SELECT … ON CONFLICT DO NOTHING` คำสั่งเดียวต่อ `mapping_type` ห้าม loop ใน Node
  เพราะโหมด all อาจได้หลักแสนแถว
- **ไม่ลบและไม่เขียนทับแถวเดิม** กดซ้ำหรือสลับโหมดได้ ผลคือเติมแถวที่ขาดเท่านั้น
- แถวที่สร้างได้ `origin = generated_all | generated_used` และ `is_reviewed = true` เพราะผู้ใช้เป็นคนสั่งสร้างเอง
- คืน `{ created: { AP, GL }, existing: { AP, GL } }`

### 5.5 `POST /resolve`

body: `{ lines: Key[] }` (สูงสุด 500) คืน `{ results: [{ key, account, cost_center, skip }] }`
**ไม่สร้างแถวและไม่มีผลข้างเคียง** ใช้สำหรับ preview และระบบส่งออกภายนอก

### 5.6 สิทธิ์และ license

- ใช้ license feature `configuration.chart_of_account_mapping` เดิม (`constant/module-list.ts`) **ห้ามตั้งคีย์ใหม่**
  เพราะ `LICENSE_ENFORCEMENT` เปิดอยู่ทุก env ถ้าตั้งคีย์ใหม่ หน้าจะล็อกทันทีที่ deploy
- permission ของ endpoint ใช้คีย์ resource ที่หน้า mapping ใช้อยู่ ตอนทำ plan ต้อง**ตรวจกับตาราง permission ใน DB จริง**
  เพราะคีย์ที่ไม่มีใน DB ทำให้ผู้ใช้ที่ไม่ใช่ admin เข้าไม่ได้แบบเงียบ ๆ (admin bypass จึงไม่มีใครเห็นปัญหา)
  ถ้าคีย์ยังไม่มีให้เพิ่มใน seed
- api_name ใหม่ทั้ง 5 ตัวต้องเติมใน app-id allowlist ก่อน deploy FE ไม่อย่างนั้นผู้ใช้จะโดน 401 แล้วถูกเด้งไปหน้า login

## 6. Frontend

### 6.1 หน้า `/config/chart-of-account-mapping` (เขียนใหม่ทับ mock)

ใช้ route, เมนู, permission และ license เดิม แล้วลบ `coam-mock.ts` ทิ้ง ไฟล์อยู่ใน `routes/config/chart-of-account-mapping/`:

| ไฟล์ | หน้าที่ |
|---|---|
| `coam-component.tsx` | ListPageShell + แท็บ AP/GL + toolbar + ตาราง |
| `use-coam-table.tsx` | columns (memoize · `"use no memo"`) |
| `use-account-mapping.ts` | query list (+ counts), mutations patch / review / generate |
| `coam-filter-fields.ts` | ตัวกรองผูก URL ผ่าน `useListFilters` |
| `coam-edit-sheet.tsx` | sheet แก้ไขแถว |
| `coam-generate-dialog.tsx` | dialog สร้างแถว |

`types/chart-of-account-mapping.ts` เขียนใหม่ให้ตรงกับ response ใน §5.1

- **แท็บ AP / GL:** ตัวเลขบนหัวแท็บ = `counts.incomplete` ของแท็บนั้น
- **ตัวกรอง:** Location · Location type (inventory/direct) · Category → Sub-cat → Item group (cascade, lazy lookup ไม่ใช้ `perpage=-1`) ·
  Movement · Adjustment type (เฉพาะแท็บ GL) · status chips `ยังไม่ครบ` `แก้ทับ` `default` `ยังไม่ตรวจ` พร้อมจำนวน · ช่องค้นหา
- **คอลัมน์ AP:** Location · Location type · Category · Sub-cat · Item group · Movement (GRN/CN) · Account · Cost center · สถานะ
- **คอลัมน์ GL:** ชุดเดียวกับ AP โดย Movement เป็น Adjustment / SR in (ปลายทาง) / SR out (ต้นทาง) และเพิ่มคอลัมน์ **Adjustment type**
- **ช่อง Account / Cost center:** แสดงรหัสพร้อมชื่อ และป้ายที่มา (`default · item group` หรือ `แก้ทับ` ใช้คนละสี) ถ้าได้ null จะขึ้นเป็นช่องเตือนพร้อมข้อความตาม `issue`
  ข้อความใช้ `text-warning-ink` / `text-destructive` ห้ามใช้ token สีพื้นเป็นสีตัวอักษร
- **แก้ไข:** คลิกแถวแล้วเปิด sheet ด้านขวา **ไม่แก้ inline ในตาราง** เพราะ editable DataGrid เคยทำเบราว์เซอร์ค้าง ภายใน sheet มี
  lookup บัญชีจาก COA, lookup cost center, ค่า default แสดงไว้เทียบ, ปุ่ม "กลับไปใช้ default" ทีละช่อง
  บันทึกพร้อม `doc_version` ถ้าได้ 409 จะแสดงข้อความแล้ว refetch
- **เลือกหลายแถว → "ยืนยันว่าตรวจแล้ว"** เรียก `POST /review`
- **ปุ่ม "สร้างแถว mapping":** dialog ให้เลือกโหมด "เฉพาะที่ใช้" (ค่าเริ่มต้น) หรือ "ทั้งหมดล่วงหน้า" และประเภท AP / GL / ทั้งสอง
  มีคำอธิบายว่าการกดไม่ลบและไม่เขียนทับแถวเดิม เมื่อเสร็จขึ้น toast จำนวนที่สร้าง
- **แบ่งหน้า:** 10 / 20 / 50 / 100 ไม่มีตัวเลือก "ทั้งหมด"
- **ทางลัดไปแก้ต้นทาง:** คลิกป้าย `default · item group` (หรือ sub-cat / cat / location) แล้วเปิดหน้า master ของค่านั้น

### 6.2 ฟอร์ม master

- **Category / Sub-cat / Item group** (`routes/product-management/category/category-form.tsx` ใช้ร่วมกันทั้ง 3 ระดับ): เพิ่มส่วน
  "บัญชี" มีช่อง Inventory account และ Direct account (lookup COA) เขียนผ่าน payload `account_codes { add, update, remove }`
  ที่ backend รองรับอยู่แล้ว (`applyAccountCodesWrite`) ช่องที่ว่างจะมี placeholder บอกค่าที่สืบทอด เช่น "สืบทอดจาก Sub-cat: 1106002"
  ต้องตรวจตอนทำ plan ว่า DTO ของ category / sub-cat / item group รับ `direct` ได้หลังเพิ่ม enum
- **Location form:** เพิ่มช่อง Cost center (lookup จาก `GL_COST_CENTERS`) ไม่แสดง `department_account_code`

### 6.3 กติกาของรีโป

- i18n: เพิ่มคีย์ใน `messages/{en,th}.json` ห้ามมี `{{ }}` หรือ `{` ที่ไม่ใช่ ICU argument
- hook อยู่ใน feature ของตัวเอง ห้ามวางใน `hooks/` ห้าม import ข้าม module (`routes/product-management` ↔ `routes/config`)
  ถ้าต้องใช้ lookup COA ร่วมกัน ให้วางที่ `hooks/`

## 7. Migration และ deploy

1. migration A: `ALTER TYPE enum_account_type ADD VALUE IF NOT EXISTS 'direct'` แยกไฟล์ของตัวเอง เพราะ ADD VALUE ใช้ใน
   transaction เดียวกับคำสั่งที่อ้างค่านั้นไม่ได้
2. migration B: `tb_location.cost_center_id` + FK + index · enum ใหม่ 3 ตัว · `tb_account_mapping` + partial unique + CHECK
3. **ไม่ backfill** `cost_center_id` จาก `department_account_code` เพราะเป็น string อิสระที่ไม่ได้ผูกกับ `tb_cost_center` จึงแปลงอัตโนมัติไม่ได้ปลอดภัย
   ระหว่างนี้หน้า mapping จะแสดง `missing_cost_center` ให้ผู้ใช้ไปตั้งที่ location
4. ลำดับ: migration ทุก BU → deploy BE → เติม allowlist api_name 5 ตัว → ตรวจ permission key กับ DB (+ seed ถ้าขาด) → deploy FE
5. FE ขึ้นก่อน BE ไม่ได้ เพราะหน้าจะพังทั้งหน้า (ไม่มี mock สำรองแล้ว)
6. rollback: FE ย้อนได้อิสระ ส่วน BE ย้อนได้โดยไม่ต้อง drop ตาราง (expand-only) แต่ค่า enum `direct` ที่เพิ่มแล้วถอดไม่ได้
   ซึ่งไม่เป็นปัญหาเพราะไม่มีโค้ดเดิมที่อ่าน enum นี้แบบ exhaustive (ต้องตรวจตอนทำ plan ด้วย `grep enum_account_type`)

## 8. Error handling

| กรณี | ผลลัพธ์ |
|---|---|
| `perpage > 100` | กดลงเหลือ 100 |
| PATCH รหัสบัญชีไม่มีใน COA หรือ inactive | 422 + field |
| PATCH cost center ไม่มีหรือ inactive | 422 + field |
| `doc_version` ไม่ตรง | 409 → FE แสดงข้อความแล้ว refetch |
| generate ถูกกดพร้อมกัน 2 ครั้ง | ปลอดภัย (unique index + `ON CONFLICT DO NOTHING`) |
| resolve ไม่เจอค่า | ไม่ใช่ error: คืน `issue` |
| location ถูกเปลี่ยนเป็น consignment หลังสร้างแถว | แถวเดิมยังอยู่แต่ list ซ่อน และ resolver คืน `skip` |
| location / item group ถูกลบ | list ซ่อนแถว (join กรอง `deleted_at`) แต่ไม่ลบแถวจริง |

## 9. การตรวจสอบ

ตาม preference ของผู้ใช้: ระหว่าง execute plan ไม่เขียนเทสต์ใหม่ ยกเว้น 1 จุดที่จำเป็นจริง
คือ **เทสต์ความตรงกันระหว่าง SQL view (§5.1) กับ resolver ใน TS** เพราะถ้าสองตัวนี้ไม่ตรงกัน ตัวกรอง `incomplete` จะโกหกแบบเงียบ ๆ
ข้อนี้ต้องถามผู้ใช้ตอนทำ plan ว่าจะให้เขียนหรือไม่

- typecheck + lint ทั้ง BE และ FE · เทสต์เดิมต้องเขียวหมด (backend ใช้ jest ห้ามใช้ `bun test`)
- curl ทั้ง 5 endpoint บน dev (กรณีปกติ, 409, 422, perpage 500)
- ในเบราว์เซอร์:
  - generate โหมด used แล้วตามด้วย all ดูว่าจำนวนเพิ่มขึ้นและแถวเดิมไม่เปลี่ยน
  - แก้ทับแล้วกด "กลับไปใช้ default"
  - แก้ Inventory account ที่ sub-cat แล้วดูว่าแถวที่ไม่ได้แก้ทับเปลี่ยนตามทันที
  - ตรวจว่า location consignment ไม่มีแถว
  - เปลี่ยนขนาดหน้าแล้วกด back ดูว่าตัวกรองยังอยู่
- ก่อนเขียนข้อมูลลง dev DB (`:4000` = DB ที่ใช้ร่วมกัน) ต้อง backup ตารางที่เกี่ยวข้องก่อน
