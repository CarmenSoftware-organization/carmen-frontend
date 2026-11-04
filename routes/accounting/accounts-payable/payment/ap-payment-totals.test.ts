import { describe, expect, it } from "vitest";
import { divideDecimal } from "../shared/ap-decimal";
import { paymentSummary } from "./ap-payment-totals";

describe("AP payment totals", () => {
  it("computes net paid as applied minus WHT plus expenses", () => {
    const totals = paymentSummary({
      allocations: ["1070", "500.5"],
      wht: ["30", "15.015"],
      expenses: ["40"],
    });
    expect(totals.applied).toBe("1570.50");
    expect(totals.wht).toBe("45.02");
    expect(totals.expenses).toBe("40.00");
    expect(totals.net).toBe("1565.48");
  });
  it("nets credit-note lines (negative) against invoice lines", () => {
    const totals = paymentSummary({
      allocations: ["1000", "-250"],
      wht: [],
      expenses: [],
    });
    expect(totals.applied).toBe("750.00");
    expect(totals.net).toBe("750.00");
  });
  it("returns zeros for an empty payment", () => {
    expect(paymentSummary({ allocations: [], wht: [], expenses: [] }).net).toBe(
      "0.00",
    );
  });
  it("rounds decimal division without binary floating point", () => {
    expect(divideDecimal("10", "3")).toBe("3.33");
    expect(divideDecimal("-1", "8")).toBe("-0.13");
    expect(() => divideDecimal("1", "0")).toThrow();
  });
});
