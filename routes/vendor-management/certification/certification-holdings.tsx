import { useTranslations } from "use-intl";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import type { Certification } from "@/types/certification";

/**
 * สุขภาพของใบรับรอง: "ใช้ได้ X/Y" + แถบสัดส่วน ใช้ได้ / ใกล้หมด / หมดอายุ
 * + ป้ายใกล้หมด/หมดอายุ (แสดงเฉพาะที่มีจริง)
 *
 * "ใช้ได้" นับใบที่ใกล้หมดด้วย — ยังไม่หมดอายุ ยังซื้อได้ ป้าย "ใกล้หมด" บอกแยกอยู่แล้ว
 * แถบเป็นตัวช่วยกวาดตาเท่านั้น (aria-hidden) ตัวเลขกับป้ายคือข้อมูลจริง สีจึงไม่ใช่
 * สัญญาณเดียว · backend รุ่นที่ยังไม่ส่ง vendor_count → "—" แทนการแสดง 0 ที่ชวนเข้าใจผิด
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

  const total = item.vendor_count;
  const expiring = item.expiring_count ?? 0;
  const expired = item.expired_count ?? 0;
  const ok = Math.max(total - expiring - expired, 0);
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div data-slot="cell-stack" className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="tabular-nums">
          {t("validOfTotal", { valid: total - expired, total })}
        </span>
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
      <div
        aria-hidden
        className="bg-muted flex h-1 w-full max-w-32 gap-px overflow-hidden rounded-full"
      >
        {ok > 0 && <span className="bg-success" style={{ width: pct(ok) }} />}
        {expiring > 0 && (
          <span className="bg-warning" style={{ width: pct(expiring) }} />
        )}
        {expired > 0 && (
          <span className="bg-destructive" style={{ width: pct(expired) }} />
        )}
      </div>
    </div>
  );
}
