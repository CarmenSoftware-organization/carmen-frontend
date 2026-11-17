import { describe, expect, it } from "vitest";
import {
  paymentTypeSchema,
  whtFormSchema,
  whtServiceTypeSchema,
} from "./ap-master-form-schema";

const translate = (key: string) => key;
const id = "019638a6-2a00-7c4f-8e46-9b7a52c80c4d";
const common = { code: "WHT-3", description: "Service", is_active: true };

describe("AP master validation", () => {
  it("requires a real payment account, a module and a cheque template only for cheque payments", () => {
    const schema = paymentTypeSchema(translate, translate);
    const payment = {
      ...common,
      chart_of_accounts_id: id,
      cost_center_id: null,
      dimensions: [],
      available_ap: true,
      available_ar: false,
      bank_account_id: null,
      is_cheque: false,
      cheque_form_id: null,
    };
    expect(schema.safeParse(payment).success).toBe(true);
    expect(
      schema.safeParse({ ...payment, chart_of_accounts_id: "1100-01" }).success,
    ).toBe(false);
    expect(schema.safeParse({ ...payment, available_ap: false }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...payment, is_cheque: true }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({ ...payment, is_cheque: true, cheque_form_id: id })
        .success,
    ).toBe(true);
    expect(schema.safeParse({ ...payment, code: "TOO-LONG-11" }).success).toBe(
      false,
    );
  });
  it("accepts slash in WHT form codes and nullable mapping while rejecting fake mapped IDs", () => {
    const schema = whtFormSchema(translate, translate);
    const form = {
      ...common,
      code: "PND/53",
      chart_of_accounts_id: null,
      cost_center_id: null,
      dimensions: [],
    };
    expect(schema.safeParse(form).success).toBe(true);
    expect(
      schema.safeParse({
        ...form,
        dimensions: [{ dimension_id: id, dimension_value_id: "DEPT01" }],
      }).success,
    ).toBe(false);
    expect(schema.safeParse({ ...form, code: "PND 53" }).success).toBe(false);
  });
  it("preserves valid two decimal rates including zero and rejects overprecision/out of range", () => {
    const schema = whtServiceTypeSchema(translate, translate);
    for (const rate_percent of [0, 1.1, 3.25, 100])
      expect(schema.safeParse({ ...common, rate_percent }).success).toBe(true);
    for (const rate_percent of [-0.01, 100.01, 3.251, NaN])
      expect(schema.safeParse({ ...common, rate_percent }).success).toBe(false);
  });
});
