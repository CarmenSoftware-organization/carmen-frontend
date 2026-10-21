import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Crown,
  GitBranch,
  GripVertical,
  Play,
  Users,
  Trash2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslations } from "use-intl";
import type { Role } from "@/types/workflows";
import { cn } from "@/lib/utils";
import { ROLE_ICON, ROLE_LABEL } from "./wf-role-colors";

/** กฎ routing ที่เริ่มจากขั้นนี้ — แสดงเป็นชิปเดียวพร้อม tooltip รายชื่อปลายทาง */
export interface StageRouteHint {
  readonly name: string;
  readonly target: string;
}

interface SortableStageItemProps {
  readonly id: string;
  readonly index: number;
  readonly name: string;
  readonly role?: Role;
  readonly slaLabel?: string;
  readonly routes?: StageRouteHint[];
  readonly isSelected: boolean;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly onClick: () => void;
  readonly userCount?: number;
  readonly isHod?: boolean;
  readonly hasWarning?: boolean;
  readonly dragDisabled?: boolean;
  readonly onDelete?: () => void;
}

/**
 * โหนดหนึ่งตัวบนราง stage — เลขลำดับนับเฉพาะขั้นกลาง (ขั้นสร้างเป็นไอคอน Play
 * ขั้นจบเป็น CheckCircle2) ให้ตรงกันทุกจุดในหน้า เส้นเชื่อมแนวตั้งวาดโดย
 * container (`WfStageList`) ตัวมาร์กเกอร์มีพื้น bg-card จึงทับเส้นพอดี
 */
export default function SortableStageItem({
  id,
  index,
  name,
  role,
  slaLabel,
  routes = [],
  isSelected,
  isFirst,
  isLast,
  onClick,
  userCount = 0,
  isHod = false,
  hasWarning = false,
  dragDisabled = false,
  onDelete,
}: SortableStageItemProps) {
  const t = useTranslations("systemAdmin.workflow");
  const isDragDisabled = isFirst || isLast || dragDisabled;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isDragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const RoleIcon = role ? ROLE_ICON[role] : null;

  const renderMarker = () => {
    if (isLast) return <CheckCircle2 className="size-3.5" />;
    if (isFirst) return <Play className="size-3 fill-current" />;
    return index;
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-start gap-3",
        isDragging && "z-10 opacity-80",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative z-1 mt-2 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
          isSelected
            ? "border-primary bg-primary text-primary-foreground"
            : "bg-card text-muted-foreground",
        )}
      >
        {renderMarker()}
      </span>

      <div
        className={cn(
          "focus-within:ring-ring flex min-w-0 flex-1 items-start gap-1 rounded-lg border px-3 py-2 transition-colors focus-within:ring-2",
          isSelected
            ? "border-primary bg-primary/5"
            : "hover:border-border hover:bg-muted/50 border-transparent",
          isDragging && "bg-background shadow-lg",
        )}
      >
        <button
          type="button"
          className="min-w-0 flex-1 cursor-pointer bg-transparent text-left"
          onClick={onClick}
          aria-current={isSelected ? "step" : undefined}
        >
          <span className="flex items-center gap-1.5">
            <span className="text-foreground truncate text-sm font-medium">
              {name}
            </span>
            {isHod && !isLast && (
              <Crown
                className="text-warning-ink size-3.5 shrink-0"
                aria-label={t("isHod")}
              />
            )}
          </span>

          {!isLast && (
            <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
              {RoleIcon && role && (
                <span className="inline-flex items-center gap-1">
                  <RoleIcon className="size-3" aria-hidden="true" />
                  {t(ROLE_LABEL[role])}
                </span>
              )}
              {!isHod && userCount > 0 && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Users className="size-3" aria-hidden="true" />
                  {userCount}
                </span>
              )}
              {slaLabel && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="size-3" aria-hidden="true" />
                  {slaLabel}
                </span>
              )}
            </span>
          )}
        </button>

        <span className="flex shrink-0 items-center gap-0.5">
          {hasWarning && (
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex p-1"
                  role="img"
                  aria-label={t("warningNoUsers")}
                >
                  <AlertCircle className="text-destructive size-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-sm">
                {t("warningNoUsers")}
              </TooltipContent>
            </Tooltip>
          )}
          {routes.length > 0 && (
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <span
                  className="text-info-ink inline-flex items-center gap-0.5 p-1 text-xs tabular-nums"
                  role="img"
                  aria-label={`${t("routing")}: ${routes.length}`}
                >
                  <GitBranch className="size-3.5" aria-hidden="true" />
                  {routes.length}
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-sm">
                <ul className="space-y-0.5">
                  {routes.map((r, i) => (
                    <li key={`${r.name}-${i}`}>
                      {r.name} → {r.target}
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}
          {!isDragDisabled && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground cursor-grab touch-none rounded p-1 transition-colors active:cursor-grabbing"
              aria-label="Drag to reorder"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>
          )}
          {onDelete && !isDragDisabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer rounded p-1 transition-colors"
              aria-label={t("deleteTitle")}
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </span>
      </div>
    </li>
  );
}
