# Recipe ช่วง 1: เพดาน food cost · คำแนะนำราคา · บันทึกจัดจาน/เก็บรักษา — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มเพดาน food cost % รายเมนู, การ์ดคำแนะนำราคา (ราคาที่เป้า/ราคาขั้นต่ำ + markup) และบันทึกการจัดจาน/การเก็บรักษา ให้ฟอร์มสูตรอาหาร โดยเก็บจริงใน DB

**Architecture:** BE เพิ่ม 3 คอลัมน์ใน `tb_recipe` (migration idempotent) แล้วไหลผ่าน micro interface → create/update → `convertDecimalFields` → gateway DTO/serializer/swagger. FE เพิ่มฟิลด์ในฟอร์ม, คำนวณราคาใน `useRecipeCostCalc` (ฐานเดียวกับ #335: ต้นทุนวัตถุดิบต่อจาน), การ์ดใหม่ในส่วน Costing, ส่วน Notes ใหม่

**Tech Stack:** BE NestJS + Prisma 7 + zod/v4 (`carmen-turborepo-backend-v2`); FE Vite + React 19 + RHF + zod + use-intl (`carmen-inventory-frontend-react`)

**Spec:** `docs/superpowers/specs/2026-10-16-recipe-cook-mode-costing-design.md` §5 และ §"ลำดับส่งงาน" ช่วง 1

## Global Constraints

- **ข้ามขั้นตอนเขียน/รันเทสต์ใหม่** (ความต้องการของ user ใน `~/.claude/CLAUDE.md`) — ทุก task จบที่ typecheck + lint + commit; เทสต์เดิมต้องยังเขียว (`bun test:run routes/operation-plan/recipe` ฝั่ง FE)
- Commit message ภาษาไทย, PR ภาษาอังกฤษ; ห้าม squash merge
- BE ทำบน branch `feature/recipe-pricing-notes` ใน backend-v2 (แตกจาก `main` ที่ pull ล่าสุด); FE ทำบน `feature/recipe-cook-mode-costing` (มีอยู่แล้ว)
- ชื่อคอลัมน์ตายตัว: `max_food_cost_percentage Decimal(20,5)?`, `plating_instructions Text?`, `storage_instructions Text?`
- ฐานคำนวณ: food cost = **ต้นทุนวัตถุดิบต่อจาน** ÷ ราคา (ไม่รวมแรง/โสหุ้ย); กำไรต่อจาน = ราคา − `costPerPortion` (ต้นทุนเต็ม)
- ราคาต่ำกว่าขั้นต่ำ = **เตือน ไม่บล็อก Save**
- i18n ทั้ง `messages/en.json` และ `messages/th.json`; ห้ามมี `{{` `}}` ในข้อความ
- ข้อความสถานะใช้ `text-destructive` / `text-*-ink` (ไม่ใช่ `text-warning`) — `lib/__tests__/status-ink-contrast.test.ts`
- ห้ามขนาดตัวอักษรนอก ladder (`components/ui/type-ladder.test.ts`)
- **ห้ามรัน migration บน DB dev เอง** — DB ใช้ร่วมทุก BU ต้องขอยืนยัน user ก่อน (Task 2 หยุดรอ)

## Review Focus

1. **เพดานต่ำกว่าเป้า** (เช่น เป้า 35 เพดาน 30) — ต้อง validate error ที่ช่องเพดาน ไม่ใช่คำนวณราคาขั้นต่ำสูงกว่าราคาเป้า → Task 4 schema refine
2. **ไม่มีวัตถุดิบ/ yield = 0 / ไม่มีราคาขาย** — การ์ดต้องไม่โชว์ `NaN`/`Infinity`; ราคาเป็น `null` แล้วซ่อนแถว, markup `null` แสดง "—" → Task 3 guards
3. **เพดาน 0 หรือ > 100** — zod `min(0.01).max(100)` ที่ FE; ราคาขั้นต่ำ `null` เมื่อ ≤ 0
4. **สูตรเก่าที่ฟิลด์ใหม่เป็น `null`** — GET ต้องคืน `null` (ไม่ใช่หายไป) และ `getDefaultValues` แปลงเป็น `null`/`""`; Save โดยไม่แตะต้องไม่เขียนค่าแปลก → Task 1 serializer + Task 4 defaults
5. **FE ขึ้นก่อน BE** — gateway zod ตัดคีย์แปลกปลอมทิ้งเงียบ ๆ (บันทึกแล้วหาย ไม่ error) → ระบุลำดับ deploy ใน PR body ของทั้งสอง PR (Task 6)

---

### Task 1: BE — คอลัมน์ใหม่ไหลผ่าน schema · micro · gateway

**Repo:** `/Users/samutpra/GitHub/carmensoftware-organize/carmen-turborepo-backend-v2`

**Files:**
- Modify: `packages/prisma-shared-schema-tenant/prisma/schema.prisma` (model `tb_recipe` ~:6495 — ใต้ `target_food_cost_percentage`)
- Create: `packages/prisma-shared-schema-tenant/prisma/migrations/20261016110000_add_recipe_pricing_notes/migration.sql`
- Modify: `apps/micro-business/src/master/recipe/interface/recipe.interface.ts` (:23 create, :58 update)
- Modify: `apps/micro-business/src/master/recipe/recipe.service.ts` (create data ~:239)
- Modify: `apps/micro-business/src/master/recipe/recipe.logic.ts` (`decimalFields` ~:43)
- Modify: `apps/backend-gateway/src/common/dto/recipe/recipe.create.dto.ts` (:32), `recipe.update.dto.ts` (:30), `recipe.serializer.ts` (:44)
- Modify: `apps/backend-gateway/src/config/config_recipes/swagger/request.ts` (:84), `swagger/response.ts`

**Interfaces:**
- Produces (API, ทั้ง request create/update และ response GET detail/list):
  `max_food_cost_percentage: number | null`, `plating_instructions: string | null`, `storage_instructions: string | null`

- [ ] **Step 1: Prisma schema** — เพิ่มใน `tb_recipe`:
  `max_food_cost_percentage Decimal? @db.Decimal(20, 5)`, `plating_instructions String? @db.Text`, `storage_instructions String? @db.Text` (ไม่มี default)

- [ ] **Step 2: Migration SQL** (idempotent ตามแบบ `20261016100000_add_recipe_comment`, คอมเมนต์ภาษาไทย):

```sql
-- เพดาน food cost % + บันทึกจัดจาน/เก็บรักษาของสูตร · idempotent
ALTER TABLE "tb_recipe" ADD COLUMN IF NOT EXISTS "max_food_cost_percentage" DECIMAL(20,5);
ALTER TABLE "tb_recipe" ADD COLUMN IF NOT EXISTS "plating_instructions" TEXT;
ALTER TABLE "tb_recipe" ADD COLUMN IF NOT EXISTS "storage_instructions" TEXT;
```

- [ ] **Step 3: Regenerate client** — รัน generate ของแพ็กเกจ tenant schema ตามสคริปต์ใน `packages/prisma-shared-schema-tenant/package.json` และ build `dist` (micro import จาก dist — กับดักที่เคยเจอ)

- [ ] **Step 4: micro** — interface: เพิ่ม 3 ฟิลด์ optional nullable ทั้ง create/update; service `create`: ส่ง `data.max_food_cost_percentage ?? null`, `data.plating_instructions ?? null`, `data.storage_instructions ?? null`; `update` ใช้ `...fields` spread อยู่แล้ว — ตรวจว่าไม่มี allowlist ตัดทิ้ง; `recipe.logic.ts` เพิ่ม `'max_food_cost_percentage'` ใน `decimalFields`

- [ ] **Step 5: gateway** — create/update DTO: `max_food_cost_percentage: z.number().min(0).max(100).nullable().optional()`, `plating_instructions: z.string().max(2000).nullable().optional()`, `storage_instructions` เหมือนกัน; serializer: `z.number().nullable().optional()` / `z.string().nullable().optional()`; swagger request/response เพิ่ม property ทั้ง 3

- [ ] **Step 6: Static checks**

Run: `bunx tsc --noEmit -p apps/micro-business && bunx tsc --noEmit -p apps/backend-gateway && bunx eslint <ไฟล์ที่แก้> --quiet`
Expected: ไม่มี error. เทสต์เดิมของ recipe ต้องเขียว: `cd apps/micro-business && bunx jest src/master/recipe` และ `cd apps/backend-gateway && bunx jest src/config/config_recipes` (ใช้ jest ห้าม bun test)

- [ ] **Step 7: Commit** — `feat(recipe): เพิ่มเพดาน food cost และบันทึกจัดจาน/เก็บรักษาในสูตรอาหาร`

### Task 2: BE — รัน migration บน DB dev + ทดสอบด้วย curl (หยุดรอ user)

- [ ] **Step 1: ขอยืนยัน user ก่อนรัน** — แจ้งว่าจะ ALTER `tb_recipe` ทุก BU บน DB dev ที่ใช้ร่วม (เพิ่มคอลัมน์ nullable อย่างเดียว ไม่แตะข้อมูลเดิม); รอคำว่า "ได้"
- [ ] **Step 2: รัน migration ทุก tenant** ด้วยสคริปต์ migrate-tenants ของรีโป แล้ว restart micro-business + gateway ในเครื่อง
- [ ] **Step 3: curl** (ใช้ตัวแปร shell สำหรับ token ห้ามฝังลงไฟล์): `PATCH`/`PUT api/config/T02/recipes/<id>` ส่ง 3 ฟิลด์ → `GET` ต้องได้ค่ากลับครบ (`max_food_cost_percentage` เป็น number); GET สูตรอื่นที่ไม่ได้แก้ต้องได้ `null` ทั้ง 3 คีย์
- [ ] **Step 4:** เปิด PR BE (body ภาษาอังกฤษ ระบุ: migration ต้องรันทุก BU ก่อน deploy, BE ก่อน FE)

### Task 3: FE — คำนวณราคาขั้นต่ำ + markup ใน `useRecipeCostCalc`

**Files:**
- Modify: `routes/operation-plan/recipe/use-recipe-cost-calc.ts`

**Interfaces:**
- Consumes: ฟิลด์ฟอร์ม `max_food_cost_percentage` (Task 4)
- Produces: `RecipeComputed` เพิ่ม
  `minPrice: number | null` (= ต้นทุนวัตถุดิบต่อจาน ÷ (max%/100)),
  `markup: number | null` (= selling ÷ costPerPortion, ปัด 2 ตำแหน่ง),
  `belowMinPrice: boolean` (= minPrice != null && selling > 0 && selling < minPrice),
  `profitAt: (price: number | null) => number | null` (= price − costPerPortion, round2; null ถ้า price null)
  — `suggestedPrice` เดิมคือ "ราคาที่เป้า" ไม่เปลี่ยนชื่อ

- [ ] **Step 1:** เพิ่ม `"max_food_cost_percentage"` ใน `useWatch` names; คำนวณ `minPrice` ด้วยเงื่อนไขเดียวกับ `suggestedPrice` (`0 < max ≤ 100 && yld > 0 && ing > 0`), `markup` เมื่อ `sell > 0 && costPerPortion > 0`
- [ ] **Step 2:** **ไม่** `setValue` ค่าใหม่ลงฟอร์ม (คำนวณแสดงอย่างเดียว ไม่บันทึก) — แต่ `profitAt` เป็นฟังก์ชัน ระวัง object `computed` ที่สร้างใหม่ทุก render อยู่ใน deps ของ `useEffect` เดิม: แยก `profitAt` ออกนอก object ที่ effect ใช้ หรือ `useCallback` เพื่อไม่ให้ effect วิ่งเกินเดิม
- [ ] **Step 3:** `bun run typecheck` ผ่าน (Task 4 ต้องเพิ่มฟิลด์ใน schema ก่อน typecheck จะผ่าน — ทำ Task 3+4 แล้วค่อยเช็กพร้อมกันได้)

### Task 4: FE — ฟิลด์ฟอร์ม + payload + type

**Files:**
- Modify: `types/recipe.ts` (`Recipe`, `CreateRecipeDto`)
- Modify: `routes/operation-plan/recipe/recipe-form-schema.ts` (schema ~:78, `EMPTY_FORM` ~:121, `getDefaultValues` ~:159)
- Modify: `routes/operation-plan/recipe/recipe-form.tsx` (`buildRecipePayload` ~:253)

**Interfaces:**
- Produces: `RecipeFormValues.max_food_cost_percentage: number | null`, `.plating_instructions: string`, `.storage_instructions: string`

- [ ] **Step 1:** `types/recipe.ts` — `Recipe` และ `CreateRecipeDto` เพิ่ม `max_food_cost_percentage: number | null; plating_instructions: string | null; storage_instructions: string | null`
- [ ] **Step 2:** schema — `max_food_cost_percentage: z.coerce.number().min(0.01).max(100).nullable()` (ระวัง coerce ของช่องว่าง → ใช้ pattern เดียวกับ `target_food_cost_percentage` ที่มีอยู่), `plating_instructions: z.string().max(2000)`, `storage_instructions: z.string().max(2000)`; `superRefine` ที่ระดับ object: ถ้าทั้งเป้าและเพดานมีค่าและ เพดาน < เป้า → issue ที่ path `max_food_cost_percentage` ข้อความ key ใหม่ `maxBelowTarget`
- [ ] **Step 3:** `EMPTY_FORM`: `null, "", ""`; `getDefaultValues`: `recipe.max_food_cost_percentage ?? null`, `recipe.plating_instructions ?? ""`, `recipe.storage_instructions ?? ""`
- [ ] **Step 4:** `buildRecipePayload`: ส่ง 3 ฟิลด์ (`|| null` สำหรับ text)
- [ ] **Step 5:** `bun run typecheck` + `bunx eslint routes/operation-plan/recipe types/recipe.ts --quiet` ผ่าน; `bun test:run routes/operation-plan/recipe` ยังเขียว (characterization test อาจต้องอัปเดต snapshot payload — อัปเดตได้เฉพาะเพิ่ม 3 คีย์)
- [ ] **Step 6: Commit (รวม Task 3)** — `feat(operation-plan): เพดาน food cost และคำนวณราคาขั้นต่ำของสูตร`

### Task 5: FE — UI การ์ดคำแนะนำราคา + ช่องเพดาน + ส่วน Notes

**Files:**
- Create: `routes/operation-plan/recipe/recipe-price-recommendations.tsx`
- Create: `routes/operation-plan/recipe/recipe-notes-fields.tsx`
- Modify: `routes/operation-plan/recipe/recipe-cost-fields.tsx` (ช่องเพดานข้าง target ~:195-215; วางการ์ดใต้ `RecipeCostVerdict` ~:217-224)
- Modify: `routes/operation-plan/recipe/recipe-form.tsx` (render `RecipeNotesFields` ต่อจาก `RecipeComplianceFields` ~:183)
- Modify: `messages/en.json`, `messages/th.json` (namespace `operationPlan.recipe`)

**Interfaces:**
- Consumes: `RecipeComputed` (Task 3), ฟิลด์ฟอร์ม (Task 4)
- Produces:
  `RecipePriceRecommendations({ form, computed, isDisabled }: { form: UseFormReturn<RecipeFormValues>; computed: RecipeComputed; isDisabled: boolean })`,
  `RecipeNotesFields({ form, isDisabled })`

- [ ] **Step 1: ช่องเพดาน** — copy รูปแบบช่อง `recipe-target-food-cost` (id `recipe-max-food-cost`, label key `maxFoodCost`, หน่วย %), error แสดงใต้ช่อง
- [ ] **Step 2: การ์ด** — แสดงเมื่อ `computed.suggestedPrice != null`; สองแถว: "ราคาที่เป้า (x%)" `suggestedPrice` + "กำไร/จาน" `profitAt(suggestedPrice)`; "ราคาขั้นต่ำ (y%)" `minPrice` + กำไร (ซ่อนแถวถ้า `minPrice == null`); แต่ละแถวปุ่ม "ใช้ราคานี้" → `form.setValue("selling_price", price, { shouldDirty: true, shouldValidate: true })` (disabled เมื่อ `isDisabled`); ท้ายการ์ด markup `×n.nn` หรือ "—"; ถ้า `belowMinPrice` → บรรทัดเตือน `text-destructive` key `belowMinPrice` (ไม่ยุ่งกับ submit). ใช้ `formatCurrency` + `฿` ตามช่องอื่นในไฟล์; ใช้ `EyeBrow` และ primitive จาก `components/ui/` ไม่ตั้งสีใหม่
  - ชิป "suggestedAtTarget" เดิมใต้ Selling Price: **เอาออก** (ซ้ำกับแถวแรกของการ์ด)
- [ ] **Step 3: Notes** — `SettingSection` ใหม่ (title key `notesSection`, desc `notesSectionDesc`) สอง textarea: `platingInstructions`, `storageInstructions`, ตัวนับ `n/2000` แบบเดียวกับ Description ใน `recipe-general-fields.tsx`
- [ ] **Step 4: i18n** — keys ใหม่ทั้ง en/th: `maxFoodCost`, `maxBelowTarget`, `priceRecommendations`, `priceAtTarget` (ICU `{pct}`), `priceAtMin` (`{pct}`), `profitPerPortion`, `useThisPrice`, `markup`, `belowMinPrice` (`{price}`), `notesSection`, `notesSectionDesc`, `platingInstructions`, `storageInstructions`; ลบ `suggestedAtTarget` ถ้าไม่มีที่ใช้แล้ว (`graft grep "suggestedAtTarget"` ก่อน)
- [ ] **Step 5:** `bun run typecheck` + `bun run lint` + `bun test:run routes/operation-plan/recipe components/ui/type-ladder.test.ts lib/__tests__/status-ink-contrast.test.ts` เขียว
- [ ] **Step 6: Commit** — `feat(operation-plan): การ์ดคำแนะนำราคาและบันทึกจัดจาน/เก็บรักษาในฟอร์มสูตร`

### Task 6: ตรวจในเบราว์เซอร์ + PR FE

- [ ] **Step 1:** `VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev` (BE local จาก Task 2) เปิด `/operation-plan/recipe/<id>` (T02)
- [ ] **Step 2: ตรวจ** — ใส่ต้นทุนวัตถุดิบ 300, yield 3, เป้า 30, เพดาน 35 → ราคาที่เป้า ฿333.33, ราคาขั้นต่ำ ฿285.71; ตั้งราคา 250 → เตือนแดง แต่ Save สำเร็จ; เพดาน 25 (< เป้า) → error ที่ช่อง Save ไม่ได้; กด "ใช้ราคานี้" → ช่องราคาเปลี่ยน + ฟอร์ม dirty; พิมพ์ plating/storage → Save → รีโหลด ค่ายังอยู่; สูตรอื่นที่ไม่มีค่า → ไม่มี NaN/Infinity; ตรวจทั้งภาษาไทย/อังกฤษ
- [ ] **Step 3:** push + เปิด PR FE (อังกฤษ) ระบุ "Deploy after backend PR #… and its migration on every BU"; ไม่ squash
