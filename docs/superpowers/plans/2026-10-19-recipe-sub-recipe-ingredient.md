# Recipe Sub-Recipe Ingredient Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สูตรใช้สูตรอื่นเป็นวัตถุดิบหนึ่งบรรทัดได้ (ข้าวผัดหมู = ข้าวผัด 1 จาน + หมู) โดยต้นทุนเข้าระบบ snapshot/"คำนวณใหม่" เดิม

**Architecture:** BE ขยาย input ของ preview/replace ให้รับ `ingredient_type` + `sub_recipe_id`, คิดต้นทุนบรรทัดสูตรจากค่าที่บันทึกไว้ของสูตรฐาน, กันวนด้วย BFS, และเพิ่มด่าน "ถูกใช้อยู่" ใน delete/update/patch · FE แยก "ตัวอ้างอิง" ของบรรทัด (สินค้า/สูตร) ออกจาก `product_id`, เพิ่ม `LookupRecipe` และป้าย/ลิงก์ใน cook view

**Tech Stack:** BE NestJS + Prisma (tenant schema) + zod v4 + `@repo/error-catalog` · FE Vite + React 19 + react-hook-form + zod + use-intl

**Spec:** `docs/superpowers/specs/2026-10-19-recipe-sub-recipe-ingredient-design.md` (อ่านคู่กันเสมอ)

**Repos / branches:**
- BE: `/Users/samutpra/GitHub/carmensoftware-organize/carmen-turborepo-backend-v2` — สร้าง branch `feature/recipe-sub-recipe-ingredient` จาก `origin/main` (ใช้ worktree ถ้า main มีงานค้าง)
- FE: worktree `/Users/samutpra/GitHub/carmensoftware-organize/carmen-inventory-frontend-react-subrecipe` branch `feature/recipe-sub-recipe-ingredient` (มีแล้ว) — **ห้ามแตะ working tree ของ `carmen-inventory-frontend-react` (main มีไฟล์ค้างของงานอื่น)**

## Global Constraints

- **ไม่เขียนเทสต์อัตโนมัติ** (preference ของ user) — ทุก task จบด้วย typecheck + lint + commit; ตรวจด้วยมือใน Task 8 · เทสต์ที่มีอยู่ต้องยังผ่าน (BE ใช้ `jest` ห้าม `bun test`)
- ต้นทุนห้ามขยับเงียบ ๆ: บรรทัดสูตรใช้ snapshot เมื่อ `recalculate=false` เหมือนบรรทัดสินค้า · **ห้าม cascade** ตอนบันทึกสูตรฐาน
- ต้นทุนต่อหน่วยของบรรทัดสูตร = `sub.total_ingredient_cost ÷ sub.base_yield` (ค่าที่บันทึกไว้, ไม่รวม labor/overhead) · `base_yield ≤ 0` → 0 + `cost_source = 'none'`
- หน่วยของบรรทัดสูตร = `sub.base_yield_unit` เสมอ, `inventory_unit_id` เดียวกัน, `conversion_factor = 1`
- สูตรฐานที่ใช้ได้: `deleted_at = null`, `is_active !== false`, `status !== ARCHIVED` (DRAFT ใช้ได้)
- "ถูกใช้อยู่" = บรรทัด `sub_recipe_id = X`, `deleted_at = null` **และ** สูตรแม่ `deleted_at = null`
- Commit message ภาษาไทย (conventional prefix อังกฤษ) · PR ภาษาอังกฤษ · ห้าม squash-merge
- Comment ในโค้ด BE เป็น JSDoc สองภาษา (อังกฤษ/ไทย) ตามไฟล์รอบข้าง · FE comment ภาษาไทยตามไฟล์รอบข้าง

## Review Focus

1. **บรรทัดสูตรเดิม + Save ปกติ** — snapshot ต้องจับคู่ได้ (key `r:<sub>|<unit>`) ต้นทุนไม่ขยับ; ถ้าบรรทัดสูตรถูกข้ามตอนสร้าง snapshot (`if (!row.product_id) continue` เดิม) = ต้นทุนขยับเงียบ ๆ
2. **สูตรวนผ่านหลายชั้น** (A→B→C→A) — BFS ต้องมี visited set และจับได้ทั้งตอน preview และ replace
3. **`base_yield_unit` ไม่ใช่ unit id จริง** (ข้อมูลเก่า เช่น `"PCS"`) — ต้องได้ `RECIPE_SUB_RECIPE_NO_YIELD_UNIT` ไม่ใช่ FK 500
4. **สูตรแม่ถูกลบแล้ว** ยังมีบรรทัดชี้สูตรฐาน — ต้องไม่บล็อกการลบ/ปิด/เปลี่ยนหน่วยของสูตรฐาน
5. **PATCH ที่ส่ง `base_yield_unit` ค่าเดิม** (ฟอร์มส่งทุกฟิลด์) — ต้องไม่ถูกบล็อก บล็อกเฉพาะเมื่อค่าเปลี่ยนจริง

---

## BE (carmen-turborepo-backend-v2)

### Task 1: Error catalog + ด่าน "ถูกใช้อยู่" ใน delete / update / patch

**Files:**
- Modify: `packages/error-catalog/src/catalog.ts` (ใกล้ `RECIPE_USED_AS_SUB_RECIPE` :2110 และกลุ่ม `RECIPE_INGREDIENT_*` :3048-3075)
- Create: `apps/micro-business/src/master/recipe/sub-recipe-usage.ts`
- Modify: `apps/micro-business/src/master/recipe/recipe.service.ts` (`update` ~:286, `patch` ~:354, `delete` ~:419)

**Interfaces:**
- Produces: `findRecipeUsers(prisma: any, recipeId: string): Promise<{ count: number; names: string[] }>` — สูตรแม่ไม่ซ้ำ (distinct `recipe_id`) ที่ยังไม่ถูกลบ, `names` = `"<code> <name>"` สูงสุด 20 รายการเรียงตามชื่อ
- Produces: `usersParams(u): Record<string, string>` → `{ count: String(u.count), recipes: u.names.join(', ') }`
- Produces catalog entries (id ต่อจาก `makeId(MODULE.RECIPE, 10)`, http 400 ทั้งหมด, message_en + message_th):
  - `RECIPE_USED_AS_SUB_RECIPE` (แก้ข้อความเดิม): ใส่ `{count}` และ `{recipes}` เช่น th `สูตรนี้ถูกใช้เป็นวัตถุดิบใน {count} เมนู: {recipes}`
  - `RECIPE_IN_USE_CANNOT_DEACTIVATE` (11): ปิดใช้/archive ไม่ได้ · `{count}` `{recipes}`
  - `RECIPE_YIELD_UNIT_LOCKED` (12): เปลี่ยนหน่วยผลผลิตไม่ได้ · `{count}` `{recipes}`
  - `RECIPE_SUB_RECIPE_NOT_FOUND` (13): สูตรฐานไม่มี/ถูกลบ/ปิด/archive · `{recipe}`
  - `RECIPE_SUB_RECIPE_NO_YIELD_UNIT` (14): สูตรฐานยังไม่ได้ตั้งหน่วยผลผลิต · `{recipe}`
  - `RECIPE_SUB_RECIPE_CYCLE` (15): ใช้สูตรนี้แล้ววนกลับมาที่ตัวเอง · `{recipe}`

- [ ] **Step 1: เพิ่ม/แก้ catalog entries ตามรายการข้างบน** ตามรูปแบบ entry รอบข้าง แล้วรัน `bun run build:package` ใน `packages/error-catalog` (micro/gateway อ่านจาก `dist`)
- [ ] **Step 2: เขียน `sub-recipe-usage.ts`** — query `tb_recipe_ingredient.findMany({ where: { sub_recipe_id, deleted_at: null, tb_recipe: { deleted_at: null } }, select: { recipe_id, tb_recipe: { select: { code, name } } }, distinct: ['recipe_id'] })`
- [ ] **Step 3: `delete`** — แทน `count` เดิมด้วย `findRecipeUsers`; `count > 0` → `Result.errorFromCatalog(ERROR_CATALOG.RECIPE_USED_AS_SUB_RECIPE, usersParams(u))`
- [ ] **Step 4: `update` และ `patch`** — หลังหา `recipe` เจอ ก่อนเขียน: ถ้า (`data.is_active === false && recipe.is_active !== false`) หรือ (`status === ARCHIVED && recipe.status !== ARCHIVED`) → ถ้ามีผู้ใช้ → `RECIPE_IN_USE_CANNOT_DEACTIVATE`; ถ้า `data.base_yield_unit !== undefined && data.base_yield_unit !== recipe.base_yield_unit` → ถ้ามีผู้ใช้ → `RECIPE_YIELD_UNIT_LOCKED` · เรียก `findRecipeUsers` เฉพาะเมื่อเงื่อนไขเปลี่ยนจริง (ไม่ query ทุก save) · ใส่ตรรกะเป็น private helper ตัวเดียวที่ทั้งสองเมธอดเรียก
- [ ] **Step 5: ตรวจ** `cd packages/error-catalog && bun run check-types` · `cd apps/micro-business && bunx tsc --noEmit -p tsconfig.json` · `bunx eslint <ไฟล์ที่แก้>` · `bunx jest src/master/recipe` → ผ่าน (ถ้า `recipe.service.spec.ts` mock `count` ของ delete ให้ปรับ mock ให้ตรง ไม่ใช่ลบเทสต์)
- [ ] **Step 6: Commit** `feat(recipe): บล็อกลบ/ปิด/เปลี่ยนหน่วยผลผลิตของสูตรที่ถูกใช้เป็นวัตถุดิบ พร้อมรายชื่อเมนู`

### Task 2: รูป input ของบรรทัดวัตถุดิบ (gateway + micro)

**Files:**
- Modify: `apps/backend-gateway/src/common/dto/recipe/recipe-ingredient.dto.ts:16-22`
- Modify: `apps/backend-gateway/src/config/config_recipes/swagger/recipe-ingredient.dto.ts` (`RecipeIngredientInputDto` :7, `RecipeIngredientCostResultDto` :148 + line dto)
- Modify: `apps/micro-business/src/master/recipe/ingredients/dto/recipe-ingredient.dto.ts`
- Modify: `apps/micro-business/src/master/recipe/ingredients/recipe-ingredient-cost.ts` (`validateIngredientItems` :146)

**Interfaces:**
- Produces (micro + gateway type เดียวกัน):
  ```ts
  type IngredientInput = {
    ingredient_type?: 'product' | 'recipe'; // default 'product'
    product_id?: string;       // required เมื่อ product
    sub_recipe_id?: string;    // required เมื่อ recipe
    qty: number;
    ingredient_unit_id?: string; // required เมื่อ product; recipe: ไม่บังคับ ถ้าส่งต้องตรง base_yield_unit
    wastage_percentage?: number;
    note?: string | null;
  };
  type IngredientCostSource = 'average' | 'last_average' | 'standard' | 'none' | 'snapshot' | 'recipe';
  // IngredientCostLine เพิ่ม: ingredient_type, sub_recipe_id: string | null,
  //   sub_recipe: { id; code; name } | null · product_id / product เป็น nullable
  ```
- Zod: ใช้ `superRefine` บน object เดิม (ไม่ใช่ discriminatedUnion — client เก่าไม่ส่ง `ingredient_type`) บังคับ: product → มี `product_id` (uuid) + `ingredient_unit_id` (uuid) และไม่มี `sub_recipe_id`; recipe → มี `sub_recipe_id` (uuid) และไม่มี `product_id`

- [ ] **Step 1: แก้ zod + swagger DTO** ตามข้างบน
- [ ] **Step 2: แก้ micro DTO + `validateIngredientItems`** ให้กฎเดียวกัน (ข้อความ error รูปแบบ `${at}.sub_recipe_id is required` ตามของเดิม)
- [ ] **Step 3: ตรวจ** `bunx tsc --noEmit` ทั้ง gateway และ micro-business (จะมี error ปลายทางใน `costIngredients`/`replace` ที่ยังอ่าน `product_id` แบบ non-null — Task 3 แก้; ถ้าอยากให้ task นี้เขียวเดี่ยว ๆ รวม Task 2+3 เป็น commit เดียวได้) · eslint ไฟล์ที่แก้
- [ ] **Step 4: Commit** `feat(recipe): รับบรรทัดวัตถุดิบประเภทสูตร (sub_recipe_id) ใน input`

### Task 3: คิดต้นทุนบรรทัดสูตร + snapshot + กันวน + บันทึก + detail

**Files:**
- Create: `apps/micro-business/src/master/recipe/ingredients/sub-recipe-graph.ts`
- Modify: `apps/micro-business/src/master/recipe/ingredients/recipe-ingredient-cost.ts` (`CostedIngredient` :272, `snapshotKey` :304, `costIngredients` :328, `toCostLine` :471)
- Modify: `apps/micro-business/src/master/recipe/ingredients/recipe-ingredients.service.ts` (`preview` :54, `replace` :91-175)
- Modify: `apps/micro-business/src/master/recipe/recipe.service.ts` (`findOne` include :55-61, map :95-112)

**Interfaces:**
- Consumes: catalog entries จาก Task 1, `IngredientInput` จาก Task 2
- Produces: `snapshotKey(type: 'product' | 'recipe', refId: string, unitId: string): string` → `p:<id>|<unit>` / `r:<id>|<unit>` (ใช้ทั้งตอนสร้าง snapshot ใน `replace` และตอนจับคู่ใน `costIngredients`)
- Produces: `findCycle(prisma: any, recipeId: string, subRecipeIds: string[]): Promise<string | null>` — คืน id ของ sub ตรงที่พาวนกลับมา `recipeId` (หรือ `recipeId` เองถ้าอยู่ใน list) · null = ไม่วน
- Produces: `CostedIngredient` เพิ่ม `ingredient_type`, `sub_recipe: {id; code; name} | null`, `product` เป็น nullable
- `costIngredients(prisma, items, snapshots?, keepSnapshotCost = true, recipeId?: string)` — เพิ่ม `recipeId` (สำหรับกันวน)

- [ ] **Step 1: `sub-recipe-graph.ts`** — BFS:
  ```
  if subRecipeIds includes recipeId → return recipeId
  origin = Map(sub → sub) for each sub; frontier = subRecipeIds; visited = Set(frontier)
  loop while frontier non-empty:
    rows = tb_recipe_ingredient.findMany({ where: { recipe_id: { in: frontier }, sub_recipe_id: { not: null }, deleted_at: null }, select: { recipe_id, sub_recipe_id } })
    next = []
    for row: if row.sub_recipe_id === recipeId → return origin.get(row.recipe_id)
             if !visited.has(row.sub_recipe_id) → visited.add; origin.set(row.sub_recipe_id, origin.get(row.recipe_id)); next.push
    frontier = next
  return null
  ```
- [ ] **Step 2: `costIngredients`** — แยก items เป็นสินค้า/สูตร; โหลดสูตรฐานครั้งเดียว `tb_recipe.findMany({ where: { id: { in }, deleted_at: null }, select: { id, code, name, is_active, status, base_yield, base_yield_unit, total_ingredient_cost } })` และเติม `base_yield_unit` ของสูตรฐานเข้า `unitIds` ที่โหลด `tb_unit` · ถ้ามี `recipeId` และมีบรรทัดสูตร → `findCycle` ก่อนวนบรรทัด → `RECIPE_SUB_RECIPE_CYCLE` (`recipe` = `"<code> <name>"` ของ sub ที่คืนมา) · ต่อบรรทัดสูตร:
  - ไม่เจอสูตร → `RECIPE_SUB_RECIPE_NOT_FOUND` · จับ snapshot ก่อน แล้วบรรทัดที่**จับคู่ไม่ได้**ต้อง `is_active !== false && status !== ARCHIVED` ไม่งั้น `RECIPE_SUB_RECIPE_NOT_FOUND` (กติกาเดียวกับสินค้า inactive)
  - `base_yield_unit` ไม่อยู่ใน `unitById` → `RECIPE_SUB_RECIPE_NO_YIELD_UNIT`
  - ส่ง `ingredient_unit_id` มาและ ≠ `base_yield_unit` → `RECIPE_INGREDIENT_UNIT_INVALID` (`product` = ชื่อสูตร)
  - ต้นทุน: snapshot (ถ้าจับคู่ได้และ keep) หรือ `base_yield > 0 ? round(total_ingredient_cost / base_yield) : 0` source `'recipe'` / `'none'`
  - `computeLine` ด้วย conversion `{ from_qty: 1, to_qty: 1 }` · `inventory_unit_id = base_yield_unit`, `conversion_factor = 1`
  - บรรทัดสินค้า: ทำงานเดิม แต่ key snapshot เป็น `snapshotKey('product', …)`
- [ ] **Step 3: `toCostLine`** — คืน `ingredient_type`, `product_id: product?.id ?? null`, `product`, `sub_recipe_id: sub_recipe?.id ?? null`, `sub_recipe`
- [ ] **Step 4: service** — `preview` ส่ง `recipe_id` เป็น `recipeId` · `replace`: select `ingredient_type, product_id, sub_recipe_id, ingredient_unit_id, cost_per_unit`; key snapshot ด้วย `snapshotKey(type, product_id ?? sub_recipe_id, unit)` (ไม่ skip บรรทัดสูตร); insert เขียน `ingredient_type`, `product_id: l.product?.id ?? null`, `sub_recipe_id: l.sub_recipe?.id ?? null`, `name: (l.product ?? l.sub_recipe)!.name` · แก้ JSDoc ของ `replace` ให้พูดถึงบรรทัดสูตร
- [ ] **Step 5: `findOne`** — include `tb_sub_recipe: { select: { id: true, code: true, name: true } }` แล้ว map เป็น `sub_recipe: tb_sub_recipe ?? null` (ตัด raw relation ออกแบบเดียวกับ `tb_product`)
- [ ] **Step 6: ตรวจ** tsc gateway + micro-business, eslint ไฟล์ที่แก้, `bunx jest src/master/recipe` ใน micro-business และ `bunx jest src/common/dto/recipe src/config/config_recipes` ใน gateway → ผ่าน
- [ ] **Step 7: Commit** `feat(recipe): คิดต้นทุนวัตถุดิบที่เป็นสูตร + snapshot + กันสูตรวน`

### Task 4: Lookup `recipe` ส่งหน่วยผลผลิตและสถานะ + PR ฝั่ง BE

**Files:**
- Modify: `apps/micro-business/src/master/lookup/lookup-registry.ts:136`
- Check: `apps/backend-gateway/src/application/lookup/lookup-catalog.ts:34` (ถ้า catalog ประกาศ extra fields ต่อ resource ให้เติมด้วย ไม่งั้น gateway ตัดทิ้ง)

**Interfaces:**
- Produces: แถว lookup ของ `recipe` มี `base_yield_unit: string` และ `status: string` เพิ่ม (`extra: { base_yield_unit: { kind: 'string', column: 'base_yield_unit' }, status: { kind: 'string', column: 'status' } }`)

- [ ] **Step 1: แก้ registry (+catalog ถ้าจำเป็น)**
- [ ] **Step 2: ตรวจ** tsc + eslint + `bunx jest src/master/lookup` · curl lookup บน local (`GET /api/<bu>/lookup/recipe?...` ตาม path จริงใน controller) เห็นสองฟิลด์ใหม่ — **อย่า curl login user เดียวกับที่ล็อกอินในเบราว์เซอร์**
- [ ] **Step 3: Commit** `feat(lookup): ให้ lookup สูตรส่งหน่วยผลผลิตและสถานะ`
- [ ] **Step 4: เปิด PR BE** (อังกฤษ) — ระบุ: ไม่มี migration แต่ต้องยืนยันว่าทุก BU บน UAT/prod มีคอลัมน์ `ingredient_type`/`sub_recipe_id`, ต้อง build `packages/error-catalog`, **deploy BE ก่อน FE**, rollback ต้องเป็นคู่, ไม่มี api_name ใหม่

---

## FE (worktree carmen-inventory-frontend-react-subrecipe)

### Task 5: Types + helper ต้นทุนรองรับสองประเภท

**Files:**
- Modify: `types/recipe.ts:64-100` (`IngredientCostLine`, `IngredientInput`, `IngredientCostSource`)
- Modify: `types/lookup.ts` (เพิ่ม `RecipeLookup` + `LOOKUP_EXTRA_FIELDS.recipe = ["base_yield_unit", "status"]`)
- Modify: `routes/operation-plan/recipe/recipe-ingredients-cost.ts`
- Modify: `routes/operation-plan/recipe/recipe-form-schema.ts:79-80`

**Interfaces:**
- Consumes: รูป API จาก Task 2–3
- Produces:
  ```ts
  type IngredientType = "product" | "recipe";
  interface IngredientDraft { line_id; ingredient_type: IngredientType; product_id: string; sub_recipe_id: string;
    /** ชื่อของสินค้า/สูตรที่รู้อยู่แล้ว */ product_label: string; qty; ingredient_unit_id; wastage_percentage; note }
  /** "p:<id>" | "r:<id>" | "" เมื่อยังไม่เลือก */
  function refOf(d: { ingredient_type?: IngredientType; product_id?: string | null; sub_recipe_id?: string | null }): string;
  function pairKey(ref: string, unitId: string): string;   // `${ref}|${unitId}` — ref มี ":" ไม่มี "|"
  function parsePairKey(key: string): IngredientInput;     // qty 1, wastage 0 — ใช้ยิง preview
  type RecipeLookup = LookupItem & { base_yield_unit: string; status: string };
  ```
- `IngredientCostSource` เพิ่ม `"recipe"` · `IngredientCostLine`: `product_id: string | null`, `product` nullable (มีแล้ว), เพิ่ม `ingredient_type?`, `sub_recipe_id?: string | null`, `sub_recipe?: { id; code; name } | null` · `IngredientInput` ตามรูปของ Task 2
- `EMPTY_INGREDIENT` ได้ `ingredient_type: "product"`, `sub_recipe_id: ""`

- [ ] **Step 1: แก้ types** ตามข้างบน
- [ ] **Step 2: แก้ helper** — `ingredientToDraft` อ่าน `ingredient_type ?? "product"`, label จาก `product` หรือ `sub_recipe` · `draftToInput` ส่ง `ingredient_type` + (`product_id` หรือ `sub_recipe_id`) + `ingredient_unit_id` · `resolveRowCosts` / `pendingPairs` / `pairCostsFrom` ใช้ `refOf` แทน `product_id` ทุกจุด (snapshot จับคู่ด้วย ref + unit) · `pendingPairs` คืน `string[]` ของ pairKey แทน object (ผู้เรียกใช้ `parsePairKey`)
- [ ] **Step 3: schema ฟอร์ม** — แถววัตถุดิบต้องมี `product_id` (เมื่อ product) หรือ `sub_recipe_id` (เมื่อ recipe) ผ่าน `superRefine` ข้อความ required ใช้ `tf("product")` / `tf("recipe")` (เพิ่มคีย์ `field.recipe` ถ้ายังไม่มี)
- [ ] **Step 4: ตรวจ** `bun run typecheck` (error ปลายทางใน fields/cook view ปล่อยให้ Task 6–7 แก้ หรือรวม commit) · `bunx eslint` ไฟล์ที่แก้ · `bun test:run routes/operation-plan/recipe` ต้องผ่าน (ปรับ fixture ที่ขาด `ingredient_type` ได้ ห้ามลบเทสต์)
- [ ] **Step 5: Commit** `feat(recipe): แยกตัวอ้างอิงวัตถุดิบ สินค้า/สูตร ในตัวช่วยคิดต้นทุน`

### Task 6: ตัวเลือกวัตถุดิบในฟอร์ม (สินค้า | สูตร)

**Files:**
- Create: `components/lookup/lookup-recipe.tsx` (ตามแบบ `lookup-recipe-category.tsx` — resource `"recipe"`, lazy, `excludeIds`, `defaultLabel`, `onItemChange`, กรอง `status !== "ARCHIVED"` ด้วย `filter`)
- Modify: `routes/operation-plan/recipe/recipe-ingredients-fields.tsx` (`IngredientRow` :362-480, preview request :165-212, `IngredientCostTable` :602-686)
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: `refOf`, `pairKey`, `parsePairKey`, `RecipeLookup` จาก Task 5
- Produces: `LookupRecipe(props: { value; onValueChange; onItemChange?(r: RecipeLookup); excludeIds?: Set<string>; defaultLabel?; disabled?; size?; error?; placeholder?; className? })`

- [ ] **Step 1: `LookupRecipe`**
- [ ] **Step 2: แถววัตถุดิบ** — หน้าช่องค้นหามีสวิตช์สองค่า "สินค้า | สูตร" (ใช้ `ToggleGroup`/segmented ที่มีใน `components/ui/` — ห้ามตั้งสี/ขนาดเอง) · เปลี่ยนประเภท = ล้าง `product_id`/`sub_recipe_id`/`product_label`/`ingredient_unit_id` ของแถว · ประเภทสูตร: แสดง `LookupRecipe` (`excludeIds = new Set([recipeId])`) เลือกแล้วตั้ง `sub_recipe_id`, `product_label = name`, `ingredient_unit_id = item.base_yield_unit` (ใช้ `setValue` แบบเดียวกับที่แถวสินค้าตั้งหน่วยแรก) · ช่องหน่วยของแถวสูตรเป็นข้อความอ่านอย่างเดียว (ชื่อหน่วยจาก `useUnitById`) · ชื่อสูตรในแถวเป็นลิงก์เปิดแท็บใหม่ไป `/operation-plan/recipe/<sub_recipe_id>`
- [ ] **Step 3: preview** — `requestPair(key)` ใช้ `parsePairKey(key)` แทน `key.split("|")` · error ของ preview (เช่น `RECIPE_SUB_RECIPE_CYCLE`) แสดงที่บรรทัดนั้นด้วย `getUserErrorMessage` แบบที่ `fallbackError` ทำอยู่
- [ ] **Step 4: ตารางต้นทุน + ป้าย** — แถวสูตรมีป้ายเล็ก "สูตร" (ใช้ `Badge` variant ที่มีอยู่) · `cost_source === "recipe"` แสดงคำว่า "จากต้นทุนสูตร" ที่เดียวกับที่ source อื่นแสดง
- [ ] **Step 5: i18n** en/th: `ingredientTypeProduct`, `ingredientTypeRecipe`, `subRecipeBadge`, `costSourceRecipe`, `field.recipe` (ห้ามมี `{}`/`<คำ>` ที่ไม่ใช่ placeholder จริง)
- [ ] **Step 6: ตรวจ** `bun run typecheck` · `bun run lint` · `bun test:run routes/operation-plan/recipe components/lookup`
- [ ] **Step 7: Commit** `feat(recipe): เลือกสูตรอื่นเป็นวัตถุดิบในฟอร์มสูตร`

### Task 7: Cook view + dialog คำนวณใหม่

**Files:**
- Modify: `routes/operation-plan/recipe/recipe-cook-view.tsx:201-240`
- Modify: `routes/operation-plan/recipe/recipe-ingredients-recalc-dialog.tsx:151-156`

- [ ] **Step 1: cook view** — ชื่อบรรทัด = `line.sub_recipe?.name ?? line.product?.name ?? line.product?.code ?? "—"` · บรรทัดสูตร: ป้าย "สูตร" + ชื่อเป็น `<Link to={`/operation-plan/recipe/${line.sub_recipe_id}`}>` (navigate ในแท็บเดิม; back ของเบราว์เซอร์พากลับ) · checkbox ต้องยังติ๊กได้โดยไม่ trigger ลิงก์ (ลิงก์ไม่ครอบ label ของ checkbox)
- [ ] **Step 2: recalc dialog** — key แถวใช้ `refOf(line)` · ชื่อใช้ `sub_recipe?.name` ก่อน `product?.name`
- [ ] **Step 3: ตรวจ** typecheck + lint + `bun test:run routes/operation-plan/recipe`
- [ ] **Step 4: Commit** `feat(recipe): โหมดทำอาหารแสดงวัตถุดิบที่เป็นสูตรพร้อมลิงก์ไปสูตรฐาน`

### Task 8: ตรวจด้วยมือ (BE local + FE dev) แล้วเปิด PR ฝั่ง FE

- [ ] **Step 1:** รัน BE branch ในเครื่อง + `VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev` ใน worktree FE · **:4000 ชี้ shared dev DB — ใช้สูตรทดสอบที่สร้างใหม่ ตั้งชื่อขึ้นต้น `ZZ-SUB-` แล้วลบทิ้งตอนจบ**
- [ ] **Step 2:** เดินตาม "ตรวจด้วยมือ" 5 ข้อใน spec + Review Focus 5 ข้อ (ข้อ 3: สร้างสูตรที่ `base_yield_unit` เป็นข้อความเก่าไม่ได้ผ่าน UI — ข้ามได้ถ้าไม่มีข้อมูลแบบนั้นบน dev แต่บอก user ว่ายังไม่ได้ตรวจ)
- [ ] **Step 3:** ดู 375px และ dark mode ของแถววัตถุดิบ + cook view
- [ ] **Step 4:** เปิด PR FE (อังกฤษ) ระบุ: ต้อง merge/deploy หลัง BE PR, ไม่มี api_name ใหม่, ลิงก์ spec · รายงานผลตรวจมือตามจริง (ข้อไหนไม่ได้ตรวจให้เขียนว่าไม่ได้ตรวจ)
