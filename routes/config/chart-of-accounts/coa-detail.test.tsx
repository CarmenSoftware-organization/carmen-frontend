import { CoaForm } from "./coa-form";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { toast } from "sonner";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { Component as CoaEditRoute } from "./coa-edit.route";
import * as useCoaModule from "./use-coa";
import * as dimensionRulesModule from "./coa-dimension-rules";
import * as costCenterModule from "./coa-cost-centers";

vi.mock("@/components/ui/virtual-command-list", () => ({
  VirtualCommandList: ({
    items,
    children,
  }: {
    items: { value: string }[];
    children: (item: { value: string }) => React.ReactNode;
  }) => (
    <div>
      {items.map((item) => (
        <div key={item.value}>{children(item)}</div>
      ))}
    </div>
  ),
}));

const costCenterQuery = vi.hoisted(() => ({
  data: [
    {
      id: "cc-1",
      code: "CC100",
      name: "Front Office",
      is_active: true,
      accounts: [
        { chart_of_accounts_id: "dbf8801e-8b11-4870-b1e1-cd58523bbb0c" },
      ],
    },
    {
      id: "cc-2",
      code: "CC200",
      name: "Finance",
      is_active: false,
      accounts: [
        { chart_of_accounts_id: "dbf8801e-8b11-4870-b1e1-cd58523bbb0c" },
      ],
    },
    {
      id: "cc-3",
      code: "CC300",
      name: "Kitchen",
      is_active: true,
      accounts: [],
    },
    {
      id: "cc-4",
      code: "CC400",
      name: "Closed",
      is_active: false,
      accounts: [],
    },
  ],
  isLoading: false,
  isError: false,
  isSuccess: true,
  refetch: vi.fn(),
}));

vi.mock("./coa-cost-centers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./coa-cost-centers")>()),
  useCoaCostCenters: () => costCenterQuery,
  saveCoaCostCenters: vi.fn(async () => costCenterQuery.data),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  costCenterQuery.isLoading = false;
  costCenterQuery.isError = false;
  costCenterQuery.isSuccess = true;
});
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
  useGlDimensionValues: () => ({
    data: [
      {
        id: "p1",
        dimension_id: "project",
        code: "P01",
        name: "Project One",
        is_active: true,
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useGlDimensions: () => ({
    data: [
      { id: "project", code: "project", name: "Project", is_active: true },
    ],
    isLoading: false,
    isError: false,
  }),
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
  is_require_cost_center: true,
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
  it("does not submit unsaved List Master or Default preview settings to the backend", async () => {
    const update = vi.fn();
    const error = vi.spyOn(toast, "error");
    vi.spyOn(useCoaModule, "useUpdateChartOfAccount").mockReturnValue({
      mutateAsync: update,
    } as unknown as ReturnType<typeof useCoaModule.useUpdateChartOfAccount>);
    renderWithProviders(
      <CoaForm
        account={mockTargetAccount}
        rules={[
          {
            id: "rule",
            chart_of_accounts_id: mockTargetAccount.id,
            gl_dimension_id: "project",
            requirement: "mandatory",
            doc_version: 1,
          },
        ]}
        initialEdit
      />,
      "/config/chart-of-accounts/account",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "List Master / Default" }),
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Default" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "P01 — Project One" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        en.config.chartOfAccounts.dimensionPreview.saveUnavailable,
      ),
    );
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Clear preview" }));
    expect(screen.queryByRole("button", { name: "Clear preview" })).toBeNull();
  });
  it("uses Cost Center account mappings and preserves inactive selections", () => {
    renderWithProviders(
      <CoaForm account={mockTargetAccount} initialEdit />,
      "/config/chart-of-accounts/account",
    );
    const switches = screen.getAllByRole("switch", {
      name: "Require Cost Center",
    });
    expect(switches).toHaveLength(1);
    expect(switches[0]).toBeChecked();
    fireEvent.click(
      screen.getByRole("combobox", { name: "Allowed Cost Centers" }),
    );
    const costCenter = screen.getByRole("checkbox", {
      name: "CC100 — Front Office",
    });
    expect(costCenter).toBeChecked();
    fireEvent.click(costCenter);
    expect(costCenter).not.toBeChecked();
    fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Search Allowed Cost Centers" }),
      { key: "Escape" },
    );
    fireEvent.click(switches[0]);
    expect(
      screen.queryByRole("checkbox", { name: "CC100 — Front Office" }),
    ).toBeNull();
    fireEvent.click(switches[0]);
    fireEvent.click(
      screen.getByRole("combobox", { name: "Allowed Cost Centers" }),
    );
    expect(
      screen.getByRole("checkbox", { name: "CC100 — Front Office" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "CC200 — Finance" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "CC300 — Kitchen" }),
    ).not.toBeChecked();
    expect(
      screen.queryByRole("checkbox", { name: "CC400 — Closed" }),
    ).toBeNull();
  });

  it("saves the real requirement flag and then the selected Cost Center mappings", async () => {
    const update = vi.fn().mockResolvedValue({
      data: { id: mockTargetAccount.id, doc_version: 2 },
    });
    vi.spyOn(useCoaModule, "useUpdateChartOfAccount").mockReturnValue({
      mutateAsync: update,
    } as unknown as ReturnType<typeof useCoaModule.useUpdateChartOfAccount>);
    vi.spyOn(dimensionRulesModule, "saveCoaRules").mockResolvedValue(undefined);
    renderWithProviders(
      <CoaForm account={mockTargetAccount} initialEdit />,
      "/config/chart-of-accounts/account",
    );
    fireEvent.click(
      screen.getByRole("combobox", { name: "Allowed Cost Centers" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "CC300 — Kitchen" }));
    fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Search Allowed Cost Centers" }),
      { key: "Escape" },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_require_cost_center: true,
        }),
      ),
    );
    await waitFor(() =>
      expect(costCenterModule.saveCoaCostCenters).toHaveBeenCalledWith(
        "BU001",
        mockTargetAccount.id,
        ["CC100", "CC200", "CC300"],
        true,
      ),
    );
    expect(update.mock.calls[0][0]).not.toHaveProperty("department_required");
  });

  it("keeps an explicitly disabled requirement off even when mappings exist", () => {
    renderWithProviders(
      <CoaForm
        account={{ ...mockTargetAccount, is_require_cost_center: false }}
        initialEdit
      />,
      "/config/chart-of-accounts/account",
    );
    const toggle = screen.getByRole("switch", { name: "Require Cost Center" });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    fireEvent.click(
      screen.getByRole("combobox", { name: "Allowed Cost Centers" }),
    );
    expect(
      screen.getByRole("checkbox", { name: "CC100 — Front Office" }),
    ).toBeChecked();
  });

  it("does not report success when mapping persistence fails", async () => {
    const update = vi.fn().mockResolvedValue({
      data: { id: mockTargetAccount.id, doc_version: 2 },
    });
    vi.spyOn(useCoaModule, "useUpdateChartOfAccount").mockReturnValue({
      mutateAsync: update,
    } as unknown as ReturnType<typeof useCoaModule.useUpdateChartOfAccount>);
    vi.mocked(costCenterModule.saveCoaCostCenters).mockRejectedValueOnce(
      new Error("Mappings rejected"),
    );
    const error = vi.spyOn(toast, "error");
    const success = vi.spyOn(toast, "success");
    renderWithProviders(
      <CoaForm account={mockTargetAccount} initialEdit />,
      "/config/chart-of-accounts/account",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("Mappings rejected"),
      ),
    );
    expect(success).not.toHaveBeenCalled();
  });

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
    renderWithProviders(
      <CoaForm account={mockTargetAccount} rules={[]} initialEdit />,
      "/config/chart-of-accounts/account",
    );
    fireEvent.click(screen.getByRole("switch", { name: /Require Dimension/i }));
    fireEvent.click(
      screen.getByRole("combobox", { name: "Required dimensions" }),
    );
    const checkbox = screen.getByRole("checkbox", {
      name: "project — Project",
    });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.queryByText("Default (no rule)")).toBeNull();
    expect(screen.queryByText("Mandatory")).toBeNull();
  });

  it("waits for saved rules before initializing the dimension checkboxes", async () => {
    let finish!: (rules: dimensionRulesModule.CoaDimensionRule[]) => void;
    vi.spyOn(useCoaModule, "useChartOfAccountById").mockReturnValue({
      data: mockTargetAccount,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCoaModule.useChartOfAccountById>);
    vi.spyOn(dimensionRulesModule, "readCoaRules").mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderWithProviders(<CoaEditRoute />, "/config/chart-of-accounts/account");
    expect(screen.queryByDisplayValue("111000")).toBeNull();
    await act(async () => {
      finish([
        {
          id: "rule",
          chart_of_accounts_id: mockTargetAccount.id,
          gl_dimension_id: "project",
          requirement: "mandatory",
          doc_version: 1,
        },
      ]);
    });
    await screen.findByRole("combobox", { name: "Required dimensions" });
    fireEvent.click(
      screen.getByRole("combobox", { name: "Required dimensions" }),
    );
    expect(
      screen.getByRole("checkbox", { name: "project — Project" }),
    ).toBeChecked();
  });
});
