# Recipe ช่วง 2: ขั้นตอนทำในฟอร์ม + โหมดทำอาหาร — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เชฟเปิด `/operation-plan/recipe/:id` บนแท็บเล็ตแล้วเจอโหมดทำอาหาร (อ่านอย่างเดียว ทีละขั้น) ส่วนผู้มีสิทธิ์แก้ขั้นตอนทำได้ในฟอร์มที่ย้ายไป `/:id/edit`

**Architecture:** FE อย่างเดียว — BE มี API ขั้นตอนครบแล้ว และ recipe detail (`GET …/recipes/:id`) คืน `preparation_steps` มาด้วยอยู่แล้ว (cook view ไม่ต้องยิงเพิ่ม). ฟอร์มถือขั้นตอนเป็น `useFieldArray` ใน RHF แล้ว sync หลังบันทึกหัวสูตรสำเร็จ ด้วย diff → DELETE / PATCH / POST / PUT order

**Tech Stack:** Vite + React 19 + React Router 7 + RHF + zod + TanStack Query + use-intl

**Spec:** `docs/superpowers/specs/2026-10-16-recipe-cook-mode-costing-design.md` §1 Routing, §2 โหมดทำอาหาร, §3 ขั้นตอนทำในฟอร์ม

## Global Constraints

- ข้ามการเขียนเทสต์ใหม่ (กฎ user) — typecheck + lint + เทสต์เดิมต้องเขียว (`bun test:run routes/operation-plan/recipe`)
- Branch `feature/recipe-steps-cook-mode` จาก `main`; commit ภาษาไทย, PR อังกฤษ, ไม่ squash
- API (ตรวจแล้ว 2026-10-16 บน dev: guard ผ่านทั้ง 5 api_name — `recipe.listPreparationSteps/addPreparationSteps/patchPreparationStep/deletePreparationStep/reorderPreparationSteps`):
  - `POST  /api/config/:bu/recipes/:id/preparation-steps` body `{ details: { add: StepItem[] } }` → คืนแถวที่สร้าง **ตามลำดับที่ส่ง** ต่อท้าย sequence
  - `PATCH …/preparation-steps/:stepId` body `Partial<StepItem> & { doc_version }`
  - `DELETE …/preparation-steps/:stepId`
  - `PUT …/preparation-steps/order` body `{ step_ids }` — **ต้องครบทุกขั้นที่ active ไม่ขาดไม่ซ้ำ** ไม่งั้น 400
  - StepItem: `title?`, `description` (บังคับ ≥1 ตัวอักษร), `duration?` int นาที, `temperature?` number, `temperature_unit?` `"c"|"f"`, `equipment?` array, `chef_notes?`, `safety_warnings?`
  - แถวที่อ่านกลับ: `temperature` เป็น **string** (Decimal) หรือ null — ต้อง `Number()`
- `equipment` เก็บ `{ id: string | null; name: string }[]` (spec §3); อ่านของเก่าที่เป็น string ให้ normalize เป็น `{ id: null, name }`
- Lookup อุปกรณ์ใช้ lookup API resource `"recipe_equipment"` (มีใน BE `lookup-catalog.ts:37`) แบบ lazy ห้าม `perpage=-1`
- ปุ่ม "แก้ไขสูตร" แสดงเมื่อ `useCan().can(PERMISSIONS.operation_plan.recipe.update)` (คีย์จริงดูใน `constant/permissions.ts:194` `crud("operation_plan.recipe")`)
- i18n en/th, ห้าม `{{ }}`; ข้อความเตือนใช้ ink token; ขนาดตัวอักษรตาม ladder; เป้าแตะปุ่มในโหมดทำอาหาร ≥ 48px (`h-12`)
- route ใหม่อยู่ใต้ section parent เดิมของ operation-plan → error boundary ครอบอยู่แล้ว (ไม่ต้องเพิ่ม)

## Review Focus

1. **Save ล้มกลางทาง** (หัวสูตรบันทึกแล้ว แต่ POST/PATCH ขั้นตอนพัง) — ต้อง toast error, ไม่กลับหน้า list, refetch recipe เพื่อให้ id/doc_version ของขั้นที่บันทึกไปแล้วถูกต้อง แล้ว Save ซ้ำได้โดยไม่สร้างขั้นซ้ำ → Task 4 (reset ฟอร์มจากข้อมูล refetch)
2. **doc_version ค้างหลัง Save ครั้งแรก** — แก้ขั้นเดิมสองรอบติดกันโดยไม่ออกจากหน้า PATCH รอบสองต้องไม่ 409/ไม่เงียบ → invalidate recipe query หลัง sync (Task 2) และฟอร์ม reset จากข้อมูลใหม่
3. **สูตรใหม่ (`/new`)** — ส่วนขั้นตอนต้องไม่ให้กรอก (ยังไม่มี recipe_id) แสดงข้อความ "บันทึกสูตรก่อนเพิ่มขั้นตอน" → Task 4
4. **ข้อมูลเก่า/แปลก**: `equipment` เป็น string array หรือ `[]`, `temperature` null, `duration` null, description ยาวมากหลายบรรทัด — cook view ต้องไม่พัง, ข้อความ wrap ไม่ล้น → Task 5
5. **ลิงก์เดิมที่ชี้ `/:id`** (bookmark, ปุ่ม Back จาก `/edit`) — ต้องไปโหมดทำอาหาร ไม่ใช่ฟอร์ม; Back/Cancel ในฟอร์มกลับ list ตามพฤติกรรมเดิม → Task 1

---

### Task 1: Routing — `/:id` = cook view, `/:id/edit` = ฟอร์ม (เปิดมาในโหมดแก้ไข)

**Files:**
- Modify: `routes/router.tsx:605-607` — `recipe/:id` → `./operation-plan/recipe/recipe-cook.route`; เพิ่ม `recipe/:id/edit` → `./operation-plan/recipe/recipe-edit.route`
- Create: `routes/operation-plan/recipe/recipe-cook.route.tsx` (ชั่วคราวเรนเดอร์ placeholder `<RecipeCookContent id />` — Task 5 ทำเนื้อจริง)
- Modify: `hooks/use-entity-form.ts` — option ใหม่ `initialMode?: "view" | "edit"` (default คงเดิม: `entity ? "view" : "add"`; ใช้ `"edit"` เฉพาะเมื่อมี entity)
- Modify: `routes/operation-plan/recipe/recipe-edit-content.tsx` / `recipe-form.tsx` — ส่ง `initialMode: "edit"` เข้า `useEntityForm`
- Modify: `routes/operation-plan/recipe/use-recipe-table.tsx` / `recipe-component.tsx` — คลิกแถว/การ์ดไป `/:id` (เดิม) ; เพิ่มรายการ "แก้ไข" ในเมนู ⋯ ของแถว (ดูว่า `useConfigTable` รับ action เพิ่มอย่างไร — ถ้าไม่มีช่องทาง ให้ข้ามและบันทึก ruling; ปุ่มในหน้า cook ก็พอ)

**Interfaces:**
- Produces: route `/operation-plan/recipe/:id/edit`; `useEntityForm({ …, initialMode })`

- [ ] **Step 1:** แก้ router + สร้าง cook route placeholder
- [ ] **Step 2:** `initialMode` ใน `useEntityForm` — Cancel ในโหมด edit ยังทำงานเหมือนเดิม (กลับ view หรือ list ตามโค้ดเดิม `:118-120`)
- [ ] **Step 3:** `bun run typecheck` + `bunx eslint hooks/use-entity-form.ts routes/router.tsx routes/operation-plan/recipe --quiet` + `bun test:run hooks routes/operation-plan/recipe` เขียว
- [ ] **Step 4: Commit** — `feat(operation-plan): แยกหน้าสูตรเป็นโหมดทำอาหาร (/:id) กับฟอร์มแก้ไข (/:id/edit)`

### Task 2: Types + API + hook sync ขั้นตอน

**Files:**
- Modify: `types/recipe.ts` — แทน `preparation_steps: unknown[]` ด้วย `RecipePreparationStep[]`
- Modify: `constant/api-endpoints.ts` (ใกล้ `RECIPES` :434) — `RECIPE_PREPARATION_STEPS: (buCode: string, recipeId: string) => \`${RECIPES(buCode)}/${recipeId}/preparation-steps\`` (เขียนให้เข้ากับสไตล์ไฟล์)
- Create: `routes/operation-plan/recipe/recipe-steps-sync.ts` — ฟังก์ชันบริสุทธิ์
- Create: `routes/operation-plan/recipe/use-recipe-steps-sync.ts` — mutation hook

**Interfaces:**
- Produces:
  ```ts
  // types/recipe.ts
  export interface RecipeEquipmentRef { id: string | null; name: string }
  export interface RecipePreparationStep {
    id: string; doc_version: number; sequence_no: number;
    title: string | null; description: string;
    duration: number | null; temperature: string | number | null; temperature_unit: "c" | "f" | null;
    equipment: unknown; chef_notes: string | null; safety_warnings: string | null;
  }
  // recipe-steps-sync.ts
  export interface StepDraft {            // ค่าในฟอร์ม (field array item)
    step_id: string | null;               // null = ขั้นใหม่ (ห้ามใช้ชื่อ `id` — ชนกับ key ของ useFieldArray)
    doc_version: number | null;
    title: string; description: string;
    duration: number | null; temperature: number | null; temperature_unit: "c" | "f";
    equipment: RecipeEquipmentRef[]; chef_notes: string; safety_warnings: string;
  }
  export function normalizeEquipment(raw: unknown): RecipeEquipmentRef[]
  export function stepToDraft(s: RecipePreparationStep): StepDraft
  export function diffSteps(original: RecipePreparationStep[], drafts: StepDraft[]): {
    toDelete: string[];
    toPatch: { step_id: string; body: Record<string, unknown> }[]; // เฉพาะฟิลด์ที่เปลี่ยน + doc_version
    toAdd: StepDraft[];                    // ตามลำดับที่ปรากฏใน drafts
    needsReorder: boolean;                 // ลำดับ step_id เดิมที่เหลือ ≠ ลำดับใน drafts หรือมีขั้นใหม่แทรกก่อนขั้นเดิม
  }
  // use-recipe-steps-sync.ts
  export function useSyncRecipeSteps(): UseMutationResult<void, Error, { recipeId: string; original: RecipePreparationStep[]; drafts: StepDraft[] }>
  ```

- [ ] **Step 1:** types + endpoint
- [ ] **Step 2:** `recipe-steps-sync.ts` — แปลง draft → StepItem: ข้อความว่างเป็น `null`, `temperature_unit` ส่งเฉพาะเมื่อมี temperature, `equipment` ส่งเป็น array ของ `{id,name}`
- [ ] **Step 3:** `useSyncRecipeSteps` ลำดับ: DELETE ทั้งหมด → PATCH ทีละขั้น → POST `toAdd` (ครั้งเดียว ถ้ามี) → ถ้า `needsReorder`: ประกอบ `step_ids` ตามลำดับ drafts โดยแทน draft ใหม่ด้วย id จาก POST response ตามลำดับ แล้ว PUT order. ทำต่อเนื่องแบบ sequential (ไม่ Promise.all — ลำดับมีผล). **onSettled**: invalidate query ของ recipe detail (ใช้ queryKey เดียวกับ `useRecipeById` ใน `use-recipe.ts`) ทั้งตอนสำเร็จและล้ม. ใช้ `httpClient` + `ApiError` แบบ `use-recipe.ts`
- [ ] **Step 4:** typecheck + lint ไฟล์ที่แตะ
- [ ] **Step 5: Commit** — `feat(operation-plan): type และ hook sync ขั้นตอนทำของสูตร`

### Task 3: Lookup อุปกรณ์

**Files:**
- Modify: `types/lookup.ts` — เพิ่ม `"recipe_equipment"` ใน `LookupResource`
- Create: `components/lookup/lookup-recipe-equipment.tsx` — โคลนโครง `lookup-equipment-category.tsx` (resource `"recipe_equipment"`, `excludeIds`, lazy `hasOpened`)

**Interfaces:**
- Produces: `LookupRecipeEquipment({ value, onValueChange, onItemChange?, excludeIds?, disabled?, size?, placeholder? })` — `onItemChange(item: LookupItem | undefined)` ให้ผู้เรียกได้ชื่อมาเก็บใน `{id,name}` (ดู prop ชื่อเดียวกันใน `lookup-thai-province.tsx` เป็นแบบ)

- [ ] **Step 1:** เพิ่ม resource + component
- [ ] **Step 2:** typecheck + lint
- [ ] **Step 3: Commit** — `feat(lookup): lookup อุปกรณ์ครัวสำหรับขั้นตอนทำ`

### Task 4: ส่วน "ขั้นตอนทำ" ในฟอร์ม + sync ตอนบันทึก

**Files:**
- Modify: `routes/operation-plan/recipe/recipe-form-schema.ts` — `preparation_steps: z.array(stepDraftSchema)`; `stepDraftSchema`: `description` min 1 (ข้อความ `tv("required", { field: tfl("description") })`), `duration` coerce int ≥0 nullable, `temperature` coerce number nullable, `title/chef_notes/safety_warnings` string max 500/1000/1000, `equipment` array of `{id: string|null, name: string}`; `EMPTY_FORM.preparation_steps = []`; `getDefaultValues` = `recipe.preparation_steps.map(stepToDraft)` เรียงตาม `sequence_no`
- Modify: `routes/operation-plan/recipe/recipe-form.tsx` — `buildRecipePayload` **ไม่ส่ง** `preparation_steps`; update path: `updateRecipe` onSuccess → `syncSteps.mutate({ recipeId, original: recipe.preparation_steps, drafts: values.preparation_steps })` → onSuccess toast + `backToList`; onError toast error (ข้อความ key ใหม่ `stepsSaveFailed`) ไม่ออกจากหน้า. ข้าม sync เมื่อ diff ว่าง. `isPending` รวม `syncSteps.isPending`
- Create: `routes/operation-plan/recipe/recipe-steps-fields.tsx` — `SettingSection` (title `stepsSection`, desc `stepsSectionDesc`) วางระหว่าง Ingredients กับ Safety & Compliance
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: `StepDraft`, `diffSteps`, `useSyncRecipeSteps` (Task 2); `LookupRecipeEquipment` (Task 3)
- Produces: `RecipeStepsFields({ form, isDisabled, isNew }: { form: UseFormReturn<RecipeFormValues>; isDisabled: boolean; isNew: boolean })`

- [ ] **Step 1: schema + defaults**
- [ ] **Step 2: UI** — `useFieldArray({ name: "preparation_steps", keyName: "key" })`. ต่อขั้น: เลขขั้น, ชื่อขั้น (input), คำอธิบาย (textarea บังคับ), แถวเล็ก: เวลา (นาที) · อุณหภูมิ + select c/f · อุปกรณ์ (chip ของ `{name}` + ปุ่มลบ chip + `LookupRecipeEquipment` สำหรับเพิ่ม, `excludeIds` = id ที่มีแล้ว), chef notes, safety warnings (textarea); ปุ่ม ขึ้น/ลง (`move`) และลบ (`remove`) ต่อขั้น; ปุ่ม "เพิ่มขั้นตอน" ท้ายส่วน. `isNew` → แสดงข้อความ `stepsAfterSave` แทนเนื้อหา. error ของ description ต้องอ่านผ่าน `useFormState` (บทเรียนช่วง 1 — อย่าอ่าน `form.formState.errors` ตรง ๆ)
- [ ] **Step 3: sync ตอนบันทึก** ตามที่ระบุใน Files
- [ ] **Step 4: i18n** — `stepsSection`, `stepsSectionDesc`, `stepN` (`{n}`), `stepTitle`, `stepDescription`, `stepDuration`, `stepTemperature`, `stepEquipment`, `stepChefNotes`, `stepSafety`, `addStep`, `moveUp`, `moveDown`, `removeStep`, `stepsAfterSave`, `stepsSaveFailed`, `noSteps`
- [ ] **Step 5:** typecheck + `bun run lint` + `bun test:run routes/operation-plan/recipe` เขียว (characterization test อาจต้องเพิ่มคีย์ `preparation_steps` ในความคาดหวัง — แก้เฉพาะส่วนนั้น)
- [ ] **Step 6: Commit** — `feat(operation-plan): แก้ไขขั้นตอนทำในฟอร์มสูตรอาหาร`

### Task 5: โหมดทำอาหาร

**Files:**
- Create: `routes/operation-plan/recipe/recipe-cook-content.tsx` — โหลด `useRecipeById(id)` (loading → skeleton, error → `ErrorState` แบบ `recipe-edit-content.tsx`)
- Create: `routes/operation-plan/recipe/recipe-cook-view.tsx` — เลย์เอาต์
- Create: `routes/operation-plan/recipe/use-wake-lock.ts`
- Modify: `routes/operation-plan/recipe/recipe-cook.route.tsx` (จาก Task 1) — ใช้ `RecipeCookContent`
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: `RecipePreparationStep`, `normalizeEquipment` (Task 2)
- Produces: `useWakeLock(enabled: boolean): void`; `RecipeCookView({ recipe }: { recipe: Recipe })`

- [ ] **Step 1: `useWakeLock`** — ถ้า `"wakeLock" in navigator` ขอ `navigator.wakeLock.request("screen")`; ฟัง `visibilitychange` ขอใหม่เมื่อ visible; release ตอน unmount; ทุก error กลืนเงียบ (ไม่ toast)
- [ ] **Step 2: เลย์เอาต์ (spec §2, mockup A)** — หัว: ชื่อสูตร, รหัส, yield + หน่วย (ใช้ `useUnitById` แบบเดียวกับ cost-fields), เวลารวม (`prep_time + cook_time` นาที), ปุ่ม "แก้ไขสูตร" (`Link` ไป `/:id/edit`, เฉพาะผู้มีสิทธิ์ update) และปุ่มกลับรายการ
  - `md:` ขึ้นไป grid สองคอลัมน์ `[2fr_1fr]`; จอแคบซ้อนลง (ขั้นตอนก่อน)
  - ขั้นปัจจุบัน (state `index`): ป้าย "ขั้นที่ n / N", แถว meta (เวลา · อุณหภูมิ+หน่วย · อุปกรณ์คั่น ·) แสดงเฉพาะที่มีค่า, คำอธิบาย `text-xl`/ตาม ladder `whitespace-pre-line`, safety warnings ในกล่องเตือน (`text-warning-ink`), chef notes ตัวรอง
  - ขั้นถัดไปแสดงจางข้างใต้ (ถ้ามี); รายการขั้นทั้งหมดแบบย่อให้แตะกระโดด (`aria-current` ที่ขั้นปัจจุบัน)
  - ปุ่ม ก่อนหน้า/ถัดไป `h-12` เต็มความกว้างครึ่งละปุ่ม, disabled ที่ขอบ; คีย์ `ArrowLeft/ArrowRight` บน window
  - คอลัมน์ข้าง: "วัตถุดิบ" — ช่วงนี้ยังไม่มีข้อมูลจริง → ซ่อนหัวข้อนี้ทั้งหมด (ช่วง 4 จะเติม); "จัดจาน" (`plating_instructions`), "การเก็บรักษา" (`storage_instructions`), allergens เป็น `Badge` — แต่ละบล็อกซ่อนเมื่อว่าง
  - ไม่มีขั้นตอน → empty state ข้อความ `cookNoSteps` + ลิงก์ไป `/edit` ถ้ามีสิทธิ์
  - ไม่มีตัวเลขต้นทุน/ราคาใด ๆ ในหน้านี้
- [ ] **Step 3: i18n** — `cookStepOf` (`{n}` `{total}`), `cookPrev`, `cookNext`, `cookNextUp`, `cookAllSteps`, `cookTotalTime` (`{min}`), `cookYield`, `editRecipe`, `cookNoSteps`, `cookPlating`, `cookStorage`, `cookAllergens`, `cookSafety`, `cookChefNotes`, `minShort` (`{min}`)
- [ ] **Step 4:** typecheck + lint + `bun test:run routes/operation-plan/recipe components/ui/type-ladder.test.ts lib/__tests__/status-ink-contrast.test.ts`
- [ ] **Step 5: Commit** — `feat(operation-plan): โหมดทำอาหารสำหรับแท็บเล็ตในครัว`

### Task 6: ตรวจในเบราว์เซอร์ + PR

- [ ] **Step 1:** local BE (`localhost:4000`) + dev server, สูตรทดสอบ T02 P0021 (`24a41e79-…`) — **ทุกอย่างที่เขียนลง DB ต้องลบคืนตอนจบ** (DB dev ใช้ร่วม)
- [ ] **Step 2: ฟอร์ม** — เปิด `/edit` เข้าโหมดแก้ไขทันที; เพิ่ม 3 ขั้น (มีเวลา/อุณหภูมิ/อุปกรณ์ 2 ชิ้น/คำเตือน) → Save → กลับ list; เปิด `/edit` ใหม่ ค่าครบ; สลับขั้น 1↔3 + แก้คำอธิบายขั้น 2 + ลบขั้น 3 + เพิ่มขั้นใหม่ไว้บนสุด → Save → ลำดับถูก, ไม่มีขั้นซ้ำ; ปล่อยคำอธิบายว่าง → error ขึ้นที่ช่อง Save ไม่ได้; `/new` แสดงข้อความ "บันทึกก่อน"
- [ ] **Step 3: cook view** — `/:id` แสดงขั้น 1/N, ถัดไป/ก่อนหน้า/คีย์ลูกศร/แตะรายการ, meta ครบ, คำเตือนสีถูก, plating/storage/allergens, ปุ่มแก้ไขพาไป `/edit`; ความกว้าง 768px และ 375px ไม่ล้น; ภาษาไทย
- [ ] **Step 4:** ลบขั้นตอนทดสอบทั้งหมดผ่านฟอร์ม (หรือ curl DELETE) แล้วยืนยัน GET ได้ `[]`
- [ ] **Step 5:** push + PR (อังกฤษ) — ระบุ: FE-only, api_name ทั้ง 5 ผ่าน guard บน dev แล้ว **UAT/prod ต้องเช็ก allowlist ก่อน deploy** (api_name ที่ไม่อยู่ใน allowlist → 401 → user ถูก logout), เปลี่ยน URL: ลิงก์ `/:id` เดิมเปิดโหมดทำอาหาร
