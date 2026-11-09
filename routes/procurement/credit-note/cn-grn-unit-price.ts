import { round2 } from "@/lib/currency-utils";

/**
 * ราคาต่อหน่วย (ก่อน VAT) ที่ CN ใช้จากบรรทัด GRN
 *
 * GRN เก็บแต่ยอดรวมย่อย (`sub_total_price`) ไม่มีราคาต่อหน่วย จึงถอดกลับด้วย sub_total ÷ qty
 * แต่บรรทัดที่ติ๊ก Inc VAT (`is_tax_included`) ราคาที่กรอกรวม VAT แล้ว ขณะที่ CN บวก VAT เพิ่มเอง
 * (computeLineAmounts, isTaxIncluded: false) — ถ้าใช้ราคารวม VAT ตรง ๆ จะลดหนี้เกินเท่ากับ VAT
 * จึงถอด VAT ออกก่อน: ราคา × 100 ÷ (100 + tax_rate) · บรรทัดที่ไม่ติ๊ก / tax_rate 0 หรือว่าง = ไม่เปลี่ยน
 */
export function cnUnitPriceFromGrnLine(line: {
  sub_total_price?: number | null;
  received_qty?: number | null;
  is_tax_included?: boolean | null;
  tax_rate?: number | null;
}): number {
  const qty = Number(line.received_qty) || 0;
  if (qty <= 0) return 0;
  const subTotal = Number(line.sub_total_price) || 0;
  const rate = Number(line.tax_rate) || 0;
  if (line.is_tax_included === true && rate > 0) {
    return round2(((subTotal / qty) * 100) / (100 + rate));
  }
  return round2(subTotal / qty);
}
