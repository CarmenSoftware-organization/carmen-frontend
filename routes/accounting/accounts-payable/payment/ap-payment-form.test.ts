import { describe, expect, it } from "vitest";
import type { ApPayment, ApWhtPreviewRow } from "@/types/accounts-payable";
import {
  initialPaymentForm,
  applyVendorPaymentDefaults,
  mergeWhtPreview,
  toPaymentInput,
  validatePaymentForm,
  type PaymentWhtRow,
} from "./ap-payment-form";

const preview: ApWhtPreviewRow = {
  wht_tax_profile_id: "service-3",
  wht_tax_profile_name: "Service 3%",
  pnd_form: "PND53",
  income_type: "Service fee",
  wht_rate: "3",
  base_amount: "1000.00",
  wht_amount: "30.00",
};

const overridden: PaymentWhtRow = {
  key: "wht-row",
  wht_tax_profile_id: "service-3",
  name: "Service 3%",
  rate: "3",
  pnd_form: "PND53",
  income_type: "Service fee",
  base_amount: "500.00",
  wht_amount: "15.01",
  is_override: true,
};

describe("AP payment field round trips", () => {
  it("creates WHT from vendor defaults without overwriting manual choices or another vendor", () => {
    const form = { ...initialPaymentForm(null), vendor_id: "vendor" };
    const defaults = {
      vendor_id: "vendor",
      payment: {
        id: "type",
        code: "BANK",
        description: "Bank",
        bank_account_id: "bank",
        is_cheque: false,
      },
      service: { id: "service", description: "Service 3%", rate_percent: 3 },
      wht_form_id: "pnd53",
    } as Parameters<typeof applyVendorPaymentDefaults>[1];
    const result = applyVendorPaymentDefaults(form, defaults);
    expect(result).toMatchObject({
      payment_type_id: "type",
      bank_account_id: "bank",
      wht: [
        { wht_service_type_id: "service", wht_form_id: "pnd53", rate: "3" },
      ],
    });
    expect(
      applyVendorPaymentDefaults(
        { ...form, payment_type_id: "manual", wht_manual: true },
        defaults,
      ),
    ).toMatchObject({
      payment_type_id: "manual",
      bank_account_id: "",
      wht: [],
    });
    expect(
      applyVendorPaymentDefaults({ ...form, vendor_id: "other" }, defaults).wht,
    ).toEqual([]);
    expect(
      applyVendorPaymentDefaults(form, { vendor_id: "vendor" }).wht,
    ).toEqual([]);
  });
  it("allows zero payments with credit expenses and rejects negative or unbalanced payment input", () => {
    const form = {
      ...initialPaymentForm(null),
      vendor_id: "vendor",
      payment_type_id: "type",
      bank_account_id: "bank",
      payment_amount: "0",
      expenses: [
        {
          key: "expense",
          chart_of_accounts_id: "rounding",
          cost_center_id: null,
          description: "Credit adjustment",
          amount: "100",
          is_credit: true,
        },
      ],
    };
    const allocations = [
      { ap_invoice_detail_id: "line", applied_amount: "100" },
    ];
    expect(validatePaymentForm(form, "create", allocations, false).size).toBe(
      0,
    );
    expect(toPaymentInput(form, allocations).expenses?.[0]).toMatchObject({
      amount: "100",
      is_credit: true,
    });
    expect(
      validatePaymentForm(
        { ...form, payment_amount: "1" },
        "create",
        allocations,
        false,
      ).has("balance"),
    ).toBe(true);
    expect(
      validatePaymentForm(
        { ...form, payment_amount: "-1" },
        "create",
        allocations,
        false,
      ).has("balance"),
    ).toBe(true);
    expect(
      validatePaymentForm(
        { ...form, expenses: [{ ...form.expenses[0], amount: "-100" }] },
        "create",
        allocations,
        false,
      ).has("expense"),
    ).toBe(true);
  });
  it("retains Payment Type, WHT Form and Service Type IDs and preserves the form on recalculation", () => {
    const loaded = {
      payment_type_id: "payment-type",
      wht: [
        {
          id: "row",
          wht_tax_profile_id: null,
          wht_service_type_id: "service",
          wht_form_id: "form",
          wht_rate: "3",
          base_amount: "1000",
          wht_amount: "30",
          is_override: false,
        },
      ],
      master_snapshots: {
        payment_type: {
          id: "payment-type",
          code: "BANK",
          description: "Transfer",
        },
        wht_forms: [{ id: "form", code: "PND53", description: "Company WHT" }],
        wht_services: [{ id: "service", description: "Service 3%" }],
      },
    } as unknown as ApPayment;
    const form = initialPaymentForm(loaded);
    expect(form.payment_type_label).toBe("BANK · Transfer");
    expect(form.wht[0].name).toBe("Service 3%");
    const rows = mergeWhtPreview(
      form.wht,
      [
        {
          ...preview,
          wht_tax_profile_id: null,
          wht_service_type_id: "service",
        },
      ],
      false,
    );
    expect(rows[0].wht_form_id).toBe("form");
    const input = toPaymentInput(
      { ...form, exchange_rate: "1", description: "", reference_no: "" },
      [],
    );
    expect(input.payment_type_id).toBe("payment-type");
    expect(input.wht?.[0]).toMatchObject({
      wht_tax_profile_id: null,
      wht_service_type_id: "service",
      wht_form_id: "form",
    });
  });
  it("retains WHT income type and canonical expense base amounts when loading", () => {
    const loaded = {
      wht: [
        {
          ...overridden,
          id: "wht-row",
          wht_tax_profile_name: overridden.name,
          wht_rate: overridden.rate,
        },
      ],
      expenses: [
        {
          id: "expense",
          chart_of_accounts_id: "bank-fee",
          cost_center_id: null,
          description: "Fee",
          amount: "1.23",
          base_amount: "42.98",
        },
      ],
    } as unknown as ApPayment;
    const form = initialPaymentForm(loaded);
    expect(form.wht[0].income_type).toBe("Service fee");
    expect(form.expenses[0].base_amount).toBe("42.98");
  });

  it("keeps a user's base and amount overrides during automatic WHT refresh", () => {
    expect(mergeWhtPreview([overridden], [preview], true)).toEqual([
      overridden,
    ]);
  });

  it("retains manually selected profiles when preview no longer contains them", () => {
    const manual = { ...overridden, wht_tax_profile_id: "other-service" };
    expect(mergeWhtPreview([manual], [], true)).toEqual([manual]);
    expect(mergeWhtPreview([manual], [preview], true)).toEqual([manual]);
  });

  it("keeps an explicitly emptied WHT set across automatic preview until recalculated", () => {
    const form = { ...initialPaymentForm(null), wht: [], wht_manual: true };
    expect(mergeWhtPreview(form.wht, [preview], true, form.wht_manual)).toEqual(
      [],
    );
    expect(toPaymentInput(form, []).wht).toEqual([]);
    expect(toPaymentInput(form, [])).not.toHaveProperty("wht_manual");
    expect(
      mergeWhtPreview(form.wht, [preview], false, form.wht_manual),
    ).toMatchObject([
      {
        wht_tax_profile_id: preview.wht_tax_profile_id,
        wht_amount: "30.00",
        is_override: false,
      },
    ]);
    expect(initialPaymentForm(null).wht_manual).toBe(false);
  });

  it("explicit recalculation resets overrides using backend amounts and metadata", () => {
    const result = mergeWhtPreview([overridden], [preview], false);
    expect(result[0]).toMatchObject({
      base_amount: "1000.00",
      wht_amount: "30.00",
      income_type: "Service fee",
      is_override: false,
    });
  });

  it("sends selected profile, taxable base and amount without response-only metadata", () => {
    const form = { ...initialPaymentForm(null), wht: [overridden] };
    expect(toPaymentInput(form, []).wht).toEqual([
      {
        wht_tax_profile_id: "service-3",
        base_amount: "500.00",
        wht_amount: "15.01",
        is_override: true,
      },
    ]);
  });

  it("rejects incomplete and negative WHT inputs while allowing zero", () => {
    const validate = (row: PaymentWhtRow) =>
      validatePaymentForm(
        { ...initialPaymentForm(null), wht: [row] },
        "create",
        [],
        false,
      ).has("whtAmount");
    expect(validate({ ...overridden, base_amount: "0", wht_amount: "0" })).toBe(
      false,
    );
    expect(validate({ ...overridden, base_amount: "" })).toBe(true);
    expect(validate({ ...overridden, base_amount: "-1" })).toBe(true);
    expect(validate({ ...overridden, wht_tax_profile_id: "" })).toBe(true);
  });

  it("allows saving a valid edited WHT set after the allocation preview succeeds", () => {
    const form = {
      ...initialPaymentForm(null),
      vendor_id: "vendor",
      payment_type_id: "type",
      bank_account_id: "bank",
      wht: mergeWhtPreview([overridden], [preview], true),
    };
    expect(
      validatePaymentForm(form, "create", [{ applied_amount: "1000" }], false)
        .size,
    ).toBe(0);
  });
});
