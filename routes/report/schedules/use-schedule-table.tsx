import { Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import type { ReportFormat, ReportSchedule } from "@/types/report-schedule";

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

function formatScheduleConfig(
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

interface UseScheduleTableOptions {
  readonly onDelete: (schedule: ReportSchedule) => void;
}

export function useScheduleTableColumns({
  onDelete,
}: UseScheduleTableOptions): ColumnDef<ReportSchedule>[] {
  const t = useTranslations("reportSchedule");
  const tc = useTranslations("common");
  const weekdayShort = [
    t("wdSun"),
    t("wdMon"),
    t("wdTue"),
    t("wdWed"),
    t("wdThu"),
    t("wdFri"),
    t("wdSat"),
  ];

  return [
    {
      id: "index",
      header: "#",
      cell: ({ row }) => row.index + 1,
      size: 50,
    },
    { accessorKey: "name", header: t("name") },
    { accessorKey: "report_type", header: t("reportType") },
    {
      accessorKey: "format",
      header: t("format"),
      cell: ({ getValue }) => {
        const v = getValue<ReportFormat>();
        if (v === "REPORT_FORMAT_VIEWER_URL" || v === "viewer_url")
          return t("formatViewerLink");
        return FORMAT_LABELS[v] ?? "-";
      },
      size: 80,
    },
    {
      accessorKey: "cron_expression",
      header: t("frequency"),
      cell: ({ row }) => formatScheduleConfig(row.original, t, weekdayShort),
      size: 200,
    },
    {
      accessorKey: "notify_at",
      header: t("notifyAtColumn"),
      cell: ({ row }) => {
        const { notify_at, notify_day_offset } = row.original;
        if (!notify_at) return t("notifyImmediately");
        // "+1" ต่อท้ายเหมือนเวลาถึงของเที่ยวบินที่ข้ามวัน — ไม่งั้นเวลาที่เร็วกว่า
        // เวลารันจะอ่านดูเหมือนตั้งผิด
        return notify_day_offset
          ? `${notify_at} (+${notify_day_offset})`
          : notify_at;
      },
      size: 120,
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
      size: 160,
    },
    {
      accessorKey: "next_run_at",
      header: t("nextRun"),
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? new Date(v).toLocaleString() : "-";
      },
    },
    {
      accessorKey: "last_run_at",
      header: t("lastRun"),
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? new Date(v).toLocaleString() : "-";
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(row.original)}
          aria-label={tc("delete")}
        >
          <Trash2 className="text-destructive size-4" />
        </Button>
      ),
      size: 50,
    },
  ];
}
