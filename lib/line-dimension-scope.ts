import { resolveBuConfigValue } from "@/lib/print-form-config";
import type { BusinessUnitDetail } from "@/types/business-unit";

/** ชนิดเอกสารที่มีช่อง dimension ต่อบรรทัด */
export type LineDimensionDocType = "pr" | "po" | "grn" | "sr" | "ia";

/**
 * คำนวณว่าเอกสารชนิดใดแสดง dimension ต่อบรรทัด จาก config ของ BU
 * (กติกาเดียวกับ backend): `dimension.start-from` = pr → pr,po,grn · po → po,grn ·
 * grn → grn · ค่าอื่น/ไม่มี → ปิดหมด; sr/ia เปิดเมื่อ `dimension.{sr,ia}.enabled` เป็น true / "true"
 *
 * @param config - `config` จาก BusinessUnitDetail
 */
export function lineDimensionScope(
  config: BusinessUnitDetail["config"] | undefined,
): Record<LineDimensionDocType, boolean> {
  const startFrom = resolveBuConfigValue(config, "dimension.start-from");
  const flag = (key: string): boolean => {
    const v: unknown = resolveBuConfigValue(config, key);
    return v === true || v === "true";
  };
  return {
    pr: startFrom === "pr",
    po: startFrom === "pr" || startFrom === "po",
    grn: startFrom === "pr" || startFrom === "po" || startFrom === "grn",
    sr: flag("dimension.sr.enabled"),
    ia: flag("dimension.ia.enabled"),
  };
}
