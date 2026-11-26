import { describe, expect, it } from "vitest";
import { getModule } from "@/constant/module-list";
import {
  accountingDetailInitialMode,
  accountingDocumentFromPath,
} from "./accounting-document-model";

describe("accounting navigation", () => {
  it("maps nested list and detail paths to the same document type", () => {
    expect(
      accountingDocumentFromPath("/accounts-receivable/invoice/ar-1").kind,
    ).toBe("arInvoice");
  });

  it("exposes the dedicated AP dashboard and approval queue", () => {
    expect(
      getModule("/general-ledger").subModules?.some(
        (item) => item.name === "accountingDashboard",
      ),
    ).toBe(false);
    expect(
      getModule("/accounts-payable").subModules?.map((item) => item.name),
    ).toEqual([
      "apDashboard",
      "apInvoice",
      "apDeposit",
      "apDebitNote",
      "apCreditNote",
      "apPayment",
      "apPaymentApprovals",
    ]);
  });

  it("keeps existing documents read-only until edit and opens new documents in add mode", () => {
    expect(accountingDetailInitialMode("jv-1")).toBe("view");
    expect(accountingDetailInitialMode("new")).toBe("add");
  });
});
