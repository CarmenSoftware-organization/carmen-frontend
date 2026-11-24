import { describe, expect, it } from "vitest";
import {
  computeGrossPrice,
  resolvePriceRates,
  solveNetForGross,
} from "@/lib/bu-price-rates";

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

describe("solveNetForGross (gross typed by the user → net to store)", () => {
  const RATES = { service: 10, vat: 7 };

  it("812.13 at 10% + 7% → back to 690.00", () => {
    expect(solveNetForGross(812.13, RATES)).toEqual({
      net: 690,
      service: 69,
      vat: 53.13,
      gross: 812.13,
    });
  });

  it("a round gross: 800 → net 679.69, which builds back up to exactly 800.00", () => {
    const p = solveNetForGross(800, RATES);
    expect(p.net).toBe(679.69);
    expect(computeGrossPrice(p.net, RATES).gross).toBe(800);
  });

  it("VAT only (registry default 0% / 7%): 107 → 100", () => {
    expect(solveNetForGross(107, { service: 0, vat: 7 }).net).toBe(100);
  });

  it("no service, no VAT: gross = net", () => {
    expect(solveNetForGross(123.45, { service: 0, vat: 0 }).net).toBe(123.45);
  });

  it("every gross from 1.00 to 300.00: exact whenever some cent net reaches it, else 1 satang off", () => {
    // every gross a whole-cent net can produce at these rates
    const reachable = new Map<number, number>();
    for (let c = 0; c <= 30000; c++) {
      const g = computeGrossPrice(c / 100, RATES).gross;
      if (!reachable.has(g)) reachable.set(g, c / 100);
    }
    for (let c = 100; c <= 30000; c++) {
      const gross = c / 100;
      const p = solveNetForGross(gross, RATES);
      // the returned set is self-consistent: building the net back up gives the same gross
      expect(computeGrossPrice(p.net, RATES)).toEqual(p);
      if (reachable.has(gross)) expect(p.gross).toBe(gross);
      else expect(Math.abs(p.gross - gross)).toBeLessThanOrEqual(0.0100001);
    }
  });

  it("0 → net 0", () => {
    expect(solveNetForGross(0, RATES).net).toBe(0);
  });
});
