import { expect, it } from "vitest";
import { buildCoaAccountLinks } from "./coa-account-links";
import type { CoaFormValues } from "./coa-form-schema";
import {
  ACCOUNT_NATURE,
  CHART_OF_ACCOUNT_TYPE,
  type AccountDimension,
  type ChartOfAccountDetail,
} from "@/types/chart-of-accounts";

const dimension = (
  id: string,
  requirement: AccountDimension["requirement"] = "optional",
): AccountDimension => ({
  dimension_id: id,
  code: id,
  name: id,
  data_type: "lookup",
  requirement,
  config: { allowed_values: [], default_value: null, default_value_id: null },
});
const account: ChartOfAccountDetail = {
  id: "account",
  doc_version: 1,
  code: "100",
  description_1: "Cash",
  nature: ACCOUNT_NATURE.DEBIT,
  type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
  category: "asset",
  is_active: true,
  cost_centers: [
    { cost_center_id: "keep", code: "KEEP", name: "Keep", is_active: false },
    {
      cost_center_id: "remove",
      code: "REMOVE",
      name: "Remove",
      is_active: true,
    },
  ],
  dimensions: [
    dimension("keep"),
    dimension("change"),
    dimension("remove"),
    dimension("blocked", "prohibited"),
  ],
};
const values: CoaFormValues = {
  code: "100",
  description_1: "Cash",
  description_2: "",
  nature: ACCOUNT_NATURE.DEBIT,
  type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
  category: "asset",
  account_group_id: "",
  is_active: true,
  req_cost_center: false,
  allowed_cost_center_ids: ["keep", "add"],
  req_dim: true,
  dimension_rules: {
    keep: "optional",
    change: "mandatory",
    add: "mandatory",
    blocked: "prohibited",
  },
};

it("builds only the account's changed links, preserving optional/prohibited rules and inactive selections", () => {
  expect(buildCoaAccountLinks(account, values, {})).toEqual({
    cost_centers: {
      add: [{ cost_center_id: "add" }],
      remove: [{ cost_center_id: "remove" }],
    },
    dimensions: {
      add: [{ dimension_id: "add", requirement: "mandatory" }],
      update: [{ dimension_id: "change", requirement: "mandatory" }],
      remove: [{ dimension_id: "remove" }],
    },
  });
});

it("omits unchanged relationships rather than overwriting saved configs", () => {
  expect(
    buildCoaAccountLinks(
      account,
      {
        ...values,
        allowed_cost_center_ids: ["keep", "remove"],
        dimension_rules: Object.fromEntries(
          account.dimensions.map((item) => [
            item.dimension_id,
            item.requirement,
          ]),
        ),
      },
      {},
    ),
  ).toEqual({});
});

it("sends explicit empty configs to clear saved values and never writes drafts for removed dimensions", () => {
  const result = buildCoaAccountLinks(account, values, {
    keep: { allowedValueIds: [], defaultValueId: null },
    add: { allowedValueIds: ["value"], defaultValueId: "value" },
    remove: { allowedValueIds: ["unused"], defaultValueId: "unused" },
  });
  expect(result.dimensions?.update).toContainEqual({
    dimension_id: "keep",
    requirement: "optional",
    config: { allowed_value_ids: [], default_value_id: null },
  });
  expect(result.dimensions?.add).toEqual([
    {
      dimension_id: "add",
      requirement: "mandatory",
      config: { allowed_value_ids: ["value"], default_value_id: "value" },
    },
  ]);
  expect(
    result.dimensions?.update.some((item) => item.dimension_id === "remove"),
  ).toBe(false);
});

it("turning off dimensions removes selected rules while retaining prohibited posting restrictions", () => {
  expect(
    buildCoaAccountLinks(account, { ...values, req_dim: false }, {}).dimensions,
  ).toEqual({
    add: [],
    update: [],
    remove: [
      { dimension_id: "keep" },
      { dimension_id: "change" },
      { dimension_id: "remove" },
    ],
  });
});

it("builds additions for a newly created account without reading any Cost Center details", () => {
  const result = buildCoaAccountLinks(undefined, values, {});
  expect(result.cost_centers).toEqual({
    add: [{ cost_center_id: "keep" }, { cost_center_id: "add" }],
    remove: [],
  });
  expect(result.dimensions?.update).toEqual([]);
  expect(result.dimensions?.remove).toEqual([]);
});
