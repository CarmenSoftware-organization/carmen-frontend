import type { AuditInfo } from "@/types/workflows";

type CreditNoteType = "quantity_return" | "amount_discount";

export interface CnItemPayload {
  doc_version?: number;
  location_id: string;
  location_name: string;
  product_id: string;
  product_name: string;
  requested_qty: number;
  approved_qty: number;
  return_qty: number;
  return_unit_id: string;
  return_unit_name: string;
  currency_code: string;
  price: number;
  net_amount: number;
  discount_rate: number;
  discount_amount: number;
  is_discount_adjustment: boolean;
  tax_profile_id?: string | null;
  tax_rate: number;
  tax_amount: number;
  total_price: number;
  is_tax_adjustment: boolean;
  description: string;
}

export interface CreateCnDto {
  doc_version?: number;
  credit_note_type: CreditNoteType;
  grn_id: string;
  grn_date: string;
  vendor_id: string;
  credit_note_number?: string;
  cn_date: string;
  cn_reason_id: string;
  reference_number: string;
  description?: string;
  currency_id: string;
  exchange_rate: number;
  // อ้างอิงจาก GRN — GRN บางใบไม่มี จึง optional และ omit ตอนว่าง
  // (backend ไม่รับ "" สำหรับ invoice_date ที่เป็น ISO-8601 datetime)
  invoice_no?: string;
  invoice_date?: string;
  tax_invoice_no: string;
  tax_invoice_date: string;
  tax_amount: number;
  discount_amount: number;
  note?: string;
  credit_note_detail: {
    add?: CnItemPayload[];
    update?: (CnItemPayload & { id: string })[];
    // หลังบ้าน CN อ่าน `delete` ไม่ใช่ `remove` — ส่ง `remove` ไป zod ตัดทิ้งเงียบ ๆ ได้ 200
    // แต่บรรทัดไม่ถูกลบ (e2e CN.4)
    delete?: { id: string }[];
  };
}

export enum CN_STATUS {
  DRAFT = "draft",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  VOIDED = "voided",
}

/**
 * แถวของ **list** `GET /{bu}/credit-notes` เท่านั้น — ไม่ใช่รูปร่างของใบเดี่ยว
 * (นั่นคือ `CreditNoteDetail` ซึ่งมี field คนละชุด)
 *
 * list endpoint **ไม่ส่ง** `tax_invoice_*` / `credit_note_detail` กลับมา (ยืนยันจาก response
 * จริง) การเคยประกาศไว้ทำให้ tsc ปล่อยผ่านโค้ดที่อ่านค่าเหล่านี้แล้วได้ `undefined` เงียบ ๆ
 * `grn_no` / `grn_date` / `invoice_no` / `invoice_date` ส่งมาตั้งแต่ BE เพิ่มเข้า list
 * (2026-11-18) — BE ที่ยังไม่ deploy จะไม่ส่ง คอลัมน์ในตารางจะว่าง (ไม่พัง)
 */
export interface CreditNote {
  id: string;
  doc_version?: number;
  cn_no: string;
  cn_date: string;
  doc_status: CN_STATUS;
  credit_note_type: CreditNoteType;
  vendor_id: string;
  vendor_name?: string | null;
  currency_id: string;
  currency_code?: string | null;
  exchange_rate: number;
  exchange_rate_date?: string | null;
  grn_id: string;
  grn_no?: string | null;
  grn_date?: string | null;
  invoice_no?: string | null;
  invoice_date?: string | null;
  cn_reason_id: string | null;
  cn_reason_name?: string | null;
  cn_reason_description?: string | null;
  note: string | null;
  description: string | null;
  reference_number?: string | null;
  tax_amount?: number;
  discount_amount?: number;
  total_amount?: number;
  base_total_amount?: number;
  is_active?: boolean;
  audit?: AuditInfo;
}

interface CreditNoteDetailItem {
  id: string;
  doc_version?: number;
  sequence_no?: number;
  product: {
    id: string | null;
    code: string | null;
    name: string | null;
    local_name: string | null;
    sku: string | null;
  } | null;
  location: {
    id: string | null;
    code: string | null;
    name: string | null;
  } | null;
  return_unit: {
    id: string | null;
    name: string | null;
  } | null;
  tax_profile: {
    id: string | null;
    name: string | null;
  } | null;
  return_qty: number;
  price: number;
  tax_rate: number;
  tax_amount: number;
  is_tax_adjustment: boolean;
  discount_rate?: number;
  discount_amount?: number;
  is_discount_adjustment?: boolean;
  net_amount: number;
  total_price: number;
  description: string | null;
  note?: string | null;
}

export interface CreditNoteDetail {
  id: string;
  doc_version?: number;
  cn_no: string;
  cn_date: string;
  doc_status: CN_STATUS;
  credit_note_type: CreditNoteType;
  invoice_no: string | null;
  invoice_date: string | null;
  tax_invoice_no: string | null;
  tax_invoice_date: string | null;
  note: string | null;
  description: string | null;
  reference_number?: string | null;
  tax_amount?: number;
  discount_amount?: number;
  vendor: {
    id: string | null;
    name: string | null;
  } | null;
  currency: {
    id: string | null;
    code: string | null;
    exchange_rate: number | null;
  } | null;
  grn: {
    id: string | null;
    no: string | null;
    date: string | null;
  } | null;
  cn_reason: {
    id: string | null;
    name: string | null;
    description: string | null;
  } | null;
  audit?: AuditInfo;
  credit_note_detail: CreditNoteDetailItem[];
}

/**
 * แถวเคลื่อนไหวสต๊อกของใบลดหนี้ (`GET .../credit-notes/{id}/stock-movements`)
 *
 * **ประกาศเฉพาะฟิลด์ที่ตารางวาดจริง** — response ยังไม่เคยถูกยิงดูของจริง (ทรงนี้
 * ลอกมาจาก `SrStockMovement` ที่ backend ชุดเดียวกันทำไว้ก่อน) ฟิลด์ที่เกินมาไม่
 * กระทบอะไร ส่วนฟิลด์ที่หายจะขึ้นเป็นช่องว่าง ไม่ใช่จอขาว
 */
export interface CnStockMovementItem {
  id: string;
  sequence_no: number;
  location_name: string;
  product_name: string;
  product_local_name?: string | null;
  inventory_unit_name: string;
  lot_no?: string | null;
  /** จำนวนที่ใบบอกว่าคืน — มีค่าเสมอ ต่างจาก `qty_out` ที่ว่างจนกว่าจะตัดสต๊อกจริง */
  return_qty: number;
  return_unit_name?: string | null;
  /** จำนวนที่สต๊อกขยับจริง — `0` ตราบใดที่ `is_posted` ยังไม่เป็น true */
  qty_out: number;
  cost_per_unit: number;
  total_cost: number;
}

export interface CnStockMovement {
  credit_note_id: string;
  /**
   * `false` = ตัวเลขเป็นการคาดการณ์จากตัวใบ ยังไม่ได้ตัดสต๊อกจริง · `undefined` =
   * backend ไม่ได้ส่งมา ซึ่งต่างจาก false — ห้ามเช็คด้วย `!is_posted`
   */
  is_posted?: boolean;
  /** `inventory_transaction` = ของขยับจริง · `document_detail` = อ่านจากตัวใบ */
  source?: string;
  items: CnStockMovementItem[];
}
