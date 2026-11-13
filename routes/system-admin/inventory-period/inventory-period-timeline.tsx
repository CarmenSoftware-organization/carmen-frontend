import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLocale as useIntlLocale, useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/date-utils";
import { useProfile } from "@/hooks/use-profile";
import type { InventoryPeriod } from "@/types/inventory-period";
import {
  getInventoryPeriodPhase,
  type InventoryPeriodPhase,
} from "./inventory-period-phase";

/**
 * สีแท่งต่อ phase — สี lifecycle มาจาก `--status-*` (badge-status.css) ส่วน "ค้างปิด"
 * ใช้ `--warning` เป็นสีพื้น (ไม่ใช่ข้อความ จึงไม่ติดกฎ ink) และรอบที่ยังไม่ถึงใช้สี
 * open แบบจาง เพื่อแยก "เปิดไว้รอ" ออกจาก "กำลังใช้อยู่"
 * — utility `bg-status-…` ไม่มีจริง ต้องห่อ token ด้วย var() แบบ arbitrary value
 *   (ห้ามเขียนตัวอย่างคลาสเต็มในคอมเมนต์ — Tailwind กวาดไปเป็น candidate แล้ว CSS เตือน)
 */
const PHASE_BAR: Record<InventoryPeriodPhase, string> = {
  closed: "bg-[var(--status-closed)]",
  locked: "bg-[var(--status-locked)]",
  overdue: "bg-warning",
  active: "bg-[var(--status-open)]",
  upcoming: "bg-[var(--status-open)]/30",
};

interface Props {
  readonly periods: InventoryPeriod[];
  readonly currentPeriodId?: string;
  readonly currentFiscalYear?: number;
  readonly today: string;
}

/**
 * แถบ 12 ช่องของปีบัญชี ช่องละหนึ่งรอบ — ตอบคำถามของหน้านี้ในแวบเดียว:
 * "ตอนนี้อยู่รอบไหน และค้างปิดอยู่กี่รอบ"
 *
 * รับรอบ **ทั้งหมด** ไม่ใช่หน้าปัจจุบันของตาราง เพราะช่องว่างบนแถบแปลว่า
 * "ยังไม่มีรอบนี้" ถ้าส่งมาแค่ 10 แถวแถบจะโกหก
 */
export function InventoryPeriodTimeline({
  periods,
  currentPeriodId,
  currentFiscalYear,
  today,
}: Props) {
  const t = useTranslations("systemAdmin.inventoryPeriod");
  const locale = useIntlLocale();
  const { dateFormat } = useProfile();

  const years = useMemo(
    () =>
      [...new Set(periods.map((p) => p.fiscal_year))].sort((a, b) => a - b),
    [periods],
  );
  const fallbackYear =
    currentFiscalYear ?? years.at(-1) ?? Number(today.slice(0, 4));
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const year = pickedYear ?? fallbackYear;

  const byMonth = useMemo(() => {
    const map = new Map<number, InventoryPeriod>();
    for (const p of periods) {
      if (p.fiscal_year === year) map.set(p.fiscal_month, p);
    }
    return map;
  }, [periods, year]);

  // นับทุกปี ไม่ใช่เฉพาะปีที่กำลังดู — รอบที่ค้างข้ามปีต้องไม่หายไปจากตัวเลข
  const overdueCount = useMemo(
    () =>
      periods.filter((p) => getInventoryPeriodPhase(p, today) === "overdue")
        .length,
    [periods, today],
  );

  const monthFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: "short", calendar: "gregory" }),
    [locale],
  );

  const yearIdx = years.indexOf(year);
  const prevYear = yearIdx > 0 ? years[yearIdx - 1] : undefined;
  const nextYear =
    yearIdx >= 0 && yearIdx < years.length - 1 ? years[yearIdx + 1] : undefined;

  const phaseLabel = (phase: InventoryPeriodPhase) =>
    ({
      overdue: t("overdue"),
      active: t("phaseActive"),
      upcoming: t("phaseUpcoming"),
      closed: t("statusClosed"),
      locked: t("statusLocked"),
    })[phase];

  return (
    <section
      aria-label={t("fiscalYearLabel", { year })}
      className="bg-card rounded-lg border px-3 py-2.5"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={prevYear === undefined}
            onClick={() => prevYear !== undefined && setPickedYear(prevYear)}
            aria-label={t("prevYear")}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="min-w-24 text-center text-sm font-semibold tabular-nums">
            {t("fiscalYearLabel", { year })}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={nextYear === undefined}
            onClick={() => nextYear !== undefined && setPickedYear(nextYear)}
            aria-label={t("nextYear")}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>

        {overdueCount > 0 ? (
          <p className="text-warning-ink flex items-center gap-1.5 text-sm font-medium">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {t("overdueCount", { count: overdueCount })}
          </p>
        ) : (
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <CheckCircle2
              className="text-success-ink size-4 shrink-0"
              aria-hidden="true"
            />
            {t("allOnTrack")}
          </p>
        )}
      </div>

      <ol className="grid grid-cols-12 gap-1">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
          const p = byMonth.get(month);

          if (!p) {
            return (
              <li key={month} className="min-w-0">
                <div
                  className="text-muted-foreground/70 flex flex-col items-center gap-1 px-0.5 pt-0.5 pb-1 text-xs"
                  title={t("noPeriod")}
                >
                  <span className="truncate tabular-nums">M{month}</span>
                  <span className="h-2 w-full rounded-sm border border-dashed" />
                </div>
              </li>
            );
          }

          const phase = getInventoryPeriodPhase(p, today);
          const isCurrent = p.id === currentPeriodId;
          const status = phaseLabel(phase);
          // เดือนบัญชีไม่จำเป็นต้องตรงเดือนปฏิทิน — ชื่อเดือนคิดจาก start_at ของรอบจริง
          const label = monthFmt.format(new Date(p.start_at));

          return (
            <li key={month} className="min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* ไม่ใช่ปุ่ม — รอบแก้ด้วยมือไม่ได้ จึงไม่มีอะไรให้เปิด · ยัง focus ได้
                      เพื่อให้คีย์บอร์ดอ่าน tooltip (ช่วงวันที่) ได้เหมือนเมาส์ */}
                  <div
                    role="img"
                    tabIndex={0}
                    aria-current={isCurrent ? "true" : undefined}
                    aria-label={`${p.period} · ${status}${isCurrent ? ` · ${t("current")}` : ""}`}
                    className={cn(
                      "flex w-full flex-col items-center gap-1 rounded-md px-0.5 pt-0.5 pb-1 text-xs outline-none",
                      "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                      isCurrent && "bg-primary/10 ring-primary ring-1",
                    )}
                  >
                    <span
                      className={cn(
                        "truncate",
                        isCurrent
                          ? "text-primary font-semibold"
                          : phase === "overdue"
                            ? "text-warning-ink font-medium"
                            : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </span>
                    <span
                      className={cn("h-2 w-full rounded-sm", PHASE_BAR[phase])}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <span className="font-medium tabular-nums">{p.period}</span>
                  {" · "}
                  {status}
                  {isCurrent && ` · ${t("current")}`}
                  <br />
                  <span className="tabular-nums">
                    {formatDate(p.start_at, dateFormat)} –{" "}
                    {formatDate(p.end_at, dateFormat)}
                  </span>
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
