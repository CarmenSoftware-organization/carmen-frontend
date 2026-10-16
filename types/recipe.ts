export interface RecipeImage {
  id: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  url: string;
}

/** รูปหลักที่ endpoint รายการแนบมาให้ต่อแถว (url เป็น presigned — หมดอายุได้) */
export interface RecipePrimaryImage {
  id: string;
  alt_text: string | null;
  url: string | null;
}

export type RecipeGalleryManifestItem =
  | {
      id: string;
      is_primary?: boolean;
      alt_text?: string | null;
      caption?: string | null;
    }
  | { file_index: number; is_primary?: boolean; alt_text?: string | null };

/** อุปกรณ์ที่ผูกกับขั้นตอน — เก็บชื่อไว้ด้วยเพื่อให้แสดงได้แม้อุปกรณ์ถูกลบจาก master */
export interface RecipeEquipmentRef {
  id: string | null;
  name: string;
}

/** แถวของ tb_recipe_preparation_step ตามที่ recipe detail คืนมา */
export interface RecipePreparationStep {
  id: string;
  doc_version: number;
  sequence_no: number;
  title: string | null;
  description: string;
  duration: number | null;
  /** Decimal — backend คืนเป็น string */
  temperature: string | number | null;
  temperature_unit: "c" | "f" | null;
  /** JSON อิสระ — ของใหม่เป็น RecipeEquipmentRef[] ของเก่าอาจเป็น string[] */
  equipment: unknown;
  chef_notes: string | null;
  safety_warnings: string | null;
  /** recipe detail ฝั่ง backend เคยคืนขั้นที่ลบแล้วปนมา — กรองทิ้งด้วย activeSteps() */
  deleted_at?: string | null;
}

/** แหล่งที่มาของต้นทุนต่อหน่วย — server เลือกตามลำดับ fallback (snapshot = คงราคาที่บันทึกไว้) */
export type IngredientCostSource =
  | "average"
  | "last_average"
  | "standard"
  | "none"
  | "snapshot";

/**
 * บรรทัดวัตถุดิบพร้อมต้นทุนที่ server คำนวณ — รูปเดียวกันทั้ง recipe detail,
 * ผลของ preview และผลของ PUT (preview ไม่มี `id`)
 *
 * ตัวเลขทุกตัวเป็น Decimal ฝั่ง DB — อ่านผ่าน `Number()` เสมอ เผื่อ serializer คืนเป็น string
 */
export interface IngredientCostLine {
  id?: string;
  sequence_no: number;
  product_id: string;
  product: { id: string; code: string; name: string } | null;
  qty: number;
  ingredient_unit_id: string;
  ingredient_unit: { id: string; name: string } | null;
  inventory_qty: number;
  inventory_unit_id: string;
  /** หน่วย inventory ต่อ 1 หน่วยสูตร */
  conversion_factor: number;
  /** ต่อหน่วย inventory */
  cost_per_unit: number;
  wastage_percentage: number;
  net_cost: number;
  wastage_cost: number;
  line_cost: number;
  cost_source?: IngredientCostSource;
  note: string | null;
}

/** แถวของ tb_recipe_ingredient ตามที่ recipe detail คืนมา */
export interface RecipeIngredientLine extends IngredientCostLine {
  id: string;
  /** กันไว้แบบเดียวกับขั้นตอน — detail อาจคืนแถวที่ลบแล้วปนมา */
  deleted_at?: string | null;
}

/** หนึ่งบรรทัดใน body ของ preview / PUT — ไม่มีตัวเลขต้นทุน (server คำนวณเอง) */
export interface IngredientInput {
  product_id: string;
  qty: number;
  ingredient_unit_id: string;
  wastage_percentage?: number;
  note?: string | null;
}

export interface IngredientCostResult {
  items: IngredientCostLine[];
  total_ingredient_cost: number;
}

interface RecipeCategoryRef {
  id: string;
  name: string;
  code: string;
}

interface RecipeCuisineRef {
  id: string;
  name: string;
  region: string;
}

interface RecipeAuditEntry {
  at: string;
  id: string;
  name: string;
}

interface RecipeAudit {
  created: RecipeAuditEntry;
  updated: RecipeAuditEntry;
}

export interface Recipe {
  id: string;
  doc_version: number;
  code: string;
  name: string;
  description: string | null;
  note: string | null;
  is_active: boolean;
  category_id: string;
  cuisine_id: string;
  difficulty: string;
  base_yield: number;
  base_yield_unit: string;
  default_variant_id: string | null;
  prep_time: number;
  cook_time: number;
  total_ingredient_cost: number;
  labor_cost: number;
  overhead_cost: number;
  cost_per_portion: number;
  suggested_price: number | null;
  selling_price: number | null;
  target_food_cost_percentage: number | null;
  max_food_cost_percentage: number | null;
  plating_instructions: string | null;
  storage_instructions: string | null;
  actual_food_cost_percentage: number | null;
  gross_margin: number | null;
  gross_margin_percentage: number | null;
  labor_cost_percentage: number | null;
  overhead_percentage: number | null;
  carbon_footprint: number | null;
  deduct_from_stock: boolean;
  status: string;
  tags: string[];
  allergens: string[];
  published_at: string | null;
  archived_at: string | null;
  category: RecipeCategoryRef;
  cuisine: RecipeCuisineRef;
  ingredients: RecipeIngredientLine[];
  preparation_steps: RecipePreparationStep[];
  // Element shape returned empty by the API — left untyped until real data is available
  yield_variants: unknown[];
  images: RecipeImage[];
  /** มีเฉพาะใน response ของ list (detail ส่ง `images` ทั้งชุดแทน) */
  primary_image?: RecipePrimaryImage | null;
  audit: RecipeAudit;
}

export interface CreateRecipeDto {
  doc_version?: number;
  code: string;
  name: string;
  description: string | null;
  note: string | null;
  status: string;
  difficulty: string;
  cuisine_id: string;
  category_id: string;
  prep_time: number;
  cook_time: number;
  base_yield: number;
  base_yield_unit: string;
  total_ingredient_cost: number;
  labor_cost: number;
  overhead_cost: number;
  cost_per_portion: number;
  selling_price: number | null;
  suggested_price: number | null;
  gross_margin: number | null;
  gross_margin_percentage: number | null;
  actual_food_cost_percentage: number | null;
  target_food_cost_percentage: number | null;
  max_food_cost_percentage: number | null;
  plating_instructions: string | null;
  storage_instructions: string | null;
  labor_cost_percentage: number | null;
  overhead_percentage: number | null;
  allergens: string[];
  tags: string[];
  carbon_footprint: number | null;
  deduct_from_stock: boolean;
  default_variant_id: string | null;
  info: Record<string, unknown> | null;
  dimension: Record<string, unknown> | null;
  is_active: boolean;
}

export interface CreateRecipeVars extends CreateRecipeDto {
  images?: File[];
  gallery?: RecipeGalleryManifestItem[];
}

export interface UpdateRecipeVars extends CreateRecipeDto {
  id: string;
  images?: File[];
  gallery?: RecipeGalleryManifestItem[];
}
