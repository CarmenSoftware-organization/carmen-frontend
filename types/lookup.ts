import type { INVENTORY_TYPE } from "@/constant/location";

/**
 * แถวของ `GET /api/:bu_code/lookup/:resource` — ทุก resource คืน shape เดียวกัน
 * ฟิลด์ที่ตารางไม่มีเป็น `null` (เช่น `unit.code`) · `status` เป็น "active" /
 * "inactive" / "deleted" หรือค่า enum ของตารางนั้น
 */
export interface LookupItem {
  id: string;
  code: string | null;
  name: string | null;
  description: string | null;
  status: string;
}

/**
 * resource ที่ FE ใช้จริง — ชื่อต้องตรงกับ `LOOKUP_CATALOG` ของ backend
 * (`apps/backend-gateway/src/application/lookup/lookup-catalog.ts`)
 * เพิ่มเมื่อย้าย lookup ตัวใหม่ ไม่ดึง catalog ตอน runtime
 */
export type LookupResource =
  | "unit"
  | "recipe_cuisine"
  | "recipe_equipment"
  | "recipe_equipment_category"
  | "extra_cost_type"
  | "location_shelf"
  | "credit_note_reason"
  | "delivery_point"
  | "department"
  | "pricelist_template"
  | "vendor"
  | "product_category"
  | "product"
  | "tax_profile"
  | "currency"
  | "credit_term"
  | "recipe_category"
  | "recipe"
  | "product_sub_category"
  | "location"
  | "notification_template";

/** `mine` = ค่าเริ่มต้นของ backend · master ที่ผูก user (department/location) `mine` คืนเฉพาะที่ assign ให้ user */
export type LookupScope = "mine" | "all";

/** ป้ายสำรองของแถว lookup — `name` ก่อน ไม่มีค่อยใช้ `code` */
export const lookupLabel = (item: LookupItem): string =>
  item.name ?? item.code ?? "";

/** ป้าย "รหัส — ชื่อ" ข้ามส่วนที่เป็น null */
export const lookupCodeName = (item: LookupItem): string =>
  [item.code, item.name].filter(Boolean).join(" — ");

// ฟิลด์เพิ่มของ backend วางแบนข้าง 5 ฟิลด์หลัก (registry `extra` ของ micro-business)
export type TaxProfileLookup = LookupItem & { tax_rate: number | null };
export type CurrencyLookup = LookupItem & {
  exchange_rate: number | null;
  decimal_places: number | null;
};
export type CreditTermLookup = LookupItem & { value: number | null };
export type RecipeCategoryLookup = LookupItem & { level: number | null };
export type RecipeLookup = LookupItem & {
  base_yield_unit: string;
  recipe_status: string;
};
export type LocationLookup = LookupItem & {
  location_type: INVENTORY_TYPE;
  delivery_point: { id: string | null; name: string | null } | null;
};

/**
 * ฟิลด์เพิ่มที่ต้องมีในแถว — `useLookupResource` ตรวจกับแถวแรก ขาดเมื่อไหร่ throw
 * (backend เก่ากว่า FE) แทนการปล่อย `undefined` ให้ฟอร์มคำนวณภาษี/อัตราแลกเปลี่ยนผิดเงียบ ๆ
 */
export const LOOKUP_EXTRA_FIELDS: Partial<
  Record<LookupResource, readonly string[]>
> = {
  tax_profile: ["tax_rate"],
  currency: ["exchange_rate", "decimal_places"],
  credit_term: ["value"],
  recipe_category: ["level"],
  recipe: ["base_yield_unit", "recipe_status"],
  location: ["location_type", "delivery_point"],
};

/**
 * filter ฝั่ง server — ชื่อต้องอยู่ใน `filters` ของ catalog backend · ค่า undefined/ว่างถูกข้าม
 * ส่งเป็น `k:v1,v2;k2:v` (ห้ามมี `|string` — gateway จะตอบ 400)
 */
export type LookupServerFilter = Record<
  string,
  string | readonly string[] | undefined
>;
