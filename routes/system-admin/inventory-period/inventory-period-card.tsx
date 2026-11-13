import { AlertTriangle } from "lucide-react";
import { useTranslations } from "use-intl";
import { ListCard, ListCardRow } from "@/components/share/list-card";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { INVENTORY_PERIOD_STATUS_CONFIG } from "@/constant/inventory-period";
import type { InventoryPeriod } from "@/types/inventory-period";
import { getInventoryPeriodPhase } from "./inventory-period-phase";

interface Props {
  readonly item: InventoryPeriod;
  /** เป็นรอบปัจจุบันของ BU (`useProfile().currentPeriod`) */
  readonly isCurrent?: boolean;
  /** วันนี้ `YYYY-MM-DD` ใช้ตัดสินว่ารอบนี้ค้างปิดหรือไม่ */
  readonly today: string;
}

/**
 * การ์ดรอบสินค้าคงคลัง 1 รอบ สำหรับหน้ารายการโหมด grid/mobile
 *
 * สถานะ (open/closed/locked) เป็น lifecycle ของเอกสาร ใช้ dot-chip จาก
 * `INVENTORY_PERIOD_STATUS_CONFIG` (badge-status.css) ตัวเดียวกับที่ตารางและหน้า
 * period-end ใช้ — ของเดิม map เป็น success/secondary/destructive ซึ่งยืม token
 * ความหมาย "สำเร็จ/ผิดพลาด" มาใช้กับ lifecycle ผิดชั้นสีตาม DESIGN.md
 */
export default function InventoryPeriodCard({
  item,
  isCurrent,
  today,
}: Props) {
  const t = useTranslations("systemAdmin.inventoryPeriod");
  const { dateFormat } = useProfile();

  const statusConfig = INVENTORY_PERIOD_STATUS_CONFIG[item.status];
  const isOverdue = getInventoryPeriodPhase(item, today) === "overdue";

  return (
    <ListCard
      title={
        <span className="flex items-center gap-2">
          <span className="tabular-nums">{item.period}</span>
          {isCurrent && (
            <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs font-medium">
              {t("current")}
            </span>
          )}
          {isOverdue && (
            <span className="text-warning-ink inline-flex items-center gap-1 text-xs font-medium">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {t("overdue")}
            </span>
          )}
        </span>
      }
      badge={
        <StatusIconLabel
          status={item.status}
          label={statusConfig?.label ?? item.status}
        />
      }
    >
      <ListCardRow label={t("dateRange")}>
        <span className="tabular-nums">
          {formatDate(item.start_at, dateFormat)} –{" "}
          {formatDate(item.end_at, dateFormat)}
        </span>
      </ListCardRow>
    </ListCard>
  );
}
