import type { DimensionRef } from "@/types/gl-dimension";
import type { AccountCategory } from "@/types/chart-of-accounts";
import type { Audit } from "./audit";

export interface TitleMaster {
  id: string;
  code: string;
  description: string;
  is_active: boolean;
  is_system: boolean;
  reference_count: number;
}

export interface AccountGroupMaster {
  id: string;
  code: string;
  name: string;
  name_local?: string | null;
  level: 1 | 2 | 3 | 4;
  parent_id: string | null;
  category: AccountCategory;
  sort_order: number;
  is_active: boolean;
  account_count: number;
  note?: string | null;
  doc_version: number;
}

export interface JvPrefixMaster {
  id: string;
  code: string;
  description: string;
  description_local?: string | null;
  is_default: boolean;
  is_system: boolean;
  is_active: boolean;
  doc_version: number;
}

export interface DimensionValueMaster {
  id: string;
  dimension_id: string;
  code: string;
  name: string;
  name_local?: string | null;
  /** อธิบายความหมายของ label (ไม่บังคับ) */
  description?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  is_active: boolean;
  doc_version: number;
}

export type DimensionDataType =
  "string" | "number" | "date" | "lookup" | "boolean";

export interface DimensionMaster {
  data_type?: DimensionDataType;
  id: string;
  code: string;
  name: string;
  name_local?: string | null;
  is_active: boolean;
  values?: DimensionValueMaster[];
  doc_version: number;
}

export interface BankAccountMaster {
  id: string;
  code?: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  branch_name?: string | null;
  gl_account_id?: string | null;
  currency_code: string;
  currency_id?: string;
  is_active: boolean;
  doc_version: number;
}

export interface GlPeriodMaster {
  id: string;
  fiscal_year: number;
  period_number: number;
  start_date: string;
  end_date: string;
  status: "open" | "closed" | "locked";
  doc_version: number;
}

export interface ApMasterBase {
  id: string;
  code: string;
  description: string;
  is_active: boolean;
  doc_version: number;
  is_used?: boolean;
  audit?: Audit;
}

export type ApMasterDimension = DimensionRef;

export interface ApMasterMapping {
  chart_of_accounts_id: string | null;
  cost_center_id?: string | null;
  account_code?: string | null;
  account_name?: string | null;
  cost_center_code?: string | null;
  cost_center_name?: string | null;
  dimensions: ApMasterDimension[];
}

export interface PaymentTypeMaster extends ApMasterBase, ApMasterMapping {
  chart_of_accounts_id: string;
  available_ap: boolean;
  available_ar: boolean;
  bank_account_id: string | null;
  bank_account_code?: string | null;
  bank_account_name?: string | null;
  is_cheque: boolean;
  cheque_form_id: string | null;
  cheque_form_name?: string | null;
}

export interface WhtServiceTypeMaster extends ApMasterBase {
  rate_percent: number | string;
}

export interface WhtFormMaster extends ApMasterBase, ApMasterMapping {}

export interface ApMasterDependencies {
  is_used: boolean;
  can_deactivate: boolean;
  can_delete: boolean;
  references: { type: string; count: number; names?: string[] }[];
}

export interface ApMasterAccountMapping {
  account: { id: string; code: string; name: string };
  is_require_cost_center: boolean;
  cost_centers: { id: string; code: string; name: string }[];
  dimensions: {
    dimension_id: string;
    code: string;
    name: string;
    requirement: "mandatory" | "optional" | "prohibited";
  }[];
  default_cost_center_id: string | null;
}

export interface AssetCategoryMaster {
  id: string;
  code: string;
  description: string;
  useful_life_years: number;
  depreciation_method: "straight_line" | "declining_balance";
  cost_account_id?: string | null;
  accum_dep_account_id?: string | null;
  dep_expense_account_id?: string | null;
  is_active: boolean;
  doc_version: number;
}
