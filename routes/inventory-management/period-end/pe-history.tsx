import { Archive } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";
import EmptyComponent from "@/components/empty-component";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { formatLocalizedDate } from "@/lib/date-utils";
import { usePeriodEnd } from "./use-period-end";

/**
 * คอลัมน์กว้างคงที่ทุกแถว — แต่ละแถวเป็น grid ของตัวเอง ถ้าใช้ `auto` วันที่กับสถานะ
 * จะเยื้องกันตามความยาวข้อความของแต่ละแถว (แบบเดียวกับ `PC_ROW_GRID`)
 * กล่องแคบเหลือสองคอลัมน์: งวด | สถานะ แล้วช่วงวันที่กับผู้แก้ล่าสุดลงบรรทัดถัดไป
 * (เรียงด้วย `order-*`) — สามคอลัมน์ในจอ 375px ตัดช่วงวันที่เหลือ "Apr 01, 20…"
 * ตัดสินจากความกว้างการ์ด (`@container`) ไม่ใช่จอ — วัดจริง (ไทย): ช่วงวันที่ 188 · ผู้แก้ 150
 * สี่คอลัมน์ = 96 + 200 + 112 + 150 + gap 48 + padding 32 = 638 จึงแยกที่ 40rem (640px)
 * ช่วงวันที่ตั้งเพดาน 12.5rem ไม่ใช่ 16rem — grid ขยายคอลัมน์ minmax จนเต็มเพดานก่อนแบ่งให้ 1fr
 * เพดาน 16rem ทำให้ผู้แก้ล่าสุดเหลือ ~96px ที่การ์ด 640px
 */
const HISTORY_ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 @min-[40rem]:grid-cols-[6rem_minmax(0,12.5rem)_7rem_minmax(0,1fr)]";

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

      {/* โครงเดียวกับการ์ดจริง (หัวตาราง + แถว) ข้อมูลมาแล้วเนื้อหาไม่กระโดด */}
      {isLoading && (
        <div className="bg-card @container overflow-hidden rounded-xl border">
          <div className="bg-muted/40 hidden h-8 border-b @min-[40rem]:block" />
          <div className="divide-y">
            {[0, 1].map((i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="bg-muted/20 rounded-xl border border-dashed">
          <EmptyComponent icon={Archive} title={t("noHistory")} />
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="bg-card @container overflow-hidden rounded-xl border">
          <div
            aria-hidden="true"
            className={`${HISTORY_ROW_GRID} text-muted-foreground text-micro bg-muted/40 hidden border-b px-4 py-2 font-semibold tracking-wide uppercase @min-[40rem]:grid`}
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
                  <span className="text-foreground order-1 font-semibold tabular-nums @min-[40rem]:order-none">
                    {item.period}
                  </span>
                  <span className="text-muted-foreground order-3 col-span-2 truncate tabular-nums @min-[40rem]:order-none @min-[40rem]:col-span-1">
                    {formatLocalizedDate(item.start_at, locale)} –{" "}
                    {formatLocalizedDate(item.end_at, locale)}
                  </span>
                  <span className="order-2 @min-[40rem]:order-none">
                    <StatusChip
                      status={item.status}
                      label={t(`status.${item.status}`)}
                    />
                  </span>
                  <span className="text-muted-foreground order-4 col-span-2 truncate text-xs @min-[40rem]:order-none @min-[40rem]:col-span-1">
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
