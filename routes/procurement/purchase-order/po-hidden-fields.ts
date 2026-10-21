import { isPriceHidden, type HiddenPriceField } from "@/types/workflows";

/**
 * flag ซ่อนราคาของใบ PO ที่ตาราง ท้ายใบ และตัว sync ต้องตัดสินตรงกัน — คำนวณที่เดียว
 * กันสามจุดนี้เพี้ยนจากกัน
 *
 * - `hidePrice` — ราคาต่อหน่วย (price_per_unit) ถูกซ่อน: ราคาในฟอร์มเป็น 0 ปลอมจาก null
 *   จึงห้ามคำนวณยอดจากมัน ให้โชว์ยอดที่ backend ส่งมา (เก็บไว้ในฟอร์มตอนโหลด) แทน
 * - `hideTotal` — ยอดรวม (total_price) ถูกซ่อน: ขึ้น badge
 * - `anyHidden` — มีอะไรซ่อนอยู่ = ห้ามให้ sync เขียนยอดที่คำนวณกลับลงฟอร์ม
 */
export function getPoHiddenFlags(hidden?: readonly HiddenPriceField[]) {
  const hidePrice = isPriceHidden(hidden, "price_per_unit");
  const hideTotal = isPriceHidden(hidden, "total_price");
  return { hidePrice, hideTotal, anyHidden: hidePrice || hideTotal };
}
