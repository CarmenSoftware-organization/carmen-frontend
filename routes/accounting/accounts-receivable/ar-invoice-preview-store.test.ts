import { beforeEach, expect, it } from "vitest";
import { newArInvoice } from "./ar-invoice-model";
import {
  readPreviewInvoices,
  savePreviewInvoice,
} from "./ar-invoice-preview-store";

beforeEach(() => sessionStorage.clear());

it("keeps a new preview invoice and updates it without duplicating it", () => {
  const initialCount = readPreviewInvoices().length;
  const invoice = { ...newArInvoice(), id: "mock-qa", docNo: "MOCK-QA" };
  savePreviewInvoice(invoice);
  expect(readPreviewInvoices()).toHaveLength(initialCount + 1);
  savePreviewInvoice({ ...invoice, status: "Submitted" });
  expect(readPreviewInvoices().filter(({ id }) => id === invoice.id)).toEqual([
    expect.objectContaining({ docNo: "MOCK-QA", status: "Submitted" }),
  ]);
});
