import type { DimensionMaster } from "@/types/accounting-master";
import type { DimensionRef } from "@/types/gl-dimension";

export interface DimensionValueLabels {
  yes: string;
  no: string;
  /** จัดรูปแบบตัวเลข (ไม่ส่งมา = แสดงตามที่เก็บ) */
  formatNumber?: (value: string) => string;
  /** จัดรูปแบบวันที่ `YYYY-MM-DD` (ไม่ส่งมา = แสดงตามที่เก็บ) */
  formatDate?: (ymd: string) => string;
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

/** ค่าที่เก็บไว้ (ไม่รวม lookup id) เป็นค่า `value` ที่ backend รับ */
export function storedTypedValue(
  ref: DimensionRef,
): string | number | boolean | null {
  if (!isEmpty(ref.value)) return ref.value as string | number | boolean;
  if (!isEmpty(ref.value_text)) return ref.value_text as string;
  if (!isEmpty(ref.value_number)) return ref.value_number as string | number;
  if (!isEmpty(ref.value_date)) return ref.value_date as string;
  if (typeof ref.value_boolean === "boolean") return ref.value_boolean;
  return null;
}

/** ref นี้มีค่าให้ส่ง/แสดงหรือไม่ */
export function dimensionRefHasValue(ref: DimensionRef): boolean {
  return !isEmpty(ref.dimension_value_id) || storedTypedValue(ref) !== null;
}

/** `YYYY-MM-DD` → Date เที่ยงคืนตามเวลาเครื่อง (ไม่เลื่อนวันข้าม timezone) */
export function ymdToLocalDate(ymd: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Date (เวลาเครื่อง) → `YYYY-MM-DD` */
export function localDateToYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * ข้อความแสดงค่า dimension ตามชนิด
 * lookup = รหัสค่า (`value_code`) · number = จัดรูปแบบตัวเลข · date = ตามรูปแบบวันที่ของโปรไฟล์
 * · boolean = Yes/No · text = ตามที่กรอก
 * ชนิดดูจาก master ก่อน (ถ้ามี) — ref เก่าที่ยังเก็บ value id คงแสดง `value_code` เดิม
 */
export function formatDimensionValue(
  ref: DimensionRef,
  dimension?: Pick<DimensionMaster, "data_type">,
  labels: DimensionValueLabels = { yes: "Yes", no: "No" },
): string {
  if (!isEmpty(ref.dimension_value_id) && isEmpty(ref.value))
    return ref.value_code ?? "";
  const type = dimension?.data_type ?? ref.data_type ?? "lookup";
  const value = storedTypedValue(ref);
  if (value === null) return ref.value_code ?? "";
  if (type === "boolean" || typeof value === "boolean") {
    const on = value === true || value === "true";
    return on ? labels.yes : labels.no;
  }
  if (type === "number") {
    const text = String(value);
    return labels.formatNumber ? labels.formatNumber(text) : text;
  }
  if (type === "date") {
    const ymd = String(value);
    return labels.formatDate ? labels.formatDate(ymd) : ymd;
  }
  return String(value);
}
