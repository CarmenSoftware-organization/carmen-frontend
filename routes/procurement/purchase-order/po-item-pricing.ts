import { round2 } from "@/lib/currency-utils";
import { computeLineAmounts } from "@/lib/line-pricing";
import type { PoFormValues } from "./po-form-schema";

/**
 * ยอดของแถวสินค้าหนึ่งแถว — แถวหนึ่ง = คลังเดียว ตั้งแต่ backend เลิก group location
 * ของเดิมวน `item.locations[]` แล้วบวกกัน เพราะ Disc%/Tax อยู่ราย location
 */
export function computeItemPricing(
  item: PoFormValues["items"][number] | undefined,
) {
  const price = Number(item?.price ?? 0);
  const conversion = Number(item?.order_unit_conversion_factor ?? 1);
  const orderQty = Number(item?.order_qty) || 0;

  const line = computeLineAmounts({
    price,
    qty: orderQty,
    discRate: Number(item?.discount_rate) || 0,
    isDiscAdj: item?.is_discount_adjustment ?? false,
    discAmt: Number(item?.discount_amount) || 0,
    taxRate: Number(item?.tax_rate) || 0,
    isTaxAdj: item?.is_tax_adjustment ?? false,
    taxAmt: Number(item?.tax_amount) || 0,
    isTaxIncluded: item?.is_tax_included ?? false,
  });

  return {
    orderQty,
    subtotal: round2(line.subtotal),
    discountAmount: round2(line.discountAmount),
    netAmount: round2(line.netAmount),
    taxAmount: round2(line.taxAmount),
    totalPrice: round2(line.totalPrice),
    baseQty: round2(orderQty * conversion),
  };
}
