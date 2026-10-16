import type { AccountCategory } from "@/types/chart-of-accounts";

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
  effective_from?: string | null;
  effective_to?: string | null;
  is_active: boolean;
  doc_version: number;
}

export type DimensionDataType = "string" | "number" | "date" | "lookup" | "boolean";
export type DimensionDateFormat = "DD/MM/YYYY" | "YYYY-MM-DD" | "DD-MMM-YYYY";

export interface DimensionMaster {
  data_type?: DimensionDataType;
  date_format?: DimensionDateFormat;
  id: string;
  code: string;
  name: string;
  name_local?: string | null;
  sequence: number;
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

export interface PaymentTypeMaster {
  id: string;
  code: string;
  description: string;
  description_local?: string | null;
  payment_method: string;
  is_active: boolean;
  doc_version: number;
}

export interface WhtServiceTypeMaster {
  id: string;
  code: string;
  description: string;
  default_rate: string;
  is_active: boolean;
  doc_version: number;
}

export interface WhtFormMaster {
  id: string;
  code: string;
  description: string;
  gl_account_id?: string | null;
  cost_center_id?: string | null;
  dimension_value_id?: string | null;
  is_active: boolean;
  doc_version: number;
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
