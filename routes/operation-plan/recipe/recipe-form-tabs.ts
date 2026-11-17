import type { FieldErrors } from "react-hook-form";
import type { RecipeFormValues } from "./recipe-form-schema";

/** แท็บของฟอร์มสูตร เรียงตามที่แสดง — hero (ชื่อ รูป ตัวเลขสรุป) อยู่เหนือแท็บ ไม่นับเป็นแท็บ */
export const RECIPE_TABS = ["details", "ingredients", "cost", "steps"] as const;
export type RecipeTab = (typeof RECIPE_TABS)[number];

/**
 * ช่องของฟอร์มอยู่แท็บไหน — `null` = ไม่อยู่ในแท็บใด (อยู่ใน hero / toolbar หรือไม่มีช่องบนจอ)
 *
 * เป็น `Record` ครบทุก key ของฟอร์มโดยตั้งใจ: เพิ่ม field ใหม่แล้วไม่บอกว่าอยู่แท็บไหน = typecheck แดง
 * (ไม่งั้น error ของช่องนั้นจะไม่พาไปแท็บของมัน ผู้ใช้กด Save แล้วไม่เห็นว่าติดอะไร)
 */
const FIELD_TAB: Record<keyof RecipeFormValues, RecipeTab | null> = {
  // hero / toolbar
  name: null,
  difficulty: null,
  is_active: null,
  deduct_from_stock: null,
  status: null,
  // ไม่มีช่องบนจอ
  default_variant_id: null,
  info: null,
  cost_per_portion: null,
  suggested_price: null,
  gross_margin: null,
  gross_margin_percentage: null,
  actual_food_cost_percentage: null,
  // รายละเอียด
  code: "details",
  description: "details",
  note: "details",
  video_url: "details",
  cuisine_id: "details",
  category_id: "details",
  prep_time: "details",
  cook_time: "details",
  base_yield: "details",
  base_yield_unit: "details",
  allergens: "details",
  tags: "details",
  plating_instructions: "details",
  storage_instructions: "details",
  // วัตถุดิบ
  ingredients: "ingredients",
  recalculate_ingredients: "ingredients",
  // ขั้นตอน
  preparation_steps: "steps",
  // ต้นทุน
  total_ingredient_cost: "cost",
  labor_cost: "cost",
  overhead_cost: "cost",
  selling_price: "cost",
  target_food_cost_percentage: "cost",
  max_food_cost_percentage: "cost",
  labor_cost_percentage: "cost",
  overhead_percentage: "cost",
  carbon_footprint: "cost",
};

/** แท็บของ field (ชื่อระดับบนสุด หรือ path เช่น `ingredients.0.qty`) */
export function tabOfField(path: string): RecipeTab | null {
  const top = path.split(".")[0] as keyof RecipeFormValues;
  return FIELD_TAB[top] ?? null;
}

/** แท็บที่มีช่อง error อยู่ */
export function tabsWithErrors(
  errors: FieldErrors<RecipeFormValues>,
): ReadonlySet<RecipeTab> {
  const tabs = new Set<RecipeTab>();
  for (const key of Object.keys(errors)) {
    const tab = tabOfField(key);
    if (tab) tabs.add(tab);
  }
  return tabs;
}

/**
 * แท็บที่ต้องเปิดเมื่อ Save ไม่ผ่าน — แท็บแรก (ตามลำดับที่แสดง) ที่มี error
 *
 * คืน `null` = ไม่ต้องสลับ: ไม่มี error ในแท็บใด หรือมี error ของช่องใน hero (เช่นชื่อสูตร) ซึ่งอยู่
 * เหนือแท็บและเป็นช่องแรกที่หน้าจะเลื่อนไปหา — สลับแท็บตอนนั้นมีแต่ทำให้เนื้อหาข้างล่างเปลี่ยนโดยไม่จำเป็น
 */
export function tabToOpenForErrors(
  errors: FieldErrors<RecipeFormValues>,
): RecipeTab | null {
  const keys = Object.keys(errors);
  if (keys.some((k) => tabOfField(k) === null)) return null;
  const tabs = tabsWithErrors(errors);
  return RECIPE_TABS.find((tab) => tabs.has(tab)) ?? null;
}
