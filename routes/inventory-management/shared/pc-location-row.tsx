import { Link } from "react-router";
import { useTranslations } from "use-intl";
import {
  ChevronRight,
  Warehouse,
  Eye,
  Play,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { getLocationTypeLabel } from "@/constant/location-type";
import { STATUS_DOT_CHIP } from "@/constant/status-config";
import {
  getPcActionLabel,
  PC_ACTION_BUTTON_VARIANTS,
  type PcActionType,
} from "@/constant/pc-action-type";
import type {
  PhysicalCountLocation,
  PhysicalCountStatus,
} from "@/types/physical-count";
import { LocationRow, type SectionTone } from "./inv-shared";

const STATUS_TONE: Record<PhysicalCountStatus, SectionTone> = {
  in_progress: "warning",
  completed: "success",
  not_started: "info",
};

const PROGRESS_TONE: Record<SectionTone, "warning" | "success" | "info"> = {
  warning: "warning",
  success: "success",
  info: "info",
};

/**
 * คอลัมน์ของแถวต้องกว้างคงที่ทุกแถว — แต่ละแถวเป็น grid ของตัวเอง ถ้าใช้ `auto`
 * ตัวเลข/ปุ่มจะเยื้องกันตามความยาวข้อความของแต่ละแถว
 */
const PC_ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_11rem_8rem_7rem]";

interface PcLocationRowProps {
  readonly item: PhysicalCountLocation;
  readonly onAction: (item: PhysicalCountLocation) => void;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly pending?: boolean;
}

export function PcLocationRow({
  item,
  onAction,
  disabled,
  disabledReason,
  pending,
}: PcLocationRowProps) {
  const t = useTranslations("inventoryManagement.physicalCount");
  const { dateFormat } = useProfile();

  const tone = STATUS_TONE[item.physical_count_status] ?? "info";
  const isComplete = item.physical_count_status === "completed";
  const isInProgress = item.physical_count_status === "in_progress";

  const total = item.product_total ?? 0;
  const counted = item.product_counted ?? 0;
  const progress = total > 0 ? Math.round((counted / total) * 100) : 0;

  const startedAt = item.completed_at ?? item.start_counting_at;

  let actionType: PcActionType = "start";
  if (isComplete) actionType = "done";
  else if (isInProgress) actionType = "resume";

  const ActionIcon = actionType === "done" ? Eye : Play;
  const actionLabel = getPcActionLabel(t, actionType);

  return (
    <LocationRow tone={tone}>
      <div className={PC_ROW_GRID}>
        <div className="order-1 min-w-0 sm:order-none">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              to={`/config/location/${item.id}`}
              className="text-foreground truncate text-sm font-semibold tracking-tight hover:underline"
            >
              {item.name}
            </Link>
            <span className="text-muted-foreground text-micro-legal shrink-0 tracking-wide uppercase">
              {item.code}
            </span>
            {/* ป้ายขึ้นเฉพาะข้อยกเว้น — ถ้าทุกแถวเขียน "Count" ก็ไม่ได้บอกอะไร */}
            {item.physical_count_type !== "yes" && (
              <Badge
                size="xs"
                className={`${STATUS_DOT_CHIP} before:bg-muted-foreground/40 shrink-0`}
              >
                {t("notCount")}
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground text-micro mt-0.5 flex items-center gap-1">
            <Warehouse className="size-2.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {getLocationTypeLabel(t, item.location_type)}
            </span>
          </div>
        </div>

        <div className="order-3 flex items-center gap-2 sm:order-none">
          <Progress
            value={progress}
            variant={progress > 0 ? PROGRESS_TONE[tone] : "muted"}
            className="h-1 flex-1"
            aria-label={t("progress")}
          />
          <span className="text-muted-foreground text-micro w-16 shrink-0 text-right tabular-nums">
            <span className="text-foreground font-semibold">{counted}</span>/
            {total}
          </span>
        </div>

        <div className="text-muted-foreground text-micro order-4 truncate text-right tabular-nums sm:order-none sm:text-left">
          {startedAt
            ? t("started", { date: formatDate(startedAt, dateFormat) })
            : null}
        </div>

        <div className="order-2 justify-self-end sm:order-none">
          {actionType === "done" ? (
            <span className="text-muted-foreground text-micro inline-flex items-center gap-1 font-semibold tracking-wider uppercase">
              <CheckCircle2
                className="text-success-ink size-3"
                aria-hidden="true"
              />
              {actionLabel}
            </span>
          ) : (
            <Button
              size="sm"
              variant={PC_ACTION_BUTTON_VARIANTS[actionType]}
              onClick={() => onAction(item)}
              disabled={disabled || pending}
              title={disabled ? disabledReason : undefined}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ActionIcon className="size-3.5" aria-hidden="true" />
              )}
              {actionLabel}
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </LocationRow>
  );
}
