import { describe, expect, it } from "vitest";
import type { ApPaymentInput } from "@/types/accounts-payable-mock";
import { addDecimal, divideDecimal } from "../shared/ap-decimal";
import { paymentSummary } from "./ap-payment-totals";

const form: ApPaymentInput = {
  vendor_id: "v",
  vendor_name: "Vendor",
  payment_date: "2026-09-07",
  due_date: "2026-09-07",
  currency_code: "USD",
  exchange_rate: "34.5",
  payment_method: "bank_transfer",
  bank_account_masked: "•••• 1234",
  payment_reference: "",
  description: "",
  urgent: false,
  workflow_enabled: true,
  applications: [
    {
      id: "1",
      invoice_id: "i",
      invoice_no: "AP1",
      vendor_invoice_no: "INV1",
      po_no: null,
      grn_no: null,
      original_amount: "1070",
      open_amount: "1070",
      apply_amount: "1070",
      original_rate: "35",
      wht_base: "1000",
      wht_rate: "3",
      wht_amount: "30",
      net_cash: "1040",
      match_status: "matched",
    },
  ],
  other_expenses: [
    {
      id: "fee",
      account: "Bank fees",
      description: "Fee",
      cost_center: "800",
      dimensions: "",
      base_amount: "40",
    },
  ],
};

describe("Payment v2.11 totals", () => {
  it("reclassifies claimed input VAT without changing cash outflow", () => {
    const totals = paymentSummary({
      ...form,
      tax_allocations: [
        { invoice_id: "i", tax_invoice_id: "tax", claim_amount: "70" },
      ],
    });
    expect(totals.net_base).toBe(paymentSummary(form).net_base);
    expect(totals.journal.find((line) => line.id === "input-vat")?.debit).toBe(
      "70.00",
    );
    expect(addDecimal(totals.journal.map((line) => line.debit))).toBe(
      addDecimal(totals.journal.map((line) => line.credit)),
    );
  });
  it("separates original FX, settlement FX, WHT and expenses with balanced GL", () => {
    const totals = paymentSummary(form);
    expect(totals.base).toBe("37450.00");
    expect(totals.fx).toBe("535.00");
    expect(totals.wht_base).toBe("1035.00");
    expect(totals.net_base).toBe("35920.00");
    expect(addDecimal(totals.journal.map((line) => line.debit))).toBe(
      addDecimal(totals.journal.map((line) => line.credit)),
    );
  });
  it("balances realized FX losses as debits", () => {
    const totals = paymentSummary({ ...form, exchange_rate: "36" });
    expect(totals.fx).toBe("-1070.00");
    expect(addDecimal(totals.journal.map((line) => line.debit))).toBe(
      addDecimal(totals.journal.map((line) => line.credit)),
    );
  });
  it("rounds decimal division without binary floating point", () => {
    expect(divideDecimal("10", "3")).toBe("3.33");
    expect(divideDecimal("-1", "8")).toBe("-0.13");
    expect(() => divideDecimal("1", "0")).toThrow();
  });
});
