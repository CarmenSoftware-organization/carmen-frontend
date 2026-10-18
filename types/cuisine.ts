import type { Audit } from "./audit";

export interface Cuisine {
  id: string;
  doc_version: number;
  name: string;
  description: string | null;
  note: string | null;
  region: string;
  popular_dishes: string[] | null;
  key_ingredients: string[] | null;
  info: Record<string, unknown> | null;
  dimension: string[] | null;
  is_active: boolean;
  /** จำนวนสูตรที่ยังไม่ถูกลบซึ่งใช้ cuisine นี้ — มีเฉพาะ response ของ list (backend ที่ยังไม่ส่ง = undefined) */
  recipe_count?: number;
  // list/detail response omit raw created/updated fields — gateway enrich เป็น audit object
  audit?: Audit;
}

export interface CreateCuisineDto {
  doc_version?: number;
  name: string;
  description: string | null;
  note: string | null;
  region: string;
  popular_dishes: string[] | null;
  key_ingredients: string[] | null;
  info: Record<string, unknown> | null;
  dimension: string[] | null;
  is_active: boolean;
}
