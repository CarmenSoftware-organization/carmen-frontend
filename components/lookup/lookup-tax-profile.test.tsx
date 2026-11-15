import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import type { TaxProfile, TaxProfileType } from "@/types/tax-profile";
import type { ParamsDto } from "@/types/params";
import { LookupTaxProfile } from "./lookup-tax-profile";

const getList = vi.hoisted(() => vi.fn());
vi.mock("@/lib/config-crud", () => ({
  createConfigApi: () => ({ getList }),
}));
vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU" }));

const inactive: TaxProfile = {
  id: "inactive-wht",
  name: "Retired WHT 3%",
  tax_rate: 3,
  tax_type: "wht",
  is_active: false,
  doc_version: 1,
};

function renderLookup({
  value = "",
  taxType,
  onValueChange = vi.fn(),
}: {
  value?: string;
  taxType?: TaxProfileType;
  onValueChange?: () => void;
} = {}) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <IntlProvider locale="en" messages={en}>
        <LookupTaxProfile
          value={value}
          taxType={taxType}
          onValueChange={onValueChange}
        />
      </IntlProvider>
    </QueryClientProvider>,
  );
}

describe("LookupTaxProfile tax kinds", () => {
  beforeEach(() => {
    getList.mockReset();
    getList.mockImplementation(async (_bu: string, params: ParamsDto) => ({
      data: params.filter === `id|string:${inactive.id}` ? [inactive] : [],
      paginate: { total: 0, pages: 1, page: 1, perpage: 30 },
    }));
  });

  it.each([
    { taxType: undefined, expected: "vat" },
    { taxType: "wht" as const, expected: "wht" },
  ])(
    "requests only active $expected profiles",
    async ({ taxType, expected }) => {
      renderLookup({ taxType });
      expect(getList).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button"));
      await waitFor(() =>
        expect(getList).toHaveBeenCalledWith(
          "BU",
          expect.objectContaining({
            page: 1,
            filter: `tax_type|string:${expected},is_active|boolean:true`,
          }),
        ),
      );
    },
  );

  it("resolves a saved inactive selection without the active/type list filters", async () => {
    const change = vi.fn();
    renderLookup({ value: inactive.id, taxType: "wht", onValueChange: change });
    const trigger = await screen.findByRole("button", { name: inactive.name });
    expect(getList).toHaveBeenCalledWith("BU", {
      perpage: 1,
      filter: `id|string:${inactive.id}`,
    });
    fireEvent.click(trigger);
    await waitFor(() =>
      expect(getList).toHaveBeenCalledWith(
        "BU",
        expect.objectContaining({
          filter: "tax_type|string:wht,is_active|boolean:true",
        }),
      ),
    );
    await waitFor(() => expect(trigger).toHaveTextContent(inactive.name));
    expect(change).not.toHaveBeenCalled();
  });
});
