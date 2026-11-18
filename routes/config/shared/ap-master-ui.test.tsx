import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import type { ReactNode } from "react";
import en from "@/messages/en.json";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";
import { paymentTypeCrud } from "../payment-type/use-payment-type";
import { whtFormCrud } from "../wht-form/use-wht-form";
import { whtServiceTypeCrud } from "../wht-service-type/use-wht-service-type";
import { WhtServiceTypeDialog } from "../wht-service-type/wht-service-type-dialog";
import { PaymentTypeDialog } from "../payment-type/payment-type-dialog";
import {
  MasterDeleteDialog,
  MasterStatusField,
} from "./ap-master-dependencies";
import {
  masterDimensionsPayload,
  normalizeMaster,
  readMasterDependencies,
  useMasterAccountMapping,
  dependencyDetails,
} from "./ap-master-crud";

vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU" }));
vi.mock("@/lib/http-client", () => ({
  httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const id = "00000000-0000-4000-8000-000000000001";
const row = {
  id,
  code: "QA-1",
  description: "Test",
  is_active: true,
  doc_version: 2,
};
const blocked = {
  is_used: true,
  can_delete: false,
  can_deactivate: false,
  references: [{ type: "vendor", count: 1 }],
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
function fixture() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <IntlProvider locale="en" messages={en}>
        {children}
      </IntlProvider>
    </QueryClientProvider>
  );
  return { client, Wrapper };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(httpClient.get).mockImplementation(async (url) =>
    response({
      data: url.includes("dependencies") ? blocked : [],
      paginate: { total: 0, page: 1, perpage: 10, pages: 1 },
    }),
  );
  for (const method of [httpClient.post, httpClient.put, httpClient.delete])
    vi.mocked(method).mockResolvedValue(
      response({ data: { id, doc_version: 3 }, success: true }),
    );
});

describe("AP master live API contracts", () => {
  it.each([paymentTypeCrud, whtFormCrud, whtServiceTypeCrud])(
    "loads server records and forwards list parameters ($queryKey)",
    async (crud) => {
      vi.mocked(httpClient.get).mockResolvedValue(
        response({
          data: [row],
          paginate: { total: 1, page: 1, perpage: 2, pages: 1 },
        }),
      );
      const { Wrapper } = fixture();
      const { result } = renderHook(
        () =>
          crud.useList({
            search: "QA",
            page: 1,
            perpage: 2,
            filter: "is_active|boolean:true",
            sort: "code:asc",
          }),
        { wrapper: Wrapper },
      );
      await waitFor(() => expect(result.current.data?.data).toEqual([row]));
      const url = new URL(
        vi.mocked(httpClient.get).mock.calls[0][0],
        "http://test",
      );
      expect(url.pathname).toBe(crud.endpoint("BU"));
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        search: "QA",
        page: "1",
        perpage: "2",
        filter: "is_active|boolean:true",
        sort: "code:asc",
      });
    },
  );
  it("keeps server page data stable across renders for card pagination", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(
      response({
        data: [row],
        paginate: { total: 1, page: 1, perpage: 10, pages: 1 },
      }),
    );
    const { Wrapper } = fixture();
    const { result, rerender } = renderHook(
      () => whtServiceTypeCrud.useList(),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.data?.data).toEqual([row]));
    const page = result.current.data;
    rerender();
    expect(result.current.data).toBe(page);
  });
  it("preserves dimension labels and translates only writable GL references", () => {
    const saved = normalizeMaster({
      ...row,
      dimensions: [
        {
          gl_dimension_id: id,
          gl_dimension_value_id: id,
          dimension_name: "Project",
          value_code: "HQ",
        },
      ],
    });
    expect(saved).toMatchObject({
      dimensions: [
        {
          dimension_id: id,
          dimension_value_id: id,
          dimension_name: "Project",
          value_code: "HQ",
        },
      ],
    });
    expect(
      masterDimensionsPayload([
        { dimension_id: id, dimension_value_id: id, value_code: "HQ" },
        { dimension_id: id },
      ]),
    ).toEqual([{ gl_dimension_id: id, gl_dimension_value_id: id }]);
  });
  it("posts, puts and version-deletes through HTTP and invalidates the BU list", async () => {
    const { Wrapper, client } = fixture();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => ({
        create: whtServiceTypeCrud.useCreate(),
        update: whtServiceTypeCrud.useUpdate(),
        remove: whtServiceTypeCrud.useDeleteVersioned(),
      }),
      { wrapper: Wrapper },
    );
    const payload = {
      code: "QA-1",
      description: "Test",
      rate_percent: 3,
      is_active: true,
    };
    await act(async () => {
      await result.current.create.mutateAsync(payload);
    });
    expect(httpClient.post).toHaveBeenCalledWith(
      whtServiceTypeCrud.endpoint("BU"),
      payload,
    );
    const { code: _code, ...edit } = payload;
    await act(async () => {
      await result.current.update.mutateAsync({ ...edit, id, doc_version: 2 });
    });
    expect(httpClient.put).toHaveBeenCalledWith(
      `${whtServiceTypeCrud.endpoint("BU")}/${id}`,
      { ...edit, doc_version: 2 },
    );
    await act(async () => {
      result.current.remove.mutate({ id, doc_version: 3 });
    });
    await waitFor(() =>
      expect(httpClient.delete).toHaveBeenCalledWith(
        `${whtServiceTypeCrud.endpoint("BU")}/${id}?doc_version=3`,
      ),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [whtServiceTypeCrud.queryKey, "BU"],
    });
  });
  it("keeps server dependency errors and stale-version failures", async () => {
    vi.mocked(httpClient.put).mockResolvedValue(
      response(
        { message: "Changed elsewhere", code: "CONFLICT", data: blocked },
        409,
      ),
    );
    const { Wrapper } = fixture();
    const { result } = renderHook(() => whtServiceTypeCrud.useUpdate(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id,
          doc_version: 1,
          description: "Test",
          rate_percent: 3,
          is_active: false,
        }),
      ).rejects.toBeInstanceOf(ApiError);
    });
    await waitFor(() =>
      expect(dependencyDetails(result.current.error)).toEqual(blocked),
    );
  });
  it("reads server mapping rules and dependencies", async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce(
      response({
        data: {
          account: { id, code: "100", name: "Cash" },
          is_require_cost_center: false,
          default_cost_center_id: null,
          cost_centers: [],
          dimensions: [
            {
              gl_dimension_id: id,
              code: "D1",
              name: "Project",
              requirement: "optional",
            },
          ],
        },
      }),
    );
    const { Wrapper } = fixture();
    const { result } = renderHook(
      () => useMasterAccountMapping(paymentTypeCrud.endpoint, id),
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(result.current.data?.dimensions[0].dimension_id).toBe(id),
    );
    expect(httpClient.get).toHaveBeenCalledWith(
      `${paymentTypeCrud.endpoint("BU")}/account-mapping/${id}`,
    );
    expect(
      await readMasterDependencies(paymentTypeCrud.endpoint("BU"), id),
    ).toEqual(blocked);
  });
});

describe("AP master forms", () => {
  it("formats two decimals without rounding invalid precision", () => {
    const { Wrapper } = fixture();
    render(
      <Wrapper>
        <WhtServiceTypeDialog open onOpenChange={() => {}} />
      </Wrapper>,
    );
    const input = screen.getByLabelText(/Default WHT rate/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3.2" } });
    fireEvent.blur(input);
    expect(input.value).toBe("3.20");
    fireEvent.change(input, { target: { value: "3.251" } });
    fireEvent.blur(input);
    expect(input.value).toBe("3.251");
  });
  it("creates through the service-type dialog", async () => {
    const { Wrapper } = fixture();
    const close = vi.fn();
    render(
      <Wrapper>
        <WhtServiceTypeDialog open onOpenChange={close} />
      </Wrapper>,
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: /^Code/ }),
      "QA-1",
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: /^Description/ }),
      "Test service",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(httpClient.post).toHaveBeenCalledWith(
        whtServiceTypeCrud.endpoint("BU"),
        {
          code: "QA-1",
          description: "Test service",
          rate_percent: 3,
          is_active: true,
        },
      ),
    );
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  });
  it("clears cheque form and omits immutable code on edit", async () => {
    const { Wrapper } = fixture();
    render(
      <Wrapper>
        <PaymentTypeDialog
          open
          onOpenChange={() => {}}
          entity={{
            ...row,
            available_ap: true,
            available_ar: false,
            chart_of_accounts_id: id,
            dimensions: [],
            bank_account_id: null,
            is_cheque: true,
            cheque_form_id: id,
          }}
        />
      </Wrapper>,
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Cheque payment" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(httpClient.put).toHaveBeenCalledWith(
        `${paymentTypeCrud.endpoint("BU")}/${id}`,
        expect.objectContaining({
          is_cheque: false,
          cheque_form_id: null,
          doc_version: 2,
        }),
      ),
    );
    expect(vi.mocked(httpClient.put).mock.calls[0][1]).not.toHaveProperty(
      "code",
    );
  });
  it("blocks deletion and deactivation using live dependency counts", async () => {
    const { Wrapper } = fixture();
    const change = vi.fn();
    render(
      <Wrapper>
        <MasterStatusField
          entity={row}
          value
          onChange={change}
          disabled={false}
          endpoint={whtFormCrud.endpoint}
        />
      </Wrapper>,
    );
    await userEvent.click(screen.getByRole("switch", { name: "Active" }));
    await screen.findByRole("dialog");
    expect(change).not.toHaveBeenCalled();
  });
  it("does not offer Delete when dependencies prohibit it", async () => {
    const { Wrapper } = fixture();
    render(
      <Wrapper>
        <MasterDeleteDialog
          target={row}
          open
          onOpenChange={() => {}}
          endpoint={whtFormCrud.endpoint}
          remove={vi.fn()}
          isPending={false}
          error={null}
          reset={() => {}}
        />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Delete" }),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole("dialog")).toBeVisible();
  });
});
