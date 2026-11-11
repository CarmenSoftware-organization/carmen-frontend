import { AR_INVOICES, type ArInvoice } from "./ar-invoice-model";

const key = "carmen.ar-preview.invoices.v1";

export function readPreviewInvoices(): ArInvoice[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (Array.isArray(saved)) return saved;
  } catch {
    // Start from the fixtures if preview storage is unavailable or invalid.
  }
  return AR_INVOICES;
}

export function savePreviewInvoice(invoice: ArInvoice) {
  sessionStorage.setItem(
    key,
    JSON.stringify([
      invoice,
      ...readPreviewInvoices().filter((item) => item.id !== invoice.id),
    ]),
  );
}
