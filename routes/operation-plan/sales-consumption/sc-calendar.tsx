import { Link } from "react-router";
import { ChevronLeft, ChevronRight, FileWarning, History } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import type {
  ScCalendarDay,
  ScCalendarStatus,
} from "@/types/sales-consumption";
import { shiftMonth, todayIso } from "./sc-month";
import { useSalesConsumptionCalendar } from "./use-sales-consumption";

/** สีพื้น/ข้อความของแต่ละสถานะ — ข้อความใช้ token `*-ink` เพื่อให้ผ่าน WCAG AA ทั้งสองธีม */
const STATUS_CLASS: Record<ScCalendarStatus, string> = {
  posted: "bg-success/10 border-success/40 text-success-ink",
  pending: "bg-warning/10 border-warning/40 text-warning-ink",
  no_sales: "bg-muted border-border text-muted-foreground",
  no_file: "bg-destructive/10 border-destructive/40 text-destructive",
  future: "border-dashed text-muted-foreground",
  before_start: "border-dashed text-muted-foreground opacity-60",
};

const LEGEND: readonly ScCalendarStatus[] = [
  "posted",
  "pending",
  "no_sales",
  "no_file",
];

/** วันจันทร์เป็นฐานสำหรับสร้างชื่อวันในสัปดาห์ (UTC) */
const MONDAY = Date.UTC(2024, 0, 1);

interface ScCalendarProps {
  readonly month: string;
  readonly onMonthChange: (month: string) => void;
}

/**
 * ปฏิทินรายเดือน — หนึ่งช่อง = หนึ่งวัน = SC ใบเดียว เริ่มสัปดาห์ที่วันจันทร์
 * ช่อง posted / pending ที่มี SC เป็นลิงก์ไปรายละเอียด ช่องอื่นเป็นข้อความ
 * ทุกช่องมีข้อความสถานะกำกับ ไม่ใช้สีอย่างเดียว
 *
 * @param month เดือน `YYYY-MM`
 * @param onMonthChange เรียกเมื่อกดเดือนก่อน/ถัดไป
 * @returns React element ของปฏิทิน
 */
export function ScCalendar({ month, onMonthChange }: ScCalendarProps) {
  const t = useTranslations("operationPlan.salesConsumption.list");
  const locale = useLocale();
  const { data, isLoading, error, refetch } =
    useSalesConsumptionCalendar(month);

  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDate = new Map<string, ScCalendarDay>(
    (data ?? []).map((d) => [d.date, d]),
  );
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(first);
  const dateLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(MONDAY + i * 86_400_000)),
  );
  const today = todayIso();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t("calendar.prev")}
          onClick={() => onMonthChange(shiftMonth(month, -1))}
        >
          <ChevronLeft />
        </Button>
        <h2
          className="min-w-36 text-center text-sm font-medium"
          aria-live="polite"
        >
          {monthLabel}
        </h2>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t("calendar.next")}
          onClick={() => onMonthChange(shiftMonth(month, 1))}
        >
          <ChevronRight />
        </Button>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekdays.map((w) => (
            <div
              key={w}
              className="text-muted-foreground pb-1 text-center text-xs"
            >
              {w}
            </div>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <div key={`blank-${i}`} aria-hidden />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const iso = `${month}-${String(day).padStart(2, "0")}`;
            const info = byDate.get(iso);
            if (isLoading || !info) {
              return (
                <Skeleton
                  key={iso}
                  className="min-h-16 rounded-md sm:min-h-20"
                />
              );
            }
            return (
              <DayCell
                key={iso}
                info={info}
                day={day}
                isToday={iso === today}
                label={dateLabel.format(new Date(`${iso}T00:00:00Z`))}
              />
            );
          })}
        </div>
      )}

      <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
        {LEGEND.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("size-3 rounded-sm border", STATUS_CLASS[s])}
            />
            {t(`calendar.status.${s}`)}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <History aria-hidden className="size-3.5" />
          {t("calendar.lateLegend")}
        </li>
        <li className="flex items-center gap-1.5">
          <FileWarning aria-hidden className="size-3.5" />
          {t("calendar.incompleteLegend")}
        </li>
      </ul>
    </div>
  );
}

interface DayCellProps {
  readonly info: ScCalendarDay;
  readonly day: number;
  readonly isToday: boolean;
  readonly label: string;
}

function DayCell({ info, day, isToday, label }: DayCellProps) {
  const t = useTranslations("operationPlan.salesConsumption.list.calendar");
  const { status } = info;
  const statusText = t(`status.${status}`);
  const late = info.late_lines > 0;
  const incomplete = info.missing_stores > 0;
  const href =
    (status === "posted" || status === "pending") && info.sc_id
      ? `/operation-plan/sales-consumption/${info.sc_id}`
      : null;

  const aria = [
    label,
    statusText,
    status === "pending" && info.unresolved_count > 0
      ? t("unresolved", { count: info.unresolved_count })
      : null,
    late ? t("late", { count: info.late_lines }) : null,
    incomplete ? t("incomplete", { count: info.missing_stores }) : null,
  ]
    .filter(Boolean)
    .join(", ");

  const className = cn(
    "flex min-h-16 min-w-0 flex-col gap-0.5 rounded-md border p-1 text-xs sm:min-h-20 sm:p-2",
    STATUS_CLASS[status],
    isToday && "ring-ring ring-2",
    href &&
      "hover:brightness-95 focus-visible:ring-2 focus-visible:outline-none",
  );

  const body = (
    <>
      <span className="flex items-center justify-between gap-1">
        <span className="font-medium tabular-nums">{day}</span>
        <span className="flex items-center gap-0.5">
          {late && <History aria-hidden className="size-3" />}
          {incomplete && <FileWarning aria-hidden className="size-3" />}
        </span>
      </span>
      {status !== "future" && status !== "before_start" && (
        <span className="leading-tight font-medium break-words">
          {statusText}
        </span>
      )}
      {status === "pending" && info.unresolved_count > 0 && (
        <span className="leading-tight break-words">
          {t("unresolved", { count: info.unresolved_count })}
        </span>
      )}
    </>
  );

  return href ? (
    <Link to={href} aria-label={aria} className={className}>
      {body}
    </Link>
  ) : (
    <div role="group" aria-label={aria} className={className}>
      {body}
    </div>
  );
}
