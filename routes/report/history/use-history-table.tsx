import { useTranslations } from "use-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { StatusChip } from "@/components/ui/status-chip";
import {
  REPORT_FORMAT_LABELS,
  normalizeJobStatus,
} from "@/constant/report-history";
import { safeNavigationHref } from "@/lib/utils";
import type { ReportFormatRaw, ReportHistory } from "@/types/report-history";

export function useHistoryTable(): ColumnDef<ReportHistory>[] {
  const t = useTranslations("reportHistory");

  return [
    {
      id: "index",
      header: "#",
      cell: ({ row }) => row.index + 1,
      size: 50,
    },
    {
      accessorKey: "file_name",
      header: t("reportName"),
      cell: ({ row }) => {
        const name = row.original.file_name ?? row.original.report_type;
        // ไฟล์รายงานเป็น presigned URL ที่ backend คืนมา — กรอง `javascript:`/`data:`
        // ทิ้งก่อนเสมอ ค่าที่ผ่านไม่ได้จะแสดงเป็นข้อความเฉย ๆ เหมือนตอนไม่มีไฟล์
        const url = safeNavigationHref(row.original.file_url);
        if (url) {
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-xs underline-offset-4 hover:underline"
            >
              {name}
            </a>
          );
        }
        return <span className="text-xs">{name}</span>;
      },
    },
    {
      accessorKey: "report_type",
      header: t("reportType"),
      cell: ({ getValue }) => (
        <span className="text-xs">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "format",
      header: t("format"),
      cell: ({ getValue }) => (
        <span className="text-xs">
          {REPORT_FORMAT_LABELS[getValue<ReportFormatRaw>()] ?? "-"}
        </span>
      ),
      size: 80,
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ getValue }) => {
        const key = normalizeJobStatus(getValue<string>());
        if (!key) return "-";
        return <StatusChip status={key} label={t(key)} />;
      },
      size: 120,
    },
    {
      accessorKey: "row_count",
      header: () => <div className="text-right">{t("rowCount")}</div>,
      cell: ({ getValue }) => {
        const v = getValue<number | undefined>();
        return (
          <span className="block text-right text-xs tabular-nums">
            {v != null ? v.toLocaleString() : "-"}
          </span>
        );
      },
      size: 80,
    },
  ];
}
