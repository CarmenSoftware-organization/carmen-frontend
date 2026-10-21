import { storedSubtotal } from "./pr-hidden-fields";
import { resolveApprovedQty, type PrFormValues } from "./pr-form-schema";

export interface PrSummary {
  readonly subtotal: number;
  readonly totalDiscount: number;
  readonly totalNet: number;
  readonly totalTax: number;
  readonly grandTotal: number;
}

/**
 * ยอดรวมของใบขอซื้อ ในสกุลหลักของ BU
 *
 * ทุกยอดคูณ `exchange_rate` ของ item เสมอ เพราะแถบสรุปติดป้ายเป็นสกุลหลัก —
 * ใบสกุลต่างประเทศสกุลเดียวเคยโชว์ยอดสกุลนั้นแต่ติดป้ายสกุลหลัก คนอ่านเข้าใจผิด
 * ว่าแปลงมาแล้ว (เรตเป็น 0 หรือว่างถือเป็น 1 ไม่งั้นยอดหายทั้งใบ)
 *
 * subtotal คิดจาก `resolveApprovedQty` ตัวเดียวกับที่แถวใช้ ส่วน discount/net/tax
 * /total อ่านยอดที่แถวคำนวณไว้แล้ว — คิดสูตรเองซ้ำที่นี่เมื่อไหร่ Subtotal −
 * Discount ก็ไม่เท่ากับ Net ทันทีที่ผู้อนุมัติหั่นจำนวนลง
 *
 * @param items - items จากฟอร์ม PR
 * @param useStored - ซ่อนเฉพาะราคาต่อหน่วย: pricelist_price เป็น 0 ปลอม จึงคิด subtotal จาก
 *   net + discount ที่ backend ส่งมาแทนราคา × จำนวน
 * @returns ยอดรวมห้าช่องของแถบสรุป
 * @example
 * const summary = computePrSummary(useWatch({ control, name: "items" }) ?? []);
 */
export function computePrSummary(
  items: readonly (PrFormValues["items"][number] | undefined)[],
  useStored = false,
): PrSummary {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalNet = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of items) {
    if (!item) continue;
    const rate = Number(item.exchange_rate) || 1;
    const qty = resolveApprovedQty({
      approved_qty: item.approved_qty ?? 0,
      requested_qty: item.requested_qty ?? 0,
    });
    subtotal += useStored
      ? storedSubtotal(item.net_amount, item.discount_amount) * rate
      : Number(item.pricelist_price ?? 0) * qty * rate;
    totalDiscount += Number(item.discount_amount ?? 0) * rate;
    totalNet += Number(item.net_amount ?? 0) * rate;
    totalTax += Number(item.tax_amount ?? 0) * rate;
    grandTotal += Number(item.total_price ?? 0) * rate;
  }

  return { subtotal, totalDiscount, totalNet, totalTax, grandTotal };
}
