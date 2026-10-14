import type { Audit } from "./audit";
import type { DeliveryPoint } from "@/types/delivery-point";
import type { TransferPayload } from "@/types/transfer";
import type { INVENTORY_TYPE } from "@/constant/location";

export type { DeliveryPoint };

export type PhysicalCountType = "yes" | "no";

interface UserLocation {
  id: string;
  firstname: string;
  lastname: string;
  middlename: string | null;
  telephone: string;
}

export interface ProductLocation {
  id: string;
  name: string | null;
  code: string | null;
  /** จาก backend (GET location by id) — ก่อน backend deploy จะไม่มี */
  local_name?: string | null;
  inventory_unit?: { id: string; name?: string | null } | null;
  min_qty: number | null;
  max_qty: number | null;
  re_order_qty: number | null;
  par_qty: number | null;
}

export interface WorkflowProductLocationRaw {
  location_id: string;
  location_code: string;
  location_name: string;
  location_type: INVENTORY_TYPE;
  is_active: boolean;
}

export interface LocationOption {
  id: string;
  code: string;
  name: string;
  location_type: INVENTORY_TYPE;
  is_active?: boolean;
}

export interface Location {
  id: string;
  doc_version: number;
  code: string;
  name: string;
  location_type: INVENTORY_TYPE;
  physical_count_type: PhysicalCountType;
  delivery_point_name?: string;
  description: string;
  is_active: boolean;
  info: Record<string, string | number | boolean>;
  user_location: UserLocation[];
  product_location: ProductLocation[];
  delivery_point: DeliveryPoint | null;
  cost_center_id?: string | null;
  audit?: Audit;
}

export interface CreateLocationDto {
  doc_version?: number;
  code: string;
  name: string;
  location_type: INVENTORY_TYPE;
  physical_count_type: PhysicalCountType;
  description: string;
  is_active: boolean;
  delivery_point_id?: string;
  delivery_point_name?: string;
  cost_center_id?: string | null;
  users: TransferPayload;
  products: TransferPayload;
}
