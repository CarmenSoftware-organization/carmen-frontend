import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { QUERY_KEYS } from "@/constant/query-keys";
import { PaymentWhtSection } from "./ap-payment-wht";

const getList = vi.hoisted(() =>
  vi.fn(async () => ({
    data: [],
    paginate: { total: 0, pages: 1, page: 1, perpage: 100 },
  })),
);
vi.mock("@/lib/config-crud", () => ({ createConfigApi: () => ({ getList }) }));
vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU" }));
vi.mock("@/hooks/use-number-formatter", () => ({
  useAmountFormatter: () => (value: number) => value.toFixed(2),
}));

describe("Payment WHT editing", () => {
  it("requests active WHT profiles and recalculates amount from a manually edited base", async () => {
    const change = vi.fn();
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <IntlProvider locale="en" messages={en}>
          <PaymentWhtSection
            rows={[
              {
                key: "row",
                wht_tax_profile_id: "wht3",
                name: "Service 3%",
                rate: "3",
                base_amount: "500",
                wht_amount: "15",
                income_type: "Service fee",
                pnd_form: "pnd_53",
                is_override: false,
              },
            ]}
            editable
            calculating={false}
            stale={false}
            error={null}
            errors={new Set()}
            onChange={change}
            onAdd={() => {}}
            onRemove={() => {}}
            onRecalculate={() => {}}
          />
        </IntlProvider>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(getList).toHaveBeenCalledWith(
        "BU",
        expect.objectContaining({
          page: 1,
          filter: "tax_type|string:wht,is_active|boolean:true",
        }),
      ),
    );
    expect(
      screen.getByRole("button", { name: "Add WHT service" }),
    ).toBeDisabled();
    expect(
      await screen.findByText(
        "No active WHT profiles are configured for this business unit.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Service fee")).toBeInTheDocument();
    expect(screen.getByText("PND.53")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Base Service 3%" }), {
      target: { value: "333.33" },
    });
    expect(change).toHaveBeenCalledWith("row", {
      base_amount: "333.33",
      wht_amount: "10.00",
      is_override: true,
    });
  });

  it("refreshes an empty cached list after a tax profile is created", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
    });
    getList.mockResolvedValueOnce({
      data: [],
      paginate: { total: 0, pages: 1, page: 1, perpage: 100 },
    });
    render(
      <QueryClientProvider client={client}>
        <IntlProvider locale="en" messages={en}>
          <PaymentWhtSection
            rows={[]}
            editable
            calculating={false}
            stale={false}
            error={null}
            errors={new Set()}
            onChange={() => {}}
            onAdd={() => {}}
            onRemove={() => {}}
            onRecalculate={() => {}}
          />
        </IntlProvider>
      </QueryClientProvider>,
    );
    const add = screen.getByRole("button", { name: "Add WHT service" });
    await screen.findByText(
      "No active WHT profiles are configured for this business unit.",
    );
    expect(add).toBeDisabled();
    getList.mockResolvedValueOnce({
      data: [{ id: "service3", name: "Service 3%", tax_rate: 3 }],
      paginate: { total: 1, pages: 1, page: 1, perpage: 100 },
    } as never);
    await client.invalidateQueries({ queryKey: [QUERY_KEYS.TAX_PROFILES] });
    await waitFor(() => expect(add).toBeEnabled());
    expect(
      screen.queryByText(
        "No active WHT profiles are configured for this business unit.",
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps a new row controlled when its selected profile becomes populated", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const section = (profileId: string) => (
        <QueryClientProvider client={client}>
          <IntlProvider locale="en" messages={en}>
            <PaymentWhtSection
              rows={[
                {
                  key: "new",
                  wht_tax_profile_id: profileId,
                  name: profileId ? "Service 3%" : "",
                  rate: "3",
                  base_amount: "100",
                  wht_amount: "3",
                  pnd_form: profileId ? "pnd_53" : null,
                  is_override: true,
                },
              ]}
              editable
              calculating={false}
              stale={false}
              error={null}
              errors={new Set()}
              onChange={() => {}}
              onAdd={() => {}}
              onRemove={() => {}}
              onRecalculate={() => {}}
            />
          </IntlProvider>
        </QueryClientProvider>
      );
      const view = render(section(""));
      view.rerender(section("service3"));
      expect(screen.getByRole("combobox")).toHaveTextContent("Service 3%");
      expect(screen.getByText("PND.53")).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole("combobox")).not.toBeDisabled(),
      );
      expect(
        [...warn.mock.calls, ...error.mock.calls].flat().join(" "),
      ).not.toMatch(/uncontrolled.*controlled/);
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
