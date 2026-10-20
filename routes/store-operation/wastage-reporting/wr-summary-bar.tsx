import { useTranslations } from "use-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { WASTAGE_WINDOW_DAYS } from "@/constant/wastage-reporting";
import type { WastageStatus, WastageSummary } from "@/types/wastage-reporting";

interface WrSummaryBarProps {
  /** ยอดของทั้งชุด (ไม่ผ่านตัวกรองสถานะ) — ใช้นับในปุ่มให้ทุกปุ่มบอกจำนวนจริงเสมอ */
  readonly counts?: WastageSummary;
  /** มูลค่าเสี่ยงของชุดที่กำลังดูอยู่ (ผ่านตัวกรองแล้ว) */
  readonly valueAtRisk?: number;
  readonly status: WastageStatus | "";
  readonly onStatusChange: (status: WastageStatus | "") => void;
}

/**
 * แถบบนตาราง: ซ้ายคือตัวกรองสถานะแบบ segmented ที่บอกจำนวนในตัว (แทนตัวกรองใน
 * เมนู Filter ที่ต้องเปิดก่อนถึงจะรู้ว่ามีกี่แถว) ขวาคือมูลค่าเสี่ยงเป็นตัวเลขหลัก
 * ตัวเดียว — ไม่มียอด "จำนวนเสี่ยง" รวมเพราะแต่ละล็อตคนละหน่วย (kg + ขวด + แพ็ค)
 * บวกกันแล้วไม่มีความหมาย
 */
export function WrSummaryBar({
  counts,
  valueAtRisk,
  status,
  onStatusChange,
}: WrSummaryBarProps) {
  const t = useTranslations("storeOperation.wastageReporting");

  const segments: {
    value: WastageStatus | "";
    label: string;
    count?: number;
    dot?: string;
  }[] = [
    { value: "", label: t("segmentAll"), count: counts?.total_items },
    {
      value: "expired",
      label: t("segmentExpired"),
      count: counts?.expired_count,
      dot: "bg-destructive",
    },
    {
      value: "expiring",
      label: t("segmentExpiring", { days: WASTAGE_WINDOW_DAYS }),
      count: counts?.expiring_count,
      dot: "bg-warning",
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div
        role="radiogroup"
        aria-label={t("statusFilterAria")}
        className="bg-muted inline-flex max-w-full overflow-x-auto rounded-lg p-[3px]"
      >
        {segments.map((s) => {
          const active = status === s.value;
          return (
            <button
              key={s.value || "all"}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onStatusChange(s.value)}
              className={cn(
                "focus-visible:ring-ring/50 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap outline-none focus-visible:ring-2",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.dot && (
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 rounded-full", s.dot)}
                />
              )}
              {s.label}
              {counts ? (
                <span
                  className={cn(
                    "tabular-nums",
                    active ? "text-foreground" : "text-muted-foreground/80",
                  )}
                >
                  {s.count?.toLocaleString()}
                </span>
              ) : (
                <Skeleton className="h-3 w-4" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground text-xs">
          {t("valueAtRisk")}
        </span>
        {valueAtRisk === undefined ? (
          <Skeleton className="h-5 w-24 self-center" />
        ) : (
          <span className="text-base font-semibold tabular-nums">
            {formatCurrency(valueAtRisk)}
          </span>
        )}
      </div>
    </div>
  );
}
