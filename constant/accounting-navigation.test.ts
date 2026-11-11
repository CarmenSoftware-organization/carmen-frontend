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
    ["/accounting/accounts-receivable/preview/invoice/ar-1", "accountsReceivable"],
    ["/accounting/accounts-receivable/profile", "accountsReceivable"],
    ["/accounting/accounts-receivable/preview/profiles", "accountsReceivable"],
    ["/accounting/accounts-receivable/preview/contracts", "accountsReceivable"],
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
      "apPayment",
      "apPaymentApprovals",
    ]);
  });
});
