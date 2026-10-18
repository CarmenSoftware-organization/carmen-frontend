# สูตรอาหาร: ใช้สูตรอื่นเป็นวัตถุดิบ (sub-recipe) — design

วันที่ 2026-10-19 · รีโป: `carmen-inventory-frontend-react` (FE) + `carmen-turborepo-backend-v2` (BE)
ต่อจาก `2026-10-16-recipe-cook-mode-costing-design.md` (ซึ่งจงใจไม่ทำ sub-recipe ไว้)

## ทำไม

ร้านมีเมนูที่ต่อยอดจากฐานเดียวกัน เช่น "ข้าวผัด" (ข้าว ไข่ ซีอิ๊ว น้ำมัน …) เป็นฐาน แล้วทำ
"ข้าวผัดหมู" = ข้าวผัด + หมู · ข้าวผัดกุ้ง ข้าวผัดไก่ ก็ใช้ฐานเดียวกัน วันนี้ต้องกรอกส่วนผสมของ
ข้าวผัดซ้ำทุกเมนู user อยากเลือก "ข้าวผัด" ใส่เป็นวัตถุดิบหนึ่งบรรทัด แล้วเพิ่มหมูต่อ

## สิ่งที่มีอยู่แล้ว

- DB: `tb_recipe_ingredient` มี `ingredient_type` (`product` | `recipe`) และ `sub_recipe_id`
  (FK → `tb_recipe`, `onDelete: Restrict`) อยู่แล้ว · `product_id` nullable · `name` required
- BE ลบสูตร (`recipe.service.ts` delete, soft delete) **บล็อกอยู่แล้ว** เมื่อสูตรถูกใช้เป็น sub-recipe
  → `ERROR_CATALOG.RECIPE_USED_AS_SUB_RECIPE`
- Detail ของสูตรคืน `ingredient_type` / `sub_recipe_id` อยู่แล้ว (serializer `ingredients: z.any()`)
- ทุกอย่างที่เหลือรองรับแค่สินค้า: zod `RecipeIngredientInputSchema` บังคับ `product_id`,
  `validateIngredientItems` บังคับ `product_id`, `replace` hard-code `ingredient_type: product`,
  snapshot ต้นทุนเดิม key ด้วย `product_id|unit`, FE `IngredientDraft` / `LookupProduct` / cook view
  อ่าน `line.product?.name`

## เป้าหมาย

1. ในฟอร์มสูตร เลือกสูตรอื่นเป็นวัตถุดิบได้ ในบรรทัดเดียวกับสินค้า
2. ปริมาณกรอกเป็น**หน่วยผลผลิตของสูตรฐาน** (เช่น "ข้าวผัด 1 จาน") หน่วยล็อก ไม่ให้เลือก
3. ต้นทุนบรรทัด sub-recipe เข้าระบบ snapshot + "คำนวณใหม่" แบบเดียวกับบรรทัดสินค้า
4. โหมดทำอาหาร: บรรทัดเดียว มีป้ายว่าเป็นสูตร กดชื่อไปหน้าโหมดทำอาหารของสูตรฐาน
5. ลบ **หรือปิดใช้ / archive** สูตรที่ถูกใช้อยู่ = บล็อก พร้อมบอกว่าเมนูไหนใช้อยู่
6. กันสูตรวน (A ใช้ B, B ใช้ A · หรือใช้ตัวเอง)

## ไม่ทำ (non-goals)

- กางวัตถุดิบ/ขั้นตอนของสูตรฐานออกมาในหน้าเดียว (user เลือกบรรทัดเดียว + ลิงก์)
- ตัดสต็อก / แตะคลังจากบรรทัด sub-recipe (ระบบสูตรยังไม่ตัดสต็อกอยู่แล้ว)
- เลือก yield variant (ครึ่งจาน ฯลฯ) เป็นหน่วย — ใช้หน่วยผลผลิตหลักเท่านั้น
- หน้า "สูตรนี้ถูกใช้ที่ไหน" แยกต่างหาก (ข้อมูลนี้ขึ้นเฉพาะตอนถูกบล็อก)

## Anti-goals (ถ้าเกิดแบบนี้ = ล้มเหลว แม้ใช้งานได้)

- **ต้นทุนขยับเองเงียบ ๆ** — การตัดสินใจเดิมของ user ยังอยู่ และ user ยืนยันซ้ำในรอบนี้ว่า
  **ห้ามขยับ ทั้งสาย** ต้นทุน "ข้าวผัด" เปลี่ยน → "ข้าวผัดหมู" ไม่เปลี่ยน จนกว่าจะมีคนเปิด
  ข้าวผัดหมูแล้วกด "คำนวณใหม่" (ห้ามทำ cascade ตอนบันทึกสูตรฐาน)
- สูตรวนที่ทำให้ คำนวณ/โหลด ค้างหรือ stack overflow
- สูตรฐานถูกลบ/ปิดแล้วเมนูปลายทางพังเงียบ ๆ

## การตัดสินใจของ user (ห้ามถอย)

| เรื่อง | ตัดสินใจ |
|---|---|
| ต้นทุนเมื่อสูตรฐานเปลี่ยน | ไม่ขยับเอง ต้องกด "คำนวณใหม่" ในสูตรปลายทาง |
| ปริมาณ | เป็นหน่วยผลผลิตของสูตรฐาน เช่น "ข้าวผัด 1 จาน" |
| โหมดทำอาหาร | บรรทัดเดียว กดเข้าไปดูสูตรฐานได้ |
| ลบ/ปิดสูตรที่ถูกใช้ | บล็อก + บอกรายชื่อเมนูที่ใช้อยู่ |
| เปลี่ยนหน่วยผลผลิตของสูตรที่ถูกใช้ | บล็อก + บอกรายชื่อ (เปลี่ยนจำนวนผลผลิตได้) |

## การออกแบบ

### ต้นทุนต่อหน่วยของบรรทัด sub-recipe

`cost_per_unit = sub.total_ingredient_cost ÷ sub.base_yield` — อ่าน**ค่าที่บันทึกไว้**ในสูตรฐาน
ไม่ไล่คำนวณราคาคลังของวัตถุดิบในสูตรฐานใหม่ลงไป (ถ้าสูตรฐานเองยังไม่ได้คำนวณใหม่ ก็ได้ค่าเก่าของมัน
— สอดคล้องกับ "ห้ามขยับเงียบ ๆ")

- *(ผู้ออกแบบตัดสิน)* ใช้ต้นทุน**วัตถุดิบ**เท่านั้น ไม่รวม labor/overhead ของสูตรฐาน — เพื่อให้
  food cost % ของเมนูปลายทางยังหมายถึงต้นทุนวัตถุดิบจริง และไม่นับ labor ซ้อนกับของเมนูปลายทาง
- `base_yield` ≤ 0 → ต้นทุน 0 และ `cost_source = none` (ไม่หารศูนย์)
- `cost_source` ใหม่: `recipe` (เติมเข้า `IngredientCostSource` ทั้งสองฝั่ง) เพื่อให้ UI บอกได้ว่า
  มาจากสูตร
- หน่วย: `ingredient_unit_id = inventory_unit_id = sub.base_yield_unit`, `conversion_factor = 1`,
  `inventory_qty = qty` · `base_yield_unit` เป็น VarChar ไม่มี FK แต่ FE เก็บเป็น unit id —
  ถ้าค่าไม่ใช่ unit id ที่มีจริง (ข้อมูลเก่า เช่น `"PCS"`) ให้ปฏิเสธบรรทัดนั้นด้วย error ที่บอกว่า
  "สูตรฐานยังไม่ได้ตั้งหน่วยผลผลิต" แทนที่จะปล่อยให้ FK พัง 500
- wastage % ใช้ได้เหมือนบรรทัดสินค้า สูตร net/wastage/line cost เดิมทั้งหมด

### Snapshot และ "คำนวณใหม่"

- Key ของ snapshot ใน `replace` / `pendingPairs` / `pairCostsFrom` เปลี่ยนจาก
  `product_id|unit` เป็น key ที่แยกประเภท เช่น `p:<product_id>|<unit>` / `r:<sub_recipe_id>|<unit>`
  — บรรทัดสูตรต้องไม่ถูกข้าม (ตอนนี้บรรทัดไม่มี `product_id` ถูก skip ที่ `:113-119`)
- `recalculate: false` → บรรทัดสูตรที่มี snapshot เดิมคงค่าเดิม · บรรทัดสูตรที่เพิ่มใหม่ได้ค่าปัจจุบัน
  (เหมือนสินค้าที่เพิ่มใหม่)
- `recalculate: true` → ดึง `total_ingredient_cost ÷ base_yield` ปัจจุบันของสูตรฐาน
- Dialog เทียบส่วนต่างตอนคำนวณใหม่ (`recipe-ingredients-recalc-dialog.tsx`) แสดงบรรทัดสูตรด้วย

### API (BE)

- `RecipeIngredientInputSchema` (gateway) + `IngredientInput` / `validateIngredientItems` (micro):
  รับ `ingredient_type` (default `product` เพื่อไม่ให้ client เดิมพัง) + `sub_recipe_id`
  ต้องมีอย่างใดอย่างหนึ่งตรงกับประเภท ห้ามมีทั้งคู่ · บรรทัด recipe ไม่ต้องส่ง `ingredient_unit_id`
  (server ตั้งจาก `base_yield_unit`); ถ้าส่งมาแล้วไม่ตรงให้ปฏิเสธ
- สูตรฐานที่เลือกได้: ไม่ถูกลบ, `is_active !== false`, status ≠ `ARCHIVED` (DRAFT ใช้ได้ —
  *ผู้ออกแบบตัดสิน* เพราะสูตรฐานมักไม่ใช่เมนูที่ขายจริงจึงอาจไม่เคย publish)
- `replace` เขียน `ingredient_type`, `sub_recipe_id`, `name = sub.name`, `product_id = null`
- ใช้ทั้ง preview และ replace
- Detail: include `tb_sub_recipe { id, code, name, base_yield_unit }` แล้ว map เป็น
  `sub_recipe { id, code, name }` คู่กับ `product` เดิม · กรองบรรทัดที่ `deleted_at` ไม่ null เหมือนเดิม
- **กันวน** ใน preview และ replace: เดินกราฟ `sub_recipe_id` จากสูตรที่เลือกลงไป (BFS, เฉพาะบรรทัด
  ที่ไม่ถูกลบ) ถ้าเจอ recipe_id ของตัวเอง → ปฏิเสธด้วยรหัสใหม่ใน error catalog
  (เช่น `RECIPE_SUB_RECIPE_CYCLE`) พร้อมชื่อสูตรที่ทำให้วน · ซ้อนกี่ชั้นก็ได้ แต่ BFS ต้องมี visited set
- **บล็อกปิดใช้/archive**: `update` + `patch` เมื่อ `is_active` เปลี่ยนเป็น `false` หรือ status เปลี่ยน
  เป็น `ARCHIVED` ให้เช็กแบบเดียวกับ delete
- **บล็อกเปลี่ยนหน่วยผลผลิต** (user ตัดสิน): `update` + `patch` เมื่อ `base_yield_unit` เปลี่ยนค่า
  ระหว่างที่สูตรถูกใช้อยู่ → ปฏิเสธพร้อมรายชื่อเมนู (ไม่งั้น "ข้าวผัด 1 จาน" กลายเป็น "1 กก." และ snapshot
  หาไม่เจอ = ต้นทุนขยับเงียบ ๆ) · การเปลี่ยน `base_yield` (จำนวน) **ไม่บล็อก** — มีผลต่อปลายทางเฉพาะตอนกด
  "คำนวณใหม่" อยู่แล้ว · FE: ช่องหน่วยผลผลิตในฟอร์มสูตรที่ถูกใช้อยู่ แสดง error จาก BE ให้อ่านออก
  (*ผู้สร้างเลือกได้* ว่าจะ disable ช่องล่วงหน้าด้วยหรือไม่ ถ้า detail มีข้อมูล "ถูกใช้อยู่")
- **"ถูกใช้อยู่" นับเฉพาะสูตรปลายทางที่ยังไม่ถูกลบ** (ผู้ออกแบบตัดสิน): ลบสูตร soft-delete แค่หัว
  `tb_recipe` ไม่ลบบรรทัดวัตถุดิบ ทุกเช็ก (delete เดิม + ปิดใช้ + archive + เปลี่ยนหน่วย) และรายชื่อ ต้อง
  join `tb_recipe.deleted_at IS NULL` ของสูตรปลายทาง — **แก้เช็กของ delete ที่มีอยู่ด้วย**
  ไม่งั้นเมนูที่ลบทิ้งแล้วล็อกสูตรฐานไว้ตลอดไป
- **รายชื่อเมนูที่ใช้อยู่**: ทั้ง `RECIPE_USED_AS_SUB_RECIPE` เดิม (delete) และของ update/patch
  คืนรายการสูตรปลายทาง `{ id, code, name }` (ไม่เกิน ~20 รายการ + จำนวนรวม) ใน payload ของ error
  ตามรูปแบบ error catalog ที่มีอยู่ · FE แสดงเป็นรายการในข้อความ error
- api_name: ไม่มี endpoint ใหม่ ถ้าเพิ่ม endpoint lookup สูตร (ดูด้านล่าง) ต้องเติม allowlist ก่อน
  deploy FE (ไม่งั้น user โดน logout — memory `new-api-name-401-logs-users-out`)

### FE

- **ตัวเลือกวัตถุดิบ** (`recipe-ingredients-fields.tsx` แทน `<LookupProduct>` ต่อแถว): ช่องค้นหาเดียว
  ผลค้นหามีทั้งสินค้าและสูตร มีป้ายประเภท · ตัดสูตรปัจจุบันออกจากผลลัพธ์ (การวนที่ลึกกว่านั้นให้ BE
  ปฏิเสธ แล้ว FE แสดง error ที่บรรทัดนั้น) · ค้นสูตรด้วย list endpoint เดิม (`useRecipe`/`crud.useList`)
  แบบ lazy search (ไม่ใช่ perpage=-1 — memory `lazy-lookup-no-perpage-all`) กรอง active + ไม่ ARCHIVED
  · *ผู้สร้างเลือกเองได้* ว่าจะเป็น combobox ใหม่ที่รวมสองแหล่ง หรือสวิตช์ประเภทเล็ก ๆ หน้าช่องค้นหา
  ตราบที่ผู้ใช้หาได้ในช่องเดียวและเห็นป้ายประเภท
- `IngredientDraft` เพิ่ม `ingredient_type`, `sub_recipe_id`, `sub_recipe_label` · `ingredientToDraft`,
  `draftToInput`, `resolveRowCosts`, `pendingPairs`, `pairCostsFrom` รองรับสองประเภท
- บรรทัดสูตร: ช่องหน่วยแสดงหน่วยผลผลิตของสูตรฐานแบบอ่านอย่างเดียว · ชื่อกดไปหน้าสูตรฐานได้
  (ในฟอร์มเปิดแท็บใหม่ หรือ navigate โดยมี nav guard ของฟอร์มกันข้อมูลหาย — ผู้สร้างเลือก)
- **Cook view** (`recipe-cook-view.tsx` เช็กลิสต์): ชื่ออ่านจาก `sub_recipe?.name` เมื่อเป็นบรรทัดสูตร
  มีป้ายเล็ก "สูตร" · ชื่อเป็นลิงก์ไป `/operation-plan/recipe/<sub_recipe_id>` (cook view)
  · ย้อนกลับใช้ปุ่ม back ของเบราว์เซอร์ ไม่ทำ breadcrumb พิเศษ
- i18n en/th ครบ (ระวัง `{}` / `<คำ>` ในข้อความ — memory `icu-messages-cannot-contain-braces`)
- dark mode + 375px ต้องอ่านออก

## ลำดับ deploy

ไม่มี migration (คอลัมน์มีแล้ว — ต้องยืนยันว่าทุก BU ของ UAT/prod มีคอลัมน์ `ingredient_type` /
`sub_recipe_id` และ enum ครบก่อน) → **BE ก่อน FE** (FE ก่อน = zod ของ gateway ตัด/ปฏิเสธ
`sub_recipe_id`) · rollback BE ทีหลังเมื่อมีบรรทัดสูตรแล้ว = replace ของ BE เก่าจะทับบรรทัดสูตร
ด้วย product-only → rollback ต้องเป็นคู่

## ตรวจด้วยมือ (แทนเทสต์อัตโนมัติ ตาม preference ของ user)

1. สร้าง "ข้าวผัด" ผลผลิต 1 จาน คำนวณต้นทุน → สร้าง "ข้าวผัดหมู" ใส่ข้าวผัด 1 จาน + หมู → ต้นทุนถูก
2. เปลี่ยนวัตถุดิบในข้าวผัดแล้วบันทึก → ข้าวผัดหมูต้นทุน**ไม่เปลี่ยน** → กดคำนวณใหม่ → เปลี่ยน
3. ใส่ข้าวผัดหมูลงในข้าวผัด → ถูกปฏิเสธ (วน)
4. ลบ / ปิดใช้ / archive / เปลี่ยนหน่วยผลผลิตของข้าวผัด → ถูกบล็อก เห็นชื่อข้าวผัดหมู
   · ลบข้าวผัดหมูทิ้ง → ลบข้าวผัดได้
5. Cook view ข้าวผัดหมู → กดข้าวผัด → ไปหน้าข้าวผัด · back กลับได้

## ที่ปล่อยให้ผู้สร้างตัดสิน

- รูปแบบ UI ของตัวเลือกรวมสินค้า/สูตร (ตามกรอบด้านบน)
- ชื่อรหัส error catalog ใหม่ และรูป payload รายชื่อเมนู (ตามแบบที่ catalog ใช้อยู่)
- การแบ่ง PR (แนะนำ BE หนึ่งใบ FE หนึ่งใบ)
