import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { ApDocType } from "@/types/accounts-payable";

const base = "/accounts-payable";
const pages = [
  {
    segment: "deposit",
    docType: "deposit",
    pageKey: LIST_PAGE_KEYS.AP_DEPOSIT,
  },
  {
    segment: "debit-note",
    docType: "debit_note",
    pageKey: LIST_PAGE_KEYS.AP_DEBIT_NOTE,
  },
  {
    segment: "credit-note",
    docType: "credit_note",
    pageKey: LIST_PAGE_KEYS.AP_CREDIT_NOTE,
  },
] as const;

export function apDocumentPage(pathname: string) {
  const page = pages.find(
    ({ segment }) =>
      pathname === `${base}/${segment}` ||
      pathname.startsWith(`${base}/${segment}/`),
  );
  return {
    path: `${base}/${page?.segment ?? "invoice"}`,
    docType: page?.docType,
    pageKey: page?.pageKey ?? LIST_PAGE_KEYS.AP_INVOICE,
  };
}

export function apDocumentFilter(
  filter: string | undefined,
  docType?: ApDocType,
) {
  return (
    [filter, docType && `doc_type|string:${docType}`]
      .filter(Boolean)
      .join(";") || undefined
  );
}
