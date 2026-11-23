import { describe, expect, it } from "vitest";
import { computeRecipeCost, liveFoodCostPct } from "./use-recipe-cost-calc";

// ทุกตัวเลขคิดทั้งสูตร: ต้นทุนทั้งสูตรเทียบราคาขายทั้งสูตร — จำนวน portion ใช้แค่ต้นทุนต่อ portion
describe("computeRecipeCost — whole recipe", () => {
  const base = {
    ingredientCost: 172.41,
    laborCost: 60,
    overheadCost: 25,
    baseYield: 2,
    sellingPrice: 690,
    targetFoodCostPct: 35,
    maxFoodCostPct: 40,
  };

  it("compares the whole-recipe cost with the whole-recipe price", () => {
    const c = computeRecipeCost(base);
    expect(c.actualFoodCostPct).toBe(24.99); // 172.41 / 690
    expect(c.laborCostPct).toBe(8.7);
    expect(c.overheadPct).toBe(3.62);
    expect(c.grossMargin).toBe(432.59); // 690 − 257.41
    expect(c.grossMarginPct).toBe(62.69);
    expect(c.markup).toBe(2.68); // 690 / 257.41
  });

  it("portions only change the cost per portion", () => {
    const two = computeRecipeCost(base);
    const four = computeRecipeCost({ ...base, baseYield: 4 });
    expect(two.costPerPortion).toBe(128.7); // 257.41 / 2 (float 257.40999…)
    expect(four.costPerPortion).toBe(64.35);
    expect(four.actualFoodCostPct).toBe(two.actualFoodCostPct);
    expect(four.grossMargin).toBe(two.grossMargin);
    expect(four.suggestedPrice).toBe(two.suggestedPrice);
  });

  it("suggested and minimum prices are whole-recipe prices from the ingredient cost", () => {
    const c = computeRecipeCost(base);
    expect(c.suggestedPrice).toBe(492.6); // 172.41 / 0.35
    expect(c.minPrice).toBe(431.03); // 172.41 / 0.40
    expect(c.belowMinPrice).toBe(false);
    expect(
      computeRecipeCost({ ...base, sellingPrice: 400 }).belowMinPrice,
    ).toBe(true);
  });

  it("no price: ratios are null, no portions: cost per portion is 0", () => {
    const c = computeRecipeCost({ ...base, sellingPrice: null, baseYield: 0 });
    expect(c.actualFoodCostPct).toBeNull();
    expect(c.grossMargin).toBeNull();
    expect(c.costPerPortion).toBe(0);
    expect(c.suggestedPrice).toBe(492.6);
  });
});

describe("liveFoodCostPct", () => {
  it("recomputes from the stored costs, not the stored ratio", () => {
    const stale = {
      total_ingredient_cost: 172.41,
      labor_cost: 60,
      overhead_cost: 25,
      base_yield: 2,
      selling_price: 690,
      actual_food_cost_percentage: 12.49, // saved under the old per-portion formula
    };
    expect(liveFoodCostPct(stale)).toBe(24.99);
  });
  it("no selling price gives null (the list shows —)", () => {
    expect(
      liveFoodCostPct({
        total_ingredient_cost: 10,
        labor_cost: 0,
        overhead_cost: 0,
        base_yield: 1,
        selling_price: null,
      }),
    ).toBeNull();
  });
});
