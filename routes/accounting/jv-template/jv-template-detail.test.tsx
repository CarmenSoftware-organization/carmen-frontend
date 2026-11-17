import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { JvTemplateDetail } from "./jv-template-detail";

const state = vi.hoisted(() => ({ pending: false }));

vi.mock("./use-jv-template", () => ({
  useJvTemplate: () => ({ data: undefined, isLoading: false }),
  useCreateJvTemplate: () => ({ isPending: state.pending }),
  useUpdateJvTemplate: () => ({ isPending: false }),
  useDeleteJvTemplate: () => ({ isPending: false }),
}));
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({ can: () => true, canWrite: true }),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ dateFormat: "yyyy-MM-dd" }),
}));
vi.mock("@/hooks/use-gl-jv-prefix-options", () => ({
  useGlJvPrefixOptions: () => ({ options: [], isLoading: false }),
}));
vi.mock("@/hooks/use-cost-center", () => ({
  useCostCenterById: () => ({ data: undefined }),
}));
vi.mock("@/components/lookup/lookup-currency", () => ({
  LookupCurrency: () => <button type="button">Currency lookup</button>,
}));
vi.mock("@/components/lookup/lookup-chart-of-account-by-id", () => ({
  LookupChartOfAccountById: () => <button type="button">Account lookup</button>,
}));
vi.mock("@/components/lookup/lookup-cost-center", () => ({
  LookupCostCenter: () => <button type="button">Cost center lookup</button>,
}));

function openNew(search = "") {
  return render(
    <IntlProvider locale="en" messages={en}>
      <MemoryRouter
        initialEntries={[`/accounting/template-voucher/new${search}`]}
      >
        <Routes>
          <Route
            path="/accounting/template-voucher/:id"
            element={<JvTemplateDetail kind="all" />}
          />
        </Routes>
      </MemoryRouter>
    </IntlProvider>,
  );
}

describe("Template Voucher entry from the menu", () => {
  beforeEach(() => {
    state.pending = false;
  });

  it("locks the type while saving so switching it cannot reset the lines", () => {
    state.pending = true;
    openNew();
    expect(screen.getAllByRole("combobox")[0]).toBeDisabled();
  });

  it("opens a complete form with accounting lines and totals without a query string", () => {
    const { container } = openNew();
    expect(
      screen.getByRole("heading", { name: "Schedule" }),
    ).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "Debit" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Credit" }),
    ).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(container.querySelector(".sticky.bottom-0")).toHaveTextContent(
      "Balanced",
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("Recurring");
    expect(screen.getByRole("button", { name: /^Save$/ })).toBeEnabled();
  });

  it("keeps an explicitly requested allocation form", () => {
    openNew("?type=allocation");
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "Ratio" }),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole("columnheader", { name: "Credit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Schedule" }),
    ).toBeInTheDocument();
  });
});
