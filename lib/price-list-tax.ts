import { round2 } from "@/lib/currency-utils";

/**
 * ภาษีของบรรทัด price list
 * - ไม่ติ๊ก Inc VAT: `price` คือราคาก่อนภาษี · ภาษีบวกทับ · total = price + ภาษี
 * - ติ๊ก Inc VAT (`isTaxIncluded`): `price` รวม VAT แล้ว →
 *   priceWithoutTax = price × 100 ÷ (100 + rate) (ไม่ปัด) · taxAmt = round2(price − priceWithoutTax) ·
 *   total = price
 *
 * ใช้ร่วมกันทั้ง portal vendor (`/pl/:token`) และหน้า price list ภายใน ให้ตัวเลข
 * ตรงกันทุกจอ · ค่านี้ใช้แสดงผล — backend คำนวณค่าที่บันทึกเอง
 */
export function priceListTaxParts(
  price: number | string | null | undefined,
  rate: number | string | null | undefined,
  isTaxIncluded = false,
) {
  const p = Number(price) || 0;
  const r = Number(rate) || 0;
  if (isTaxIncluded) {
    const priceWithoutTax = (p * 100) / (100 + r);
    return {
      price: p,
      priceWithoutTax,
      taxAmt: round2(p - priceWithoutTax),
      total: p,
    };
  }
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
