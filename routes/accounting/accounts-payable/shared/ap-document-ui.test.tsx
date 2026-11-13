import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import ApInvoiceDetail from "../invoice/ap-invoice-detail";
import ApPaymentDetail from "../payment/ap-payment-detail";
import { PaymentAllocationsEditor } from "../payment/ap-payment-allocations";
import { PaymentExpensesSection } from "../payment/ap-payment-expenses";
import { InvoiceReferenceEditor } from "../invoice/ap-invoice-reference-editor";
import { InvoiceReferencesPanel } from "../invoice/ap-invoice-panels";
import { httpApRepository } from "./ap-http-repository";
import type {
  ApInvoice,
  ApPayment,
  ApOutstandingDocument,
} from "@/types/accounts-payable";

const state = vi.hoisted(() => ({
  invoice: null as ApInvoice | null,
  payment: null as ApPayment | null,
  save: vi.fn(),
  preview: vi.fn(),
}));
vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU" }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({
    dateFormat: "yyyy-MM-dd",
    defaultCurrencyId: "thb",
    defaultCurrencyCode: "THB",
    userId: "user",
  }),
}));
vi.mock("./use-accounts-payable", () => ({
  useApInvoice: () => ({
    data: state.invoice,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useApPayment: () => ({
    data: state.payment,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useSaveApInvoice: () => ({ mutateAsync: state.save }),
  useSaveApPayment: () => ({ mutateAsync: state.save }),
  useApInvoiceAction: () => ({ mutateAsync: vi.fn() }),
  useApPaymentAction: () => ({ mutateAsync: vi.fn() }),
  useDeleteApInvoice: () => ({ mutateAsync: vi.fn() }),
  useDeleteApPayment: () => ({ mutateAsync: vi.fn() }),
  useApOutstandingDocuments: () => ({ data: [], isLoading: false }),
  useApWhtPreview: () => ({ mutateAsync: state.preview }),
}));
vi.mock("@/routes/accounting/journal-voucher/use-journal-voucher", () => ({
  useJournalVoucher: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-accounting-master", () => ({
  useBankAccounts: () => ({ data: [] }),
}));
vi.mock("@/components/lookup/lookup-vendor", () => ({
  LookupVendor: () => <button type="button">Vendor lookup</button>,
}));
vi.mock("@/components/lookup/lookup-currency", () => ({
  LookupCurrency: () => <button type="button">Currency lookup</button>,
}));
vi.mock("@/components/lookup/lookup-credit-term", () => ({
  LookupCreditTerm: () => <button type="button">Credit lookup</button>,
}));
vi.mock("@/components/lookup/lookup-product", () => ({
  LookupProduct: () => <button type="button">Product lookup</button>,
}));
vi.mock("@/components/lookup/lookup-unit", () => ({
  LookupUnit: () => <button type="button">Unit lookup</button>,
}));
vi.mock("@/components/lookup/lookup-cost-center", () => ({
  LookupCostCenter: () => <button type="button">Cost Center lookup</button>,
}));
vi.mock("@/components/lookup/lookup-tax-profile", () => ({
  LookupTaxProfile: () => <button type="button">Tax lookup</button>,
}));
vi.mock("@/components/lookup/lookup-chart-of-account-by-id", () => ({
  LookupChartOfAccountById: ({
    onValueChange,
  }: {
    onValueChange: (id: string) => void;
  }) => (
    <button type="button" onClick={() => onValueChange("new-account")}>
      Account lookup
    </button>
  ),
}));

const invoice: ApInvoice = {
  description: null,
  credit_term_name: null,
  base_currency_id: "thb",
  gl_jv_no: null,
  posted_at: null,
  void_at: null,
  void_reason: null,
  void_gl_jv_id: null,
  created_at: null,
  created_by_id: null,
  updated_at: null,
  updated_by_id: null,
  id: "invoice",
  doc_version: 3,
  doc_no: "APIV001",
  doc_type: "invoice",
  doc_status: "draft",
  doc_source: "manual",
  doc_date: "2026-11-12",
  vendor_id: "vendor",
  vendor_name: "Vendor",
  vendor_invoice_no: "INV001",
  invoice_date: "2026-11-10",
  due_date: "2026-12-10",
  credit_term_days: 30,
  credit_term_id: null,
  currency_id: "thb",
  currency_code: "THB",
  base_currency_code: "THB",
  exchange_rate: "1",
  sub_total_amount: "100",
  discount_amount: "0",
  net_amount: "100",
  vat_amount: "7",
  wht_estimate_amount: "0",
  total_amount: "107",
  base_total_amount: "107",
  outstanding_amount: "107",
  reference_applied_amount: "0",
  gl_jv_id: null,
  lines: [
    {
      id: "line",
      product_id: null,
      product_name: null,
      unit_id: null,
      unit_name: null,
      dr_cost_center_code: null,
      wht_tax_profile_id: null,
      cr_account_code: null,
      base_total_amount: "107",
      base_unpaid_amount: "107",
      sequence_no: 1,
      description: "Service",
      quantity: "1",
      unit_price: "100",
      vat_is_included: false,
      sub_total_amount: "100",
      discount_amount: "0",
      net_amount: "100",
      vat_rate: "7",
      vat_amount: "7",
      vat_is_override: false,
      wht_rate: "0",
      wht_estimate_amount: "0",
      dr_chart_of_accounts_id: "account",
      dr_account_code: "5000",
      dr_cost_center_id: null,
      vat_tax_profile_id: "vat",
      vat_chart_of_accounts_id: "vat-account",
      vat_cost_center_id: "vat-cc",
      cr_chart_of_accounts_id: "ap-account",
      cr_cost_center_id: "ap-cc",
      total_amount: "107",
      unpaid_amount: "107",
      dimensions: [{ gl_dimension_id: "project", gl_dimension_value_id: "p1" }],
      sources: [],
    },
  ],
};

function wrap(children: React.ReactNode, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={new QueryClient()}>
        <IntlProvider locale="en" messages={en}>
          {children}
        </IntlProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

Object.defineProperties(HTMLElement.prototype, {
  hasPointerCapture: { value: () => false, configurable: true },
  setPointerCapture: { value: () => {}, configurable: true },
  releasePointerCapture: { value: () => {}, configurable: true },
  scrollIntoView: { value: () => {}, configurable: true },
});

beforeEach(() => {
  state.invoice = null;
  state.payment = null;
  state.save.mockReset().mockResolvedValue({ id: "invoice" });
  state.preview.mockReset().mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

it("displays a credit-note reference as an offset without changing its stored positive amount", () => {
  state.invoice = invoice;
  wrap(
    <InvoiceReferencesPanel
      invoice={{
        ...invoice,
        references: [
          {
            ref_ap_invoice_id: "credit",
            ref_doc_type: "credit_note",
            applied_amount: "20",
            realized_fx_amount: "0",
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("-20.00 THB")).toBeInTheDocument();
});

describe("AP document layout and persistence contract", () => {
  it("shows the five Invoice tabs and disables references for non-invoice types", async () => {
    wrap(
      <Routes>
        <Route path="/:id" element={<ApInvoiceDetail />} />
      </Routes>,
      "/new",
    );
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Item Details",
      "Tax Invoice",
      "Doc Reference",
      "Payment",
      "Journal (GL)",
    ]);
    await userEvent.click(screen.getByRole("tab", { name: "Doc Reference" }));
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "Credit Note" }));
    expect(screen.getByRole("tab", { name: "Doc Reference" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Item Details" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("keeps line edits through tab switches and saves all accounting carry fields", async () => {
    state.invoice = {
      ...invoice,
      references: [
        {
          ref_ap_invoice_id: "credit",
          ref_doc_type: "credit_note",
          applied_amount: "20",
          realized_fx_amount: "0",
        },
      ],
    };
    wrap(
      <Routes>
        <Route path="/:id" element={<ApInvoiceDetail />} />
      </Routes>,
      "/invoice",
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit item 1" }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Expense" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Input Tax" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Account Payable" }),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Description"), {
      target: { value: "Changed service" },
    });
    await userEvent.click(
      within(dialog).getAllByRole("button", { name: "Close" })[0],
    );
    await userEvent.click(screen.getByRole("tab", { name: "Tax Invoice" }));
    await userEvent.click(screen.getByRole("tab", { name: "Item Details" }));
    expect(screen.getByRole("textbox", { name: "description 1" })).toHaveValue(
      "Changed service",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(state.save).toHaveBeenCalled());
    expect(state.save.mock.calls[0][0]).toMatchObject({
      id: "invoice",
      docVersion: 3,
      input: {
        references: [{ ref_ap_invoice_id: "credit", applied_amount: "20" }],
        lines: [
          {
            description: "Changed service",
            dimensions: [
              { gl_dimension_id: "project", gl_dimension_value_id: "p1" },
            ],
            vat_chart_of_accounts_id: "vat-account",
            vat_cost_center_id: "vat-cc",
            cr_chart_of_accounts_id: "ap-account",
            cr_cost_center_id: "ap-cc",
          },
        ],
      },
    });
  });

  it("opens existing Invoice line details without writable controls in view mode", async () => {
    state.invoice = invoice;
    wrap(
      <Routes>
        <Route path="/:id" element={<ApInvoiceDetail />} />
      </Routes>,
      "/invoice",
    );
    await userEvent.click(screen.getByRole("button", { name: "View item 1" }));
    expect(
      within(screen.getByRole("dialog")).getByLabelText("Description"),
    ).toBeDisabled();
  });

  it("separates Payment settlement from the real posted journal", () => {
    wrap(
      <Routes>
        <Route path="/:id" element={<ApPaymentDetail />} />
      </Routes>,
      "/new",
    );
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Settlement & Payment",
      "Journal (GL)",
    ]);
    expect(
      screen.getByRole("heading", { name: "Payment Methods" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save Draft" }),
    ).toBeInTheDocument();
  });

  it("keeps a saved Payment in view mode until Edit, and Cancel restores view", async () => {
    state.payment = {
      id: "payment",
      doc_version: 1,
      doc_no: "APPV001",
      doc_status: "draft",
      payment_date: "2026-11-12",
      paid_date: null,
      description: "Payment",
      reference_no: null,
      vendor_id: "vendor",
      vendor_name: "Vendor",
      payee_name: "Vendor",
      payee_tax_no: null,
      payee_branch_no: null,
      payee_address: null,
      bank_account_id: "bank",
      bank_account_code: "BANK",
      bank_account_name: "Bank",
      payment_method: "bank_transfer",
      cheque_no: null,
      cheque_date: null,
      currency_id: "thb",
      currency_code: "THB",
      exchange_rate: "1",
      base_currency_id: "thb",
      base_currency_code: "THB",
      total_applied_amount: "12",
      total_wht_amount: "0",
      total_expense_amount: "0",
      net_paid_amount: "12",
      base_total_applied_amount: "12",
      base_total_wht_amount: "0",
      base_total_expense_amount: "0",
      base_net_paid_amount: "12",
      realized_fx_amount: "0",
      gl_jv_id: null,
      gl_jv_no: null,
      posted_at: null,
      void_at: null,
      void_reason: null,
      void_gl_jv_id: null,
      created_at: null,
      updated_at: null,
      allocations: [],
      wht: [],
      expenses: [],
    };
    wrap(
      <Routes>
        <Route path="/:id" element={<ApPaymentDetail />} />
      </Routes>,
      "/payment",
    );
    expect(screen.queryByRole("button", { name: "Save Draft" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen.getByRole("button", { name: "Save Draft" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Save Draft" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});

it("filters reference documents and validates their available amount before applying", async () => {
  const changed = vi.fn();
  const credit: ApInvoice = {
    ...invoice,
    id: "credit",
    doc_no: "APCN001",
    doc_type: "credit_note",
    doc_status: "posted",
    outstanding_amount: "100",
  };
  vi.spyOn(httpApRepository, "listInvoices").mockResolvedValue({
    data: [
      credit,
      { ...credit, id: "other-currency", doc_no: "USD", currency_id: "usd" },
      { ...credit, id: "draft", doc_no: "DRAFT", doc_status: "draft" },
    ],
    paginate: { page: 1, perpage: 100, pages: 1, total: 3 },
  });
  wrap(
    <InvoiceReferenceEditor
      vendorId="vendor"
      currencyId="thb"
      value={[]}
      onChange={changed}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Apply Document" }));
  await userEvent.click(
    await screen.findByRole("checkbox", { name: "APCN001" }),
  );
  expect(screen.queryByRole("checkbox", { name: "USD" })).toBeNull();
  expect(screen.queryByRole("checkbox", { name: "DRAFT" })).toBeNull();
  const amount = screen.getByLabelText("Apply Amount APCN001");
  fireEvent.change(amount, { target: { value: "101" } });
  expect(screen.getByRole("button", { name: "Apply changes" })).toBeDisabled();
  expect(changed).not.toHaveBeenCalled();
  fireEvent.change(amount, { target: { value: "25" } });
  await userEvent.click(screen.getByRole("button", { name: "Apply changes" }));
  expect(changed).toHaveBeenCalledWith([
    { ref_ap_invoice_id: "credit", applied_amount: "25" },
  ]);
});

it("adds back this invoice's saved reference amount when editing a fully applied document", async () => {
  const saved = [{ ref_ap_invoice_id: "credit", applied_amount: "20" }];
  vi.spyOn(httpApRepository, "listInvoices").mockResolvedValue({
    data: [
      {
        ...invoice,
        id: "credit",
        doc_no: "APCN001",
        doc_type: "credit_note",
        doc_status: "posted",
        outstanding_amount: "0",
      },
    ],
    paginate: { page: 1, perpage: 100, pages: 1, total: 1 },
  });
  wrap(
    <InvoiceReferenceEditor
      vendorId="vendor"
      currencyId="thb"
      value={saved}
      originalValue={saved}
      onChange={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Apply Document" }));
  expect(
    await screen.findByRole("checkbox", { name: "APCN001" }),
  ).toBeChecked();
  expect(screen.getByRole("button", { name: "Apply changes" })).toBeEnabled();
});

const docs: ApOutstandingDocument[] = [
  {
    ap_invoice_id: "i1",
    doc_no: "APIV001",
    doc_type: "invoice",
    doc_date: "2026-11-01",
    due_date: "2026-11-20",
    currency_id: "thb",
    currency_code: "THB",
    exchange_rate: "1",
    outstanding_amount: "100",
    lines: [
      {
        ap_invoice_detail_id: "l1",
        doc_type: "invoice",
        sequence_no: 1,
        description: "Service",
        total_amount: "100",
        unpaid_amount: "100",
        available_amount: "100",
        wht_tax_profile_id: null,
      },
    ],
  },
];

it("selects partial payment only on Select and discards cancelled dialog edits", async () => {
  const changed = vi.fn();
  wrap(
    <PaymentAllocationsEditor
      docs={docs}
      allocations={{}}
      ownReserved={{}}
      lockedCurrency={null}
      inputDate="2026-11-12"
      onChangeLine={changed}
      onPayFull={vi.fn()}
      onClear={vi.fn()}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Select Document" }),
  );
  await userEvent.click(screen.getByRole("tab", { name: "Detail" }));
  fireEvent.change(screen.getByRole("textbox", { name: /APIV001/ }), {
    target: { value: "25.00" },
  });
  expect(changed).not.toHaveBeenCalled();
  await userEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Select",
    }),
  );
  expect(changed).toHaveBeenCalledWith("l1", "25.00");
  changed.mockClear();
  await userEvent.click(
    screen.getByRole("button", { name: "Select Document" }),
  );
  fireEvent.change(screen.getByRole("textbox", { name: /APIV001/ }), {
    target: { value: "50.00" },
  });
  await userEvent.click(
    within(screen.getByRole("dialog")).getAllByRole("button", {
      name: "Close",
    })[0],
  );
  expect(changed).not.toHaveBeenCalled();
});

it("edits an existing expense in a dialog without applying cancelled changes", async () => {
  const changed = vi.fn();
  wrap(
    <PaymentExpensesSection
      rows={[
        {
          key: "expense",
          chart_of_accounts_id: "account",
          cost_center_id: null,
          description: "Fee",
          amount: "10",
        },
      ]}
      editable
      errors={new Set()}
      onAdd={vi.fn()}
      onChange={changed}
      onRemove={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Edit expense" }));
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Updated fee" },
  });
  await userEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Apply changes",
    }),
  );
  expect(changed).toHaveBeenCalledWith(
    "expense",
    expect.objectContaining({ description: "Updated fee", amount: "10" }),
  );
  changed.mockClear();
  await userEvent.click(screen.getByRole("button", { name: "Edit expense" }));
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Cancelled fee" },
  });
  await userEvent.click(
    within(screen.getByRole("dialog")).getAllByRole("button", {
      name: "Close",
    })[0],
  );
  expect(changed).not.toHaveBeenCalled();
});
