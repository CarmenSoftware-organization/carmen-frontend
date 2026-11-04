import type { JvTemplate } from "./jv-template-types";

type Translate = (key: string) => string;

/** ป้ายชนิด template ที่แปลแล้ว — ค่าที่ไม่รู้จักแสดงค่าดิบ */
export function jvTemplateTypeLabel(t: Translate, type: string): string {
  return t(`type_${type}`);
}

export function jvTemplateActiveLabel(t: Translate, active: boolean): string {
  return t(active ? "active" : "inactive");
}

/** `FY/PP` เช่น 2026/03 */
function periodText(fiscalYear: number, periodNo: number): string {
  return `${fiscalYear}/${String(periodNo).padStart(2, "0")}`;
}

export function jvTemplatePeriodRange(row: JvTemplate): string {
  return `${periodText(row.from_fiscal_year, row.from_period_no)} – ${periodText(row.to_fiscal_year, row.to_period_no)}`;
}

/** ยอดที่ใช้แสดง: allocate_amount (allocation) → total_amount (amortize) → null */
export function jvTemplateAmount(row: JvTemplate): number | null {
  return row.allocate_amount ?? row.total_amount ?? null;
}

/** แปลป้ายของ options ที่ config ประกาศเป็นอังกฤษ ณ เวลา render */
export function translateOptionLabels<
  O extends { label: string; statusKey?: string },
>(options: readonly O[], labelOf: (statusKey: string) => string): O[] {
  return options.map((o) =>
    o.statusKey ? { ...o, label: labelOf(o.statusKey) } : o,
  );
}
