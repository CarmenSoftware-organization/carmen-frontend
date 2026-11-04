import type { StageActionFlags } from "@/lib/workflow-stage-actions";

/** ตรงกับ `enum_jv_status` ของ backend */
export type JournalVoucherStatus =
  | "draft"
  | "in_review"
  | "scheduled"
  | "posted"
  | "void";

export type JournalVoucherSourceType =
  | "manual"
  | "ap_invoice"
  | "ap_payment"
  | "ap_adjustment"
  | "inventory"
  | "accounts_receivable"
  | "fixed_asset"
  | (string & {});

export interface JournalVoucherSourceLink {
  kind: string;
  label: string;
  href: string | null;
}

export interface JournalVoucherCapabilities {
  can_edit_accounting_fields: boolean;
  can_submit: boolean;
  can_approve: boolean;
  can_reject: boolean;
  can_void: boolean;
  can_reverse: boolean;
  can_open_source: boolean;
}

export interface JournalLineDimensionInput {
  dimension_id: string;
  dimension_value_id: string;
}

export interface JournalVoucherLineInput {
  account_id: string;
  department_id: string | null;
  comment: string | null;
  currency_id: string;
  exchange_rate: string;
  rate_date: string | null;
  rate_type: string | null;
  rate_source: string | null;
  debit: string;
  credit: string;
  dimension: JournalLineDimensionInput[];
}

export interface JournalVoucherInput {
  journal_type: string;
  prefix: string;
  journal_date: string;
  description: string;
  note: string | null;
  functional_currency_id: string;
  source_system?: string | null;
  source_type: JournalVoucherSourceType | null;
  source_id: string | null;
  source_no: string | null;
  source_version?: number | null;
  event_type?: string | null;
  posting_rule_code?: string | null;
  schedule_post: boolean;
  scheduled_post_at: string | null;
  auto_reverse: boolean;
  reverse_date: string | null;
  is_adjustment?: boolean;
  lines: JournalVoucherLineInput[];
}

export interface JournalVoucherLine extends JournalVoucherLineInput {
  id: string;
  sequence_no: number;
  account_code: string | null;
  account_name: string | null;
  department_code: string | null;
  department_name: string | null;
  currency_code: string | null;
  base_debit: string;
  base_credit: string;
}

export interface JournalVoucher extends JournalVoucherInput {
  id: string;
  doc_version: number;
  display_no: string;
  jv_no: string | null;
  draft_reference: string;
  jv_status: JournalVoucherStatus;
  jv_date: string;
  jv_type: string;
  base_currency_id: string;
  total_debit: string;
  total_credit: string;
  reversed_by_jv_id?: string | null;
  /** จาก workflow orchestrator — "approve" เมื่อผู้ใช้ลงมือได้ที่ขั้นปัจจุบัน */
  role?: string;
  stage_actions?: StageActionFlags | null;
  workflow_id?: string | null;
  workflow_name?: string | null;
  workflow_current_stage?: string | null;
  workflow_previous_stage?: string | null;
  workflow_next_stage?: string | null;
  /** backend ไม่ระบุชนิด และ default ใน DB เป็น `{}` — ใช้ต้องเช็ก Array.isArray */
  workflow_history?: unknown;
  is_source_generated?: boolean;
  /** ชนิดเอกสารต้นทางที่ subledger ผูกไว้ — มีค่า = ใบของ subledger (ดู `isSubledgerVoucher` ฝั่ง backend) */
  source_ref_type?: string | null;
  posting_event_id?: string | null;
  generated_revision?: number | null;
  source_links?: JournalVoucherSourceLink[];
  capabilities?: JournalVoucherCapabilities;
  lines: JournalVoucherLine[];
}

export interface JournalVoucherAction {
  doc_version: number;
  idempotency_key?: string;
  reason?: string;
  destination_stage?: string;
  scheduled_post_at?: string;
  reverse_date?: string;
  post_at?: string;
  /** วันที่ของใบกลับรายการ (ISO 8601 UTC) — บังคับสำหรับ reverse */
  jv_date?: string;
}
