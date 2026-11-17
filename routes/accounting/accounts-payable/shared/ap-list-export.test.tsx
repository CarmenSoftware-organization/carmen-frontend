import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { downloadXlsx } from "@/lib/xlsx-utils";
import { httpApRepository } from "./ap-http-repository";
import {
  useExportApInvoices,
  useExportApPayments,
} from "./use-accounts-payable";
import ApInvoiceList from "../invoice/ap-invoice-list";
import ApPaymentList from "../payment/ap-payment-list";

const { listData } = vi.hoisted(() => ({
  listData: {
    rows: [] as object[],
    pathname: "/accounting/accounts-payable/invoice",
  },
}));

vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "DEV" }));
vi.mock("use-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: listData.pathname }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({
    dateFormat: "yyyy-MM-dd",
    dateTimeFormat: "yyyy-MM-dd HH:mm",
  }),
}));
vi.mock("@/hooks/use-number-formatter", () => ({
  useAmountFormatter: () => (value: number) => value.toFixed(2),
}));
vi.mock("@/hooks/use-delete-gate", () => ({ useDeleteGate: () => ({}) }));
vi.mock("@/hooks/use-export-error-toast", () => ({
  useExportErrorToast: () => vi.fn(),
}));
vi.mock("@/hooks/use-data-grid-state", () => ({
  useDataGridState: () => ({
    params: {},
    search: "",
    setSearch: vi.fn(),
    tableConfig: {},
  }),
}));
vi.mock("@/hooks/use-list-filters", () => ({
  useListFilters: () => ({ filterParam: "", activeFilters: [], view: {} }),
}));
vi.mock("@/hooks/use-grid-pagination", () => ({
  useGridPagination: () => ({
    items: listData.rows,
    totalRecords: listData.rows.length,
  }),
}));
vi.mock("@/components/ui/data-grid/use-config-table", () => ({
  useConfigTable: () => ({}),
}));
vi.mock("@/components/list-filter/list-toolbar", () => ({
  ListToolbar: () => null,
}));
vi.mock("@/components/list-filter/save-view-dialog", () => ({
  SaveViewDialog: () => null,
}));
vi.mock("@/components/share/list-page-shell", () => ({
  ListPageShell: ({
    children,
    actions,
  }: {
    children: ReactNode;
    actions: ReactNode;
  }) => (
    <>
      {actions}
      {children}
    </>
  ),
}));
vi.mock("./use-accounts-payable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./use-accounts-payable")>()),
  useApInvoices: () => ({}),
  useApPayments: () => ({}),
  useApPaymentAction: () => ({}),
}));
vi.mock("./ap-http-repository", () => ({
  httpApRepository: { listInvoices: vi.fn(), listPayments: vi.fn() },
}));
vi.mock("@/lib/xlsx-utils", () => ({
  downloadXlsx: vi.fn(),
  buildXlsxFileName: (prefix: string) => prefix,
}));
beforeEach(() => {
  vi.clearAllMocks();
  listData.rows = [];
  listData.pathname = "/accounting/accounts-payable/invoice";
});

it("exports every filtered invoice page while preserving decimal values", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({
    id: String(index),
    total_amount: "123456789012345.12345",
  }));
  vi.mocked(httpApRepository.listInvoices)
    .mockResolvedValueOnce({
      data: rows.slice(0, 100),
      paginate: { page: 1, perpage: 100, pages: 2, total: 101 },
    } as never)
    .mockResolvedValueOnce({
      data: rows.slice(100),
      paginate: { page: 2, perpage: 100, pages: 2, total: 101 },
    } as never);
  const { result } = renderHook(useExportApInvoices);
  const params = {
    search: "Supplier",
    filter: "doc_status|string:draft",
    sort: "doc_date:desc",
    page: 8,
    perpage: 10,
  };
  await act(async () => {
    expect(
      await result.current.exportInvoices(params, [
        { header: "Amount", value: (row) => row.total_amount },
      ]),
    ).toBe(101);
  });
  expect(httpApRepository.listInvoices).toHaveBeenNthCalledWith(1, "DEV", {
    ...params,
    page: 1,
    perpage: 100,
  });
  expect(httpApRepository.listInvoices).toHaveBeenNthCalledWith(2, "DEV", {
    ...params,
    page: 2,
    perpage: 100,
  });
  const exported = vi.mocked(downloadXlsx).mock.calls[0][0];
  expect(exported.rows).toEqual(rows);
  expect(exported.columns[0].value(rows[0], 0)).toBe("123456789012345.12345");
  expect(result.current.isExporting).toBe(false);
});

it("keeps the approval queue filter and rejects an incomplete payment export", async () => {
  vi.mocked(httpApRepository.listPayments)
    .mockResolvedValueOnce({
      data: [{ id: "payment" }],
      paginate: { page: 1, perpage: 100, pages: 2, total: 101 },
    } as never)
    .mockRejectedValueOnce(new Error("Second page failed"));
  const { result } = renderHook(useExportApPayments);
  const filter = "doc_status|string:in_review";
  await act(async () => {
    await expect(result.current.exportPayments({ filter }, [])).rejects.toThrow(
      "Second page failed",
    );
  });
  expect(httpApRepository.listPayments).toHaveBeenNthCalledWith(2, "DEV", {
    filter,
    page: 2,
    perpage: 100,
  });
  expect(downloadXlsx).not.toHaveBeenCalled();
  expect(result.current.isExporting).toBe(false);
});

it("carries invoice dates and update time from the displayed card into the actual list export", async () => {
  const invoice = {
    id: "invoice",
    doc_no: "AP-1",
    doc_source: "manual",
    doc_status: "draft",
    doc_type: "invoice",
    vendor_name: "Supplier",
    vendor_invoice_no: "SUP-1",
    doc_date: "2026-11-01",
    invoice_date: "2026-11-02",
    due_date: "2026-12-02",
    updated_at: "2026-11-03T10:00:00Z",
    currency_code: "THB",
    total_amount: "100.00",
    outstanding_amount: "75.00",
  };
  listData.rows = [invoice];
  vi.mocked(httpApRepository.listInvoices).mockResolvedValueOnce({
    data: [invoice],
  } as never);
  render(<ApInvoiceList />);
  expect(screen.getByText("2026-11-02")).toBeInTheDocument();
  expect(screen.getByText("2026-12-02")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /^export$/ }));
  await waitFor(() => expect(downloadXlsx).toHaveBeenCalledOnce());
  const exported = vi.mocked(downloadXlsx).mock.calls[0][0];
  const values = Object.fromEntries(
    exported.columns.map((column) => [column.header, column.value(invoice, 0)]),
  );
  expect(values).toMatchObject({
    "detail.invoiceDate": "2026-11-02",
    "detail.dueDate": "2026-12-02",
  });
  expect(values.updated).toMatch(/^2026-11-03 \d{2}:00$/);
  expect(screen.getByText(String(values.updated))).toBeInTheDocument();
});

it("shows and exports applied amount, WHT, reference and workflow without rounding the API decimals", async () => {
  const payment = {
    id: "payment",
    doc_no: "PV-1",
    doc_status: "draft",
    vendor_name: "Supplier",
    payment_date: "2026-11-04",
    bank_account_name: "Clearing",
    payment_method: "bank_transfer",
    currency_code: "THB",
    total_applied_amount: "123.45678",
    total_wht_amount: "3.45678",
    net_paid_amount: "120.00",
    reference_no: "BANK-REF",
    workflow_current_stage: "Manager review",
  };
  listData.rows = [payment];
  vi.mocked(httpApRepository.listPayments).mockResolvedValueOnce({
    data: [payment],
  } as never);
  render(<ApPaymentList />);
  expect(screen.getByText("123.46 THB")).toBeInTheDocument();
  expect(screen.getByText("3.46 THB")).toBeInTheDocument();
  expect(screen.getByText("BANK-REF")).toBeInTheDocument();
  expect(screen.getByText("Manager review")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /^export$/ }));
  await waitFor(() => expect(downloadXlsx).toHaveBeenCalledOnce());
  const exported = vi.mocked(downloadXlsx).mock.calls[0][0];
  const values = Object.fromEntries(
    exported.columns.map((column) => [column.header, column.value(payment, 0)]),
  );
  expect(values).toMatchObject({
    "detail.summary.applied": "123.45678",
    "detail.summary.wht": "3.45678",
    referenceNo: "BANK-REF",
    workflow: "Manager review",
  });
});

for (const [segment, docType] of [
  ["deposit", "deposit"],
  ["debit-note", "debit_note"],
  ["credit-note", "credit_note"],
]) {
  it(`keeps ${segment} export scoped to its document type`, async () => {
    listData.pathname = `/accounting/accounts-payable/${segment}`;
    vi.mocked(httpApRepository.listInvoices).mockResolvedValueOnce({
      data: [],
    } as never);
    render(<ApInvoiceList />);
    await userEvent.click(screen.getByRole("button", { name: /^export$/ }));
    await waitFor(() =>
      expect(httpApRepository.listInvoices).toHaveBeenCalledWith(
        "DEV",
        expect.objectContaining({ filter: `doc_type|string:${docType}` }),
      ),
    );
  });
}
