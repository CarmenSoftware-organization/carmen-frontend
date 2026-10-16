import { CoaForm } from "./coa-form";
import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { Component as CoaEditRoute } from "./coa-edit.route";
import * as useCoaModule from "./use-coa";
import * as dimensionRulesModule from "./coa-dimension-rules";
import {
  ACCOUNT_NATURE,
  CHART_OF_ACCOUNT_TYPE,
  type ChartOfAccount,
} from "@/types/chart-of-accounts";

vi.mock("@/hooks/use-bu-code", () => ({
  useBuCode: () => "BU001",
}));

vi.mock("../shared/use-gl-account-groups", () => ({
  useGlAccountGroups: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/use-gl-dimensions", () => ({
  useGlDimensions: () => ({ data: [{ id: "project", code: "project", name: "Project", is_active: true }], isLoading: false, isError: false }),
}));

const mockTargetAccount: ChartOfAccount = {
  id: "dbf8801e-8b11-4870-b1e1-cd58523bbb0c",
  doc_version: 1,
  code: "111000",
  description_1: "Main Operating Cash",
  description_2: "เงินสดและเงินฝากธนาคาร",
  nature: ACCOUNT_NATURE.DEBIT,
  type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
  category: "asset",
  is_active: true,
  is_used: false,
  allowed_departments: ["FO", "ACC"],
  department_required: true,
  allowed_dimensions: [],
  dimension_required: false,
  attributes: { PMS_Mapping: "CASH_MAIN" },
  grouping_path: [
    { code: "1000", name: "Assets", level: 1 },
    { code: "1100", name: "Current Assets", level: 2 },
  ],
};

function renderWithProviders(ui: React.ReactElement, initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" messages={en}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/config/chart-of-accounts/:id" element={ui} />
          </Routes>
        </MemoryRouter>
      </IntlProvider>
    </QueryClientProvider>,
  );
}

describe("COA Detail Route (:id = dbf8801e-8b11-4870-b1e1-cd58523bbb0c)", () => {
  it("เรนเดอร์หน้า detail สำเร็จแม้ว่า readCoaRules จะล้มเหลว (404/API error)", async () => {
    vi.spyOn(useCoaModule, "useChartOfAccountById").mockReturnValue({
      data: mockTargetAccount,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCoaModule.useChartOfAccountById>);

    // จำลองกรณี backend ไม่มี endpoint หรือ query rules ล้มเหลว
    vi.spyOn(dimensionRulesModule, "readCoaRules").mockRejectedValue(
      new Error("404 Not Found: gl-account-dimension-rules"),
    );

    renderWithProviders(
      <CoaEditRoute />,
      "/config/chart-of-accounts/dbf8801e-8b11-4870-b1e1-cd58523bbb0c",
    );

    // ตรวจสอบว่าหน้า Detail เรนเดอร์ฟอร์มขึ้นมา ไม่ใช่ ErrorState
    expect(screen.queryByText(/Something went wrong/i)).toBeNull();
    expect(await screen.findByDisplayValue("111000")).toBeDefined();
    expect(screen.getByDisplayValue("Main Operating Cash")).toBeDefined();
    expect(screen.getByText("CASH_MAIN")).toBeDefined();
  });
  it("selects dimensions with checkboxes without requirement status choices", () => {
    renderWithProviders(<CoaForm account={mockTargetAccount} rules={[]} initialEdit />, "/config/chart-of-accounts/account");
    fireEvent.click(screen.getByRole("switch", { name: /Require Dimension/i }));
    const checkbox = screen.getByRole("checkbox", { name: "project — Project" });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.queryByText("Default (no rule)")).toBeNull();
    expect(screen.queryByText("Mandatory")).toBeNull();
  });

  it("waits for saved rules before initializing the dimension checkboxes", async () => {
    let finish!: (rules: dimensionRulesModule.CoaDimensionRule[]) => void;
    vi.spyOn(useCoaModule, "useChartOfAccountById").mockReturnValue({ data: mockTargetAccount, isLoading: false, error: null } as unknown as ReturnType<typeof useCoaModule.useChartOfAccountById>);
    vi.spyOn(dimensionRulesModule, "readCoaRules").mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderWithProviders(<CoaEditRoute />, "/config/chart-of-accounts/account");
    expect(screen.queryByDisplayValue("111000")).toBeNull();
    await act(async () => { finish([{ id: "rule", chart_of_accounts_id: mockTargetAccount.id, gl_dimension_id: "project", requirement: "mandatory", doc_version: 1 }]); });
    expect(await screen.findByRole("checkbox", { name: "project — Project" })).toBeChecked();
  });

});
