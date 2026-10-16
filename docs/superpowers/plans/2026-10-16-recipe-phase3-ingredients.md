# Recipe ช่วง 3–4: วัตถุดิบบันทึกจริง · คำนวณใหม่ · เช็กลิสต์ในโหมดทำอาหาร — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** วัตถุดิบของสูตรผูกสินค้าในคลังและบันทึกจริง ต้นทุนดึงจากต้นทุนเฉลี่ยคลังโดย server, ต้นทุนไม่ขยับเองจนกว่าผู้จัดการกด "คำนวณใหม่" แล้ว Save, และโหมดทำอาหารแสดงเช็กลิสต์วัตถุดิบ

**Spec:** `docs/superpowers/specs/2026-10-16-recipe-cook-mode-costing-design.md` §4 (+ §2 คอลัมน์ข้างของ cook view)

## Global Constraints

- ไม่เขียนเทสต์ใหม่ (กฎ user) — แต่เทสต์เดิมต้องเขียว; BE ใช้ **jest** (`bunx jest <path>`) ห้าม `bun test`; FE `bun test:run`
- BE branch `feature/recipe-ingredients-write` (จาก main ล่าสุด), FE branch `feature/recipe-ingredients` · commit ไทย · ไม่ squash · **ห้าม push/merge — คนคุมงานจะทำเอง**
- ห้าม curl login ซ้ำด้วย user ที่ล็อกอินในเบราว์เซอร์ (ทำให้เบราว์เซอร์หลุด) — ตรวจ endpoint ด้วย jest/tsc ก็พอ คนคุมงานตรวจในเบราว์เซอร์เอง
- ไม่มี migration (ตาราง `tb_recipe_ingredient` มีครบ)

### สัญญา API (ตายตัว — ทั้ง BE และ FE ยึดตามนี้)

Base: `api/config/:bu_code/recipes`

1. `POST :recipe_id/ingredients/preview` · api_name `recipe.previewIngredientCosts` · **ไม่เขียน DB**
   body `{ items: IngredientInput[] }` → `200 { data: { items: IngredientCostLine[], total_ingredient_cost: number } }`
2. `PUT :recipe_id/ingredients` · api_name `recipe.replaceIngredients`
   body `{ items: IngredientInput[], recalculate: boolean }` → `200 { data: { items: IngredientCostLine[], total_ingredient_cost: number } }`
   (items ที่คืน = แถวที่บันทึกแล้ว มี `id`)

```ts
IngredientInput = {
  product_id: uuid; qty: number (>0); ingredient_unit_id: uuid;
  wastage_percentage?: number (0–100, default 0); note?: string|null (≤500)
}
IngredientCostLine = {
  id?: string;                    // มีเฉพาะผลของ PUT
  sequence_no: number;            // 1..n ตามลำดับ items
  product_id: string; product: { id; code; name };
  qty: number; ingredient_unit_id: string; ingredient_unit: { id; name };
  inventory_qty: number; inventory_unit_id: string; conversion_factor: number; // inventory units ต่อ 1 ingredient unit
  cost_per_unit: number;          // ต่อ inventory unit
  wastage_percentage: number;
  net_cost: number;               // inventory_qty × cost_per_unit
  wastage_cost: number;           // net_cost × wastage% / 100
  line_cost: number;              // net_cost + wastage_cost  (ไม่มีคอลัมน์ — คำนวณใน response)
  cost_source: "average" | "last_average" | "standard" | "none" | "snapshot";
  note: string | null;
}
total_ingredient_cost = Σ line_cost   (ปัด 2 ตำแหน่งเฉพาะตอนแสดง; เก็บ Decimal เต็ม)
```

### กฎต้นทุน (server เท่านั้น — ฟังก์ชันเดียวใช้ทั้ง preview และ PUT)

- **conversion_factor**: `ingredient_unit_id === product.inventory_unit_id` → 1; ไม่งั้นหา `tb_unit_conversion` ที่ `product_id`, `unit_type = ingredient_unit`, `to_unit_id = ingredient_unit_id`, `is_active`, `deleted_at: null` → `from_unit_qty / to_unit_qty`; ไม่เจอ → 400 error catalog ใหม่ `RECIPE_INGREDIENT_UNIT_INVALID`
- product ต้องมีอยู่ (`deleted_at: null`) ไม่งั้น 400 `RECIPE_INGREDIENT_PRODUCT_NOT_FOUND`
- **ต้นทุนต่อ inventory unit (fallback ตามที่ user ตัดสิน):**
  1. `getNetAverageCost(prisma, product_id)` (BU-wide, `apps/micro-business/src/inventory/net-average-cost.helper.ts:58`) > 0 → `average`
  2. layer ล่าสุดที่ `average_cost_per_unit > 0` (`tb_inventory_transaction_cost_layer`, `deleted_at: null`, orderBy `[{ lot_at_date: 'desc' }, { created_at: 'desc' }, { lot_index: 'desc' }]`) → `last_average`
  3. `tb_product.standard_cost > 0` → `standard`
  4. 0 → `none`
- **snapshot (anti-goal "ห้ามขยับเงียบ ๆ"):** PUT ที่ `recalculate: false` — บรรทัดที่ `(product_id, ingredient_unit_id)` ตรงกับบรรทัดเดิมที่ยังไม่ลบ (จับคู่ตามลำดับถ้ามีซ้ำ) ใช้ `cost_per_unit` เดิม (`cost_source: "snapshot"`); บรรทัดใหม่/เปลี่ยนสินค้า/เปลี่ยนหน่วย ใช้กฎ fallback. `recalculate: true` → ทุกบรรทัดใช้ fallback. preview ใช้ fallback เสมอ (เป็นราคาปัจจุบัน)
- PUT ใน `$transaction`: soft-delete แถวเดิมทั้งหมดของสูตร (`deleted_at`, `deleted_by_id`) → createMany ใหม่ (`ingredient_type: 'product'`, `name` = product.name, `sequence_no` ตามลำดับ) → **อัปเดต `tb_recipe.total_ingredient_cost`** (ค่าเดียวบนหัวที่ server แตะ; ฟิลด์ต่อจาน/food cost % FE คำนวณแล้วส่งตอนบันทึกหัวเหมือนเดิม) — items ว่าง = ลบหมด, total 0
- **ไม่แตะ** `recipe.service` create/update อื่น

---

### Task B1: BE — endpoint 2 ตัว (micro + gateway + contract + catalog)

ทำตามแม่แบบ preparation-steps ทุกชั้น (`apps/backend-gateway/src/config/config_recipes/preparation-steps.*`, `apps/micro-business/src/master/recipe/preparation-steps/*`):
- micro: `master/recipe/ingredients/{recipe-ingredients.controller.ts, recipe-ingredients.service.ts, recipe-ingredient-cost.ts, dto/recipe-ingredient.dto.ts}` · service `extends TenantScopedService`, method `preview(recipe_id, items)` / `replace(recipe_id, items, recalculate)` `@TryCatch` คืน `Result` · ลงทะเบียนใน `recipe.module.ts`
- cost logic แยกเป็นฟังก์ชันบริสุทธิ์ + ฟังก์ชันดึงข้อมูลใน `recipe-ingredient-cost.ts` (`resolveConversion`, `resolveUnitCost`, `computeLine`) ใช้ร่วมทั้งสอง method
- contract: เขียน `@MessagePattern` literal ชั่วคราว → `bun run gen:rpc-contract` → เปลี่ยนเป็น `Recipes.previewIngredientCosts.pattern` / `Recipes.replaceIngredients.pattern` (ชื่อ cmd `recipes.preview-ingredient-costs`, `recipes.replace-ingredients`)
- gateway: `config_recipes/recipe-ingredients.controller.ts` + service (rpc) + zod DTO ใน `src/common/dto/recipe/recipe-ingredient.dto.ts` (+ export ใน index) + swagger DTO + ลงทะเบียน module; `ParseUUIDPipe` ที่ recipe_id; `AppIdGuard('recipe.previewIngredientCosts')` / `AppIdGuard('recipe.replaceIngredients')`
- error catalog: เพิ่ม 2 รหัสใน `packages/error-catalog/src/catalog.ts` ตามรูปแบบรหัส RECIPE_* เดิม (build dist ถ้าแพ็กเกจใช้ dist)
- regenerate `app-api-catalog.generated.ts` ด้วย `bun run scripts/generate-app-api-catalog/run.ts` (ไม่เพิ่ม seed/migration ของ allowlist — ตามแบบ recipeComment ที่พึ่ง app allow_all)
- [ ] เขียนโค้ด · [ ] `bunx tsc --noEmit -p apps/micro-business` + `-p apps/backend-gateway` (gateway มี error rootDir ของ verify-swagger.spec.ts อยู่ก่อนแล้ว — ไม่นับ) · [ ] eslint ไฟล์ที่แตะ · [ ] `bunx jest src/master/recipe` (micro) + `bunx jest src/config/config_recipes` (gateway) เขียว · [ ] commit `feat(recipe): endpoint บันทึกและคำนวณต้นทุนวัตถุดิบของสูตร`

### Task B2: BE — recipe detail คืน product/unit ของวัตถุดิบ

`apps/micro-business/src/master/recipe/recipe.service.ts` findOne (~:51-93): include `tb_product: { select: { id, code, name } }`, `tb_unit_ingredient: { select: { id, name } }` ในวัตถุดิบ แล้ว map ออกเป็น `product`, `ingredient_unit` (ไม่ปล่อยชื่อ relation ดิบ) + `line_cost = net_cost + wastage_cost` · อัปเดต mock ใน `recipe.service.spec.ts` ถ้าพัง
- [ ] tsc + jest recipe · [ ] commit `feat(recipe): recipe detail แนบสินค้าและหน่วยของวัตถุดิบ`

---

### Task F1: FE — types, endpoints, hooks

- `types/recipe.ts`: `RecipeIngredientLine` (= IngredientCostLine ข้างบน, `id` required, `cost_source?`) แทน `ingredients: unknown[]` ใน `Recipe`; `IngredientInput`
- `constant/api-endpoints.ts`: `RECIPE_INGREDIENTS(bu, recipeId)` = `${RECIPES}/${recipeId}/ingredients`; `PRODUCT_INGREDIENT_UNITS(bu, productId)` = `/api/proxy/api/${bu}/units/ingredient/product/${productId}`
- `hooks/use-product-units.ts`: `useProductIngredientUnits(productId)` → `{ id, name, conversion }[]` (แบบเดียวกับ `useProductUnits`)
- `routes/operation-plan/recipe/use-recipe-ingredients.ts`: `usePreviewIngredientCosts()` (mutation, POST preview) และ `useReplaceIngredients()` (mutation PUT, onSettled `return queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.RECIPES] })`)

### Task F2: FE — ส่วนวัตถุดิบในฟอร์ม (แทนพรีวิวเดิม)

- แทน `recipe-ingredients-fields.tsx` แบบพรีวิว (state ภายใน `useState<RecipeIngredient[]>` ใน `recipe-form.tsx`) ด้วยฟิลด์ RHF `ingredients` (`useFieldArray`, keyName `key`) ใน `recipe-form-schema.ts`: `{ line_id: string|null, product_id: string (required), product_label: string, qty: number > 0, ingredient_unit_id: string (required), wastage_percentage: 0–100, note: string ≤500 }`; `getDefaultValues` จาก `recipe.ingredients` (เรียง `sequence_no`)
- แต่ละแถว: `LookupProduct` (เปลี่ยนสินค้า → ล้างหน่วย, ตั้งหน่วยเริ่มเป็นหน่วยแรกของ `useProductIngredientUnits`) · select หน่วย · จำนวน · % เสีย · หมายเหตุ · ต้นทุนบรรทัด (อ่านอย่างเดียว) + badge `cost_source` ≠ average/snapshot (`last_average` = "ของหมด · ต้นทุนล่าสุด", `standard` = "ราคามาตรฐาน", `none` = "ไม่มีต้นทุน") · ลบแถว · ปุ่มเพิ่มวัตถุดิบ
- **ต้นทุนบนจอ**: ค่าเริ่ม = ค่าที่บันทึกไว้ในแต่ละบรรทัด (snapshot); เมื่อแถวใดเปลี่ยนสินค้า/หน่วย/จำนวน/% เสีย → เรียก preview (debounce 400ms) **เฉพาะเพื่อแสดงแถวที่เปลี่ยน** — แถวที่ไม่เปลี่ยนสินค้า/หน่วยแสดง `cost_per_unit` เดิม × จำนวนใหม่ (คำนวณ FE ด้วยสูตรเดียวกับสัญญา) ให้ตรงกับที่ PUT `recalculate:false` จะบันทึก
- **ยอดรวม** = Σ line_cost บนจอ → `form.setValue("total_ingredient_cost", …)`; เมื่อมีวัตถุดิบ ≥1 แถว ช่อง Ingredient Cost ใน `recipe-cost-fields.tsx` เป็นอ่านอย่างเดียว (ไม่มีแถว = กรอกมือได้เหมือนเดิม)
- **ปุ่ม "คำนวณใหม่"** (แสดงเมื่อสูตรบันทึกแล้วและมีวัตถุดิบ): เรียก preview ทั้งรายการ → dialog ตาราง ชื่อ · ต้นทุนเดิม → ใหม่ · ส่วนต่าง % + ต้นทุนต่อจานใหม่ และ food cost % ใหม่ → "ใช้ต้นทุนใหม่" = แทนต้นทุนบนจอทุกบรรทัด + ตั้ง flag `recalculate = true` (state ของฟอร์ม, ทำให้ dirty) → ต้องกด Save เอง
- **ตารางต้นทุนรายวัตถุดิบ** ท้ายส่วน: ชื่อ · จำนวน+หน่วย · ต้นทุน · % ของรวม เรียงแพง→ถูก
- **ลำดับ Save (แก้ไข)** ใน `recipe-form.tsx`: `f.setIsSubmitting(true)` → ถ้าวัตถุดิบ dirty หรือ recalculate: `PUT ingredients` → เอา `total_ingredient_cost` จาก response ใส่ payload หัว (และ setValue) → update หัว → sync ขั้นตอน (เดิม) → toast + backToList. PUT ล้ม → หยุด, `setIsSubmitting(false)`, toast error (description = err.message). สูตรใหม่ (`/new`): ส่วนวัตถุดิบแสดง "บันทึกสูตรก่อน" เหมือนขั้นตอน
- ลบ `RecipeIngredient` แบบพรีวิวและข้อความ `ingredientsPreviewNote` ที่ไม่ใช้แล้ว; อ่าน error ผ่าน `useFormState` เท่านั้น
- i18n en/th ครบ, ห้าม `{{ }}`; ข้อความสถานะใช้ ink token

### Task F3: FE — เช็กลิสต์วัตถุดิบในโหมดทำอาหาร (ช่วง 4)

`recipe-cook-view.tsx` คอลัมน์ข้าง บนสุด: "วัตถุดิบ" — รายการ checkbox (`state` ในหน้า ไม่บันทึก) ชื่อสินค้า · จำนวน + หน่วยสูตร (ตัดเลขท้ายศูนย์) · หมายเหตุตัวเล็ก; ไม่มีตัวเลขเงิน; ไม่มีวัตถุดิบ = ซ่อนหัวข้อ

### Task F4: ตรวจ

- [ ] `bun run typecheck` · `bun run lint` (0 errors) · `bun test:run` ทั้งชุดเขียว (characterization test ของฟอร์ม: mock hook ใหม่แบบ `use-recipe-steps-sync`)
- [ ] commit ทีละ task (ไทย)

## Review Focus

1. Save ปกติหลังแก้แค่จำนวน — ต้นทุนต่อหน่วยต้องไม่ขยับ (snapshot) ทั้งบนจอและใน DB
2. ของหมดคลัง (net qty 0) → `last_average` ไม่ใช่ 0
3. หน่วยที่ไม่มี conversion → 400 ข้อความชัด ไม่ใช่ 500
4. PUT ล้ม → ไม่บันทึกหัว (ไม่มี total ที่ไม่ตรงกับบรรทัด), ข้อมูลที่กรอกยังอยู่
5. สูตรเก่าที่ `total_ingredient_cost` กรอกมือไว้และไม่มีวัตถุดิบ — เปิดแล้ว Save ต้องไม่ล้างค่าเป็น 0
