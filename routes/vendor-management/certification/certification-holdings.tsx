import { useTranslations } from "use-intl";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import type { Certification } from "@/types/certification";

/**
 * จำนวนผู้ขายที่ถือใบนี้ + ป้ายใกล้หมด/หมดอายุ (แสดงเฉพาะที่มีจริง)
 * backend รุ่นที่ยังไม่ส่ง vendor_count → "—" แทนการแสดง 0 ที่ชวนเข้าใจผิด
 */
export function CertificationHoldings({
  item,
}: {
  readonly item: Certification;
}) {
  const t = useTranslations("vendorManagement.certification");

  if (item.vendor_count === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (item.vendor_count === 0) {
    return <span className="text-muted-foreground">{t("noHolders")}</span>;
  }

  const expiring = item.expiring_count ?? 0;
  const expired = item.expired_count ?? 0;

  return (
    <div
      data-slot="cell-stack"
      className="flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      <span className="tabular-nums">{item.vendor_count}</span>
      {expiring > 0 && (
        <StatusDotBadge tone="warning" size="xs">
          {t("expiringCount", { count: expiring })}
        </StatusDotBadge>
      )}
      {expired > 0 && (
        <StatusDotBadge tone="destructive" size="xs">
          {t("expiredCount", { count: expired })}
        </StatusDotBadge>
      )}
    </div>
  );
}
