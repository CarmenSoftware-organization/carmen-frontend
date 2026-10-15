import { differenceInCalendarDays } from "date-fns";
import { useTranslations } from "use-intl";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

// เหลือไม่เกินกี่วันถึงขึ้นสีเตือน — ราว ๆ หนึ่งรอบสั่งซื้อรายสัปดาห์
const ENDING_SOON_DAYS = 7;

type Validity =
  | { kind: "expired" }
  | { kind: "upcoming"; days: number }
  | { kind: "current"; days: number };

/**
 * ช่วงราคาเทียบกับวันนี้ (วันตามปฏิทินเครื่องผู้ใช้ ปลายช่วงนับรวม)
 * `effectivePeriod` มาเป็น "<from> - <to>" — แยกไม่ได้ก็คืน null
 */
export function periodValidity(period: string, now: Date): Validity | null {
  const parts = period.split(" - ");
  if (parts.length !== 2) return null;
  const from = new Date(parts[0]);
  const to = new Date(parts[1]);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const toEnd = differenceInCalendarDays(to, now);
  if (toEnd < 0) return { kind: "expired" };
  const toStart = differenceInCalendarDays(from, now);
  if (toStart > 0) return { kind: "upcoming", days: toStart };
  return { kind: "current", days: toEnd };
}

/**
 * ช่วงวันที่ + บรรทัดเล็กบอกว่าใช้ได้อยู่ไหม — สถานะใบ (ACTIVE) ไม่ได้บอกว่าช่วงราคา
 * ยังไม่หมด ใบที่ ACTIVE แต่หมดช่วงไปแล้วจึงต้องเห็นได้จากตรงนี้
 */
export function PlPeriodCell({
  period,
  className,
}: {
  readonly period: string;
  readonly className?: string;
}) {
  const t = useTranslations("vendorManagement.priceList");
  const { dateFormat } = useProfile();

  const parts = period.split(" - ");
  if (parts.length !== 2) return <span>{period || "—"}</span>;
  const from = formatDate(parts[0], dateFormat);
  const to = formatDate(parts[1], dateFormat);
  if (!from && !to) return <span className="text-muted-foreground">—</span>;

  const validity = periodValidity(period, new Date());
  const expired = validity?.kind === "expired";
  const endingSoon =
    validity?.kind === "current" && validity.days <= ENDING_SOON_DAYS;

  let note: string | null = null;
  if (validity?.kind === "expired") note = t("periodExpired");
  else if (validity?.kind === "upcoming")
    note = t("periodStartsIn", { count: validity.days });
  else if (validity?.kind === "current")
    note =
      validity.days === 0
        ? t("periodEndsToday")
        : t("periodDaysLeft", { count: validity.days });

  return (
    <div className={cn("min-w-0", className)}>
      <span
        className={cn(
          "block whitespace-nowrap tabular-nums",
          expired && "text-muted-foreground",
        )}
      >
        {from} - {to}
      </span>
      {note && (
        <span
          className={cn(
            "block text-xs whitespace-nowrap",
            endingSoon ? "text-warning-ink" : "text-muted-foreground",
          )}
        >
          {note}
        </span>
      )}
    </div>
  );
}
