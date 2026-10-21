import { round2 } from "@/lib/currency-utils";
import { isPriceHidden, type HiddenPriceField } from "@/types/workflows";

/**
 * flag ซ่อนราคาของใบ PR — แถวรายการกับแถบสรุปท้ายใบต้องตัดสินตรงกัน คำนวณที่เดียว
 *
 * - `hidePrice` — ราคาต่อหน่วย (price_per_unit) ถูกซ่อน: pricelist_price ในฟอร์มเป็น 0 ปลอม
 *   จาก null จึงห้ามคำนวณยอดจากมัน
 * - `hideTotal` — ยอดรวม (total_price) ถูกซ่อน: ขึ้น badge
 * - `useStored` — ซ่อนเฉพาะราคาต่อหน่วย: backend ส่งยอดจริงมาครบ ให้โชว์ยอดที่เก็บไว้ในฟอร์ม
 *   ตอนโหลดแทนยอดที่คำนวณ (ถ้า total ซ่อนด้วยก็เป็น badge อยู่แล้ว)
 */
export function getPrHiddenFlags(hidden?: readonly HiddenPriceField[]) {
  const hidePrice = isPriceHidden(hidden, "price_per_unit");
  const hideTotal = isPriceHidden(hidden, "total_price");
  return {
    hidePrice,
    hideTotal,
    anyHidden: hidePrice || hideTotal,
    useStored: hidePrice && !hideTotal,
  };
}

/**
 * Subtotal จากยอดที่ backend เก็บไว้ — ฟอร์มไม่ได้ map sub_total_price มา แต่ส่วนลดหักจาก
 * subtotal ตรง ๆ (net = subtotal − discount, ดู computeLineAmounts) จึงได้ net + discount
 * เท่ากับ subtotal ที่ backend เก็บทุกกรณี ทั้งส่วนลดแบบ % และแบบกรอกเอง
 */
export function storedSubtotal(net: unknown, discount: unknown): number {
  return round2((Number(net) || 0) + (Number(discount) || 0));
}
