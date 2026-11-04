import { ApiError } from "@/lib/api-error";
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
export function periodLabel(fiscalYear: number, periodNo: number): string {
  return `${fiscalYear}/${String(periodNo).padStart(2, "0")}`;
}

export function jvTemplatePeriodRange(row: JvTemplate): string {
  return `${periodLabel(row.from_fiscal_year, row.from_period_no)} – ${periodLabel(row.to_fiscal_year, row.to_period_no)}`;
}

/** ยอดตามชนิด: allocation → allocate_amount · amortize → total_amount · recurring → null */
export function jvTemplateAmount(row: JvTemplate): number | null {
  if (row.template_type === "allocation") return row.allocate_amount;
  if (row.template_type === "amortize") return row.total_amount;
  return null;
}

/** คีย์ป้ายหัวคอลัมน์ยอด — หน้า allocation ใช้ป้ายเฉพาะ, หน้ารวมใช้ป้ายกลาง */
export function jvTemplateAmountLabelKey(
  kind: "all" | "recurring" | "allocation",
): string {
  return kind === "allocation" ? "allocateAmount" : "amount";
}

/** แปลป้ายของ options ที่ config ประกาศเป็นอังกฤษ ณ เวลา render */
export function translateOptionLabels<
  O extends { label: string; statusKey?: string },
>(options: readonly O[], labelOf: (statusKey: string) => string): O[] {
  return options.map((o) =>
    o.statusKey ? { ...o, label: labelOf(o.statusKey) } : o,
  );
}

type ErrorTranslate = {
  (key: string): string;
  has: (key: string) => boolean;
};

/** ข้อความผิดพลาดอ่านได้จากรหัส catalog ใต้ `errors.<CODE>` — ไม่เจอใช้ข้อความ 4xx ของ backend แล้วตกไป UNKNOWN */
export function jvTemplateErrorText(t: ErrorTranslate, error: unknown): string {
  const code =
    typeof error === "string"
      ? error
      : error instanceof ApiError
        ? error.appCode
        : undefined;
  if (code && t.has(`errors.${code}`)) return t(`errors.${code}`);
  if (error instanceof ApiError && error.userFacingServerMessage) {
    return error.userFacingServerMessage;
  }
  return t("errors.UNKNOWN");
}
