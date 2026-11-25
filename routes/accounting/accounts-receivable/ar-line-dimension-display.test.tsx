import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { IntlProvider } from "use-intl";
import { expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ArInvoiceLines } from "./ar-invoice-lines";
import { ContractLines } from "./ar-contract-lines";
import type { ArDraftLine } from "./ar-invoice-draft-model";

vi.mock("./use-ar-invoice-line-labels", () => ({
  useArInvoiceLineLabels: (lines: ArDraftLine[]) => ({ lines }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-chart-of-account", () => ({
  useChartOfAccountById: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-cost-center", () => ({
  useCostCenterById: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({
    dateFormat: "DD/MM/YYYY",
    defaultBu: {
      config: {
        amount_format: { locales: "en-US" },
        default_currency: { decimal_places: 2 },
      },
    },
  }),
}));
vi.mock("@/hooks/use-gl-dimensions", () => ({
  useGlDimensions: () => ({
    data: [
      { id: "text", name: "Text dimension", data_type: "string" },
      { id: "number", name: "Number dimension", data_type: "number" },
      { id: "zero", name: "Zero dimension", data_type: "number" },
      { id: "flag", name: "Flag dimension", data_type: "boolean" },
      {
        id: "date",
        name: "Date dimension",
        data_type: "date",
      },
      { id: "lookup", name: "Lookup dimension", data_type: "lookup" },
    ],
  }),
  useGlDimensionValues: () => ({
    data: [
      { id: "direct", dimension_id: "lookup", code: "DIR", name: "Direct" },
    ],
  }),
}));

const line: ArDraftLine = {
  id: "line",
  sequence_no: 1,
  description: "Dimension regression line",
  quantity: 2,
  unit_price: 100,
  cr_chart_of_accounts_id: "revenue",
  cr_cost_center_id: "center",
  dimensions: [
    {
      dimension_id: "text",
      dimension_code: "Text dimension",
      value: "Travel",
      data_type: "string",
    },
    {
      dimension_id: "number",
      dimension_code: "Number dimension",
      value_number: "1234.50000",
      data_type: "number",
    },
    {
      dimension_id: "zero",
      dimension_code: "Zero dimension",
      value_number: 0,
      data_type: "number",
    },
    {
      dimension_id: "flag",
      dimension_code: "Flag dimension",
      value_boolean: false,
      data_type: "boolean",
    },
    {
      dimension_id: "date",
      dimension_code: "Date dimension",
      value_date: "2026-11-17",
      data_type: "date",
    },
    {
      dimension_id: "lookup",
      dimension_code: "Lookup dimension",
      dimension_value_id: "direct",
    },
  ],
};

it.each(["invoice", "contract"])(
  "shows lookup and typed values, including false and zero, in %s line details",
  async (kind) => {
    render(
      <IntlProvider locale="en" messages={messages} timeZone="UTC">
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            {kind === "invoice" ? (
              <ArInvoiceLines lines={[line]} />
            ) : (
              <ContractLines
                lines={[line]}
                readOnly
                add={vi.fn()}
                edit={vi.fn()}
                remove={vi.fn()}
              />
            )}
          </MemoryRouter>
        </QueryClientProvider>
      </IntlProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Dimension regression line" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    for (const [label, value] of [
      ["Text dimension", "Travel"],
      ["Number dimension", "1,234.5"],
      ["Zero dimension", "0"],
      ["Flag dimension", "No"],
      ["Date dimension", "17/11/2026"],
      ["Lookup dimension", "DIR"],
    ]) {
      const field = dialog
        .getByText(label)
        .closest<HTMLElement>("[data-slot=field]")!;
      expect(within(field).getByText(value)).toBeVisible();
    }
  },
);
