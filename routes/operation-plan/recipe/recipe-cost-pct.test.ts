import { describe, expect, it } from "vitest";
import { costPctOf, priceForCostPct } from "./recipe-cost-pct";
import { computeGrossPrice, solveNetForGross } from "@/lib/bu-price-rates";

describe("costPctOf", () => {
  it("is the ingredient cost as a percent of the price", () => {
    expect(costPctOf(20, 250)).toBe(8);
    expect(costPctOf(172.41, 690)).toBe(24.99);
  });

  it("has no percent without a price", () => {
    expect(costPctOf(20, 0)).toBeNull();
    expect(costPctOf(20, Number.NaN)).toBeNull();
  });
});

describe("priceForCostPct", () => {
  it("prices the recipe so the cost is that percent of it", () => {
    expect(priceForCostPct(0.4, 25)).toBe(1.6);
    expect(priceForCostPct(20, 8)).toBe(250);
  });

  it("rounds to the satang", () => {
    expect(priceForCostPct(10, 30)).toBe(33.33);
  });

  it("cannot price without a cost or a positive percent", () => {
    expect(priceForCostPct(0, 25)).toBeNull();
    expect(priceForCostPct(20, 0)).toBeNull();
    expect(priceForCostPct(20, -5)).toBeNull();
    expect(priceForCostPct(20, Number.NaN)).toBeNull();
  });

  it("round-trips through the price within a hundredth of a percent", () => {
    for (const [cost, pct] of [
      [172.41, 25],
      [99.99, 28.5],
      [20, 8],
    ]) {
      const price = priceForCostPct(cost, pct)!;
      expect(Math.abs(costPctOf(cost, price)! - pct)).toBeLessThanOrEqual(0.01);
    }
  });

  it("a tiny cost only gets close — the satang price is the nearest one", () => {
    // 0.37 ÷ 33% = 1.1212… → 1.12 (33.04%); 1.13 would be 32.74%
    expect(priceForCostPct(0.37, 33)).toBe(1.12);
    expect(costPctOf(0.37, 1.12)).toBe(33.04);
  });

  it("a gross cost percent sets the net price through the gross", () => {
    const rates = { service: 10, vat: 7 };
    const gross = priceForCostPct(172.41, 20)!;
    const p = solveNetForGross(gross, rates);
    expect(computeGrossPrice(p.net, rates).gross).toBe(p.gross);
    expect(Math.abs(costPctOf(172.41, p.gross)! - 20)).toBeLessThanOrEqual(
      0.01,
    );
  });
});
