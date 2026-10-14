import type { EntityRef } from "./entity-ref";

export const NODE_TYPE = {
  CATEGORY: "category",
  SUBCATEGORY: "subcategory",
  ITEM_GROUP: "itemGroup",
} as const;

type NodeType = (typeof NODE_TYPE)[keyof typeof NODE_TYPE];

export type CategoryType = "category" | "subcategory" | "itemgroup";

/**
 * แถว mapping บัญชีของ node นี้เอง (ไม่รวมที่สืบทอดจากชั้นบน)
 * backend ส่งมาเฉพาะ GET รายตัว (findOne) — GET list ไม่มีฟิลด์นี้
 */
export interface AccountCodeEntry {
  id: string;
  account_type: string;
  account_code: string;
  account_name: string | null;
}

/** payload เขียน account_codes — create รับแค่ add, update รับ add/update/remove */
export interface AccountCodesPayload {
  add?: {
    account_type: "inventory" | "direct";
    account_code: string;
    account_name?: string | null;
  }[];
  update?: { id: string; account_code: string; account_name?: string | null }[];
  remove?: { id: string }[];
}

export interface CategoryNode {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: NodeType;
  children?: CategoryNode[];
  is_active: boolean;
  price_deviation_limit?: number;
  qty_deviation_limit?: number;
  is_used_in_recipe?: boolean;
  is_sold_directly?: boolean;
  tax_profile_id?: string;
  tax_profile_name?: string;
  tax_rate?: number;
  product_category_id?: string;
  product_subcategory_id?: string;
  itemCount?: number;
  cascade_deviation: boolean;
  doc_version?: number;
  account_codes?: AccountCodeEntry[];
}

export interface CategoryDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  price_deviation_limit?: number;
  qty_deviation_limit?: number;
  is_used_in_recipe?: boolean;
  is_sold_directly?: boolean;
  tax_profile_id?: string;
  tax_profile_name?: string;
  tax_rate?: number;
  doc_version?: number;
  account_codes?: AccountCodeEntry[];
}

export interface SubCategoryDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  // ยืนยันจาก live list+detail `/product-sub-categories`: product_category
  // เป็น object {id} เท่านั้น (ไม่มี name) — คนละฟิลด์กับ `category` object
  // {id,code,name} ที่มีอยู่แล้วบน wire แต่ไม่มี call site ไหนอ่าน ไม่ประกาศ
  product_category: EntityRef | null;
  price_deviation_limit?: number;
  qty_deviation_limit?: number;
  is_used_in_recipe?: boolean;
  is_sold_directly?: boolean;
  // ยืนยันจาก live: tax_profile เป็น object {id,name} (null ในตัวอย่างที่ตรวจ)
  // ของเดิม tax_profile_id/tax_profile_name เป็น phantom ไม่เคยมีจริงบน wire
  tax_profile?: EntityRef | null;
  tax_rate?: number;
  cascade_deviation: boolean;
  doc_version?: number;
  account_codes?: AccountCodeEntry[];
}

export interface ItemGroupDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  product_subcategory_id: string;
  price_deviation_limit?: number;
  qty_deviation_limit?: number;
  is_used_in_recipe?: boolean;
  is_sold_directly?: boolean;
  tax_profile_id?: string;
  tax_profile_name?: string;
  tax_rate?: number;
  cascade_deviation: boolean;
  sub_category?: { id: string; code: string; name: string };
  category?: { id: string; code: string; name: string };
  doc_version?: number;
  account_codes?: AccountCodeEntry[];
}

export interface CreateCategoryDto {
  code?: string;
  name: string;
  description?: string;
  is_active: boolean;
  price_deviation_limit?: number;
  qty_deviation_limit?: number;
  is_used_in_recipe?: boolean;
  is_sold_directly?: boolean;
  tax_profile_id?: string;
  tax_profile_name?: string;
  tax_rate?: number;
  doc_version?: number;
  account_codes?: AccountCodesPayload;
}

export interface CreateSubCategoryDto {
  code?: string;
  name: string;
  description?: string;
  is_active: boolean;
  product_category_id: string;
  price_deviation_limit?: number;
  qty_deviation_limit?: number;
  is_used_in_recipe?: boolean;
  is_sold_directly?: boolean;
  tax_profile_id?: string;
  tax_profile_name?: string;
  tax_rate?: number;
  doc_version?: number;
  account_codes?: AccountCodesPayload;
}

export interface CreateItemGroupDto {
  code?: string;
  name: string;
  description?: string;
  is_active: boolean;
  product_subcategory_id: string;
  price_deviation_limit?: number;
  qty_deviation_limit?: number;
  is_used_in_recipe?: boolean;
  is_sold_directly?: boolean;
  tax_profile_id?: string;
  tax_profile_name?: string;
  tax_rate?: number;
  doc_version?: number;
  account_codes?: AccountCodesPayload;
}
