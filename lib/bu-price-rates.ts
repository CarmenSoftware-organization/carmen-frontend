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
