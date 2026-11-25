import { cn } from "@/lib/utils";
import { CELL_SUB_CLASS } from "@/components/ui/data-grid/cell-text";
import { formatDate } from "@/lib/date-utils";
import type { AuditEntry } from "@/types/audit";

interface AuditCellProps {
  readonly entry: AuditEntry | undefined;
  readonly dateTimeFormat: string;
}

export function AuditCell({ entry, dateTimeFormat }: AuditCellProps) {
  if (!entry?.at) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <div className="flex flex-col gap-0">
      <span className="text-foreground text-xs">
        {formatDate(entry.at, dateTimeFormat)}
      </span>
      {entry.name && (
        <span className={cn(CELL_SUB_CLASS, "truncate")}>{entry.name}</span>
      )}
    </div>
  );
}
