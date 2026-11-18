import { Bell, History, Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import type { ReportFormat, ReportSchedule } from "@/types/report-schedule";
import { indexColumn } from "@/components/ui/data-grid/columns";

const FORMAT_LABELS: Record<ReportFormat, string> = {
  REPORT_FORMAT_PDF: "PDF",
  REPORT_FORMAT_EXCEL: "Excel",
  REPORT_FORMAT_CSV: "CSV",
  REPORT_FORMAT_JSON: "JSON",
  REPORT_FORMAT_VIEWER_URL: "Viewer Link",
  viewer_url: "Viewer Link",
  pdf: "PDF",
  excel: "Excel",
  csv: "CSV",
  json: "JSON",
};

export function formatScheduleConfig(
  row: ReportSchedule,
  t: ReturnType<typeof useTranslations>,
  weekdayShort: readonly string[],
): string {
  const cfg = row.schedule_config;
  if (!cfg) return row.cron_expression;
  const { frequency, time } = cfg;
  if (frequency === "daily") return t("freqDaily", { time });
  if (frequency === "weekly") {
    const days = (cfg.days_of_week ?? [])
      .map((d) => weekdayShort[d])
      .join(", ");
    return t("freqWeekly", { days, time });
  }
  if (frequency === "monthly") {
    const days = (cfg.days_of_month ?? []).join(", ");
    return t("freqMonthly", { days, time });
  }
  return row.cron_expression;
}

export function formatLabel(
  v: ReportFormat,
  t: ReturnType<typeof useTranslations>,
): string {
  if (v === "REPORT_FORMAT_VIEWER_URL" || v === "viewer_url")
    return t("formatViewerLink");
  return FORMAT_LABELS[v] ?? "-";
}

export function formatNotifyAt(
  row: ReportSchedule,
  t: ReturnType<typeof useTranslations>,
): string {
  const { notify_at, notify_day_offset } = row;
  if (!notify_at) return t("notifyImmediately");
  // "+1" ต่อท้ายเหมือนเวลาถึงของเที่ยวบินที่ข้ามวัน — ไม่งั้นเวลาที่เร็วกว่า
  // เวลารันจะอ่านดูเหมือนตั้งผิด
  return notify_day_offset ? `${notify_at} (+${notify_day_offset})` : notify_at;
}

// ไม่มีวินาที — รอบรันตั้งเป็นนาทีเสมอ วินาทีเป็น ":00" ที่กินที่ช่องเปล่า ๆ
export const formatRunAt = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "-";

export function useWeekdayShort(): string[] {
  const t = useTranslations("reportSchedule");
  return [
    t("wdSun"),
    t("wdMon"),
    t("wdTue"),
    t("wdWed"),
    t("wdThu"),
    t("wdFri"),
    t("wdSat"),
  ];
}

/** กล่องแคบกว่านี้ (px) แสดงเป็นการ์ดแถวละใบ — ตารางขั้นต่ำ 620px ใส่ไม่ลง */
export const SCHEDULE_CARD_BELOW = 560;

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * คอลัมน์สั้นกว้างคงที่ ชื่อรับที่เหลือ (`meta.grow`) ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size`:
 * ชื่อ 160 + ความถี่ 150 + สถานะ 120 + รอบถัดไป 170 + ปุ่ม 60 = 660 (กล่องที่จอ 768 = 662)
 * · + รูปแบบ 80 = 740 · + # 50 = 790 · + แจ้งเตือน 190 = 980 · + ประเภท 160 = 1140
 * · + รอบล่าสุด 170 = 1310 — จุดเปลี่ยนขั้นตั้งสูงกว่าผลรวมราว 80–100px ให้ชื่อมีที่ก่อน
 * ของที่ซ่อนยังเห็นได้: ประเภท/รูปแบบ = บรรทัดรองใต้ชื่อ · แจ้งเตือน = บรรทัดรองใต้ความถี่
 * · รอบล่าสุด = บรรทัดรองใต้รอบถัดไป
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showFormat: w >= 820,
    showIndex: w >= 880,
    showNotify: w >= 1070,
    showType: w >= 1230,
    showLastRun: w >= 1400,
  };
}

const secondary =
  "text-muted-foreground flex min-w-0 items-center gap-1 text-xs [&>svg]:size-3 [&>svg]:shrink-0";

interface UseScheduleTableOptions {
  readonly schedules: ReportSchedule[];
  readonly onDelete: (schedule: ReportSchedule) => void;
  /** ความกว้างของกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด โชว์ครบทุกคอลัมน์ */
  readonly containerWidth?: number;
}

export function useScheduleTable({
  schedules,
  onDelete,
  containerWidth,
}: UseScheduleTableOptions) {
  "use no memo";
  const t = useTranslations("reportSchedule");
  const tc = useTranslations("common");
  const weekdayShort = useWeekdayShort();
  const { showFormat, showIndex, showNotify, showType, showLastRun } =
    columnTier(containerWidth);

  const columns: ColumnDef<ReportSchedule>[] = [
    indexColumn<ReportSchedule>(),
    {
      accessorKey: "name",
      header: t("name"),
      size: 160,
      meta: { grow: true },
      cell: ({ row }) => {
        const r = row.original;
        const sub = [
          !showType && r.report_type,
          !showFormat && formatLabel(r.format, t),
        ].filter(Boolean);
        return (
          <div className="min-w-0">
            <span className="block truncate" title={r.name}>
              {r.name}
            </span>
            {sub.length > 0 && (
              <span
                className="text-muted-foreground block truncate text-xs"
                title={sub.join(" · ")}
              >
                {sub.join(" · ")}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "report_type",
      header: t("reportType"),
      size: 160,
      cell: ({ getValue }) => (
        <span className="block truncate" title={getValue<string>()}>
          {getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: "format",
      header: t("format"),
      cell: ({ getValue }) => formatLabel(getValue<ReportFormat>(), t),
      size: 80,
    },
    {
      accessorKey: "cron_expression",
      header: t("frequency"),
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate">
            {formatScheduleConfig(row.original, t, weekdayShort)}
          </span>
          {!showNotify && (
            <span className={secondary} title={t("notifyAtColumn")}>
              <Bell aria-label={t("notifyAtColumn")} />
              <span className="truncate">
                {row.original.notify_at
                  ? formatNotifyAt(row.original, t)
                  : t("notifyImmediatelyShort")}
              </span>
            </span>
          )}
        </div>
      ),
      size: 150,
    },
    {
      accessorKey: "notify_at",
      header: t("notifyAtColumn"),
      cell: ({ row }) => formatNotifyAt(row.original, t),
      size: 190,
    },
    {
      accessorKey: "is_active",
      header: t("active"),
      cell: ({ getValue, row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge active={getValue<boolean>()} />
          {/* template ใช้กับ BU นี้ไม่ได้แล้ว (allow/deny BU หรือวิธีคิดต้นทุน) — รอบรันถูกข้าม */}
          {row.original.template_available === false && (
            <Badge
              variant="warning"
              size="sm"
              title={t("templateUnavailableHint")}
            >
              {t("templateUnavailable")}
            </Badge>
          )}
        </div>
      ),
      size: 120,
    },
    {
      accessorKey: "next_run_at",
      header: t("nextRun"),
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate">
            {formatRunAt(row.original.next_run_at)}
          </span>
          {!showLastRun && (
            <span className={secondary} title={t("lastRun")}>
              <History aria-label={t("lastRun")} />
              <span className="truncate">
                {formatRunAt(row.original.last_run_at)}
              </span>
            </span>
          )}
        </div>
      ),
      size: 170,
    },
    {
      accessorKey: "last_run_at",
      header: t("lastRun"),
      cell: ({ row }) => formatRunAt(row.original.last_run_at),
      size: 170,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(row.original)}
          aria-label={tc("delete")}
          title={tc("delete")}
        >
          <Trash2 className="text-destructive size-4" />
        </Button>
      ),
      size: 60,
    },
  ];

  return useReactTable({
    data: schedules,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnVisibility: {
        index: showIndex,
        report_type: showType,
        format: showFormat,
        notify_at: showNotify,
        last_run_at: showLastRun,
      },
    },
  });
}
