import type { Stage, SlaUnit } from "@/types/workflows";

const UNIT_TO_MINUTES: Record<SlaUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
};

export function totalSlaMinutes(stages: Stage[]): number {
  if (!stages || stages.length === 0) return 0;
  const middle = stages.slice(0, -1);
  return middle.reduce((sum, stage) => {
    const value = Number(stage.sla);
    if (!Number.isFinite(value) || value <= 0) return sum;
    const unit = (stage.sla_unit as SlaUnit) ?? "hours";
    return sum + value * (UNIT_TO_MINUTES[unit] ?? 60);
  }, 0);
}

export function formatCycleTime(minutes: number): string {
  if (!minutes || minutes <= 0) return "";
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && mins > 0) parts.push(`${mins}m`);
  return parts.slice(0, 2).join(" ") || "0m";
}

/** ป้าย SLA สั้น ๆ ของขั้นเดียว ("24h", "2d") — ขั้นที่ SLA เป็น 0 ได้สตริงว่าง */
export const formatStageSla = (
  stage: (Pick<Stage, "sla"> & { sla_unit?: string }) | undefined,
): string =>
  stage?.sla && stage.sla !== "0"
    ? `${stage.sla}${stage.sla_unit?.[0] ?? "h"}`
    : "";
