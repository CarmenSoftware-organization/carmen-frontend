import { CoaForm } from "./coa-form";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { Component as CoaEditRoute } from "./coa-edit.route";
import * as useCoaModule from "./use-coa";
import * as dimensionRulesModule from "@/lib/coa-dimension-rules";

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
    },
    {
      id: "cc-2",
      code: "CC200",
      name: "Finance",
      is_active: false,
    },
    {
      id: "cc-3",
      code: "CC300",
      name: "Kitchen",
      is_active: true,
    },
    {
      id: "cc-4",
      code: "CC400",
      name: "Closed",
      is_active: false,
    },
  ],
  isLoading: false,
  isError: false,
  isSuccess: true,
  refetch: vi.fn(),
}));

vi.mock("@/hooks/use-cost-center", () => ({
  useCostCenterAll: () => costCenterQuery,
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
  type ChartOfAccountDetail,
  type AccountDimension,
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

const mockDimension: AccountDimension = {
  dimension_id: "project",
  code: "project",
  name: "Project",
  data_type: "lookup",
  requirement: "optional",
  config: { default_value_id: null, default_value: null, allowed_values: [] },
};

const mockTargetAccount: ChartOfAccountDetail = {
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
  cost_centers: costCenterQuery.data.slice(0, 2).map((item) => ({
    cost_center_id: item.id,
    code: item.code,
    name: item.name,
    is_active: item.is_active,
  })),
  dimensions: [],
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
  it("saves List Master and Default in the account PATCH", async () => {
    const update = vi.fn().mockResolvedValue({
      data: { id: mockTargetAccount.id, doc_version: 2 },
    });
    vi.spyOn(useCoaModule, "useUpdateChartOfAccount").mockReturnValue({
      mutateAsync: update,
    } as unknown as ReturnType<typeof useCoaModule.useUpdateChartOfAccount>);
    renderWithProviders(
      <CoaForm
        account={{ ...mockTargetAccount, dimensions: [mockDimension] }}
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
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          dimensions: {
            add: [],
            remove: [],
            update: [
              {
                dimension_id: "project",
                requirement: "optional",
                config: { default_value_id: "p1", allowed_value_ids: [] },
              },
            ],
          },
        }),
      ),
    );
    expect(update).toHaveBeenCalledTimes(1);
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

  it("saves the requirement flag and only changed Cost Center links in one PATCH", async () => {
    const update = vi.fn().mockResolvedValue({
      data: { id: mockTargetAccount.id, doc_version: 2 },
    });
    vi.spyOn(useCoaModule, "useUpdateChartOfAccount").mockReturnValue({
      mutateAsync: update,
    } as unknown as ReturnType<typeof useCoaModule.useUpdateChartOfAccount>);
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
          cost_centers: { add: [{ cost_center_id: "cc-3" }], remove: [] },
        }),
      ),
    );
    expect(update).toHaveBeenCalledTimes(1);
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
    const update = vi.fn().mockRejectedValue(new Error("Mappings rejected"));
    vi.spyOn(useCoaModule, "useUpdateChartOfAccount").mockReturnValue({
      mutateAsync: update,
    } as unknown as ReturnType<typeof useCoaModule.useUpdateChartOfAccount>);
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

  it("renders directly from account detail without requesting dimension rules", async () => {
    vi.spyOn(useCoaModule, "useChartOfAccountById").mockReturnValue({
      data: mockTargetAccount,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCoaModule.useChartOfAccountById>);

    // จำลองกรณี backend ไม่มี endpoint หรือ query rules ล้มเหลว
    vi.spyOn(dimensionRulesModule, "readCoaRules").mockRejectedValue(
      new Error("404 Not Found: account-dimension-rules"),
    );

    renderWithProviders(
      <CoaEditRoute />,
      "/config/chart-of-accounts/dbf8801e-8b11-4870-b1e1-cd58523bbb0c",
    );

    // ตรวจสอบว่าหน้า Detail เรนเดอร์ฟอร์มขึ้นมา ไม่ใช่ ErrorState
    expect(screen.queryByText(/Something went wrong/i)).toBeNull();
    // โหมดดูแสดงค่าเป็นข้อความ ไม่ใช่ input ที่ disable — รหัสอยู่ทั้งบนหัวฟอร์มและในการ์ด
    expect((await screen.findAllByText("111000")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Main Operating Cash").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("CASH_MAIN")).toBeDefined();
    expect(dimensionRulesModule.readCoaRules).not.toHaveBeenCalled();
  });
  it("selects dimensions with checkboxes without requirement status choices", () => {
    renderWithProviders(
      <CoaForm account={mockTargetAccount} initialEdit />,
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

  it("initializes dimension checkboxes and saved config from the detail arrays", async () => {
    vi.spyOn(useCoaModule, "useChartOfAccountById").mockReturnValue({
      data: {
        ...mockTargetAccount,
        dimensions: [
          {
            ...mockDimension,
            config: {
              default_value_id: "p1",
              default_value: {
                id: "p1",
                code: "P01",
                name: "Project One",
                is_active: false,
              },
              allowed_values: [
                {
                  id: "p1",
                  code: "P01",
                  name: "Project One",
                  is_active: false,
                },
              ],
            },
          },
        ],
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCoaModule.useChartOfAccountById>);
    renderWithProviders(<CoaEditRoute />, "/config/chart-of-accounts/account");
    await screen.findByRole("combobox", { name: "Required dimensions" });
    fireEvent.click(
      screen.getByRole("combobox", { name: "Required dimensions" }),
    );
    expect(
      screen.getByRole("checkbox", { name: "project — Project" }),
    ).toBeChecked();
    fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Search Required dimensions" }),
      { key: "Escape" },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "List Master / Default" }),
    );
    expect(screen.getByRole("combobox", { name: "Default" })).toHaveTextContent(
      "P01 · Project One",
    );
  });

  it("blocks editing when a stale backend omits either relationship array", () => {
    vi.spyOn(useCoaModule, "useChartOfAccountById").mockReturnValue({
      data: { ...mockTargetAccount, cost_centers: undefined },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCoaModule.useChartOfAccountById>);
    renderWithProviders(<CoaEditRoute />, "/config/chart-of-accounts/account");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("retries failed link persistence after Create using the saved ID/version without creating a duplicate account", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ data: { id: "new-account", doc_version: 1 } });
    const update = vi
      .fn()
      .mockRejectedValueOnce(new Error("Links rejected"))
      .mockResolvedValue({ data: { id: "new-account", doc_version: 2 } });
    vi.spyOn(useCoaModule, "useCreateChartOfAccount").mockReturnValue({
      mutateAsync: create,
    } as unknown as ReturnType<typeof useCoaModule.useCreateChartOfAccount>);
    vi.spyOn(useCoaModule, "useUpdateChartOfAccount").mockReturnValue({
      mutateAsync: update,
    } as unknown as ReturnType<typeof useCoaModule.useUpdateChartOfAccount>);
    const error = vi.spyOn(toast, "error");
    renderWithProviders(<CoaForm />, "/config/chart-of-accounts/new");
    fireEvent.change(screen.getByRole("textbox", { name: /^Code/ }), {
      target: { value: "100" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: /Account Description \(English\)/ }),
      { target: { value: "New account" } },
    );
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByRole("option", { name: "Assets" }));
    fireEvent.click(screen.getAllByRole("combobox")[1]);
    fireEvent.click(
      await screen.findByRole("option", { name: /Balance sheet/i }),
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "Require Cost Center" }),
    );
    fireEvent.click(
      screen.getByRole("combobox", { name: "Allowed Cost Centers" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "CC100 — Front Office" }),
    );
    fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Search Allowed Cost Centers" }),
      { key: "Escape" },
    );
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith("Links rejected"));
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(create).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        id: "new-account",
        doc_version: 1,
        cost_centers: { add: [{ cost_center_id: "cc-1" }], remove: [] },
      }),
    );
  });
});
