import { z } from "zod";
import { round2 } from "@/lib/currency-utils";
import type { ArRegisterDocument, ArRegisterRow } from "./use-ar-register";
import type { ArCustomer } from "./use-ar-customer";
import {
  AR_RECEIPT_METHODS,
  AR_RECEIPT_STATUS,
  type ArInvoiceDocType,
  type ArReceiptDocument,
  type ArReceiptPayload,
  type ArReceiptSource,
  type OutstandingInvoice,
} from "./use-ar-receipt";

export const AR_RECEIPT_PATH = "/accounting/accounts-receivable/receipt";
export const RECEIPT_PAY_TYPES = AR_RECEIPT_METHODS;
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
  /** ar_invoice id */
  id: z.string().min(1),
  number: z.string(),
  docType: z.enum(["invoice", "credit_note", "debit_note", "deposit"]),
  date: z.string(),
  customerId: z.string().min(1),
  currency: z.string().min(1),
  /** cap for this receipt: the available amount after other receipts' reservations */
  outstanding: amount,
  /** positive magnitude; credit notes count negative in the totals */
  amount,
  netAmount: amount,
  vatAmount: amount,
  totalAmount: amount,
});
/** The single tender (one payment channel per receipt) */
const tenderSchema = z.object({
  method: z.enum(RECEIPT_PAY_TYPES),
  /** received_date */
  date: z.iso.date(),
  /** net_received_amount: what actually reached the bank */
  amount,
  charge: amount,
  reference: z.string().max(100),
  payerName: z.string().max(200),
  chequeNo: z.string().max(50),
  chequeDate: z.string(),
  bankAccountId: z.string(),
  bankAccountLabel: z.string(),
});
const receiptSchema = z.object({
  id: z.string().min(1),
  number: z.string(),
  version: z.number().int().nullable(),
  date: z.iso.date(),
  status: z.enum(AR_RECEIPT_STATUS),
  customerId: z.string().min(1),
  customerCode: z.string().min(1),
  customerName: z.string().min(1),
  currency: z.string().trim().length(3),
  currencyId: z.string(),
  rate: z.number().finite().positive(),
  source: z.enum(["manual", "copy", "interface"]),
  sourceDoc: z.string().max(100),
  description: z.string().max(255),
  taxInvoice: z.boolean(),
  taxInvoiceNo: z.string(),
  taxDate: z.iso.date(),
  taxEntity: taxEntitySchema,
  whtEnabled: z.boolean(),
  whtProfileId: z.string(),
  whtAmount: amount,
  /** stored WHT base: kept when the invoice is not in the outstanding list so a re-save does not send 0 */
  whtBase: amount,
  whtCertificate: z.string().max(100),
  whtCertificateDate: z.string(),
  tender: tenderSchema,
  allocations: z.array(allocationSchema),
});

export type ArReceipt = z.infer<typeof receiptSchema>;
export type ReceiptAllocation = z.infer<typeof allocationSchema>;
export type ReceiptTender = z.infer<typeof tenderSchema>;
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
  | "bankAccountRequired"
  | "invalidReceipt"
  | "invoiceMismatch"
  | "allocationExceedsOutstanding"
  | "duplicateInvoice"
  | "whtExceedsAllocation"
  | "whtProfileRequired"
  | "overAllocated"
  | "emptyReceipt"
  | "invalidTaxId"
  | "invalidBranchNo";

const emptyTaxEntity = (): ReceiptTaxEntity => ({
  registeredName: "",
  taxId: "",
  branchNo: "00000",
  address1: "",
  address2: "",
  province: "",
  postalCode: "",
});

export function newReceiptTender(
  date: string,
  method: ReceiptTender["method"] = "bank_transfer",
): ReceiptTender {
  return {
    method,
    date,
    amount: 0,
    charge: 0,
    reference: "",
    payerName: "",
    chequeNo: "",
    chequeDate: date,
    bankAccountId: "",
    bankAccountLabel: "",
  };
}

export function newReceipt(
  date: string,
  currency = "THB",
  currencyId = "",
): ArReceipt {
  return {
    id: crypto.randomUUID(),
    number: "",
    version: null,
    date,
    status: "draft",
    customerId: "",
    customerCode: "",
    customerName: "",
    currency,
    currencyId,
    rate: 1,
    source: "manual",
    sourceDoc: "",
    description: "",
    taxInvoice: false,
    taxInvoiceNo: "",
    taxDate: date,
    taxEntity: emptyTaxEntity(),
    whtEnabled: false,
    whtProfileId: "",
    whtAmount: 0,
    whtBase: 0,
    whtCertificate: "",
    whtCertificateDate: "",
    tender: newReceiptTender(date),
    allocations: [],
  };
}

/** Customer-profile payment type code -> receipt method */
export function receiptProfileDefaults(local: { paymentType?: string }) {
  const methods: Record<string, ReceiptTender["method"]> = {
    BANK: "bank_transfer",
    CASH: "cash",
    CHQ: "cheque",
    CC: "credit_card",
    PP: "promptpay",
  };
  return {
    defaultPaymentType:
      methods[local.paymentType ?? ""] ?? ("bank_transfer" as const),
  };
}

const signOf = (docType: ArInvoiceDocType) =>
  docType === "credit_note" ? -1 : 1;
const signedAmount = (line: ReceiptAllocation) =>
  signOf(line.docType) * line.amount;

/** Allocated value before VAT, positive (non credit-note) lines only: the WHT base */
export function receiptWhtBase(receipt: Pick<ArReceipt, "allocations">) {
  return round2(
    receipt.allocations.reduce(
      (sum, line) =>
        sum +
        (line.docType !== "credit_note" && line.totalAmount > 0
          ? (line.netAmount * line.amount) / line.totalAmount
          : 0),
      0,
    ),
  );
}

/** WHT suggested from the tax profile's rate (percent) over the pre-VAT allocated value */
export function suggestedReceiptWht(
  profileRate: number,
  receipt: Pick<ArReceipt, "allocations">,
) {
  return round2((receiptWhtBase(receipt) * profileRate) / 100);
}

export function newReceiptFromInvoice(
  invoice: ArRegisterDocument,
  date: string,
): ArReceipt {
  const receipt = newReceipt(date, invoice.currency_code, invoice.currency_id);
  return {
    ...receipt,
    rate: Number(invoice.exchange_rate ?? 1),
    customerId: invoice.customer_id,
    customerCode: invoice.customer_code,
    customerName: invoice.customer_name,
    source: "manual",
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
    "allocations" | "tender" | "whtEnabled" | "whtAmount"
  >,
) {
  const applied = round2(
    receipt.allocations.reduce((sum, row) => sum + signedAmount(row), 0),
  );
  const received = round2(receipt.tender.amount);
  const wht = receipt.whtEnabled ? round2(receipt.whtAmount) : 0;
  const charge = round2(receipt.tender.charge);
  const settlement = round2(received + wht + charge);
  return {
    applied,
    wht,
    charge,
    settlement,
    received,
    /** settlement - applied: the overpayment kept as customer advance */
    unapplied: round2(settlement - applied),
  };
}

export function receiptValidation(
  receipt: ArReceipt,
): ReceiptValidationError | null {
  if (!receipt.customerId || !receipt.customerName) return "customerRequired";
  if (!receipt.tender.bankAccountId) return "bankAccountRequired";
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
  if (receipt.whtEnabled && !receipt.whtProfileId) return "whtProfileRequired";
  const totals = receiptTotals(receipt);
  if (
    receipt.whtEnabled &&
    receipt.whtAmount >
      round2(
        receipt.allocations.reduce(
          (sum, line) =>
            sum + (line.docType !== "credit_note" ? line.amount : 0),
          0,
        ),
      )
  )
    return "whtExceedsAllocation";
  if (totals.unapplied < 0 || totals.applied < 0) return "overAllocated";
  // the payload drops lines with amount <= 0, so only those count (BE AR_RECEIPT_EMPTY)
  if (
    receipt.allocations.every((line) => line.amount <= 0) &&
    totals.settlement === 0
  )
    return "emptyReceipt";
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
    docType: invoice.doc_type,
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

/** From the outstanding-invoices picker: cap = available amount (after other receipts' reservations) */
export function allocationFromOutstanding(
  doc: OutstandingInvoice,
  customerId: string,
): ReceiptAllocation {
  const available = Number(doc.available_amount);
  return {
    id: doc.ar_invoice_id,
    number: doc.doc_no,
    docType: doc.doc_type,
    date: doc.doc_date.slice(0, 10),
    customerId,
    currency: doc.currency_code,
    outstanding: available,
    amount: available,
    netAmount: Number(doc.net_amount),
    vatAmount: Number(doc.vat_amount),
    totalAmount: Number(doc.total_amount),
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

const orNull = (value: string) => (value.trim() ? value.trim() : null);

/** Form -> gateway body. `version` goes out as `doc_version` for the optimistic lock on update. */
export function toArReceiptPayload(receipt: ArReceipt): ArReceiptPayload {
  const { tender, taxEntity } = receipt;
  const wht = receipt.whtEnabled && receipt.whtAmount > 0;
  const info: Record<string, unknown> = {};
  if (receipt.taxInvoice) {
    info.tax_entity = {
      name: taxEntity.registeredName,
      tax_id: taxEntity.taxId,
      branch: taxEntity.branchNo,
      address: [
        taxEntity.address1,
        taxEntity.address2,
        taxEntity.province,
        taxEntity.postalCode,
      ]
        .filter(Boolean)
        .join(" "),
    };
    info.tax_date = receipt.taxDate;
  }
  return {
    ...(receipt.version !== null ? { doc_version: receipt.version } : {}),
    customer_id: receipt.customerId,
    receipt_date: receipt.date,
    received_date: tender.date || null,
    bank_account_id: tender.bankAccountId,
    receipt_method: tender.method,
    doc_source: receipt.source === "copy" ? "copy" : "manual",
    source_doc_ref: orNull(receipt.sourceDoc),
    currency_id: receipt.currencyId || null,
    exchange_rate: receipt.rate,
    net_received_amount: round2(tender.amount),
    charge_amount: round2(tender.charge),
    cheque_no: tender.method === "cheque" ? orNull(tender.chequeNo) : null,
    cheque_date: tender.method === "cheque" ? orNull(tender.chequeDate) : null,
    reference_no: orNull(tender.reference),
    payer_name: orNull(tender.payerName),
    description: orNull(receipt.description),
    is_tax_invoice: receipt.taxInvoice,
    wht: wht
      ? [
          {
            wht_tax_profile_id: receipt.whtProfileId || null,
            base_amount: receiptWhtBase(receipt) || round2(receipt.whtBase),
            wht_amount: round2(receipt.whtAmount),
            wht_certificate_no: orNull(receipt.whtCertificate),
            wht_certificate_date: orNull(receipt.whtCertificateDate),
          },
        ]
      : [],
    allocations: receipt.allocations
      .filter((line) => line.amount > 0)
      .map((line) => ({
        ar_invoice_id: line.id,
        applied_amount: round2(line.amount),
      })),
    info,
  };
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * API document -> form. The detail rows carry no invoice number or cap, so pass the outstanding
 * list fetched with `exclude_receipt_id` to restore them; without it the cap falls back to the
 * applied amount.
 */
export function receiptFromDocument(
  doc: ArReceiptDocument,
  outstanding: OutstandingInvoice[] = [],
): ArReceipt {
  const info = (doc.info ?? {}) as Record<string, unknown>;
  const entity = (
    info.tax_entity && typeof info.tax_entity === "object"
      ? info.tax_entity
      : {}
  ) as Record<string, unknown>;
  const byInvoice = new Map<
    string,
    ArReceiptDocument["tb_ar_receipt_detail"]
  >();
  for (const line of doc.tb_ar_receipt_detail ?? [])
    byInvoice.set(line.ar_invoice_id, [
      ...(byInvoice.get(line.ar_invoice_id) ?? []),
      line,
    ]);
  const allocations: ReceiptAllocation[] = [...byInvoice].map(
    ([invoiceId, lines]) => {
      const applied = round2(
        (lines ?? []).reduce(
          (sum, row) => sum + Math.abs(Number(row.applied_amount)),
          0,
        ),
      );
      const open = outstanding.find((row) => row.ar_invoice_id === invoiceId);
      return {
        id: invoiceId,
        number: open?.doc_no ?? "",
        docType: lines![0].doc_type,
        date: open?.doc_date.slice(0, 10) ?? "",
        customerId: doc.customer_id,
        currency: doc.currency_code ?? "",
        outstanding: open ? Number(open.available_amount) : applied,
        amount: applied,
        netAmount: Number(open?.net_amount ?? 0),
        vatAmount: Number(open?.vat_amount ?? 0),
        totalAmount: Number(open?.total_amount ?? 0),
      };
    },
  );
  const whtRows = doc.tb_ar_receipt_wht ?? [];
  const receiptDate = doc.receipt_date.slice(0, 10);
  return {
    id: doc.id,
    number: doc.doc_no,
    version: doc.doc_version ?? null,
    date: receiptDate,
    status: doc.doc_status,
    customerId: doc.customer_id,
    customerCode: doc.customer_code ?? "",
    customerName: doc.customer_name,
    currency: doc.currency_code ?? "",
    currencyId: doc.currency_id,
    rate: Number(doc.exchange_rate),
    source: doc.doc_source as ArReceiptSource,
    sourceDoc: doc.source_doc_ref ?? "",
    description: doc.description ?? "",
    taxInvoice: !!doc.is_tax_invoice,
    taxInvoiceNo: doc.tb_ar_tax_invoice?.tax_invoice_no ?? "",
    taxDate: text(info.tax_date).slice(0, 10) || receiptDate,
    taxEntity: {
      registeredName: text(entity.name) || text(entity.registered_name),
      taxId: text(entity.tax_id),
      branchNo: text(entity.branch) || "00000",
      address1: text(entity.address),
      address2: "",
      province: "",
      postalCode: "",
    },
    whtEnabled: whtRows.length > 0,
    whtProfileId: whtRows[0]?.wht_tax_profile_id ?? "",
    whtAmount: round2(
      whtRows.reduce((sum, row) => sum + Number(row.wht_amount), 0),
    ),
    whtBase: round2(
      whtRows.reduce((sum, row) => sum + Number(row.base_amount), 0),
    ),
    whtCertificate: whtRows[0]?.wht_certificate_no ?? "",
    whtCertificateDate: whtRows[0]?.wht_certificate_date?.slice(0, 10) ?? "",
    tender: {
      method: doc.receipt_method,
      date: (doc.received_date ?? doc.receipt_date).slice(0, 10),
      amount: Number(doc.net_received_amount),
      charge: Number(doc.total_charge_amount ?? 0),
      reference: doc.reference_no ?? "",
      payerName: doc.payer_name ?? "",
      chequeNo: doc.cheque_no ?? "",
      chequeDate: doc.cheque_date?.slice(0, 10) ?? receiptDate,
      bankAccountId: doc.bank_account_id,
      bankAccountLabel: [doc.bank_account_code, doc.bank_account_name]
        .filter(Boolean)
        .join(" · "),
    },
    allocations,
  };
}
