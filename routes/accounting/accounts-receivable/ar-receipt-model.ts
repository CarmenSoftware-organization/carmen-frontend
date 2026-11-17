import { z } from "zod";
import { round2 } from "@/lib/currency-utils";
import type { ArRegisterDocument, ArRegisterRow } from "./use-ar-register";
import type { ArCustomer } from "./use-ar-customer";

export const AR_RECEIPT_PATH = "/accounting/accounts-receivable/receipt";
export const RECEIPT_PAY_TYPES = [
  "bank_transfer",
  "cash",
  "cheque",
  "credit_card",
] as const;
const amount = z.number().finite().nonnegative().max(999999999999);
const taxEntitySchema = z.object({
  registeredName: z.string().max(255),
  taxId: z.string().max(13),
  branchNo: z.string().max(5),
  address1: z.string().max(255),
  address2: z.string().max(255),
  province: z.string().max(100),
  postalCode: z.string().max(5),
});
const allocationSchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  date: z.string(),
  customerId: z.string().min(1),
  currency: z.string().min(1),
  outstanding: amount,
  amount,
  netAmount: amount,
  vatAmount: amount,
  totalAmount: amount,
});
const paymentSchema = z.object({
  id: z.string().min(1),
  type: z.enum(RECEIPT_PAY_TYPES),
  date: z.iso.date(),
  amount,
  reference: z.string().max(100),
  bank: z.string().max(150),
  branch: z.string().max(150),
  bankAccount: z.string().max(100),
  chequeNo: z.string().max(50),
  chequeDate: z.string(),
  cardLast4: z.string().max(4),
  accountId: z.string(),
  accountLabel: z.string(),
  costCenterId: z.string().default(""),
  // Keep old mock records readable; department IDs are not GL cost center IDs.
  departmentId: z.string().optional(),
});
const receiptSchema = z.object({
  id: z.string().min(1),
  number: z.string(),
  date: z.iso.date(),
  status: z.enum(["draft", "void"]),
  customerId: z.string().min(1),
  customerCode: z.string().min(1),
  customerName: z.string().min(1),
  currency: z.string().trim().length(3),
  rate: z.number().finite().positive(),
  creditDays: z.number().int().nonnegative().max(3650),
  source: z.enum(["manual", "copy", "invoice"]),
  sourceDoc: z.string().max(100),
  description: z.string().max(255),
  taxInvoice: z.boolean(),
  taxInvoiceNo: z.string(),
  taxDate: z.iso.date(),
  taxEntity: taxEntitySchema,
  whtEnabled: z.boolean(),
  whtAmount: amount,
  whtCertificate: z.string().max(100),
  whtService: z.string().default("NONE"),
  defaultPaymentType: z.enum(RECEIPT_PAY_TYPES).default("bank_transfer"),
  allocations: z.array(allocationSchema),
  payments: z.array(paymentSchema),
});

export type ArReceipt = z.infer<typeof receiptSchema>;
export type ReceiptAllocation = z.infer<typeof allocationSchema>;
export type ReceiptPayment = z.infer<typeof paymentSchema>;
export type ReceiptTaxEntity = z.infer<typeof taxEntitySchema>;

export function receiptTaxEntityFromCustomer(
  customer: ArCustomer,
): ReceiptTaxEntity {
  const addresses = customer.customer_address?.filter(
    (address) => address.is_active !== false,
  );
  const address =
    addresses?.find((row) => row.address_type === "register_address") ??
    addresses?.find((row) => row.address_type === "billing_address");
  return {
    registeredName: customer.registered_name ?? customer.name,
    taxId: customer.tax_no ?? "",
    branchNo: customer.branch_no ?? "00000",
    address1: address?.address_line1 ?? "",
    address2: [address?.address_line2, address?.sub_district, address?.district]
      .filter(Boolean)
      .join(" "),
    province: address?.province ?? "",
    postalCode: address?.postal_code ?? "",
  };
}
export type ReceiptValidationError =
  | "customerRequired"
  | "invalidReceipt"
  | "invoiceMismatch"
  | "allocationExceedsOutstanding"
  | "duplicateInvoice"
  | "whtExceedsAllocation"
  | "invalidTaxId"
  | "invalidBranchNo";

export function newReceipt(date: string, currency = "THB"): ArReceipt {
  return {
    id: crypto.randomUUID(),
    number: "",
    date,
    status: "draft",
    customerId: "",
    customerCode: "",
    customerName: "",
    currency,
    rate: 1,
    creditDays: 0,
    source: "manual",
    sourceDoc: "",
    description: "",
    taxInvoice: false,
    taxInvoiceNo: "",
    taxDate: date,
    taxEntity: {
      registeredName: "",
      taxId: "",
      branchNo: "00000",
      address1: "",
      address2: "",
      province: "",
      postalCode: "",
    },
    whtEnabled: false,
    whtAmount: 0,
    whtCertificate: "",
    whtService: "NONE",
    defaultPaymentType: "bank_transfer",
    allocations: [],
    payments: [],
  };
}

export function newReceiptPayment(
  date: string,
  type: ReceiptPayment["type"] = "bank_transfer",
): ReceiptPayment {
  return {
    id: crypto.randomUUID(),
    type,
    date,
    amount: 0,
    reference: "",
    bank: "",
    branch: "",
    bankAccount: "",
    chequeNo: "",
    chequeDate: date,
    cardLast4: "",
    accountId: "",
    accountLabel: "",
    costCenterId: "",
  };
}

export function receiptProfileDefaults(local: {
  paymentType?: string;
  whtService?: string;
}) {
  const payTypes: Record<string, ReceiptPayment["type"]> = {
    BANK: "bank_transfer",
    CASH: "cash",
    CHQ: "cheque",
    CC: "credit_card",
  };
  return {
    defaultPaymentType:
      payTypes[local.paymentType ?? ""] ?? ("bank_transfer" as const),
    whtService: local.whtService ?? "NONE",
  };
}

export function suggestedReceiptWht(
  receipt: Pick<ArReceipt, "allocations" | "whtService">,
) {
  const rates: Record<string, number> = {
    "01": 3,
    "02": 5,
    "03": 2,
    "04": 1,
    "05": 3,
  };
  const base = receipt.allocations.reduce(
    (sum, line) =>
      sum +
      (line.totalAmount > 0
        ? (line.netAmount * line.amount) / line.totalAmount
        : 0),
    0,
  );
  return round2((base * (rates[receipt.whtService] ?? 0)) / 100);
}

export function newReceiptFromInvoice(
  invoice: ArRegisterDocument,
  date: string,
): ArReceipt {
  const receipt = newReceipt(date, invoice.currency_code);
  return {
    ...receipt,
    rate: Number(invoice.exchange_rate ?? 1),
    customerId: invoice.customer_id,
    customerCode: invoice.customer_code,
    customerName: invoice.customer_name,
    creditDays: invoice.credit_term_days ?? 0,
    source: "invoice",
    sourceDoc: invoice.doc_no,
    description: invoice.description ?? "",
    taxEntity: {
      ...receipt.taxEntity,
      registeredName:
        invoice.tax_invoice?.customer_registered_name ?? invoice.customer_name,
      taxId: invoice.tax_invoice?.customer_tax_no ?? "",
      branchNo: invoice.tax_invoice?.customer_branch_no ?? "00000",
      address1: invoice.tax_invoice?.address_line1 ?? "",
      address2: invoice.tax_invoice?.address_line2 ?? "",
      province: invoice.tax_invoice?.province ?? "",
      postalCode: invoice.tax_invoice?.postal_code ?? "",
    },
    allocations: [allocationFromInvoice(invoice, invoice.customer_id)],
  };
}

export function receiptTotals(
  receipt: Pick<
    ArReceipt,
    "allocations" | "payments" | "whtEnabled" | "whtAmount" | "rate"
  >,
) {
  const allocated = round2(
    receipt.allocations.reduce((sum, row) => sum + row.amount, 0),
  );
  const received = round2(
    receipt.payments.reduce((sum, row) => sum + row.amount, 0),
  );
  const wht = receipt.whtEnabled ? round2(receipt.whtAmount) : 0;
  return {
    allocated,
    received,
    wht,
    settlement: round2(received + wht),
    unapplied: round2(received + wht - allocated),
    baseReceived: round2(received * receipt.rate),
  };
}

export function receiptValidation(
  receipt: ArReceipt,
): ReceiptValidationError | null {
  if (!receipt.customerId || !receipt.customerName) return "customerRequired";
  if (!receiptSchema.safeParse(receipt).success) return "invalidReceipt";
  const ids = new Set<string>();
  for (const line of receipt.allocations) {
    if (
      line.customerId !== receipt.customerId ||
      line.currency !== receipt.currency
    )
      return "invoiceMismatch";
    if (line.amount > line.outstanding) return "allocationExceedsOutstanding";
    if (ids.has(line.id)) return "duplicateInvoice";
    ids.add(line.id);
  }
  if (
    receipt.whtEnabled &&
    receipt.whtAmount > receiptTotals(receipt).allocated
  )
    return "whtExceedsAllocation";
  if (
    receipt.taxInvoice &&
    receipt.taxEntity.taxId &&
    !/^\d{13}$/.test(receipt.taxEntity.taxId)
  )
    return "invalidTaxId";
  if (
    receipt.taxInvoice &&
    receipt.taxEntity.branchNo &&
    !/^\d{5}$/.test(receipt.taxEntity.branchNo)
  )
    return "invalidBranchNo";
  return null;
}

export function allocationFromInvoice(
  invoice: ArRegisterRow,
  customerId: string,
): ReceiptAllocation {
  const document = invoice as Partial<ArRegisterDocument>;
  return {
    id: invoice.id,
    number: invoice.doc_no,
    date: invoice.doc_date.slice(0, 10),
    customerId,
    currency: invoice.currency_code,
    outstanding: Number(invoice.outstanding_amount),
    amount: Number(invoice.outstanding_amount),
    netAmount: Number(document.net_amount ?? 0),
    vatAmount: Number(document.vat_amount ?? 0),
    totalAmount: Number(invoice.total_amount),
  };
}

export function receiptAllocationTax(
  line: ReceiptAllocation,
  exchangeRate: number,
) {
  const ratio = line.totalAmount > 0 ? line.amount / line.totalAmount : 0;
  const base = round2(line.netAmount * ratio * exchangeRate);
  const tax = round2(line.vatAmount * ratio * exchangeRate);
  return {
    base,
    tax,
    total: round2(base + tax),
    rate:
      line.netAmount > 0 ? round2((line.vatAmount / line.netAmount) * 100) : 0,
  };
}

const storageKey = (bu: string) => `carmen.ar.receipt-mock.v1.${bu}`;

function sampleReceipts(): ArReceipt[] {
  const first = newReceipt("2026-11-12");
  const second = newReceipt("2026-11-16");
  return [first, second].map((row, index) => ({
    ...row,
    id: `sample-receipt-${index + 1}`,
    number: `ARRC-SAMPLE-00${index + 1}`,
    customerId: `sample-customer-${index + 1}`,
    customerCode: `SAMPLE-00${index + 1}`,
    customerName: index ? "Example Events" : "Example Travel",
    description: index
      ? "Sample cheque receipt"
      : "Sample bank transfer receipt",
    allocations: [
      {
        id: `sample-invoice-${index + 1}`,
        number: `ARIV-SAMPLE-00${index + 1}`,
        date: row.date,
        customerId: `sample-customer-${index + 1}`,
        currency: "THB",
        outstanding: index ? 21400 : 10700,
        amount: index ? 21400 : 10700,
        netAmount: index ? 20000 : 10000,
        vatAmount: index ? 1400 : 700,
        totalAmount: index ? 21400 : 10700,
      },
    ],
    payments: [
      {
        ...newReceiptPayment(row.date),
        amount: index ? 21400 : 10700,
        type: index ? ("cheque" as const) : ("bank_transfer" as const),
        reference: "SAMPLE",
        chequeNo: index ? "SAMPLE-001" : "",
      },
    ],
  }));
}

// Receipt endpoints do not exist yet. These records remain BU-scoped browser-session drafts;
// they never settle API invoices, issue tax numbers, update a bank ledger or post a JV.
export function readReceipts(bu: string): ArReceipt[] {
  const stored = sessionStorage.getItem(storageKey(bu));
  return stored
    ? z.array(receiptSchema).parse(JSON.parse(stored))
    : sampleReceipts();
}

export function saveReceipt(bu: string, receipt: ArReceipt): ArReceipt {
  const error = receiptValidation(receipt);
  if (error) throw new Error(error);
  const rows = readReceipts(bu);
  const current = rows.find((row) => row.id === receipt.id);
  if (current?.status === "void") throw new Error("receiptVoided");
  const saved = {
    ...receipt,
    number:
      current?.number ?? `ARRC-MOCK-${receipt.id.slice(0, 8).toUpperCase()}`,
  };
  sessionStorage.setItem(
    storageKey(bu),
    JSON.stringify([saved, ...rows.filter((row) => row.id !== receipt.id)]),
  );
  return saved;
}

export function deleteReceipt(bu: string, id: string) {
  const rows = readReceipts(bu);
  if (!rows.some((row) => row.id === id)) throw new Error("receiptNotFound");
  sessionStorage.setItem(
    storageKey(bu),
    JSON.stringify(rows.filter((row) => row.id !== id)),
  );
}

export function voidReceipt(bu: string, id: string): ArReceipt {
  const rows = readReceipts(bu);
  const receipt = rows.find((row) => row.id === id);
  if (!receipt) throw new Error("receiptNotFound");
  const saved: ArReceipt = { ...receipt, status: "void" };
  sessionStorage.setItem(
    storageKey(bu),
    JSON.stringify(rows.map((row) => (row.id === id ? saved : row))),
  );
  return saved;
}
