import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLocale as useIntlLocale, useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { INVENTORY_PERIOD_STATUS_CONFIG } from "@/constant/inventory-period";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import type { InventoryPeriod } from "@/types/inventory-period";
import {
  getInventoryPeriodPhase,
  type InventoryPeriodPhase,
} from "./inventory-period-phase";

/**
 * แถบสีบนหัวไทล์ต่อ phase — สี lifecycle มาจาก `--status-*` (badge-status.css) ส่วน
 * "ค้างปิด" ใช้ `--warning` เป็นสีพื้น (ไม่ใช่ข้อความ จึงไม่ติดกฎ ink) รอบที่ยังไม่ถึงใช้สี
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

/**
 * ไทล์ 12 ช่องต่อปี จำนวนคอลัมน์เป็นตัวหารของ 12 เสมอ (2/3/4/6/12) แถวสุดท้ายจึงไม่แหว่ง
 * ตัดสินจากความกว้างกล่อง (container query) ไม่ใช่ความกว้างจอ — เมนูซ้ายพับ/กางได้
 */
const TILE_GRID =
  "grid grid-cols-2 gap-2 @xl:grid-cols-3 @3xl:grid-cols-4 @6xl:grid-cols-6 @[120rem]:grid-cols-12";

interface YearGroup {
  readonly year: number;
  /** ช่องว่าง = ยังไม่มีรอบเดือนนั้น */
  readonly months: (InventoryPeriod | undefined)[];
  /** fiscal_month ของช่องแรกใน `months` (หลังตัดเดือนว่างหัวปี) */
  readonly firstMonth: number;
  readonly openCount: number;
  readonly closedCount: number;
  readonly fullyClosed: boolean;
}

interface Props {
  /** รอบ **ทั้งหมด** ของ BU (ไม่แบ่งหน้า) — มีปีละ 12 แถว */
  readonly periods: InventoryPeriod[];
  readonly currentPeriodId?: string;
  readonly today: string;
}

/**
 * กระดานรอบสินค้าคงคลัง แทนตารางแบ่งหน้า — รอบมีจำนวนจำกัด (ปีละ 12) และคำถามของหน้านี้คือ
 * "ตอนนี้อยู่รอบไหน เปิดอยู่ถึงเมื่อไร ค้างปิดกี่รอบ" ซึ่งตารางเรียงแถวตอบไม่ได้ในแวบเดียว
 *
 * - จัดกลุ่มตามปีบัญชี เรียงเก่า → ใหม่ แต่ละปีเป็นไทล์ 12 เดือน
 * - ปีที่ปิดครบทุกรอบก่อนช่วงที่เปิดอยู่ พับไว้หลังปุ่มเดียว ช่วงที่เปิดอยู่จึงขึ้นจอแรกเสมอ
 *   ไม่ว่า BU จะใช้งานมากี่ปี
 */
export function InventoryPeriodBoard({
  periods,
  currentPeriodId,
  today,
}: Props) {
  const t = useTranslations("systemAdmin.inventoryPeriod");
  const [showClosedYears, setShowClosedYears] = useState(false);

  const years = useMemo<YearGroup[]>(() => {
    const byYear = new Map<number, InventoryPeriod[]>();
    for (const p of periods) {
      const list = byYear.get(p.fiscal_year) ?? [];
      list.push(p);
      byYear.set(p.fiscal_year, list);
    }
    return [...byYear.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, list]) => {
        const months: (InventoryPeriod | undefined)[] = Array.from({
          length: 12,
        });
        for (const p of list) {
          if (p.fiscal_month >= 1 && p.fiscal_month <= 12)
            months[p.fiscal_month - 1] = p;
        }
        // ตัดเดือนว่างหัว/ท้ายปีออก (ก่อนเริ่มใช้ระบบ / ยังไม่ถึงคิวสร้าง) — เหลือช่องว่าง
        // เฉพาะรูโหว่กลางปีซึ่งผิดปกติจริงและควรเห็น
        const firstIdx = months.findIndex(Boolean);
        const lastIdx = months.findLastIndex(Boolean);
        const closedCount = list.filter((p) => p.status === "closed").length;
        return {
          year,
          months: months.slice(firstIdx, lastIdx + 1),
          firstMonth: firstIdx + 1,
          openCount: list.length - closedCount,
          closedCount,
          fullyClosed: closedCount === list.length,
        };
      });
  }, [periods]);

  // พับเฉพาะปีที่ปิดครบซึ่งอยู่ "ก่อน" ปีแรกที่ยังมีรอบเปิด — ปีที่ปิดครบแต่อยู่หลัง
  // (ไม่ควรเกิด) ยังโชว์ จะได้ไม่ซ่อนความผิดปกติ
  const firstOpenIdx = years.findIndex((y) => !y.fullyClosed);
  const foldCount = firstOpenIdx === -1 ? 0 : firstOpenIdx;
  const visible = showClosedYears ? years : years.slice(foldCount);

  const openPeriods = useMemo(
    () =>
      periods
        .filter((p) => p.status !== "closed")
        .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [periods],
  );
  const overdueCount = openPeriods.filter(
    (p) => getInventoryPeriodPhase(p, today) === "overdue",
  ).length;
  const first = openPeriods.at(0);
  const last = openPeriods.at(-1);

  return (
    <div className="@container space-y-4">
      {/* สรุปบรรทัดเดียว: ช่วงที่เปิดอยู่ + ค้างปิด — ตัวนับค้างปิดนับทุกปี รวมปีที่พับไว้ */}
      <div className="bg-card flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border px-3 py-2">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold">{t("openTitle")}</span>
          <span className="tabular-nums">{openPeriods.length}</span>
          {first && last ? (
            <span className="text-muted-foreground tabular-nums">
              {first.period} – {last.period}
            </span>
          ) : (
            <span className="text-muted-foreground">{t("noOpenPeriod")}</span>
          )}
        </p>
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

      {foldCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          aria-expanded={showClosedYears}
          onClick={() => setShowClosedYears((v) => !v)}
        >
          {showClosedYears ? (
            <ChevronUp aria-hidden="true" />
          ) : (
            <ChevronDown aria-hidden="true" />
          )}
          {showClosedYears
            ? t("closedYearsHide")
            : t("closedYearsShow", { count: foldCount })}
        </Button>
      )}

      {visible.map((y) => (
        <section key={y.year} aria-labelledby={`fy-${y.year}`}>
          <header className="mb-2 flex items-baseline gap-3">
            <h2
              id={`fy-${y.year}`}
              className="text-sm font-semibold tabular-nums"
            >
              {t("fiscalYearLabel", { year: y.year })}
            </h2>
            <span className="text-muted-foreground text-xs tabular-nums">
              {t("yearSummary", { open: y.openCount, closed: y.closedCount })}
            </span>
          </header>
          <ol className={TILE_GRID}>
            {y.months.map((p, i) => (
              <li key={p?.id ?? `empty-${i}`} className="min-w-0">
                {p ? (
                  <PeriodTile
                    period={p}
                    isCurrent={p.id === currentPeriodId}
                    today={today}
                  />
                ) : (
                  <EmptyTile month={y.firstMonth + i} />
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function PeriodTile({
  period: p,
  isCurrent,
  today,
}: {
  readonly period: InventoryPeriod;
  readonly isCurrent: boolean;
  readonly today: string;
}) {
  const t = useTranslations("systemAdmin.inventoryPeriod");
  const locale = useIntlLocale();
  const { dateFormat } = useProfile();
  const phase = getInventoryPeriodPhase(p, today);
  // เดือนบัญชีไม่จำเป็นต้องตรงเดือนปฏิทิน — ชื่อเดือนคิดจาก start_at ของรอบจริง
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    calendar: "gregory",
  }).format(new Date(p.start_at));
  const statusLabel =
    INVENTORY_PERIOD_STATUS_CONFIG[p.status]?.label ?? p.status;

  // บรรทัดล่าง: เฉพาะรอบที่ยังเปิด — ปิด/ล็อกแล้ว ชิปสถานะบอกครบแล้ว
  const phaseNote =
    phase === "overdue" ? (
      <span className="text-warning-ink inline-flex items-center gap-1 font-medium">
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
        {t("overdue")}
      </span>
    ) : phase === "active" ? (
      <span className="text-foreground">{t("phaseActive")}</span>
    ) : phase === "upcoming" ? (
      <span className="text-muted-foreground">{t("phaseUpcoming")}</span>
    ) : null;

  return (
    <article
      aria-current={isCurrent ? "true" : undefined}
      className={cn(
        "relative flex h-full flex-col gap-1 overflow-hidden rounded-lg border px-3 pt-3 pb-2.5",
        // ปิดแล้วถอยไปเป็นพื้นหลัง — ลดที่พื้น ไม่ลดความทึบตัวอักษร (ต้องผ่าน AA)
        p.status === "closed" ? "bg-muted/40" : "bg-card",
        isCurrent && "border-primary ring-primary ring-1",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-x-0 top-0 h-1", PHASE_BAR[phase])}
      />
      <p className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold">{monthLabel}</span>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {p.period}
        </span>
      </p>
      {/* ตัดบรรทัดได้เฉพาะระหว่างสองวันที่ ไม่หักกลางวันที่ */}
      <p className="text-muted-foreground text-xs tabular-nums">
        <span className="whitespace-nowrap">
          {formatDate(p.start_at, dateFormat)}
        </span>{" "}
        –{" "}
        <span className="whitespace-nowrap">
          {formatDate(p.end_at, dateFormat)}
        </span>
      </p>
      {/* บรรทัดสถานะ: รอบที่ยังเปิดบอก phase (ค้างปิด/กำลังใช้/ยังไม่ถึง) ซึ่งละเอียดกว่า
          ชิป "Open" — ชิปสถานะใช้กับรอบที่ปิด/ล็อกแล้วเท่านั้น */}
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs">
        {phaseNote ?? <StatusChip status={p.status} label={statusLabel} />}
        {isCurrent && (
          <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 font-medium">
            {t("current")}
          </span>
        )}
      </div>
    </article>
  );
}

function EmptyTile({ month }: { readonly month: number }) {
  const t = useTranslations("systemAdmin.inventoryPeriod");
  return (
    <div className="text-muted-foreground flex h-full min-h-20 flex-col justify-center rounded-lg border border-dashed px-3 py-2.5 text-xs">
      <span className="tabular-nums">M{month}</span>
      <span>{t("noPeriod")}</span>
    </div>
  );
}

/** โครงเดียวกับกระดานจริง (หัวปี + ไทล์) เนื้อหาจะไม่กระโดดตอนข้อมูลมา */
export function InventoryPeriodBoardSkeleton() {
  return (
    <div className="@container space-y-4">
      <section>
        <Skeleton className="mb-2 h-5 w-40" />
        <div className={TILE_GRID}>
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </section>
    </div>
  );
}
