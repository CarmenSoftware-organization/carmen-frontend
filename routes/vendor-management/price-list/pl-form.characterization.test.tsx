import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import en from "@/messages/en.json";
import type { PriceList } from "@/types/price-list";
import {
  fakeMutation,
  firstPayload,
  renderForm,
  submitForm,
} from "@/lib/test-utils/form-characterization";

const navigate = vi.fn();
const createMut = fakeMutation({ data: { id: "pl-new" } });
const updateMut = fakeMutation();
const deleteMut = fakeMutation();
const voidMut = fakeMutation();
const restoreMut = fakeMutation();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("@/hooks/use-price-list", () => ({
  useCreatePriceList: () => createMut,
  useUpdatePriceList: () => updateMut,
  useDeletePriceList: () => deleteMut,
  useVoidPriceList: () => voidMut,
  useRestorePriceList: () => restoreMut,
}));
// FormToolbar ปิดปุ่ม Edit เมื่อไม่มีสิทธิ์ — เทสต์นี้สนใจเส้นทางหลัง save
// ไม่ใช่ permission ให้ผ่านหมดไปเลย
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({
    can: () => true,
    canAny: () => true,
    canAll: () => true,
    guard: (_p: unknown, fn: () => void) => fn,
    isAdmin: true,
    permissions: [],
    canWrite: true,
  }),
}));

const { PriceListForm } = await import("./pl-form");

const PRICE_LIST = {
  id: "pl-1",
  doc_version: 3,
  no: "PL-001",
  name: "Q1 Produce",
  status: "draft",
  description: "",
  vendor: { id: "ven-1", name: "Acme Foods" },
  currency: { id: "cur-1", code: "THB" },
  // getDefaultValues split ด้วย " - " แล้ว schema บังคับทั้งสองข้าง —
  // ปล่อยว่างเมื่อไร submit เงียบทันทีโดยไม่มี error โผล่บนจอ
  effectivePeriod: "2026-01-01 - 2026-03-31",
  note: "",
  pricelist_detail: [],
} as unknown as PriceList;

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * บันทึกพฤติกรรมปัจจุบันของ PriceListForm ไว้ก่อนยุบเข้า hook กลาง
 * — ไม่ได้บอกว่าถูก บอกว่าตอนนี้เป็นแบบนี้ ถ้า refactor แล้วเปลี่ยน ต้องเป็นเพราะตั้งใจ
 */
describe("PriceListForm — characterization", () => {
  async function enterEditMode() {
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
  }

  it("[update] เซฟแล้วอยู่หน้าเดิม ไม่เด้งกลับหน้ารายการ", async () => {
    renderForm(<PriceListForm priceList={PRICE_LIST} />);
    await enterEditMode();
    await act(async () => submitForm("pl-form"));

    expect(updateMut.mutate).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("[update] payload แนบ id กับ doc_version ที่โหลดมา", async () => {
    renderForm(<PriceListForm priceList={PRICE_LIST} />);
    await enterEditMode();
    await act(async () => submitForm("pl-form"));

    expect(firstPayload(updateMut)).toMatchObject({
      id: "pl-1",
      doc_version: 3,
    });
  });

  it.todo("[create] พฤติกรรมหลังสร้าง");
});

const WITH_INVALID_ROW = {
  ...PRICE_LIST,
  pricelist_detail: [
    {
      id: "d1",
      sequence_no: 1,
      product: null,
      unit: { id: "unit-1", name: "KG" },
      moq_qty: 0,
      price: 10,
      price_without_tax: 10,
      tax_profile: { id: "tax-1", name: "None" },
      tax_rate: 0,
      tax_amt: 0,
      lead_time_days: 0,
      is_preferred: false,
      is_active: true,
      description: null,
      note: null,
      info: {},
      dimension: [],
    },
  ],
} as unknown as PriceList;

describe("PriceListForm — แถวสินค้าที่ติด validate ต้องขึ้นแดง", () => {
  it("กดบันทึกแล้วช่องสินค้าของแถวนั้นถูกทำเครื่องหมายว่าไม่ถูกต้อง", async () => {
    renderForm(<PriceListForm priceList={WITH_INVALID_ROW} />);
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
    await act(async () => submitForm("pl-form"));

    // ยังไม่บันทึก เพราะติด validate
    expect(updateMut.mutate).not.toHaveBeenCalled();
    // และช่องที่ผิดต้องบอกผู้ใช้ด้วยตัวมันเอง ไม่ใช่เงียบแล้วหน้าไม่ขยับ
    expect(
      document.querySelectorAll('[aria-invalid="true"]').length,
    ).toBeGreaterThan(0);
  });
});

describe("PriceListForm — ส่วนรายการสินค้า", () => {
  const rows = () =>
    screen.queryAllByLabelText(en.vendorManagement.priceList.detail.removeItem);

  it("[view] เห็นหัวข้อ Products แต่ยังไม่มีปุ่มเพิ่ม/ปุ่มลบรายการ", () => {
    renderForm(<PriceListForm priceList={WITH_INVALID_ROW} />);

    expect(
      screen.getByText(en.vendorManagement.priceList.detail.title),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: en.common.addItem }),
    ).toBeNull();
    expect(rows()).toHaveLength(0);
  });

  it("[edit] กดเพิ่มรายการแล้วได้แถวใหม่เพิ่มมาหนึ่งแถว", async () => {
    renderForm(<PriceListForm priceList={WITH_INVALID_ROW} />);
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));

    expect(rows()).toHaveLength(1);
    await userEvent.click(
      screen.getByRole("button", { name: en.common.addItem }),
    );
    expect(rows()).toHaveLength(2);
  });

  it("[edit] กดลบแถวต้องถามยืนยันก่อน ยืนยันแล้วแถวหาย", async () => {
    renderForm(<PriceListForm priceList={WITH_INVALID_ROW} />);
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));

    await userEvent.click(rows()[0]);
    // ถามก่อน ยังไม่ลบ
    expect(
      screen.getByText(en.vendorManagement.priceList.detail.removeItemTitle),
    ).toBeTruthy();
    expect(rows()).toHaveLength(1);

    await userEvent.click(
      screen.getByRole("button", { name: en.common.delete }),
    );
    expect(rows()).toHaveLength(0);
  });

  it("[edit] ไม่มีรายการเลย → ขึ้นกล่องว่าง ไม่ใช่ตารางเปล่า", async () => {
    renderForm(<PriceListForm priceList={PRICE_LIST} />);
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));

    expect(
      screen.getByText(en.vendorManagement.priceList.detail.noItems),
    ).toBeTruthy();
    expect(rows()).toHaveLength(0);
  });
});

// หลังบ้านรับบรรทัดที่ลบเป็น `delete: string[]` — เดิมส่ง `remove: [{ id }]` ซึ่ง zod ตัดทิ้งเงียบ ๆ
// ได้ 200 แต่บรรทัดไม่ถูกลบ
describe("PriceListForm — removing a saved row", () => {
  const WITH_VALID_ROW = {
    ...WITH_INVALID_ROW,
    pricelist_detail: [
      {
        ...WITH_INVALID_ROW.pricelist_detail[0],
        product: { id: "prod-1", name: "Tomato", code: "P1" },
      },
    ],
  } as unknown as PriceList;

  it("sends the removed row ids under `delete`, not `remove`", async () => {
    renderForm(<PriceListForm priceList={WITH_VALID_ROW} />);
    await userEvent.click(screen.getByRole("button", { name: en.common.edit }));
    await userEvent.click(
      screen.getAllByLabelText(en.vendorManagement.priceList.detail.removeItem)[0],
    );
    await userEvent.click(screen.getByRole("button", { name: en.common.delete }));
    await act(async () => submitForm("pl-form"));

    const payload = firstPayload(updateMut) as {
      pricelist_detail: { delete?: string[]; remove?: unknown };
    };
    expect(payload.pricelist_detail.delete).toEqual(["d1"]);
    expect(payload.pricelist_detail).not.toHaveProperty("remove");
  });
});
