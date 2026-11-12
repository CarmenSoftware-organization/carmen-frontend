import { describe, expect, it } from "vitest";
import {
  deleteAccountGroupState,
  saveAccountGroupState,
  saveTitleState,
  saveJvPrefixState,
  saveDimensionState,
  saveBankAccountState,
  generateFiscalYearPeriods,
  toggleGlPeriodStatus,
  type AccountGroupMaster,
  type TitleMaster,
} from "./accounting-master-mock";

const title: TitleMaster = {
  id: "title-dr",
  code: "DR",
  description: "Dr.",
  is_active: true,
  is_system: false,
  reference_count: 2,
};
const root: AccountGroupMaster = {
  id: "assets",
  code: "1000",
  name: "Assets",
  name_local: "สินทรัพย์",
  level: 1,
  parent_id: null,
  category: "asset",
  sort_order: 1,
  is_active: true,
  account_count: 0,
  doc_version: 0,
};
const child: AccountGroupMaster = {
  id: "cash",
  code: "1100",
  name: "Cash",
  name_local: "เงินสด",
  level: 2,
  parent_id: root.id,
  category: "asset",
  sort_order: 1,
  is_active: true,
  account_count: 0,
  doc_version: 0,
};
const state = {
  titles: [title],
  accountGroups: [root, child],
  jvPrefixes: [],
  dimensions: [],
  bankAccounts: [],
  glPeriods: [],
  paymentTypes: [],
  whtServiceTypes: [],
  whtForms: [],
  assetCategories: [],
};

describe("accounting master mock guardrails", () => {
  it("keeps codes immutable and blocks invalid hierarchy changes", () => {
    const renamed = saveTitleState(
      state,
      { code: "CHANGED", description: "Doctor", is_active: true },
      title.id,
    );
    expect(renamed.titles[0]).toMatchObject({
      code: "DR",
      description: "Doctor",
    });

    const regrouped = saveAccountGroupState(
      state,
      { ...child, code: "CHANGED", name: "Cash and bank" },
      child.id,
    );
    expect(regrouped.accountGroups[1]).toMatchObject({
      code: "1100",
      name: "Cash and bank",
    });

    expect(() =>
      saveAccountGroupState(
        state,
        {
          code: child.code,
          name: child.name,
          level: 3,
          parent_id: root.id,
          category: "asset",
          sort_order: 1,
          is_active: true,
        },
        child.id,
      ),
    ).toThrow("Level 3 requires a level 2 parent.");
    expect(() =>
      saveAccountGroupState(
        state,
        {
          code: "1100",
          name: "Cash",
          level: 2,
          parent_id: root.id,
          category: "liability",
          sort_order: 1,
          is_active: true,
        },
        child.id,
      ),
    ).toThrow("Parent group must be in the same category (liability).");
    expect(() =>
      saveAccountGroupState(
        state,
        {
          code: "1000",
          name: "Assets",
          level: 3,
          parent_id: child.id,
          category: "asset",
          sort_order: 1,
          is_active: true,
        },
        root.id,
      ),
    ).toThrow("Cannot set a descendant group as parent.");
    expect(() => deleteAccountGroupState(state, root)).toThrow(
      "1000 still has child groups.",
    );
  });

  it("handles JV prefixes, dimensions, bank accounts and GL periods", () => {
    const withJv = saveJvPrefixState(state, {
      code: "AJ",
      description: "Adjustment",
      is_default: true,
      is_active: true,
    });
    expect(withJv.jvPrefixes[0]).toMatchObject({ code: "AJ", is_default: true });

    const withDim = saveDimensionState(state, {
      code: "market",
      name: "Market",
      is_active: true,
    });
    expect(withDim.dimensions[0]).toMatchObject({ code: "market" });

    const withBank = saveBankAccountState(state, {
      bank_name: "KBANK",
      account_number: "123",
      account_name: "Test",
      currency_code: "THB",
      is_active: true,
    });
    expect(withBank.bankAccounts[0]).toMatchObject({ bank_name: "KBANK" });

    const withPeriods = generateFiscalYearPeriods(state, 2026);
    expect(withPeriods.glPeriods).toHaveLength(13);

    const toggled = toggleGlPeriodStatus(withPeriods, withPeriods.glPeriods[0].id, "closed");
    expect(toggled.glPeriods[0].status).toBe("closed");
  });
});
