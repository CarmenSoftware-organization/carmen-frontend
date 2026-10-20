import { useTranslations } from "use-intl";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import {
  WASTAGE_URGENT_DAYS,
  WASTAGE_WINDOW_DAYS,
} from "@/constant/wastage-reporting";

type Urgency = "expired" | "urgent" | "soon";

const urgencyOf = (days: number): Urgency =>
  days < 0 ? "expired" : days <= WASTAGE_URGENT_DAYS ? "urgent" : "soon";

const TEXT_CLASS: Record<Urgency, string> = {
  expired: "text-destructive",
  urgent: "text-warning-ink",
  soon: "text-foreground",
};

const FILL_CLASS: Record<Exclude<Urgency, "expired">, string> = {
  urgent: "bg-warning",
  soon: "bg-muted-foreground/50",
};

interface ExpiryUrgencyProps {
  readonly daysToExpiry: number;
  readonly expiredAt: string;
  /** `inline` = คำกับวันที่บรรทัดเดียว ไม่มีแถบ (เซลล์ compact บนมือถือ) */
  readonly variant?: "stacked" | "inline";
}

/**
 * แทนคอลัมน์ Expiry Date / Days Left / Status สามช่อง — คำถามของหน้านี้คือ "ต้อง
 * จัดการล็อตไหนก่อน" ตัวเลขติดลบกับป้ายสถานะแยกกันตอบด้วยตาไม่ได้ จึงพูดเป็นคำ
 * ("เลยมา 3 วัน" / "อีก 5 วัน") สีตามความเร่งด่วน บรรทัดรองคือแถบระยะที่เหลือในช่วง
 * window (หมดแล้ว = รางสีแดงจางไม่มีเนื้อแถบ) ตามด้วยวันที่จริง
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

  const fill =
    urgency === "expired"
      ? "0%"
      : `${Math.max(4, Math.min(100, (daysToExpiry / WASTAGE_WINDOW_DAYS) * 100))}%`;

  const date = (
    <span className="text-muted-foreground text-micro whitespace-nowrap tabular-nums">
      {formatDate(expiredAt, dateFormat)}
    </span>
  );

  if (variant === "inline") {
    return (
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span
          className={cn(
            "truncate text-xs font-semibold tabular-nums",
            TEXT_CLASS[urgency],
          )}
        >
          {label}
        </span>
        {date}
      </span>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span
        className={cn(
          "truncate text-sm font-semibold tabular-nums",
          TEXT_CLASS[urgency],
        )}
      >
        {label}
      </span>
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "relative h-1 w-10 shrink-0 rounded-full",
            urgency === "expired" ? "bg-destructive/25" : "bg-muted",
          )}
        >
          {urgency !== "expired" && (
            <span
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                FILL_CLASS[urgency],
              )}
              style={{ width: fill }}
            />
          )}
        </span>
        {date}
      </span>
    </div>
  );
}
