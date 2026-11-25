import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { IntlProvider } from "use-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { setURLParams } from "@/hooks/use-url";
import { Component as ReceiptList } from "./ar-receipt-list.route";
import { Component as ReceiptDetail } from "./ar-receipt-detail.route";
import { AR_RECEIPT_PATH } from "./ar-receipt-model";
import type { ArReceiptRow } from "./use-ar-receipt";

const customer = vi.hoisted(() => ({
  id: "real-customer",
  code: "AR001",
  name: "API Customer",
  registered_name: "Customer Registered",
  tax_no: "1234567890123",
  branch_no: "00000",
  default_currency_code: "THB",
  customer_address: [
    {
      id: "tax",
      address_type: "register_address",
      address_line1: "Registered Road",
      address_line2: "Floor 2",
      sub_district: "Subdistrict",
      district: "District",
      province: "Bangkok",
      postal_code: "10110",
    },
  ],
}));
const api = vi.hoisted(() => ({
  useArReceipts: vi.fn(),
  exportReceipts: vi.fn(),
}));
vi.mock("./use-ar-receipt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./use-ar-receipt")>()),
  useArReceipts: api.useArReceipts,
  useExportArReceipts: () => ({
    isExporting: false,
    exportReceipts: api.exportReceipts,
  }),
}));
vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "TEST" }));
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({ canWrite: true, isAdmin: true, can: () => true }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({
    buCode: "TEST",
    dateFormat: "dd/MM/yyyy",
    defaultCurrencyCode: "THB",
    defaultBu: {
      config: {
        amount_format: { locales: "en-US" },
        default_currency: { decimal_places: 2 },
      },
    },
  }),
}));
vi.mock("@/hooks/use-list-views", () => ({
  useListViews: () => ({
    userViews: [],
    buViews: [],
    isLoading: false,
    isFetching: false,
    error: null,
    canManageBu: false,
  }),
}));
vi.mock("@/hooks/use-currency", () => ({
  useCurrencyAll: () => ({ data: [] }),
}));
vi.mock("./use-ar-customer", () => ({
  useArCustomer: (id?: string) => ({
    data: id === customer.id ? customer : undefined,
    isLoading: false,
  }),
}));
vi.mock("./ar-customer-lookup", () => ({
  ArCustomerLookup: ({
    change,
  }: {
    change: (value: { id: string; code: string; name: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        change({ id: customer.id, code: customer.code, name: customer.name })
      }
    >
      Select API customer
    </button>
  ),
}));

const row = (
  doc_no: string,
  doc_status: ArReceiptRow["doc_status"],
  customer_name: string,
): ArReceiptRow => ({
  id: doc_no,
  doc_no,
  doc_status,
  receipt_date: "2026-11-16",
  customer_code: "AR001",
  customer_name,
  currency_code: "THB",
  net_received_amount: "1000",
  total_applied_amount: "900",
  total_unapplied_amount: "100",
});
const ROWS = [
  row("DRAFT-00000001", "draft", "Draft Customer"),
  row("ARRC26110001", "in_review", "Review Customer"),
  row("ARRC26110002", "posted", "Posted Customer"),
  row("ARRC26110003", "void", "Void Customer"),
];

beforeEach(() => {
  window.history.replaceState({}, "", AR_RECEIPT_PATH);
  vi.clearAllMocks();
  api.exportReceipts.mockResolvedValue(4);
  api.useArReceipts.mockReturnValue({
    data: {
      data: ROWS,
      paginate: { total: 4, page: 1, perpage: 10, pages: 1 },
    },
    isPending: false,
    error: null,
    refetch: vi.fn(),
  });
});

it("lists receipts from the backend with all four status chips, passes filters to the query and export, and opens the new form", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[AR_RECEIPT_PATH]}>
          <Routes>
            <Route path={AR_RECEIPT_PATH} element={<ReceiptList />} />
            <Route
              path={`${AR_RECEIPT_PATH}/:id`}
              element={<ReceiptDetail />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </IntlProvider>,
  );
  const table = screen.getByRole("table");
  for (const no of ROWS.map((r) => r.doc_no))
    expect(within(table).getByText(no)).toBeVisible();
  const statuses = messages.accounting.arReceipt.statuses;
  for (const label of Object.values(statuses))
    expect(within(table).getByText(label)).toBeVisible();
  act(() =>
    setURLParams({
      status: "draft",
      date: "receipt_date|date_range:2026-11-15,2026-11-17",
    }),
  );
  await waitFor(() =>
    expect(api.useArReceipts).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filter: expect.stringContaining("doc_status|string:draft"),
      }),
    ),
  );
  expect(api.useArReceipts).toHaveBeenLastCalledWith(
    expect.objectContaining({
      filter: expect.stringContaining("receipt_date|date_range:2026-11-15"),
    }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Export" }));
  await waitFor(() => expect(api.exportReceipts).toHaveBeenCalledOnce());
  const [params, columns] = api.exportReceipts.mock.calls[0];
  expect(params.filter).toContain("doc_status|string:draft");
  expect(columns[0].value(ROWS[0])).toBe("DRAFT-00000001");
  expect(columns.at(-1).value(ROWS[1])).toBe(statuses.in_review);
  act(() => setURLParams({ status: "", date: "" }));
  await userEvent.click(
    screen.getByRole("button", {
      name: messages.accounting.arReceipt.newReceipt,
    }),
  );
  expect(
    await screen.findByRole("button", { name: "Select API customer" }),
  ).toBeVisible();
});
