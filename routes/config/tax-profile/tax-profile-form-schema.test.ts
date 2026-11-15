import { describe, expect, it } from "vitest";
import {
  createTaxProfileSchema,
  EMPTY_FORM,
  getDefaultValues,
} from "./tax-profile-form-schema";
import type { TaxProfile } from "@/types/tax-profile";

const schema = createTaxProfileSchema(
  (key) => key,
  (key) => key,
);
const profile: TaxProfile = {
  id: "profile",
  doc_version: 7,
  name: "Service WHT",
  tax_rate: 3,
  is_active: true,
  tax_type: "wht",
  chart_of_accounts_id: "019638a6-2a00-7c4f-8e46-9b7a52c80c4d",
  wht_pnd_form: "pnd_53",
  wht_income_type: "Service fee",
};

describe("documented tax profile fields", () => {
  it("edits only name, rate and status for existing WHT profiles", () => {
    expect(schema.parse(getDefaultValues(profile))).toEqual({
      name: "Service WHT",
      tax_rate: 3,
      is_active: true,
    });
    expect(profile.wht_pnd_form).toBe("pnd_53");
  });
  it("does not send classification or posting fields when unknown metadata is present", () => {
    expect(schema.parse({ ...profile })).toEqual({
      name: "Service WHT",
      tax_rate: 3,
      is_active: true,
    });
    expect(
      getDefaultValues({
        id: "legacy",
        doc_version: 0,
        name: "VAT",
        tax_rate: 7,
        is_active: true,
      }),
    ).toEqual({ name: "VAT", tax_rate: 7, is_active: true });
  });
  it("validates the documented required name and nonnegative rate", () => {
    expect(
      schema.safeParse({
        ...EMPTY_FORM,
        name: "",
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...EMPTY_FORM,
        name: "WHT",
        tax_rate: -1,
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...EMPTY_FORM, name: "None", tax_rate: 0 }).success,
    ).toBe(true);
  });
});
