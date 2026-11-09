import { round2 } from "@/lib/currency-utils";
import { computeLineAmounts } from "@/lib/line-pricing";
import type { CnFormValues } from "./cn-form-schema";

export type CnCreditNoteType = CnFormValues["credit_note_type"];

export interface CnItemAmountInput {
  quantity: number;
  unit_price: number;
  net_amount: number;
  discount_rate: number;
  discount_amount: number;
  is_discount_adjustment: boolean;
  tax_rate: number;
  tax_amount: number;
  is_tax_adjustment: boolean;
}

export interface CnItemAmounts {
  sub_total: number;
  discount_amount: number;
  net_amount: number;
  tax_amount: number;
  total_amount: number;
}

/**
 * คำนวณยอดของ CN item ตามประเภทใบลดหนี้
 *
 * - `quantity_return` → subtotal = qty × price → discount (rate/override) → net =
 *   subtotal − discount → tax (rate/override) → total (สูตรร่วมกับ PR/PO/GRN ผ่าน
 *   `computeLineAmounts`)
 * - `amount_discount` → net = CN amount ที่กรอกเอง (qty/price เป็น ref, ไม่มีส่วนลด
 *   ต่อบรรทัด → discount = 0, subtotal = net)
 *
 * tax: ถ้า `is_tax_adjustment` = ใช้ tax_amount ที่ผู้ใช้กรอก, ไม่งั้นคิด net × rate%
 *
 * @param type - ประเภทใบลดหนี้
 * @param item - ค่าฟิลด์ที่เกี่ยวข้องกับการคำนวณ
 * @returns sub_total / discount_amount / net_amount / tax_amount / total_amount ที่ปัดทศนิยมแล้ว
 */
export function computeCnItemAmounts(
  type: CnCreditNoteType,
  item: CnItemAmountInput,
): CnItemAmounts {
  // amount_discount → กรอก CN amount (net) ตรง ไม่มีส่วนลดต่อบรรทัด
  if (type === "amount_discount") {
    const net = round2(Number(item.net_amount) || 0);
    const tax = item.is_tax_adjustment
      ? round2(Number(item.tax_amount) || 0)
      : round2((net * (Number(item.tax_rate) || 0)) / 100);
    return {
      sub_total: net,
      discount_amount: 0,
      net_amount: net,
      tax_amount: tax,
      total_amount: round2(net + tax),
    };
  }

  // quantity_return → subtotal = qty × price, honor discount/tax override (สูตรร่วม)
  const line = computeLineAmounts({
    price: Number(item.unit_price) || 0,
    qty: Number(item.quantity) || 0,
    discRate: Number(item.discount_rate) || 0,
    isDiscAdj: !!item.is_discount_adjustment,
    discAmt: Number(item.discount_amount) || 0,
    taxRate: Number(item.tax_rate) || 0,
    isTaxAdj: !!item.is_tax_adjustment,
    taxAmt: Number(item.tax_amount) || 0,
    isTaxIncluded: false,
  });
  return {
    sub_total: line.subtotal,
    discount_amount: line.discountAmount,
    net_amount: line.netAmount,
    tax_amount: line.taxAmount,
    total_amount: line.totalPrice,
  };
}
