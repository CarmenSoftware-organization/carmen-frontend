import { Clock, Lock } from "lucide-react";
import { useLocale } from "use-intl";

import { StatusBadge } from "@/components/ui/status-badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { WorkflowDto } from "@/types/workflows";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import WfFlowStrip from "./wf-flow-strip";
import WfScopeLine from "./wf-scope-line";
import WfRowActions from "./wf-row-actions";

interface WfCardProps {
  readonly item: WorkflowDto;
  readonly index?: number;
  readonly onEdit: (item: WorkflowDto) => void;
  readonly onToggleActive?: (item: WorkflowDto) => void;
  readonly onDuplicate?: (item: WorkflowDto) => void;
  readonly onDelete?: (item: WorkflowDto) => void;
  readonly isPending?: boolean;
}

export default function WfCard({
  item,
  index,
  onEdit,
  onToggleActive,
  onDuplicate,
  onDelete,
  isPending,
}: WfCardProps) {
  const locale = useLocale();
  const updated = item.audit?.updated;
  const updatedRelative = updated?.at
    ? formatRelativeTime(updated.at, locale)
    : null;
  const inactive = !item.is_active;

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-disabled={inactive || undefined}
      onClick={() => onEdit(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(item);
        }
      }}
      className={cn(
        "hover:border-primary/30 focus-visible:ring-ring cursor-pointer gap-0 py-0 transition-colors focus-visible:ring-2",
        inactive && "bg-muted/30 border-dashed opacity-70 hover:opacity-100",
      )}
    >
      <CardHeader className="p-4">
        <div className="flex items-start gap-2">
          {typeof index === "number" && (
            <span className="bg-muted text-muted-foreground mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums">
              {index + 1}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <CardTitle
              className={cn(
                "flex items-center gap-1.5 truncate text-sm",
                inactive && "text-muted-foreground",
              )}
            >
              {inactive && (
                <Lock
                  className="text-muted-foreground size-3 shrink-0"
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "truncate",
                  inactive && "decoration-muted-foreground/40 line-through",
                )}
              >
                {item.name || "..."}
              </span>
            </CardTitle>
          </div>
        </div>
        <CardAction>
          <div className="flex items-center gap-1">
            <StatusBadge active={item.is_active} />
            {onToggleActive && onDuplicate && onDelete && (
              <WfRowActions
                workflow={item}
                onToggleActive={onToggleActive}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                isPending={isPending}
              />
            )}
          </div>
        </CardAction>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-1.5 p-4 text-sm">
        <WfFlowStrip workflow={item} />
        <WfScopeLine workflow={item} className="block" />
        {updatedRelative && (
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <Clock className="size-2.5" aria-hidden="true" />
            <span>{updatedRelative}</span>
            {updated?.name && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{updated.name}</span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
