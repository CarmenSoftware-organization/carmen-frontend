# สูตรอาหาร: โหมดทำอาหาร · วัตถุดิบจริง · คำแนะนำราคา — design

วันที่ 2026-10-16 · รีโป: `carmen-inventory-frontend-react` (FE) + `carmen-turborepo-backend-v2` (BE)
หน้าอ้างอิง (prototype, ข้อมูล mock): `carmen-inventory-dev.vercel.app/operational-planning/recipe-management/recipes/recipe-004`

## ทำไม

หน้าสูตร `/operation-plan/recipe/:id` วันนี้เป็นฟอร์มแก้ไขอย่างเดียว คนใช้หน้านี้มีสองกลุ่มที่ทำงานคนละแบบ:

- **เชฟ** เปิดบน**แท็บเล็ตในครัว** ระหว่างยืนทำอาหารหน้าเตา — ต้องการเห็น**ขั้นตอนทำก่อน**
  สิ่งอื่น ไม่ต้องการช่องกรอก (เกะกะและแตะพลาด)
- **ผู้จัดการ** เปิดมา**ตั้งราคาขาย** — ยึด**เป้า food cost % รายเมนู** และมี**ขั้นต่ำ**ที่ไม่ควรต่ำกว่า

และตอนนี้วัตถุดิบในฟอร์มเป็นแค่พรีวิวที่ไม่บันทึก ต้นทุนจึงต้องพิมพ์เองทั้งก้อน

## เป้าหมาย

1. โหมดทำอาหาร (อ่านอย่างเดียว) สำหรับแท็บเล็ต เปิดมาเจอขั้นตอนทำ
2. แก้ไข/บันทึกขั้นตอนทำได้ในฟอร์ม
3. วัตถุดิบบันทึกจริง ผูกสินค้าในคลัง ต้นทุนดึงจากต้นทุนเฉลี่ยในคลังอัตโนมัติ
4. ผู้จัดการกด "คำนวณใหม่" เพื่อดึงต้นทุนปัจจุบัน เห็นส่วนต่างก่อนบันทึก
5. คำแนะนำราคา: ราคาที่เป้า / ราคาขั้นต่ำ + markup
6. บันทึกการจัดจาน (plating) และการเก็บรักษา (storage)

## ไม่ทำ (non-goals)

- Sub-recipe (ใช้สูตรอื่นเป็นวัตถุดิบ) — DB รองรับแล้วแต่ต้องกันวนซ้ำ/คิดต้นทุนซ้อนชั้น ไว้รอบหน้า
- ตัวจับเวลา · ปรับจำนวนที่ (scale) · รูป/วิดีโอรายขั้นในโหมดทำอาหาร (API รูปขั้นตอนมีแล้ว ยังไม่ใช้)
- Inventory status / Ordering info / Create PO / Competitor analysis ของหน้าอ้างอิง (เป็น mock ที่นั่นเอง)
- ค่า Labor/Overhead default ตามหมวด (หน้าอ้างอิงมี แต่ user ยึดค่ารายเมนู)

## Anti-goals (ถือว่าล้มเหลวแม้ทำงานได้)

- ต้นทุน/food cost % ในหน้ารายการ **ขยับเองเงียบ ๆ** เมื่อราคาคลังเปลี่ยน — ต้องผ่านการกด "คำนวณใหม่" + บันทึกเท่านั้น
- เชฟแก้สูตรได้จากโหมดทำอาหารโดยไม่ตั้งใจ
- ราคาต่ำกว่าขั้นต่ำแล้ว**บล็อกการบันทึก** — ต้องเตือนเท่านั้น (บางทีจงใจขายต่ำ เช่นโปรโมชัน)

## สิ่งที่ user ตัดสินแล้ว

| เรื่อง | ตัดสิน |
|---|---|
| layout เชฟ | **แบบ A**: หน้าแยก อ่านอย่างเดียว ทีละขั้น ตัวใหญ่ ปุ่มใหญ่, วัตถุดิบเป็นเช็กลิสต์ด้านข้าง, plating/storage ใต้วัตถุดิบ, ปุ่ม "แก้ไขสูตร" ไปฟอร์ม |
| ราคา | เป้า food cost % รายเมนู + มีขั้นต่ำ; ต่ำกว่าขั้นต่ำ = เตือนแดง ไม่บล็อก |
| ต้นทุนวัตถุดิบ | ดึงต้นทุนเฉลี่ยจากคลังอัตโนมัติ (แก้มือไม่ได้) |
| การอัปเดตต้นทุน | ผู้จัดการกด "คำนวณใหม่" เอง เห็นส่วนต่างก่อนบันทึก |
| ขอบเขต | ไม่ทำ sub-recipe รอบนี้ |

## Design

### 1. Routing

- `/operation-plan/recipe/:id` → **โหมดทำอาหาร** (route ใหม่ `recipe-cook.route.tsx` หรือเปลี่ยน `recipe-edit.route.tsx` ให้เรนเดอร์ cook view)
- `/operation-plan/recipe/:id/edit` → ฟอร์มเดิม (`RecipeEditContent`)
- คลิกแถวในหน้ารายการ → โหมดทำอาหาร; เมนู ⋯ ของแถวมี "แก้ไข" ตรงไป `/edit`
- ปุ่ม "แก้ไขสูตร" ในโหมดทำอาหารแสดงเฉพาะเมื่อ `useCan` ผ่าน `operation_plan.recipe` update
- หลังบันทึกในฟอร์มยังอยู่ที่ฟอร์ม (พฤติกรรมเดิม)

### 2. โหมดทำอาหาร (cook view)

ออกแบบสำหรับแท็บเล็ตแนวนอน (≥ 768px) เป็นหลัก; จอแคบให้วัตถุดิบลงไปอยู่ใต้ขั้นตอน

- **หัว**: ชื่อสูตร, รหัส, จำนวนที่ (yield + หน่วย), เวลารวม, ปุ่ม "แก้ไขสูตร"
- **คอลัมน์หลัก (ขั้นตอน)**: แสดงขั้นปัจจุบันเด่น — "ขั้นที่ n / N", ระยะเวลา, อุปกรณ์, อุณหภูมิ (+หน่วย),
  คำอธิบายตัวใหญ่, `safety_warnings` เป็นกล่องเตือนสีเตือน, `chef_notes` รอง; ขั้นถัดไปแสดงจาง ๆ ข้างล่าง
  ปุ่ม ก่อนหน้า/ถัดไป ขนาดใหญ่ (เป้าแตะ ≥ 48px) + คีย์ลูกศรซ้าย/ขวา + แตะที่ขั้นในรายการเพื่อกระโดด
- **คอลัมน์ข้าง**: เช็กลิสต์วัตถุดิบ (ชื่อ · จำนวน · หน่วยสูตร) ติ๊กได้ เก็บใน state ของหน้าเท่านั้น
  (รีเฟรชแล้วหาย), ใต้นั้น "จัดจาน" และ "การเก็บรักษา", และ allergens เป็น badge
- ไม่มีช่องกรอกเลย ไม่มีตัวเลขต้นทุน/ราคา
- **Wake Lock**: ขอ `navigator.wakeLock.request('screen')` ตอนเปิดหน้า ขอใหม่เมื่อแท็บกลับมา visible,
  ปล่อยตอนออก; browser ไม่รองรับ = เงียบ ๆ ไม่ทำอะไร *(การตัดสินใจของ Claude — user ไม่ได้ค้าน)*
- ไม่มีขั้นตอน → empty state + ลิงก์ไปฟอร์ม (ถ้ามีสิทธิ์)
- ช่วงที่ 2 ยังไม่มีวัตถุดิบจริง → คอลัมน์ข้างแสดงเฉพาะ plating/storage/allergens

### 3. ขั้นตอนทำในฟอร์ม

ส่วนใหม่ในฟอร์ม (ระหว่าง Ingredients กับ Safety & Compliance) แก้รายการขั้นตอน:
คำอธิบาย (บังคับ), ชื่อขั้น, ระยะเวลา (นาที), อุณหภูมิ + หน่วย (c/f), อุปกรณ์ (เลือกหลายตัวจาก
master `RECIPE_EQUIPMENT`), chef notes, safety warnings; ลากหรือปุ่มขึ้น/ลงเพื่อเรียง

BE มี API ครบแล้ว ใต้ `api/config/:bu_code/recipes/:recipe_id/preparation-steps`
(`GET`, `POST` add หลายขั้น, `PATCH :stepId` ต้องมี `doc_version`, `DELETE :stepId`, `PUT order`)
— ดู `apps/backend-gateway/src/config/config_recipes/preparation-steps.controller.ts`
และ schema ใน `apps/backend-gateway/src/common/dto/recipe/preparation-step.dto.ts`

- `equipment` เป็น JSON array — เก็บ `{ id, name }` ของ equipment master (*การตัดสินใจของ Claude*: เก็บชื่อไว้ด้วย
  เพื่อให้โหมดทำอาหารแสดงได้โดยไม่ต้อง lookup และไม่พังถ้า equipment ถูกลบ)
- **ลำดับการบันทึก**: บันทึกหัวสูตรก่อน แล้ว diff ขั้นตอนกับของเดิม → DELETE ที่หายไป, PATCH ที่แก้,
  POST ที่ใหม่, แล้ว PUT order ถ้าลำดับเปลี่ยน ทั้งหมดอยู่ใต้ปุ่ม Save เดียวของฟอร์ม
  ความไม่เป็น atomic ยอมรับได้ (ล้มกลางทาง = แจ้ง error, refetch, ข้อมูลที่บันทึกไปแล้วคงอยู่)
- สูตรใหม่ (`/new`): ส่วนขั้นตอน disabled จนกว่าจะบันทึกหัวสูตรครั้งแรก (ยังไม่มี `recipe_id`)
  *(การตัดสินใจของ Claude — ลดความซับซ้อน; ถ้าสะดวกจะทำ create แล้ว POST ต่อทันทีก็ได้)*

### 4. วัตถุดิบบันทึกจริง (BE + FE)

**ข้อเท็จจริงจาก BE (ตรวจแล้ว 2026-10-16):**
- `tb_recipe_ingredient` มีครบ: `ingredient_type`, `product_id`, `qty`, `ingredient_unit_id`, `inventory_qty`,
  `inventory_unit_id`, `conversion_factor`, `cost_per_unit`, `wastage_percentage`, `net_cost`, `wastage_cost`,
  `sequence_no`, `name`, `note`
- recipe create/update **ไม่เขียนตารางนี้เลย** และ gateway DTO ไม่รับ `ingredients` — ไม่มี endpoint เขียนวัตถุดิบ
- `findOne` อ่าน ingredients/steps กลับมาแล้ว (`apps/micro-business/src/master/recipe/recipe.service.ts:51-99`)
- ต้นทุนเฉลี่ย**ไม่ได้เก็บบนสินค้า** คำนวณสดจาก `tb_inventory_transaction_cost_layer`
  ผ่าน `getNetAverageCost` (`apps/micro-business/src/inventory/net-average-cost.helper.ts:58`);
  ไม่มี endpoint batch หลาย product
- หน่วยสูตร = `tb_unit_conversion` ที่ `unit_type = ingredient_unit`; มี
  `GET api/:bu_code/units/ingredient/product/:productId` อยู่แล้ว

**BE ใหม่:**

1. **เขียนวัตถุดิบ** — `PUT api/config/:bu_code/recipes/:recipe_id/ingredients` แทนทั้งชุด
   (body: `{ items: [{ product_id, qty, ingredient_unit_id, wastage_percentage, note }] }`, ลำดับใน array = `sequence_no`)
   ใน transaction เดียว: soft-delete ของเดิม → สร้างใหม่ โดย**server คำนวณเอง**: `inventory_qty`/`conversion_factor`
   จาก conversion ของสินค้า, `cost_per_unit` (ต่อหน่วย inventory), `net_cost`, `wastage_cost`
   *(การตัดสินใจของ Claude: แทนทั้งชุดเพราะง่ายและ FE ส่งทั้งรายการอยู่แล้ว; client ไม่ส่งต้นทุนเพื่อไม่ให้ปลอมได้)*
   - **กฎการตั้งราคาใหม่ (บังคับ anti-goal "ไม่ขยับเงียบ ๆ")**: body มี `recalculate: boolean`
     - `recalculate: false` (Save ปกติ): บรรทัดที่ `product_id` + `ingredient_unit_id` ตรงกับบรรทัดเดิม
       **คง `cost_per_unit` เดิม** (snapshot) คำนวณแค่ `net_cost`/`wastage_cost` ใหม่จาก qty/wastage;
       บรรทัดใหม่ หรือเปลี่ยนสินค้า/หน่วย → ใช้ต้นทุนปัจจุบัน
     - `recalculate: true` (มาจากปุ่ม "คำนวณใหม่" ที่ user ยืนยันแล้ว): ทุกบรรทัดใช้ต้นทุนปัจจุบัน
     - FE ส่ง PUT เฉพาะเมื่อวัตถุดิบ dirty หรือมีการกดคำนวณใหม่
   - **ไม่แตะฟิลด์ต้นทุนบนหัว `tb_recipe`** — response คืนบรรทัดพร้อมต้นทุน + ผลรวม `total_ingredient_cost`
     แล้ว FE เอาผลรวมนี้ใส่ฟอร์มและให้ `useRecipeCostCalc` (ที่มีอยู่แล้ว) คำนวณ cost_per_portion / food cost % /
     margin เหมือนเดิม **สูตรต่อจานจึงอยู่ที่ FE ที่เดียว** ไม่ซ้ำใน micro *(การตัดสินใจของ Claude)*
   - **ลำดับ Save ในฟอร์มแก้ไข**: `PUT …/ingredients` ก่อน → เอา `total_ingredient_cost` จาก response ใส่ฟอร์ม →
     บันทึกหัวสูตร → ขั้นตอน. ถ้า PUT วัตถุดิบล้ม = หยุด ไม่บันทึกหัว (ไม่มีตัวเลขหัวที่ไม่ตรงกับบรรทัด);
     ถ้าหัวล้มหลัง PUT สำเร็จ = แจ้ง error + refetch (หัวยังเป็นค่าเก่า user กด Save ซ้ำได้)
   - สูตรใหม่ (`/new`): ส่วนวัตถุดิบ disabled จนบันทึกหัวครั้งแรก เหมือนส่วนขั้นตอน
   - **ต้นทุนเฉลี่ยทั้ง BU** (`getNetAverageCost` ไม่ส่ง location) สำหรับทุก BU ไม่ว่า `calculation_method`
     *(การตัดสินใจของ Claude — สูตรไม่ผูก location; บอก user แล้ว)*
   - **ลำดับ fallback ของต้นทุน** (user ตัดสิน 2026-10-16):
     1. ต้นทุนเฉลี่ยสุทธิทั้ง BU > 0 → `cost_source: 'average'`
     2. ของหมด (มี layer แต่ net qty = 0 → `getNetAverageCost` ได้ 0) → **`average_cost_per_unit` ของ layer ล่าสุด**
        ของสินค้านั้น (ข้ามทุก location) → `cost_source: 'last_average'`
     3. ไม่มี layer เลย → `tb_product.standard_cost` → `cost_source: 'standard'`
     4. ไม่มีอีก → 0, `cost_source: 'none'`
2. **ดูตัวอย่างต้นทุนปัจจุบัน** (สำหรับปุ่มคำนวณใหม่ และตอนเลือกสินค้าในฟอร์ม) —
   `POST api/config/:bu_code/recipes/ingredient-costs` body `{ items: [{ product_id, qty, ingredient_unit_id, wastage_percentage }] }`
   → คืนต้นทุนต่อบรรทัดตามสูตรเดียวกับข้อ 1 + `cost_source` (`average` | `last_average` | `standard` | `none`) **ไม่เขียน DB**
   ใช้ logic ร่วมกับข้อ 1 (ฟังก์ชันเดียว) เพื่อให้ตัวเลขพรีวิวกับที่บันทึกตรงกันเสมอ
3. response ของ GET recipe: `ingredients[]` ต้องมี `product` (`id, code, name`), `ingredient_unit` (`id, name`) และ
   ฟิลด์ต้นทุน — เติมทั้ง serializer ฝั่ง micro และ gateway (กับดักที่เคยเจอ: เติมฝั่งเดียว GET ตัดทิ้ง)
4. ทุก `api_name` ใหม่ต้องเติม x-app-id allowlist **ก่อน** deploy FE (ไม่งั้น 401 → user โดน logout)

**FE:**

- แทน `recipe-ingredients-fields.tsx` แบบพรีวิว: แต่ละบรรทัด = lookup สินค้า (lazy lookup ไม่ใช้ `perpage=-1`)
  → หน่วยสูตร (จาก ingredient-unit endpoint) → จำนวน → % เสีย → หมายเหตุ; ต้นทุนต่อหน่วย/รวมเป็น**อ่านอย่างเดียว**
  มาจาก endpoint ข้อ 2 (debounce ตอนแก้)
- ตารางต้นทุนรายวัตถุดิบ: ชื่อ · จำนวน · ต้นทุน · % ของต้นทุนรวม เรียงแพง→ถูก (ในส่วน Costing หรือท้ายส่วน Ingredients)
- ยอดรวมวัตถุดิบ = Ingredient Cost ใน Costing (ช่องเดิมเปลี่ยนเป็นอ่านอย่างเดียวเมื่อมีวัตถุดิบ)
- บันทึก: หัวสูตร → `PUT …/ingredients` (ลำดับเดียวกับขั้นตอน)
- **ปุ่ม "คำนวณใหม่"**: เรียก endpoint ข้อ 2 กับวัตถุดิบที่บันทึกไว้ แสดงตาราง เดิม → ใหม่ (+/−%) ต่อบรรทัด
  และต้นทุนต่อที่/food cost % ใหม่; ฟอร์มกลายเป็น dirty; ต้องกด Save เองจึงมีผล
- ต้นทุนในฟอร์มตอนเปิดหน้า = ค่าที่บันทึกไว้ (snapshot) ไม่ใช่ค่าสด — ตาม anti-goal
- บรรทัดที่ `cost_source !== 'average'` ติด badge ("ของหมด · ต้นทุนล่าสุด" / "ราคามาตรฐาน" / "ไม่มีต้นทุน")
  — `cost_source` ต้องเก็บต่อบรรทัดด้วยหรือไม่ ผู้สร้างตัดสิน (badge ขั้นต่ำต้องขึ้นตอนพรีวิว/คำนวณใหม่)

### 5. คำแนะนำราคา + เพดาน food cost

**BE (migration ใหม่ ทุก BU)** — เพิ่มใน `tb_recipe`:
`max_food_cost_percentage Decimal?`, `plating_instructions String? @db.Text`, `storage_instructions String? @db.Text`
+ เติม create/update DTO, micro service, serializer ทั้งสองฝั่ง

> หมายเหตุ: FE ส่ง `info` / `dimension` ใน DTO อยู่ แต่ `tb_recipe` **ไม่มีคอลัมน์ `info`** และ gateway ตัดทิ้ง
> — ไม่ใช้ `info` สำหรับงานนี้

**FE (ส่วน Costing):**
- ช่องใหม่ "เพดาน food cost %" ข้าง "Target food cost %"; validate เพดาน ≥ เป้า (ถ้ากรอกทั้งคู่)
- การ์ด Price Recommendations:
  - ฐานเดียวกับ #335 (`use-recipe-cost-calc.ts`): food cost = **ต้นทุนวัตถุดิบต่อจาน** ÷ ราคา (ไม่รวมแรง/โสหุ้ย)
  - ราคาที่เป้า = ต้นทุนวัตถุดิบต่อจาน ÷ (target%/100) — คือ `suggestedPrice` ที่มีอยู่แล้ว
  - ราคาขั้นต่ำ = ต้นทุนวัตถุดิบต่อจาน ÷ (max%/100) (ซ่อนถ้าไม่กรอกเพดาน)
  - แต่ละแถวแสดง "กำไรต่อจาน" = ราคานั้น − `costPerPortion` (ต้นทุนเต็มรวมแรง/โสหุ้ย, นิยามเดียวกับ gross margin เดิม)
    — ค่าที่คำนวณแสดง ไม่ใช่ฟิลด์ที่เก็บ
  - ปุ่ม "ใช้ราคานี้" ต่อแถว → เติม Selling Price
  - markup = selling_price ÷ cost_per_portion แสดงคู่กับ gross margin เดิม
- ราคาขาย < ราคาขั้นต่ำ (คือ food cost % > เพดาน) → ข้อความเตือนสี `text-destructive`/ink ที่ผ่าน AA, **ไม่บล็อก Save**
- หน้ารายการ: เครื่องหมายเกินเป้าที่มีอยู่แล้ว ใช้ต่อ; *(ถ้าง่าย)* เพิ่มสถานะ "เกินเพดาน"
- คำนวณใน `use-recipe-cost-calc.ts` (ฐานหาร yield ตามที่แก้ไปใน #335)

**ส่วน Notes:** textarea "การจัดจาน" + "การเก็บรักษา" ในฟอร์ม (ส่วนใหม่หรือใต้ Recipe Details)

## ลำดับส่งงาน (แต่ละช่วง = PR คู่ BE/FE แยก, BE deploy ก่อน FE เสมอ)

| ช่วง | เนื้อหา | รีโป |
|---|---|---|
| 1 | migration 3 คอลัมน์ + Price Recommendations + เพดาน + Notes | BE + FE |
| 2 | ขั้นตอนทำในฟอร์ม + โหมดทำอาหาร + routing `/edit` | FE (BE มีแล้ว) |
| 3 | endpoint วัตถุดิบ 2 ตัว + ฟอร์มวัตถุดิบจริง + คำนวณใหม่ + ตารางต้นทุน | BE + FE |
| 4 | เช็กลิสต์วัตถุดิบในโหมดทำอาหาร | FE |

## Constraints

- i18n ทั้ง `messages/en.json` และ `th.json`; ห้ามมี `{{ }}` ในข้อความ (ICU พังทั้งหน้า)
- ใช้ primitive จาก `components/ui/` และ token จาก design system; ข้อความสถานะใช้ `text-*-ink`
- ทุก route ใหม่ต้องอยู่ใต้ error boundary ของ module (`RouteErrorBoundaryAdapter`)
- Migration แตะ DB dev ที่ใช้ร่วมกันทุก BU — ต้องขอยืนยัน user ก่อนรัน; UAT/prod รันก่อน deploy BE
- License: หน้าเดิมผูกอยู่แล้ว ไม่เพิ่ม license feature key ใหม่ (`LICENSE_ENFORCEMENT` เปิดจริงทุก env)
- `use-recipe-cost-calc` / DataGrid editable ต้อง memoize columns (กับดักที่เคยทำ browser ค้าง)

## ทิ้งไว้ให้ผู้สร้างตัดสิน

- ชื่อไฟล์/component ย่อย, การแบ่ง hook
- UI drag vs ปุ่มขึ้น/ลง สำหรับเรียงขั้นตอน
- ตำแหน่งตารางต้นทุนรายวัตถุดิบ (Costing vs ท้าย Ingredients)
- รายละเอียดหน้าตา badge/ข้อความเตือน ภายใต้ design system
