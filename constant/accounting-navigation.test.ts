import { describe, expect, it } from "vitest";

import { findActiveModule, moduleList, type ModuleDto } from "./module-list";

const ACCOUNTING_NAMES = [
  "generalLedger",
  "accountsPayable",
  "accountsReceivable",
  "asset",
];
const accountingModules = moduleList.filter((mod) =>
  ACCOUNTING_NAMES.includes(mod.name),
);
const section = (pathname: string): ModuleDto => {
  const mod = findActiveModule(pathname);
  if (!mod) throw new Error(`no module for ${pathname}`);
  return mod;
};

describe("accounting top-level modules", () => {
  it("lists the four accounting modules next to each other in display order", () => {
    const first = moduleList.findIndex((mod) => mod.name === "generalLedger");
    expect(moduleList.slice(first, first + 4).map((mod) => mod.name)).toEqual([
      "generalLedger",
      "accountsPayable",
      "accountsReceivable",
      "asset",
    ]);
  });

  it.each([
    ["/general-ledger", "generalLedger"],
    ["/general-ledger/journal-voucher/jv-1", "generalLedger"],
    ["/accounts-payable/invoice/ap-1", "accountsPayable"],
    ["/accounts-receivable/receipt/rc-1", "accountsReceivable"],
    ["/accounts-receivable/profile", "accountsReceivable"],
    ["/accounts-receivable/folio", "accountsReceivable"],
    ["/accounts-receivable/contract", "accountsReceivable"],
    ["/asset/disposal/fd-1", "asset"],
  ])("maps %s to %s", (pathname, expected) => {
    expect(findActiveModule(pathname)?.name).toBe(expected);
  });

  it("matches module paths on a segment boundary, not a bare prefix", () => {
    expect(findActiveModule("/assetx")).toBeUndefined();
    expect(findActiveModule("/asset")?.name).toBe("asset");
  });

  it("borrows the accounting tile for all four modules", () => {
    expect(accountingModules.map((mod) => mod.tileParent)).toEqual([
      "accounting",
      "accounting",
      "accounting",
      "accounting",
    ]);
  });

  it("keeps only the selected module's pages in its sidebar branch", () => {
    const accountsPayable = section("/accounts-payable/invoice");

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
    const ar = section("/accounts-receivable/folio");
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
      "/accounts-receivable/cheque-reconciliation",
      "/accounts-receivable/output-tax",
    ]) {
      expect(section(path).name).toBe("accountsReceivable");
      expect(
        section(path).subModules?.some(
          (item) =>
            item.path === path && item.licenseFeature === "accounting.ar",
        ),
      ).toBe(true);
      expect(
        section("/general-ledger").subModules?.some(
          (item) => item.path === path,
        ),
      ).toBe(false);
    }
  });
});
