import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { expect, it, vi } from "vitest";
import { httpClient } from "@/lib/http-client";
import {
  draftLineFromRecord,
  draftLineToInput,
} from "./ar-invoice-draft-model";
import { useArRegister, useUpdateArInvoice } from "./use-ar-register";

vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "DEV" }));
vi.mock("@/lib/http-client", () => ({
  httpClient: { get: vi.fn(), put: vi.fn() },
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

it("passes AR filters and pagination to the server", async () => {
  const page = {
    data: [],
    paginate: { total: 0, page: 1, perpage: 10, pages: 0 },
  };
  vi.mocked(httpClient.get).mockResolvedValueOnce(Response.json(page));
  const { result } = renderHook(
    () =>
      useArRegister({
        page: 1,
        perpage: 10,
        filter: "doc_status|string:in_review;doc_type|string:invoice",
      }),
    { wrapper: setup() },
  );
  await waitFor(() => expect(result.current.data).toEqual(page));
  expect(httpClient.get).toHaveBeenCalledWith(
    "/api/proxy/api/DEV/ar-invoice?page=1&perpage=10&filter=doc_status%7Cstring%3Ain_review%3Bdoc_type%7Cstring%3Ainvoice",
  );
});

it("replaces edited lines using the original version and preserves existing tax, discount, and dimensions", async () => {
  vi.mocked(httpClient.put).mockResolvedValueOnce(
    Response.json({ data: { id: "doc" } }),
  );
  const { result } = renderHook(useUpdateArInvoice, { wrapper: setup() });
  const stored = {
    id: "line",
    sequence_no: 3,
    quantity: 1,
    unit_price: 100,
    total_amount: 103,
    cr_chart_of_accounts_id: "revenue",
    cr_cost_center_id: "revenue-center",
    dr_chart_of_accounts_id: "receivable",
    dr_cost_center_id: "receivable-center",
    discount_is_override: true,
    discount_amount: 4,
    vat_tax_profile_id: "vat",
    vat_is_override: true,
    vat_amount: 7,
    tb_ar_invoice_detail_dimension: [
      {
        gl_dimension_id: "dimension",
        gl_dimension_value_id: "value",
        dimension_code: "DEPT",
      },
    ],
  };
  await act(() =>
    result.current.mutateAsync({
      id: "doc",
      doc_version: 4,
      details: {
        add: [
          draftLineToInput({ ...draftLineFromRecord(stored), quantity: "2" }),
        ],
      },
    }),
  );
  expect(httpClient.put).toHaveBeenCalledWith(
    "/api/proxy/api/DEV/ar-invoice/doc",
    {
      doc_version: 4,
      details: {
        add: [
          expect.objectContaining({
            sequence_no: 3,
            quantity: "2",
            unit_price: 100,
            cr_cost_center_id: "revenue-center",
            dr_cost_center_id: "receivable-center",
            vat_tax_profile_id: "vat",
            vat_is_override: true,
            vat_amount: 7,
            discount_is_override: true,
            discount_amount: 4,
            dimensions: [
              { gl_dimension_id: "dimension", gl_dimension_value_id: "value" },
            ],
          }),
        ],
      },
    },
  );
  const submitted = vi.mocked(httpClient.put).mock.lastCall?.[1] as {
    details: { add: object[] };
  };
  expect(submitted.details.add[0]).not.toHaveProperty("id");
  expect(submitted.details.add[0]).not.toHaveProperty("total_amount");
});
