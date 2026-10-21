import { z } from "zod";

import type { Audit } from "./audit";
import { lastActionSchema } from "./last-action";
import type { LastAction } from "./last-action";
import type { DiscountFields, ItemMoneyFields, TaxFields } from "./shared-item";
import type { EntityRef } from "./entity-ref";
import type { StageActionFlags } from "@/lib/workflow-stage-actions";

type PurchaseRequestStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "in_progress"
  | "completed"
  | "voided";

export enum PR_STATUS {
  DRAFT = "draft",
  IN_PROGRESS = "in_progress",
  APPROVED = "approved",
  COMPLETED = "completed",
  VOIDED = "voided",
}

export enum PR_ITEM_STAGE_STATUS {
  PENDING = "pending",
  SUBMIT = "submit",
  APPROVE = "approve",
  APPROVED = "approved",
  REJECT = "reject",
  REJECTED = "rejected",
  REVIEW = "review",
}

interface PurchaseRequestDetail
  extends TaxFields, DiscountFields, ItemMoneyFields {
  id: string;
  purchase_request: EntityRef | null;
  sequence_no: number;
  location: EntityRef | null;
  location_type?: string;
  delivery_point: EntityRef | null;
  delivery_date: string | null;
  product_sku?: string;
  product: EntityRef | null;
  inventory_unit: EntityRef | null;
  description: string | null;
  comment: string | null;
  vendor: EntityRef | null;
  pricelist_detail: EntityRef | null;
  pricelist_no: string | null;
  pricelist_unit: string | null;
  pricelist_price: number;
  pricelist_type: string;
  currency: EntityRef | null;
  currency_decimal_places?: number;
  exchange_rate: number;
  exchange_rate_date: string | null;
  requested_qty: number;
  requested_unit: EntityRef | null;
  approved_qty: number;
  approved_unit: EntityRef | null;
  foc_qty: number;
  foc_unit: EntityRef | null;
  unit_price: number;
  state_status: string;
  current_stage_status: string;
  state_message: string | null;
  info: Record<string, unknown>;
  dimension: unknown[];
  history?: PrItemHistoryEntry[];
  doc_version: number;
}

interface PrItemHistoryEntry {
  at: string;
  seq: number;
  name: string;
  user: { id: string; name: string };
  status: string;
  message?: string | null;
}

export interface PurchaseRequestTemplateDetail
  extends TaxFields, DiscountFields {
  id: string;
  purchase_request_template: EntityRef | null;
  location: EntityRef | null;
  location_type?: string;
  delivery_point: EntityRef | null;
  product_sku?: string | null;
  product: EntityRef | null;
  inventory_unit: EntityRef | null;
  description: string | null;
  comment: string | null;
  currency: EntityRef | null;
  exchange_rate: number;
  exchange_rate_date: string | null;
  requested_qty: number;
  requested_unit: EntityRef | null;
  requested_unit_conversion_factor: number;
  requested_base_qty: number;
  foc_qty: number;
  foc_unit: EntityRef | null;
  foc_unit_conversion_factor: number;
  foc_base_qty: number;
  base_tax_amount: number;
  base_discount_amount: number;
  is_active: boolean;
  info: Record<string, unknown>;
  dimension: unknown[];
  doc_version: number;
}

export interface PurchaseRequestTemplate {
  id: string;
  name: string;
  description: string;
  // ยืนยันจาก payload จริง (findOne) ว่า header มีแค่ workflow — ไม่มี department
  // เลย (ของเดิม department_id/department_name เป็นฟิลด์ที่ไม่เคยมีจริงบน wire)
  workflow: EntityRef | null;
  info: Record<string, unknown>;
  is_active: boolean;
  doc_version?: number;
  audit?: Audit;
  purchase_request_template_detail: PurchaseRequestTemplateDetail[];
}

export interface WorkflowHistoryEntry {
  user: { id: string; name: string };
  action: string;
  /**
   * ของจริงที่ API ส่งมาคือ `at` — `datetime` ประกาศไว้แต่ไม่เคยมีค่า ทำให้
   * ไทม์ไลน์ระดับเอกสารของ PR/PO ไม่โชว์วันเวลาเลยจนกว่าจะย้ายมาอ่าน `at`
   * (SR ประกาศเป็น `at` มาแต่แรกจึงโชว์ปกติ) — ประกาศทั้งคู่ไว้ก่อนจนกว่า
   * หลังบ้านจะเลือกชื่อเดียว
   */
  at?: string;
  datetime?: string;
  next_stage: string;
  current_stage?: string;
}

export interface PurchaseRequest {
  id: string;
  pr_no: string;
  pr_status: string;
  pr_date: string;
  expected_date: string;
  description: string;
  doc_status: PurchaseRequestStatus;
  role: string;
  stage_actions?: StageActionFlags | null;
  // list endpoint (`GET /api/purchase-requests`): แถวจริงอยู่ที่ `data[].data[]`
  // (multi-BU envelope) — `@CollapseRefs({'': PR_HEADER_REFS})` เดินจาก path ''
  // ไปไม่ถึงแถวที่ซ้อนอยู่ **บั๊กเดียวกับที่ CLAUDE.md เอกสารไว้กับ audit
  // enrichment** (`@EnrichAuditUsers()` เจอปัญหาเดียวกัน) ยืนยัน live 2/2 แถว
  // (2026-09-17): ยังเป็นคู่ flat `_id`/`_name` แบบเดิมทั้งคู่ ไม่มี object เลย
  workflow_id?: string;
  workflow_name?: string;
  workflow_current_stage: string;
  workflow_next_stage: string;
  workflow_previous_stage: string;
  workflow_history: WorkflowHistoryEntry[];
  last_action?: LastAction | null;
  // list: flat requestor_id/name, department_id/name (บั๊กเดียวกับ workflow ข้างบน)
  requestor_id?: string;
  requestor_name?: string;
  department_id?: string;
  department_name?: string;
  // detail endpoint (`GET /api/{bu}/purchase-requests/{id}`) เท่านั้น — object
  // จริง ยืนยัน live: ไม่มี requestor_id/department_name/workflow_id คู่กันเลย
  workflow?: EntityRef | null;
  requestor?: EntityRef | null;
  department?: EntityRef | null;
  // ยืนยันจาก payload จริง (findOne) ว่า header ไม่มี vendor เลย (ของเดิม
  // vendor_id/vendor_code/vendor_name เป็นฟิลด์ที่ไม่เคยมีจริงบน wire — vendor
  // อยู่ระดับ line item เท่านั้น ดู PurchaseRequestDetail.vendor)
  purchase_request_detail: PurchaseRequestDetail[];
  base_total_amount: number;
  info: Record<string, unknown>;
  dimension: string;
  doc_version: number;
  audit?: Audit;
}

// --- Zod runtime validation schema (for list API response) ---
const purchaseRequestDetailSummarySchema = z.looseObject({
  price: z.number(),
  total_price: z.number(),
});

export const purchaseRequestSchema = z.looseObject({
  id: z.string(),
  pr_no: z.string(),
  pr_date: z.string(),
  description: z.string(),
  requestor_name: z.string(),
  pr_status: z.string(),
  workflow_name: z.string(),
  workflow_current_stage: z.string(),
  workflow_next_stage: z.string().nullable(),
  workflow_previous_stage: z.string().nullable(),
  last_action: lastActionSchema.nullable(),
  department_name: z.string(),
  // ไม่ประกาศ created_at ทั้งที่ endpoint นี้ส่งมาจริง (ยืนยันด้วยการยิง API
  // 2026-08-04) เพราะเป็นผลจากบั๊ก backend: list ใช้ `@EnrichAuditUsers()` เปล่า
  // ซึ่ง enrich แค่ path `''` แต่แถวจริงอยู่ที่ `data[].data[]` interceptor จึง
  // ไปไม่ถึง — แถวเลยมี created_at ดิบค้างและ **ไม่มี `audit`** (ดู CLAUDE.md
  // "Known open items") พอ backend ใส่ paths ให้ถูก created_at จะหายไปเป็น audit
  // การประกาศไว้ตอนนี้จึงเท่ากับผูกโค้ดกับสภาพชั่วคราวที่กำลังจะถูกแก้
  purchase_request_detail: z
    .array(purchaseRequestDetailSummarySchema)
    .optional(),
});

export enum PR_ITEM_PRICELIST_COMPARE_TYPE {
  AUTOMATIC = "automatic",
  MANUAL_SELECT = "manual_select",
  MANUAL_INPUT = "manual_input",
}

export interface PrtDetailPayload {
  doc_version?: number;
  location_id: string | null;
  delivery_point_id: string | null;
  product_id: string | null;
  product_name: string;
  inventory_unit_id: string | null;
  inventory_unit_name: string;
  requested_qty: number;
  requested_unit_id: string | null;
  requested_unit_name: string;
  requested_unit_conversion_factor: number;
  requested_base_qty: number;
  currency_id: string | null;
}

export interface CreatePrtDto {
  name: string;
  description: string;
  workflow_id: string;
  is_active: boolean;
  purchase_request_template_detail: {
    add?: PrtDetailPayload[];
    update?: (PrtDetailPayload & { id: string })[];
    // หลังบ้าน PR template อ่าน `delete` — `remove` ถูก zod ตัดทิ้งเงียบ ๆ
    delete?: { id: string }[];
  };
}

export interface PurchaseRequestDetailPayload {
  doc_version?: number;
  product_id: string | null;
  description: string;
  current_stage_status: string;
  requested_qty: number;
  requested_unit_id: string | null;
  pricelist_price: number;
  vendor_id: string | null;
  pricelist_detail_id: string | null;
  location_id: string | null;
  delivery_point_id: string | null;
  delivery_date: string;
  currency_id: string | null;
  foc_qty: number;
  foc_unit_id: string | null;
  approved_qty: number;
  approved_unit_id: string | null;
  tax_profile_id?: string | null;
  tax_rate: number;
  tax_amount: number;
  is_tax_adjustment: boolean;
  discount_rate: number;
  discount_amount: number;
  is_discount_adjustment: boolean;
  net_amount: number;
  total_price: number;
  comment?: string;
}

export interface CreatePurchaseRequestDto {
  stage_role: string;
  details: {
    doc_version?: number;
    pr_date: string;
    description: string;
    requestor_id: string;
    workflow_id: string;
    department_id: string;
    purchase_request_detail: {
      add?: PurchaseRequestDetailPayload[];
      update?: (PurchaseRequestDetailPayload & { id: string })[];
      remove?: { id: string }[];
    };
  };
}

export interface WorkflowStageDetail {
  id: string;
  stage_status: string;
  stage_message: string;
}

export interface ApproveDetail {
  id: string;
  purchase_request_id?: string;
  stage_status: string;
  stage_message: string;
  approved_qty: number;
  approved_unit_id: string | null;
  vendor_id?: string | null;
  pricelist_detail_id?: string | null;
  pricelist_price?: number;
  pricelist_no?: string | null;
  pricelist_type?: string | null;
  currency_id?: string;
  delivery_point_id?: string | null;
  delivery_date?: string;
  location_id?: string | null;
  tax_profile_id?: string | null;
  tax_rate?: number;
  tax_amount?: number;
  is_tax_adjustment?: boolean;
  discount_rate?: number;
  discount_amount?: number;
  is_discount_adjustment?: boolean;
  net_amount?: number;
  total_price?: number;
  foc_qty?: number;
  foc_unit_id?: string | null;
}

export interface PurchaseApproveDetail {
  id: string;
  purchase_request_id?: string;
  stage_status: string;
  stage_message: string | null;
  is_tax_adjustment: boolean;
  description?: string | null;
  approved_qty: number;
  approved_unit_id: string | null;
  approved_base_qty?: number;
  approved_unit_conversion_factor?: number;
  vendor_id?: string | null;
  currency_id?: string | null;
  exchange_rate?: number;
  exchange_rate_date?: string | null;
  tax_profile_id?: string | null;
  tax_profile_name?: string | null;
  tax_rate: number;
  tax_amount: number;
  base_tax_amount?: number;
  // ไม่มี total_amount / foc_unit_conversion_rate — zod ของ backend รับ แต่ column
  // ไม่มีจริง (foc ใช้ชื่อ ..._factor) ส่งไปแล้ว Prisma ตีกลับทั้ง payload
  discount_rate: number;
  discount_amount: number;
  is_discount_adjustment: boolean;
  base_discount_amount?: number;
  total_price: number;
  sub_total_price: number;
  net_amount: number;
  base_sub_total_price?: number;
  base_total_price?: number;
  base_net_amount?: number;
  base_price?: number;
  foc_qty: number;
  foc_unit_id?: string | null;
  foc_base_qty?: number;
  pricelist_detail_id?: string | null;
  pricelist_no?: string | null;
  pricelist_price?: number;
  pricelist_type?: string | null;
  current_stage_status?: string;
}

export interface PrActionPayload {
  id: string;
  stage_role: string;
  doc_version?: number;
  details: (WorkflowStageDetail | ApproveDetail | PurchaseApproveDetail)[];
  des_stage?: string;
}

export interface SplitActionDto {
  id: string;
  detail_ids: string[];
}
