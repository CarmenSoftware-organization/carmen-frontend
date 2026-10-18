import { useLocale, useTranslations } from "use-intl";
import { StatusDotBadge, type DotTone } from "@/components/ui/status-dot-badge";
import { formatLocalizedDate } from "@/lib/date-utils";
import { getMaintenanceStatus, type MaintenanceState } from "./eq-maintenance";

const STATE_TONE: Record<Exclude<MaintenanceState, "unset">, DotTone> = {
  overdue: "destructive",
  "due-soon": "warning",
  ok: "success",
};

interface EqMaintenanceBadgeProps {
  readonly nextDate: string | null | undefined;
  readonly size?: "xs" | "sm";
}

/**
 * ป้ายรอบซ่อมบำรุง — ตัวเดียวกันทั้งตาราง การ์ด และหัวหน้ารายละเอียด
 * ให้สถานะเดียวกันหน้าตาเหมือนกันทุกมุมมอง
 *
 * ข้อความบอกสถานะได้เองโดยไม่ต้องพึ่งสี (เลยกำหนด / อีก n วัน / ครั้งถัดไป …)
 * ยังไม่ตั้งวันนัด = ขีดจาง ไม่ใช่ชิป — ของที่ไม่มีข้อมูลไม่ควรแย่งสายตา
 */
export function EqMaintenanceBadge({
  nextDate,
  size = "sm",
}: EqMaintenanceBadgeProps) {
  const t = useTranslations("operationPlan.equipment");
  const locale = useLocale();
  const { state, days } = getMaintenanceStatus(nextDate);

  if (state === "unset") {
    return (
      <span data-slot="eq-maintenance-unset" className="text-muted-foreground">
        —
      </span>
    );
  }

  let label: string;
  if (state === "overdue") label = t("maintOverdue", { days: -days });
  else if (state === "ok")
    label = t("maintNext", { date: formatLocalizedDate(nextDate, locale) });
  else if (days === 0) label = t("maintDueToday");
  else label = t("maintDueIn", { days });

  return (
    <StatusDotBadge tone={STATE_TONE[state]} size={size}>
      {label}
    </StatusDotBadge>
  );
}
