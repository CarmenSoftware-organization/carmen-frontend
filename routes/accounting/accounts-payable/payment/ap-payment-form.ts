import type {
  ApOutstandingDocument,
  ApOutstandingLine,
  ApPayment,
  ApPaymentInput,
  ApPaymentMethod,
  ApWhtPreviewRow,
  DecimalString,
} from "@/types/accounts-payable";
import {
  addDecimal,
  compareDecimal,
  subtractDecimal,
} from "../shared/ap-decimal";
import { todayYmd, toYmd } from "../invoice/ap-invoice-form";
import { paymentSummary } from "./ap-payment-totals";

export { todayYmd, ymdToPickerValue } from "../invoice/ap-invoice-form";

export const PAYMENT_METHODS: ApPaymentMethod[] = [
  "bank_transfer",
  "cheque",
  "cash",
  "credit_card",
  "promptpay",
];

export interface PaymentWhtRow {
  key: string;
  wht_tax_profile_id: string;
  name: string;
  pnd_form?: string | null;
  rate: DecimalString;
  base_amount: DecimalString;
  wht_amount: DecimalString;
  is_override: boolean;
}

export interface PaymentExpenseRow {
  key: string;
  chart_of_accounts_id: string | null;
  cost_center_id: string | null;
  description: string;
  amount: DecimalString;
}

export interface PaymentForm {
  vendor_id: string;
  vendor_name: string;
  /** YYYY-MM-DD */
  payment_date: string;
  paid_date: string;
  bank_account_id: string;
  payment_method: ApPaymentMethod;
  cheque_no: string;
  cheque_date: string;
  reference_no: string;
  description: string;
  /** ว่าง = ให้ backend หาอัตราของวันที่จ่าย */
  exchange_rate: DecimalString;
  /** ยอดจ่ายต่อบรรทัด invoice (key = ap_invoice_detail_id) เป็นค่าสัมบูรณ์ — เครื่องหมายใส่ตอนส่ง */
  allocations: Record<string, DecimalString>;
  wht: PaymentWhtRow[];
  expenses: PaymentExpenseRow[];
}

export type PaymentErrorKey =
  | "vendor"
  | "paymentDate"
  | "bank"
  | "exchangeRate"
  | "allocations"
  | "overAllocated"
  | "whtAmount"
  | "expense"
  | "netPositive";

const newKey = (): string => crypto.randomUUID();

export const emptyExpense = (): PaymentExpenseRow => ({
  key: newKey(),
  chart_of_accounts_id: null,
  cost_center_id: null,
  description: "",
  amount: "",
});

const isPositive = (value: DecimalString): boolean =>
  !!value.trim() && compareDecimal(value, "0") > 0;

/** บรรทัด credit note จ่ายเป็นยอดติดลบ — ที่เหลือบวก (ตรงกับ validation ฝั่ง backend) */
export const allocationSign = (docType: string): 1 | -1 =>
  docType === "credit_note" ? -1 : 1;

export function signedAmount(
  docType: string,
  magnitude: DecimalString,
): DecimalString {
  return allocationSign(docType) < 0
    ? subtractDecimal("0", magnitude)
    : addDecimal([magnitude]);
}

/** ผลรวมยอดจ่ายของใบนี้ (มีเครื่องหมาย) = ผลรวมของบรรทัด */
export function invoiceAllocated(
  doc: ApOutstandingDocument,
  allocations: Readonly<Record<string, DecimalString>>,
): DecimalString {
  const total = addDecimal(
    doc.lines.map((l) => allocations[l.ap_invoice_detail_id] || "0"),
  );
  return allocationSign(doc.doc_type) < 0 ? subtractDecimal("0", total) : total;
}

export function initialPaymentForm(
  loaded: ApPayment | null | undefined,
  defaults: { vendorId?: string } = {},
): PaymentForm {
  if (!loaded) {
    return {
      vendor_id: defaults.vendorId ?? "",
      vendor_name: "",
      payment_date: todayYmd(),
      paid_date: "",
      bank_account_id: "",
      payment_method: "bank_transfer",
      cheque_no: "",
      cheque_date: "",
      reference_no: "",
      description: "",
      exchange_rate: "",
      allocations: {},
      wht: [],
      expenses: [],
    };
  }
  return {
    vendor_id: loaded.vendor_id,
    vendor_name: loaded.vendor_name,
    payment_date: toYmd(loaded.payment_date),
    paid_date: toYmd(loaded.paid_date),
    bank_account_id: loaded.bank_account_id,
    payment_method: loaded.payment_method,
    cheque_no: loaded.cheque_no ?? "",
    cheque_date: toYmd(loaded.cheque_date),
    reference_no: loaded.reference_no ?? "",
    description: loaded.description ?? "",
    exchange_rate: loaded.exchange_rate,
    allocations: Object.fromEntries(
      (loaded.allocations ?? []).map((a) => [
        a.ap_invoice_detail_id,
        // เก็บเป็นค่าสัมบูรณ์ (credit note ใน backend เป็นค่าลบ)
        a.applied_amount.startsWith("-")
          ? a.applied_amount.slice(1)
          : a.applied_amount,
      ]),
    ),
    wht: (loaded.wht ?? []).map((w) => ({
      key: w.id,
      wht_tax_profile_id: w.wht_tax_profile_id,
      name: w.wht_tax_profile_name,
      pnd_form: w.pnd_form,
      rate: w.wht_rate,
      base_amount: w.base_amount,
      wht_amount: w.wht_amount,
      is_override: w.is_override,
    })),
    expenses: (loaded.expenses ?? []).map((e) => ({
      key: e.id,
      chart_of_accounts_id: e.chart_of_accounts_id,
      cost_center_id: e.cost_center_id,
      description: e.description ?? "",
      amount: e.amount,
    })),
  };
}

/**
 * เพดานต่อบรรทัด = available_amount จาก outstanding-documents
 * + ยอดที่ใบนี้จองไว้เองก่อนหน้า (backend นับการจองของทุกใบ draft/in_review รวมใบที่กำลังแก้ แต่ตอนบันทึก
 * ไม่นับใบตัวเอง จึงต้องบวกคืนไม่งั้นแก้ draft เดิมแล้วติดเพดานตัวเอง)
 */
export function lineCap(
  line: ApOutstandingLine,
  ownReserved: Readonly<Record<string, DecimalString>>,
): DecimalString {
  const own = ownReserved[line.ap_invoice_detail_id] ?? "0";
  const cap = addDecimal([line.available_amount, own]);
  return compareDecimal(cap, "0") < 0 ? "0.00" : cap;
}

/** (lineId → { docType, currency }) ของบรรทัดที่เลือกจ่ายแล้ว (ยอด > 0) */
export function allocatedLines(
  docs: readonly ApOutstandingDocument[],
  allocations: Readonly<Record<string, DecimalString>>,
) {
  const rows: {
    doc: ApOutstandingDocument;
    line: ApOutstandingLine;
    amount: DecimalString;
  }[] = [];
  for (const doc of docs)
    for (const line of doc.lines) {
      const amount = allocations[line.ap_invoice_detail_id];
      if (amount && isPositive(amount)) rows.push({ doc, line, amount });
    }
  return rows;
}

/** รายการจ่ายที่ส่งให้ backend / wht-preview: มีเครื่องหมายตามชนิดเอกสาร */
export function toAllocationInputs(
  docs: readonly ApOutstandingDocument[],
  allocations: Readonly<Record<string, DecimalString>>,
  loaded?: ApPayment | null,
) {
  const rows = allocatedLines(docs, allocations).map(({ line, amount }) => ({
    ap_invoice_detail_id: line.ap_invoice_detail_id,
    applied_amount: signedAmount(line.doc_type, amount),
  }));
  const seen = new Set(rows.map((r) => r.ap_invoice_detail_id));
  // บรรทัดที่ใบเดิมจ่ายไว้แต่ไม่อยู่ในรายการค้างจ่ายแล้ว (เช่น ปิดบรรทัดไปแล้ว) ส่งตามเดิม ไม่ทิ้งเงียบ
  for (const a of loaded?.allocations ?? []) {
    const amount = allocations[a.ap_invoice_detail_id];
    if (seen.has(a.ap_invoice_detail_id) || !amount || !isPositive(amount))
      continue;
    rows.push({
      ap_invoice_detail_id: a.ap_invoice_detail_id,
      applied_amount: signedAmount(a.doc_type, amount),
    });
  }
  return rows;
}

export function mergeWhtPreview(
  current: readonly PaymentWhtRow[],
  preview: readonly ApWhtPreviewRow[],
  keepOverrides: boolean,
): PaymentWhtRow[] {
  return preview.map((row) => {
    const existing = keepOverrides
      ? current.find(
          (c) =>
            c.wht_tax_profile_id === row.wht_tax_profile_id && c.is_override,
        )
      : undefined;
    return {
      key: existing?.key ?? newKey(),
      wht_tax_profile_id: row.wht_tax_profile_id,
      name: row.wht_tax_profile_name,
      pnd_form: row.pnd_form,
      rate: row.wht_rate,
      base_amount: row.base_amount,
      wht_amount: existing ? existing.wht_amount : row.wht_amount,
      is_override: !!existing,
    };
  });
}

export function formTotals(
  allocations: readonly { applied_amount: DecimalString }[],
  form: Pick<PaymentForm, "wht" | "expenses">,
) {
  return paymentSummary({
    allocations: allocations.map((a) => a.applied_amount),
    wht: form.wht.map((w) => w.wht_amount || "0"),
    expenses: form.expenses.map((e) => e.amount || "0"),
  });
}

export function validatePaymentForm(
  form: PaymentForm,
  mode: "create" | "update",
  allocationInputs: readonly { applied_amount: DecimalString }[],
  overCap: boolean,
): Set<PaymentErrorKey> {
  const errors = new Set<PaymentErrorKey>();
  if (mode === "create" && !form.vendor_id) errors.add("vendor");
  if (!form.payment_date) errors.add("paymentDate");
  if (!form.bank_account_id) errors.add("bank");
  if (form.exchange_rate.trim() && !isPositive(form.exchange_rate))
    errors.add("exchangeRate");
  if (allocationInputs.length === 0) errors.add("allocations");
  if (overCap) errors.add("overAllocated");
  if (form.wht.some((w) => !w.wht_amount.trim())) errors.add("whtAmount");
  if (
    form.expenses.some((e) => !e.chart_of_accounts_id || !isPositive(e.amount))
  )
    errors.add("expense");
  if (
    allocationInputs.length > 0 &&
    compareDecimal(formTotals(allocationInputs, form).net, "0") <= 0
  )
    errors.add("netPositive");
  return errors;
}

export function toPaymentInput(
  form: PaymentForm,
  allocations: ReturnType<typeof toAllocationInputs>,
): ApPaymentInput {
  const cheque = form.payment_method === "cheque";
  return {
    vendor_id: form.vendor_id,
    payment_date: form.payment_date,
    paid_date: form.paid_date || null,
    bank_account_id: form.bank_account_id,
    payment_method: form.payment_method,
    cheque_no: cheque ? form.cheque_no.trim() || null : null,
    cheque_date: cheque ? form.cheque_date || null : null,
    reference_no: form.reference_no.trim() || null,
    description: form.description.trim() || null,
    exchange_rate: form.exchange_rate.trim() || undefined,
    allocations,
    wht: form.wht.map((w) => ({
      wht_tax_profile_id: w.wht_tax_profile_id,
      base_amount: w.base_amount || "0",
      wht_amount: w.wht_amount || "0",
      is_override: w.is_override,
    })),
    expenses: form.expenses.map((e) => ({
      chart_of_accounts_id: e.chart_of_accounts_id as string,
      cost_center_id: e.cost_center_id,
      description: e.description.trim() || null,
      amount: e.amount,
    })),
  };
}
