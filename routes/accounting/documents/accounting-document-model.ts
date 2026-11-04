export type AccountingDocumentKind =
  | "journalVoucher"
  | "financialReports"
  | "arInvoice"
  | "arReceipt"
  | "assetRegister"
  | "assetDisposal";

export interface AccountingDocument {
  id: string;
  number: string;
  date: string;
  description: string;
  party: string;
  status: "Draft" | "Pending" | "Approved" | "Posted" | "Paid" | "Overdue";
  amount: number;
}

export interface AccountingDocumentConfig {
  kind: AccountingDocumentKind;
  path: string;
  prefix: string;
}

export const ACCOUNTING_DOCUMENTS: Record<
  AccountingDocumentKind,
  AccountingDocumentConfig
> = {
  journalVoucher: {
    kind: "journalVoucher",
    path: "/accounting/journal-voucher",
    prefix: "JV",
  },
  financialReports: {
    kind: "financialReports",
    path: "/accounting/financial-reports",
    prefix: "FR",
  },
  arInvoice: {
    kind: "arInvoice",
    path: "/accounting/accounts-receivable/invoice",
    prefix: "AR",
  },
  arReceipt: {
    kind: "arReceipt",
    path: "/accounting/accounts-receivable/receipt",
    prefix: "RC",
  },
  assetRegister: {
    kind: "assetRegister",
    path: "/accounting/asset/register",
    prefix: "FA",
  },
  assetDisposal: {
    kind: "assetDisposal",
    path: "/accounting/asset/disposal",
    prefix: "FD",
  },
};

const DESCRIPTIONS = [
  "Monthly utilities and banquet accrual",
  "Hotel supplies and operating expenses",
  "Guest account settlement",
  "Inter-department cost allocation",
];

const PARTIES = [
  "Bangkok Power Co., Ltd.",
  "Siam Hospitality Supply",
  "Bangkok Resort & Spa",
  "Corporate Sales Account",
];

const STATUSES: AccountingDocument["status"][] = [
  "Draft",
  "Pending",
  "Approved",
  "Posted",
];

export function documentsFor(
  config: AccountingDocumentConfig,
): AccountingDocument[] {
  return Array.from({ length: 8 }, (_, index) => ({
    id: `${config.prefix.toLowerCase()}-${index + 1}`,
    number: `${config.prefix}2607-${String(index + 1).padStart(4, "0")}`,
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    description: DESCRIPTIONS[index % DESCRIPTIONS.length],
    party: PARTIES[index % PARTIES.length],
    status: STATUSES[index % STATUSES.length],
    amount: 10000 + index * 3750,
  }));
}

export function accountingDocumentFromPath(
  pathname: string,
): AccountingDocumentConfig {
  return (
    Object.values(ACCOUNTING_DOCUMENTS)
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => pathname.startsWith(item.path)) ??
    ACCOUNTING_DOCUMENTS.journalVoucher
  );
}

export function accountingDetailInitialMode(id?: string): FormMode {
  return id === "new" ? "add" : "view";
}
import type { FormMode } from "@/types/form";
