import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, GitBranch, GripVertical, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslations } from "use-intl";
import type { Role } from "@/types/workflows";
import { cn } from "@/lib/utils";
import { StageRailMarker, StageRailSummary } from "./wf-stage-rail-node";

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

/** โหนดบนรางที่ลากเรียงได้ — ภาพมาจาก `wf-stage-rail-node.tsx` ตัวนี้เพิ่มแค่ dnd + ปุ่ม */
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

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-start gap-3",
        isDragging && "z-10 opacity-80",
      )}
    >
      <StageRailMarker
        index={index}
        isFirst={isFirst}
        isLast={isLast}
        isSelected={isSelected}
      />

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
          <StageRailSummary
            name={name}
            role={role}
            slaLabel={slaLabel}
            userCount={userCount}
            isHod={isHod}
            isLast={isLast}
          />
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
