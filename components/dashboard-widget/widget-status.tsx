import { useTranslations } from "use-intl";
import type { WidgetParams } from "@/types/dashboard-widget";
import { statusMeta, statusOf } from "./status-meta";
import { splitPicked } from "./widget-shape";

/**
 * param ตัวกรองของ micro-data (`service/dashboard/filters.go`) — badge บอกแค่ว่ากรอง
 * กี่รายการ ชื่อจริงต้องยิง lookup ซึ่งแถบเล็ก ๆ ใต้หัวการ์ดไม่คุ้ม
 */
const FILTER_KEYS = [
  "categories",
  "locations",
  "vendors",
  "departments",
  "from_locations",
  "to_locations",
] as const;

/**
 * ไอคอนหลักของ tile แบบ custom ตาม document state (workflow status) — ใช้แทน
 * SubTile รูปเอกสารเดิมสำหรับ widget กลุ่ม document.* ที่กรองด้วย status. สี icon +
 * bg จางมาจาก `var(--status-*)` (ชุดเดียวกับ badge สถานะทั้งแอป). ทรงโค้งเข้าชุดกับ
 * SubTile (rounded-lg) เพื่อให้ layout เดิมไม่ขยับ.
 */
export function StatusTile({
  status,
  size = 32,
}: {
  readonly status: string;
  readonly size?: number;
}) {
  const { Icon, cssVar } = statusMeta(status);
  const icon = Math.round(size * 0.55);
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-lg"
      style={{
        width: size,
        height: size,
        color: `var(${cssVar})`,
        backgroundColor: `color-mix(in oklab, var(${cssVar}) 14%, transparent)`,
      }}
    >
      <Icon style={{ width: icon, height: icon }} />
    </span>
  );
}

/**
 * แถบสรุป param ใต้ชื่อ tile — status เป็น label สี(canonical, ไอคอนไปอยู่ที่
 * StatusTile ตัวหลักแล้ว จึงไม่ซ้ำ) + ช่วงเวลา + งวดที่เทียบ + จำนวนที่กรอง. อ่านจาก
 * widget.params ล้วน: "@today"→time range, ที่เหลือ→status; periods / period +
 * compare_to → รายการงวด; ตัวกรอง (FILTER_KEYS) → "3 locations".
 */
export function WidgetParamsBadges({
  params,
}: {
  readonly params?: WidgetParams | null;
}) {
  const tStatus = useTranslations("status");
  const tRange = useTranslations("dashboard.savedWidget.timeRange");
  const tFilter = useTranslations("dashboard.savedWidget.filterCount");

  const status = statusOf(params);
  const range =
    typeof params?.time_range === "string" && params.time_range
      ? params.time_range
      : null;
  const periodLabel = (v: string) => {
    const key = v.replace(/^@/, "");
    return v.startsWith("@") && tRange.has(key) ? tRange(key) : v;
  };
  const periodPicks = splitPicked(params?.periods).map(periodLabel);
  const vsPeriod =
    params?.period || params?.compare_to
      ? `${periodLabel(String(params?.period || "@current_period"))} vs ${periodLabel(String(params?.compare_to || "@previous_period"))}`
      : null;
  const periodText =
    vsPeriod ?? (periodPicks.length ? periodPicks.join(" · ") : null);
  const filters = FILTER_KEYS.flatMap((key) => {
    const count = splitPicked(params?.[key]).length;
    return count > 0 ? [tFilter(key, { count })] : [];
  });
  if (!status && !range && !periodText && filters.length === 0) return null;

  const rangeKey = range?.replace(/^@/, "");

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {status && (
        <span
          className="text-micro-legal font-semibold"
          style={{ color: `var(${statusMeta(status).cssVar})` }}
        >
          {tStatus.has(status) ? tStatus(status) : status}
        </span>
      )}
      {range && (
        <span className="text-muted-foreground bg-muted text-micro-legal inline-flex items-center rounded-md px-1.5 py-0.5 font-medium">
          {rangeKey && tRange.has(rangeKey) ? tRange(rangeKey) : range}
        </span>
      )}
      {periodText && (
        <span className="text-muted-foreground bg-muted text-micro-legal inline-flex items-center rounded-md px-1.5 py-0.5 font-medium">
          {periodText}
        </span>
      )}
      {filters.map((text) => (
        <span
          key={text}
          className="text-muted-foreground bg-muted text-micro-legal inline-flex items-center rounded-md px-1.5 py-0.5 font-medium"
        >
          {text}
        </span>
      ))}
    </div>
  );
}
