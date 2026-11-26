import { describe, expect, it } from "vitest";
import { apDocumentFilter, apDocumentPage } from "./ap-document-page";

describe("AP document pages", () => {
  it.each([
    ["deposit", "deposit"],
    ["debit-note", "debit_note"],
    ["credit-note", "credit_note"],
  ] as const)(
    "keeps %s scoped in list, create and detail",
    (segment, docType) => {
      for (const suffix of ["", "/new", "/invoice-id"]) {
        expect(
          apDocumentPage(`/accounts-payable/${segment}${suffix}`),
        ).toMatchObject({
          path: `/accounts-payable/${segment}`,
          docType,
        });
      }
      expect(apDocumentFilter("doc_status|string:draft", docType)).toBe(
        `doc_status|string:draft;doc_type|string:${docType}`,
      );
    },
  );
  it("preserves the existing all-document invoice list", () => {
    expect(apDocumentPage("/accounts-payable/invoice").docType).toBeUndefined();
    expect(
      apDocumentPage("/accounts-payable/deposit-other").docType,
    ).toBeUndefined();
    expect(apDocumentFilter(undefined)).toBeUndefined();
    expect(apDocumentFilter("doc_status|string:posted")).toBe(
      "doc_status|string:posted",
    );
  });
});
