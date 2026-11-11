import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { IntlProvider } from "use-intl";
import { beforeEach, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { setURLParams } from "@/hooks/use-url";
import { act } from "react";
import { Component as FolioList } from "./ar-folio.route";
import { Component as ContractList } from "./ar-contract.route";
import { ContractDialog } from "./ar-contract-dialog";
import { FolioDialog } from "./ar-folio-actions";
import { readContractSamples } from "./ar-contract-model";
import { FOLIO_SAMPLES } from "./ar-folio-model";
import { Component as AccountingList } from "../documents/accounting-document-list.route";
import { downloadXlsx } from "@/lib/xlsx-utils";

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
  ArCustomerLookup: ({
    change,
  }: {
    change: (value: {
      id: string;
      code: string;
      name: string;
      is_active: boolean;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        change({
          id: "active-customer",
          code: "C-001",
          name: "Active Customer",
          is_active: true,
        })
      }
    >
      Select active customer
    </button>
  ),
}));

beforeEach(() => window.history.replaceState({}, "", "/"));

function setup(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[window.location.pathname]}>
          {node}
        </MemoryRouter>
      </QueryClientProvider>
    </IntlProvider>,
  );
}

it("gives AR Receipt the standard actions and exports the combined date and status filters", async () => {
  window.history.replaceState(
    {},
    "",
    "/accounting/accounts-receivable/receipt",
  );
  setup(<AccountingList />);
  expect(
    screen.getByRole("button", { name: "Print" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Filter" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "New" }),
  ).toBeVisible();
  act(() =>
    setURLParams({
      status: "draft",
      date: "date|date_range:2026-07-03,2026-07-08",
      sort: "date:asc",
    }),
  );
  const table = screen.getByRole("table");
  expect(within(table).getByText("RC2607-0005")).toBeVisible();
  expect(within(table).queryByText("RC2607-0001")).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Export" }),
  );
  expect(downloadXlsx).toHaveBeenCalledWith(
    expect.objectContaining({
      rows: [
        expect.objectContaining({ number: "RC2607-0005", status: "Draft" }),
      ],
    }),
  );
});

it("uses working client sorting and search for the GL financial report list", () => {
  window.history.replaceState({}, "", "/accounting/financial-reports");
  setup(<AccountingList />);
  act(() => setURLParams({ search: "Corporate Sales", sort: "date:asc" }));
  const table = screen.getByRole("table");
  const rows = within(table).getAllByRole("row");
  expect(rows).toHaveLength(3);
  expect(rows[1]).toHaveTextContent("FR2607-0004");
  expect(rows[2]).toHaveTextContent("FR2607-0008");
  act(() => setURLParams({ sort: "date:desc" }));
  expect(within(table).getAllByRole("row")[1]).toHaveTextContent("FR2607-0008");
});

it("renders the Folio table with Pending as default and updates filtered KPIs for All", async () => {
  setup(<FolioList />);
  const table = screen.getByRole("table");
  expect(within(table).getByText("SAMPLE-PMS-0105")).toBeVisible();
  expect(within(table).queryByText("SAMPLE-POS-0107")).not.toBeInTheDocument();
  expect(within(table).getByText("Tax Amount")).toBeVisible();
  expect(within(table).getByText("Un-Bill")).toBeVisible();
  act(() => setURLParams({ status: "all" }));
  expect(within(table).getByText("SAMPLE-POS-0107")).toBeVisible();
  expect(screen.getByText("19,260.00")).toBeVisible();
  act(() => setURLParams({ search: "G:1040" }));
  expect(within(table).queryByText("SAMPLE-PMS-0105")).not.toBeInTheDocument();
  expect(within(table).getByText("SAMPLE-POS-0107")).toBeVisible();
});

it("blocks switching a partly billed Folio even if its dialog is opened directly", async () => {
  const save = vi.fn();
  setup(
    <FolioDialog
      folio={FOLIO_SAMPLES[1]}
      action="switch"
      close={vi.fn()}
      save={save}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Select active customer" }),
  );
  expect(screen.getByRole("button", { name: "Switch A/R" })).toBeDisabled();
  fireEvent.submit(document.querySelector("form")!);
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("Only pending folios");
});

it("edits a contract from its standard list and preserves the header after remounting", async () => {
  const view = setup(<ContractList />);
  expect(
    within(screen.getByRole("table")).getByRole("columnheader", {
      name: "DOC",
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "View document 202600001" }),
  ).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "202600001" }));
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Quarterly accommodation" },
  });
  fireEvent.change(screen.getByLabelText("Charge Every"), {
    target: { value: "3" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText("Quarterly accommodation")).toBeVisible();
  view.unmount();
  setup(<ContractList />);
  expect(screen.getByText("Quarterly accommodation")).toBeVisible();
  expect(screen.getByText("3 month(s)")).toBeVisible();
});

it("preserves the contract form if session storage cannot save the changes", async () => {
  setup(<ContractList />);
  await userEvent.click(screen.getByRole("button", { name: "202600001" }));
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Unsaved accommodation" },
  });
  const write = vi
    .spyOn(sessionStorage, "setItem")
    .mockImplementationOnce(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByLabelText("Description")).toHaveValue(
    "Unsaved accommodation",
  );
  expect(readContractSamples("TEST").records[0].description).toBe(
    "Monthly corporate accommodation",
  );
  write.mockRestore();
});

it("requires a void reason and a trimmed remark before changing any Folio amounts", () => {
  const save = vi.fn();
  setup(
    <FolioDialog
      folio={FOLIO_SAMPLES[0]}
      action="void"
      close={vi.fn()}
      save={save}
    />,
  );
  fireEvent.change(screen.getByLabelText("Remark"), {
    target: { value: "     " },
  });
  fireEvent.submit(document.querySelector("form")!);
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("Select a reason");
});

it("validates contract dates and billing intervals while keeping the assigned number", () => {
  const record = readContractSamples("TEST").records[0];
  const save = vi.fn();
  setup(
    <ContractDialog
      mode="edit"
      record={record}
      data={readContractSamples("TEST")}
      canWrite
      close={vi.fn()}
      edit={vi.fn()}
      save={save}
    />,
  );
  expect(screen.getByRole("switch", { name: "Active" })).toBeChecked();
  fireEvent.change(screen.getByLabelText("End Date"), {
    target: { value: "2025-01-01" },
  });
  fireEvent.submit(document.querySelector("form")!);
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("End date");
  fireEvent.change(screen.getByLabelText("End Date"), {
    target: { value: "2026-12-31" },
  });
  fireEvent.change(screen.getByLabelText("Charge Every"), {
    target: { value: "1.5" },
  });
  fireEvent.submit(document.querySelector("form")!);
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("whole billing interval");
  fireEvent.change(screen.getByLabelText("Charge Every"), {
    target: { value: "3" },
  });
  fireEvent.submit(document.querySelector("form")!);
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      contractNo: "202600001",
      chargeEvery: 3,
      currency: "THB",
      rate: 1,
    }),
  );
});

it("rejects active document content instead of attaching it to a contract", async () => {
  const record = readContractSamples("TEST").records[0];
  setup(
    <ContractDialog
      mode="edit"
      record={record}
      data={readContractSamples("TEST")}
      canWrite
      close={vi.fn()}
      edit={vi.fn()}
      save={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Contract Document"), {
    target: {
      files: [
        new File(["<script></script>"], "unsafe.html", { type: "text/html" }),
      ],
    },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "PDF, PNG, JPEG or WebP",
  );
  expect(screen.queryByText("unsafe.html")).not.toBeInTheDocument();
});
