import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { LookupProduct } from "./lookup-product";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/http-client", () => ({ httpClient: { get } }));
vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU" }));

function renderLookup(usedInRecipe?: boolean) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <IntlProvider locale="en" messages={en}>
        <LookupProduct
          value=""
          usedInRecipe={usedInRecipe}
          onValueChange={vi.fn()}
        />
      </IntlProvider>
    </QueryClientProvider>,
  );
}

/** query string ของ request รายการแรก (ถอด %3A ให้อ่านง่าย) */
async function firstListParams() {
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(get).toHaveBeenCalled());
  const url = String(get.mock.calls[0][0]);
  expect(url).toContain("/product");
  return new URL(url, "http://x").searchParams;
}

describe("LookupProduct usedInRecipe", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            data: [],
            paginate: { total: 0, pages: 1, page: 1, perpage: 30 },
          }),
          { status: 200 },
        ),
    );
  });

  it("asks the server only for products ticked as usable in a recipe", async () => {
    renderLookup(true);
    const params = await firstListParams();
    expect(params.get("filter")).toBe("is_used_in_recipe:true");
  });

  it("sends no recipe filter elsewhere", async () => {
    renderLookup();
    const params = await firstListParams();
    expect(params.get("filter")).toBeNull();
  });
});
