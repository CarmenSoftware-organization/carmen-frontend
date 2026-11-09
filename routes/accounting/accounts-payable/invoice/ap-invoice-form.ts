import { isoToDateInput } from "@/lib/date-utils";
import type {
  ApDocType,
  ApInvoice,
  ApInvoiceInput,
  ApInvoiceLine,
  ApInvoiceLineInput,
  DecimalString,
} from "@/types/accounts-payable";
import {
  addDecimal,
  compareDecimal,
  divideDecimal,
  multiplyDecimal,
  percentOf,
  subtractDecimal,
} from "../shared/ap-decimal";

/** แถวรายการในฟอร์ม — ตัวเลขเป็น string (DecimalString) ตลอด */
export interface InvoiceFormLine {
  key: string;
  description: string;
  product_id: string | null;
  product_name: string | null;
  unit_id: string | null;
  unit_name: string | null;
  quantity: DecimalString;
  unit_price: DecimalString;
  /** ติ๊ก = unit_price เป็นราคารวม VAT แล้ว (ถอด VAT ออก ไม่บวกเพิ่ม) — ไม่ใช้กับ deposit */
  vat_is_included: boolean;
  discount_amount: DecimalString;
  dr_chart_of_accounts_id: string | null;
  /** รหัสบัญชี/cost center สำหรับโหมดอ่านอย่างเดียว (ไม่ส่งกลับ backend) */
  dr_account_code: string | null;
  dr_cost_center_id: string | null;
  dr_cost_center_code: string | null;
  vat_tax_profile_id: string | null;
  vat_rate: DecimalString;
  vat_is_override: boolean;
  /** ใช้เฉพาะเมื่อ vat_is_override (ค่าที่ backend คำนวณ/ผู้ใช้ override ไว้เดิม) */
  vat_amount: DecimalString;
  wht_tax_profile_id: string | null;
  wht_rate: DecimalString;
  /** เลข GRN ที่ใบนี้อ้างถึง (อ่านอย่างเดียว) */
  grn_no: string | null;
  grn_id: string | null;
  /** ฟิลด์ของบรรทัดเดิมที่ UI ไม่แก้ (dimension / cr_* / vat_* account / sources) — ส่งกลับตามเดิมตอน PUT; บรรทัดใหม่ไม่มี */
  carry: Pick<
    ApInvoiceLineInput,
    | "dimensions"
    | "sources"
    | "vat_chart_of_accounts_id"
    | "vat_cost_center_id"
    | "cr_chart_of_accounts_id"
    | "cr_cost_center_id"
  > | null;
}

export interface InvoiceForm {
  doc_type: ApDocType;
  /** YYYY-MM-DD */
  doc_date: string;
  vendor_id: string;
  vendor_name: string;
  vendor_invoice_no: string;
  /** YYYY-MM-DD */
  invoice_date: string;
  credit_term_id: string;
  credit_term_days: number;
  currency_id: string;
  currency_code: string;
  exchange_rate: DecimalString;
  description: string;
  lines: InvoiceFormLine[];
}

/** วันที่ที่ backend ส่งมา (อาจเป็น ISO เต็ม) → YYYY-MM-DD ตามเวลาท้องถิ่น */
export const toYmd = (value: string | null | undefined): string =>
  value ? isoToDateInput(value) : "";

/** ค่าให้ DatePicker (parse เป็นเวลาท้องถิ่น ไม่เลื่อนวัน) */
export const ymdToPickerValue = (ymd: string): string =>
  ymd ? `${ymd}T00:00:00` : "";

export const todayYmd = (): string => isoToDateInput(new Date().toISOString());

export const newLineKey = (): string => crypto.randomUUID();

export const emptyLine = (): InvoiceFormLine => ({
  key: newLineKey(),
  description: "",
  product_id: null,
  product_name: null,
  unit_id: null,
  unit_name: null,
  quantity: "1",
  unit_price: "0",
  vat_is_included: false,
  discount_amount: "0",
  dr_chart_of_accounts_id: null,
  dr_account_code: null,
  dr_cost_center_id: null,
  dr_cost_center_code: null,
  vat_tax_profile_id: null,
  vat_rate: "0",
  vat_is_override: false,
  vat_amount: "0",
  wht_tax_profile_id: null,
  wht_rate: "0",
  grn_no: null,
  grn_id: null,
  carry: null,
});

function fromDocLine(line: ApInvoiceLine): InvoiceFormLine {
  const source = line.sources[0];
  return {
    key: line.id,
    description: line.description ?? "",
    product_id: line.product_id,
    product_name: line.product_name,
    unit_id: line.unit_id,
    unit_name: line.unit_name,
    quantity: line.quantity,
    unit_price: line.unit_price,
    vat_is_included: line.vat_is_included,
    discount_amount: line.discount_amount,
    dr_chart_of_accounts_id: line.dr_chart_of_accounts_id,
    dr_account_code: line.dr_account_code,
    dr_cost_center_id: line.dr_cost_center_id,
    dr_cost_center_code: line.dr_cost_center_code,
    vat_tax_profile_id: line.vat_tax_profile_id,
    vat_rate: line.vat_rate ?? "0",
    vat_is_override: line.vat_is_override,
    vat_amount: line.vat_amount,
    wht_tax_profile_id: line.wht_tax_profile_id,
    wht_rate: line.wht_rate ?? "0",
    grn_no: source?.grn_no ?? null,
    grn_id: source?.good_received_note_id ?? null,
    carry: {
      dimensions: line.dimensions.map((d) => ({
        gl_dimension_id: d.gl_dimension_id,
        gl_dimension_value_id: d.gl_dimension_value_id,
      })),
      sources: line.sources.map((src) => ({
        good_received_note_detail_item_id: src.good_received_note_detail_item_id,
        matched_qty: src.matched_qty,
      })),
      vat_chart_of_accounts_id: line.vat_chart_of_accounts_id,
      vat_cost_center_id: line.vat_cost_center_id,
      cr_chart_of_accounts_id: line.cr_chart_of_accounts_id,
      cr_cost_center_id: line.cr_cost_center_id,
    },
  };
}

export function initialInvoiceForm(
  doc: ApInvoice | null | undefined,
  defaults: { currencyId?: string; currencyCode?: string },
): InvoiceForm {
  if (doc) {
    return {
      doc_type: doc.doc_type,
      doc_date: toYmd(doc.doc_date),
      vendor_id: doc.vendor_id,
      vendor_name: doc.vendor_name,
      vendor_invoice_no: doc.vendor_invoice_no,
      invoice_date: toYmd(doc.invoice_date),
      credit_term_id: doc.credit_term_id ?? "",
      credit_term_days: doc.credit_term_days,
      currency_id: doc.currency_id,
      currency_code: doc.currency_code,
      exchange_rate: doc.exchange_rate,
      description: doc.description ?? "",
      lines: (doc.lines ?? []).map(fromDocLine),
    };
  }
  const today = todayYmd();
  return {
    doc_type: "invoice",
    doc_date: today,
    vendor_id: "",
    vendor_name: "",
    vendor_invoice_no: "",
    invoice_date: today,
    credit_term_id: "",
    credit_term_days: 0,
    currency_id: defaults.currencyId ?? "",
    currency_code: defaults.currencyCode ?? "",
    exchange_rate: "1",
    description: "",
    lines: [emptyLine()],
  };
}

export interface LineAmounts {
  subtotal: DecimalString;
  net: DecimalString;
  vat: DecimalString;
  wht: DecimalString;
  total: DecimalString;
}

const num = (value: DecimalString): DecimalString => value.trim() || "0";

/** สูตรเดียวกับ BE computeLine — ติ๊ก Inc VAT: gross = ยอดหลังส่วนลด, vat ถอดจาก gross, net = gross − vat, total = gross */
export function lineAmounts(line: InvoiceFormLine): LineAmounts {
  const rawSubtotal = multiplyDecimal(num(line.quantity), num(line.unit_price));
  const afterDiscount = subtractDecimal(rawSubtotal, num(line.discount_amount));
  const wht = (net: DecimalString) => percentOf(net, num(line.wht_rate));
  if (line.vat_is_included) {
    const rate = num(line.vat_rate);
    const vat = line.vat_is_override
      ? num(line.vat_amount)
      : divideDecimal(
          multiplyDecimal(afterDiscount, rate, 6),
          addDecimal(["100", rate], 6),
        );
    const net = subtractDecimal(afterDiscount, vat);
    return {
      // Subtotal ของแถวที่ติ๊ก = net + ส่วนลด ให้แถบสรุป foot (Subtotal − ส่วนลด = net)
      subtotal: addDecimal([net, num(line.discount_amount)]),
      net,
      vat,
      wht: wht(net),
      total: afterDiscount,
    };
  }
  const net = afterDiscount;
  const vat = line.vat_is_override
    ? num(line.vat_amount)
    : percentOf(net, num(line.vat_rate));
  return {
    subtotal: rawSubtotal,
    net,
    vat,
    wht: wht(net),
    total: addDecimal([net, vat]),
  };
}

export interface InvoiceTotals {
  subtotal: DecimalString;
  discount: DecimalString;
  net: DecimalString;
  vat: DecimalString;
  wht: DecimalString;
  total: DecimalString;
}

export function invoiceTotals(lines: InvoiceFormLine[]): InvoiceTotals {
  const amounts = lines.map(lineAmounts);
  const subtotal = addDecimal(amounts.map((a) => a.subtotal));
  const discount = addDecimal(lines.map((l) => num(l.discount_amount)));
  const vat = addDecimal(amounts.map((a) => a.vat));
  return {
    subtotal,
    discount,
    net: subtractDecimal(subtotal, discount),
    vat,
    wht: addDecimal(amounts.map((a) => a.wht)),
    total: addDecimal([subtractDecimal(subtotal, discount), vat]),
  };
}

export type InvoiceErrorKey =
  | "vendor"
  | "vendorInvoiceNo"
  | "docDate"
  | "invoiceDate"
  | "exchangeRate"
  | "lines"
  | "account"
  | "quantity"
  | "unitPrice";

/** ตรวจก่อนส่ง — คืนชุดคีย์ข้อผิดพลาด (ว่าง = ผ่าน) */
export function validateInvoiceForm(
  form: InvoiceForm,
  mode: "create" | "update",
): Set<InvoiceErrorKey> {
  const errors = new Set<InvoiceErrorKey>();
  if (mode === "create" && !form.vendor_id) errors.add("vendor");
  const no = form.vendor_invoice_no.trim();
  if (!no || no.length > 100) errors.add("vendorInvoiceNo");
  if (!form.doc_date) errors.add("docDate");
  if (!form.invoice_date) errors.add("invoiceDate");
  if (form.exchange_rate.trim() && compareDecimal(num(form.exchange_rate), "0") <= 0)
    errors.add("exchangeRate");
  if (form.lines.length === 0) errors.add("lines");
  for (const line of form.lines) {
    if (!line.dr_chart_of_accounts_id) errors.add("account");
    if (compareDecimal(num(line.quantity), "0") <= 0) errors.add("quantity");
    if (compareDecimal(num(line.unit_price), "0") < 0) errors.add("unitPrice");
  }
  return errors;
}

function toLineInput(
  line: InvoiceFormLine,
  index: number,
  deposit: boolean,
): ApInvoiceLineInput {
  return {
    sequence_no: index + 1,
    description: line.description.trim() || null,
    product_id: line.product_id,
    product_name: line.product_name,
    unit_id: line.unit_id,
    unit_name: line.unit_name,
    quantity: num(line.quantity),
    unit_price: num(line.unit_price),
    // deposit ห้ามมี flag (BE ปฏิเสธ) — ไม่ส่งเลย
    ...(deposit ? {} : { vat_is_included: line.vat_is_included }),
    discount_amount: num(line.discount_amount),
    dr_chart_of_accounts_id: line.dr_chart_of_accounts_id ?? "",
    dr_cost_center_id: line.dr_cost_center_id,
    vat_tax_profile_id: line.vat_tax_profile_id,
    vat_is_override: line.vat_is_override,
    // ไม่ override = ให้ backend คำนวณเอง
    vat_amount: line.vat_is_override ? num(line.vat_amount) : null,
    wht_tax_profile_id: line.wht_tax_profile_id,
    ...(line.carry ?? {}),
  };
}

export function toInvoiceInput(form: InvoiceForm): ApInvoiceInput {
  return {
    doc_type: form.doc_type,
    doc_source: "manual",
    doc_date: form.doc_date,
    vendor_id: form.vendor_id,
    vendor_invoice_no: form.vendor_invoice_no.trim(),
    invoice_date: form.invoice_date,
    credit_term_days: form.credit_term_days,
    currency_id: form.currency_id || null,
    exchange_rate: form.exchange_rate.trim() || null,
    description: form.description.trim() || null,
    lines: form.lines.map((line, index) =>
      toLineInput(line, index, form.doc_type === "deposit"),
    ),
  };
}
