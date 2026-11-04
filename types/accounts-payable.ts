/**
 * รูปข้อมูล AP invoice / AP payment ตาม backend จริง
 * (`api/:bu_code/ap-invoice` และ `api/:bu_code/ap-payment`)
 *
 * เงินจาก backend เป็น number — repository แปลงเป็น `DecimalString` ที่ขอบเขตเท่านั้น
 * ชื่อลูกที่ backend ส่งเป็น `tb_ap_*` ถูก map เป็นชื่อสั้นที่ repository
 * (`lines`, `references`, `tax`, `allocations`, `wht`, `expenses`, `tax_invoices`)
 */
import type { ParamsDto } from "@/types/params";

export type DecimalString = string;

export type ApDocStatus = "draft" | "in_review" | "posted" | "void";
export type ApDocType = "invoice" | "debit_note" | "credit_note" | "deposit";
export type ApDocSource =
  | "manual"
  | "grn"
  | "grn_auto"
  | "copy"
  | "excel"
  | "ai"
  | "interface";
/** สถานะการชำระ — คำนวณจาก outstanding เทียบ total (ไม่มีคอลัมน์ใน backend) */
export type ApSettlement = "unpaid" | "partially_paid" | "paid";
export type ApPaymentMethod =
  | "bank_transfer"
  | "cheque"
  | "cash"
  | "credit_card"
  | "promptpay";
export type ApTaxStatus =
  | "pending"
  | "on_review"
  | "unclaim"
  | "confirmed"
  | "submitted"
  | "void";

/** คำสั่ง workflow ที่ backend รับ (UI "return" = `review`) */
export type ApCommand = "submit" | "approve" | "review" | "reject" | "void";
/** ชื่อ action ฝั่ง UI */
export type ApUiAction =
  | "submit"
  | "approve"
  | "return"
  | "reject"
  | "void"
  | "delete";

export type ApListParams = ParamsDto;

export interface ApAttachment {
  originalName: string;
  fileToken: string;
  contentType: string;
}

export interface ApWorkflowFields {
  workflow_id?: string | null;
  workflow_name?: string | null;
  workflow_current_stage?: string | null;
  workflow_previous_stage?: string | null;
  workflow_next_stage?: string | null;
  workflow_history?: unknown;
  /** `{ execute: [{ user_id, ... }] }` — ผู้ที่ลงมือที่ขั้นปัจจุบันได้ */
  user_action?: { execute?: { user_id: string }[] } | null;
  last_action?: string | null;
  last_action_at_date?: string | null;
  last_action_by_id?: string | null;
  last_action_by_name?: string | null;
}

export interface ApDimensionRef {
  gl_dimension_id: string;
  gl_dimension_value_id: string;
  dimension_code?: string;
  value_code?: string;
}

export interface ApInvoiceLineSource {
  good_received_note_id: string;
  grn_no: string;
  good_received_note_detail_item_id: string;
  matched_qty: DecimalString;
  grn_unit_price: DecimalString;
  matched_amount: DecimalString;
  variance_amount: DecimalString;
}

export interface ApInvoiceLine {
  id: string;
  sequence_no: number;
  description: string | null;
  product_id: string | null;
  product_name: string | null;
  unit_id: string | null;
  unit_name: string | null;
  quantity: DecimalString;
  unit_price: DecimalString;
  sub_total_amount: DecimalString;
  discount_amount: DecimalString;
  net_amount: DecimalString;
  dr_chart_of_accounts_id: string;
  dr_account_code: string | null;
  dr_cost_center_id: string | null;
  dr_cost_center_code: string | null;
  vat_tax_profile_id: string | null;
  vat_rate: DecimalString;
  vat_amount: DecimalString;
  vat_is_override: boolean;
  vat_chart_of_accounts_id: string | null;
  vat_cost_center_id: string | null;
  wht_tax_profile_id: string | null;
  wht_rate: DecimalString | null;
  wht_estimate_amount: DecimalString;
  cr_chart_of_accounts_id: string;
  cr_account_code: string | null;
  cr_cost_center_id: string | null;
  total_amount: DecimalString;
  unpaid_amount: DecimalString;
  base_total_amount: DecimalString;
  base_unpaid_amount: DecimalString;
  dimensions: ApDimensionRef[];
  sources: ApInvoiceLineSource[];
}

export interface ApInvoiceReference {
  ref_ap_invoice_id: string;
  ref_doc_type: ApDocType;
  applied_amount: DecimalString;
  realized_fx_amount: DecimalString;
}

export interface ApInvoiceTax {
  tax_invoice_no: string;
  tax_invoice_date: string;
  base_amount: DecimalString;
  vat_amount: DecimalString;
  tax_status: ApTaxStatus;
  expiry_claim_date: string;
}

export interface ApInvoice extends ApWorkflowFields {
  id: string;
  doc_version: number | null;
  doc_no: string;
  doc_type: ApDocType;
  doc_status: ApDocStatus;
  doc_source: ApDocSource;
  doc_date: string;
  description: string | null;
  vendor_id: string;
  vendor_name: string;
  vendor_invoice_no: string;
  invoice_date: string;
  credit_term_id: string | null;
  credit_term_name: string | null;
  credit_term_days: number;
  due_date: string;
  currency_id: string;
  currency_code: string;
  exchange_rate: DecimalString;
  base_currency_id: string;
  base_currency_code: string;
  sub_total_amount: DecimalString;
  discount_amount: DecimalString;
  net_amount: DecimalString;
  vat_amount: DecimalString;
  total_amount: DecimalString;
  base_total_amount: DecimalString;
  wht_estimate_amount: DecimalString;
  outstanding_amount: DecimalString;
  reference_applied_amount: DecimalString;
  gl_jv_id: string | null;
  gl_jv_no: string | null;
  posted_at: string | null;
  void_at: string | null;
  void_reason: string | null;
  void_gl_jv_id: string | null;
  attachments?: ApAttachment[];
  created_at: string | null;
  created_by_id: string | null;
  updated_at: string | null;
  updated_by_id: string | null;
  /** เฉพาะ detail (list ไม่มี) */
  lines?: ApInvoiceLine[];
  references?: ApInvoiceReference[];
  tax?: ApInvoiceTax | null;
}

export interface ApInvoiceLineInput {
  sequence_no: number;
  description?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  unit_id?: string | null;
  unit_name?: string | null;
  quantity: DecimalString;
  unit_price: DecimalString;
  discount_amount?: DecimalString | null;
  dr_chart_of_accounts_id: string;
  dr_cost_center_id?: string | null;
  vat_tax_profile_id?: string | null;
  vat_amount?: DecimalString | null;
  vat_is_override?: boolean;
  wht_tax_profile_id?: string | null;
  dimensions?: { gl_dimension_id: string; gl_dimension_value_id: string }[] | null;
  /** ฟิลด์ที่ UI ไม่ได้แก้ — ส่งกลับตามเดิมตอน PUT (กันถูกล้าง) */
  vat_chart_of_accounts_id?: string | null;
  vat_cost_center_id?: string | null;
  cr_chart_of_accounts_id?: string | null;
  cr_cost_center_id?: string | null;
  sources?: { good_received_note_detail_item_id: string; matched_qty: DecimalString }[] | null;
}

export interface ApInvoiceReferenceInput {
  ref_ap_invoice_id: string;
  applied_amount: DecimalString;
}

/**
 * ข้อมูลสร้าง/แก้ใบ AP invoice — ตอนแก้ repository ตัด `doc_type`, `doc_source`,
 * `vendor_id`, `currency_id` ออก (backend ห้ามแก้หลังสร้าง) และส่ง `doc_version` แยก
 */
export interface ApInvoiceInput {
  doc_type: ApDocType;
  doc_source?: Exclude<ApDocSource, "grn" | "grn_auto">;
  /** YYYY-MM-DD */
  doc_date: string;
  vendor_id: string;
  vendor_invoice_no: string;
  /** YYYY-MM-DD */
  invoice_date: string;
  credit_term_days?: number | null;
  currency_id?: string | null;
  exchange_rate?: DecimalString | null;
  description?: string | null;
  attachments?: ApAttachment[] | null;
  lines: ApInvoiceLineInput[];
  references?: ApInvoiceReferenceInput[] | null;
}

export interface ApPaymentAllocation {
  id: string;
  ap_invoice_id: string;
  ap_invoice_detail_id: string;
  doc_type: ApDocType;
  applied_amount: DecimalString;
  invoice_exchange_rate: DecimalString;
  base_applied_at_invoice_rate: DecimalString;
  base_applied_at_payment_rate: DecimalString;
  realized_fx_amount: DecimalString;
}

export interface ApPaymentWht {
  id: string;
  wht_tax_profile_id: string;
  wht_tax_profile_name: string;
  pnd_form?: string | null;
  income_type?: string | null;
  base_amount: DecimalString;
  wht_rate: DecimalString;
  wht_amount: DecimalString;
  is_override: boolean;
}

export interface ApPaymentExpense {
  id: string;
  chart_of_accounts_id: string;
  cost_center_id: string | null;
  description: string | null;
  amount: DecimalString;
  base_amount: DecimalString;
}

export interface ApPaymentTaxInvoice {
  ap_invoice_id: string;
  doc_no: string;
  tax_invoice_no: string;
  tax_invoice_date: string;
  base_amount: DecimalString;
  vat_amount: DecimalString;
}

export interface ApPayment extends ApWorkflowFields {
  id: string;
  doc_version: number | null;
  doc_no: string;
  doc_status: ApDocStatus;
  payment_date: string;
  paid_date: string | null;
  description: string | null;
  reference_no: string | null;
  vendor_id: string;
  vendor_name: string;
  payee_name: string;
  payee_tax_no: string | null;
  payee_branch_no: string | null;
  payee_address: string | null;
  bank_account_id: string;
  bank_account_code: string;
  bank_account_name: string;
  payment_method: ApPaymentMethod;
  cheque_no: string | null;
  cheque_date: string | null;
  currency_id: string;
  currency_code: string;
  exchange_rate: DecimalString;
  base_currency_id: string;
  base_currency_code: string;
  total_applied_amount: DecimalString;
  total_wht_amount: DecimalString;
  total_expense_amount: DecimalString;
  net_paid_amount: DecimalString;
  base_total_applied_amount: DecimalString;
  base_total_wht_amount: DecimalString;
  base_total_expense_amount: DecimalString;
  base_net_paid_amount: DecimalString;
  realized_fx_amount: DecimalString;
  gl_jv_id: string | null;
  gl_jv_no: string | null;
  posted_at: string | null;
  void_at: string | null;
  void_reason: string | null;
  attachments?: ApAttachment[];
  created_at: string | null;
  updated_at: string | null;
  /** เฉพาะ detail (list ไม่มี) */
  allocations?: ApPaymentAllocation[];
  wht?: ApPaymentWht[];
  expenses?: ApPaymentExpense[];
  tax_invoices?: ApPaymentTaxInvoice[];
}

export interface ApPaymentAllocationInput {
  ap_invoice_detail_id: string;
  /** บวก = invoice/debit note/deposit · ลบ = credit note */
  applied_amount: DecimalString;
}

export interface ApPaymentWhtInput {
  wht_tax_profile_id: string;
  base_amount: DecimalString;
  wht_amount: DecimalString;
  is_override?: boolean;
}

export interface ApPaymentExpenseInput {
  chart_of_accounts_id: string;
  cost_center_id?: string | null;
  description?: string | null;
  amount: DecimalString;
}

/** ตอนแก้ repository ตัด `vendor_id` ออก (backend ห้ามแก้หลังสร้าง) */
export interface ApPaymentInput {
  vendor_id: string;
  /** YYYY-MM-DD */
  payment_date: string;
  paid_date?: string | null;
  bank_account_id: string;
  payment_method?: ApPaymentMethod;
  cheque_no?: string | null;
  cheque_date?: string | null;
  reference_no?: string | null;
  description?: string | null;
  exchange_rate?: DecimalString | null;
  attachments?: ApAttachment[] | null;
  allocations: ApPaymentAllocationInput[];
  wht?: ApPaymentWhtInput[] | null;
  expenses?: ApPaymentExpenseInput[] | null;
}

export interface ApOutstandingLine {
  ap_invoice_detail_id: string;
  doc_type: ApDocType;
  sequence_no: number;
  description: string | null;
  total_amount: DecimalString;
  unpaid_amount: DecimalString;
  /** ยอดที่ยังจ่ายได้ หลังหักที่ใบจ่าย draft/in_review จองไว้ */
  available_amount: DecimalString;
  wht_tax_profile_id: string | null;
}

export interface ApOutstandingDocument {
  ap_invoice_id: string;
  doc_no: string;
  doc_type: ApDocType;
  doc_date: string;
  due_date: string;
  currency_id: string;
  currency_code: string;
  exchange_rate: DecimalString;
  outstanding_amount: DecimalString;
  lines: ApOutstandingLine[];
}

export interface ApWhtPreviewRow {
  wht_tax_profile_id: string;
  wht_tax_profile_name: string;
  pnd_form?: string | null;
  income_type?: string | null;
  wht_rate: DecimalString;
  base_amount: DecimalString;
  wht_amount: DecimalString;
}

export interface ApWhtPreviewInput {
  allocations: ApPaymentAllocationInput[];
  /** แก้ใบร่างเดิม — backend ใช้ตัดยอดจองของใบนี้เองออกจากการคำนวณ */
  ap_payment_id?: string;
}

/** ผลของ create/update/action — backend คืนแค่ id/doc_no/doc_status/doc_version/gl_jv_no */
export interface ApMutationResult {
  id: string;
  doc_no?: string;
  doc_status?: ApDocStatus;
  doc_version?: number | null;
  gl_jv_no?: string | null;
}

export interface ApActionInput {
  docVersion?: number | null;
  reason?: string | null;
  stage?: string | null;
}
