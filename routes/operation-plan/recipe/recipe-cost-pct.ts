import { round2 } from "@/lib/currency-utils";

/**
 * Net/Gross Cost (%) ของหน้าราคาขาย — แบบเดียวกับ Summary Cost ของระบบเก่า:
 * % = ต้นทุนวัตถุดิบ ÷ ราคา × 100 (ฐานเดียวกับ food cost ทั้งระบบ ไม่รวมค่าแรง/โสหุ้ย)
 *
 * กรอก % ได้เพื่อคิดราคา แต่ % ไม่มีคอลัมน์ — ที่บันทึกคือราคา net อย่างเดียว
 * เปิดสูตรใหม่ % คิดจากต้นทุน ÷ ราคาทุกครั้ง (ผู้ใช้สั่ง 2026-11-25)
 */

/** % ต้นทุนของราคา ปัด 2 ตำแหน่ง — ไม่มีราคา = null */
export function costPctOf(cost: number, price: number): number | null {
  if (!(price > 0)) return null;
  return round2((cost / price) * 100);
}

/** ราคาที่ทำให้ต้นทุนเป็น pct% ของราคา ปัดเป็นสตางค์ — ไม่มีต้นทุน หรือ % ≤ 0 = null */
export function priceForCostPct(cost: number, pct: number): number | null {
  if (!(cost > 0) || !(pct > 0) || !Number.isFinite(pct)) return null;
  return round2(cost / (pct / 100));
}
