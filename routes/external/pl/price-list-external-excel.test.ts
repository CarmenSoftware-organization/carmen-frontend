import { describe, it, expect } from "vitest";
import { applyExcelRows } from "./price-list-external-excel";
import type {
  PricelistExternalDetailDto,
  PricelistExternalTaxProfileOption,
} from "@/types/price-list-external";

const TAX_PROFILES: PricelistExternalTaxProfileOption[] = [
  { id: "tp7", name: "VAT 7%", tax_rate: 7, is_active: true },
  { id: "tp0", name: "No Tax", tax_rate: 0, is_active: true },
];

function detail(
  over: Partial<PricelistExternalDetailDto> & { sequence_no: number },
): PricelistExternalDetailDto {
  return {
    id: `id-${over.sequence_no}`,
    product_id: "p",
    product_code: "C",
    product_name: "N",
    unit_id: "u",
    unit_name: "kg",
    moq_qty: 1,
    price_without_tax: 0,
    tax_amt: 0,
    price: 0,
    tax_profile_id: "tp",
    tax_profile_name: null,
    tax_rate: 0,
    lead_time_days: 0,
    is_active: true,
    is_preferred: false,
    note: null,
    moq_tiers: [],
    ...over,
  };
}

describe("applyExcelRows", () => {
  it("จับคู่ Product Code + Tax Profile (ชื่อ) → id + rate แล้วคำนวณ tax_amt แบบ add VAT", () => {
    const details = [
      detail({ sequence_no: 1, product_code: "SUG01" }),
      detail({ sequence_no: 2, product_code: "FLR01" }),
    ];
    const result = applyExcelRows(
      [
        {
          "Product Code": "SUG01",
          "MOQ Qty": 5,
          Price: 100,
          "Tax Profile": "VAT 7%",
          Note: "hi",
        },
      ],
      details,
      TAX_PROFILES,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.updated[0]).toMatchObject({
      moq_qty: 5,
      // price = ก่อนภาษี → price_without_tax เท่ากัน, ภาษีบวกทับ
      price: 100,
      tax_profile_id: "tp7",
      tax_profile_name: "VAT 7%",
      tax_rate: 7,
      price_without_tax: 100,
      tax_amt: 7,
      note: "hi",
    });
    // แถวที่ไม่มีใน excel คงเดิม
    expect(result.updated[1].price).toBe(0);
  });

  it("match ตามตัวสินค้า ไม่ใช่ตำแหน่ง — สลับลำดับแถวก็เข้าถูกตัว", () => {
    const details = [
      detail({ sequence_no: 1, product_code: "SUG01" }),
      detail({ sequence_no: 2, product_code: "FLR01" }),
    ];
    const result = applyExcelRows(
      [
        { "Product Code": "FLR01", Price: 20 },
        { "Product Code": "SUG01", Price: 10 },
      ],
      details,
      TAX_PROFILES,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated[0].price).toBe(10); // SUG01
    expect(result.updated[1].price).toBe(20); // FLR01
  });

  it("ไม่มี header ที่ต้องใช้ → reason structure (ไฟล์มั่ว)", () => {
    const result = applyExcelRows(
      [{ Foo: 1, Bar: 2 }],
      [detail({ sequence_no: 1, product_code: "SUG01" })],
      TAX_PROFILES,
    );
    expect(result).toEqual({ ok: false, reason: "structure" });
  });

  it("โครงถูกแต่ไม่มี code ไหน match → reason no-match (ไฟล์ของ list อื่น)", () => {
    const result = applyExcelRows(
      [{ "Product Code": "OTHER99", Price: 50 }],
      [detail({ sequence_no: 1, product_code: "SUG01" })],
      TAX_PROFILES,
    );
    expect(result).toEqual({ ok: false, reason: "no-match" });
  });

  it("code ที่หาไม่เจอปนมา = skipped (แต่ไฟล์ยัง ok ถ้ามีตัว match)", () => {
    const details = [detail({ sequence_no: 1, product_code: "SUG01" })];
    const result = applyExcelRows(
      [
        { "Product Code": "SUG01", Price: 10 },
        { "Product Code": "GHOST", Price: 99 },
      ],
      details,
      TAX_PROFILES,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("Tax Profile ที่ไม่รู้จัก/ว่าง → คงค่า tax เดิม", () => {
    const details = [
      detail({
        sequence_no: 1,
        product_code: "SUG01",
        tax_profile_id: "old",
        tax_profile_name: "Old",
        tax_rate: 10,
      }),
    ];
    const result = applyExcelRows(
      [{ "Product Code": "SUG01", Price: 100, "Tax Profile": "ไม่มีจริง" }],
      details,
      TAX_PROFILES,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated[0]).toMatchObject({
      tax_profile_id: "old",
      tax_rate: 10,
    });
  });

  it("ช่องว่างคงค่าเดิม ไม่ล้าง", () => {
    const details = [
      detail({
        sequence_no: 1,
        product_code: "SUG01",
        price: 42,
        moq_qty: 3,
        note: "keep",
      }),
    ];
    const result = applyExcelRows(
      [{ "Product Code": "SUG01", Price: "", "MOQ Qty": "", Note: "" }],
      details,
      TAX_PROFILES,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated[0]).toMatchObject({
      price: 42,
      moq_qty: 3,
      note: "keep",
    });
  });

  it("Tax Profile = No Tax (rate 0) → pwt = price, tax_amt = 0", () => {
    const result = applyExcelRows(
      [{ "Product Code": "SUG01", Price: 80, "Tax Profile": "No Tax" }],
      [detail({ sequence_no: 1, product_code: "SUG01" })],
      TAX_PROFILES,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated[0]).toMatchObject({
      price: 80,
      tax_profile_id: "tp0",
      price_without_tax: 80,
      tax_amt: 0,
    });
  });
});
