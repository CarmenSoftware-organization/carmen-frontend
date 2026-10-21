import { round2 } from "@/lib/currency-utils";

/**
 * ภาษีของบรรทัด price list — **add VAT อย่างเดียว** (ไม่มีโหมด include):
 * `price` ที่กรอกคือราคาก่อนภาษี · ภาษีบวกทับ · total = price + ภาษี
 *
 * ใช้ร่วมกันทั้ง portal vendor (`/pl/:token`) และหน้า price list ภายใน ให้ตัวเลข
 * ตรงกันทุกจอ · `price_without_tax` ยังส่งให้ backend (= price) เพื่อคงสัญญา API
 */
export function priceListTaxParts(
  price: number | string | null | undefined,
  rate: number | string | null | undefined,
) {
  const p = Number(price) || 0;
  const r = Number(rate) || 0;
  const taxAmt = round2((p * r) / 100);
  return {
    price: p,
    priceWithoutTax: p,
    taxAmt,
    total: round2(p + taxAmt),
  };
}

/** แสดง tax rate (อ่านอย่างเดียว) — ไม่มี tax profile = "—" */
export const formatTaxRate = (
  rate: number | string | null | undefined,
  hasProfile: boolean,
) => (hasProfile ? `${Number(rate) || 0}%` : "—");
