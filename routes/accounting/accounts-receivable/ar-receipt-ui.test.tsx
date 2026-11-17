import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { IntlProvider } from "use-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { setURLParams } from "@/hooks/use-url";
import { downloadXlsx } from "@/lib/xlsx-utils";
import { Component as ReceiptList } from "./ar-receipt-list.route";
import { Component as ReceiptDetail } from "./ar-receipt-detail.route";
import { AR_RECEIPT_PATH, readReceipts } from "./ar-receipt-model";

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
vi.mock("@/lib/xlsx-utils", () => ({
  downloadXlsx: vi.fn(),
  buildXlsxFileName: (prefix: string) => prefix,
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

beforeEach(() => {
  window.history.replaceState({}, "", AR_RECEIPT_PATH);
  vi.clearAllMocks();
});

it("runs the actual Receipt routes through filtered export, print, create, tax defaults, edit and delete", async () => {
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
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  await userEvent.click(screen.getByRole("button", { name: "Print" }));
  expect(print).toHaveBeenCalledOnce();
  act(() =>
    setURLParams({
      status: "draft",
      date: "date|date_range:2026-11-15,2026-11-17",
    }),
  );
  const table = screen.getByRole("table");
  expect(within(table).getByText("ARRC-SAMPLE-002")).toBeVisible();
  expect(within(table).queryByText("ARRC-SAMPLE-001")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Export" }));
  await waitFor(() =>
    expect(downloadXlsx).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [expect.objectContaining({ number: "ARRC-SAMPLE-002" })],
      }),
    ),
  );
  act(() => setURLParams({ status: "", date: "" }));
  await userEvent.click(
    screen.getByRole("button", {
      name: messages.accounting.arReceipt.newReceipt,
    }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Select API customer" }),
  );
  const dateField = screen
    .getByText("Input Date")
    .closest<HTMLElement>("[data-slot=field]")!;
  await userEvent.click(within(dateField).getByRole("button"));
  const calendar = screen.getByRole("grid");
  await userEvent.click(
    within(calendar)
      .getAllByRole("button")
      .find((button) => !(button as HTMLButtonElement).disabled)!,
  );
  await userEvent.click(screen.getByRole("tab", { name: "Tax Invoice" }));
  expect(screen.getByLabelText("Address Line 1")).toHaveValue(
    "Registered Road",
  );
  expect(screen.getByLabelText("Address Line 2")).toHaveValue(
    "Floor 2 Subdistrict District",
  );
  expect(screen.getByLabelText("Province")).toHaveValue("Bangkok");
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Created through receipt form" },
  });
  fireEvent.submit(document.getElementById("ar-receipt-form")!);
  const saved = readReceipts("TEST").find(
    (row) => row.customerId === customer.id,
  )!;
  expect(saved.taxEntity.postalCode).toBe("10110");
  expect(saved.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Edited through receipt form" },
  });
  fireEvent.submit(document.getElementById("ar-receipt-form")!);
  expect(
    readReceipts("TEST").find((row) => row.id === saved.id)?.description,
  ).toBe("Edited through receipt form");
  await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
  await userEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Confirm",
    }),
  );
  await screen.findByRole("button", {
    name: messages.accounting.arReceipt.newReceipt,
  });
  expect(readReceipts("TEST").some((row) => row.id === saved.id)).toBe(false);
  print.mockRestore();
});
