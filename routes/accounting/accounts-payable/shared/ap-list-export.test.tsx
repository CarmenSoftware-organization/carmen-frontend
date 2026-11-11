import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { downloadXlsx } from "@/lib/xlsx-utils";
import { httpApRepository } from "./ap-http-repository";
import {
  useExportApInvoices,
  useExportApPayments,
} from "./use-accounts-payable";

vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "DEV" }));
vi.mock("./ap-http-repository", () => ({
  httpApRepository: { listInvoices: vi.fn(), listPayments: vi.fn() },
}));
vi.mock("@/lib/xlsx-utils", () => ({
  downloadXlsx: vi.fn(),
  buildXlsxFileName: (prefix: string) => prefix,
}));
beforeEach(() => vi.clearAllMocks());

it("exports every filtered invoice page while preserving decimal values", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({
    id: String(index),
    total_amount: "123456789012345.12345",
  }));
  vi.mocked(httpApRepository.listInvoices)
    .mockResolvedValueOnce({
      data: rows.slice(0, 100),
      paginate: { page: 1, perpage: 100, pages: 2, total: 101 },
    } as never)
    .mockResolvedValueOnce({
      data: rows.slice(100),
      paginate: { page: 2, perpage: 100, pages: 2, total: 101 },
    } as never);
  const { result } = renderHook(useExportApInvoices);
  const params = {
    search: "Supplier",
    filter: "doc_status|string:draft",
    sort: "doc_date:desc",
    page: 8,
    perpage: 10,
  };
  await act(async () => {
    expect(
      await result.current.exportInvoices(params, [
        { header: "Amount", value: (row) => row.total_amount },
      ]),
    ).toBe(101);
  });
  expect(httpApRepository.listInvoices).toHaveBeenNthCalledWith(1, "DEV", {
    ...params,
    page: 1,
    perpage: 100,
  });
  expect(httpApRepository.listInvoices).toHaveBeenNthCalledWith(2, "DEV", {
    ...params,
    page: 2,
    perpage: 100,
  });
  const exported = vi.mocked(downloadXlsx).mock.calls[0][0];
  expect(exported.rows).toEqual(rows);
  expect(exported.columns[0].value(rows[0], 0)).toBe("123456789012345.12345");
  expect(result.current.isExporting).toBe(false);
});

it("keeps the approval queue filter and rejects an incomplete payment export", async () => {
  vi.mocked(httpApRepository.listPayments)
    .mockResolvedValueOnce({
      data: [{ id: "payment" }],
      paginate: { page: 1, perpage: 100, pages: 2, total: 101 },
    } as never)
    .mockRejectedValueOnce(new Error("Second page failed"));
  const { result } = renderHook(useExportApPayments);
  const filter = "doc_status|string:in_review";
  await act(async () => {
    await expect(result.current.exportPayments({ filter }, [])).rejects.toThrow(
      "Second page failed",
    );
  });
  expect(httpApRepository.listPayments).toHaveBeenNthCalledWith(2, "DEV", {
    filter,
    page: 2,
    perpage: 100,
  });
  expect(downloadXlsx).not.toHaveBeenCalled();
  expect(result.current.isExporting).toBe(false);
});
