import type { Audit } from "@/types/audit";
import type { EntityRef } from "@/types/entity-ref";

export type PriceListStatus =
  | "draft"
  | "submitted"
  | "active"
  | "inactive"
  | "voided";

export interface PriceListActiveVendor {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface PriceListDetailItem {
  id: string;
  sequence_no: number;
  product: EntityRef | null;
  product_sku?: string;
  unit: EntityRef | null;
  moq_qty: number;
  price: number;
  price_without_tax: number;
  tax_profile: EntityRef | null;
  tax_rate: number;
  tax_amt: number;
  lead_time_days: number;
  is_preferred: boolean;
  is_active: boolean;
  description: string | null;
  note: string | null;
  info: Record<string, unknown>;
  dimension: unknown[];
  can_use?: boolean;
  doc_version?: number;
}

type PriceListAudit = Audit;

export interface PriceList {
  id: string;
  no: string;
  name: string;
  status: PriceListStatus;
  description: string;
  vendor: EntityRef | null;
  // backend GET-by-id returns only { id, code } — name is not sent
  currency: EntityRef | null;
  effectivePeriod: string;
  note: string;
  void_reason?: string | null;
  voided_at?: string | null;
  voided_by_id?: string | null;
  pricelist_detail: PriceListDetailItem[];
  can_use?: boolean;
  doc_version?: number;
  audit?: PriceListAudit;
}

export interface CreatePriceListDto {
  vendor_id: string;
  name: string;
  description: string;
  status: PriceListStatus;
  currency_id: string;
  effective_from_date: string;
  effective_to_date: string;
  note: string;
  pricelist_detail: {
    add?: {
      sequence_no: number;
      product_id: string;
      price: number;
      price_without_tax: number;
      unit_id: string;
      tax_profile_id: string;
      tax_rate: number;
      tax_amt: number;
      lead_time_days: number;
      moq_qty: number;
      is_preferred: boolean;
    }[];
    update?: {
      id: string;
      sequence_no: number;
      product_id: string;
      price: number;
      price_without_tax: number;
      unit_id: string;
      tax_profile_id: string;
      tax_rate: number;
      tax_amt: number;
      lead_time_days: number;
      moq_qty: number;
      is_preferred: boolean;
    }[];
    // หลังบ้านรับ `delete` เป็น array ของ id (string) — `remove` ถูก zod ตัดทิ้งเงียบ ๆ
    delete?: string[];
  };
}
