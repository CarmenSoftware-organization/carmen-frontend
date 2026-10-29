import type { LastAction } from "./last-action";
import type { DiscountFields, ItemMoneyFields, TaxFields } from "./shared-item";
import type { Audit } from "./audit";
import type { EntityRef } from "./entity-ref";

// --- Workflow ---

export interface WorkflowHistoryEntry {
  status: string;
  timestamp: string;
  user: string;
}

// --- GRN-scoped product/location lookup item ---

export interface GrnProductItem {
  product_id: string;
  product_code: string;
  product_name: string;
  product_sku: string | null;
}

export interface GrnLocationItem {
  location_id: string;
  location_code: string;
  location_name: string;
  location_type: string | null;
}

// --- Detail Item (line item inside a detail group) ---

interface GrnDetailItem extends TaxFields, DiscountFields, ItemMoneyFields {
  id: string;
  good_received_note_detail: EntityRef | null;
  inventory_transaction: EntityRef | null;
  purchase_order_detail_purchase_request_detail: EntityRef | null;
  order_qty: number;
  order_unit: EntityRef | null;
  order_unit_conversion_factor: number;
  order_base_qty: number;
  received_qty: number;
  received_unit: EntityRef | null;
  received_unit_conversion_factor: number;
  received_base_qty: number;
  foc_qty: number;
  foc_unit: EntityRef | null;
  foc_unit_conversion_factor: number;
  foc_base_qty: number;
  base_tax_amount: number;
  base_discount_amount: number;
  base_price: number;
  base_sub_total_price: number;
  base_net_amount: number;
  base_total_price: number;
  note: string | null;
  /** วันหมดอายุของล็อตที่รับเข้า (ISO) — ไม่บังคับ */
  expired_at?: string | null;
  doc_version?: number;
}

// --- Detail Group (product + location) ---

/**
 * เหตุที่บรรทัดของใบ saved เปลี่ยนสิ่งที่ลงสต๊อกไม่ได้แล้ว (หลังบ้าน `good-received-note.stock-lock`)
 *
 * - `stock_consumed` — เอกสารอื่นตัดล็อตของบรรทัดนี้ไปแล้ว (SR, SO, โอน, CN ที่ลงแล้ว)
 * - `credit_note` — มีใบลดหนี้ที่ยังไม่ยกเลิกอ้างบรรทัดนี้ (รวมใบร่าง)
 * - `legacy_posting` — ใบลงสต๊อกแบบเก่าที่การแก้ไขลงใหม่ให้ไม่ได้
 */
export type GrnStockLockReason = "stock_consumed" | "credit_note" | "legacy_posting";

interface GoodsReceiveNoteDetail {
  id: string;
  good_received_note: EntityRef | null;
  sequence_no: number;
  purchase_order: EntityRef | null;
  po_no?: string | null;
  purchase_order_detail: EntityRef | null;
  location: EntityRef | null;
  location_type: string | null;
  product: EntityRef | null;
  product_sku: string | null;
  items: GrnDetailItem[];
  doc_version?: number;
  /**
   * มีค่าเฉพาะใบ saved — ว่าง = แก้ได้ · มีสักเหตุ = จำนวน ราคา ส่วนลด ภาษี หน่วย
   * สินค้า คลัง แก้ไม่ได้และลบบรรทัดไม่ได้ (optional: backend รุ่นก่อนไม่ส่งมา)
   */
  stock_lock_reasons?: GrnStockLockReason[];
}

// --- Extra Cost ---

interface ExtraCostDetailItem {
  id?: string;
  // ยืนยันจาก gen-ref-map.ts เท่านั้น — extra_cost_detail ว่างเปล่าทั้งใน
  // baseline และ live sample จึงไม่มี payload จริงให้ยืนยัน shape นี้ (ดูรายงาน)
  extra_cost_type: EntityRef | null;
  note: string;
  info: Record<string, unknown> | null;
  dimension: Record<string, unknown> | null;
  amount: number;
  tax_profile: EntityRef | null;
  tax_rate: number;
  tax_amount: number;
  is_tax_adjustment: boolean;
  base_tax_amount: number;
  total_amount: number;
  tax_type: string;
}

/**
 * หัวค่าใช้จ่ายเพิ่มเติมของใบ — **object เดียว ไม่ใช่ array** และบรรทัดซ้อนอยู่ข้างใน
 * (ยืนยันจาก live `GET .../good-received-notes/{id}` 2026-10-23: keys = id,
 * allocate_extra_cost_type, extra_cost_detail) · ของเดิมประกาศเป็น array คู่กับ
 * `extra_cost_detail` ระดับบน ซึ่งไม่มีจริง ฟอร์มแก้ไขจึงโหลดค่าใช้จ่ายเดิมไม่ขึ้นเลย
 */
interface GrnExtraCost {
  id: string;
  allocate_extra_cost_type: string | null;
  extra_cost_detail?: ExtraCostDetailItem[];
}

// --- Main GRN ---

type GrnPostType = "ap" | "consignment" | "cash";

export interface GrnApInvoiceRef {
  id: string;
  doc_no: string;
  doc_status: string;
}

export interface GoodsReceiveNote {
  id: string;
  grn_no: string;
  grn_date: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  description: string | null;
  note: string | null;
  doc_status: string;
  doc_type: string;
  post_type: GrnPostType | null;
  signature_image_url: string | null;
  received_by: EntityRef | null;
  credit_term: EntityRef | null;
  credit_term_days: number | null;
  payment_due_date: string | null;
  is_active: boolean;
  // list endpoint: display-only string, ไม่มี vendor_id คู่กัน (ยืนยันจาก live
  // 20/20 แถว — GRN_LIST_REFS ประกาศ vendor:['id','name'] ไว้จริงแต่ collapse
  // ไม่มีวันทำงานเพราะไม่มี vendor_id ให้ trigger เหมือนเคส PO buyer_name)
  vendor_name?: string;
  // detail endpoint เท่านั้น
  vendor?: EntityRef | null;
  currency: EntityRef | null;
  // `vendor/:vendor_id/cn` (lookup GRN ของหน้า Credit Note) เคยส่ง currency แบบแบนแทน object —
  // อ่านผ่าน grnCurrencyId() ที่รับได้ทั้งสองรูป อย่าอ่านตรงจากฟิลด์ใดฟิลด์หนึ่ง
  currency_id?: string | null;
  exchange_rate: number | null;
  exchange_rate_date: string | null;
  total_amount?: number;
  info: Record<string, unknown> | null;
  dimension: unknown[] | Record<string, unknown> | null;
  // Workflow
  workflow: EntityRef | null;
  workflow_history: Record<string, unknown> | WorkflowHistoryEntry[];
  workflow_current_stage: string | null;
  workflow_previous_stage: string | null;
  workflow_next_stage: string | null;
  // Action
  user_action: Record<string, unknown> | null;
  last_action: LastAction | null;
  // Audit
  doc_version?: number;
  // AP Invoice ที่ยังไม่ void ซึ่งดึงใบนี้ไปแล้ว — มีสักใบ = ใบ committed แก้ไม่ได้
  // (optional: backend รุ่นก่อนไม่ส่งมา)
  ap_invoices?: GrnApInvoiceRef[];
  // list/detail response omit raw created/updated fields — gateway enrich เป็น audit object
  audit?: Audit;
  // Detail items (nested: detail → items[])
  good_received_note_detail: GoodsReceiveNoteDetail[];
  // Extra cost — null เมื่อใบไม่มีหัวค่าใช้จ่ายเพิ่มเติม
  extra_cost: GrnExtraCost | null;
  /**
   * true = มีบรรทัดถูกเอกสารอื่นอ้างอิง (ดู `stock_lock_reasons`) ซึ่งล็อกค่าใช้จ่ายเพิ่มเติม
   * สกุลเงิน และอัตราแลกเปลี่ยนทั้งใบด้วย เพราะสามอย่างนี้ตีมูลค่าทุกบรรทัดใหม่
   */
  has_stock_lock?: boolean;
}

// --- Payloads ---

export interface GrnDetailPayload {
  doc_version?: number;
  purchase_order_detail_id?: string | null;
  product_id: string;
  location_id?: string | null;
  foc_qty: number;
  foc_unit_id?: string | null;
  foc_unit_conversion_factor: number;
  approved_qty: number;
  approved_unit_id?: string | null;
  received_qty: number;
  received_unit_id?: string | null;
  received_base_qty: number;
  received_base_unit_id?: string | null;
  received_unit_conversion_factor: number;
  received_price: number;
  tax_profile_id?: string | null;
  tax_rate: number;
  tax_amount: number;
  is_tax_adjustment: boolean;
  discount_rate: number;
  discount_amount: number;
  is_discount_adjustment: boolean;
  net_amount: number;
  total_price: number;
  description?: string;
  note?: string;
  /** null = ล้างวันหมดอายุของบรรทัดนี้ */
  expired_at?: string | null;
}

export interface ExtraCostDetailPayload {
  extra_cost_type_id: string;
  note: string;
  amount: number;
}

export interface CreateGrnDto {
  doc_version?: number;
  note?: string | null;
  grn_date: string | null;
  invoice_no?: string | null;
  invoice_date?: string | null;
  description?: string | null;
  doc_status: string;
  doc_type: string;
  post_type?: GrnPostType;
  received_by_id?: string | null;
  received_by_name?: string | null;
  credit_term_days?: number | null;
  credit_term_id?: string | null;
  payment_due_date?: string | null;
  is_active: boolean;
  vendor_id: string;
  currency_id?: string | null;
  exchange_rate?: number | null;
  exchange_rate_date?: string | null;
  good_received_note_detail: {
    add?: GrnDetailPayload[];
    update?: (GrnDetailPayload & { id: string })[];
    remove?: { id: string }[];
  };
  extra_cost?: {
    allocate_extra_cost_type?: string;
    extra_cost_detail?: {
      add?: ExtraCostDetailPayload[];
      update?: (ExtraCostDetailPayload & { id: string })[];
      remove?: { id: string }[];
    };
  };
}

/**
 * แถวเคลื่อนไหวสต๊อกของใบรับสินค้า (`GET .../good-received-notes/{id}/stock-movements`)
 *
 * **ประกาศเฉพาะฟิลด์ที่ตารางวาดจริง** — ทรงลอกมาจาก `CnStockMovement` ของ
 * endpoint พี่น้องกัน ฟิลด์ที่เกินมาไม่กระทบ ส่วนที่หายจะขึ้นเป็นช่องว่าง
 */
export interface GrnStockMovementItem {
  id: string;
  sequence_no: number;
  location_name: string;
  product_name: string;
  product_local_name?: string | null;
  inventory_unit_name: string;
  lot_no?: string | null;
  /**
   * ลำดับชั้นต้นทุนในล็อต — บรรทัดเดียวแตกได้ถึงสองชั้น (รับ 3 ราคา 100 = 2 × 33.33 + 1 × 33.34)
   * ตารางแสดงทีละชั้นเพื่อให้ จำนวน × ต้นทุนต่อหน่วย = มูลค่า ทุกแถว
   */
  lot_index?: number | null;
  /** จำนวนที่ใบบอกว่ารับ — มีค่าเสมอ ต่างจาก `qty_in` ที่ว่างจนกว่าจะเข้าสต๊อกจริง */
  received_qty?: number;
  /** จำนวนที่สต๊อกขยับจริง — `0` ตราบใดที่ `is_posted` ยังไม่เป็น true */
  qty_in: number;
  cost_per_unit: number;
  total_cost: number;
}

export interface GrnStockMovement {
  good_received_note_id: string;
  /**
   * `false` = ตัวเลขเป็นการคาดการณ์จากตัวใบ ยังไม่ได้เข้าสต๊อกจริง · `undefined` =
   * backend ไม่ได้ส่งมา ซึ่งต่างจาก false — ห้ามเช็คด้วย `!is_posted`
   */
  is_posted?: boolean;
  /** `inventory_transaction` = ของขยับจริง · `document_detail` = อ่านจากตัวใบ */
  source?: string;
  items: GrnStockMovementItem[];
}
