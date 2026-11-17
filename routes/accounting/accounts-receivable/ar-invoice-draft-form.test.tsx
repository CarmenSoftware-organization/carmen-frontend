import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { IntlProvider } from "use-intl";
import messages from "@/messages/en.json";
import { ArInvoiceDraftForm } from "./ar-invoice-draft-form";
import type { ArDraftLine } from "./ar-invoice-draft-model";
import * as supplemental from "./ar-invoice-supplement-model";
import type { ArRegisterDocument } from "./use-ar-register";

const api = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  customerData: undefined as Record<string, unknown> | undefined,
}));
vi.mock("./use-ar-register", () => ({
  useCreateArInvoice: () => ({ mutateAsync: api.create }),
  useUpdateArInvoice: () => ({ mutateAsync: api.update }),
}));
vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "TEST" }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ defaultCurrencyId: "thb", defaultCurrencyCode: "THB" }),
}));
vi.mock("@/hooks/use-unsaved-changes", () => ({ useUnsavedChanges: vi.fn() }));
vi.mock("@/hooks/use-number-formatter", () => ({
  useAmountFormatter: () => (value: number) => value.toFixed(2),
}));
vi.mock("@/components/share/form-toolbar", () => ({
  FormToolbar: ({
    formId,
    onCancel,
  }: {
    formId: string;
    onCancel: () => void;
  }) => (
    <div>
      <button type="submit" form={formId}>
        Save document
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));
vi.mock("@/components/lookup/lookup-currency", () => ({
  LookupCurrency: ({
    onValueChange,
    onItemChange,
  }: {
    onValueChange: (id: string) => void;
    onItemChange: (item: object) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onValueChange("usd");
        onItemChange({ code: "USD", exchange_rate: 35 });
      }}
    >
      Choose USD
    </button>
  ),
}));
vi.mock("./ar-customer-lookup", () => ({
  ArCustomerLookup: ({ change }: { change: (customer: object) => void }) => (
    <>
      <button
        type="button"
        onClick={() =>
          change({
            id: "customer",
            code: "C001",
            name: "Customer",
            credit_term_days: 30,
            default_currency_id: "thb",
            default_currency_code: "THB",
            registered_name: "Customer Limited",
            tax_no: "1234567890123",
            branch_no: "00000",
            customer_address: [
              {
                id: "registered",
                address_type: "register_address",
                address_line1: "123 Main Street",
                province: "Bangkok",
                postal_code: "10100",
              },
            ],
          })
        }
      >
        Choose customer
      </button>
      <button
        type="button"
        onClick={() =>
          change({
            id: "usd-customer",
            code: "C002",
            name: "USD customer",
            default_currency_id: "usd",
            default_currency_code: "USD",
          })
        }
      >
        Choose USD customer
      </button>
    </>
  ),
}));
vi.mock("./use-ar-customer", () => ({
  useArCustomer: (id?: string) => ({ data: id ? api.customerData : undefined }),
}));
vi.mock("./ar-invoice-tax-lines", () => ({ ArInvoiceTaxLines: () => null }));
vi.mock("./ar-invoice-journal", () => ({ InvoiceJournal: () => null }));
vi.mock("./ar-invoice-references", () => ({ ArInvoiceReferences: () => null }));
vi.mock("./ar-invoice-lines", () => ({
  ArInvoiceLines: ({
    lines,
    edit,
  }: {
    lines: ArDraftLine[];
    edit?: (line: ArDraftLine) => void;
  }) => (
    <div>
      {lines.map((line) => (
        <button type="button" key={line.id} onClick={() => edit?.(line)}>
          {line.description}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("./ar-invoice-line-dialog", () => ({
  ArInvoiceLineDialog: ({
    line,
    save,
  }: {
    line: ArDraftLine;
    save: (line: ArDraftLine) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        save({
          ...line,
          description: "Room charge",
          quantity: 2,
          unit_price: 100,
          cr_chart_of_accounts_id: "revenue",
          cr_cost_center_id: "rooms",
          group_no: 2,
          reference_info: "FOL-12",
          date_from: "2026-11-01",
          date_to: "2026-11-03",
          unit_id: "night",
          unit_name: "NIGHT",
          discount_pct: 10,
          vat_tax_profile_id: "vat",
          vat_rate: 7,
          vat_chart_of_accounts_id: "tax",
          vat_cost_center_id: "general",
          dimensions: [
            { gl_dimension_id: "market", gl_dimension_value_id: "direct" },
          ],
        })
      }
    >
      Use complete line
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.customerData = undefined;
  sessionStorage.clear();
  api.create.mockResolvedValue({ data: { id: "saved-id" } });
  api.update.mockResolvedValue({ data: { id: "saved-id" } });
});
function setup(document?: ArRegisterDocument) {
  const saved = vi.fn();
  render(
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <ArInvoiceDraftForm
        document={document}
        canWrite
        cancel={vi.fn()}
        saved={saved}
      />
    </IntlProvider>,
  );
  return saved;
}
it("creates a real invoice with the complete header and detail payload", async () => {
  const saved = setup();
  await userEvent.click(
    screen.getByRole("button", { name: "Choose customer" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Choose USD" }));
  fireEvent.change(screen.getByLabelText(/Document date/), {
    target: { value: "2026-11-17" },
  });
  fireEvent.change(screen.getByLabelText("Credit days"), {
    target: { value: "14" },
  });
  fireEvent.change(screen.getByLabelText("Source document"), {
    target: { value: "BOOK-100" },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Accommodation" },
  });
  await userEvent.click(screen.getByRole("checkbox", { name: "Tax invoice" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "WHT amount" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "WHT amount" }), {
    target: { value: "6" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Add Line" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Use complete line" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Save document" }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith("saved-id"));
  expect(api.create).toHaveBeenCalledWith(
    expect.objectContaining({
      doc_type: "invoice",
      customer_id: "customer",
      doc_date: "2026-11-17",
      credit_term_days: 14,
      currency_id: "usd",
      exchange_rate: "35",
      source_doc_ref: "BOOK-100",
      description: "Accommodation",
      is_tax_invoice: true,
      is_wht_recorded: true,
      wht_amount: "6",
      details: {
        add: [
          expect.objectContaining({
            group_no: 2,
            reference_info: "FOL-12",
            date_from: "2026-11-01",
            date_to: "2026-11-03",
            unit_id: "night",
            discount_pct: 10,
            vat_tax_profile_id: "vat",
            vat_chart_of_accounts_id: "tax",
            dimensions: [
              { gl_dimension_id: "market", gl_dimension_value_id: "direct" },
            ],
          }),
        ],
      },
    }),
  );
});
it("updates the original document version and preserves untouched line metadata", async () => {
  const document = {
    id: "saved-id",
    doc_no: "ARIV-1",
    doc_type: "invoice",
    doc_status: "draft",
    doc_version: 4,
    doc_date: "2026-11-01",
    customer_id: "customer",
    customer_code: "C001",
    customer_name: "Customer",
    currency_code: "THB",
    currency_id: "thb",
    exchange_rate: 1,
    credit_term_days: 30,
    total_amount: 107,
    outstanding_amount: 107,
    due_date: "2026-12-01",
    net_amount: 100,
    vat_amount: 7,
    description: "Before",
    tb_ar_invoice_detail: [
      {
        id: "line",
        sequence_no: 1,
        quantity: 1,
        unit_price: 100,
        total_amount: 107,
        cr_chart_of_accounts_id: "revenue",
        cr_cost_center_id: "rooms",
        vat_tax_profile_id: "vat",
        vat_rate: 7,
        reference_info: "Preserve this",
        discount_is_override: true,
        discount_amount: 0,
        tb_ar_invoice_detail_dimension: [
          { gl_dimension_id: "market", gl_dimension_value_id: "direct" },
        ],
      },
    ],
  } satisfies ArRegisterDocument;
  const saved = setup(document);
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "After" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Save document" }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith("saved-id"));
  expect(api.update).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "saved-id",
      doc_version: 4,
      description: "After",
      currency_id: "thb",
      exchange_rate: "1",
    }),
  );
  expect(api.update.mock.lastCall?.[0]).not.toHaveProperty("details");
});

it("retries optional mock storage without repeating a committed create", async () => {
  const saved = setup();
  await userEvent.click(
    screen.getByRole("button", { name: "Choose customer" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Add Line" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Use complete line" }),
  );
  const write = vi
    .spyOn(supplemental, "saveInvoiceSupplement")
    .mockImplementation(() => {
      throw new DOMException("Storage is full", "QuotaExceededError");
    });
  await userEvent.click(screen.getByRole("button", { name: "Save document" }));
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  expect(saved).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/Document date/)).toBeDisabled();
  write.mockRestore();
  await userEvent.click(screen.getByRole("button", { name: "Save document" }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith("saved-id"));
  expect(api.create).toHaveBeenCalledTimes(1);
});

it("requires a confirmed rate after switching to a customer's foreign currency", async () => {
  setup();
  await userEvent.click(
    screen.getByRole("button", { name: "Choose customer" }),
  );
  expect(screen.getByLabelText(/Exchange rate/)).toHaveValue(1);
  await userEvent.click(
    screen.getByRole("button", { name: "Choose USD customer" }),
  );
  expect(screen.getByLabelText(/Exchange rate/)).toHaveValue(null);
  await userEvent.click(screen.getByRole("button", { name: "Choose USD" }));
  expect(screen.getByLabelText(/Exchange rate/)).toHaveValue(35);
  await userEvent.click(
    screen.getByRole("button", { name: "Choose customer" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Choose USD customer" }),
  );
  expect(screen.getByLabelText(/Exchange rate/)).toHaveValue(null);
  expect(api.create).not.toHaveBeenCalled();
});

it("blocks a tax invoice with incomplete tax entity before the API mutation", async () => {
  setup();
  await userEvent.click(
    screen.getByRole("button", { name: "Choose USD customer" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Choose USD" }));
  await userEvent.click(screen.getByRole("button", { name: "Add Line" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Use complete line" }),
  );
  await userEvent.click(screen.getByRole("checkbox", { name: "Tax invoice" }));
  fireEvent.submit(document.getElementById("ar-invoice-draft")!);
  expect(api.create).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toBeVisible();
});
it("rejects a supplied nonnumeric postal code even when tax invoice is not selected", async () => {
  setup();
  await userEvent.click(
    screen.getByRole("button", { name: "Choose customer" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Add Line" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Use complete line" }),
  );
  await userEvent.click(screen.getByRole("tab", { name: "Tax invoice" }));
  fireEvent.change(screen.getByLabelText("Postal code"), {
    target: { value: "ABCDE" },
  });
  fireEvent.submit(document.getElementById("ar-invoice-draft")!);
  expect(api.create).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toBeVisible();
});

it("hydrates current customer tax defaults without overwriting a user override on query refresh", async () => {
  const ui = () => (
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <ArInvoiceDraftForm canWrite cancel={vi.fn()} saved={vi.fn()} />
    </IntlProvider>
  );
  const view = render(ui());
  await userEvent.click(
    screen.getByRole("button", { name: "Choose customer" }),
  );
  api.customerData = {
    id: "customer",
    registered_name: "Registered customer",
    tax_no: "1234567890123",
    branch_no: "00000",
    customer_address: [
      {
        id: "address",
        address_type: "register_address",
        address_line1: "Current profile address",
        province: "Bangkok",
        postal_code: "10100",
      },
    ],
  };
  view.rerender(ui());
  await userEvent.click(screen.getByRole("tab", { name: "Tax invoice" }));
  expect(screen.getByLabelText("Address line 1")).toHaveValue(
    "Current profile address",
  );
  fireEvent.change(screen.getByLabelText("Address line 1"), {
    target: { value: "User override address" },
  });
  api.customerData = {
    ...api.customerData,
    customer_address: [
      {
        id: "address",
        address_type: "register_address",
        address_line1: "Refreshed profile address",
      },
    ],
  };
  view.rerender(ui());
  expect(screen.getByLabelText("Address line 1")).toHaveValue(
    "User override address",
  );
});
