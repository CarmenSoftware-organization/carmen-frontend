import AccountingDocumentList from "./accounting-document-list";
import { useLocation } from "react-router";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import AccountingRegisterList from "./accounting-register-list";
import { accountingDocumentFromPath } from "./accounting-document-model";

export function Component() {
  const config = accountingDocumentFromPath(useLocation().pathname);
  if (config.kind === "arReceipt" || config.kind === "financialReports") {
    return (
      <AccountingRegisterList
        key={config.kind}
        config={config}
        pageKey={
          config.kind === "arReceipt"
            ? LIST_PAGE_KEYS.AR_RECEIPT
            : LIST_PAGE_KEYS.GL_FINANCIAL_REPORTS
        }
      />
    );
  }
  return <AccountingDocumentList />;
}
