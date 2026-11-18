import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  act,
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
import { httpClient } from "@/lib/http-client";
import { DEFAULT_ATTACHMENT_POLICY } from "@/lib/attachment-policy";
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
vi.mock("@/hooks/use-attachment-policy", () => ({
  useAttachmentPolicy: () => DEFAULT_ATTACHMENT_POLICY,
}));
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
  usePaymentTypeById: () => ({ data: undefined }),
  useWhtServiceTypeById: () => ({ data: undefined }),
  useWhtForms: () => ({ data: undefined }),
  usePaymentTypes: () => ({ data: undefined }),
  useWhtServiceTypes: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-goods-receive-note", () => ({
  useGoodsReceiveNote: () => ({
    data: undefined,
    isLoading: false,
  }),
  useGoodsReceiveNoteById: () => ({ data: undefined, isLoading: false }),
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
  base_sub_total_amount: "100",
  base_discount_amount: "0",
  base_net_amount: "100",
  base_vat_amount: "7",
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
      base_sub_total_amount: "100",
      base_discount_amount: "0",
      base_net_amount: "100",
      base_vat_amount: "7",
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
      dimensions: [{ dimension_id: "project", dimension_value_id: "p1" }],
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
  it("keeps the posted JV in Journal (GL), with Delete-style Void and primary Pay Invoice", async () => {
    state.invoice = {
      ...invoice,
      doc_status: "posted",
      gl_jv_id: "posted-jv",
      gl_jv_no: "JV-POSTED",
    };
    wrap(
      <Routes>
        <Route path="/:id" element={<ApInvoiceDetail />} />
      </Routes>,
      "/invoice",
    );
    expect(
      screen.queryByRole("link", { name: /Journal|JV-POSTED/i }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Void" })).toHaveAttribute(
      "data-variant",
      "outline",
    );
    expect(screen.getByRole("button", { name: "Void" })).toHaveClass(
      "text-destructive",
    );
    expect(screen.getByRole("button", { name: "Pay invoice" })).toHaveAttribute(
      "data-variant",
      "default",
    );
    await userEvent.click(screen.getByRole("tab", { name: "Journal (GL)" }));
    expect(
      screen
        .getAllByRole("link")
        .filter(
          (link) =>
            link.getAttribute("href") ===
            "/accounting/journal-voucher/posted-jv",
        ),
    ).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Void" }));
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Void" }),
    ).toHaveAttribute("data-variant", "destructive");
  });

  it("preserves void reason and reversal JV inside Journal (GL)", async () => {
    state.invoice = {
      ...invoice,
      doc_status: "void",
      gl_jv_id: "posted-jv",
      void_gl_jv_id: "reversal-jv",
      void_reason: "Duplicate supplier invoice",
    };
    wrap(
      <Routes>
        <Route path="/:id" element={<ApInvoiceDetail />} />
      </Routes>,
      "/invoice",
    );
    expect(screen.queryByText("Duplicate supplier invoice")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Journal (GL)" }));
    expect(screen.getByText(/Duplicate supplier invoice/)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual(
      expect.arrayContaining([
        "/accounting/journal-voucher/posted-jv",
        "/accounting/journal-voucher/reversal-jv",
      ]),
    );
  });

  it.each([
    ["deposit", "Deposit", "New deposit"],
    ["debit-note", "Debit Note", "New debit note"],
    ["credit-note", "Credit Note", "New credit note"],
  ])(
    "starts a scoped %s draft with its document type locked",
    (segment, label, title) => {
      wrap(<ApInvoiceDetail />, `/accounting/accounts-payable/${segment}/new`);
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      const selector = screen.getByRole("combobox", { name: /^Type/ });
      expect(selector).toBeDisabled();
      expect(selector).toHaveTextContent(label);
    },
  );

  it.each(["invoice", "payment"])(
    "blocks %s edits while uploads hold the save snapshot",
    async (kind) => {
      let finishUpload!: (response: Response) => void;
      vi.spyOn(httpClient, "post").mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishUpload = resolve;
          }),
      );
      vi.spyOn(httpClient, "get").mockResolvedValue(
        new Response(
          JSON.stringify({ data: [], paginate: { total: 0, pages: 1 } }),
        ),
      );
      if (kind === "invoice") state.invoice = invoice;
      else
        state.payment = {
          ...invoice,
          id: "payment",
          doc_no: "APPV001",
          payment_date: "2026-11-12",
          paid_date: null,
          payment_method: "bank_transfer",
          bank_account_id: "bank",
          bank_account_name: "Bank",
          allocations: [
            {
              id: "allocation",
              ap_invoice_id: invoice.id,
              ap_invoice_detail_id: "line",
              doc_type: "invoice",
              applied_amount: "107",
            },
          ],
          total_applied_amount: "107",
          total_wht_amount: "3",
          total_expense_amount: "0",
          net_paid_amount: "104",
          wht: [
            {
              id: "wht",
              wht_tax_profile_id: "service3",
              wht_tax_profile_name: "Service 3%",
              wht_rate: "3",
              base_amount: "100",
              wht_amount: "3",
              is_override: true,
            },
          ],
          expenses: [],
        } as unknown as ApPayment;
      wrap(
        <Routes>
          <Route
            path="/:id"
            element={
              kind === "invoice" ? <ApInvoiceDetail /> : <ApPaymentDetail />
            }
          />
        </Routes>,
        `/${kind}`,
      );
      await userEvent.click(screen.getByRole("button", { name: "Edit" }));
      await userEvent.click(screen.getByRole("tab", { name: "Attachments" }));
      fireEvent.change(screen.getByLabelText("Attach files"), {
        target: {
          files: [
            new File(["payload"], "invoice.pdf", { type: "application/pdf" }),
          ],
        },
      });
      await userEvent.click(
        screen.getByRole("tab", {
          name: kind === "invoice" ? "Item Details" : "Settlement & Payment",
        }),
      );
      const amount = screen.getByRole("textbox", {
        name: kind === "invoice" ? "unit price 1" : "Base Service 3%",
      });
      expect(amount.closest("[inert]")).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "Save Draft" }));
      await waitFor(() =>
        expect(amount.closest("[inert]")).toHaveAttribute("aria-busy", "true"),
      );
      expect(state.save).not.toHaveBeenCalled();
      // jsdom does not enforce native inert; assert its real-browser interaction boundary.
      expect(amount).toHaveValue("100");
      await act(async () =>
        finishUpload(
          new Response(JSON.stringify({ data: { fileToken: "BU/new-file" } })),
        ),
      );
      await waitFor(() => expect(state.save).toHaveBeenCalledOnce());
      const input = state.save.mock.calls[0][0].input;
      expect(
        kind === "invoice"
          ? input.lines[0].unit_price
          : input.wht[0].base_amount,
      ).toBe("100");
      expect(input.attachments[0].fileToken).toBe("BU/new-file");
    },
  );

  it("shows the Invoice tabs and disables references for non-invoice types", async () => {
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
      "Attachments",
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
            dimensions: [{ dimension_id: "project", dimension_value_id: "p1" }],
            vat_chart_of_accounts_id: "vat-account",
            vat_cost_center_id: "vat-cc",
            cr_chart_of_accounts_id: "ap-account",
            cr_cost_center_id: "ap-cc",
          },
        ],
      },
    });
  });

  it("marks mandatory typed dimensions and locks them until account/rules are safe to edit", async () => {
    state.invoice = {
      ...invoice,
      lines: invoice.lines!.map((line) => ({
        ...line,
        dimensions: [
          { dimension_id: "project", value: "Direct", data_type: "string" },
        ],
      })),
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let accountReady = false;
    let failRules = false;
    let finishAccount!: (response: Response) => void;
    const account = {
      id: "account",
      code: "5000",
      description_1: "Expense",
      allowed_dimensions: ["project"],
    };
    const response = (data: unknown) =>
      new Response(
        JSON.stringify({
          data,
          ...(Array.isArray(data)
            ? {
                paginate: {
                  total: data.length,
                  page: 1,
                  perpage: 100,
                  pages: 1,
                },
              }
            : {}),
        }),
      );
    vi.spyOn(httpClient, "get").mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes("/chart-of-accounts/account")) {
        if (!accountReady)
          return new Promise<Response>((resolve) => {
            finishAccount = resolve;
          });
        return response(account);
      }
      if (path.includes("/account-dimension-rules")) {
        if (failRules)
          return new Response(
            JSON.stringify({ message: "Rules unavailable" }),
            { status: 500 },
          );
        return response([
          {
            id: "rule",
            chart_of_accounts_id: "account",
            dimension_id: "project",
            requirement: "mandatory",
            doc_version: 1,
          },
        ]);
      }
      if (path.includes("/dimensions"))
        return response([
          {
            id: "project",
            code: "PRJ",
            name: "Project",
            is_active: true,
            data_type: "string",
            doc_version: 1,
          },
        ]);
      return response([]);
    });
    render(
      <MemoryRouter initialEntries={["/invoice"]}>
        <QueryClientProvider client={client}>
          <IntlProvider locale="en" messages={en}>
            <Routes>
              <Route path="/:id" element={<ApInvoiceDetail />} />
            </Routes>
          </IntlProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit item 1" }));
    await userEvent.click(
      await screen.findByRole("button", { name: /^Dimensions/ }),
    );
    const input = await screen.findByRole("textbox", { name: "Project" });
    expect(input).toBeDisabled();
    expect(
      within(input.closest<HTMLElement>("[data-slot=field]")!).getByText("*"),
    ).toBeVisible();
    accountReady = true;
    await act(async () => finishAccount(response(account)));
    await waitFor(() => expect(input).toBeEnabled());
    fireEvent.change(input, { target: { value: "Business" } });
    failRules = true;
    await act(async () => {
      await client.invalidateQueries({
        queryKey: ["coa-dimension-rules", "BU", "account"],
      });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.accounting.accountsPayable.ui.dimensionLoadError,
    );
    expect(input).toBeDisabled();
    failRules = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(input).toBeEnabled());
    expect(input).toHaveValue("Business");
    await userEvent.click(
      within(screen.getByRole("dialog")).getAllByRole("button", {
        name: "Close",
      })[0],
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(state.save).toHaveBeenCalled());
    expect(state.save.mock.calls[0][0].input.lines[0].dimensions).toEqual([
      { dimension_id: "project", value: "Business" },
    ]);
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

  it("shows persisted base amounts even when they differ from a fresh rate calculation", async () => {
    state.invoice = {
      ...invoice,
      currency_code: "USD",
      exchange_rate: "35",
      base_net_amount: "3512.34",
      lines: [{ ...invoice.lines![0], base_net_amount: "3512.34" }],
    };
    wrap(
      <Routes>
        <Route path="/:id" element={<ApInvoiceDetail />} />
      </Routes>,
      "/invoice",
    );
    expect(screen.getAllByText("3,512.34 THB")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "View item 1" }));
    expect(
      within(screen.getByRole("dialog")).getByText("3,512.34"),
    ).toBeInTheDocument();
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
      "Attachments",
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
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "-10" } });
  expect(screen.getByLabelText("Amount")).toHaveValue("10");
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("combobox"));
  await userEvent.click(screen.getByRole("option", { name: "Credit" }));
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
    expect.objectContaining({ description: "Updated fee", amount: "10", is_credit: true }),
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
