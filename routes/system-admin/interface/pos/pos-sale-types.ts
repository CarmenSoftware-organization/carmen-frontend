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

/** สถานะของรอบดึงไฟล์ Simphony ผ่าน SFTP */
export type PosSftpPullStatus =
  | "running"
  | "completed"
  | "connect_failed"
  | "host_key_mismatch"
  | "failed"
  | "abandoned";

/** รอบดึงไฟล์ Simphony ผ่าน SFTP ล่าสุดของ BU (`SftpPullRunView` ฝั่ง backend) */
export interface PosSftpPullRun {
  id: string;
  /** วันของ BU ที่รอบนี้นับ YYYY-MM-DD */
  run_date: string;
  status: PosSftpPullStatus;
  started_at: string;
  finished_at: string | null;
  attempt_count: number;
  /** key ที่เชื่อถือ: ของรอบที่ผ่าน auth หรือ pin ที่ถูกเทียบในรอบ `host_key_mismatch` */
  host_key_sha256: string | null;
  /** key ที่เซิร์ฟเวอร์ยื่นมาในรอบ `host_key_mismatch` (แสดงเท่านั้น) นอกนั้น null */
  presented_host_key_sha256: string | null;
  files_found: number;
  files_imported: number;
  files_rejected: number;
  files_failed: number;
  files_skipped: number;
  error_message: string | null;
}

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
  /** รหัสชุดนำเข้าของไฟล์เดียวกัน (Micros 3700: หนึ่งไฟล์ = หลาย Outlet) — null = ไม่ได้มาจากชุด */
  batch_id: string | null;
  /** Outlet ของการนำเข้านี้ (Micros 3700: หนึ่งการนำเข้าต่อ Outlet) */
  outlet_id: string | null;
  /** id ของการนำเข้าใหม่ที่เขียนทับรายการนี้ — null = ยังไม่ถูกเขียนทับ */
  replaced_by_id: string | null;
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
  /** รหัสชุดนำเข้าของไฟล์เดียวกัน (Micros 3700: หนึ่งไฟล์ = หลาย Outlet) — null = ไม่ได้มาจากชุด */
  batch_id: string | null;
  /** Outlet ของการนำเข้านี้ (Micros 3700: หนึ่งการนำเข้าต่อ Outlet) */
  outlet_id: string | null;
  /** id ของการนำเข้าใหม่ที่เขียนทับรายการนี้ — null = ยังไม่ถูกเขียนทับ */
  replaced_by_id: string | null;
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

/** ยอดรวมที่คำนวณเทียบกับที่รายงานพิมพ์ไว้ — ต่างเกิน 0.05 = ไฟล์ถูกปฏิเสธ */
export interface PosMicros3700Footing {
  computed_total: number;
  reported_total: number;
  outlets: {
    code: string;
    computed_total: number;
    computed_qty: number;
    reported_total: number | null;
    reported_qty: number | null;
  }[];
}

/** การนำเข้า live เดิมของ Outlet/วันเดียวกัน (ถ้านำเข้าอีกต้องเลือกข้ามหรือเขียนทับ) */
export interface PosMicros3700Existing {
  import_id: string;
  line_count: number;
  total: number;
  confirmed_line_count: number;
  /** Stock Out ที่เกิดจากการยืนยัน — เขียนทับแล้วจะถูกยกเลิก */
  stock_out_ids: string[];
  created_at: string | null;
}

/**
 * Outlet ที่เลือกเขียนทับ พร้อมชุด live และ Stock Out ที่ผู้ใช้เห็นตอนตรวจ — ถ้าชุดเปลี่ยนไปแล้ว
 * backend ไม่เขียนอะไรและตอบ `needs_resolution`
 */
export interface PosMicros3700Overwrite {
  code: string;
  import_id: string;
  stock_out_ids: string[];
}

/** Outlet หนึ่งในไฟล์ที่ตรวจแล้ว */
export interface PosMicros3700OutletCheck {
  code: string;
  name: string;
  line_count: number;
  qty: number;
  total: number;
  /** ยอด Total ของ Outlet ที่รายงานพิมพ์ไว้ — null = รายงานไม่มี */
  reported_total: number | null;
  /** null = ยังไม่เคยนำเข้า (ใหม่) */
  existing: PosMicros3700Existing | null;
}

/** ผลตรวจไฟล์ — `rejected` = ไฟล์ถูกบันทึกเป็นประวัติที่ไม่สำเร็จแล้ว */
export type PosMicros3700CheckResult =
  | { kind: "rejected"; import: PosImportSummary }
  | {
      kind: "ready";
      doc_date: string;
      store_name: string;
      detected_version: string | null;
      footing: PosMicros3700Footing;
      outlets: PosMicros3700OutletCheck[];
    };

/** สิ่งที่เกิดกับ Outlet หนึ่งตอนนำเข้า */
export type PosMicros3700OutletAction =
  | "imported"
  | "overwritten"
  | "skipped"
  | "failed";

/** ผลของ Outlet หนึ่งตอนนำเข้า — Outlet ที่ล้มไม่กระทบ Outlet อื่น */
export interface PosMicros3700OutletResult {
  code: string;
  name: string;
  action: PosMicros3700OutletAction;
  import_id: string | null;
  /** Stock Out ที่ถูกยกเลิกไปแล้วระหว่างเขียนทับ (มีค่าได้แม้ `failed`) */
  voided_stock_out_ids: string[];
  error: {
    app_code: string | null;
    message: string;
    params: Record<string, string | number>;
  } | null;
}

/** ผลนำเข้า — `needs_resolution` = ไม่ได้เขียนอะไร ต้องเลือกข้าม/เขียนทับใหม่ */
export type PosMicros3700ImportResult =
  | { kind: "rejected"; import: PosImportSummary }
  | { kind: "needs_resolution"; outlets: PosMicros3700OutletCheck[] }
  | {
      kind: "imported";
      batch_id: string;
      doc_date: string;
      outlets: PosMicros3700OutletResult[];
    };
