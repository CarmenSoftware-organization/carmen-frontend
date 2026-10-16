import { describe, expect, it } from "vitest";
import { visibleLineDimensions } from "./journal-line-dimensions";
import type { ChartOfAccount } from "@/types/chart-of-accounts";
import type { DimensionMaster } from "@/types/accounting-master";
import type { CoaDimensionRule } from "@/lib/coa-dimension-rules";

const account = {
  id: "account",
  allowed_dimensions: ["old"],
} as ChartOfAccount;
const dimensions = ["required", "optional", "blocked", "old"].map(
  (id) => ({ id, is_active: true }) as DimensionMaster,
);
const rules = ["mandatory", "optional", "prohibited"].map(
  (requirement, i) =>
    ({
      chart_of_accounts_id: "account",
      gl_dimension_id: dimensions[i].id,
      requirement,
    }) as CoaDimensionRule,
);

describe("JV account dimensions", () => {
  it("shows mandatory and optional dimensions before a value is selected", () => {
    expect(
      visibleLineDimensions(dimensions, account, rules, []).map((d) => d.id),
    ).toEqual(["required", "optional"]);
  });
  it("keeps historical values visible after rules or active status change", () => {
    expect(
      visibleLineDimensions(
        [{ ...dimensions[2], is_active: false }],
        account,
        rules,
        [{ dimension_id: "blocked", dimension_value_id: "saved" }],
      ).map((d) => d.id),
    ).toEqual(["blocked"]);
  });
  it("does not show dimensions before an account is selected", () => {
    expect(visibleLineDimensions(dimensions, undefined, rules, [])).toEqual([]);
  });
});
