import type { Audit } from "./audit";
import type { LastAction } from "./last-action";
import type { EntityRef } from "./entity-ref";
import type { StageActionFlags } from "@/lib/workflow-stage-actions";

export type StoreRequisitionStatus =
  "draft" | "in_progress" | "completed" | "cancelled" | "voided";

export interface WorkflowHistoryEntry {
  user: { id: string; name: string };
  action: string;
  at: string;
  next_stage: string;
  current_stage?: string;
}

interface SrItemHistoryEntry {
  seq: number;
  name: string;
  user: { id: string; name: string };
  status: string;
  message?: string | null;
  at: string;
}

interface StoreRequisitionDetail {
  id: string;
  sequence_no: number;
  product: EntityRef | null;
  inventory_unit_name: string;
  description: string;
  requested_qty: number;
  approved_qty: number;
  issued_qty: number;
  current_stage_status: string;
  history?: SrItemHistoryEntry[];
  info: Record<string, unknown>;
  dimension: string;
  doc_version: number;
}

export enum SR_TYPE {
  TRANSFER = "transfer",
  ISSUE = "issue",
}

export type StoreRequisitionType = `${SR_TYPE}`;

export interface StoreRequisition {
  id: string;
  sr_no: string;
  sr_type: StoreRequisitionType;
  role?: string;
  stage_actions?: StageActionFlags | null;
  sr_date: string;
  expected_date: string;
  description: string;
  doc_status: StoreRequisitionStatus;
  // list endpoint: display-only strings, ไม่มี id คู่กันสักตัว (ยืนยันจาก payload
  // จริง) — detail endpoint มี object เต็มด้านล่าง (workflow/requestor/department/
  // from_location/to_location) ประกาศคู่กันไว้ทั้งสองแบบเพราะ shape ต่างกันจริง
  workflow_name?: string;
  workflow_current_stage?: string;
  workflow_previous_stage?: string;
  workflow_next_stage?: string;
  workflow_history: WorkflowHistoryEntry[];
  last_action?: LastAction | null;
  requestor_name?: string;
  department_name?: string;
  from_location_name?: string;
  to_location_name?: string;
  // detail endpoint เท่านั้น
  workflow?: EntityRef | null;
  requestor?: EntityRef | null;
  department?: EntityRef | null;
  from_location?: EntityRef | null;
  to_location?: EntityRef | null;
  issue_by?: EntityRef | null;
  store_requisition_detail: StoreRequisitionDetail[];
  info: Record<string, unknown>;
  dimension: string;
  doc_version: number;
  // flat fields ยังใช้อยู่ในหน้า edit (sr-header / edit-store-requisition-content);
  // list endpoint จะไม่ส่งมา (serializer omit) แต่ enrich เป็น audit object แทน
  audit?: Audit;
}

interface SrDetailPayload {
  doc_version?: number;
  product_id: string;
  description: string;
  requested_qty: number;
  approved_qty: number;
  issued_qty: number;
  current_stage_status: string;
}

export interface CreateStoreRequisitionDto {
  stage_role: string;
  details: {
    sr_date: string;
    expected_date: string;
    description: string;
    requestor_id: string;
    workflow_id: string;
    department_id: string;
    from_location_id: string;
    to_location_id: string;
    doc_version: number;
    store_requisition_detail: {
      add?: SrDetailPayload[];
      update?: (SrDetailPayload & { id: string })[];
      remove?: { id: string }[];
    };
  };
}

/**
 * หนึ่งแถวการเคลื่อนไหวสต๊อกของใบเบิก — backend แตกขาเข้า/ขาออกมาให้แล้ว
 * แถวหนึ่ง = คลังหนึ่ง ไม่ใช่รายการหนึ่ง (ฝั่ง client จึงไม่ต้องแตกเองอีก)
 */
export interface SrStockMovementItem {
  id: string;
  inventory_transaction_id: string | null;
  store_requisition_detail_id: string;
  sequence_no: number;
  location_id: string;
  location_code: string;
  location_name: string;
  product_id: string;
  product_code: string;
  product_name: string;
  product_local_name?: string | null;
  lot_no?: string | null;
  inventory_unit_id: string;
  inventory_unit_name: string;
  qty_in: number;
  qty_out: number;
  cost_per_unit: number;
  total_cost: number;
  requested_qty: number;
  approved_qty: number;
  issued_qty: number;
}

export interface SrStockMovement {
  store_requisition_id: string;
  sr_no: string;
  sr_date: string;
  sr_type: string;
  doc_status: string;
  from_location_id: string;
  from_location_code: string;
  from_location_name: string;
  to_location_id: string;
  to_location_code: string;
  to_location_name: string;
  /**
   * `false` = ตัวเลขในตารางเป็นการ**คาดการณ์**จากตัวใบ ยังไม่ได้ตัดสต๊อกจริง
   * (`source` จะเป็น `store_requisition_detail` ไม่ใช่ inventory transaction)
   */
  is_posted: boolean;
  source: string;
  items: SrStockMovementItem[];
  summary: {
    total_qty_in: number;
    total_qty_out: number;
    total_cost_in: number;
    total_cost_out: number;
  };
}
