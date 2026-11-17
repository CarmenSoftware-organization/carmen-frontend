import type { Audit } from "./audit";
import type { EntityRef } from "./entity-ref";

export interface RecipeCategory {
  id: string;
  doc_version: number;
  code: string;
  name: string;
  description: string | null;
  note: string | null;
  is_active: boolean;
  // ยืนยันจาก live list+detail: parent เป็น object {id,name} เหมือนกันทุกที่
  // (ของเดิม parent_id ไม่มีจริงบน wire อีกแล้ว — ใช้จริงที่
  // use-recipe-category-table.tsx คอลัมน์ parent)
  parent: EntityRef | null;
  level: number;
  default_cost_settings: Record<string, unknown> | null;
  default_margins: Record<string, unknown> | null;
  info: Record<string, unknown> | null;
  // list/detail response omit raw created/updated fields — gateway enrich เป็น audit object
  audit?: Audit;
}

export interface CreateRecipeCategoryDto {
  doc_version?: number;
  code: string;
  name: string;
  description: string | null;
  note: string | null;
  is_active: boolean;
  parent_id: string | null;
  level: number;
  default_cost_settings: Record<string, unknown> | null;
  default_margins: Record<string, unknown> | null;
  info: Record<string, unknown> | null;
}
