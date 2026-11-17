import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { IntlProvider } from "use-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { ArDraftLine } from "./ar-invoice-draft-model";
import { ContractList } from "./ar-contract.route";
import { readContractSamples, saveContractSample } from "./ar-contract-model";

vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "CONTRACT-TEST" }));
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({ canWrite: true, isAdmin: true, can: () => true }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({
    dateFormat: "dd/MM/yyyy",
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
vi.mock("./ar-customer-lookup", () => ({
  ArCustomerLookup: () => <button type="button">Change customer</button>,
}));
vi.mock("./ar-invoice-line-dialog", () => ({
  ArInvoiceLineDialog: ({
    line,
    save,
    close,
  }: {
    line: ArDraftLine;
    save: (line: ArDraftLine) => void;
    close: () => void;
  }) => (
    <div role="dialog" aria-label="Contract item editor">
      <p>
        {line.date_from} / {line.date_to}
      </p>
      <button
        type="button"
        onClick={() =>
          save({
            ...line,
            quantity: 2,
            unit_price: 100,
            description: "Meeting room",
            cr_chart_of_accounts_id: "revenue",
            cr_cost_center_id: "rooms",
            dr_chart_of_accounts_id: "receivable",
            dr_cost_center_id: "general",
            cr_account_code: "4010",
            cr_cost_center_code: "ROOMS",
            dr_account_code: "1130",
            discount_pct: 10,
            vat_rate: 7,
            vat_chart_of_accounts_id: "vat",
            vat_cost_center_id: "general",
          })
        }
      >
        Save item
      </button>
      <button type="button" onClick={close}>
        Close item
      </button>
    </div>
  ),
}));

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(
    {},
    "",
    "/accounting/accounts-receivable/profile/customer-one",
  );
});

const customer = {
  id: "customer-one",
  code: "AR001",
  name: "Customer One",
  is_active: true,
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ContractList customer={customer} embedded />
        </MemoryRouter>
      </QueryClientProvider>
    </IntlProvider>,
  );
}

it("creates an independent contract for the selected Profile, keeps dates on new lines and persists derived totals", async () => {
  const user = userEvent.setup();
  const view = setup();
  expect(screen.queryByText("202600001")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "New Contract" }));
  expect(
    screen.queryByRole("button", { name: "Change customer" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("AR001 · Customer One")).toBeVisible();
  fireEvent.change(screen.getByLabelText(/^Description/), {
    target: { value: "Monthly meeting" },
  });
  fireEvent.change(screen.getByLabelText(/^Start Date/), {
    target: { value: "2027-01-01" },
  });
  fireEvent.change(screen.getByLabelText(/^End Date/), {
    target: { value: "2027-12-31" },
  });
  await user.click(screen.getByRole("button", { name: /Add line/i }));
  expect(
    within(
      screen.getByRole("dialog", { name: "Contract item editor" }),
    ).getByText("2027-01-01 / 2027-12-31"),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Save item" }));
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const saved = readContractSamples("CONTRACT-TEST").records.find(
    (record) => record.customerId === customer.id,
  )!;
  expect(saved).toMatchObject({
    contractNo: "202700001",
    customerId: customer.id,
    amount: 192.6,
  });
  expect(saved.lines?.[0]).toMatchObject({
    description: "Meeting room",
    discount_pct: 10,
    vat_rate: 7,
  });
  view.unmount();
  setup();
  expect(screen.getByText("Monthly meeting")).toBeVisible();
  expect(
    screen.queryByText("Monthly corporate accommodation"),
  ).not.toBeInTheDocument();
});

it("blocks an empty contract and keeps the draft visible for correction", async () => {
  const user = userEvent.setup();
  setup();
  await user.click(screen.getByRole("button", { name: "New Contract" }));
  fireEvent.change(screen.getByLabelText(/^Description/), {
    target: { value: "Incomplete contract" },
  });
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Add at least one contract item",
  );
  expect(screen.getByLabelText(/^Description/)).toHaveValue(
    "Incomplete contract",
  );
  expect(
    readContractSamples("CONTRACT-TEST").records.some(
      (record) => record.customerId === customer.id,
    ),
  ).toBe(false);
});

it("keeps other customers out of the Profile contract table", () => {
  const source = readContractSamples("CONTRACT-TEST").records[0];
  saveContractSample("CONTRACT-TEST", {
    ...source,
    id: "own",
    customerId: customer.id,
    customerCode: customer.code,
    customerName: customer.name,
    description: "Own agreement",
  });
  saveContractSample("CONTRACT-TEST", {
    ...source,
    id: "other",
    customerId: "customer-two",
    description: "Other agreement",
  });
  setup();
  const table = screen.getByRole("table");
  expect(within(table).getByText("Own agreement")).toBeVisible();
  expect(within(table).queryByText("Other agreement")).not.toBeInTheDocument();
});
