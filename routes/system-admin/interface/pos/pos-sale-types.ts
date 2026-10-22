/** แบรนด์ POS ที่รองรับ */
export type PosBrand = "simphony" | "micros3700";

/** สถานะผลของการนำเข้า — อย่างอื่นนอกจาก `success` = ไม่มีอะไรถูกนำเข้า */
export type PosImportStatus =
  | "success"
  | "rejected_duplicate"
  | "missing_glid_header"
  | "multi_day_glid_reject"
  | "rejected_multi_day"
  | "format_error";

/** อ้างอิงแบบ id + รหัส + ชื่อ (Location หรือสูตรอาหาร) */
export interface PosCodeName {
  id: string;
  code: string;
  name: string;
}

/** ผลของการนำเข้าหนึ่งครั้ง (ไฟล์ที่ถูกปฏิเสธก็เป็นผลที่ถูกบันทึก ไม่ใช่ error) */
export interface PosImportSummary {
  id: string;
  status: PosImportStatus;
  warnings: string[];
  error_message: string | null;
  /** วันที่ขาย YYYY-MM-DD */
  doc_date: string | null;
  source: string | null;
  total_records: number;
  total_sales_amount: number;
}

/** หนึ่งแถวของประวัติการนำเข้า */
export interface PosImportListItem extends PosImportSummary {
  brand: PosBrand;
  file_name: string;
  ingest_method: string;
  store_name: string | null;
  cancelled_at: string | null;
  created_at: string | null;
  line_count: number;
  confirmed_line_count: number;
}

/** ร้าน POS ตามหัวไฟล์ */
export interface PosImportStore {
  id: string;
  store_key: string;
  store_name: string;
}

/** ยอดขายของ Outlet หนึ่งในการนำเข้า */
export interface PosImportOutlet {
  id: string;
  code: string;
  name: string;
  /** null = ยังไม่ได้ผูก Location */
  location: PosCodeName | null;
  line_count: number;
  confirmed_line_count: number;
  total: number;
  stock_out_ids: string[];
}

/** เมนู POS ที่บรรทัดขายอ้างถึง */
export interface PosLineItem {
  id: string;
  code: string;
  desc1: string;
  desc2: string | null;
  /** null = ยังไม่ได้ผูกสูตร */
  recipe: PosCodeName | null;
}

/** บรรทัดยอดขายที่หักกลบแล้ว (Outlet + Item) */
export interface PosImportLine {
  id: string;
  outlet_id: string;
  item: PosLineItem;
  qty: number;
  unit_price: number;
  total: number;
  /** null = ยังไม่ยืนยัน */
  stock_out_id: string | null;
}

/** รายละเอียดเต็มของการนำเข้า */
export interface PosImportDetail extends PosImportSummary {
  brand: PosBrand;
  file_name: string;
  ingest_method: string;
  store: PosImportStore | null;
  cancelled_at: string | null;
  created_at: string | null;
  outlets: PosImportOutlet[];
  lines: PosImportLine[];
}

/** ร้าน POS พร้อมจำนวนการผูก */
export interface PosStore extends PosImportStore {
  brand: PosBrand;
  outlet_count: number;
  item_count: number;
  unmapped_item_count: number;
}

/** Outlet พร้อม Location ที่ใช้ตัดสต็อก */
export interface PosOutlet {
  id: string;
  store_id: string;
  code: string;
  name: string;
  location: PosCodeName | null;
}

/** เมนู POS พร้อมสูตรที่ใช้ตัดสต็อก */
export interface PosItem {
  id: string;
  store_id: string;
  code: string;
  desc1: string;
  desc2: string | null;
  department_code: string | null;
  recipe: (PosCodeName & { is_active: boolean | null }) | null;
}

/** เหตุที่ Outlet ยังยืนยันตัดสต็อกไม่ได้ (คำนวณ ไม่ได้เก็บ) */
export type PosBlockReason =
  | "location_not_mapped"
  | "nothing_to_confirm"
  | "insufficient_stock"
  | "unresolved_ingredients"
  | "period_closed"
  | "import_cancelled"
  | "adjustment_type_missing";

/** บรรทัดที่ยังไม่ตัดซึ่งเมนูไม่มีสูตรที่ใช้ได้ (การยืนยันจะข้าม) */
export interface PosUnmappedItem {
  item_id: string;
  code: string;
  desc1: string;
  qty: number;
}

/** ปัญหาของสูตรที่ทำให้เมนูแตกเป็นวัตถุดิบไม่ได้ */
export interface PosUnresolved {
  item_code: string;
  recipe_code: string;
  ingredient_name: string;
  reason:
    | "no_conversion"
    | "zero_yield"
    | "too_deep"
    | "recipe_unusable"
    | "empty_recipe";
}

/** เมนูที่ขายซึ่งใช้วัตถุดิบนี้ */
export interface PosIngredientSource {
  item_code: string;
  item_desc: string;
  sale_qty: number;
}

/** วัตถุดิบหนึ่งตัวที่จะตัดพร้อมยอดคงเหลือ ณ วันที่ขาย */
export interface PosIngredientPreview {
  product_id: string;
  product_code: string;
  product_name: string;
  inventory_unit: { id: string; name: string };
  /** จำนวนที่จะตัด (หน่วยคงคลัง) */
  qty: number;
  available: number;
  is_short: boolean;
  sources: PosIngredientSource[];
}

/** ตัวอย่างของ Outlet หนึ่งในการนำเข้า */
export interface PosOutletPreview {
  outlet_id: string;
  code: string;
  name: string;
  location: PosCodeName | null;
  pending_line_count: number;
  unmapped_items: PosUnmappedItem[];
  unresolved: PosUnresolved[];
  ingredients: PosIngredientPreview[];
  can_confirm: boolean;
  block_reasons: PosBlockReason[];
}

/** ตัวอย่างของการนำเข้าทั้งรายการ หนึ่งรายการต่อ Outlet */
export interface PosPreview {
  import_id: string;
  doc_date: string | null;
  is_in_open_period: boolean;
  outlets: PosOutletPreview[];
}

/** ใบตัดสต็อกที่เกิดจากการยืนยัน Outlet หนึ่ง */
export interface PosConfirmResult {
  stock_out_id: string;
  so_no: string;
  line_count: number;
}

/** สินค้าที่คงเหลือไม่พอ — อยู่ใน `ApiError.details.shortages` ของ POS_SALE_INSUFFICIENT_STOCK */
export interface PosShortage {
  product_code: string;
  product_name: string;
  requested: number;
  available: number;
}
