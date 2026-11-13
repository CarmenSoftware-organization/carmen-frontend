import { ArrowUpRight, FileText, Rows3 } from "lucide-react";
import { useTranslations } from "use-intl";

import { StatusChip } from "@/components/ui/status-chip";
import {
  REPORT_FORMAT_LABELS,
  normalizeJobStatus,
} from "@/constant/report-history";
import { cn, safeNavigationHref } from "@/lib/utils";
import type {
  ReportFormatRaw,
  ReportHistory,
  ReportStatus,
} from "@/types/report-history";

interface HistoryCardProps {
  readonly item: ReportHistory;
}

const STATUS_COLOR: Record<ReportStatus, string> = {
  queued: "var(--status-pending)",
  processing: "var(--status-in-progress)",
  completed: "var(--status-completed)",
  failed: "var(--destructive)",
  cancelled: "var(--status-cancelled)",
};

export default function HistoryCard({ item }: HistoryCardProps) {
  const t = useTranslations("reportHistory");

  const statusKey = normalizeJobStatus(item.status);
  const accent = statusKey
    ? STATUS_COLOR[statusKey]
    : "var(--muted-foreground)";
  const formatLabel =
    REPORT_FORMAT_LABELS[item.format as ReportFormatRaw] ?? item.format;
  const name = item.file_name ?? item.report_type;
  // presigned URL จาก backend — กรอง `javascript:`/`data:` ทิ้งก่อนเสมอ การ์ดที่ URL
  // ไม่ผ่านจะกดไม่ได้เหมือนตอนที่ยังไม่มีไฟล์ (ไม่ใช่กดแล้วเงียบ)
  const fileHref = safeNavigationHref(item.file_url);
  const hasUrl = !!fileHref;

  const open = () => {
    if (fileHref) {
      globalThis.window.open(fileHref, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      role={hasUrl ? "button" : undefined}
      tabIndex={hasUrl ? 0 : undefined}
      onClick={hasUrl ? open : undefined}
      onKeyDown={
        hasUrl
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open();
              }
            }
          : undefined
      }
      className={cn(
        "group border-border/60 bg-card relative flex flex-col overflow-hidden rounded-2xl border transition-colors",
        "focus-visible:ring-primary/40 focus-visible:ring-2 focus-visible:outline-none",
        hasUrl &&
          "hover:border-primary/40 cursor-pointer hover:-translate-y-0.5",
      )}
    >
      {/* Status accent bar — widens on hover */}
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-0.5 rounded-r-full opacity-70 transition-all group-hover:inset-y-0 group-hover:w-1 group-hover:opacity-100"
        style={{ backgroundColor: accent }}
      />

      {/* Header — icon tile + title */}
      <div className="relative flex items-start gap-3 px-4 pt-4 pb-2">
        {/* Icon tile — gradient per status */}
        <div
          className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklch, ${accent}, transparent 75%) 0%, color-mix(in oklch, ${accent}, transparent 88%) 100%)`,
          }}
        >
          <FileText
            className="relative size-4"
            style={{ color: accent }}
            aria-hidden
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h3 className="text-foreground truncate text-sm font-semibold tracking-tight">
              {name}
            </h3>
            {hasUrl && (
              <ArrowUpRight
                className="text-muted-foreground/60 group-hover:text-primary mt-0.5 size-3.5 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                aria-hidden
              />
            )}
          </div>
          <div className="text-muted-foreground text-micro mt-1 flex items-center gap-1.5">
            <span className="font-semibold tracking-wide uppercase">
              {item.report_type}
            </span>
            <span aria-hidden className="text-border">
              ·
            </span>
            <span>{formatLabel}</span>
          </div>
        </div>
      </div>

      {/* Footer — rows + status pill */}
      <div className="border-border/40 relative mt-auto flex items-center justify-between gap-2 border-t px-4 py-2">
        <div className="text-muted-foreground text-micro inline-flex items-center gap-1.5">
          {item.row_count != null ? (
            <>
              <Rows3 className="size-3" aria-hidden />
              <span className="tabular-nums">
                {item.row_count.toLocaleString()}
              </span>
              <span>{t("rowCount").toLowerCase()}</span>
            </>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )}
        </div>

        {statusKey && <StatusChip status={statusKey} label={t(statusKey)} />}
      </div>
    </div>
  );
}
