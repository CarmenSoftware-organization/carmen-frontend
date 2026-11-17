import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { httpClient } from "@/lib/http-client";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import {
  ACCOUNT_NATURE,
  CHART_OF_ACCOUNT_TYPE,
  type ChartOfAccountDetail,
} from "@/types/chart-of-accounts";
import { Component } from "./coa-edit.route";
import { useChartOfAccount } from "./use-coa";
import { QUERY_KEYS } from "@/constant/query-keys";

vi.mock("@/lib/http-client", () => ({
  httpClient: { get: vi.fn(), patch: vi.fn() },
}));
vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU" }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ buCode: undefined }),
}));
vi.mock("../shared/use-gl-account-groups", () => ({
  useGlAccountGroups: () => ({ data: [] }),
}));
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({ can: () => true, canWrite: true, isAdmin: true }),
}));
const response = (data: unknown) => new Response(JSON.stringify(data));
const detail: ChartOfAccountDetail = {
  id: "account",
  doc_version: 1,
  code: "100",
  description_1: "Cash",
  nature: ACCOUNT_NATURE.DEBIT,
  type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
  category: "asset",
  is_active: true,
  is_require_cost_center: true,
  cost_centers: [
    { cost_center_id: "cc", code: "CC", name: "Office", is_active: false },
  ],
  dimensions: [
    {
      dimension_id: "project",
      code: "PROJECT",
      name: "Project",
      data_type: "lookup",
      requirement: "optional",
      config: {
        allowed_values: [],
        default_value_id: null,
        default_value: null,
      },
    },
  ],
};
let currentDetail = detail;
beforeEach(() => {
  vi.resetAllMocks();
  currentDetail = detail;
  vi.mocked(httpClient.get).mockImplementation(async (url) => {
    if (url === `${API_ENDPOINTS.CHART_OF_ACCOUNTS("BU")}/account`)
      return response({ data: currentDetail });
    if (url.startsWith(API_ENDPOINTS.CHART_OF_ACCOUNTS("BU") + "?"))
      return response({ data: [detail], paginate: { pages: 1 } });
    if (url.startsWith(API_ENDPOINTS.GL_COST_CENTERS("BU") + "?"))
      return response({ data: [], paginate: { pages: 1 } });
    if (url.startsWith(API_ENDPOINTS.DIMENSIONS("BU") + "?"))
      return response({ data: [], paginate: { pages: 1 } });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.mocked(httpClient.patch).mockResolvedValue(
    response({ data: { id: "account", doc_version: 2 } }),
  );
});

function AccountList() {
  const query = useChartOfAccount({ page: 1, perpage: 10 });
  return (
    <div>
      {query.isSuccess ? "Account list" : "Loading list"}
      <Link to="/config/chart-of-accounts/account">Open account</Link>
    </div>
  );
}

function openDetail(path = "/config/chart-of-accounts/account") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <IntlProvider locale="en" messages={en}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/config/chart-of-accounts/:id"
              element={<Component />}
            />
            <Route path="/config/chart-of-accounts" element={<AccountList />} />
          </Routes>
        </MemoryRouter>
      </IntlProvider>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

it("uses one detail GET in view mode, including when opening the linked Cost Centers and dimension config", async () => {
  openDetail();
  await screen.findByRole("button", { name: "Edit" });
  expect(httpClient.get).toHaveBeenCalledTimes(1);
  fireEvent.click(
    screen.getByRole("combobox", { name: "Allowed Cost Centers" }),
  );
  fireEvent.keyDown(
    screen.getByRole("textbox", { name: "Search Allowed Cost Centers" }),
    { key: "Escape" },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "List Master / Default" }),
  );
  await screen.findByRole("dialog");
  expect(httpClient.get).toHaveBeenCalledTimes(1);
});

it("loads master lists on Edit and only the COA list after Save, without refetching the departing form", async () => {
  const { client } = openDetail();
  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  await waitFor(() => expect(httpClient.get).toHaveBeenCalledTimes(3));
  const name = screen.getByDisplayValue("Cash");
  for (let i = 0; i < 20; i++)
    fireEvent.change(name, { target: { value: `Cash ${i}` } });
  expect(httpClient.get).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Account list");
  expect(httpClient.get).toHaveBeenCalledTimes(4);
  expect(vi.mocked(httpClient.get).mock.calls[3][0]).toContain(
    `${API_ENDPOINTS.CHART_OF_ACCOUNTS("BU")}?`,
  );
  expect(
    client.getQueryState([QUERY_KEYS.COST_CENTERS, "BU", "all", undefined])
      ?.isInvalidated,
  ).toBe(true);
  expect(httpClient.patch).toHaveBeenCalledTimes(1);
  expect(httpClient.patch).toHaveBeenCalledWith(
    `${API_ENDPOINTS.CHART_OF_ACCOUNTS("BU")}/account`,
    expect.objectContaining({ doc_version: 1, description_1: "Cash 19" }),
  );
  expect(
    vi
      .mocked(httpClient.get)
      .mock.calls.every(
        ([url]) =>
          !/cost-centers\/[^?]+/.test(url) &&
          !url.includes("account-dimension-rules"),
      ),
  ).toBe(true);
});

it("reopens a saved account using fresh detail before initializing the form, rather than stale cached defaults", async () => {
  vi.mocked(httpClient.patch).mockImplementation(async () => {
    currentDetail = {
      ...detail,
      doc_version: 2,
      description_1: "Saved account",
      is_require_cost_center: false,
      dimensions: [],
    };
    return response({ data: { id: "account", doc_version: 2 } });
  });
  openDetail();
  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  await waitFor(() => expect(httpClient.get).toHaveBeenCalledTimes(3));
  fireEvent.change(screen.getByDisplayValue("Cash"), {
    target: { value: "Saved account" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Account list");
  fireEvent.click(screen.getByRole("link", { name: "Open account" }));
  await waitFor(() =>
    expect(screen.getAllByText("Saved account")).toHaveLength(2),
  );
  expect(screen.queryByText("Cash")).toBeNull();
  expect(
    screen.queryByRole("combobox", { name: "Required dimensions" }),
  ).toBeNull();
  expect(httpClient.get).toHaveBeenCalledTimes(5);
});
