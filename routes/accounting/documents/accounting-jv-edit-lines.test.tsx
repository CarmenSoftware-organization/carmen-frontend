import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { IntlProvider } from "use-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import messages from "@/messages/en.json";
import { httpClient } from "@/lib/http-client";
import type {
  JournalVoucher,
  JournalVoucherInput,
} from "@/types/journal-voucher";
import { httpJournalVoucherRepository } from "../journal-voucher/journal-voucher-http-repository";
import AccountingDocumentDetail from "./accounting-document-detail";

const state = vi.hoisted(() => ({
  journal: undefined as unknown as JournalVoucher,
  update: vi.fn(),
  now: 1000,
}));
const ids = {
  jv: "10000000-0000-4000-8000-000000000001",
  debit: "20000000-0000-4000-8000-000000000001",
  credit: "20000000-0000-4000-8000-000000000002",
  currency: "30000000-0000-4000-8000-000000000001",
};
vi.mock("@/lib/http-client", () => ({
  httpClient: { get: vi.fn(), patch: vi.fn() },
}));
vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "MERGE-TEST" }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ buCode: "MERGE-TEST", dateFormat: "dd/MM/yyyy" }),
}));
vi.mock("@/hooks/use-chart-of-account", () => ({
  useChartOfAccountAll: () => ({
    data: [
      {
        id: "20000000-0000-4000-8000-000000000001",
        code: "6100",
        description_1: "Expense",
        is_active: true,
      },
      {
        id: "20000000-0000-4000-8000-000000000002",
        code: "1100",
        description_1: "Bank",
        is_active: true,
      },
    ],
  }),
}));
vi.mock("@/hooks/use-department", () => ({
  useDepartment: () => ({ data: { data: [] } }),
}));
vi.mock("@/hooks/use-cost-center", () => ({
  useCostCenter: () => ({ data: { data: [] } }),
}));
vi.mock("@/hooks/use-currency", () => ({
  useCurrency: () => ({
    data: {
      data: [
        {
          id: "30000000-0000-4000-8000-000000000001",
          code: "THB",
          name: "Thai Baht",
        },
      ],
    },
  }),
}));
vi.mock("@/hooks/use-accounting-master", () => ({
  useGlPeriods: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock("@/hooks/use-gl-dimensions", () => ({
  useGlDimensions: () => ({ data: [], isPending: false, isError: false }),
  useGlDimensionValues: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock("@/lib/coa-dimension-rules", () => ({
  coaRulesKey: (bu: string, account: string) => ["coa-rules", bu, account],
  readCoaRules: async () => [],
}));
vi.mock("../journal-voucher/use-journal-voucher", () => ({
  useJournalVoucher: () => ({
    data: state.journal,
    isLoading: false,
    isError: false,
  }),
  useUpdateJournalVoucher: () => ({
    mutateAsync: state.update,
    isPending: false,
  }),
  useCreateJournalVoucher: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCopyJournalVoucher: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useJournalVoucherAction: () => ({
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
  }),
}));

function journal(source = "manual"): JournalVoucher {
  return {
    id: ids.jv,
    doc_version: 7,
    display_no: "JV-TEST",
    jv_no: "JV-TEST",
    draft_reference: "DRAFT-TEST",
    jv_status: "draft",
    jv_date: "2026-11-17",
    journal_date: "2026-11-17",
    journal_type: "general",
    jv_type: "general",
    prefix: "JV",
    description: "Original header",
    note: null,
    functional_currency_id: ids.currency,
    base_currency_id: ids.currency,
    source_type: source,
    source_id: null,
    source_no: null,
    schedule_post: false,
    scheduled_post_at: null,
    auto_reverse: false,
    reverse_date: null,
    total_debit: "100.00",
    total_credit: "100.00",
    workflow_enabled_snapshot: false,
    lines: [ids.debit, ids.credit].map((account, index) => ({
      id: "line-" + index,
      sequence_no: index + 1,
      account_id: account,
      account_code: index ? "1100" : "6100",
      account_name: index ? "Bank" : "Expense",
      department_id: null,
      department_code: null,
      department_name: null,
      comment: index ? "Credit line" : "Debit line",
      currency_id: ids.currency,
      currency_code: "THB",
      exchange_rate: "1",
      rate_date: null,
      rate_type: null,
      rate_source: null,
      debit: index ? "0.00" : "100.00",
      credit: index ? "100.00" : "0.00",
      base_debit: index ? "0.00" : "100.00",
      base_credit: index ? "100.00" : "0.00",
      dimension: [],
    })),
  } as JournalVoucher;
}
function setup() {
  render(
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <TooltipProvider>
          <MemoryRouter
            initialEntries={["/accounting/journal-voucher/" + ids.jv]}
          >
            <Routes>
              <Route
                path="/accounting/journal-voucher/:id"
                element={<AccountingDocumentDetail />}
              />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </IntlProvider>,
  );
}
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.clearAllMocks();
  state.now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => state.now);
  state.journal = journal();
  vi.mocked(httpClient.patch).mockResolvedValue(
    new Response(JSON.stringify({ data: { id: ids.jv, doc_version: 8 } })),
  );
  vi.mocked(httpClient.get).mockResolvedValue(
    new Response(JSON.stringify({ data: [] })),
  );
  state.update.mockImplementation(
    async ({
      id,
      doc_version,
      ...input
    }: JournalVoucherInput & { id: string; doc_version: number }) => ({
      data: await httpJournalVoucherRepository.update(
        "MERGE-TEST",
        id,
        doc_version,
        input,
      ),
    }),
  );
});
it("saves edited manual draft lines through details.replace and keeps the concurrency version", async () => {
  setup();
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByDisplayValue("Debit line"), {
    target: { value: "Edited debit line" },
  });
  state.now = 2000;
  fireEvent.submit(document.getElementById("accounting-document-form")!);
  await waitFor(() => expect(httpClient.patch).toHaveBeenCalledOnce());
  const payload = vi.mocked(httpClient.patch).mock.calls[0][1] as {
    doc_version: number;
    details: { replace: Record<string, unknown>[] };
  };
  expect(payload.doc_version).toBe(7);
  expect(payload.details.replace).toHaveLength(2);
  expect(payload.details.replace[0]).toEqual(
    expect.objectContaining({
      chart_of_accounts_id: ids.debit,
      debit: 100,
      credit: 0,
      currency_id: ids.currency,
      exchange_rate: 1,
      description: "Edited debit line",
    }),
  );
});
it.each(["recurring", "allocation", "amortize", "reversal", "closing"])(
  "keeps %s draft lines read-only and saves only the header",
  async (source) => {
    state.journal = journal(source);
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByDisplayValue("Debit line")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add Row/i }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(window, { altKey: true, key: "a" });
    fireEvent.keyDown(window, { altKey: true, key: "b" });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Edited header" },
    });
    state.now = 2000;
    fireEvent.submit(document.getElementById("accounting-document-form")!);
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledOnce());
    const payload = vi.mocked(httpClient.patch).mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(payload).toEqual({
      doc_version: 7,
      jv_date: "2026-11-17T00:00:00.000Z",
      description: "Edited header",
      note: null,
    });
    expect(state.update.mock.calls[0][0].lines).toEqual([]);
  },
);
it("keeps subledger-generated journal drafts read-only", () => {
  state.journal = { ...journal("ap_invoice"), is_source_generated: true };
  setup();
  expect(
    screen.queryByRole("button", { name: "Edit" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Submit" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue("Debit line")).not.toBeInTheDocument();
});
