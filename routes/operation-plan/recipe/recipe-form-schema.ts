import { z } from "zod";
import type { TranslationFn } from "@/lib/i18n-schema";
import type { Recipe } from "@/types/recipe";
import { ALLERGEN_OPTIONS } from "@/constant/recipe";
import { arrayToText } from "@/lib/form-helpers";
import { activeSteps, stepToDraft } from "./recipe-steps-sync";
import {
  activeIngredients,
  ingredientToDraft,
} from "./recipe-ingredients-cost";

export { textToArray, textToObject } from "@/lib/form-helpers";

const STANDARD_ALLERGEN_VALUES = new Set(
  ALLERGEN_OPTIONS.map((a) => a.value as string),
);

export const splitAllergens = (
  allergens: string[] | null | undefined,
): { standard: string[]; custom: string } => {
  if (!allergens || allergens.length === 0) return { standard: [], custom: "" };

  const standard: string[] = [];
  const custom: string[] = [];

  for (const a of allergens) {
    const lower = a.toLowerCase();
    if (STANDARD_ALLERGEN_VALUES.has(lower)) {
      standard.push(lower);
    } else {
      custom.push(a);
    }
  }

  return { standard, custom: custom.join(", ") };
};

export const mergeAllergens = (allergens: {
  standard: string[];
  custom: string;
}): string[] => {
  const custom = allergens.custom
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...allergens.standard, ...custom];
};

// ── Schema ──

const nullableNumber = z.preprocess(
  (v) => (v === "" || v === undefined || Number.isNaN(v) ? null : v),
  z.coerce.number().nullable(),
);

function createStepSchema(tv: TranslationFn, tf: TranslationFn) {
  return z.object({
    step_id: z.string().nullable(),
    doc_version: z.number().nullable(),
    title: z.string().max(500),
    description: z
      .string()
      .trim()
      .min(1, tv("required", { field: tf("description") })),
    duration: nullableNumber.pipe(z.number().int().min(0).nullable()),
    temperature: nullableNumber,
    temperature_unit: z.enum(["c", "f"]),
    equipment: z.array(
      z.object({ id: z.string().nullable(), name: z.string() }),
    ),
    chef_notes: z.string().max(1000),
    safety_warnings: z.string().max(1000),
  });
}

function createIngredientSchema(tv: TranslationFn, tf: TranslationFn) {
  return z
    .object({
      line_id: z.string().nullable(),
      ingredient_type: z.enum(["product", "recipe"]),
      product_id: z.string(),
      sub_recipe_id: z.string(),
      product_label: z.string(),
      qty: z.coerce.number().gt(0, tv("positive", { field: tf("qty") })),
      ingredient_unit_id: z
        .string()
        .min(1, tv("required", { field: tf("unit") })),
      wastage_percentage: z.preprocess(
        (v) => (v === "" || v === undefined || Number.isNaN(v) ? 0 : v),
        z.coerce
          .number()
          .min(0, tv("minZero", { field: "%" }))
          .max(100, tv("maxNumber", { field: "%", max: 100 })),
      ),
      note: z
        .string()
        .max(500, tv("maxLength", { field: tf("note"), max: 500 })),
    })
    .superRefine((line, ctx) => {
      // บรรทัดสินค้าต้องมีสินค้า บรรทัดสูตรต้องมีสูตร — ข้อความแสดงที่ช่องเลือกของบรรทัดนั้น
      if (line.ingredient_type === "recipe") {
        if (!line.sub_recipe_id)
          ctx.addIssue({
            code: "custom",
            path: ["sub_recipe_id"],
            message: tv("required", { field: tf("recipe") }),
          });
      } else if (!line.product_id) {
        ctx.addIssue({
          code: "custom",
          path: ["product_id"],
          message: tv("required", { field: tf("product") }),
        });
      }
    });
}

export function createRecipeSchema(tv: TranslationFn, tf: TranslationFn) {
  return z
    .object({
      code: z.string().min(1, tv("required", { field: tf("code") })),
      name: z.string().min(1, tv("required", { field: tf("name") })),
      description: z.string(),
      note: z.string(),
      status: z.string().min(1, tv("required", { field: tf("status") })),
      difficulty: z
        .string()
        .min(1, tv("required", { field: tf("difficulty") })),
      cuisine_id: z
        .string()
        .nullable()
        .refine((v) => !!v, tv("required", { field: tf("cuisine") })),
      category_id: z
        .string()
        .nullable()
        .refine((v) => !!v, tv("required", { field: tf("category") })),
      prep_time: z.coerce.number().min(0),
      cook_time: z.coerce.number().min(0),
      base_yield: z.coerce.number().min(0),
      base_yield_unit: z
        .string()
        .nullable()
        .refine((v) => !!v, tv("required", { field: tf("unit") })),
      total_ingredient_cost: z.coerce.number().min(0),
      labor_cost: z.coerce.number().min(0),
      overhead_cost: z.coerce.number().min(0),
      cost_per_portion: z.coerce.number().min(0),
      selling_price: z.coerce.number().nullable(),
      suggested_price: z.coerce.number().nullable(),
      gross_margin: z.coerce.number().nullable(),
      gross_margin_percentage: z.coerce.number().nullable(),
      actual_food_cost_percentage: z.coerce.number().nullable(),
      target_food_cost_percentage: z.coerce.number().nullable(),
      max_food_cost_percentage: z.coerce.number().min(0).max(100).nullable(),
      plating_instructions: z.string().max(2000),
      preparation_steps: z.array(createStepSchema(tv, tf)),
      ingredients: z.array(createIngredientSchema(tv, tf)),
      /** ผู้ใช้กด "ใช้ต้นทุนใหม่" แล้ว — PUT วัตถุดิบด้วย recalculate: true (ไม่ส่งไปกับหัวสูตร) */
      recalculate_ingredients: z.boolean(),
      storage_instructions: z.string().max(2000),
      labor_cost_percentage: z.coerce.number().nullable(),
      overhead_percentage: z.coerce.number().nullable(),
      allergens: z.object({
        standard: z.array(z.string()),
        custom: z.string(),
      }),
      tags: z.string(),
      carbon_footprint: z.coerce.number().nullable(),
      deduct_from_stock: z.boolean(),
      default_variant_id: z.string().nullable(),
      info: z.string(),
      dimension: z.string(),
      is_active: z.boolean(),
    })
    .superRefine((v, ctx) => {
      // เพดานต่ำกว่าเป้า = ราคาขั้นต่ำสูงกว่าราคาที่เป้า ซึ่งกลับหัวกลับหาง
      const target = Number(v.target_food_cost_percentage) || 0;
      const max = Number(v.max_food_cost_percentage) || 0;
      if (target > 0 && max > 0 && max < target) {
        ctx.addIssue({
          code: "custom",
          path: ["max_food_cost_percentage"],
          message: tv("maxFoodCostBelowTarget"),
        });
      }
    });
}

export type RecipeFormValues = z.infer<ReturnType<typeof createRecipeSchema>>;

// ── Number inputs (register options) ──

/**
 * `<input type="number">` ส่งค่าเป็น string เสมอ ขณะที่ค่าตั้งต้นเป็น number —
 * RHF เทียบ dirty ด้วย deepEqual กับ defaultValues ("12" ≠ 12) แก้ตัวเลขแล้วแก้กลับ
 * ฟอร์มจึงค้าง dirty · แปลงเป็น number ตั้งแต่ตอนลงทะเบียนให้ชนิดตรงกับค่าตั้งต้น
 * (schema ยัง coerce/preprocess ซ้ำได้ตามเดิม ข้อความ validation ไม่เปลี่ยน)
 */
const toNumber = (v: unknown): number =>
  typeof v === "number" ? v : Number(v);

/** ช่องตัวเลขที่ห้ามว่าง — ช่องว่างกลายเป็น 0 เหมือนที่ z.coerce ทำอยู่เดิม */
export const numberInput = { setValueAs: toNumber } as const;

/** ช่องตัวเลขที่ว่างได้ — ช่องว่างคืน null ตรงกับค่าตั้งต้น (ไม่ใช่ 0) */
export const nullableNumberInput = {
  setValueAs: (v: unknown): number | null =>
    v === "" || v == null ? null : toNumber(v),
} as const;

// ── Default Values ──

export const EMPTY_FORM: RecipeFormValues = {
  code: "",
  name: "",
  description: "",
  note: "",
  status: "DRAFT",
  difficulty: "EASY",
  cuisine_id: null,
  category_id: null,
  prep_time: 0,
  cook_time: 0,
  base_yield: 0,
  base_yield_unit: null,
  total_ingredient_cost: 0,
  labor_cost: 0,
  overhead_cost: 0,
  cost_per_portion: 0,
  selling_price: null,
  suggested_price: null,
  gross_margin: null,
  gross_margin_percentage: null,
  actual_food_cost_percentage: null,
  target_food_cost_percentage: null,
  max_food_cost_percentage: null,
  plating_instructions: "",
  preparation_steps: [],
  ingredients: [],
  recalculate_ingredients: false,
  storage_instructions: "",
  labor_cost_percentage: null,
  overhead_percentage: null,
  allergens: { standard: [], custom: "" },
  tags: "",
  carbon_footprint: null,
  deduct_from_stock: false,
  default_variant_id: null,
  info: "",
  dimension: "",
  is_active: true,
};

export function getDefaultValues(recipe?: Recipe): RecipeFormValues {
  if (!recipe) return { ...EMPTY_FORM };

  return {
    code: recipe.code,
    name: recipe.name,
    description: recipe.description ?? "",
    note: recipe.note ?? "",
    status: recipe.status,
    difficulty: recipe.difficulty,
    cuisine_id: recipe.cuisine_id,
    category_id: recipe.category_id,
    prep_time: recipe.prep_time,
    cook_time: recipe.cook_time,
    base_yield: recipe.base_yield,
    base_yield_unit: recipe.base_yield_unit,
    total_ingredient_cost: recipe.total_ingredient_cost,
    labor_cost: recipe.labor_cost,
    overhead_cost: recipe.overhead_cost,
    cost_per_portion: recipe.cost_per_portion,
    selling_price: recipe.selling_price,
    suggested_price: recipe.suggested_price,
    gross_margin: recipe.gross_margin,
    gross_margin_percentage: recipe.gross_margin_percentage,
    actual_food_cost_percentage: recipe.actual_food_cost_percentage,
    target_food_cost_percentage: recipe.target_food_cost_percentage,
    max_food_cost_percentage: recipe.max_food_cost_percentage ?? null,
    plating_instructions: recipe.plating_instructions ?? "",
    preparation_steps: activeSteps(recipe.preparation_steps).map(stepToDraft),
    ingredients: activeIngredients(recipe.ingredients).map(ingredientToDraft),
    recalculate_ingredients: false,
    storage_instructions: recipe.storage_instructions ?? "",
    labor_cost_percentage: recipe.labor_cost_percentage,
    overhead_percentage: recipe.overhead_percentage,
    allergens: splitAllergens(recipe.allergens),
    tags: arrayToText(recipe.tags),
    carbon_footprint: recipe.carbon_footprint,
    deduct_from_stock: recipe.deduct_from_stock,
    default_variant_id: recipe.default_variant_id,
    info: "",
    dimension: "",
    is_active: recipe.is_active,
  };
}
