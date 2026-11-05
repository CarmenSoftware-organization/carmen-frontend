import { useMemo } from "react";
import { useTranslations } from "use-intl";

/**
 * ป้ายของการ์ด widget ที่ไม่ผูกกับชนิดกราฟ — หัวคอลัมน์ ชื่อแกน หน่วย ชื่อหมวด และทศนิยม
 * อยู่ที่เดียว ให้ dataset เดียวกันอ่านเหมือนกันไม่ว่าจะสลับเป็นวงกลม แท่ง เส้น หรือตาราง
 *
 * ความหมายของแกนมาจาก backend (`meta.dimension` / `series_dimension` — token ชุดปิดใน
 * micro-data `service/dashboard/dimension.go`) เดิมไม่มีข้อมูลนี้ ตารางทุกใบจึงได้หัวกลาง
 * "รายการ | ค่า (items)" ไม่มี token (backend รุ่นเก่า / token ใหม่ที่ยังไม่มีคำแปล)
 * = พฤติกรรมเดิม
 */

export const CURRENCY_UNIT = "฿";

/**
 * token ที่มีคำแปลใน `dashboardWidget.dimension.*` — status / priority เป็นรหัส enum ที่ต้องแปล
 * (ดู `category`) ที่เหลือเป็นชื่อจริง (ผู้ขาย / คลัง / สินค้า) แสดงตามที่เก็บ
 */
const KNOWN_DIMENSIONS: ReadonlySet<string> = new Set([
  "status",
  "priority",
  "vendor",
  "department",
  "location",
  "product",
  "product_category",
  "item_group",
  "unit",
  "business_type",
  "reason",
  "tax_rate",
  "currency",
  "cuisine",
  "recipe_category",
  "recipe",
  "equipment_category",
  "document",
  "period",
  "day",
  "month",
  "date",
]);

/** หน่วยของ backend → คีย์ i18n ("฿" เป็นคีย์ไม่ได้) */
const UNIT_KEYS: Readonly<Record<string, string>> = {
  items: "items",
  [CURRENCY_UNIT]: "baht",
  days: "days",
  transactions: "transactions",
  qty: "qty",
  rate: "rate",
};

/** หน่วยที่มีคำต่อท้ายตัวเลข (เงินใช้ ฿ นำหน้า · ปริมาณ/อัตราไม่ต่อ) */
const SUFFIX_UNITS: ReadonlySet<string> = new Set([
  "items",
  "days",
  "transactions",
]);

/**
 * ทศนิยมสูงสุดเริ่มต้นตามหน่วย — นับเป็นจำนวนเต็ม · เงินตามเดิม (0) · วันรออนุมัติ 1 ตำแหน่ง
 * (เดิมโชว์ 28.148) · อัตราแลกเปลี่ยน 4 ตำแหน่ง (สกุลอย่าง JPY ต่ำกว่า 1)
 */
const UNIT_DECIMALS: Readonly<Record<string, number>> = {
  items: 0,
  transactions: 0,
  [CURRENCY_UNIT]: 0,
  days: 1,
  qty: 2,
  rate: 4,
};

/** `in_progress` → `In Progress` — ใช้เมื่อไม่รู้ว่าแกนคืออะไร (พฤติกรรมเดิมของวงกลม/ตาราง) */
export function humanizeLabel(label: string): string {
  return label.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * ตัวเลขตามหน่วย — `decimals` (ค่าที่ผู้ใช้ตั้งใน widget) ชนะและคงศูนย์ท้าย (2 ตำแหน่ง =
 * "31.00") ไม่ตั้ง = ทศนิยมเริ่มต้นของหน่วย · หน่วยที่ไม่รู้จัก = `toLocaleString()` เดิม
 *
 * @param value - ค่าดิบ
 * @param unit - `meta.unit`
 * @param decimals - `display.decimals`
 */
export function formatMetric(
  value: number,
  unit?: string,
  decimals?: number,
): string {
  const fixed =
    decimals === undefined ? undefined : Math.min(Math.max(decimals, 0), 4);
  const max = fixed ?? UNIT_DECIMALS[unit ?? ""];
  if (max === undefined) return value.toLocaleString();
  return new Intl.NumberFormat(unit === CURRENCY_UNIT ? "th-TH" : undefined, {
    minimumFractionDigits: fixed ?? 0,
    maximumFractionDigits: max,
  }).format(value);
}

interface Translator {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
}

export interface WidgetLabels {
  /** ชื่อแกน/หัวคอลัมน์ของมิติ — ไม่มี token = หัวกลางเดิม ("รายการ") */
  dimension(token: string | undefined): string;
  /** หัวคอลัมน์ค่า — "จำนวน", "ยอดเงิน (฿)" · หน่วยที่ไม่รู้จัก = "ค่า (<หน่วย>)" เดิม */
  valueHeader(unit: string | undefined): string;
  /** ชื่อหมวดบนแกน/ในตาราง — สถานะ/ความสำคัญแปล · ชื่อจริงคงเดิม · ไม่รู้มิติ = humanize */
  category(dimension: string | undefined, raw: string): string;
  /** ตัวเลข + หน่วย — "฿1,200" · "13 รายการ" · "28.1 วัน" */
  withUnit(value: number, unit: string | undefined, decimals?: number): string;
  /** คำต่อท้ายตัวเลขบน KPI/เกจ — "" เมื่อไม่ต่อ (เงิน ปริมาณ อัตรา ไม่มีหน่วย) */
  unitSuffix(unit: string | undefined): string;
}

/**
 * ตัวสร้างแบบไม่ผูก React — แยกไว้ให้เทสต์ป้อน translator เองได้
 *
 * @param t - translator ของ `dashboardWidget`
 * @param tStatus - translator ของ `status`
 */
export function makeWidgetLabels(
  t: Translator,
  tStatus: Translator,
): WidgetLabels {
  const unitSuffix = (unit: string | undefined): string => {
    if (!unit || !SUFFIX_UNITS.has(unit)) {
      // หน่วยที่ไม่รู้จักแสดงดิบเหมือนเดิม — ดีกว่าหายไปเฉย ๆ
      return unit && !UNIT_KEYS[unit] ? unit : "";
    }
    return t(`unitSuffix.${unit}`);
  };
  return {
    dimension: (token) =>
      token && KNOWN_DIMENSIONS.has(token)
        ? t(`dimension.${token}`)
        : t("tableCol.label"),
    valueHeader: (unit) => {
      const key = unit ? UNIT_KEYS[unit] : undefined;
      if (key) return t(`unitHeader.${key}`);
      return unit ? `${t("tableCol.value")} (${unit})` : t("tableCol.value");
    },
    category: (dimension, raw) => {
      if (raw === "unknown") return t("unknown");
      if (dimension === "status")
        return tStatus.has(raw) ? tStatus(raw) : humanizeLabel(raw);
      if (dimension === "priority")
        return t.has(`priority.${raw}`)
          ? t(`priority.${raw}`)
          : humanizeLabel(raw);
      if (dimension && KNOWN_DIMENSIONS.has(dimension)) return raw;
      return humanizeLabel(raw);
    },
    withUnit: (value, unit, decimals) => {
      const n = formatMetric(value, unit, decimals);
      if (unit === CURRENCY_UNIT) return `${CURRENCY_UNIT}${n}`;
      const suffix = unitSuffix(unit);
      return suffix ? `${n} ${suffix}` : n;
    },
    unitSuffix,
  };
}

/** ป้ายของการ์ดตาม locale ปัจจุบัน — identity คงที่ตราบที่ translator ไม่เปลี่ยน (use-intl memo ไว้) */
export function useWidgetLabels(): WidgetLabels {
  const t = useTranslations("dashboardWidget");
  const tStatus = useTranslations("status");
  return useMemo(
    () => makeWidgetLabels(t as Translator, tStatus as Translator),
    [t, tStatus],
  );
}
