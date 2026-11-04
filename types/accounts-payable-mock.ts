import type { PaginatedResponse } from "@/types/params";

import type { DecimalString } from "@/types/accounts-payable";

export type { DecimalString };
export type ApLifecycle =
  | "draft"
  | "submitted"
  | "ready_to_release"
  | "processing"
  | "executed"
  | "posting"
  | "posted"
  | "post_failed"
  | "voided"
  | "reversed";
export type ApSettlementStatus = "unpaid" | "partially_paid" | "paid";
export type ApTaxStatus =
  | "pending"
  | "confirmed"
  | "on_review"
  | "filed"
  | "unclaimable"
  | "not_applicable";
export type ApMatchStatus =
  "not_required" | "pending" | "matched" | "variance" | "overridden";
export type ApExecutionStatus =
  | "not_released"
  | "released"
  | "processing"
  | "executed"
  | "failed"
  | "cancelled"
  | "reconciled";

export interface ApDocumentCapabilities {
  can_edit: boolean;
  can_submit: boolean;
  can_approve: boolean;
  can_return: boolean;
  can_reject: boolean;
  can_void: boolean;
  can_release: boolean;
}

export interface ApActivity {
  id: string;
  action: string;
  detail: string;
  actor: string;
  at: string;
}

export interface ApAttachment {
  id: string;
  name: string;
  kind: "invoice" | "tax" | "evidence";
  added_at: string;
}

export interface ApJournalPreviewLine {
  id: string;
  account: string;
  description: string;
  debit: DecimalString;
  credit: DecimalString;
}

export interface ApInvoiceLine {
  id: string;
  description: string;
  unit: string;
  quantity: DecimalString;
  unit_price: DecimalString;
  subtotal: DecimalString;
  discount: DecimalString;
  net_amount: DecimalString;
  vat_rate: DecimalString;
  vat_amount: DecimalString;
  wht_rate: DecimalString;
  wht_eligible_amount: DecimalString;
  account: string;
  department: string;
  dimension: string;
  po_no: string | null;
  grn_no: string | null;
  match_status: ApMatchStatus;
}

export interface ApInvoicePaymentHistory {
  payment_id: string;
  payment_no: string;
  payment_date: string;
  applied_amount: DecimalString;
  status: ApExecutionStatus | "posted";
}

export interface ApInvoice {
  id: string;
  doc_version: number;
  ap_no: string;
  input_date: string;
  vendor_invoice_no: string;
  tax_invoice_no?: string | null;
  tax_invoice_date?: string | null;
  vendor_id: string;
  vendor_name: string;
  invoice_date: string;
  due_date: string | null;
  credit_days: number;
  currency_code: string;
  exchange_rate: DecimalString;
  description: string;
  lifecycle: ApLifecycle;
  workflow_enabled: boolean;
  current_stage: string | null;
  settlement_status: ApSettlementStatus;
  tax_status: ApTaxStatus;
  match_status: ApMatchStatus;
  match_acknowledged: boolean;
  is_on_hold: boolean;
  subtotal: DecimalString;
  discount: DecimalString;
  net_amount: DecimalString;
  vat_amount: DecimalString;
  estimated_wht: DecimalString;
  total_amount: DecimalString;
  open_amount: DecimalString;
  reserved_amount: DecimalString;
  claimed_vat_base?: DecimalString;
  lines: ApInvoiceLine[];
  payments: ApInvoicePaymentHistory[];
  journal: ApJournalPreviewLine[];
  attachments: ApAttachment[];
  activity: ApActivity[];
  capabilities: ApDocumentCapabilities;
}

export interface ApInvoiceInput {
  input_date: string;
  vendor_invoice_no: string;
  vendor_id: string;
  vendor_name: string;
  invoice_date: string;
  due_date: string | null;
  credit_days: number;
  currency_code: string;
  exchange_rate: DecimalString;
  description: string;
  workflow_enabled: boolean;
  tax_status: ApTaxStatus;
  match_status: ApMatchStatus;
  match_acknowledged: boolean;
  lines: ApInvoiceLine[];
}

export interface ApPaymentApplication {
  id: string;
  invoice_id: string;
  invoice_no: string;
  vendor_invoice_no: string;
  po_no: string | null;
  grn_no: string | null;
  original_amount: DecimalString;
  open_amount: DecimalString;
  apply_amount: DecimalString;
  wht_base: DecimalString;
  wht_rate: DecimalString;
  wht_amount: DecimalString;
  net_cash: DecimalString;
  match_status: ApMatchStatus;
  invoice_date?: string;
  due_date?: string;
  description?: string;
  original_rate?: DecimalString;
  net_amount?: DecimalString;
  vat_amount?: DecimalString;
  tax_status?: ApTaxStatus;
  wht_override_reason?: string;
  undue_vat_base?: DecimalString;
}

export interface ApPaymentMethodLine {
  id: string;
  method: ApPayment["payment_method"];
  bank_account: string;
  payee: string;
  reference: string;
  account: string;
  cost_center: string;
  dimensions: string;
  amount: DecimalString;
}

export interface ApPaymentExpense {
  id: string;
  description: string;
  account: string;
  cost_center: string;
  dimensions: string;
  base_amount: DecimalString;
}

export interface ApPaymentTaxInvoice {
  id: string;
  document_no: string;
  date: string;
  tax_id: string;
  branch: string;
  profile: string;
  filing_period: string;
  status: ApTaxStatus;
  base_amount: DecimalString;
  vat_amount: DecimalString;
}

export interface ApDepositOffset {
  id: string;
  deposit_no: string;
  deposit_date: string;
  original_deposit_amount: DecimalString;
  remaining_deposit_amount: DecimalString;
  offset_amount: DecimalString;
  note?: string;
}

export interface ApPaymentDetails {
  wht_services?: ApPaymentApplication[];
  tax_allocations?: { invoice_id: string; tax_invoice_id: string; claim_amount: DecimalString }[];
  paid_date?: string;
  payment_methods?: ApPaymentMethodLine[];
  deposit_offsets?: ApDepositOffset[];
  other_expenses?: ApPaymentExpense[];
  tax_invoices?: ApPaymentTaxInvoice[];
  wht_form?: string;
  wht_no?: string;
  wht_account?: string;
  wht_cost_center?: string;
  wht_dimensions?: string;
  wht_payee_name?: string;
  wht_tax_id?: string;
  wht_branch?: string;
  wht_address?: string;
}

export interface ApPayment extends ApPaymentDetails {
  id: string;
  doc_version: number;
  pv_no: string;
  vendor_id: string;
  vendor_name: string;
  payment_date: string;
  due_date: string;
  currency_code: string;
  exchange_rate: DecimalString;
  payment_method: "bank_transfer" | "direct_debit" | "cheque";
  bank_account_masked: string;
  payment_reference: string;
  description: string;
  urgent: boolean;
  lifecycle: ApLifecycle;
  workflow_enabled: boolean;
  current_stage: string | null;
  execution_status: ApExecutionStatus;
  applied_amount: DecimalString;
  wht_amount: DecimalString;
  net_pay: DecimalString;
  net_pay_base?: DecimalString;
  realized_fx: DecimalString;
  applications: ApPaymentApplication[];
  journal: ApJournalPreviewLine[];
  attachments: ApAttachment[];
  activity: ApActivity[];
  capabilities: ApDocumentCapabilities;
  clarification_note: string | null;
}

export interface ApPaymentInput extends ApPaymentDetails {
  vendor_id: string;
  vendor_name: string;
  payment_date: string;
  due_date: string;
  currency_code: string;
  exchange_rate: DecimalString;
  payment_method: ApPayment["payment_method"];
  bank_account_masked: string;
  payment_reference: string;
  description: string;
  urgent: boolean;
  workflow_enabled: boolean;
  applications: ApPaymentApplication[];
}

export interface ApAgingBucket {
  code:
    | "not_due"
    | "due_today"
    | "overdue_1_30"
    | "overdue_31_60"
    | "overdue_61_90"
    | "overdue_90_plus"
    | "missing_due_date";
  amount: DecimalString;
  item_count: number;
  vendor_count: number;
}

export interface ApDashboardSnapshot {
  bu_code: string;
  as_of_date: string;
  paid_from: string;
  paid_to: string;
  functional_currency: string;
  generated_at: string;
  outstanding_amount: DecimalString;
  outstanding_count: number;
  prepaid_amount: DecimalString;
  prepaid_count: number;
  paid_out_amount: DecimalString;
  payment_count: number;
  aging: ApAgingBucket[];
  due: { overdue: number; on_hold: number; reserved: number };
  approvals: { invoice: number; payment: number };
  tax: {
    pending_vat: DecimalString;
    missing_documents: number;
    pending_corrections: number;
  };
  reconciliation_variance: DecimalString;
  widget_errors: string[];
}

export interface ApInvoiceFilters {
  search?: string;
  lifecycle?: string;
  settlement?: string;
  match?: string;
  due_bucket?: string;
  as_of?: string;
  hold?: boolean;
  reserved?: boolean;
  tax?: string;
}

export interface ApPaymentFilters {
  search?: string;
  lifecycle?: string;
  execution?: string;
  method?: string;
  urgent?: boolean;
}

export type ApInvoiceListResponse = PaginatedResponse<ApInvoice>;
export type ApPaymentListResponse = PaginatedResponse<ApPayment>;

export interface ApMockState {
  version: 1;
  invoices: ApInvoice[];
  payments: ApPayment[];
  idempotency_keys: string[];
}
