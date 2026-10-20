import { useTranslations } from "use-intl";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { WASTAGE_URGENT_DAYS } from "@/constant/wastage-reporting";

type Urgency = "expired" | "urgent" | "soon";

const urgencyOf = (days: number): Urgency =>
  days < 0 ? "expired" : days <= WASTAGE_URGENT_DAYS ? "urgent" : "soon";

const TEXT_CLASS: Record<Urgency, string> = {
  expired: "text-destructive",
  urgent: "text-warning-ink",
  soon: "text-foreground",
};

interface ExpiryUrgencyProps {
  readonly daysToExpiry: number;
  readonly expiredAt: string;
  /** `inline` = คำกับวันที่บรรทัดเดียว (เซลล์ compact บนมือถือ) */
  readonly variant?: "stacked" | "inline";
}

/**
 * แทนคอลัมน์ Expiry Date / Days Left / Status สามช่อง — คำถามของหน้านี้คือ "ต้อง
 * จัดการล็อตไหนก่อน" ตัวเลขติดลบกับป้ายสถานะแยกกันตอบด้วยตาไม่ได้ จึงพูดเป็นคำ
 * ("เลยมา 3 วัน" / "อีก 5 วัน") สีตามความเร่งด่วน วันที่จริงเป็นบรรทัดรองจาง ๆ
 * แบบเดียวกับเลข/วันที่ใบแจ้งหนี้ในตาราง GRN
 */
export function ExpiryUrgency({
  daysToExpiry,
  expiredAt,
  variant = "stacked",
}: ExpiryUrgencyProps) {
  const t = useTranslations("storeOperation.wastageReporting");
  const { dateFormat } = useProfile();
  const urgency = urgencyOf(daysToExpiry);

  const label =
    daysToExpiry < 0
      ? t("daysOverdue", { count: -daysToExpiry })
      : daysToExpiry === 0
        ? t("expiresToday")
        : t("daysLeft", { count: daysToExpiry });
  const date = formatDate(expiredAt, dateFormat);

  if (variant === "inline") {
    return (
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span
          className={cn("truncate text-xs font-medium", TEXT_CLASS[urgency])}
        >
          {label}
        </span>
        <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
          {date}
        </span>
      </span>
    );
  }

  return (
    <div className="min-w-0">
      <span
        className={cn("block truncate font-medium", TEXT_CLASS[urgency])}
        title={label}
      >
        {label}
      </span>
      <span className="text-muted-foreground block text-xs tabular-nums">
        {date}
      </span>
    </div>
  );
}
