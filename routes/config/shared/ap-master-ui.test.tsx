import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import type {
  PaymentTypeMaster,
  WhtFormMaster,
} from "@/types/accounting-master";
import { PaymentTypeDialog } from "../payment-type/payment-type-dialog";
import { WhtFormDialog } from "../wht-form/wht-form-dialog";
import { WhtServiceTypeDialog } from "../wht-service-type/wht-service-type-dialog";
import { paymentTypeCrud } from "../payment-type/use-payment-type";
import { whtFormCrud } from "../wht-form/use-wht-form";
import { whtServiceTypeCrud } from "../wht-service-type/use-wht-service-type";
import { MasterDeleteDialog } from "./ap-master-dependencies";
import { dependencyDetails } from "./ap-master-crud";
import {
  initialMockMasters,
  MOCK_ACCOUNTS,
  mockAccountDefaults,
  mockChequeForm,
  mockDependencies,
  mockMasterPage,
} from "./ap-master-mock-data";

vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU" }));
vi.mock("@/lib/http-client", () => ({
  httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

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
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  for (const method of [
    httpClient.get,
    httpClient.post,
    httpClient.put,
    httpClient.delete,
  ])
    expect(method).not.toHaveBeenCalled();
});

describe("AP master session mockups", () => {
  it("loads the three HTML sample collections without requests", () => {
    const { Wrapper } = fixture();
    const { result } = renderHook(
      () => ({
        payment: paymentTypeCrud.useList(),
        form: whtFormCrud.useList(),
        service: whtServiceTypeCrud.useList(),
      }),
      { wrapper: Wrapper },
    );
    expect(result.current.payment.data.paginate.total).toBe(5);
    expect(result.current.form.data.paginate.total).toBe(4);
    expect(result.current.service.data.paginate.total).toBe(6);
  });
  it("keeps page data stable across renders so card pagination does not loop", () => {
    const { Wrapper } = fixture();
    const { result, rerender } = renderHook(
      () => whtServiceTypeCrud.useList({ page: 1, perpage: 2 }),
      { wrapper: Wrapper },
    );
    const first = result.current.data;
    rerender();
    expect(result.current.data).toBe(first);
  });
  it("creates, updates and deletes samples in the session; a fresh session starts from HTML samples", async () => {
    const { Wrapper } = fixture();
    const { result } = renderHook(
      () => ({
        list: whtServiceTypeCrud.useList(),
        create: whtServiceTypeCrud.useCreate(),
        update: whtServiceTypeCrud.useUpdate(),
        remove: whtServiceTypeCrud.useDeleteVersioned(),
      }),
      { wrapper: Wrapper },
    );
    let created!: { id: string; doc_version: number };
    await act(async () => {
      created = await result.current.create.mutateAsync({
        code: " qa-7 ",
        description: "Preview service",
        rate_percent: 3.25,
        is_active: true,
      });
    });
    await waitFor(() =>
      expect(
        result.current.list.data.data.find((row) => row.id === created.id)
          ?.code,
      ).toBe("QA-7"),
    );
    await act(async () => {
      await result.current.update.mutateAsync({
        ...created,
        description: "Edited preview",
        rate_percent: 5,
        is_active: false,
      });
    });
    await waitFor(() =>
      expect(
        result.current.list.data.data.find((row) => row.id === created.id),
      ).toMatchObject({
        description: "Edited preview",
        rate_percent: 5,
        is_active: false,
        doc_version: 1,
      }),
    );
    await act(async () => {
      await result.current.remove.mutateAsync({
        id: created.id,
        doc_version: 1,
      });
    });
    await waitFor(() =>
      expect(result.current.list.data.paginate.total).toBe(6),
    );
    const other = fixture();
    const fresh = renderHook(() => whtServiceTypeCrud.useList(), {
      wrapper: other.Wrapper,
    });
    expect(fresh.result.current.data.paginate.total).toBe(6);
  });
  it("rejects duplicate/immutable codes and stale edits without changing the collection", async () => {
    const { Wrapper } = fixture();
    const { result } = renderHook(
      () => ({
        list: whtServiceTypeCrud.useList(),
        create: whtServiceTypeCrud.useCreate(),
        update: whtServiceTypeCrud.useUpdate(),
      }),
      { wrapper: Wrapper },
    );
    const row = result.current.list.data.data[0];
    await act(async () => {
      await expect(
        result.current.create.mutateAsync({
          code: "01",
          description: "Duplicate",
          rate_percent: 3,
          is_active: true,
        }),
      ).rejects.toThrow("already exists");
    });
    await act(async () => {
      await expect(
        result.current.update.mutateAsync({
          id: row.id,
          doc_version: 9,
          description: row.description,
          rate_percent: 3,
          is_active: true,
        }),
      ).rejects.toThrow("changed");
    });
    await act(async () => {
      await expect(
        result.current.update.mutateAsync({
          id: row.id,
          doc_version: 0,
          code: "NEW",
          description: row.description,
          rate_percent: 3,
          is_active: true,
        }),
      ).rejects.toThrow("cannot be changed");
    });
    expect(result.current.list.data.paginate.total).toBe(6);
  });
  it("protects referenced samples even when a mutation bypasses the form precheck", async () => {
    const { Wrapper } = fixture();
    const { result } = renderHook(
      () => ({
        list: whtServiceTypeCrud.useList(),
        update: whtServiceTypeCrud.useUpdate(),
        remove: whtServiceTypeCrud.useDeleteVersioned(),
      }),
      { wrapper: Wrapper },
    );
    const row = result.current.list.data.data[0];
    await act(async () => {
      await expect(
        result.current.update.mutateAsync({
          id: row.id,
          doc_version: 0,
          description: row.description,
          rate_percent: 3,
          is_active: false,
        }),
      ).rejects.toBeInstanceOf(Error);
      await expect(
        result.current.remove.mutateAsync({ id: row.id, doc_version: 0 }),
      ).rejects.toBeInstanceOf(Error);
    });
    await waitFor(() =>
      expect(
        dependencyDetails(result.current.remove.error)?.references,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "ap_payment", count: 11 }),
        ]),
      ),
    );
    expect(result.current.list.data.data[0].is_active).toBe(true);
  });
  it("supports rate search, status filter, numeric rate sort and pagination", () => {
    const rows = initialMockMasters("wht-service-types");
    expect(
      mockMasterPage(rows, { search: "5.00" }).data.map((row) => row.code),
    ).toEqual(["02"]);
    expect(
      mockMasterPage(rows, { filter: "is_active|bool:false" }).data.map(
        (row) => row.code,
      ),
    ).toEqual(["06"]);
    expect(
      mockMasterPage(rows, { sort: "rate_percent:desc", page: 1, perpage: 1 }),
    ).toMatchObject({
      data: [{ code: "02" }],
      paginate: { total: 6, pages: 6 },
    });
  });
});

describe("HTML accounting defaults and form behavior", () => {
  it("replaces Cost Center/dimension defaults per GL account and resolves the bank cheque template", () => {
    expect(
      mockAccountDefaults(MOCK_ACCOUNTS[7].id).dimensions.map(
        (item) => item.dimension_code,
      ),
    ).toEqual(["D1", "D4", "D6"]);
    expect(
      mockAccountDefaults(MOCK_ACCOUNTS[8].id).dimensions.map(
        (item) => item.dimension_code,
      ),
    ).toEqual(["D1", "D3", "D6"]);
    expect(mockAccountDefaults(null)).toEqual({
      chart_of_accounts_id: null,
      cost_center_id: null,
      dimensions: [],
    });
    expect(mockChequeForm(MOCK_ACCOUNTS[1].bank_account_id)).not.toBeNull();
    expect(mockDependencies("wht-forms", "53")).toMatchObject({
      can_delete: false,
      can_deactivate: true,
    });
    expect(mockDependencies("payment-types", "CHQ-KBANK")).toMatchObject({
      can_delete: true,
    });
  });
  it("formats two decimals without silently rounding invalid precision", () => {
    const { Wrapper } = fixture();
    render(
      <Wrapper>
        <WhtServiceTypeDialog open onOpenChange={() => {}} />
      </Wrapper>,
    );
    const input = screen.getByLabelText(/Default WHT rate/) as HTMLInputElement;
    expect(input.value).toBe("3.00");
    fireEvent.change(input, { target: { value: "3.2" } });
    fireEvent.blur(input);
    expect(input.value).toBe("3.20");
    fireEvent.change(input, { target: { value: "3.251" } });
    fireEvent.blur(input);
    expect(input.value).toBe("3.251");
  });
  it("shows sample dependency names and keeps a referenced form active", async () => {
    const { Wrapper } = fixture();
    const row = initialMockMasters("wht-forms").find(
      (item) => item.code === "3",
    ) as WhtFormMaster;
    render(
      <Wrapper>
        <WhtFormDialog open onOpenChange={() => {}} entity={row} />
      </Wrapper>,
    );
    const toggle = screen.getByRole("switch", { name: "Active" });
    await userEvent.click(toggle);
    expect(
      await screen.findByText("VEND-001 (Siam Fresh Supplies)"),
    ).toBeVisible();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Close" }).at(-1)!,
    );
    expect(toggle).toBeChecked();
    expect(screen.getByRole("textbox", { name: /^Code/ })).toBeDisabled();
  });
  it("uses named read-only mappings rather than UUID input fields", () => {
    const { Wrapper } = fixture();
    const row = initialMockMasters("wht-forms").find(
      (item) => item.code === "53",
    ) as WhtFormMaster;
    render(
      <Wrapper>
        <WhtFormDialog open readOnly onOpenChange={() => {}} entity={row} />
      </Wrapper>,
    );
    expect(screen.getByText(/2191-053/)).toBeVisible();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByText(/PRJ-HQ/)).toBeVisible();
  });
  it("clears a sample cheque form when cheque payment is turned off", async () => {
    const { Wrapper } = fixture();
    const list = renderHook(() => paymentTypeCrud.useList(), {
      wrapper: Wrapper,
    });
    const row = initialMockMasters("payment-types").find(
      (item) => item.code === "CHQ-BBL",
    );
    render(
      <Wrapper>
        <PaymentTypeDialog
          open
          onOpenChange={() => {}}
          entity={row as PaymentTypeMaster}
        />
      </Wrapper>,
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Cheque payment" }),
    );
    expect(screen.queryByText("Cheque form")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(
        list.result.current.data.data.find((item) => item.code === "CHQ-BBL"),
      ).toMatchObject({
        is_cheque: false,
        cheque_form_id: null,
        doc_version: 1,
      }),
    );
  });
  it("blocks protected deletion with the same HTML dependency explanation", async () => {
    const { Wrapper } = fixture();
    const row = initialMockMasters("wht-service-types")[0];
    render(
      <Wrapper>
        <MasterDeleteDialog
          target={row}
          open
          onOpenChange={() => {}}
          endpoint={whtServiceTypeCrud.endpoint}
          remove={vi.fn()}
          isPending={false}
          error={null}
          reset={() => {}}
        />
      </Wrapper>,
    );
    expect(await screen.findByText("BANGKOK SUPPLIER CO., LTD.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });
});
