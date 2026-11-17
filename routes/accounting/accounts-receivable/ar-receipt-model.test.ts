import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteReceipt,
  newReceipt,
  newReceiptFromInvoice,
  readReceipts,
  receiptAllocationTax,
  receiptProfileDefaults,
  receiptTaxEntityFromCustomer,
  receiptTotals,
  receiptValidation,
  saveReceipt,
  suggestedReceiptWht,
  voidReceipt,
  type ArReceipt,
} from "./ar-receipt-model";
import type { ArRegisterDocument } from "./use-ar-register";

beforeEach(() => sessionStorage.clear());

function draft(): ArReceipt {
  return {
    ...newReceipt("2026-11-17"),
    customerId: "customer-a",
    customerCode: "AR001",
    customerName: "Customer A",
  };
}

describe("AR receipt preview CRUD", () => {
  it("creates, reads, edits and deletes complete BU-scoped drafts without replacing their document number", () => {
    const source = readReceipts("A")[0];
    const saved = saveReceipt("A", {
      ...source,
      id: "new-receipt",
      number: "",
    });
    expect(saved.number).toBe("ARRC-MOCK-NEW-RECE");
    expect(readReceipts("A").find((row) => row.id === saved.id)).toEqual(saved);
    const updated = saveReceipt("A", {
      ...saved,
      number: "trying-to-replace-number",
      description: "Changed draft",
      payments: saved.payments.map((line) => ({
        ...line,
        reference: "BANK-123",
        chequeNo: "CHQ-123",
        cardLast4: "1234",
      })),
      taxEntity: {
        ...saved.taxEntity,
        registeredName: "Registered Co.",
        address1: "Address one",
        address2: "Address two",
        province: "Bangkok",
        postalCode: "10110",
      },
    });
    expect(updated.number).toBe(saved.number);
    expect(readReceipts("A")[0]).toEqual(updated);
    expect(readReceipts("B").some((row) => row.id === saved.id)).toBe(false);
    deleteReceipt("A", saved.id);
    expect(readReceipts("A").some((row) => row.id === saved.id)).toBe(false);
    expect(() => deleteReceipt("A", saved.id)).toThrow("receiptNotFound");
  });

  it("persists Void and blocks a stale edit from restoring the draft", () => {
    const saved = saveReceipt("A", draft());
    const voided = voidReceipt("A", saved.id);
    expect(voided.status).toBe("void");
    expect(readReceipts("A")[0].status).toBe("void");
    expect(() =>
      saveReceipt("A", { ...saved, description: "Stale edit" }),
    ).toThrow("receiptVoided");
  });

  it("does not silently overwrite corrupt browser storage with sample records", () => {
    sessionStorage.setItem("carmen.ar.receipt-mock.v1.A", "broken-json");
    expect(() => readReceipts("A")).toThrow();
    expect(() => saveReceipt("A", draft())).toThrow();
    expect(sessionStorage.getItem("carmen.ar.receipt-mock.v1.A")).toBe(
      "broken-json",
    );
  });
});

describe("Receipt allocation and tax calculation", () => {
  it("prefers an active registered tax address and preserves the RD address components, with a billing fallback", () => {
    const customer = {
      id: "customer",
      code: "AR",
      name: "Name",
      customer_address: [
        {
          id: "billing",
          address_type: "billing_address",
          address_line1: "Billing only",
        },
        {
          id: "inactive",
          address_type: "register_address",
          address_line1: "Old",
          is_active: false,
        },
        {
          id: "tax",
          address_type: "register_address",
          address_line1: "Tax Road",
          address_line2: "Floor 2",
          sub_district: "Subdistrict",
          district: "District",
          province: "Bangkok",
          postal_code: "10110",
        },
      ],
    };
    expect(receiptTaxEntityFromCustomer(customer)).toMatchObject({
      registeredName: "Name",
      address1: "Tax Road",
      address2: "Floor 2 Subdistrict District",
      province: "Bangkok",
      postalCode: "10110",
    });
    expect(
      receiptTaxEntityFromCustomer({
        ...customer,
        customer_address: customer.customer_address.slice(0, 2),
      }).address1,
    ).toBe("Billing only");
  });
  const invoice: ArRegisterDocument = {
    id: "invoice-a",
    doc_no: "ARIV26110001",
    doc_type: "invoice",
    doc_status: "posted",
    doc_date: "2026-11-01",
    due_date: "2026-11-30",
    customer_id: "customer-a",
    customer_code: "AR001",
    customer_name: "Customer A",
    currency_code: "USD",
    net_amount: "100",
    vat_amount: "7",
    total_amount: "107",
    outstanding_amount: "53.50",
  };

  it("carries customer, currency and only the remaining balance from Get Receipt", () => {
    const receipt = newReceiptFromInvoice(invoice, "2026-11-17");
    expect(receipt.customerId).toBe(invoice.customer_id);
    expect(receipt.currency).toBe("USD");
    expect(receipt.sourceDoc).toBe(invoice.doc_no);
    expect(receipt.allocations[0].amount).toBe(53.5);
    expect(receiptValidation(receipt)).toBeNull();
    expect(invoice.outstanding_amount).toBe("53.50");
  });

  it("validates invoice ownership, currency, unpaid cap and duplicate invoices before changing storage", () => {
    const receipt = newReceiptFromInvoice(invoice, "2026-11-17");
    const line = receipt.allocations[0];
    expect(
      receiptValidation({
        ...receipt,
        allocations: [{ ...line, customerId: "other" }],
      }),
    ).toBe("invoiceMismatch");
    expect(
      receiptValidation({
        ...receipt,
        allocations: [{ ...line, currency: "THB" }],
      }),
    ).toBe("invoiceMismatch");
    expect(
      receiptValidation({ ...receipt, allocations: [{ ...line, amount: 54 }] }),
    ).toBe("allocationExceedsOutstanding");
    expect(receiptValidation({ ...receipt, allocations: [line, line] })).toBe(
      "duplicateInvoice",
    );
    expect(() =>
      saveReceipt("A", { ...receipt, allocations: [{ ...line, amount: 54 }] }),
    ).toThrow("allocationExceedsOutstanding");
    expect(readReceipts("A")).toHaveLength(2);
  });

  it("combines net cash with actual WHT and shows proportional invoice VAT in THB", () => {
    const receipt = newReceiptFromInvoice(invoice, "2026-11-17");
    const sourcePayment = readReceipts("A")[0].payments[0];
    const withPayment = {
      ...receipt,
      rate: 35,
      whtEnabled: true,
      whtAmount: 1.5,
      payments: [{ ...sourcePayment, amount: 52 }],
    };
    expect(receiptTotals(withPayment)).toEqual({
      allocated: 53.5,
      received: 52,
      wht: 1.5,
      settlement: 53.5,
      unapplied: 0,
      baseReceived: 1820,
    });
    expect(receiptAllocationTax(receipt.allocations[0], 35)).toEqual({
      base: 1750,
      tax: 122.5,
      total: 1872.5,
      rate: 7,
    });
    expect(receiptValidation({ ...withPayment, whtAmount: 54 })).toBe(
      "whtExceedsAllocation",
    );
    expect(receiptTotals({ ...withPayment, whtEnabled: false }).wht).toBe(0);
  });

  it("uses profile payment and WHT defaults and calculates WHT from allocated value before VAT", () => {
    const defaults = receiptProfileDefaults({
      paymentType: "CHQ",
      whtService: "01",
    });
    expect(defaults).toEqual({
      defaultPaymentType: "cheque",
      whtService: "01",
    });
    const receipt = {
      ...newReceiptFromInvoice(invoice, "2026-11-17"),
      ...defaults,
    };
    expect(suggestedReceiptWht(receipt)).toBe(1.5);
    expect(suggestedReceiptWht({ ...receipt, whtService: "02" })).toBe(2.5);
    expect(suggestedReceiptWht({ ...receipt, whtService: "NONE" })).toBe(0);
    expect(receiptProfileDefaults({}).defaultPaymentType).toBe("bank_transfer");
  });

  it("rejects invalid dates, non-finite amounts and invalid tax identities", () => {
    const receipt = draft();
    expect(receiptValidation({ ...receipt, date: "2026-02-30" })).toBe(
      "invalidReceipt",
    );
    expect(receiptValidation({ ...receipt, rate: 0 })).toBe("invalidReceipt");
    expect(receiptValidation({ ...receipt, whtAmount: Number.NaN })).toBe(
      "invalidReceipt",
    );
    expect(
      receiptValidation({
        ...receipt,
        taxInvoice: true,
        taxEntity: { ...receipt.taxEntity, taxId: "123" },
      }),
    ).toBe("invalidTaxId");
    expect(
      receiptValidation({
        ...receipt,
        taxInvoice: true,
        taxEntity: { ...receipt.taxEntity, branchNo: "HQ" },
      }),
    ).toBe("invalidBranchNo");
  });
});
