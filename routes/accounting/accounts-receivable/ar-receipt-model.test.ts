import { describe, expect, it } from "vitest";
import {
  newReceipt,
  newReceiptFromInvoice,
  receiptAllocationTax,
  receiptFromDocument,
  receiptProfileDefaults,
  receiptTaxEntityFromCustomer,
  receiptTotals,
  receiptValidation,
  suggestedReceiptWht,
  toArReceiptPayload,
  type ArReceipt,
} from "./ar-receipt-model";
import type { ArReceiptDocument } from "./use-ar-receipt";
import type { ArRegisterDocument } from "./use-ar-register";

function draft(): ArReceipt {
  const receipt = {
    ...newReceipt("2026-11-17"),
    customerId: "customer-a",
    customerCode: "AR001",
    customerName: "Customer A",
  };
  return { ...receipt, tender: { ...receipt.tender, bankAccountId: "bank-1" } };
}

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

  function withBank(receipt: ArReceipt): ArReceipt {
    return {
      ...receipt,
      tender: { ...receipt.tender, bankAccountId: "bank-1" },
    };
  }

  it("carries customer, currency and only the remaining balance from Get Receipt", () => {
    const receipt = newReceiptFromInvoice(invoice, "2026-11-17");
    expect(receipt.customerId).toBe(invoice.customer_id);
    expect(receipt.currency).toBe("USD");
    expect(receipt.source).toBe("manual");
    expect(receipt.sourceDoc).toBe(invoice.doc_no);
    expect(receipt.allocations[0].amount).toBe(53.5);
    expect(invoice.outstanding_amount).toBe("53.50");
  });

  it("validates ownership, currency, cap, duplicates, bank and empty receipts", () => {
    const receipt = withBank(newReceiptFromInvoice(invoice, "2026-11-17"));
    const line = receipt.allocations[0];
    const paid = {
      ...receipt,
      tender: { ...receipt.tender, amount: 53.5 },
    };
    expect(receiptValidation(paid)).toBeNull();
    expect(
      receiptValidation({
        ...paid,
        allocations: [{ ...line, customerId: "other" }],
      }),
    ).toBe("invoiceMismatch");
    expect(
      receiptValidation({
        ...paid,
        allocations: [{ ...line, currency: "THB" }],
      }),
    ).toBe("invoiceMismatch");
    expect(
      receiptValidation({ ...paid, allocations: [{ ...line, amount: 54 }] }),
    ).toBe("allocationExceedsOutstanding");
    expect(receiptValidation({ ...paid, allocations: [line, line] })).toBe(
      "duplicateInvoice",
    );
    expect(
      receiptValidation(newReceiptFromInvoice(invoice, "2026-11-17")),
    ).toBe("bankAccountRequired");
    expect(receiptValidation({ ...draft(), allocations: [] })).toBe(
      "emptyReceipt",
    );
  });

  it("settles net cash + WHT + charge against applied and keeps the excess as unapplied", () => {
    const receipt = withBank(newReceiptFromInvoice(invoice, "2026-11-17"));
    const withTender = {
      ...receipt,
      rate: 35,
      whtEnabled: true,
      whtAmount: 1.5,
      tender: { ...receipt.tender, amount: 51, charge: 1 },
    };
    expect(receiptTotals(withTender)).toEqual({
      applied: 53.5,
      wht: 1.5,
      charge: 1,
      settlement: 53.5,
      received: 51,
      unapplied: 0,
    });
    expect(receiptValidation(withTender)).toBeNull();
    const over = {
      ...withTender,
      tender: { ...withTender.tender, amount: 60 },
    };
    expect(receiptTotals(over).unapplied).toBe(7);
    expect(receiptValidation(over)).toBeNull();
    const short = {
      ...withTender,
      tender: { ...withTender.tender, amount: 40 },
    };
    expect(receiptValidation(short)).toBe("overAllocated");
    expect(receiptValidation({ ...withTender, whtAmount: 54 })).toBe(
      "whtExceedsAllocation",
    );
    expect(receiptTotals({ ...withTender, whtEnabled: false }).wht).toBe(0);
    expect(receiptAllocationTax(receipt.allocations[0], 35)).toEqual({
      base: 1750,
      tax: 122.5,
      total: 1872.5,
      rate: 7,
    });
  });

  it("counts credit-note lines negative in the totals", () => {
    const receipt = withBank(newReceiptFromInvoice(invoice, "2026-11-17"));
    const credit = {
      ...receipt.allocations[0],
      id: "cn-1",
      docType: "credit_note" as const,
      amount: 3.5,
      outstanding: 3.5,
    };
    const mixed = {
      ...receipt,
      allocations: [{ ...receipt.allocations[0], amount: 50 }, credit],
      tender: { ...receipt.tender, amount: 46.5 },
    };
    expect(receiptTotals(mixed).applied).toBe(46.5);
    expect(receiptTotals(mixed).unapplied).toBe(0);
    expect(receiptValidation(mixed)).toBeNull();
  });

  it("maps the customer profile payment type and computes WHT from the profile rate over pre-VAT value", () => {
    expect(receiptProfileDefaults({ paymentType: "CHQ" })).toEqual({
      defaultPaymentType: "cheque",
    });
    expect(receiptProfileDefaults({}).defaultPaymentType).toBe("bank_transfer");
    const receipt = newReceiptFromInvoice(invoice, "2026-11-17");
    expect(suggestedReceiptWht(3, receipt)).toBe(1.5);
    expect(suggestedReceiptWht(5, receipt)).toBe(2.5);
    expect(suggestedReceiptWht(0, receipt)).toBe(0);
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
        tender: { ...receipt.tender, amount: 10 },
        taxInvoice: true,
        taxEntity: { ...receipt.taxEntity, taxId: "123" },
      }),
    ).toBe("invalidTaxId");
    expect(
      receiptValidation({
        ...receipt,
        tender: { ...receipt.tender, amount: 10 },
        taxInvoice: true,
        taxEntity: { ...receipt.taxEntity, branchNo: "HQ" },
      }),
    ).toBe("invalidBranchNo");
  });
});

describe("Receipt API mapping", () => {
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
    currency_code: "THB",
    currency_id: "cur-thb",
    net_amount: "100",
    vat_amount: "7",
    total_amount: "107",
    outstanding_amount: "107",
  };

  it("builds an invoice-level payload with one tender, one WHT row and no TXRC info unless requested", () => {
    const base = newReceiptFromInvoice(invoice, "2026-11-17");
    const receipt: ArReceipt = {
      ...base,
      whtEnabled: true,
      whtProfileId: "wht-1",
      whtAmount: 3,
      whtCertificate: "C-1",
      tender: {
        ...base.tender,
        bankAccountId: "bank-1",
        method: "cheque",
        amount: 103,
        charge: 1,
        chequeNo: "CHQ-9",
      },
    };
    const payload = toArReceiptPayload(receipt);
    expect(payload).toMatchObject({
      customer_id: "customer-a",
      bank_account_id: "bank-1",
      receipt_method: "cheque",
      doc_source: "manual",
      source_doc_ref: "ARIV26110001",
      currency_id: "cur-thb",
      net_received_amount: 103,
      charge_amount: 1,
      cheque_no: "CHQ-9",
      is_tax_invoice: false,
      allocations: [{ ar_invoice_id: "invoice-a", applied_amount: 107 }],
      wht: [
        {
          wht_tax_profile_id: "wht-1",
          base_amount: 100,
          wht_amount: 3,
          wht_certificate_no: "C-1",
        },
      ],
      info: {},
    });
    expect(payload).not.toHaveProperty("doc_version");
    const tax = toArReceiptPayload({
      ...receipt,
      version: 4,
      taxInvoice: true,
      taxEntity: {
        ...receipt.taxEntity,
        registeredName: "Co",
        taxId: "1234567890123",
      },
    });
    expect(tax.doc_version).toBe(4);
    expect(tax.info).toMatchObject({
      tax_entity: { name: "Co", tax_id: "1234567890123", branch: "00000" },
      tax_date: "2026-11-17",
    });
    expect(toArReceiptPayload({ ...receipt, whtEnabled: false }).wht).toEqual(
      [],
    );
  });

  it("restores the form from a document, using the outstanding list for numbers and caps", () => {
    const doc = {
      id: "r1",
      doc_no: "ARRC26110001",
      doc_status: "draft",
      doc_version: 2,
      receipt_date: "2026-11-17T00:00:00.000Z",
      received_date: "2026-11-18T00:00:00.000Z",
      customer_id: "customer-a",
      customer_code: "AR001",
      customer_name: "Customer A",
      currency_id: "cur-thb",
      currency_code: "THB",
      exchange_rate: 1,
      bank_account_id: "bank-1",
      bank_account_code: "KB1",
      bank_account_name: "Kbank",
      receipt_method: "promptpay",
      net_received_amount: 100,
      total_charge_amount: 1,
      total_unapplied_amount: 0,
      is_tax_invoice: true,
      doc_source: "manual",
      info: {
        tax_entity: { name: "Co", tax_id: "1234567890123", branch: "00001" },
      },
      tb_ar_receipt_wht: [
        {
          id: "w",
          wht_tax_profile_id: "wht-1",
          base_amount: 100,
          wht_rate: 3,
          wht_amount: 3,
          is_override: false,
        },
      ],
      tb_ar_tax_invoice: {
        id: "t",
        tax_invoice_no: "TXRC2611-0001",
        tax_status: "active",
      },
      tb_ar_receipt_detail: [
        {
          id: "d1",
          ar_invoice_id: "invoice-a",
          ar_invoice_detail_id: "l1",
          doc_type: "invoice",
          applied_amount: 60,
        },
        {
          id: "d2",
          ar_invoice_id: "invoice-a",
          ar_invoice_detail_id: "l2",
          doc_type: "invoice",
          applied_amount: 44,
        },
      ],
    } as unknown as ArReceiptDocument;
    const receipt = receiptFromDocument(doc, [
      {
        ar_invoice_id: "invoice-a",
        doc_no: "ARIV26110001",
        doc_type: "invoice",
        doc_date: "2026-11-01",
        currency_id: "cur-thb",
        currency_code: "THB",
        exchange_rate: 1,
        net_amount: 100,
        vat_amount: 7,
        total_amount: 107,
        outstanding_amount: 107,
        available_amount: 107,
        lines: [],
      },
    ]);
    expect(receipt).toMatchObject({
      version: 2,
      date: "2026-11-17",
      taxInvoiceNo: "TXRC2611-0001",
      whtEnabled: true,
      whtAmount: 3,
      tender: {
        method: "promptpay",
        date: "2026-11-18",
        amount: 100,
        charge: 1,
        bankAccountLabel: "KB1 · Kbank",
      },
      taxEntity: {
        registeredName: "Co",
        taxId: "1234567890123",
        branchNo: "00001",
      },
    });
    expect(receipt.allocations).toHaveLength(1);
    expect(receipt.allocations[0]).toMatchObject({
      number: "ARIV26110001",
      amount: 104,
      outstanding: 107,
    });
    expect(receiptTotals(receipt).unapplied).toBe(0);
  });
});
