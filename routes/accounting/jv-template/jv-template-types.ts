export type JvTemplateType = "recurring" | "allocation" | "amortize";
export type JvTemplateSide = "debit" | "credit";
export type JvAmortizeType = "day_in_month" | "monthly";

export interface JvTemplateLine {
  id?: string;
  sequence_no: number;
  chart_of_accounts_id: string;
  cost_center_id: string | null;
  description: string | null;
  debit: number;
  credit: number;
  side: JvTemplateSide | null;
  allocation_ratio: number | null;
  /** ไม่แสดงใน UI — เก็บไว้ส่งกลับเพื่อไม่ให้การบันทึกล้างค่าที่สร้างผ่าน API */
  dimension?: unknown;
  currency_id?: string | null;
  exchange_rate?: number | null;
}

export interface JvTemplate {
  id: string;
  doc_version: number;
  template_type: JvTemplateType;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  prefix_id: string;
  from_fiscal_year: number;
  from_period_no: number;
  to_fiscal_year: number;
  to_period_no: number;
  frequency_months: number | null;
  currency_id: string | null;
  exchange_rate: number | null;
  allocate_amount: number | null;
  amortize_type: JvAmortizeType | null;
  start_date: string | null;
  end_date: string | null;
  total_amount: number | null;
  note: string | null;
  /** `[]` บนแถวของ list — มีเฉพาะตอน get รายตัว */
  lines: JvTemplateLine[];
}

export type JvTemplateInput = Omit<
  JvTemplate,
  "id" | "doc_version" | "lines"
> & {
  lines: JvTemplateLine[];
};

export interface JvGenerateResult {
  jv_id: string;
  jv_no: string;
  gl_period_id: string;
  amount_total: number;
}

export interface JvGenerateAllResult {
  generated: { template_id: string; jv_id: string; jv_no: string }[];
  skipped: { template_id: string; reason: "already_run" | "not_due" }[];
  failed: { template_id: string; code: string }[];
}
