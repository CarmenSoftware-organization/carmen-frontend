import type { EntityRef } from "./entity-ref";
import type { Audit } from "./audit";

export enum ACCOUNT_NATURE {
  DEBIT = "debit",
  CREDIT = "credit",
}

/**
 * ประเภทของบัญชีในผัง — `header` ไม่ใช่บัญชีที่ลงรายการได้ เป็นหัวข้อไว้จัดกลุ่ม
 * ส่วนอีกสามตัวคือบัญชีที่ยอดไปโผล่ในงบนั้น ๆ (`statistic` = ตัวเลขสถิติ ไม่เข้างบ)
 */
export enum CHART_OF_ACCOUNT_TYPE {
  HEADER = "header",
  BALANCE_SHEET = "balance_sheet",
  INCOME_STATEMENT = "income_statement",
  STATISTIC = "statistic",
  SUMMARY = "summary",
}

export const ACCOUNT_CATEGORIES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
  "statistic",
] as const;
export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number];

/** Subledger that owns a control account. Manual JV lines must not use owned accounts. */
export type CONTROL_ACCOUNT_TYPE =
  | "accounts_payable"
  | "accounts_receivable"
  | "inventory"
  | "cash"
  | "tax"
  | "other";

export const ACCOUNT_NATURES = [
  ACCOUNT_NATURE.DEBIT,
  ACCOUNT_NATURE.CREDIT,
] as const;

export const CHART_OF_ACCOUNT_TYPES = [
  CHART_OF_ACCOUNT_TYPE.HEADER,
  CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
  CHART_OF_ACCOUNT_TYPE.INCOME_STATEMENT,
  CHART_OF_ACCOUNT_TYPE.STATISTIC,
  CHART_OF_ACCOUNT_TYPE.SUMMARY,
] as const;

export interface ChartOfAccount {
  id: string;
  doc_version: number;
  code: string;
  description_1: string;
  description_2?: string | null;
  nature: ACCOUNT_NATURE;
  type: CHART_OF_ACCOUNT_TYPE;
  /** null = บัญชีที่มีอยู่ก่อน migration gl_core_master (9 ก.ย.) เพิ่มคอลัมน์โดยไม่ backfill — backend บังคับให้ระบุตอนแก้ครั้งถัดไป */
  category: AccountCategory | null;
  is_active: boolean;
  control_account_type?: CONTROL_ACCOUNT_TYPE | null;
  manual_posting_allowed?: boolean;
  allowed_source_types?: string[];
  account_group?: EntityRef | null;
  account_group_id?: string | null;
  allowed_dimensions?: string[] | null;
  dimension_required?: boolean;
  current_balance?: number | string | null;
  is_used?: boolean;
  attributes?: Record<string, string> | null;
  allowed_departments?: string[] | null;
  department_required?: boolean;
  grouping_path?: Array<{ code: string; name: string; level: number }> | null;
  group_level?: number | null;
  group_code?: string | null;
  audit?: Audit;
}

export interface CreateChartOfAccountDto {
  doc_version?: number;
  code: string;
  description_1: string;
  description_2?: string | null;
  nature: ACCOUNT_NATURE;
  type: CHART_OF_ACCOUNT_TYPE;
  category: AccountCategory;
  is_active: boolean;
  control_account_type?: CONTROL_ACCOUNT_TYPE | null;
  manual_posting_allowed?: boolean;
  allowed_source_types?: string[];
  account_group_id?: string | null;
  allowed_dimensions?: string[] | null;
  dimension_required?: boolean;
  current_balance?: number | string | null;
  attributes?: Record<string, string> | null;
  allowed_departments?: string[] | null;
  department_required?: boolean;
  grouping_path?: Array<{ code: string; name: string; level: number }> | null;
}
