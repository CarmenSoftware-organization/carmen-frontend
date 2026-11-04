import type {
  ApActivity,
  ApDashboardSnapshot,
  ApDocumentCapabilities,
  ApInvoice,
  ApInvoiceFilters,
  ApInvoiceInput,
  ApInvoiceListResponse,
  ApInvoicePaymentHistory,
  ApMockState,
  ApPayment,
  ApPaymentFilters,
  ApPaymentInput,
  ApPaymentListResponse,
} from "@/types/accounts-payable-mock";
import {
  addDecimal,
  compareDecimal,
  multiplyDecimal,
  percentOf,
  subtractDecimal,
} from "./ap-decimal";
import { paymentSummary } from "../payment/ap-payment-totals";

const STORAGE_PREFIX = "carmen-ap-mock-v1";
const memory = new Map<string, string>();

function now(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function readStorage(key: string): string | null {
  if (typeof window !== "undefined") return window.localStorage.getItem(key);
  return memory.get(key) ?? null;
}

function writeStorage(key: string, value: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  else memory.set(key, value);
}

function activity(
  action: string,
  detail: string,
  actor = "Mock AP User",
): ApActivity {
  return { id: crypto.randomUUID(), action, detail, actor, at: now() };
}

export function invoiceCapabilities(
  invoice: Pick<ApInvoice, "lifecycle" | "workflow_enabled">,
): ApDocumentCapabilities {
  const draft = invoice.lifecycle === "draft";
  const submitted = invoice.lifecycle === "submitted";
  return {
    can_edit: draft,
    can_submit: draft,
    can_approve: submitted && invoice.workflow_enabled,
    can_return: submitted && invoice.workflow_enabled,
    can_reject: submitted && invoice.workflow_enabled,
    can_void: draft || submitted || invoice.lifecycle === "post_failed",
    can_release: false,
  };
}

export function paymentCapabilities(
  payment: Pick<ApPayment, "lifecycle" | "workflow_enabled">,
): ApDocumentCapabilities {
  const draft =
    payment.lifecycle === "draft" || payment.lifecycle === "ready_to_release";
  const submitted = payment.lifecycle === "submitted";
  return {
    can_edit: draft,
    can_submit: draft,
    can_approve: submitted && payment.workflow_enabled,
    can_return: submitted && payment.workflow_enabled,
    can_reject: submitted && payment.workflow_enabled,
    can_void:
      draft ||
      submitted ||
      payment.lifecycle === "post_failed",
    can_release: false,
  };
}

function journalForInvoice(total: string, net: string, vat: string) {
  return [
    {
      id: "j1",
      account: "6100",
      description: "Operating expense",
      debit: net,
      credit: "0.00",
    },
    {
      id: "j2",
      account: "1159",
      description: "Pending input VAT",
      debit: vat,
      credit: "0.00",
    },
    {
      id: "j3",
      account: "2110",
      description: "Trade accounts payable",
      debit: "0.00",
      credit: total,
    },
  ];
}

function seedInvoice(
  overrides: Partial<ApInvoice> &
    Pick<ApInvoice, "id" | "ap_no" | "vendor_name" | "vendor_invoice_no">,
): ApInvoice {
  const net = overrides.net_amount ?? "10000.00";
  const vat = overrides.vat_amount ?? "700.00";
  const total = overrides.total_amount ?? addDecimal([net, vat]);
  const lifecycle = overrides.lifecycle ?? "posted";
  const invoice: ApInvoice = {
    id: overrides.id,
    doc_version: 1,
    ap_no: overrides.ap_no,
    input_date: overrides.input_date ?? "2026-08-20",
    vendor_invoice_no: overrides.vendor_invoice_no,
    tax_invoice_no:
      overrides.tax_invoice_no ??
      (lifecycle === "draft" || compareDecimal(vat, "0") <= 0
        ? null
        : overrides.vendor_invoice_no),
    tax_invoice_date:
      overrides.tax_invoice_date ??
      (lifecycle === "draft" || compareDecimal(vat, "0") <= 0
        ? null
        : overrides.invoice_date ?? "2026-08-18"),
    vendor_id: overrides.vendor_id ?? `vendor-${overrides.id}`,
    vendor_name: overrides.vendor_name,
    invoice_date: overrides.invoice_date ?? "2026-08-18",
    due_date:
      overrides.due_date === undefined ? "2026-08-31" : overrides.due_date,
    credit_days: overrides.credit_days ?? 30,
    currency_code: overrides.currency_code ?? "THB",
    exchange_rate: overrides.exchange_rate ?? "1.00000",
    description: overrides.description ?? "Hotel operating supplies",
    lifecycle,
    workflow_enabled: overrides.workflow_enabled ?? false,
    current_stage: overrides.current_stage ?? null,
    settlement_status: overrides.settlement_status ?? "unpaid",
    tax_status: overrides.tax_status ?? "confirmed",
    match_status: overrides.match_status ?? "matched",
    match_acknowledged: overrides.match_acknowledged ?? false,
    is_on_hold: overrides.is_on_hold ?? false,
    subtotal: overrides.subtotal ?? net,
    discount: overrides.discount ?? "0.00",
    net_amount: net,
    vat_amount: vat,
    estimated_wht: overrides.estimated_wht ?? percentOf(net, "3"),
    total_amount: total,
    open_amount: overrides.open_amount ?? total,
    reserved_amount: overrides.reserved_amount ?? "0.00",
    lines: overrides.lines ?? [
      {
        id: `${overrides.id}-line-1`,
        description: overrides.description ?? "Hotel operating supplies",
        unit: "LOT",
        quantity: "1.00",
        unit_price: net,
        subtotal: net,
        discount: "0.00",
        net_amount: net,
        vat_rate: "7.00",
        vat_amount: vat,
        wht_rate: "3.00",
        wht_eligible_amount: net,
        account: "6100 - Operating expense",
        department: "300 - Food & Beverage",
        dimension: "FNB - Food & Beverage",
        po_no: `PO-${overrides.ap_no.slice(-4)}`,
        grn_no: `GRN-${overrides.ap_no.slice(-4)}`,
        match_status: overrides.match_status ?? "matched",
      },
    ],
    payments: overrides.payments ?? [],
    journal: overrides.journal ?? journalForInvoice(total, net, vat),
    attachments: overrides.attachments ?? [
      {
        id: `${overrides.id}-att`,
        name: `${overrides.vendor_invoice_no}.pdf`,
        kind: "invoice",
        added_at: "2026-08-20T08:30:00Z",
      },
    ],
    activity: overrides.activity ?? [
      activity("created", `Created ${overrides.ap_no}`),
      activity("matched", "PO and GRN matched"),
    ],
    capabilities:
      overrides.capabilities ??
      invoiceCapabilities({
        lifecycle,
        workflow_enabled: overrides.workflow_enabled ?? false,
      }),
  };
  return invoice;
}

function paymentJournal(
  applied: string,
  wht: string,
  net: string,
  fx = "0.00",
) {
  const lines = [
    {
      id: "p1",
      account: "2110",
      description: "Trade accounts payable",
      debit: applied,
      credit: "0.00",
    },
    {
      id: "p2",
      account: "2130",
      description: "WHT payable",
      debit: "0.00",
      credit: wht,
    },
    {
      id: "p3",
      account: "1112",
      description: "Bank clearing",
      debit: "0.00",
      credit: net,
    },
  ];
  if (compareDecimal(fx, "0.00") !== 0)
    lines.push({
      id: "p4",
      account: "7190",
      description: "Realized FX gain/loss",
      debit: compareDecimal(fx, "0.00") > 0 ? fx : "0.00",
      credit: compareDecimal(fx, "0.00") < 0 ? fx.slice(1) : "0.00",
    });
  return lines;
}

function seedState(): ApMockState {
  const invoices = [
    seedInvoice({
      id: "ap-1",
      ap_no: "AP2608-0001",
      vendor_invoice_no: "INV-SHS-8821",
      vendor_name: "Siam Hospitality Supply",
      due_date: "2026-08-01",
      net_amount: "100000.00",
      vat_amount: "7000.00",
      total_amount: "107000.00",
      open_amount: "107000.00",
      reserved_amount: "107000.00",
      description: "Food and beverage operating supplies",
    }),
    seedInvoice({
      id: "ap-2",
      ap_no: "AP2608-0002",
      vendor_invoice_no: "MEA-2026-08",
      vendor_name: "Metropolitan Electricity Authority",
      due_date: "2026-09-15",
      lifecycle: "submitted",
      workflow_enabled: true,
      current_stage: "Financial Controller",
      match_status: "not_required",
      tax_status: "pending",
      net_amount: "75000.00",
      vat_amount: "5250.00",
      total_amount: "80250.00",
      open_amount: "0.00",
      description: "August electricity bill",
    }),
    seedInvoice({
      id: "ap-3",
      ap_no: "AP2608-0003",
      vendor_invoice_no: "CLS-2608-117",
      vendor_name: "Clean Linen Services Co., Ltd.",
      due_date: "2026-09-20",
      currency_code: "USD",
      exchange_rate: "35.00000",
      net_amount: "3000.00",
      vat_amount: "210.00",
      total_amount: "3210.00",
      open_amount: "2140.00",
      settlement_status: "partially_paid",
      tax_status: "pending",
      payments: [
        {
          payment_id: "pv-3",
          payment_no: "PV2608-0003",
          payment_date: "2026-08-28",
          applied_amount: "1070.00",
          status: "executed",
        },
      ],
      description: "Laundry service contract",
    }),
    seedInvoice({
      id: "ap-4",
      ap_no: "DRAFT-0004",
      vendor_invoice_no: "OTIS-Q3-2691",
      vendor_name: "Otis Elevator (Thailand) Co., Ltd.",
      due_date: "2026-10-01",
      lifecycle: "draft",
      workflow_enabled: true,
      match_status: "variance",
      match_acknowledged: false,
      tax_status: "on_review",
      open_amount: "0.00",
      description: "Quarterly elevator maintenance",
    }),
    seedInvoice({
      id: "ap-5",
      ap_no: "AP2607-0005",
      vendor_invoice_no: "INV-BKK-778",
      vendor_name: "Bangkok Power Co., Ltd.",
      due_date: "2026-08-15",
      settlement_status: "paid",
      open_amount: "0.00",
      description: "Generator maintenance",
    }),
  ];
  const payment = (
    overrides: Partial<ApPayment> &
      Pick<ApPayment, "id" | "pv_no" | "vendor_id" | "vendor_name">,
  ): ApPayment => {
    const applied = overrides.applied_amount ?? "107000.00";
    const wht = overrides.wht_amount ?? "3000.00";
    const netPay = overrides.net_pay ?? subtractDecimal(applied, wht);
    const lifecycle = overrides.lifecycle ?? "submitted";
    const workflowEnabled = overrides.workflow_enabled ?? true;
    return {
      id: overrides.id,
      doc_version: 1,
      pv_no: overrides.pv_no,
      vendor_id: overrides.vendor_id,
      vendor_name: overrides.vendor_name,
      payment_date: overrides.payment_date ?? "2026-09-01",
      due_date: overrides.due_date ?? "2026-09-01",
      currency_code: overrides.currency_code ?? "THB",
      exchange_rate: overrides.exchange_rate ?? "1.00000",
      payment_method: overrides.payment_method ?? "bank_transfer",
      bank_account_masked: overrides.bank_account_masked ?? "BBL •••• 9887",
      payment_reference:
        overrides.payment_reference ?? `REF-${overrides.pv_no}`,
      description: overrides.description ?? "Supplier settlement",
      urgent: overrides.urgent ?? false,
      lifecycle,
      workflow_enabled: workflowEnabled,
      current_stage:
        overrides.current_stage ??
        (lifecycle === "submitted" ? "General Manager" : null),
      execution_status: overrides.execution_status ?? "not_released",
      applied_amount: applied,
      wht_amount: wht,
      net_pay: netPay,
      realized_fx: overrides.realized_fx ?? "0.00",
      applications: overrides.applications ?? [],
      journal:
        overrides.journal ??
        paymentJournal(applied, wht, netPay, overrides.realized_fx),
      attachments: overrides.attachments ?? [],
      activity: overrides.activity ?? [
        activity("created", `Created ${overrides.pv_no}`),
        activity("submitted", "Submitted for payment approval"),
      ],
      capabilities:
        overrides.capabilities ??
        paymentCapabilities({ lifecycle, workflow_enabled: workflowEnabled }),
      clarification_note: overrides.clarification_note ?? null,
    };
  };
  const payments = [
    payment({
      id: "pv-1",
      pv_no: "PV2609-0001",
      vendor_id: invoices[0].vendor_id,
      vendor_name: invoices[0].vendor_name,
      urgent: true,
      applications: [
        {
          id: "app-1",
          invoice_id: invoices[0].id,
          invoice_no: invoices[0].ap_no,
          vendor_invoice_no: invoices[0].vendor_invoice_no,
          po_no: invoices[0].lines[0].po_no,
          grn_no: invoices[0].lines[0].grn_no,
          original_amount: invoices[0].total_amount,
          open_amount: invoices[0].open_amount,
          apply_amount: "107000.00",
          wht_base: "100000.00",
          wht_rate: "3.00",
          wht_amount: "3000.00",
          net_cash: "104000.00",
          match_status: "matched",
        },
      ],
    }),
    payment({
      id: "pv-2",
      pv_no: "PV2609-0002",
      vendor_id: invoices[1].vendor_id,
      vendor_name: invoices[1].vendor_name,
      lifecycle: "draft",
      workflow_enabled: false,
      applied_amount: "80250.00",
      wht_amount: "0.00",
      net_pay: "80250.00",
      payment_method: "direct_debit",
      applications: [],
    }),
    payment({
      id: "pv-3",
      pv_no: "PV2608-0003",
      vendor_id: invoices[2].vendor_id,
      vendor_name: invoices[2].vendor_name,
      lifecycle: "posted",
      workflow_enabled: false,
      execution_status: "executed",
      currency_code: "USD",
      exchange_rate: "35.05000",
      applied_amount: "1070.00",
      wht_amount: "30.00",
      net_pay: "1040.00",
      realized_fx: "1.50",
      payment_date: "2026-08-28",
      due_date: "2026-08-28",
      applications: [],
    }),
  ];
  return { version: 1, invoices, payments, idempotency_keys: [] };
}

function withCapabilities(state: ApMockState): ApMockState {
  return {
    ...state,
    invoices: state.invoices.map((item) => ({
      ...item,
      capabilities: invoiceCapabilities(item),
    })),
    payments: state.payments.map((item) => ({
      ...item,
      capabilities: paymentCapabilities(item),
    })),
  };
}

function dueBucket(invoice: ApInvoice, asOf: string): string {
  if (!invoice.due_date) return "missing_due_date";
  const days = Math.floor(
    (Date.parse(`${asOf}T00:00:00Z`) -
      Date.parse(`${invoice.due_date}T00:00:00Z`)) /
      86_400_000,
  );
  if (days < 0) return "not_due";
  if (days === 0) return "due_today";
  if (days <= 30) return "overdue_1_30";
  if (days <= 60) return "overdue_31_60";
  if (days <= 90) return "overdue_61_90";
  return "overdue_90_plus";
}

export class ApVersionConflictError extends Error {}

export interface ApRepository {
  listInvoices(filters?: ApInvoiceFilters): Promise<ApInvoiceListResponse>;
  getInvoice(id: string): Promise<ApInvoice | null>;
  saveInvoice(
    input: ApInvoiceInput,
    id?: string,
    docVersion?: number,
  ): Promise<ApInvoice>;
  invoiceAction(
    id: string,
    action: "submit" | "approve" | "return" | "reject" | "void",
    docVersion: number,
  ): Promise<ApInvoice>;
  listPayments(filters?: ApPaymentFilters): Promise<ApPaymentListResponse>;
  listApprovals(filters?: ApPaymentFilters): Promise<ApPaymentListResponse>;
  getPayment(id: string): Promise<ApPayment | null>;
  savePayment(
    input: ApPaymentInput,
    id?: string,
    docVersion?: number,
  ): Promise<ApPayment>;
  paymentAction(
    id: string,
    action:
      | "submit"
      | "approve"
      | "return"
      | "reject"
      | "void"
      | "clarify",
    docVersion: number,
    idempotencyKey?: string,
    reason?: string,
  ): Promise<ApPayment>;
  dashboard(
    asOf: string,
    paidFrom: string,
    paidTo: string,
  ): Promise<ApDashboardSnapshot>;
}

export function createApMockRepository(buCode: string): ApRepository {
  const key = `${STORAGE_PREFIX}:${buCode}`;
  const load = (): ApMockState => {
    const raw = readStorage(key);
    if (!raw) {
      const state = seedState();
      writeStorage(key, JSON.stringify(state));
      return state;
    }
    try {
      const parsed = JSON.parse(raw) as ApMockState;
      if (parsed.version === 1) return parsed;
    } catch {
      /* reseed invalid mock storage */
    }
    const state = seedState();
    writeStorage(key, JSON.stringify(state));
    return state;
  };
  const store = (state: ApMockState) =>
    writeStorage(key, JSON.stringify(state));
  const assertVersion = (actual: number, expected?: number) => {
    if (expected !== undefined && actual !== expected)
      throw new ApVersionConflictError("Document was changed by another user");
  };

  return {
    async listInvoices(filters = {}) {
      let data = withCapabilities(load()).invoices;
      const search = filters.search?.toLowerCase();
      if (search)
        data = data.filter((item) =>
          `${item.ap_no} ${item.vendor_invoice_no} ${item.vendor_name} ${item.description}`
            .toLowerCase()
            .includes(search),
        );
      if (filters.lifecycle && filters.lifecycle !== "all")
        data = data.filter((item) => item.lifecycle === filters.lifecycle);
      if (filters.settlement)
        data = data.filter((item) =>
          filters.settlement === "open"
            ? item.settlement_status !== "paid"
            : item.settlement_status === filters.settlement,
        );
      if (filters.match)
        data = data.filter((item) => item.match_status === filters.match);
      if (filters.due_bucket)
        data = data.filter((item) => {
          if (
            item.lifecycle !== "posted" ||
            compareDecimal(item.open_amount, "0") <= 0
          )
            return false;
          const bucket = dueBucket(item, filters.as_of ?? "2026-09-01");
          return filters.due_bucket === "overdue"
            ? bucket.startsWith("overdue_")
            : bucket === filters.due_bucket;
        });
      if (filters.hold) data = data.filter((item) => item.is_on_hold);
      if (filters.reserved)
        data = data.filter(
          (item) => compareDecimal(item.reserved_amount, "0") > 0,
        );
      if (filters.tax)
        data = data.filter((item) => item.tax_status === filters.tax);
      return {
        data: clone(data),
        paginate: {
          page: 1,
          perpage: data.length,
          total: data.length,
          pages: 1,
        },
      };
    },
    async getInvoice(id) {
      return clone(
        withCapabilities(load()).invoices.find((item) => item.id === id) ??
          null,
      );
    },
    async saveInvoice(input, id, docVersion) {
      const state = load();
      const current = state.invoices.find((item) => item.id === id);
      if (current) assertVersion(current.doc_version, docVersion);
      const vendorInvoiceNo = input.vendor_invoice_no.trim().toUpperCase();
      if (
        vendorInvoiceNo &&
        state.invoices.some(
          (item) =>
            item.id !== id &&
            item.vendor_id === input.vendor_id &&
            item.vendor_invoice_no.trim().toUpperCase() === vendorInvoiceNo &&
            item.lifecycle !== "voided",
        )
      )
        throw new Error("Vendor invoice number already exists for this vendor");
      const subtotal = addDecimal(input.lines.map((line) => line.subtotal));
      const discount = addDecimal(input.lines.map((line) => line.discount));
      const net = addDecimal(input.lines.map((line) => line.net_amount));
      const vat = addDecimal(input.lines.map((line) => line.vat_amount));
      const total = addDecimal([net, vat]);
      const estimatedWht = addDecimal(
        input.lines.map((line) =>
          percentOf(line.wht_eligible_amount, line.wht_rate),
        ),
      );
      const lifecycle = current?.lifecycle ?? "draft";
      const invoice: ApInvoice = {
        ...(current ??
          seedInvoice({
            id: id ?? `ap-${Date.now()}`,
            ap_no: `DRAFT-${String(state.invoices.length + 1).padStart(4, "0")}`,
            vendor_invoice_no: input.vendor_invoice_no,
            vendor_name: input.vendor_name,
            lifecycle: "draft",
          })),
        ...input,
        vendor_invoice_no: vendorInvoiceNo,
        lifecycle,
        tax_invoice_no: current?.tax_invoice_no ?? null,
        tax_invoice_date: current?.tax_invoice_date ?? null,
        settlement_status: current?.settlement_status ?? "unpaid",
        doc_version: (current?.doc_version ?? 0) + 1,
        subtotal,
        discount,
        net_amount: net,
        vat_amount: vat,
        estimated_wht: estimatedWht,
        total_amount: total,
        open_amount:
          lifecycle === "posted" ? (current?.open_amount ?? total) : "0.00",
        journal: journalForInvoice(total, net, vat),
        activity: [
          ...(current?.activity ?? []),
          activity(
            current ? "updated" : "created",
            current ? "Invoice updated" : "Invoice created",
          ),
        ],
      };
      state.invoices = current
        ? state.invoices.map((item) =>
            item.id === invoice.id ? invoice : item,
          )
        : [invoice, ...state.invoices];
      store(state);
      return clone({ ...invoice, capabilities: invoiceCapabilities(invoice) });
    },
    async invoiceAction(id, action, docVersion) {
      const state = load();
      const current = state.invoices.find((item) => item.id === id);
      if (!current) throw new Error("Invoice not found");
      assertVersion(current.doc_version, docVersion);
      if (
        action === "submit" &&
        current.match_status === "variance" &&
        !current.match_acknowledged
      )
        throw new Error("Match variance must be acknowledged before submit");
      const lifecycle =
        action === "submit"
          ? current.workflow_enabled
            ? "submitted"
            : "posted"
          : action === "approve"
            ? "posted"
            : action === "void"
              ? "voided"
              : "draft";
      const next: ApInvoice = {
        ...current,
        lifecycle,
        tax_invoice_no:
          action === "submit" && compareDecimal(current.vat_amount, "0") > 0
            ? current.vendor_invoice_no
            : current.tax_invoice_no,
        tax_invoice_date:
          action === "submit" && compareDecimal(current.vat_amount, "0") > 0
            ? current.invoice_date
            : current.tax_invoice_date,
        doc_version: current.doc_version + 1,
        current_stage:
          lifecycle === "submitted" ? "Financial Controller" : null,
        open_amount:
          lifecycle === "posted" &&
          compareDecimal(current.open_amount, "0") === 0
            ? current.total_amount
            : current.open_amount,
        settlement_status:
          lifecycle === "posted"
            ? current.settlement_status
            : current.settlement_status,
        activity: [...current.activity, activity(action, `Invoice ${action}`)],
      };
      state.invoices = state.invoices.map((item) =>
        item.id === id ? next : item,
      );
      store(state);
      return clone({ ...next, capabilities: invoiceCapabilities(next) });
    },
    async listPayments(filters = {}) {
      let data = withCapabilities(load()).payments;
      const search = filters.search?.toLowerCase();
      if (search)
        data = data.filter((item) =>
          `${item.pv_no} ${item.vendor_name} ${item.payment_reference}`
            .toLowerCase()
            .includes(search),
        );
      if (filters.lifecycle && filters.lifecycle !== "all")
        data = data.filter((item) => item.lifecycle === filters.lifecycle);
      if (filters.execution)
        data = data.filter(
          (item) => item.execution_status === filters.execution,
        );
      if (filters.method)
        data = data.filter((item) => item.payment_method === filters.method);
      if (filters.urgent) data = data.filter((item) => item.urgent);
      return {
        data: clone(data),
        paginate: {
          page: 1,
          perpage: data.length,
          total: data.length,
          pages: 1,
        },
      };
    },
    async listApprovals(filters = {}) {
      const response = await this.listPayments(filters);
      const data = response.data.filter((item) => {
        return item.lifecycle === "submitted";
      });
      return {
        data,
        paginate: {
          page: 1,
          perpage: data.length,
          total: data.length,
          pages: 1,
        },
      };
    },
    async getPayment(id) {
      return clone(
        withCapabilities(load()).payments.find((item) => item.id === id) ??
          null,
      );
    },
    async savePayment(input, id, docVersion) {
      const state = load();
      const current = state.payments.find((item) => item.id === id);
      if (current) assertVersion(current.doc_version, docVersion);
      if (current && !paymentCapabilities(current).can_edit)
        throw new Error("This payment is read-only");
      if (compareDecimal(input.exchange_rate, "0") <= 0)
        throw new Error("Exchange rate must be greater than zero");
      const sourceInvoices = new Map(
        state.invoices.map((invoice) => [invoice.id, invoice]),
      );
      input = {
        ...input,
        applications: input.applications.map((item) => {
          const invoice = sourceInvoices.get(item.invoice_id);
          return {
            ...item,
            original_rate: invoice?.exchange_rate ?? item.original_rate,
            invoice_date: invoice?.invoice_date ?? item.invoice_date,
            description: invoice?.description ?? item.description,
            net_amount: invoice?.net_amount ?? item.net_amount,
            vat_amount: invoice?.vat_amount ?? item.vat_amount,
            tax_status: invoice?.tax_status ?? item.tax_status,
            net_cash: subtractDecimal(item.apply_amount, item.wht_amount),
          };
        }),
      };
      const uniqueInvoices = new Set(
        input.applications.map((item) => item.invoice_id),
      );
      if (uniqueInvoices.size !== input.applications.length)
        throw new Error("Duplicate invoice application");
      input.applications.forEach((application) => {
        const invoice = sourceInvoices.get(application.invoice_id);
        if (!invoice || invoice.lifecycle !== "posted")
          throw new Error(
            `Invoice ${application.invoice_no} is not eligible for payment`,
          );
        if (compareDecimal(application.apply_amount, invoice.open_amount) > 0)
          throw new Error(
            `Apply amount exceeds open amount for ${application.invoice_no}`,
          );
        if (
          invoice.vendor_id !== input.vendor_id ||
          invoice.currency_code !== input.currency_code
        )
          throw new Error("Payment invoices must share vendor and currency");
        if (compareDecimal(application.apply_amount, "0") <= 0)
          throw new Error("Pay amount must be greater than zero");
        if (
          compareDecimal(application.wht_amount, "0") < 0 ||
          compareDecimal(application.wht_amount, application.apply_amount) > 0
        )
          throw new Error("WHT must be between zero and pay amount");
        if (
          compareDecimal(
            application.wht_amount,
            percentOf(application.wht_base, application.wht_rate),
          ) !== 0 &&
          !application.wht_override_reason?.trim()
        )
          throw new Error("A reason is required for WHT override");
      });
      const applied = addDecimal(
        input.applications.map((item) => item.apply_amount),
      );
      const wht = addDecimal(input.applications.map((item) => item.wht_amount));
      const claimsByTaxInvoice = new Map<string, string>();
      for (const allocation of input.tax_allocations ?? []) {
        const application = input.applications.find(
          (item) => item.invoice_id === allocation.invoice_id,
        );
        const tax = input.tax_invoices?.find(
          (item) => item.id === allocation.tax_invoice_id,
        );
        if (compareDecimal(allocation.claim_amount, "0") < 0)
          throw new Error("VAT claim cannot be negative");
        if (compareDecimal(allocation.claim_amount, "0") === 0) continue;
        if (!application || !tax)
          throw new Error("Link a received tax invoice before claiming VAT");
        const invoice = sourceInvoices.get(allocation.invoice_id);
        if (
          !invoice ||
          invoice.tax_status === "confirmed" ||
          invoice.tax_status === "filed"
        )
          throw new Error("Input VAT is already confirmed on this invoice");
        if (
          compareDecimal(
            allocation.claim_amount,
            subtractDecimal(
              multiplyDecimal(invoice.vat_amount, invoice.exchange_rate),
              invoice.claimed_vat_base ?? "0",
            ),
          ) > 0
        )
          throw new Error("VAT claim exceeds original undue VAT");
        claimsByTaxInvoice.set(
          tax.id,
          addDecimal([
            claimsByTaxInvoice.get(tax.id) ?? "0",
            allocation.claim_amount,
          ]),
        );
      }
      for (const tax of input.tax_invoices ?? []) {
        if (
          compareDecimal(
            claimsByTaxInvoice.get(tax.id) ?? "0",
            tax.vat_amount,
          ) > 0
        )
          throw new Error("Allocated VAT exceeds received tax invoice VAT");
      }
      const summary = paymentSummary(input);
      const net = summary.net_cash;
      const lifecycle = current?.lifecycle ?? "draft";
      const payment: ApPayment = {
        ...(current ?? {
          id: id ?? `pv-${Date.now()}`,
          pv_no: `DRAFT-PV-${String(state.payments.length + 1).padStart(4, "0")}`,
          lifecycle,
          execution_status: "not_released",
          current_stage: null,
          realized_fx: "0.00",
          attachments: [],
          activity: [],
          clarification_note: null,
        }),
        ...input,
        doc_version: (current?.doc_version ?? 0) + 1,
        applied_amount: applied,
        wht_amount: wht,
        net_pay: net,
        net_pay_base: summary.net_base,
        journal: summary.journal,
        realized_fx: summary.fx,
        capabilities: paymentCapabilities({
          lifecycle,
          workflow_enabled: input.workflow_enabled,
        }),
        activity: [
          ...(current?.activity ?? []),
          activity(
            current ? "updated" : "created",
            current ? "Payment updated" : "Payment created",
          ),
        ],
      };
      const reservedByInvoice = new Map(
        input.applications.map((item) => [item.invoice_id, item.apply_amount]),
      );
      state.invoices = state.invoices.map((invoice) =>
        reservedByInvoice.has(invoice.id)
          ? { ...invoice, reserved_amount: reservedByInvoice.get(invoice.id)! }
          : invoice,
      );
      state.payments = current
        ? state.payments.map((item) =>
            item.id === payment.id ? payment : item,
          )
        : [payment, ...state.payments];
      store(state);
      return clone(payment);
    },
    async paymentAction(id, action, docVersion, idempotencyKey, reason) {
      const state = load();
      const current = state.payments.find((item) => item.id === id);
      if (!current) throw new Error("Payment not found");
      if (
        (action === "submit" || action === "approve") &&
        idempotencyKey &&
        state.idempotency_keys.includes(idempotencyKey)
      )
        return current;
      assertVersion(current.doc_version, docVersion);
      const capability =
        action === "clarify"
          ? "can_return"
          : (`can_${action}` as keyof ApDocumentCapabilities);
      if (!paymentCapabilities(current)[capability])
        throw new Error(`Cannot ${action} this payment`);
      if (
        (action === "approve" || action === "submit") &&
        current.paid_date &&
        current.paid_date.slice(0, 7) !== now().slice(0, 7)
      )
        throw new Error(
          "Accounting period is closed (mock: current month is open)",
        );
      if (action === "submit" || action === "approve") {
        if (!current.applications.length)
          throw new Error("Select at least one invoice");
        if (current.payment_methods) {
          const allocation = addDecimal(
            current.payment_methods.map((item) =>
              multiplyDecimal(item.amount, current.exchange_rate),
            ),
          );
          if (
            compareDecimal(allocation, paymentSummary(current).net_base) !== 0
          )
            throw new Error(
              "Payment method allocations must equal net outflow",
            );
        }
        for (const application of current.applications) {
          const invoice = state.invoices.find(
            (item) => item.id === application.invoice_id,
          );
          if (
            !invoice ||
            invoice.lifecycle !== "posted" ||
            compareDecimal(application.apply_amount, invoice.open_amount) > 0
          )
            throw new Error("Invoice open amount has changed; review payment");
        }
      }
      if (idempotencyKey && state.idempotency_keys.includes(idempotencyKey))
        return clone({
          ...current,
          capabilities: paymentCapabilities(current),
        });
      let lifecycle = current.lifecycle;
      let execution = current.execution_status;
      if (action === "submit")
        lifecycle = current.workflow_enabled ? "submitted" : "posted";
      if (action === "approve") lifecycle = "posted";
      if (action === "return" || action === "reject") lifecycle = "draft";
      if (action === "void") {
        lifecycle = "voided";
        execution = "cancelled";
      }
      const next: ApPayment = {
        ...current,
        lifecycle,
        paid_date: current.paid_date ?? current.payment_date,
        execution_status: execution,
        doc_version: current.doc_version + 1,
        current_stage: lifecycle === "submitted" ? "General Manager" : null,
        clarification_note:
          action === "clarify"
            ? (reason ?? "Clarification requested from AP Officer")
            : current.clarification_note,
        activity: [
          ...current.activity,
          activity(
            action,
            reason ? `Payment ${action}: ${reason}` : `Payment ${action}`,
          ),
        ],
      };
      if (lifecycle === "posted") {
        next.applications.forEach((application) => {
          const invoice = state.invoices.find(
            (item) => item.id === application.invoice_id,
          );
          if (!invoice) return;
          const openAmount = subtractDecimal(
            invoice.open_amount,
            application.apply_amount,
          );
          const history: ApInvoicePaymentHistory = {
            payment_id: next.id,
            payment_no: next.pv_no,
            payment_date: next.paid_date ?? next.payment_date,
            applied_amount: application.apply_amount,
            status: "posted",
          };
          state.invoices = state.invoices.map((item) =>
            item.id === invoice.id
              ? {
                  ...invoice,
                  open_amount: openAmount,
                  claimed_vat_base: addDecimal([
                    invoice.claimed_vat_base ?? "0",
                    ...(next.tax_allocations ?? [])
                      .filter(
                        (allocation) => allocation.invoice_id === invoice.id,
                      )
                      .map((allocation) => allocation.claim_amount),
                  ]),
                  reserved_amount: "0.00",
                  settlement_status:
                    compareDecimal(openAmount, "0") === 0
                      ? "paid"
                      : "partially_paid",
                  payments: [...invoice.payments, history],
                  doc_version: invoice.doc_version + 1,
                }
              : item,
          );
        });
      }
      state.payments = state.payments.map((item) =>
        item.id === id ? next : item,
      );
      if (idempotencyKey) state.idempotency_keys.push(idempotencyKey);
      store(state);
      return clone({ ...next, capabilities: paymentCapabilities(next) });
    },
    async dashboard(asOf, paidFrom, paidTo) {
      const state = withCapabilities(load());
      const open = state.invoices.filter(
        (item) =>
          item.lifecycle === "posted" &&
          compareDecimal(item.open_amount, "0") > 0,
      );
      const codes: ApDashboardSnapshot["aging"][number]["code"][] = [
        "not_due",
        "due_today",
        "overdue_1_30",
        "overdue_31_60",
        "overdue_61_90",
        "overdue_90_plus",
        "missing_due_date",
      ];
      const aging = codes.map((code) => {
        const rows = open.filter((item) => dueBucket(item, asOf) === code);
        return {
          code,
          amount: addDecimal(
            rows.map((item) =>
              multiplyDecimal(item.open_amount, item.exchange_rate),
            ),
          ),
          item_count: rows.length,
          vendor_count: new Set(rows.map((item) => item.vendor_id)).size,
        };
      });
      const outstanding = addDecimal(
        open.map((item) =>
          multiplyDecimal(item.open_amount, item.exchange_rate),
        ),
      );
      const agingTotal = addDecimal(aging.map((item) => item.amount));
      const paid = state.payments.filter(
        (item) =>
          item.lifecycle === "posted" &&
          (item.paid_date ?? item.payment_date) >= paidFrom &&
          (item.paid_date ?? item.payment_date) <= paidTo,
      );
      return {
        bu_code: buCode,
        as_of_date: asOf,
        paid_from: paidFrom,
        paid_to: paidTo,
        functional_currency: "THB",
        generated_at: now(),
        outstanding_amount: outstanding,
        outstanding_count: open.length,
        prepaid_amount: "0.00",
        prepaid_count: 0,
        paid_out_amount: addDecimal(
          paid.map(
            (item) =>
              item.net_pay_base ??
              multiplyDecimal(item.net_pay, item.exchange_rate),
          ),
        ),
        payment_count: paid.length,
        aging,
        due: {
          overdue: open.filter((item) =>
            dueBucket(item, asOf).startsWith("overdue"),
          ).length,
          on_hold: open.filter((item) => item.is_on_hold).length,
          reserved: open.filter(
            (item) => compareDecimal(item.reserved_amount, "0") > 0,
          ).length,
        },
        approvals: {
          invoice: state.invoices.filter(
            (item) => item.lifecycle === "submitted",
          ).length,
          payment: state.payments.filter(
            (item) => item.lifecycle === "submitted",
          ).length,
        },
        tax: {
          pending_vat: addDecimal(
            state.invoices
              .filter((item) => item.tax_status === "pending")
              .map((item) =>
                multiplyDecimal(item.vat_amount, item.exchange_rate),
              ),
          ),
          missing_documents: state.invoices.filter(
            (item) =>
              item.lifecycle === "posted" && item.attachments.length === 0,
          ).length,
          pending_corrections: state.invoices.filter(
            (item) =>
              item.match_status === "variance" && !item.match_acknowledged,
          ).length,
        },
        reconciliation_variance: subtractDecimal(outstanding, agingTotal),
        widget_errors: [],
      };
    },
  };
}

export function clearApMockStorage(buCode: string): void {
  const key = `${STORAGE_PREFIX}:${buCode}`;
  if (typeof window !== "undefined") window.localStorage.removeItem(key);
  memory.delete(key);
}
