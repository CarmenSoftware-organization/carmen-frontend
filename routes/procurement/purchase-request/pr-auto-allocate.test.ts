import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseFormReturn } from "react-hook-form";
import { httpClient } from "@/lib/http-client";
import { runPrAutoAllocate } from "./pr-auto-allocate";
import { PR_ITEM, type PrFormValues } from "./pr-form-schema";

vi.mock("@/lib/http-client", () => ({ httpClient: { get: vi.fn() } }));
vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const msg = {
  allocating: () => "",
  allocated: () => "",
  allocateFailed: () => "",
  noPriceListFound: "",
};

function formWith(items: Partial<PrFormValues["items"][number]>[]) {
  const values = {
    items: items.map((over) => ({
      ...PR_ITEM,
      product_id: "prd-1",
      requested_unit_id: "unit-kg",
      currency_id: "cur-thb",
      delivery_date: "2026-10-17",
      ...over,
    })),
  };
  return {
    getValues: (name: string) => (name === "items" ? values.items : undefined),
    setValue: vi.fn(),
  } as unknown as UseFormReturn<PrFormValues>;
}

function requestedQtyParam() {
  const url = new URL(
    vi.mocked(httpClient.get).mock.calls[0][0] as string,
    "http://x",
  );
  return url.searchParams.get("qty");
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(httpClient.get).mockResolvedValue(
    new Response(JSON.stringify({ data: { selected: null, lists: [] } })),
  );
});

// ราคาขั้นบันได MOQ: ไม่ส่งจำนวนไป backend จะคืน tier ถูกสุด (เช่น ขั้นต่ำ 10)
// ทั้งที่ approve ไว้ไม่ถึง — ต้องส่งจำนวนตัวเดียวกับที่ใช้คิดยอด
describe("runPrAutoAllocate — qty ที่ส่งไปเทียบราคา", () => {
  it("ส่ง approved_qty เมื่อมีการ approve แล้ว", async () => {
    await runPrAutoAllocate(
      formWith([{ requested_qty: 12, approved_qty: 6 }]),
      "BU",
      msg,
    );

    expect(requestedQtyParam()).toBe("6");
  });

  it("ตกไปใช้ requested_qty เมื่อยังไม่มี approved_qty", async () => {
    await runPrAutoAllocate(
      formWith([{ requested_qty: 4, approved_qty: 0 }]),
      "BU",
      msg,
    );

    expect(requestedQtyParam()).toBe("4");
  });

  it("ไม่ส่ง qty เลยเมื่อยังไม่กรอกจำนวน (ไม่ใช่ qty=0)", async () => {
    await runPrAutoAllocate(
      formWith([{ requested_qty: 0, approved_qty: 0 }]),
      "BU",
      msg,
    );

    expect(requestedQtyParam()).toBeNull();
  });
});
