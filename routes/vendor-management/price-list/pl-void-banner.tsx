import { useTranslations } from "use-intl";
import { Ban } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { PriceList } from "@/types/price-list";

interface PlVoidBannerProps {
  readonly priceList: PriceList;
}

/**
 * แถบแจ้งว่าใบนี้เป็นโมฆะ — เวลา + เหตุผลเท่านั้น ไม่มีชื่อผู้โมฆะ (ruling R11)
 *
 * ใบที่ถูกแปลงจาก soft-delete เดิมไม่มี `voided_at`/`void_reason` → แสดง "—"
 * ท่าเดียวกับ `LicenseExpiredBanner`: พื้น neutral สีแดงอยู่ที่ไอคอนจุดเดียว
 * (docs/DESIGN.md) จึงอ่านออกทั้งธีมสว่างและมืดด้วย token ล้วน
 */
export function PlVoidBanner({ priceList }: PlVoidBannerProps) {
  const t = useTranslations("vendorManagement.priceList");
  const { dateTimeFormat } = useProfile();
  const at = formatDate(priceList.voided_at, dateTimeFormat) || "—";
  const reason = priceList.void_reason?.trim() || "—";

  return (
    <div
      role="status"
      className="bg-muted mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
    >
      <Ban className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="text-foreground font-medium">
          {t("voidedBanner", { at })}
        </p>
        <p className="text-muted-foreground break-words">
          {t("voidReasonLabel")}: {reason}
        </p>
      </div>
    </div>
  );
}
