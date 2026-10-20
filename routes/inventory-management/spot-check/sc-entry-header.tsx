import { Calendar, ClipboardCheck, MapPin } from "lucide-react";
import { useListReturn } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { getSpotCheckMethodLabel } from "@/constant/spot-check-method";
import type { SpotCheckMethod, SpotCheckStatus } from "@/types/spot-check";
import { METHOD_VISUAL, STATUS_VISUAL } from "./sc-status-visual";
import { BackButton } from "@/components/share/back-button";
import { SC_LIST_PATHS } from "./sc-paths";

interface ScEntryHeaderProps {
  readonly locationName: string;
  readonly locationCode: string;
  readonly docStatus?: SpotCheckStatus;
  readonly method?: SpotCheckMethod;
  readonly startDate?: string | null;
  readonly countedCount: number;
  readonly totalItems: number;
  readonly percent: number;
}

export function ScEntryHeader({
  locationName,
  locationCode,
  docStatus,
  method,
  startDate,
  countedCount,
  totalItems,
  percent,
}: ScEntryHeaderProps) {
  const t = useTranslations("inventoryManagement.spotCheck");
  const ts = useTranslations("status");
  const { toList } = useListReturn(SC_LIST_PATHS);
  const { dateFormat } = useProfile();

  const status = STATUS_VISUAL[docStatus ?? "pending"] ?? STATUS_VISUAL.pending;
  const methodVis = METHOD_VISUAL[method ?? "random"] ?? METHOD_VISUAL.random;
  const MethodIcon = methodVis.icon;
  const methodLabel = method ? getSpotCheckMethodLabel(t, method) : "";

  return (
    <div className="border-border/60 bg-card mb-3 rounded-xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {/* mt-0.5 ให้ปุ่มตรงกับบรรทัดแรกของ title ที่มีบรรทัดย่อยใต้ลงมา */}
          <BackButton onClick={() => toList()} className="mt-0.5" />
          <div className="min-w-0">
            <span className="bg-primary/10 text-primary text-micro-eyebrow inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold tracking-widest uppercase">
              <ClipboardCheck className="size-2.5" />
              {t("entryTitle")}
            </span>
            <h1 className="text-foreground mt-1 text-base leading-tight font-semibold tracking-tight">
              {locationName || "—"}
            </h1>
            <p className="text-muted-foreground text-micro-legal mt-0.5 tracking-wide uppercase">
              {locationCode}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {docStatus && (
            <Badge
              variant={status.variant}
              size="xs"
              className={cn(
                "text-micro-eyebrow gap-1 px-2 font-semibold tracking-wider uppercase",
                status.className,
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  status.dotClass,
                  status.pulse && "animate-pulse",
                )}
                aria-hidden="true"
              />
              {ts(docStatus)}
            </Badge>
          )}
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

      <div className="text-muted-foreground text-micro mt-2 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1">
          <MapPin className="size-2.5" aria-hidden="true" />
          {locationName}
        </span>
        <span className="flex items-center gap-1">
          <MethodIcon className="size-2.5" aria-hidden="true" />
          {methodLabel}
        </span>
        {startDate && (
          <span className="flex items-center gap-1">
            <Calendar className="size-2.5" aria-hidden="true" />
            {formatDate(startDate, dateFormat)}
          </span>
        )}
      </div>
    </div>
  );
}
