import { beforeEach, describe, expect, it } from "vitest";
import {
  advanceDepositSummary,
  readAdvanceDeposits,
  saveAdvanceDeposit,
} from "./ar-advance-deposit-model";

beforeEach(() => sessionStorage.clear());

describe("advance deposit samples", () => {
  it("excludes drafts and refunds from available funds", () => {
    const rows = readAdvanceDeposits("BU1");
    expect(advanceDepositSummary(rows)).toEqual({
      count: 4,
      received: 192600,
      applied: 74900,
      available: 117700,
    });
    expect(
      advanceDepositSummary([{ ...rows[0], status: "refunded" }]).available,
    ).toBe(0);
  });
  it("saves valid samples per BU and rejects invalid money or overapplication", () => {
    const row = {
      ...readAdvanceDeposits("BU1")[0],
      id: "new",
      number: "AD-NEW",
      status: "draft" as const,
    };
    expect(saveAdvanceDeposit("BU1", row)).toHaveLength(5);
    expect(readAdvanceDeposits("BU1")[0].number).toBe("AD-NEW");
    expect(readAdvanceDeposits("BU2")).toHaveLength(4);
    expect(() => saveAdvanceDeposit("BU2", { ...row, amount: -1 })).toThrow();
    expect(() =>
      saveAdvanceDeposit("BU2", { ...row, applied: row.amount + 1 }),
    ).toThrow();
    expect(readAdvanceDeposits("BU2")).toHaveLength(4);
  });
  it("does not replace corrupt stored data with seed records", () => {
    sessionStorage.setItem(
      "carmen.ar.advance-deposit-samples.v1.BU1",
      "bad json",
    );
    expect(() => readAdvanceDeposits("BU1")).toThrow();
  });
});
