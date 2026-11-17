import type { Audit } from "./audit";
import type { EntityRef } from "./entity-ref";
import type { DimensionPayload, DimensionRef } from "./gl-dimension";

export type InventoryAdjustmentType = "stock-in" | "stock-out";
export type InventoryAdjustmentStatus =
  | "in_progress"
  | "completed"
  | "draft"
  | "voided";

export const INVENTORY_ADJUSTMENT_BASE_PATH =
  "/inventory-management/inventory-adjustment";

export const getAdjustmentType = (
  item: Pick<InventoryAdjustment, "si_no">,
): InventoryAdjustmentType => (item.si_no ? "stock-in" : "stock-out");

interface InventoryAdjustmentDetail {
  id: string;
  sequence_no: number;
  product: EntityRef | null;
  product_sku: string;
  description: string | null;
  qty: number;
  /**
   * หน่วยนับ — endpoint รายละเอียดคืนเป็น object ส่วน endpoint list คืนเป็น
   * flat string (แบบเดียวกับ product ดู types/product.ts) จึงประกาศไว้ทั้งสองทาง
   * และตอนอ่านต้อง fallback ให้ครบ ไม่งั้นคอลัมน์ Unit ว่างเปล่า
   */
  inventory_unit?: EntityRef;
  inventory_unit_name?: string;
  /**
   * ใบจ่ายออก (stock-out) ไม่เคยส่งสองฟิลด์นี้กลับมาจนถึง backend #727 — ประกาศเป็น number
   * บังคับทำให้ฟอร์มเอา undefined ไปคูณจน Total เป็น NaN แล้วกด Save ไม่ไป (e2e SO.2/SO.3)
   * หลัง #727: ใบที่ commit แล้ว = ต้นทุนที่บัญชีโพสต์ · ใบร่าง = 0 (ต้นทุนของร่างเป็นค่าประมาณ)
   */
  cost_per_unit?: number;
  total_cost?: number;
  doc_version?: number;
  /** เฉพาะ GET รายตัวที่คืนมา */
  dimensions?: DimensionRef[];
  info: unknown;
}

export interface InventoryAdjustment {
  id: string;
  si_no?: string;
  so_no?: string;
  si_date?: string;
  so_date?: string;
  description: string;
  // list endpoint (`/inventory-adjustments`, used by useInventoryAdjustment) — controller
  // ไม่มี @CollapseRefs เลย (ยืนยันจาก live 20/20 แถว: flat ทุกแถว ไม่มี object เลย
  // ต่างจาก stock-ins/stock-outs' own findOne ที่แปลงแล้ว) คงไว้ flat ตามจริง
  adjustment_type_id: string;
  adjustment_type_code: string;
  adjustment_type_name: string;
  doc_status: InventoryAdjustmentStatus;
  doc_version: number;
  location_id?: string;
  location_name?: string;
  // stock-ins/{id} · stock-outs/{id} เท่านั้น (ยืนยันจาก live) — ยังไม่มี call site
  // ในแอปอ่านผ่าน field นี้จริง ประกาศไว้เผื่ออนาคต ไม่บังคับใคร
  adjustment_type?: EntityRef | null;
  location?: EntityRef | null;
  stock_in_detail?: InventoryAdjustmentDetail[];
  stock_out_detail?: InventoryAdjustmentDetail[];
  item_count?: number;
  base_total_cost: number;
  // list/detail response omit raw created/updated fields — gateway enrich เป็น audit object
  audit?: Audit;
}

export interface AdjustmentDetailItemPayload {
  doc_version?: number;
  product_id: string;
  qty: number;
  cost_per_unit: number;
  total_cost: number;
  description: string;
  dimensions?: DimensionPayload[];
}

interface AdjustmentDetailPayload {
  add?: AdjustmentDetailItemPayload[];
  update?: (AdjustmentDetailItemPayload & { id: string })[];
  remove?: { id: string }[];
}

export interface CreateInventoryAdjustmentDto {
  description: string;
  doc_status: string;
  adjustment_type_id: string;
  si_date?: string;
  so_date?: string;
  location_id: string;
  stock_in_detail?: AdjustmentDetailPayload;
  stock_out_detail?: AdjustmentDetailPayload;
}
