import { describe, expect, it } from "vitest";
import { mapInvoice } from "../shared/ap-http-repository";
import {
  initialInvoiceForm,
  toInvoiceInput,
  validateInvoiceForm,
} from "./ap-invoice-form";

const raw = {
  id: "invoice",
  doc_date: "2026-11-15",
  invoice_date: "2026-11-15",
  doc_type: "invoice",
  vendor_id: "vendor",
  vendor_invoice_no: "INV-1",
  exchange_rate: 35,
  base_sub_total_amount: 3500.12345,
  base_discount_amount: 10.23456,
  base_net_amount: 3489.88889,
  base_vat_amount: 244.29222,
  tb_ap_invoice_detail: [
    {
      id: "line",
      quantity: 1,
      unit_price: 100,
      dr_chart_of_accounts_id: "expense",
      base_sub_total_amount: 3500.12345,
      base_discount_amount: 10.23456,
      base_net_amount: 3489.88889,
      base_vat_amount: 244.29222,
      tb_ap_invoice_detail_source: [
        {
          good_received_note_id: "grn",
          grn_no: "GRN-1",
          good_received_note_detail_item_id: "item",
          matched_qty: 0.5,
        },
      ],
    },
  ],
};

describe("Invoice stored amounts and GRN matches", () => {
  it("retains the WHT Service Type identity, saved label and rate through reload and save", () => {
    const invoice = mapInvoice({
      ...raw,
      tb_ap_invoice_detail: [
        {
          ...raw.tb_ap_invoice_detail[0],
          wht_service_type_id: "service",
          wht_service_snapshot: { code: "S3", description: "Services" },
          wht_rate: 3,
        },
      ],
    });
    const form = initialInvoiceForm(invoice, {});
    expect(form.lines[0].wht_service_label).toBe("S3 · Services");
    expect(form.lines[0].wht_rate).toBe("3.00");
    expect(toInvoiceInput(form).lines[0]).toMatchObject({
      wht_service_type_id: "service",
      wht_tax_profile_id: null,
    });
  });
  it("retains backend base amounts rather than deriving them from the current rate", () => {
    const invoice = mapInvoice(raw);
    expect(invoice).toMatchObject({
      base_sub_total_amount: "3500.12345",
      base_discount_amount: "10.23456",
      base_net_amount: "3489.88889",
      base_vat_amount: "244.29222",
    });
    expect(invoice.lines?.[0]).toMatchObject({
      base_sub_total_amount: "3500.12345",
      base_discount_amount: "10.23456",
      base_net_amount: "3489.88889",
      base_vat_amount: "244.29222",
    });
  });

  it("round-trips GRN matches without sending display metadata and blocks empty matched quantities", () => {
    const form = initialInvoiceForm(mapInvoice(raw), {});
    expect(form.lines[0].source_labels).toEqual({ item: "GRN-1" });
    expect(toInvoiceInput(form).lines[0].sources).toEqual([
      { good_received_note_detail_item_id: "item", matched_qty: "0.50" },
    ]);
    expect(toInvoiceInput(form).lines[0]).not.toHaveProperty("source_labels");
    expect(validateInvoiceForm(form, "update")).not.toContain("sourceQuantity");
    form.lines[0].carry!.sources![0].matched_qty = "";
    expect(validateInvoiceForm(form, "update")).toContain("sourceQuantity");
  });
});
