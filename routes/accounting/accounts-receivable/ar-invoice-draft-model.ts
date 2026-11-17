import { toDimensionPayload } from "@/lib/dimension-payload";
import type { DimensionRef } from "@/types/gl-dimension";
export type ArAmount = number | string;

export interface ArInvoiceLineInput {
  sequence_no: number;
  group_no?: number | null;
  description?: string | null;
  reference_info?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  unit_id?: string | null;
  unit_name?: string | null;
  quantity: ArAmount;
  unit_price: ArAmount;
  discount_pct?: ArAmount | null;
  discount_amount?: ArAmount | null;
  discount_is_override?: boolean;
  cr_chart_of_accounts_id: string;
  cr_cost_center_id: string;
  vat_tax_profile_id?: string | null;
  vat_amount?: ArAmount | null;
  vat_is_override?: boolean;
  vat_chart_of_accounts_id?: string | null;
  vat_cost_center_id?: string | null;
  tax2_tax_profile_id?: string | null;
  tax2_amount?: ArAmount | null;
  tax2_is_override?: boolean;
  tax2_chart_of_accounts_id?: string | null;
  tax2_cost_center_id?: string | null;
  dr_chart_of_accounts_id?: string | null;
  dr_cost_center_id?: string | null;
  is_pms_folio?: boolean;
  dimensions?: DimensionRef[];
}

export interface ArDraftLine extends ArInvoiceLineInput {
  id: string;
  cr_account_code?: string | null;
  dr_account_code?: string | null;
  cr_cost_center_code?: string | null;
  dr_cost_center_code?: string | null;
  vat_account_code?: string | null;
  vat_cost_center_code?: string | null;
  tax2_account_code?: string | null;
  tax2_cost_center_code?: string | null;
  vat_rate?: ArAmount;
  tax2_rate?: ArAmount;
  vat_profile_name?: string;
  tax2_profile_name?: string;
}

export interface ArInvoiceLineRecord extends Omit<ArDraftLine, "dimensions"> {
  total_amount: ArAmount;
  tb_ar_invoice_detail_dimension?: DimensionRef[];
}

export interface ArInvoiceCreateInput {
  doc_type: "invoice";
  doc_date: string;
  customer_id: string;
  description: string | null;
  credit_term_days?: number;
  currency_id?: string | null;
  exchange_rate?: ArAmount;
  source_doc_ref?: string | null;
  is_tax_invoice?: boolean;
  is_wht_recorded?: boolean;
  wht_amount?: ArAmount;
  references?: ArInvoiceReferenceInput[];
  details: { add: ArInvoiceLineInput[] };
}

export interface ArInvoiceReferenceInput {
  ref_ar_invoice_id: string;
  applied_amount: ArAmount;
  remarks?: string | null;
}

export interface ArInvoiceUpdateInput extends Partial<
  Omit<ArInvoiceCreateInput, "doc_type">
> {
  doc_version: number;
}

export function arLineAmounts(line: ArDraftLine) {
  const subtotal = round2(
    Number(line.quantity || 0) * Number(line.unit_price || 0),
  );
  const discount = round2(
    line.discount_is_override
      ? Number(line.discount_amount || 0)
      : (subtotal * Number(line.discount_pct || 0)) / 100,
  );
  const net = round2(subtotal - discount);
  const vat = round2(
    line.vat_is_override
      ? Number(line.vat_amount || 0)
      : (net * Number(line.vat_rate || 0)) / 100,
  );
  const tax2 = round2(
    line.tax2_is_override
      ? Number(line.tax2_amount || 0)
      : (net * Number(line.tax2_rate || 0)) / 100,
  );
  return {
    subtotal,
    discount,
    net,
    vat,
    tax2,
    total: round2(net + vat + tax2),
  };
}

export function arLineBaseTotal(line: ArDraftLine, rate: number) {
  const amount = arLineAmounts(line);
  return round2(
    round2(amount.subtotal * rate) -
      round2(amount.discount * rate) +
      round2(amount.vat * rate) +
      round2(amount.tax2 * rate),
  );
}

export function newArDraftLine(sequence: number): ArDraftLine {
  return {
    id: crypto.randomUUID(),
    sequence_no: sequence,
    group_no: 1,
    quantity: 1,
    unit_price: "",
    cr_chart_of_accounts_id: "",
    cr_cost_center_id: "",
  };
}

export function draftLineFromRecord(record: ArInvoiceLineRecord): ArDraftLine {
  return {
    ...record,
    dimensions: record.tb_ar_invoice_detail_dimension,
  };
}

export function draftLineToInput(line: ArDraftLine): ArInvoiceLineInput {
  // PUT replaces the line set. Keep the fields that aren't editable in this form.
  return {
    sequence_no: line.sequence_no,
    group_no: line.group_no,
    description: line.description,
    reference_info: line.reference_info,
    date_from: line.date_from,
    date_to: line.date_to,
    unit_id: line.unit_id,
    unit_name: line.unit_name,
    quantity: line.quantity,
    unit_price: line.unit_price,
    discount_pct: line.discount_pct,
    discount_amount: line.discount_amount,
    discount_is_override: line.discount_is_override,
    cr_chart_of_accounts_id: line.cr_chart_of_accounts_id,
    cr_cost_center_id: line.cr_cost_center_id,
    vat_tax_profile_id: line.vat_tax_profile_id,
    vat_amount: line.vat_amount,
    vat_is_override: line.vat_is_override,
    vat_chart_of_accounts_id: line.vat_chart_of_accounts_id,
    vat_cost_center_id: line.vat_cost_center_id,
    tax2_tax_profile_id: line.tax2_tax_profile_id,
    tax2_amount: line.tax2_amount,
    tax2_is_override: line.tax2_is_override,
    tax2_chart_of_accounts_id: line.tax2_chart_of_accounts_id,
    tax2_cost_center_id: line.tax2_cost_center_id,
    dr_chart_of_accounts_id: line.dr_chart_of_accounts_id,
    dr_cost_center_id: line.dr_cost_center_id,
    is_pms_folio: line.is_pms_folio,
    dimensions: line.dimensions && toDimensionPayload(line.dimensions),
  };
}
