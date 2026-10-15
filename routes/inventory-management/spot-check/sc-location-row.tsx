import { useState } from "react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import {
  ChevronRight,
  CircleSlash,
  Play,
  RotateCcw,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { useResetSpotCheck } from "./use-sc";
import { getLocationTypeLabel } from "@/constant/location-type";
import { LocationRow, type SectionTone } from "../shared/inv-shared";
import { ScDocStatusRow } from "./sc-doc-status-row";
import { ScResetDialog } from "./sc-reset-dialog";
import type {
  SpotCheckLocation,
  SpotCheckLocationLatest,
} from "@/types/spot-check";

/** คอลัมน์กว้างคงที่ทุกแถว — ดูเหตุผลที่ `PC_ROW_GRID` */
const SC_ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_13rem_10rem_9rem]";

interface ScLocationRowProps {
  readonly item: SpotCheckLocation;
  readonly tone: SectionTone;
  readonly onStart: (item: SpotCheckLocation) => void;
  readonly onResume: (
    item: SpotCheckLocation,
    latest: SpotCheckLocationLatest,
  ) => void;
}

export function ScLocationRow({
  item,
  tone,
  onStart,
  onResume,
}: ScLocationRowProps) {
  const t = useTranslations("inventoryManagement.spotCheck");
  const tfl = useTranslations("field");
  const { dateFormat } = useProfile();

  const latest = item.latest_spot_check;

  const resetSc = useResetSpotCheck();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    if (!latest) return;
    resetSc.mutate(latest.id, {
      onSuccess: () => {
        toast.success(t("resetSuccess"));
        setShowResetConfirm(false);
      },
    });
  };

  const progress =
    latest && latest.size > 0
      ? Math.round((latest.counted / latest.size) * 100)
      : 0;

  return (
    <LocationRow tone={tone}>
      <div className={SC_ROW_GRID}>
        <div className="order-1 min-w-0 sm:order-none">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              to={`/config/location/${item.location_id}`}
              className="text-foreground truncate text-sm font-semibold tracking-tight hover:underline"
            >
              {item.name || "..."}
            </Link>
            <span className="text-muted-foreground text-micro-legal shrink-0 tracking-wide uppercase">
              {item.code}
            </span>
            {/* ขึ้นเฉพาะข้อยกเว้น — แถวที่ต้องนับคือค่าปกติ */}
            {item.physical_count_type !== "yes" && (
              <span
                title={t("notCountable")}
                aria-label={t("notCountable")}
                className="bg-muted text-muted-foreground/70 inline-flex size-4 shrink-0 items-center justify-center rounded-full"
              >
                <CircleSlash className="size-2.5" aria-hidden="true" />
              </span>
            )}
          </div>
          <div className="text-muted-foreground text-micro mt-0.5 flex items-center gap-1">
            <Warehouse className="size-2.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {getLocationTypeLabel(t, item.location_type)}
            </span>
          </div>
        </div>

        <div className="order-3 min-w-0 sm:order-none">
          {latest && (
            <ScDocStatusRow
              docNo={latest.spot_check_no}
              docStatus={latest.doc_status}
              method={latest.method}
              size="sm"
              stacked
            />
          )}
        </div>

        <div className="order-4 min-w-0 sm:order-none">
          {latest && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Progress
                  value={progress}
                  variant={
                    progress >= 100
                      ? "success"
                      : progress > 0
                        ? "warning"
                        : "muted"
                  }
                  className="h-1 flex-1"
                  aria-label={tfl("items")}
                />
                <span className="text-muted-foreground text-micro w-16 shrink-0 text-right tabular-nums">
                  <span className="text-foreground font-semibold">
                    {latest.counted}
                  </span>
                  /{latest.size}
                </span>
              </div>
              <div className="text-muted-foreground text-micro truncate tabular-nums">
                {tfl("startDate")} {formatDate(latest.start_date, dateFormat)}
              </div>
            </div>
          )}
        </div>

        <div className="order-2 flex items-center justify-end gap-1 sm:order-none">
          {latest ? (
            <>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setShowResetConfirm(true)}
                      disabled={resetSc.isPending}
                      aria-label={t("reset")}
                      className="text-muted-foreground hover:text-destructive rounded-full"
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{t("reset")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                size="sm"
                variant="default"
                onClick={() => onResume(item, latest)}
              >
                <Play className="size-3.5" aria-hidden="true" />
                {t("resume")}
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onStart(item)}>
              <Play className="size-3.5" aria-hidden="true" />
              {t("start")}
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {latest && (
        <ScResetDialog
          open={showResetConfirm}
          onOpenChange={setShowResetConfirm}
          isPending={resetSc.isPending}
          onConfirm={handleReset}
        />
      )}
    </LocationRow>
  );
}
