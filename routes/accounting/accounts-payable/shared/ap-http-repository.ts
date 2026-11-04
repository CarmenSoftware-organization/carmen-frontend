import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import { buildUrl } from "@/lib/build-query-string";
import { httpClient } from "@/lib/http-client";
import type {
  ApActionInput,
  ApAttachment,
  ApDimensionRef,
  ApInvoice,
  ApInvoiceInput,
  ApInvoiceLine,
  ApInvoiceLineInput,
  ApInvoiceLineSource,
  ApInvoiceReference,
  ApInvoiceTax,
  ApMutationResult,
  ApOutstandingDocument,
  ApPayment,
  ApPaymentAllocation,
  ApPaymentExpense,
  ApPaymentInput,
  ApPaymentTaxInvoice,
  ApPaymentWht,
  ApWhtPreviewRow,
  DecimalString,
} from "@/types/accounts-payable";
import type { PaginatedResponse } from "@/types/params";
import { normalizeDecimal } from "./ap-decimal";
import type { ApRepository } from "./ap-repository";

type Raw = Record<string, unknown>;

// ---------------------------------------------------------------------------
// เงิน: backend ส่ง number (Decimal 20,5) → DecimalString ที่ขอบเขตนี้ที่เดียว
// ---------------------------------------------------------------------------

/** number → DecimalString (สูงสุด 5 ตำแหน่งตาม Decimal(20,5), ตัดศูนย์ท้ายเหลืออย่างน้อย 2 ตำแหน่ง) */
export function toDecimal(value: unknown): DecimalString {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.00";
  const fixed = normalizeDecimal(n.toFixed(5), 5);
  const [whole, frac = ""] = fixed.split(".");
  const trimmed = frac.replace(/0+$/, "").padEnd(2, "0");
  return `${whole}.${trimmed}`;
}

function toDecimalOrNull(value: unknown): DecimalString | null {
  return value === null || value === undefined ? null : toDecimal(value);
}

/** DecimalString → number สำหรับ body ที่ backend รับ */
export function toNumber(value: DecimalString | number): number {
  return typeof value === "number" ? value : Number(value);
}

function toNumberOrNull(
  value: DecimalString | number | null | undefined,
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return toNumber(value);
}

const str = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v);
const iso = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v);
const arr = <T = Raw>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function attachments(v: unknown): ApAttachment[] | undefined {
  return Array.isArray(v) ? (v as ApAttachment[]) : undefined;
}

// ---------------------------------------------------------------------------
// mapper: backend → FE
// ---------------------------------------------------------------------------

function mapLine(raw: Raw): ApInvoiceLine {
  return {
    id: String(raw.id),
    sequence_no: Number(raw.sequence_no ?? 0),
    description: str(raw.description),
    product_id: str(raw.product_id),
    product_name: str(raw.product_name),
    unit_id: str(raw.unit_id),
    unit_name: str(raw.unit_name),
    quantity: toDecimal(raw.quantity),
    unit_price: toDecimal(raw.unit_price),
    sub_total_amount: toDecimal(raw.sub_total_amount),
    discount_amount: toDecimal(raw.discount_amount),
    net_amount: toDecimal(raw.net_amount),
    dr_chart_of_accounts_id: String(raw.dr_chart_of_accounts_id),
    dr_account_code: str(raw.dr_account_code),
    dr_cost_center_id: str(raw.dr_cost_center_id),
    dr_cost_center_code: str(raw.dr_cost_center_code),
    vat_tax_profile_id: str(raw.vat_tax_profile_id),
    vat_rate: toDecimal(raw.vat_rate),
    vat_amount: toDecimal(raw.vat_amount),
    vat_is_override: Boolean(raw.vat_is_override),
    vat_chart_of_accounts_id: str(raw.vat_chart_of_accounts_id),
    vat_cost_center_id: str(raw.vat_cost_center_id),
    wht_tax_profile_id: str(raw.wht_tax_profile_id),
    wht_rate: toDecimalOrNull(raw.wht_rate),
    wht_estimate_amount: toDecimal(raw.wht_estimate_amount),
    cr_chart_of_accounts_id: String(raw.cr_chart_of_accounts_id),
    cr_account_code: str(raw.cr_account_code),
    cr_cost_center_id: str(raw.cr_cost_center_id),
    total_amount: toDecimal(raw.total_amount),
    unpaid_amount: toDecimal(raw.unpaid_amount),
    base_total_amount: toDecimal(raw.base_total_amount),
    base_unpaid_amount: toDecimal(raw.base_unpaid_amount),
    dimensions: arr<ApDimensionRef>(raw.tb_ap_invoice_detail_dimension),
    sources: arr(raw.tb_ap_invoice_detail_source).map(
      (s): ApInvoiceLineSource => ({
        good_received_note_id: String(s.good_received_note_id),
        grn_no: String(s.grn_no),
        good_received_note_detail_item_id: String(
          s.good_received_note_detail_item_id,
        ),
        matched_qty: toDecimal(s.matched_qty),
        grn_unit_price: toDecimal(s.grn_unit_price),
        matched_amount: toDecimal(s.matched_amount),
        variance_amount: toDecimal(s.variance_amount),
      }),
    ),
  };
}

function workflowFields(raw: Raw) {
  return {
    workflow_id: str(raw.workflow_id),
    workflow_name: str(raw.workflow_name),
    workflow_current_stage: str(raw.workflow_current_stage),
    workflow_previous_stage: str(raw.workflow_previous_stage),
    workflow_next_stage: str(raw.workflow_next_stage),
    workflow_history: raw.workflow_history,
    user_action: (raw.user_action ?? null) as ApInvoice["user_action"],
    last_action: str(raw.last_action),
    last_action_at_date: iso(raw.last_action_at_date),
    last_action_by_id: str(raw.last_action_by_id),
    last_action_by_name: str(raw.last_action_by_name),
  };
}

export function mapInvoice(raw: Raw): ApInvoice {
  const tax = raw.tb_ap_invoice_tax as Raw | null | undefined;
  return {
    id: String(raw.id),
    doc_version: (raw.doc_version as number | null | undefined) ?? null,
    doc_no: String(raw.doc_no),
    doc_type: raw.doc_type as ApInvoice["doc_type"],
    doc_status: raw.doc_status as ApInvoice["doc_status"],
    doc_source: (raw.doc_source ?? "manual") as ApInvoice["doc_source"],
    doc_date: String(raw.doc_date),
    description: str(raw.description),
    vendor_id: String(raw.vendor_id),
    vendor_name: String(raw.vendor_name ?? ""),
    vendor_invoice_no: String(raw.vendor_invoice_no ?? ""),
    invoice_date: String(raw.invoice_date),
    credit_term_id: str(raw.credit_term_id),
    credit_term_name: str(raw.credit_term_name),
    credit_term_days: Number(raw.credit_term_days ?? 0),
    due_date: String(raw.due_date),
    currency_id: String(raw.currency_id),
    currency_code: String(raw.currency_code ?? ""),
    exchange_rate: toDecimal(raw.exchange_rate ?? 1),
    base_currency_id: String(raw.base_currency_id),
    base_currency_code: String(raw.base_currency_code ?? ""),
    sub_total_amount: toDecimal(raw.sub_total_amount),
    discount_amount: toDecimal(raw.discount_amount),
    net_amount: toDecimal(raw.net_amount),
    vat_amount: toDecimal(raw.vat_amount),
    total_amount: toDecimal(raw.total_amount),
    base_total_amount: toDecimal(raw.base_total_amount),
    wht_estimate_amount: toDecimal(raw.wht_estimate_amount),
    outstanding_amount: toDecimal(raw.outstanding_amount),
    reference_applied_amount: toDecimal(raw.reference_applied_amount),
    gl_jv_id: str(raw.gl_jv_id),
    gl_jv_no: str(raw.gl_jv_no),
    posted_at: iso(raw.posted_at),
    void_at: iso(raw.void_at),
    void_reason: str(raw.void_reason),
    void_gl_jv_id: str(raw.void_gl_jv_id),
    attachments: attachments(raw.attachments),
    created_at: iso(raw.created_at),
    created_by_id: str(raw.created_by_id),
    updated_at: iso(raw.updated_at),
    updated_by_id: str(raw.updated_by_id),
    ...workflowFields(raw),
    lines: Array.isArray(raw.tb_ap_invoice_detail)
      ? arr(raw.tb_ap_invoice_detail).map(mapLine)
      : undefined,
    references: Array.isArray(raw.tb_ap_invoice_reference)
      ? arr(raw.tb_ap_invoice_reference).map(
          (r): ApInvoiceReference => ({
            ref_ap_invoice_id: String(r.ref_ap_invoice_id),
            ref_doc_type: r.ref_doc_type as ApInvoiceReference["ref_doc_type"],
            applied_amount: toDecimal(r.applied_amount),
            realized_fx_amount: toDecimal(r.realized_fx_amount),
          }),
        )
      : undefined,
    tax: tax
      ? ({
          tax_invoice_no: String(tax.tax_invoice_no),
          tax_invoice_date: String(tax.tax_invoice_date),
          base_amount: toDecimal(tax.base_amount),
          vat_amount: toDecimal(tax.vat_amount),
          tax_status: tax.tax_status as ApInvoiceTax["tax_status"],
          expiry_claim_date: String(tax.expiry_claim_date),
        } satisfies ApInvoiceTax)
      : tax === null
        ? null
        : undefined,
  };
}

export function mapPayment(raw: Raw): ApPayment {
  return {
    id: String(raw.id),
    doc_version: (raw.doc_version as number | null | undefined) ?? null,
    doc_no: String(raw.doc_no),
    doc_status: raw.doc_status as ApPayment["doc_status"],
    payment_date: String(raw.payment_date),
    paid_date: iso(raw.paid_date),
    description: str(raw.description),
    reference_no: str(raw.reference_no),
    vendor_id: String(raw.vendor_id),
    vendor_name: String(raw.vendor_name ?? ""),
    payee_name: String(raw.payee_name ?? ""),
    payee_tax_no: str(raw.payee_tax_no),
    payee_branch_no: str(raw.payee_branch_no),
    payee_address: str(raw.payee_address),
    bank_account_id: String(raw.bank_account_id),
    bank_account_code: String(raw.bank_account_code ?? ""),
    bank_account_name: String(raw.bank_account_name ?? ""),
    payment_method: raw.payment_method as ApPayment["payment_method"],
    cheque_no: str(raw.cheque_no),
    cheque_date: iso(raw.cheque_date),
    currency_id: String(raw.currency_id),
    currency_code: String(raw.currency_code ?? ""),
    exchange_rate: toDecimal(raw.exchange_rate ?? 1),
    base_currency_id: String(raw.base_currency_id),
    base_currency_code: String(raw.base_currency_code ?? ""),
    total_applied_amount: toDecimal(raw.total_applied_amount),
    total_wht_amount: toDecimal(raw.total_wht_amount),
    total_expense_amount: toDecimal(raw.total_expense_amount),
    net_paid_amount: toDecimal(raw.net_paid_amount),
    base_total_applied_amount: toDecimal(raw.base_total_applied_amount),
    base_total_wht_amount: toDecimal(raw.base_total_wht_amount),
    base_total_expense_amount: toDecimal(raw.base_total_expense_amount),
    base_net_paid_amount: toDecimal(raw.base_net_paid_amount),
    realized_fx_amount: toDecimal(raw.realized_fx_amount),
    gl_jv_id: str(raw.gl_jv_id),
    gl_jv_no: str(raw.gl_jv_no),
    posted_at: iso(raw.posted_at),
    void_at: iso(raw.void_at),
    void_reason: str(raw.void_reason),
    attachments: attachments(raw.attachments),
    created_at: iso(raw.created_at),
    updated_at: iso(raw.updated_at),
    ...workflowFields(raw),
    allocations: Array.isArray(raw.tb_ap_payment_detail)
      ? arr(raw.tb_ap_payment_detail).map(
          (d): ApPaymentAllocation => ({
            id: String(d.id),
            ap_invoice_id: String(d.ap_invoice_id),
            ap_invoice_detail_id: String(d.ap_invoice_detail_id),
            doc_type: d.doc_type as ApPaymentAllocation["doc_type"],
            applied_amount: toDecimal(d.applied_amount),
            invoice_exchange_rate: toDecimal(d.invoice_exchange_rate),
            base_applied_at_invoice_rate: toDecimal(
              d.base_applied_at_invoice_rate,
            ),
            base_applied_at_payment_rate: toDecimal(
              d.base_applied_at_payment_rate,
            ),
            realized_fx_amount: toDecimal(d.realized_fx_amount),
          }),
        )
      : undefined,
    wht: Array.isArray(raw.tb_ap_payment_wht)
      ? arr(raw.tb_ap_payment_wht).map(
          (w): ApPaymentWht => ({
            id: String(w.id),
            wht_tax_profile_id: String(w.wht_tax_profile_id),
            wht_tax_profile_name: String(w.wht_tax_profile_name ?? ""),
            pnd_form: str(w.pnd_form),
            income_type: str(w.income_type),
            base_amount: toDecimal(w.base_amount),
            wht_rate: toDecimal(w.wht_rate),
            wht_amount: toDecimal(w.wht_amount),
            is_override: Boolean(w.is_override),
          }),
        )
      : undefined,
    expenses: Array.isArray(raw.tb_ap_payment_expense)
      ? arr(raw.tb_ap_payment_expense).map(
          (e): ApPaymentExpense => ({
            id: String(e.id),
            chart_of_accounts_id: String(e.chart_of_accounts_id),
            cost_center_id: str(e.cost_center_id),
            description: str(e.description),
            amount: toDecimal(e.amount),
            base_amount: toDecimal(e.base_amount),
          }),
        )
      : undefined,
    tax_invoices: Array.isArray(raw.tax_invoices)
      ? arr(raw.tax_invoices).map(
          (t): ApPaymentTaxInvoice => ({
            ap_invoice_id: String(t.ap_invoice_id),
            doc_no: String(t.doc_no),
            tax_invoice_no: String(t.tax_invoice_no),
            tax_invoice_date: String(t.tax_invoice_date),
            base_amount: toDecimal(t.base_amount),
            vat_amount: toDecimal(t.vat_amount),
          }),
        )
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// mapper: FE input → backend body (DecimalString → number)
// ---------------------------------------------------------------------------

function lineBody(line: ApInvoiceLineInput): Raw {
  return {
    ...line,
    quantity: toNumber(line.quantity),
    unit_price: toNumber(line.unit_price),
    discount_amount: toNumberOrNull(line.discount_amount),
    vat_amount: toNumberOrNull(line.vat_amount),
    ...(line.sources
      ? {
          sources: line.sources.map((s) => ({
            ...s,
            matched_qty: toNumber(s.matched_qty),
          })),
        }
      : {}),
  };
}

/** body ที่ใช้ร่วมกันของ create/update (ไม่รวมฟิลด์ที่ต่างกัน) */
function invoiceSharedBody(input: Partial<ApInvoiceInput>): Raw {
  const body: Raw = {};
  if (input.doc_date !== undefined) body.doc_date = input.doc_date;
  if (input.vendor_invoice_no !== undefined)
    body.vendor_invoice_no = input.vendor_invoice_no;
  if (input.invoice_date !== undefined) body.invoice_date = input.invoice_date;
  if (input.credit_term_days !== undefined)
    body.credit_term_days = input.credit_term_days;
  if (input.exchange_rate !== undefined)
    body.exchange_rate = toNumberOrNull(input.exchange_rate);
  if (input.description !== undefined) body.description = input.description;
  if (input.attachments !== undefined) body.attachments = input.attachments;
  if (input.lines !== undefined)
    body.details = { add: input.lines.map(lineBody) };
  if (input.references !== undefined)
    body.references = input.references?.map((r) => ({
      ref_ap_invoice_id: r.ref_ap_invoice_id,
      applied_amount: toNumber(r.applied_amount),
    }));
  return body;
}

function paymentBody(input: Partial<ApPaymentInput>): Raw {
  const body: Raw = { ...input };
  if (input.exchange_rate !== undefined)
    body.exchange_rate = toNumberOrNull(input.exchange_rate);
  if (input.allocations)
    body.allocations = input.allocations.map((a) => ({
      ap_invoice_detail_id: a.ap_invoice_detail_id,
      applied_amount: toNumber(a.applied_amount),
    }));
  if (input.wht)
    body.wht = input.wht.map((w) => ({
      ...w,
      base_amount: toNumber(w.base_amount),
      wht_amount: toNumber(w.wht_amount),
    }));
  if (input.expenses)
    body.expenses = input.expenses.map((e) => ({
      ...e,
      amount: toNumber(e.amount),
    }));
  return body;
}

// ---------------------------------------------------------------------------
// http helpers
// ---------------------------------------------------------------------------

async function unwrap(res: Response, fallback: string): Promise<unknown> {
  if (!res.ok) throw await ApiError.from(res, fallback);
  const json = await res.json();
  return json?.data ?? json;
}

async function readPage<T>(
  res: Response,
  fallback: string,
  map: (raw: Raw) => T,
  params?: { page?: number | string; perpage?: number | string },
): Promise<PaginatedResponse<T>> {
  if (!res.ok) throw await ApiError.from(res, fallback);
  const json = await res.json();
  const items: Raw[] = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : [];
  const total =
    typeof json?.paginate?.total === "number"
      ? json.paginate.total
      : typeof json?.total === "number"
        ? json.total
        : items.length;
  const page = Number(json?.paginate?.page ?? params?.page) || 1;
  const perpage = Number(json?.paginate?.perpage ?? params?.perpage) || 20;
  return {
    data: items.map(map),
    paginate: {
      total,
      page,
      perpage,
      pages: Number(json?.paginate?.pages) || Math.ceil(total / perpage) || 1,
    },
  };
}

function mutationResult(data: unknown): ApMutationResult {
  const raw = (data ?? {}) as Raw;
  return {
    id: String(raw.id ?? ""),
    doc_no: raw.doc_no === undefined ? undefined : String(raw.doc_no),
    doc_status: raw.doc_status as ApMutationResult["doc_status"],
    doc_version: (raw.doc_version as number | null | undefined) ?? undefined,
    gl_jv_no: raw.gl_jv_no === undefined ? undefined : str(raw.gl_jv_no),
  };
}

function actionBody(input: ApActionInput): Raw {
  const body: Raw = {};
  if (input.docVersion !== undefined && input.docVersion !== null)
    body.doc_version = input.docVersion;
  if (input.reason !== undefined) body.reason = input.reason;
  if (input.stage !== undefined) body.stage = input.stage;
  return body;
}

async function getOrNull<T>(
  url: string,
  label: string,
  map: (raw: Raw) => T,
): Promise<T | null> {
  const res = await httpClient.get(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw await ApiError.from(res, `Failed to fetch ${label}`);
  }
  const json = await res.json();
  const raw = json?.data ?? json;
  return raw?.id ? map(raw) : null;
}

export const httpApRepository: ApRepository = {
  // ---- invoice ----
  async listInvoices(buCode, params) {
    const res = await httpClient.get(
      buildUrl(API_ENDPOINTS.AP_INVOICE_LIST(buCode), params),
    );
    return readPage(res, "Failed to fetch AP invoices", mapInvoice, params);
  },

  getInvoice(buCode, id) {
    return getOrNull(
      API_ENDPOINTS.AP_INVOICE_DETAIL(buCode, id),
      `AP invoice ${id}`,
      mapInvoice,
    );
  },

  async createInvoice(buCode, input) {
    const body: Raw = {
      ...invoiceSharedBody(input),
      doc_type: input.doc_type,
      vendor_id: input.vendor_id,
    };
    if (input.doc_source !== undefined) body.doc_source = input.doc_source;
    if (input.currency_id !== undefined) body.currency_id = input.currency_id;
    const res = await httpClient.post(
      API_ENDPOINTS.AP_INVOICE_LIST(buCode),
      body,
    );
    return mutationResult(await unwrap(res, "Failed to create AP invoice"));
  },

  async updateInvoice(buCode, id, docVersion, input) {
    // doc_type / doc_source / vendor_id / currency_id แก้หลังสร้างไม่ได้ — ไม่ส่ง
    const res = await httpClient.put(
      API_ENDPOINTS.AP_INVOICE_DETAIL(buCode, id),
      { ...invoiceSharedBody(input), doc_version: docVersion },
    );
    return mutationResult(
      await unwrap(res, `Failed to update AP invoice ${id}`),
    );
  },

  async deleteInvoice(buCode, id) {
    const res = await httpClient.delete(
      API_ENDPOINTS.AP_INVOICE_DETAIL(buCode, id),
    );
    if (!res.ok) throw await ApiError.from(res, "Failed to delete AP invoice");
  },

  async invoiceAction(buCode, id, command, input) {
    const res = await httpClient.post(
      API_ENDPOINTS.AP_INVOICE_ACTION(buCode, id, command),
      actionBody(input),
    );
    return mutationResult(
      await unwrap(res, `Failed to ${command} AP invoice ${id}`),
    );
  },

  // ---- payment ----
  async listPayments(buCode, params) {
    const res = await httpClient.get(
      buildUrl(API_ENDPOINTS.AP_PAYMENT_LIST(buCode), params),
    );
    return readPage(res, "Failed to fetch AP payments", mapPayment, params);
  },

  getPayment(buCode, id) {
    return getOrNull(
      API_ENDPOINTS.AP_PAYMENT_DETAIL(buCode, id),
      `AP payment ${id}`,
      mapPayment,
    );
  },

  async createPayment(buCode, input) {
    const res = await httpClient.post(
      API_ENDPOINTS.AP_PAYMENT_LIST(buCode),
      paymentBody(input),
    );
    return mutationResult(await unwrap(res, "Failed to create AP payment"));
  },

  async updatePayment(buCode, id, docVersion, input) {
    // vendor_id แก้หลังสร้างไม่ได้ — paymentBody ไม่ได้ใส่ให้เพราะ input ไม่มีฟิลด์นี้
    const res = await httpClient.put(
      API_ENDPOINTS.AP_PAYMENT_DETAIL(buCode, id),
      { ...paymentBody(input), doc_version: docVersion },
    );
    return mutationResult(
      await unwrap(res, `Failed to update AP payment ${id}`),
    );
  },

  async deletePayment(buCode, id) {
    const res = await httpClient.delete(
      API_ENDPOINTS.AP_PAYMENT_DETAIL(buCode, id),
    );
    if (!res.ok) throw await ApiError.from(res, "Failed to delete AP payment");
  },

  async paymentAction(buCode, id, command, input) {
    const res = await httpClient.post(
      API_ENDPOINTS.AP_PAYMENT_ACTION(buCode, id, command),
      actionBody(input),
    );
    return mutationResult(
      await unwrap(res, `Failed to ${command} AP payment ${id}`),
    );
  },

  async outstandingDocuments(buCode, vendorId) {
    const res = await httpClient.get(
      buildUrl(API_ENDPOINTS.AP_PAYMENT_OUTSTANDING(buCode), {
        vendor_id: vendorId,
      }),
    );
    const data = await unwrap(res, "Failed to fetch outstanding documents");
    return arr(data).map(
      (d): ApOutstandingDocument => ({
        ap_invoice_id: String(d.ap_invoice_id),
        doc_no: String(d.doc_no),
        doc_type: d.doc_type as ApOutstandingDocument["doc_type"],
        doc_date: String(d.doc_date),
        due_date: String(d.due_date),
        currency_id: String(d.currency_id),
        currency_code: String(d.currency_code ?? ""),
        exchange_rate: toDecimal(d.exchange_rate),
        outstanding_amount: toDecimal(d.outstanding_amount),
        lines: arr(d.lines).map((l) => ({
          ap_invoice_detail_id: String(l.ap_invoice_detail_id),
          doc_type: l.doc_type as ApOutstandingDocument["doc_type"],
          sequence_no: Number(l.sequence_no ?? 0),
          description: str(l.description),
          total_amount: toDecimal(l.total_amount),
          unpaid_amount: toDecimal(l.unpaid_amount),
          available_amount: toDecimal(l.available_amount),
          wht_tax_profile_id: str(l.wht_tax_profile_id),
        })),
      }),
    );
  },

  async whtPreview(buCode, body) {
    const res = await httpClient.post(
      API_ENDPOINTS.AP_PAYMENT_WHT_PREVIEW(buCode),
      {
        allocations: body.allocations.map((a) => ({
          ap_invoice_detail_id: a.ap_invoice_detail_id,
          applied_amount: toNumber(a.applied_amount),
        })),
        ...(body.ap_payment_id ? { ap_payment_id: body.ap_payment_id } : {}),
      },
    );
    const data = await unwrap(res, "Failed to preview WHT");
    return arr(data).map(
      (w): ApWhtPreviewRow => ({
        wht_tax_profile_id: String(w.wht_tax_profile_id),
        wht_tax_profile_name: String(w.wht_tax_profile_name ?? ""),
        pnd_form: str(w.pnd_form),
        income_type: str(w.income_type),
        wht_rate: toDecimal(w.wht_rate),
        base_amount: toDecimal(w.base_amount),
        wht_amount: toDecimal(w.wht_amount),
      }),
    );
  },
};
