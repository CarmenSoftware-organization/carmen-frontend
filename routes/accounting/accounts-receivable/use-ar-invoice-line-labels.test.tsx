import { renderHook, render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { beforeEach, expect, it, vi } from "vitest";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import messages from "@/messages/en.json";
import { useArInvoiceLineLabels } from "./use-ar-invoice-line-labels";
import { ArInvoiceLines } from "./ar-invoice-lines";
import { draftLineToInput, type ArDraftLine } from "./ar-invoice-draft-model";

const masters = vi.hoisted(() => ({
  chart_of_accounts: [
    { id: "revenue", code: "4110000", name: "Room sales" },
    { id: "ar", code: "1130000", name: "Trade AR" },
    { id: "tax", code: "2151000", name: "Output VAT" },
  ],
  cost_center: [
    { id: "rooms", code: "CC100", name: "Rooms" },
    { id: "general", code: "GEN", name: "General" },
  ],
  tax_profile: [{ id: "vat", code: "VAT7", name: "VAT 7%", tax_rate: 7 }],
}));
vi.mock("@/hooks/use-lookup-resource", () => ({
  useLookupResource: vi.fn((resource: keyof typeof masters) => ({
    selectedItems: masters[resource],
  })),
}));
vi.mock("@/hooks/use-number-formatter", () => ({
  useAmountFormatter: () => (value: number) => value.toFixed(2),
}));
const line: ArDraftLine = {
  id: "line",
  sequence_no: 1,
  description: "Room charge",
  quantity: 1,
  unit_price: 100,
  cr_chart_of_accounts_id: "revenue",
  cr_account_code: null,
  cr_cost_center_id: "rooms",
  cr_cost_center_code: null,
  dr_chart_of_accounts_id: "ar",
  dr_account_code: null,
  dr_cost_center_id: "general",
  vat_tax_profile_id: "vat",
  vat_rate: 7,
  vat_chart_of_accounts_id: "tax",
  vat_cost_center_id: "general",
};
beforeEach(() => vi.clearAllMocks());
it("resolves null API labels with one deduplicated selected-ID batch per master", () => {
  const { result } = renderHook(() =>
    useArInvoiceLineLabels([line, { ...line, id: "line2", sequence_no: 2 }]),
  );
  expect(useLookupResource).toHaveBeenCalledTimes(3);
  expect(useLookupResource).toHaveBeenCalledWith("cost_center", {
    search: "",
    enabled: false,
    selectedIds: ["rooms", "general"],
  });
  expect(useLookupResource).toHaveBeenCalledWith("chart_of_accounts", {
    search: "",
    enabled: false,
    selectedIds: ["revenue", "ar", "tax"],
  });
  expect(useLookupResource).toHaveBeenCalledWith("tax_profile", {
    search: "",
    enabled: false,
    selectedIds: ["vat"],
  });
  expect(result.current.lines[0]).toMatchObject({
    cr_cost_center_code: "CC100",
    dr_cost_center_code: "GEN",
    cr_account_code: "4110000",
    dr_account_code: "1130000",
    vat_account_code: "2151000",
    vat_cost_center_code: "GEN",
    vat_profile_name: "VAT 7%",
    vat_rate: 7,
  });
  expect(draftLineToInput(result.current.lines[0])).toMatchObject({
    cr_cost_center_id: "rooms",
    dr_cost_center_id: "general",
    cr_chart_of_accounts_id: "revenue",
    vat_tax_profile_id: "vat",
  });
  expect(line.cr_cost_center_code).toBeNull();
});
it("keeps response labels and tax-rate snapshots when masters have changed", () => {
  const { result } = renderHook(() =>
    useArInvoiceLineLabels([
      {
        ...line,
        cr_cost_center_code: "HISTORIC",
        cr_account_code: "OLD-4110",
        vat_rate: 5,
      },
    ]),
  );
  expect(result.current.lines[0]).toMatchObject({
    cr_cost_center_code: "HISTORIC",
    cr_account_code: "OLD-4110",
    vat_rate: 5,
  });
});
it("shows the saved cost-center and account labels when the invoice response codes are null", () => {
  render(
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <ArInvoiceLines lines={[line]} />
    </IntlProvider>,
  );
  expect(screen.getByText("Revenue cost center: CC100")).toBeVisible();
  expect(screen.getByText("Revenue account: 4110000")).toBeVisible();
});
