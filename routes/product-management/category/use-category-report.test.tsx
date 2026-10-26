import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { httpClient } from "@/lib/http-client";
import { ApiError } from "@/lib/api-error";

vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU1" }));
vi.mock("@/lib/http-client", () => ({ httpClient: { post: vi.fn() } }));
const print = vi.fn();
vi.mock("@/hooks/use-print-document", () => ({
  usePrintDocument: () => ({ print, isPrinting: false }),
}));
const toast = vi.hoisted(() => ({
  loading: vi.fn(() => "t1"),
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

const { useCategoryReport } = await import("./use-category-report");

const TEMPLATE = "eda55615-08e0-4fc0-941e-c62dc8072e49";
const FILTERS = {
  CategoryFrom: "1",
  CategoryTo: "2",
  SubCategoryFrom: "ALL",
  SubCategoryTo: "ALL",
  ItemGroupFrom: "ALL",
  ItemGroupTo: "ALL",
};

function setup() {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return renderHook(() => useCategoryReport(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={qc}>
        <IntlProvider locale="en" messages={en}>
          {children}
        </IntlProvider>
      </QueryClientProvider>
    ),
  });
}

const csvResponse = (rowCount: string) =>
  ({
    ok: true,
    status: 200,
    blob: async () => new Blob(["a,b"]),
    headers: new Headers({
      "content-disposition":
        'attachment; filename="product_category_20261026_120000.csv"',
      "x-row-count": rowCount,
    }),
  }) as unknown as Response;

describe("useCategoryReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
  });

  it("print ส่ง template ของรายงาน + ช่วงรหัสไปที่ viewer", async () => {
    print.mockResolvedValue({ url: "https://viewer" });
    const { result } = setup();
    let ok = false;
    await act(async () => {
      ok = await result.current.printReport(FILTERS);
    });
    expect(print).toHaveBeenCalledWith("PRODUCT_CATEGORY", {
      templateId: TEMPLATE,
      filters: FILTERS,
    });
    expect(ok).toBe(true);
  });

  it("print ไม่สำเร็จ (hook แสดง error เอง) → false ให้ dialog ค้างไว้", async () => {
    print.mockResolvedValue(null);
    const { result } = setup();
    let ok = true;
    await act(async () => {
      ok = await result.current.printReport(FILTERS);
    });
    expect(ok).toBe(false);
  });

  it("export ยิง /reports/export แล้วดาวน์โหลดไฟล์ตามชื่อจาก server", async () => {
    vi.mocked(httpClient.post).mockResolvedValue(csvResponse("12"));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const { result } = setup();
    let ok = false;
    await act(async () => {
      ok = await result.current.exportReport(FILTERS);
    });

    expect(httpClient.post).toHaveBeenCalledWith(
      "/api/proxy/api/BU1/reports/export",
      {
        template_id: TEMPLATE,
        filters: FILTERS,
      },
    );
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      "product_category_20261026_120000.csv",
    );
    expect(toast.success).toHaveBeenCalled();
    expect(ok).toBe(true);
    click.mockRestore();
  });

  it("export ได้ 0 แถว → แจ้งไม่มีข้อมูล ไม่ดาวน์โหลด", async () => {
    vi.mocked(httpClient.post).mockResolvedValue(csvResponse("0"));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const { result } = setup();
    let ok = true;
    await act(async () => {
      ok = await result.current.exportReport(FILTERS);
    });
    expect(click).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith(en.report.exportNoData, {
      id: "t1",
    });
    expect(ok).toBe(false);
    click.mockRestore();
  });

  it("template ยังไม่ลง BU นี้ → บอกตรง ๆ แทนข้อความกลาง", async () => {
    vi.mocked(httpClient.post).mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);
    vi.spyOn(ApiError, "from").mockResolvedValue(
      new ApiError(
        "FORBIDDEN",
        "x",
        403,
        false,
        undefined,
        undefined,
        "REPORT_TEMPLATE_UNAVAILABLE",
      ),
    );
    const { result } = setup();
    await act(async () => {
      await result.current.exportReport(FILTERS);
    });
    expect(toast.error).toHaveBeenCalledWith(en.report.unavailableForBu, {
      id: "t1",
    });
  });

  it("export พังแบบอื่น → ข้อความกลาง", async () => {
    vi.mocked(httpClient.post).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    const { result } = setup();
    await act(async () => {
      await result.current.exportReport(FILTERS);
    });
    expect(toast.error).toHaveBeenCalledWith(en.report.exportError, {
      id: "t1",
    });
  });
});
