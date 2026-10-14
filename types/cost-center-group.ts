import type { Audit } from "./audit";

export interface CostCenterGroup {
  id: string;
  doc_version?: number;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  note?: string | null;
  audit?: Audit;
}

export interface CreateCostCenterGroupDto {
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  note: string | null;
}
