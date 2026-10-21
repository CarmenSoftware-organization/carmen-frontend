import type { ItemMoneyFields } from "./shared-item";
import type { WorkflowHistoryEntry } from "./purchase-request";
import type { Audit } from "./audit";
import type { LastAction } from "./last-action";
import type { EntityRef } from "./entity-ref";
import type { StageActionFlags } from "@/lib/workflow-stage-actions";

export enum PO_STATUS {
  DRAFT = "draft",
  IN_PROGRESS = "in_progress",
  APPROVED = "approved",
  SENT_OR_PRINT = "sent_or_print",
  PARTIAL = "partial",
  CLOSED = "closed",
  COMPLETED = "completed",
}

export enum PO_TYPE {
  MANUAL = "manual",
  PL = "pricelist",
  PR = "purchase_request",
}

interface PurchaseOrderDetail extends ItemMoneyFields {
  id: string;
  doc_version?: number;
  stage_status: string | null;
  current_stage_status: string;
  description: string;
  product: EntityRef | null;
  product_sku: string;
  order_unit: EntityRef | null;
  order_unit_conversion_factor: number;
  order_qty: number;
  base_unit: EntityRef | null;
  base_qty: number;
  price: number;
  tax_profile: EntityRef | null;
  tax_rate: number;
  tax_amount: number;
  is_foc: boolean;
  discount_rate: number;
  discount_amount: number;
  is_tax_adjustment?: boolean;
  is_discount_adjustment?: boolean;
  sequence_no?: number;
  /**
   * แถวหนึ่ง = คลังเดียว ตั้งแต่ backend เลิก group location (2026-09-09)
   * ของเดิมเป็น `locations: PoDetailLocation[]` ซ้อนอยู่ในแถว แล้ว `order_qty`
   * ระดับแถวคือผลรวมของทุก location — ตอนนี้ค่าพวกนี้อยู่บนแถวตรง ๆ
   */
  location: EntityRef | null;
  delivery_point: EntityRef | null;
  /**
   * ฟิลด์ที่ frontend ส่งขึ้นแล้วแต่ response ยังไม่ส่งกลับมา — ประกาศเป็น optional
   * ตามความจริง ไม่ใช่ตามที่อยากให้เป็น (`getDefaultValues` เติมค่าว่างให้อยู่แล้ว)
   */
  comment?: string | null;
  foc_qty: number;
  /** ของแถมที่รับเข้ามาแล้ว — อยู่บนแถวตรง ๆ ต่างจาก `received_qty` ของยอดสั่งซื้อ
   *  ที่ต้องไปรวมเอาจาก `pr_details[]` */
  foc_received_qty: number;
  // ไม่มี foc_unit บน wire เลย (ยืนยัน 8/8 เอกสารจริง — มีแค่ foc_qty ไม่มี
  // foc_unit_id/foc_unit_name หรือ foc_unit object คู่กัน) ของเดิมมี
  // foc_unit_id?/foc_unit_name? เป็น phantom field มาก่อนแล้ว ลบทิ้งตามจริง
  base_sub_total_price?: number;
  base_net_amount?: number;
  base_total_price?: number;
  stages_status?: Record<string, unknown>;
  info?: Record<string, unknown>;
  pr_details: PrDetailRef[];
  history?: PoItemHistoryEntry[];
}

export interface PoItemHistoryEntry {
  at: string;
  seq: number;
  name: string;
  user: { id: string; name?: string };
  status: string;
  message?: string | null;
}

export interface PoGrnRef {
  grn_id: string | null;
  grn_no: string | null;
}

export interface PrDetailRef {
  pr_detail: EntityRef | null;
  /** ใบขอซื้อต้นทาง — `null` เมื่อแถวนี้ไม่ได้มาจาก PR (manual / price list) */
  pr_id: string | null;
  pr_no: string | null;
  /** ใบรับสินค้าที่อ้างแถวนี้ */
  grn: PoGrnRef[];
  order_qty: number;
  order_base_qty: number;
  received_qty: number;
  foc_qty: number;
  foc_received_qty: number;
}

/**
 * เวอร์ชันฝั่งเขียนของ `PrDetailRef` — payload ที่ frontend ส่งขึ้นยังเป็น
 * `pr_detail_id` แบบ flat เหมือนเดิม (ไม่ได้แตะฝั่งเขียนตาม contract ของ task นี้)
 * แยกจาก `PrDetailRef` (ฝั่งอ่าน object) เพราะสอง endpoint คนละทิศ ใช้ชื่อ field
 * เดียวกัน (`pr_details`) แต่คนละ shape
 */
export interface PrDetailRefPayload {
  pr_detail_id: string | null;
  order_qty: number;
  order_base_qty: number;
  received_qty: number;
  foc_qty: number;
}

export interface PoDetailPayload {
  doc_version?: number;
  sequence: number;
  product_id: string;
  product_code: string;
  product_name: string;
  product_local_name: string;
  product_sku: string;
  order_unit_id: string;
  order_unit_name: string;
  order_unit_conversion_factor: number;
  order_qty: number;
  base_unit_id: string;
  base_unit_name: string;
  base_qty: number;
  price: number;
  sub_total_price: number;
  net_amount: number;
  total_price: number;
  tax_profile_id: string | null;
  tax_profile_name: string;
  tax_rate: number;
  tax_amount: number;
  is_tax_adjustment: boolean;
  discount_rate: number;
  discount_amount: number;
  is_discount_adjustment: boolean;
  is_foc: boolean;
  foc_qty: number;
  pr_details: PrDetailRefPayload[];
  description: string;
  // แถวหนึ่ง = คลังเดียว — ของเดิมส่ง `locations[]` ซ้อนในแถว
  location_id: string | null;
  location_code: string;
  location_name: string;
  delivery_point_id: string | null;
  delivery_point_name: string;
  comment: string;
  foc_unit_id: string | null;
  foc_unit_name: string;
}

export interface CreatePoDto {
  stage_role: string;
  details: {
    doc_version?: number;
    po_type?: PO_TYPE;
    workflow_id: string;
    vendor_id: string;
    vendor_name: string;
    delivery_date: string;
    currency_id: string;
    currency_code: string;
    exchange_rate: number;
    description: string;
    order_date: string;
    credit_term_id?: string;
    credit_term_name?: string;
    credit_term_value?: number;
    buyer_id: string;
    buyer_name: string;
    email: string;
    remarks: string;
    note: string;
    purchase_order_detail: {
      add?: PoDetailPayload[];
      update?: (PoDetailPayload & { id: string })[];
      remove?: { id: string }[];
    };
  };
}

export interface PurchaseOrder {
  id: string;
  po_no: string;
  po_status: PO_STATUS;
  po_type: string;
  description: string;
  order_date: string;
  delivery_date: string;
  exchange_rate: number;
  doc_version: number;
  total_amount: number;
  last_action?: LastAction | null;
  workflow_current_stage: string | null;
  workflow_next_stage: string | null;
  // ส่งมาทั้ง list (`GET /api/{bu}/purchase-orders` — แถวอยู่ที่ `data[]` ตรง ๆ) และ detail · `@CollapseRefs()` กับ `@EnrichAuditUsers()`
  // เดินถึงแถวที่ซ้อนแล้วตั้งแต่ 2026-09-18 จึงเป็น object จริงทั้งคู่ ไม่ใช่คู่ flat
  // `_id`/`_name` อีก (ยืนยันจาก payload จริง 5/5 แถว)
  vendor: EntityRef | null;
  currency: EntityRef | null;
  audit?: Audit;
  // display-only string ไม่มี workflow_id / buyer_id คู่กัน
  workflow_name?: string;
  buyer_name?: string;
  // ยอดรวมระดับหัวเอกสารที่ list คำนวณมาให้ (detail ไม่ส่ง — คิดจาก line item)
  total_qty?: number;
  total_price?: number;
  total_tax?: number;
  net_amount?: number;
  base_net_amount?: number;
  base_total_amount?: number;
  // detail endpoint (`GET /api/{bu}/purchase-orders/{id}`) เท่านั้น — list ไม่ส่ง
  buyer?: EntityRef | null;
  workflow?: EntityRef | null;
  credit_term?: EntityRef | null;
  credit_term_value?: number;
  role?: string;
  stage_actions?: StageActionFlags | null;
  workflow_previous_stage?: string | null;
  workflow_history?: WorkflowHistoryEntry[];
  email?: string;
  remarks?: string;
  approval_date?: string | null;
  user_action?: Record<string, unknown>;
  info?: Record<string, unknown>;
  purchase_order_detail?: PurchaseOrderDetail[];
}

// --- PO for GRN (from /purchase-order/grn endpoint) ---

interface PoGrnDetailLocation {
  location_id: string;
  location_code?: string;
  location_name: string;
  location_type: string;
  order_qty: number;
  requested_qty?: number;
  remain_qty?: number;
  request_unit_id?: string;
  request_unit_name?: string;
  foc_qty?: number;
  request_base_factor?: number;
  request_base_qty?: number;
  request_base_unit_id?: string | null;
  request_base_unit_name?: string | null;
  received_qty?: number;
  can_use?: boolean;
}

export interface PoGrnDetail {
  id: string;
  sequence_no: number;
  product_id: string;
  product_code: string | null;
  product_name: string | null;
  product_local_name: string | null;
  order_qty: number;
  order_unit_id: string;
  order_unit_name: string;
  order_unit_conversion_factor: number;
  base_qty: number;
  base_unit_id: string;
  base_unit_name: string | null;
  received_qty: number;
  cancelled_qty: number;
  price: number;
  net_amount: number;
  is_foc: boolean;
  locations: PoGrnDetailLocation[];
  can_use?: boolean;
}

export interface PoForGrn {
  id: string;
  po_no: string;
  po_status: string;
  grn_status?: string;
  vendor_id: string;
  vendor_name: string;
  order_date: string;
  delivery_date: string;
  currency_id: string;
  currency_code: string;
  exchange_rate: number;
  po_detail: PoGrnDetail[];
  can_use?: boolean;
}

// --- Vendor for GRN (from /purchase-order/grn/vendor) ---

export interface VendorForGrn {
  vendor_id: string;
  vendor_code: string;
  vendor_name: string;
  po_count: number;
}

// --- Group PR → PO ---

export interface GroupPrProduct {
  product_id: string;
  product_name: string;
  qty: number;
  price_per_unit: number;
  total: number;
  base_total_price: number;
}

export interface GroupPrPo {
  po_no: string;
  delivery_date: string;
  vendor_name: string;
  currency_code: string;
  exchange_rate: number;
  total_price: number;
  base_price: number;
  products: GroupPrProduct[];
  pr: string[];
}
