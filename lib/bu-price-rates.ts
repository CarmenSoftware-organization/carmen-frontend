import { round2 } from "@/lib/currency-utils";
import { resolveBuConfigValue } from "@/lib/print-form-config";
import type { BusinessUnitDetail } from "@/types/business-unit";

/**
 * VAT / ค่าบริการตั้งต้นของ BU — ตั้งที่หน้า Default Setting (section General)
 * ค่าตั้งต้นของ registry ใช้คู่กัน (routes/system-admin/company-profile/company-profile-config-registry.ts)
 */
export const BU_DEFAULT_VAT_RATE_KEY = "general.default-vat-rate";
export const BU_DEFAULT_SERVICE_RATE_KEY = "general.default-service-rate";
export const BU_DEFAULT_VAT_RATE = 7;
export const BU_DEFAULT_SERVICE_RATE = 0;

export interface PriceRates {
  /** ค่าบริการ % */
  readonly service: number;
  /** VAT % */
  readonly vat: number;
}

/** % ที่ BU ตั้งไว้ — ไม่ได้ตั้ง / ค่าเพี้ยน = ค่าตั้งต้นของ registry */
export function resolvePriceRates(
  config: BusinessUnitDetail["config"] | undefined,
): PriceRates {
  const read = (key: string, fallback: number) => {
    const n = Number(resolveBuConfigValue(config, key));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    service: read(BU_DEFAULT_SERVICE_RATE_KEY, BU_DEFAULT_SERVICE_RATE),
    vat: read(BU_DEFAULT_VAT_RATE_KEY, BU_DEFAULT_VAT_RATE),
  };
}

export interface GrossPrice {
  readonly net: number;
  readonly service: number;
  readonly vat: number;
  readonly gross: number;
}

/**
 * ราคา net (ก่อน service + VAT) → gross แบบ "++" ของไทย: ค่าบริการคิดจาก net แล้ว VAT คิดจาก net + ค่าบริการ
 * แต่ละส่วนปัด 2 ตำแหน่ง และ gross = ผลรวมของส่วนที่ปัดแล้ว (บวกกันตรงกับที่แสดง)
 */
export function computeGrossPrice(net: number, rates: PriceRates): GrossPrice {
  const service = round2((net * rates.service) / 100);
  const vat = round2(((net + service) * rates.vat) / 100);
  return { net, service, vat, gross: round2(net + service + vat) };
}

/**
 * คิดย้อน gross → net (ราคาขายที่บันทึก) สำหรับช่อง gross ที่ผู้ใช้พิมพ์เอง
 *
 * net ต้องเป็นสตางค์เต็ม และ computeGrossPrice ปัดค่าบริการกับ VAT ทีละส่วน — หารตรง ๆ
 * (gross ÷ (1+service)(1+VAT)) แล้วปัดจึงอาจได้ gross ที่คลาดไป 1 สตางค์ จึงลอง net รอบ ๆ
 * ค่าที่หารได้ (±2 สตางค์) แล้วเลือกตัวที่ป้อนกลับเข้า computeGrossPrice ได้ gross ตรงกับที่พิมพ์
 * ไม่มีตัวไหนตรง (gross บางค่าเป็นไปไม่ได้เมื่อ net ขยับทีละสตางค์แล้ว gross ขยับมากกว่า 1 สตางค์)
 * = เลือกตัวที่ได้ gross ใกล้สุด — ผู้เรียกเทียบ `gross` ที่คืนกับค่าที่พิมพ์เพื่อบอกผู้ใช้เอง
 *
 * @returns ชุดราคาของ net ที่เลือก (`gross` คือค่าที่ได้จริง อาจต่างจากที่พิมพ์ 1 สตางค์)
 */
export function solveNetForGross(gross: number, rates: PriceRates): GrossPrice {
  const target = round2(gross);
  const factor = (1 + rates.service / 100) * (1 + rates.vat / 100);
  const base = Math.round((target / factor) * 100);
  let best: GrossPrice | null = null;
  // ใกล้ค่าที่หารได้ก่อน — gross เท่ากันหลายตัว (เกิดได้เมื่อ factor < 1 สตางค์ต่อสตางค์) เลือกตัวแรก
  for (const cents of [base, base - 1, base + 1, base - 2, base + 2]) {
    if (cents < 0) continue;
    const p = computeGrossPrice(cents / 100, rates);
    if (p.gross === target) return p;
    if (!best || Math.abs(p.gross - target) < Math.abs(best.gross - target))
      best = p;
  }
  return best ?? computeGrossPrice(0, rates);
}
