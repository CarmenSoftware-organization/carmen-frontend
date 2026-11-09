import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import { useForm, useFieldArray } from "react-hook-form";

// ── stub network so lookups / profile queries don't hit a backend ───────────
vi.mock("@/lib/http-client", () => ({
  httpClient: {
    get: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
  },
}));

import en from "@/messages/en.json";
import { PR_ITEM, type PrFormValues } from "./pr-form-schema";
import { formatCurrency } from "@/lib/currency-utils";
import { PrItemExpand } from "./pr-item-expand";

type Item = PrFormValues["items"][number];

const money = (n: number) => formatCurrency(n);

function fieldValue(labelText: string): string {
  const label = screen
    .getAllByText(labelText)
    .find((el) => el.getAttribute("data-slot") === "field-label");
  if (!label) throw new Error(`label not found: ${labelText}`);
  const field = label.closest('[data-slot="field"]');
  const p = field?.querySelector("p");
  return (p?.textContent ?? "").trim();
}

function Harness({ seed }: { seed: Partial<Item> }) {
  const form = useForm<PrFormValues>({
    defaultValues: {
      pr_date: "",
      description: "",
      workflow_id: "wf",
      requestor_id: "u",
      department_id: "d",
      items: [{ ...PR_ITEM, ...seed } as Item],
    },
    mode: "onChange",
  });
  const { fields } = useFieldArray({ control: form.control, name: "items" });
  if (!fields.length) return null;
  return (
    <PrItemExpand
      item={fields[0]}
      form={form}
      isDisabled={false}
      itemFields={fields}
      buCode="BU"
      baseCurrencyCode="THB"
    />
  );
}

function renderExpand(seed: Partial<Item>) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <IntlProvider locale="en" messages={en}>
        <Harness seed={seed} />
      </IntlProvider>
    </QueryClientProvider>,
  );
}

const priceInput = () =>
  document.getElementById("items-0-pricelist-price") as HTMLInputElement;
const discRateInput = () =>
  document.getElementById("items-0-discount-rate") as HTMLInputElement;
const discAmtInput = () =>
  document.getElementById("items-0-discount-amount") as HTMLInputElement;
const taxAmtInput = () =>
  document.getElementById("items-0-tax-amount") as HTMLInputElement;
const exRateInput = () =>
  document.getElementById("items-0-exchange-rate") as HTMLInputElement;

const setNum = (el: HTMLInputElement, v: string) =>
  fireEvent.change(el, { target: { value: v } });

describe("PrItemExpand — numeric correctness on events", () => {
  // subtotal = round2(price*qty); disc = round2(sub*rate/100); net = round2(sub-disc);
  // tax = round2(net*taxRate/100); total = round2(net+tax)

  it("price event → subtotal/net/total recompute (no disc/tax)", () => {
    renderExpand({ requested_qty: 3 });
    setNum(priceInput(), "10");
    // sub 30, net 30, total 30
    expect(fieldValue("Subtotal")).toBe(money(30));
    expect(fieldValue("Net")).toBe(money(30));
    expect(fieldValue("Total")).toBe(money(30));
  });

  it("discount rate + tax rate → each round2 layer exact", () => {
    // price 10 qty 3 sub 30; disc 10% -> 3; net 27; tax 7% -> round2(1.89)=1.89; total 28.89
    renderExpand({ requested_qty: 3, tax_rate: 7 });
    setNum(priceInput(), "10");
    setNum(discRateInput(), "10");
    expect(fieldValue("Subtotal")).toBe(money(30));
    expect(fieldValue("Net")).toBe(money(27));
    expect(fieldValue("Total")).toBe(money(28.89));
  });

  it("rounding at every layer (price 3.33 × 3)", () => {
    // sub round2(9.99)=9.99; disc 10% round2(0.999)=1.00; net round2(8.99)=8.99;
    // tax 7% round2(0.6293)=0.63; total round2(9.62)=9.62
    renderExpand({ requested_qty: 3, tax_rate: 7 });
    setNum(priceInput(), "3.33");
    setNum(discRateInput(), "10");
    expect(fieldValue("Subtotal")).toBe(money(9.99));
    expect(fieldValue("Net")).toBe(money(8.99));
    expect(fieldValue("Total")).toBe(money(9.62));
  });

  it("discount rate clamps to 100 on event", () => {
    // sub 30; disc 150→clamp100 → 30; net 0; total 0
    renderExpand({ requested_qty: 3 });
    setNum(priceInput(), "10");
    setNum(discRateInput(), "150");
    expect(discRateInput().value).toBe("100");
    expect(fieldValue("Net")).toBe(money(0));
    expect(fieldValue("Total")).toBe(money(0));
  });

  it("discount override → amount is used verbatim (rate ignored)", () => {
    renderExpand({ requested_qty: 3, tax_rate: 10 });
    setNum(priceInput(), "10"); // sub 30
    // toggle discount override (checkbox[0])
    // checkbox[0] = Inc VAT (ข้างช่องราคา) · [1] = discount override · [2] = tax override
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    setNum(discAmtInput(), "5"); // disc 5 -> net 25; tax 10% -> 2.50; total 27.50
    expect(fieldValue("Net")).toBe(money(25));
    expect(fieldValue("Total")).toBe(money(27.5));
  });

  it("tax override → tax amount verbatim, total = net + taxAmt", () => {
    renderExpand({ requested_qty: 3 });
    setNum(priceInput(), "10"); // sub 30, net 30
    fireEvent.click(screen.getAllByRole("checkbox")[2]); // tax override
    setNum(taxAmtInput(), "4.56"); // total round2(34.56)=34.56
    expect(fieldValue("Total")).toBe(money(34.56));
  });

  it("approved_qty overrides requested_qty in subtotal", () => {
    // approved 5 > 0 → calcQty 5; price 10 → sub 50
    renderExpand({ requested_qty: 3, approved_qty: 5 });
    setNum(priceInput(), "10");
    expect(fieldValue("Subtotal")).toBe(money(50));
    expect(fieldValue("Total")).toBe(money(50));
  });

  it("amount fields show fixed decimals when not focused (10 → 10.00)", () => {
    renderExpand({ requested_qty: 1, currency_decimal_places: 2 });
    // Unit Price: type 10, blur → displays 10.00
    fireEvent.change(priceInput(), { target: { value: "10" } });
    fireEvent.blur(priceInput());
    expect(priceInput().value).toBe("10.00");
    // discount override amount: type 5.5 → 5.50 after blur
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.change(discAmtInput(), { target: { value: "5.5" } });
    fireEvent.blur(discAmtInput());
    expect(discAmtInput().value).toBe("5.50");
  });

  it("amount field trims decimals beyond currency places on type", () => {
    renderExpand({ requested_qty: 1, currency_decimal_places: 2 });
    fireEvent.click(screen.getAllByRole("checkbox")[2]); // tax override
    fireEvent.focus(taxAmtInput());
    fireEvent.change(taxAmtInput(), { target: { value: "1.239" } });
    // typed value trimmed to 2 dp while focused
    expect(taxAmtInput().value).toBe("1.23");
    fireEvent.blur(taxAmtInput());
    expect(taxAmtInput().value).toBe("1.23");
  });

  it("exchange rate uses fixed 5 decimals (32.095 → 32.09500)", () => {
    renderExpand({ requested_qty: 1, currency_code: "USD" });
    fireEvent.change(exRateInput(), { target: { value: "32.095" } });
    fireEvent.blur(exRateInput());
    expect(exRateInput().value).toBe("32.09500");
  });

  it("foreign currency → base-currency summary row = value × exchange rate", () => {
    renderExpand({
      requested_qty: 2,
      currency_code: "USD",
      tax_rate: 5,
    });
    setNum(priceInput(), "10"); // sub 20
    setNum(discRateInput(), "10"); // disc 2 → net 18
    // tax 5% → round2(0.90)=0.90; total 18.90
    setNum(exRateInput(), "35");
    // item-currency amounts
    expect(fieldValue("Subtotal")).toBe(money(20));
    expect(fieldValue("Net")).toBe(money(18));
    expect(fieldValue("Total")).toBe(money(18.9));
    // base-currency row (unrounded × rate, formatted): 700 / 70 / 630 / 31.50 / 661.50
    const base = document.body;
    expect(within(base).getByText(money(700))).toBeTruthy();
    expect(within(base).getByText(money(70))).toBeTruthy();
    expect(within(base).getByText(money(630))).toBeTruthy();
    expect(within(base).getByText(money(31.5))).toBeTruthy();
    expect(within(base).getByText(money(661.5))).toBeTruthy();
  });
});
