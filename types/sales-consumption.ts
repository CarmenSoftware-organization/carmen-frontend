import type { PosBrand } from "@/types/pos-sale";

/** สถานะของ Sales Consumption */
export type ScStatus = "pending" | "posted" | "voided";

/** ที่มาของค่าที่ใช้จริงบนบรรทัด — `master` = ค่าตั้งต้นของ Outlet/เมนู · `line` = ตั้งเฉพาะบรรทัด */
export type ScLineSource = "master" | "line";

/** สถานะการ resolve ของบรรทัดขาย */
export type ScLineState =
  | "ok"
  | "needs_location"
  | "needs_recipe"
  | "not_counted";

/** id รหัส และชื่อของข้อมูลหลักที่อ้างถึง */
export interface ScRef {
  id: string;
  code: string;
  name: string;
}

/** Stock Out ที่ SC สร้าง */
export interface ScStockOutRef {
  id: string;
  so_no: string | null;
  location_code: string | null;
  /** ถูก void ไปพร้อม SC ที่ถูก void */
  voided: boolean;
}

/** หนึ่งแถวของรายการ */
export interface ScListItem {
  id: string;
  sc_no: string;
  sale_date: string;
  status: ScStatus;
  import_count: number;
  location_codes: string[];
  line_count: number;
  unresolved_count: number;
  /** ผลรวม Stock Out เมื่อ posted ไม่งั้น null */
  total_cost: number | null;
  stock_outs: ScStockOutRef[];
}

/** บรรทัดขาย POS พร้อมค่าที่ใช้จริง */
export interface ScLine {
  id: string;
  outlet: { id: string; code: string; name: string };
  item: { id: string; code: string; desc1: string };
  qty: number;
  total: number;
  location: ScRef | null;
  location_source: ScLineSource;
  recipe: ScRef | null;
  is_ignored: boolean;
  recipe_source: ScLineSource;
  state: ScLineState;
}

/** แถววัตถุดิบในกลุ่ม location */
export interface ScIngredientProduct {
  product_id: string;
  code: string;
  name: string;
  unit: string;
  qty: number;
  unit_cost: number;
  total_cost: number;
}

/** วัตถุดิบที่จะตัด (หรือตัดแล้ว) ที่ location หนึ่ง */
export interface ScIngredientGroup {
  location: ScRef;
  outlets: string[];
  products: ScIngredientProduct[];
  total_cost: number;
  stock_out: { id: string; so_no: string | null; voided: boolean } | null;
}

/** บรรทัดที่แตกสูตรไม่ได้ จึงไม่อยู่ในยอดวัตถุดิบ (เฉพาะ pending) */
export interface ScIngredientProblem {
  line_id: string;
  item_code: string;
  item_desc: string;
  /** no_conversion | zero_yield | too_deep | recipe_unusable | empty_recipe */
  reason: string;
}

/** หนึ่งรายการในประวัติของวัน */
export interface ScHistoryEntry {
  at: string;
  action: "created" | "imported" | "onhand_verified" | "posted" | "voided";
  user_name: string | null;
  text_params: Record<string, string | number | boolean | null>;
}

/** ผลตรวจ on-hand ล่าสุดที่บันทึกไว้กับ SC */
export interface ScVerification {
  verified_at: string;
  ok: boolean | null;
  /** true = บรรทัดเปลี่ยนหลังตรวจ ผลไม่ตรงกับสถานะปัจจุบันแล้ว */
  stale: boolean;
}

/** รายละเอียด Sales Consumption หนึ่งใบ */
export interface ScDetail {
  id: string;
  sc_no: string;
  sale_date: string;
  status: ScStatus;
  doc_version: number;
  imports: {
    id: string;
    brand: PosBrand;
    file_name: string;
    ingest_method: string;
    store_name: string | null;
  }[];
  missing_stores: string[];
  sales_amount: number;
  lines: ScLine[];
  ingredients: ScIngredientGroup[];
  ingredient_problems: ScIngredientProblem[];
  stock_outs: ScStockOutRef[];
  verification: ScVerification | null;
  /** เฉพาะ voided: SC ใบใหม่ของวันนั้นที่เปิดขึ้นตอน void */
  replaced_by: { id: string; sc_no: string } | null;
  /** เฉพาะ posted: บรรทัดขาย (qty > 0) ที่เข้ามาหลัง post จึงยังไม่ถูกตัด */
  late_lines: number;
  history: ScHistoryEntry[];
}

/** สถานะของวันในปฏิทิน */
export type ScCalendarStatus =
  | "posted"
  | "pending"
  | "no_sales"
  | "no_file"
  | "future"
  | "before_start";

/** หนึ่งวันของปฏิทิน */
export interface ScCalendarDay {
  date: string;
  status: ScCalendarStatus;
  sc_id: string | null;
  unresolved_count: number;
  late_lines: number;
  missing_stores: number;
}

/** ผลตรวจ on-hand — `short` คือจำนวนที่ขาด (0 = พอ) */
export interface ScVerifyResult {
  ok: boolean;
  verified_at: string;
  groups: {
    location_id: string;
    products: {
      product_id: string;
      required: number;
      available: number;
      short: number;
    }[];
  }[];
}

/** body ของการแก้บรรทัด — ไม่ส่งฟิลด์ = ไม่เปลี่ยน · `null` = ล้าง */
export interface ScUpdateLinesInput {
  line_ids: string[];
  location_id?: string | null;
  recipe_id?: string | null;
  is_ignored?: boolean | null;
  /** บันทึกสูตร/การไม่นับเป็นค่าตั้งต้นของเมนู POS ด้วย */
  set_item_default?: boolean;
}

/** ผลการ post: Stock Out หนึ่งใบต่อ location */
export interface ScPostResult {
  stock_outs: { id: string; so_no: string; location_code: string }[];
}

/** ผลการ void: SC pending ใบใหม่ของวันนั้น (null = ไม่มีอะไรให้ตัดแล้ว) */
export interface ScVoidResult {
  new_sc_id: string | null;
}

/** ตัวกรองรายการ */
export interface ScListParams {
  page?: number | string;
  perpage?: number | string;
  date_from?: string;
  date_to?: string;
  status?: ScStatus;
}

/** ผลของ `GET pos-sales/status` */
export interface PosStatusResult {
  enabled_brands: PosBrand[];
}
