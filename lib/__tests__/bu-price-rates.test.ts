import { describe, expect, it } from "vitest";
import { computeGrossPrice, resolvePriceRates } from "@/lib/bu-price-rates";

describe("computeGrossPrice (Thai ++: service on net, VAT on net + service)", () => {
  it("690 net, 10% service, 7% VAT → 812.13", () => {
    expect(computeGrossPrice(690, { service: 10, vat: 7 })).toEqual({
      net: 690,
      service: 69,
      vat: 53.13,
      gross: 812.13,
    });
  });
  it("no service: VAT on net only", () => {
    expect(computeGrossPrice(100, { service: 0, vat: 7 }).gross).toBe(107);
  });
});

describe("resolvePriceRates", () => {
  it("reads the BU's Default Setting values", () => {
    const config = [
      {
        key: "general.default-vat-rate",
        label: "",
        datatype: "number",
        value: "7",
      },
      {
        key: "general.default-service-rate",
        label: "",
        datatype: "number",
        value: "10",
      },
    ];
    expect(resolvePriceRates(config as never)).toEqual({ service: 10, vat: 7 });
  });
  it("not set (or config returned as {}) → registry defaults 0% service, 7% VAT", () => {
    expect(resolvePriceRates([] as never)).toEqual({ service: 0, vat: 7 });
    expect(resolvePriceRates({} as never)).toEqual({ service: 0, vat: 7 });
  });
});
