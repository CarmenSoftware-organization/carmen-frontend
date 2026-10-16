import type { Audit } from "./audit";

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  cost_center_group_id?: string | null;
  cost_center_group_code?: string | null;
  cost_center_group_name?: string | null;
  is_active?: boolean;
  note?: string | null;
  doc_version?: number;
  audit?: Audit;
}

export type CreateCostCenterDto = Omit<
  CostCenter,
  "id" | "doc_version" | "audit"
>;
