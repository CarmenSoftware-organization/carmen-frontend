import { describe, expect, it } from "vitest";
import {
  canReconcileCheque,
  chequeSamples,
  outputTaxSamples,
  outputTaxSummary,
} from "./operations-model";

describe("accounting preview controls", () => {
  it("keeps the AR register scoped to received-cheque lifecycle states", () => {
    expect(chequeSamples.every((row) => row.reference.startsWith("RC-"))).toBe(
      true,
    );
    expect(new Set(chequeSamples.map((row) => row.status))).toEqual(
      new Set(["on_hand", "in_transit", "cleared", "bounced"]),
    );
  });
  it("only clears matching outstanding cheques", () => {
    const row = chequeSamples[0];
    expect(canReconcileCheque(row)).toBe(true);
    expect(canReconcileCheque(chequeSamples[1])).toBe(false);
    for (const patch of [
      { status: "cleared" },
      { status: "bounced" },
      { status: "on_hand" },
      { statementNumber: "other" },
      { statementDate: "" },
      { statementDate: "2026-11-01" },
    ] as const) {
      expect(canReconcileCheque({ ...row, ...patch })).toBe(false);
    }
  });
  it("blocks empty and unreviewed VAT periods and nets signed credit notes", () => {
    expect(outputTaxSummary([]).canPrepare).toBe(false);
    const november = outputTaxSamples.filter((row) => row.period === "2026-11");
    expect(outputTaxSummary(november)).toEqual({
      base: 160000,
      vat: 11200,
      exceptions: 1,
      canPrepare: false,
    });
    expect(
      outputTaxSummary(november.filter((row) => row.taxPoint === "due")),
    ).toEqual({ base: 110000, vat: 7700, exceptions: 1, canPrepare: false });
    expect(
      outputTaxSummary(
        november
          .filter((row) => row.taxPoint === "due")
          .map((row) => ({
            ...row,
            taxId: "0000000000000",
            status: "ready",
          })),
      ).canPrepare,
    ).toBe(true);
    expect(
      outputTaxSummary([{ ...november[1], status: "ready" }]).canPrepare,
    ).toBe(false);
    expect(outputTaxSummary([{ ...november[0], taxId: "" }]).canPrepare).toBe(
      false,
    );
  });
});
