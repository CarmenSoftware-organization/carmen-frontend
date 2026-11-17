import type { LocationType } from "@/types/physical-count";

export type SpotCheckMethod = "random" | "high_value" | "manual";

interface CreateSpotCheckBase {
  location_id: string;
  description?: string;
  note?: string;
}

interface CreateRandomSpotCheckDto extends CreateSpotCheckBase {
  method: "random";
  items: number;
}

interface CreateHighValueSpotCheckDto extends CreateSpotCheckBase {
  method: "high_value";
  items: number;
  min_value: number;
}

interface CreateManualSpotCheckDto extends CreateSpotCheckBase {
  method: "manual";
  product_id: string[];
}

export type CreateSpotCheckDto =
  | CreateRandomSpotCheckDto
  | CreateHighValueSpotCheckDto
  | CreateManualSpotCheckDto;

interface SpotCheckSaveItem {
  id: string;
  actual_qty: number;
}

export interface SpotCheckSaveDto {
  doc_version?: number;
  items: SpotCheckSaveItem[];
}

export interface SpotCheckReviewItem {
  id: string;
  sequence_no: number;
  product_id: string;
  product_code: string;
  product_name: string;
  product_local_name: string;
  product_sku: string;
  inventory_unit_id: string;
  inventory_qty: number;
  actual_qty: number;
  diff_qty: number;
}

export interface SpotCheckReviewData {
  id: string;
  total: number;
  matched: number;
  variant: number;
  items: SpotCheckReviewItem[];
  doc_version?: number;
}

export type SpotCheckStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "void"
  | "voided"
  | "cancelled";

interface SpotCheckDetail {
  id: string;
  spot_check_id: string;
  sequence_no: number;
  product_id: string;
  product_code: string;
  product_name: string;
  product_local_name: string;
  product_sku: string;
  inventory_unit_id: string;
  on_hand_qty: number;
  actual_qty: number;
  diff_qty: number;
  counted_at: string | null;
  counted_by_id: string | null;
  description: string | null;
  note: string | null;
  comment: string | null;
  info: Record<string, unknown>;
  doc_version: number;
  tb_product?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface SpotCheck {
  id: string;
  spot_check_no: string;
  start_date: string;
  end_date: string | null;
  location_id: string;
  location_code: string;
  location_name: string;
  doc_status: SpotCheckStatus;
  method: SpotCheckMethod;
  size: number;
  description: string;
  note: string;
  info: Record<string, unknown>;
  doc_version: number;
  items?: number;
  min_value?: number;
  product_id?: string[];
  tb_location?: {
    id: string;
    name: string;
    code: string;
  };
  tb_spot_check_detail?: SpotCheckDetail[];
}

export interface SpotCheckLocationLatest {
  id: string;
  spot_check_no: string;
  doc_status: SpotCheckStatus;
  method: SpotCheckMethod;
  size: number;
  counted: number;
  start_date: string;
  end_date: string | null;
}

export interface SpotCheckLocation {
  location_id: string;
  code: string;
  name: string;
  location_type: LocationType;
  physical_count_type: "yes" | "no";
  spot_check_count: number;
  latest_spot_check: SpotCheckLocationLatest | null;
}

export interface SpotCheckCurrentResponse {
  data: SpotCheckLocation[];
  status: number;
  success: boolean;
  message: string;
  timestamp: string;
}
