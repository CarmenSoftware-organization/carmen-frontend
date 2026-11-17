import { describe, expect, it } from "vitest";
import {
  arLineAmounts,
  arLineBaseTotal,
  draftLineFromRecord,
  draftLineToInput,
  newArDraftLine,
} from "./ar-invoice-draft-model";

describe("AR invoice amounts", () => {
  it("applies discount before VAT and tax2 using server rounding", () => {
    const line = {
      ...newArDraftLine(1),
      quantity: "3",
      unit_price: "12.345",
      discount_pct: "10",
      vat_rate: 7,
      tax2_rate: 3,
    };
    expect(line.group_no).toBe(1);
    expect(arLineAmounts(line)).toEqual({
      subtotal: 37.04,
      discount: 3.7,
      net: 33.34,
      vat: 2.33,
      tax2: 1,
      total: 36.67,
    });
  });
  it("rounds overrides and base parts individually like the writer", () => {
    const line = {
      ...newArDraftLine(1),
      quantity: 1,
      unit_price: 10,
      discount_is_override: true,
      discount_amount: 1.235,
      vat_is_override: true,
      vat_amount: 0.126,
      tax2_is_override: true,
      tax2_amount: 0.555,
    };
    expect(arLineAmounts(line)).toEqual({
      subtotal: 10,
      discount: 1.24,
      net: 8.76,
      vat: 0.13,
      tax2: 0.56,
      total: 9.45,
    });
    expect(arLineBaseTotal(line, 1.2345)).toBe(11.67);
  });
  it("roundtrips complete detail fields while excluding response-only values", () => {
    const record = {
      ...newArDraftLine(2),
      quantity: 2,
      unit_price: 100,
      total_amount: 210,
      unpaid_amount: 210,
      reference_info: "FOL-100\nGuest booking",
      date_from: "2026-11-01",
      date_to: "2026-11-02",
      unit_id: "unit",
      unit_name: "Night",
      group_no: 5,
      discount_pct: 10,
      discount_is_override: true,
      discount_amount: 5,
      vat_tax_profile_id: "vat",
      vat_rate: 7,
      vat_is_override: true,
      vat_amount: 14,
      vat_chart_of_accounts_id: "vat-account",
      vat_cost_center_id: "vat-center",
      tax2_tax_profile_id: "tax2",
      tax2_rate: 3,
      tax2_amount: 6,
      tax2_chart_of_accounts_id: "tax2-account",
      tax2_cost_center_id: "tax2-center",
      tb_ar_invoice_detail_dimension: [
        {
          gl_dimension_id: "dimension",
          gl_dimension_value_id: "value",
          dimension_code: "MARKET",
          value_code: "ONLINE",
        },
      ],
    };
    const input = draftLineToInput(draftLineFromRecord(record));
    expect(input).toMatchObject({
      reference_info: record.reference_info,
      date_from: record.date_from,
      date_to: record.date_to,
      unit_id: "unit",
      group_no: 5,
      discount_is_override: true,
      discount_amount: 5,
      vat_tax_profile_id: "vat",
      vat_is_override: true,
      vat_amount: 14,
      tax2_tax_profile_id: "tax2",
      vat_chart_of_accounts_id: "vat-account",
      tax2_chart_of_accounts_id: "tax2-account",
      dimensions: [
        { gl_dimension_id: "dimension", gl_dimension_value_id: "value" },
      ],
    });
    for (const key of [
      "id",
      "vat_rate",
      "total_amount",
      "unpaid_amount",
      "tb_ar_invoice_detail_dimension",
    ])
      expect(input).not.toHaveProperty(key);
  });
});
