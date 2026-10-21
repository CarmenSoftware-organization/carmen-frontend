import type { LastAction } from "./last-action";
import type { HiddenPriceField } from "./workflows";

export type ApprovalDocType = "pr" | "po" | "sr";

export interface ApprovalItem {
  id: string;
  doc_type: ApprovalDocType;
  doc_no: string;
  doc_date: string;
  description: string;
  status: string;
  // Workflow
  workflow_name: string;
  workflow_current_stage: string;
  workflow_next_stage: string | null;
  workflow_previous_stage: string | null;
  last_action: LastAction | null;
  // PR / SR
  requestor_name: string;
  department_name: string;
  // PO (ผู้ขาย) หรือ SR (ต้นทาง -> ปลายทาง)
  vendor_name: string;
  // null เมื่อ hidden_fields มี total_price
  total_amount: number | null;
  hidden_fields?: HiddenPriceField[];
  delivery_date: string | null;
  // หน่วยธุรกิจที่เอกสารอยู่ — รายการเดียวครอบได้หลายหน่วย
  bu_code: string;
  bu_name: string;
  currency_code: string;
}

export interface ApprovalPendingSummary {
  total: number;
  sr: number;
  pr: number;
  po: number;
}

// --- Raw API response shape for normalization ---

/**
 * แถวดิบจาก GET /api/my-pending (view sys_v_my_pending)
 * ทุกประเภทเอกสารมาในโครงเดียวกันแล้ว โดยฟิลด์ที่ไม่มีในประเภทนั้นจะเป็น null
 * เช่น ใบขอซื้อไม่มี counterparty_name, ใบเบิกสินค้าไม่มียอดเงิน
 */
export interface RawApprovalUnified {
  doc_type: ApprovalDocType;
  id: string;
  doc_no: string | null;
  doc_date: string | null;
  due_date: string | null;
  doc_status: string | null;
  doc_subtype: string | null;
  description: string | null;
  workflow_id: string | null;
  workflow_name: string | null;
  workflow_current_stage: string | null;
  workflow_next_stage: string | null;
  workflow_previous_stage: string | null;
  owner_id: string | null;
  requestor_name: string | null;
  department_id: string | null;
  department_name: string | null;
  counterparty_name: string | null;
  currency_code: string | null;
  net_amount: number | null;
  total_amount: number | null;
  total_qty: number | null;
  last_action: LastAction | null;
  created_at: string | null;
  created_by_id: string | null;
  doc_version: number | null;
  bu_code: string;
  bu_name: string | null;
  hidden_fields?: HiddenPriceField[];
}
