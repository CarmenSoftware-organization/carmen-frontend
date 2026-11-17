import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ArInvoiceLineDialog } from "./ar-invoice-line-dialog";
import { newArDraftLine } from "./ar-invoice-draft-model";

vi.mock("@/hooks/use-chart-of-account", () => ({
  useChartOfAccountById: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-number-formatter", () => ({
  useAmountFormatter: () => (value: number) => value.toFixed(2),
}));
vi.mock("@/components/lookup/lookup-chart-of-account-by-id", () => ({
  LookupChartOfAccountById: () => <button type="button">Account lookup</button>,
}));
vi.mock("@/components/lookup/lookup-cost-center", () => ({
  LookupCostCenter: () => <button type="button">Cost center lookup</button>,
}));
vi.mock("@/components/lookup/lookup-unit", () => ({
  LookupUnit: () => <button type="button">Unit lookup</button>,
}));
vi.mock("@/components/lookup/lookup-tax-profile", () => ({
  LookupTaxProfile: () => <button type="button">Tax profile lookup</button>,
}));

it("opens the actual invoice/contract line form and calculates its discount and tax totals", () => {
  render(
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <ArInvoiceLineDialog
        line={{
          ...newArDraftLine(1),
          quantity: 2,
          unit_price: 500,
          discount_pct: 10,
          vat_rate: 7,
        }}
        isNew
        close={vi.fn()}
        save={vi.fn()}
      />
    </IntlProvider>,
  );
  expect(screen.getByRole("dialog", { name: "Add Line · 1" })).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Reference" })).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Booking & reference details" }),
  ).toBeVisible();
  expect(screen.getByRole("heading", { name: "Output tax" })).toBeVisible();
  expect(screen.getByText("1000.00")).toBeVisible();
  expect(screen.getByText("963.00")).toBeVisible();
});
