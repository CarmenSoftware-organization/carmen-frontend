import { Calendar, Clock } from "lucide-react";
import { useListReturn } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import { STATUS_DOT_CHIP } from "@/constant/status-config";
import { Progress } from "@/components/ui/progress";
import { BackButton } from "@/components/share/back-button";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";

interface PcEntryHeaderProps {
  readonly locationName: string;
  readonly locationCode: string;
  readonly status?: string | null;
  readonly countedCount: number;
  readonly totalItems: number;
  readonly percent: number;
  readonly startCountingAt?: string | null;
  readonly lastSaved?: string | null;
}

export function PcEntryHeader({
  locationName,
  locationCode,
  status,
  countedCount,
  totalItems,
  percent,
  startCountingAt,
  lastSaved,
}: PcEntryHeaderProps) {
  const t = useTranslations("inventoryManagement.physicalCount");
  const ts = useTranslations("status");
  const { toList } = useListReturn("/inventory-management/physical-count");
  const { dateFormat } = useProfile();

  return (
    <div className="border-border/60 bg-card mb-3 rounded-xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {/* mt-0.5 ให้ปุ่มตรงกับบรรทัดแรกของ title ที่มีบรรทัดย่อยใต้ลงมา */}
          <BackButton onClick={() => toList()} className="mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-foreground mt-1 text-base leading-tight font-semibold tracking-tight">
                {locationName || "—"}
              </h1>
              <Badge size="xs" className={`${STATUS_DOT_CHIP} before:bg-info`}>
                {status && ts.has(status) ? ts(status) : t("tabInProgress")}
              </Badge>
            </div>

            <div className="text-muted-foreground text-micro-legal mt-2 flex flex-wrap items-center gap-2 tracking-wide uppercase">
              <p>{locationCode}</p>
              {startCountingAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="size-2.5" aria-hidden="true" />
                  {formatDate(startCountingAt, dateFormat)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="size-2.5" aria-hidden="true" />
                {t("lastSaved", { time: lastSaved ?? "--:--" })}
              </span>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-foreground mt-1 text-sm font-semibold tabular-nums">
            {countedCount}{" "}
            <span className="text-muted-foreground text-xs">
              / {totalItems}
            </span>
          </p>
          <p className="text-muted-foreground text-micro-legal">
            {t("percentComplete", { percent })}
          </p>
        </div>
      </div>

      <Progress value={percent} variant="auto" className="mt-3 h-1" />
    </div>
  );
}
