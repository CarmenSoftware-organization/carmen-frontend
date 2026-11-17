import { describe, expect, it } from "vitest";

import { accountingModuleSections, findAccountingSection } from "./module-list";

describe("accounting launcher navigation", () => {
  it("defines the four launcher modules in display order", () => {
    expect(accountingModuleSections.map((section) => section.name)).toEqual([
      "generalLedger",
      "accountsPayable",
      "accountsReceivable",
      "asset",
    ]);
  });

  it.each([
    ["/accounting", "generalLedger"],
    ["/accounting/journal-voucher/jv-1", "generalLedger"],
    ["/accounting/accounts-payable/invoice/ap-1", "accountsPayable"],
    ["/accounting/accounts-receivable/receipt/rc-1", "accountsReceivable"],
    ["/accounting/accounts-receivable/profile", "accountsReceivable"],
    ["/accounting/accounts-receivable/folio", "accountsReceivable"],
    ["/accounting/accounts-receivable/contract", "accountsReceivable"],
    ["/accounting/asset/disposal/fd-1", "asset"],
  ])("maps %s to %s", (pathname, expected) => {
    expect(findAccountingSection(pathname).name).toBe(expected);
  });

  it("keeps only the selected module's pages in its sidebar branch", () => {
    const accountsPayable = findAccountingSection(
      "/accounting/accounts-payable/invoice",
    );

    expect(accountsPayable.subModules?.map((item) => item.name)).toEqual([
      "apDashboard",
      "apInvoice",
      "apDeposit",
      "apDebitNote",
      "apCreditNote",
      "apPayment",
      "apPaymentApprovals",
    ]);
  });

  it("opens AR features directly in document order without a preview hub", () => {
    const ar = findAccountingSection("/accounting/accounts-receivable/folio");
    expect(ar.subModules?.map(({ name }) => name)).toEqual([
      "arDashboard",
      "arProfile",
      "arFolio",
      "arInvoice",
      "arReceipt",
      "arAdvanceDeposit",
      "chequeReconciliation",
      "outputTax",
    ]);
    expect(ar.subModules?.some(({ path }) => path.includes("/preview"))).toBe(
      false,
    );
  });

  it("keeps received-cheque and output VAT governance under AR per FRD v1.1", () => {
    for (const path of [
      "/accounting/accounts-receivable/cheque-reconciliation",
      "/accounting/accounts-receivable/output-tax",
    ]) {
      expect(findAccountingSection(path).name).toBe("accountsReceivable");
      expect(
        findAccountingSection(path).subModules?.some(
          (item) =>
            item.path === path && item.licenseFeature === "accounting.ar",
        ),
      ).toBe(true);
      expect(
        accountingModuleSections[0].subModules?.some(
          (item) => item.path === path,
        ),
      ).toBe(false);
    }
  });
});
