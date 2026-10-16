import { Archive } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";
import EmptyComponent from "@/components/empty-component";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { formatLocalizedDate } from "@/lib/date-utils";
import { usePeriodEnd } from "./use-period-end";

/**
 * คอลัมน์กว้างคงที่ทุกแถว — แต่ละแถวเป็น grid ของตัวเอง ถ้าใช้ `auto` วันที่กับสถานะ
 * จะเยื้องกันตามความยาวข้อความของแต่ละแถว (แบบเดียวกับ `PC_ROW_GRID`)
 * จอแคบเหลือสองคอลัมน์: งวด | สถานะ แล้วช่วงวันที่กับผู้แก้ล่าสุดลงบรรทัดถัดไป
 * (เรียงด้วย `order-*`) — สามคอลัมน์ในจอ 375px ตัดช่วงวันที่เหลือ "Apr 01, 20…"
 */
const HISTORY_ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[6rem_minmax(0,16rem)_7rem_minmax(0,1fr)]";

export default function PeHistory() {
  const locale = useLocale();
  const t = useTranslations("inventoryManagement.periodEnd");
  const { data, isLoading } = usePeriodEnd();

  const items = data?.data ?? [];

  return (
    <section
      aria-labelledby="pe-history"
      className="animate-fade-in-up space-y-3"
      style={{ animationDelay: "120ms" }}
    >
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <h2 id="pe-history" className="text-sm font-semibold">
            {t("history")}
          </h2>
          <p className="text-muted-foreground text-xs">{t("historyDesc")}</p>
        </div>
        {items.length > 0 && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {t("historyCount", {
              count: data?.paginate?.total ?? items.length,
            })}
          </span>
        )}
      </header>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="bg-muted/20 rounded-xl border border-dashed">
          <EmptyComponent icon={Archive} title={t("noHistory")} />
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="bg-card overflow-hidden rounded-xl border">
          <div
            aria-hidden="true"
            className={`${HISTORY_ROW_GRID} text-muted-foreground text-micro bg-muted/40 hidden border-b px-4 py-2 font-semibold tracking-wide uppercase sm:grid`}
          >
            <span>{t("fields.period")}</span>
            <span>{t("historyColumns.range")}</span>
            <span>{t("fields.status")}</span>
            <span>{t("historyColumns.updated")}</span>
          </div>
          <ul className="divide-y">
            {items.map((item) => {
              const updated = item.audit?.updated ?? item.audit?.created;
              return (
                <li
                  key={item.id}
                  className={`${HISTORY_ROW_GRID} hover:bg-muted/30 px-4 py-2.5 text-sm transition-colors`}
                >
                  <span className="text-foreground order-1 font-semibold tabular-nums sm:order-none">
                    {item.period}
                  </span>
                  <span className="text-muted-foreground order-3 col-span-2 truncate tabular-nums sm:order-none sm:col-span-1">
                    {formatLocalizedDate(item.start_at, locale)} –{" "}
                    {formatLocalizedDate(item.end_at, locale)}
                  </span>
                  <span className="order-2 sm:order-none">
                    <StatusIconLabel
                      status={item.status}
                      label={t(`status.${item.status}`)}
                    />
                  </span>
                  <span className="text-muted-foreground order-4 col-span-2 truncate text-xs sm:order-none sm:col-span-1">
                    {updated
                      ? `${updated.name} · ${formatLocalizedDate(updated.at, locale)}`
                      : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
