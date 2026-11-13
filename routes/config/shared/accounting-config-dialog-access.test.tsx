import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import DimensionPage from "../dimension/dimension-page";
import JvPrefixPage from "../jv-prefix/jv-prefix-page";
import BankAccountPage from "../bank-account/bank-account-page";
import AssetCategoryPage from "../asset-category/asset-category-page";
import PaymentTypePage from "../payment-type/payment-type-page";
import WhtServiceTypePage from "../wht-service-type/wht-service-type-page";
import WhtFormPage from "../wht-form/wht-form-page";
import TitleMasterPage from "../title-master/title-master-page";
import { CoamEditSheet } from "../chart-of-account-mapping/coam-edit-sheet";
import type { AccountMappingRow } from "@/types/chart-of-account-mapping";

const access = vi.hoisted(() => ({
  update: true,
  canWrite: true,
  can: vi.fn(),
}));
const base = vi.hoisted(() => ({
  id: "master",
  code: "QA",
  description: "QA Master",
  is_active: true,
  doc_version: 1,
}));
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({ canWrite: access.canWrite, can: access.can }),
}));
vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU" }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({}) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-gl-dimensions", () => ({
  useGlDimensions: () => ({
    data: [
      {
        ...base,
        code: "qa_dimension",
        name: "QA Dimension",
        sequence: 1,
        data_type: "lookup",
      },
    ],
    isLoading: false,
  }),
  useGlDimensionValues: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/hooks/use-accounting-master", () => ({
  useBankAccounts: () => ({
    data: [
      {
        ...base,
        bank_name: "QA Bank",
        account_name: "QA Account",
        account_number: "123",
        currency_code: "THB",
      },
    ],
    isLoading: false,
  }),
}));
vi.mock("@/hooks/use-chart-of-account", () => ({
  useChartOfAccount: () => ({ data: { data: [] } }),
}));
vi.mock("@/hooks/use-currency", () => ({
  useCurrency: () => ({ data: { data: [] } }),
}));
vi.mock("@/components/lookup/lookup-chart-of-account", () => ({
  LookupChartOfAccount: ({ disabled }: { disabled?: boolean }) => (
    <button disabled={disabled}>Account lookup</button>
  ),
}));
vi.mock("@/components/lookup/lookup-cost-center", () => ({
  LookupCostCenter: ({ disabled }: { disabled?: boolean }) => (
    <button disabled={disabled}>Cost Center lookup</button>
  ),
}));
vi.mock("../chart-of-account-mapping/use-account-mapping", () => ({
  useUpdateAccountMapping: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../accounting-master-mock", () => ({
  useAccountingMasterMock: () => ({
    assetCategories: [{ ...base, useful_life_years: 5 }],
    paymentTypes: [{ ...base, payment_method: "cash" }],
    whtServiceTypes: [{ ...base, default_rate: "3.00" }],
    whtForms: [{ ...base, form_type: "PND3" }],
    titles: [base],
  }),
}));
vi.mock("@/lib/http-client", () => ({
  httpClient: {
    get: vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [{ ...base, is_default: false, is_system: false }],
          }),
        ),
    ),
  },
}));

const pages = [
  {
    name: "Dimension",
    Page: DimensionPage,
    code: "qa_dimension",
    prefix: "accounting.config.gl",
  },
  {
    name: "JV Prefix",
    Page: JvPrefixPage,
    code: "QA",
    prefix: "accounting.config.gl",
  },
  {
    name: "Bank Account",
    Page: BankAccountPage,
    code: "QA Bank",
    prefix: "accounting.config.gl",
  },
  {
    name: "Asset Category",
    Page: AssetCategoryPage,
    code: "QA",
    prefix: "accounting.config.asset",
  },
  {
    name: "Payment Type",
    Page: PaymentTypePage,
    code: "QA",
    prefix: "accounting.config.ap",
  },
  {
    name: "WHT Service Type",
    Page: WhtServiceTypePage,
    code: "QA",
    prefix: "accounting.config.ap",
  },
  {
    name: "WHT Form",
    Page: WhtFormPage,
    code: "QA",
    prefix: "accounting.config.ap",
  },
  {
    name: "Title",
    Page: TitleMasterPage,
    code: "QA",
    prefix: "accounting.config",
  },
];

function renderPage(Page: React.ComponentType) {
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <IntlProvider locale="en" messages={en}>
          <Page />
        </IntlProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  access.update = true;
  access.canWrite = true;
  access.can
    .mockReset()
    .mockImplementation(
      (key: string) => key.endsWith(".update") && access.update,
    );
});

describe.each(pages)("$name list dialog", ({ Page, code, prefix }) => {
  it("opens directly in edit mode and has no Edit in the row menu", async () => {
    renderPage(Page);
    const open = await screen.findByRole("button", { name: code });
    await userEvent.click(
      screen.getAllByRole("button", { name: "Row actions" })[0],
    );
    expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(open);
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: "Save" }),
    ).toBeInTheDocument();
    expect(
      within(dialog)
        .getAllByRole("textbox")
        .some(
          (input) =>
            !(input as HTMLInputElement).disabled &&
            !input.closest("fieldset[disabled]"),
        ),
    ).toBe(true);
    expect(access.can).toHaveBeenCalledWith(`${prefix}.update`);
  });

  it.each(["permission", "license"])(
    "opens view only when %s denies editing",
    async (reason) => {
      if (reason === "permission") access.update = false;
      else access.canWrite = false;
      renderPage(Page);
      await userEvent.click(await screen.findByRole("button", { name: code }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).queryByRole("button", { name: "Save" })).toBeNull();
      expect(
        within(dialog).getAllByRole("button", {
          name: "Close",
        })[0],
      ).toBeInTheDocument();
      for (const input of within(dialog).getAllByRole("textbox"))
        expect(input).toBeDisabled();
    },
  );
});

describe("COA mapping detail", () => {
  it.each([true, false])(
    "uses edit permission for its sheet (edit=%s)",
    (allowed) => {
      access.update = allowed;
      const ref = { id: "ref", code: "REF", name: "Reference" };
      const row: AccountMappingRow = {
        ...base,
        mapping_type: "AP",
        movement: "grn",
        origin: "generated_all",
        is_reviewed: true,
        location: { ...ref, location_type: "inventory" },
        category: ref,
        sub_category: ref,
        item_group: ref,
        adjustment_type: null,
        account: {
          code: "1100",
          name: "Account",
          source: "override",
          issue: null,
        },
        cost_center: { ...ref, source: "override", issue: null },
      };
      renderPage(() => <CoamEditSheet row={row} onClose={() => {}} />);
      expect(
        screen.getByRole("button", { name: "Account lookup" }),
      ).toHaveProperty("disabled", !allowed);
      expect(
        screen.getByRole("button", { name: "Cost Center lookup" }),
      ).toHaveProperty("disabled", !allowed);
      expect(screen.queryByRole("button", { name: "Save" }) !== null).toBe(
        allowed,
      );
      expect(access.can).toHaveBeenCalledWith(
        "configuration.chart_of_account_mapping.update",
      );
    },
  );
});
