import { describe, expect, it } from "vitest";
import { getModule } from "@/constant/module-list";
import {
  accountingDetailInitialMode,
  accountingDocumentFromPath,
} from "./accounting-document-model";

describe("accounting navigation", () => {
  it("maps nested list and detail paths to the same document type", () => {
    expect(
      accountingDocumentFromPath("/accounting/accounts-receivable/invoice/ar-1")
        .kind,
    ).toBe("arInvoice");
  });

  it("exposes the dedicated AP dashboard and approval queue", () => {
    const accounting = getModule("/accounting");
    expect(
      accounting.subModules?.some(
        (item) => item.name === "accountingDashboard",
      ),
    ).toBe(false);
    expect(
      accounting.subModules
        ?.find((item) => item.name === "accountsPayable")
        ?.subModules?.map((item) => item.name),
    ).toEqual(["apDashboard", "apInvoice", "apPayment", "apPaymentApprovals"]);
  });

  it("keeps existing documents read-only until edit and opens new documents in add mode", () => {
    expect(accountingDetailInitialMode("jv-1")).toBe("view");
    expect(accountingDetailInitialMode("new")).toBe("add");
  });
});
