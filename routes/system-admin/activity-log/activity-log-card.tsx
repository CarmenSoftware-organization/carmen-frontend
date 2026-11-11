import { CalendarDays, FileText, Globe } from "lucide-react";
import { PersonAvatar } from "@/components/share/person-avatar";
import { useProfile } from "@/hooks/use-profile";
import { ActivityActionLabel } from "../shared/activity-action-label";
import { formatDate } from "@/lib/date-utils";
import { getLogCreatedAt, type ActivityLog } from "@/types/activity-log";

function formatEntityType(value: string): string {
  if (!value) return "";
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface ActivityLogCardProps {
  log: ActivityLog;
  index?: number;
  onClick?: () => void;
}

export function ActivityLogCard({ log, index, onClick }: ActivityLogCardProps) {
  const { dateFormat } = useProfile();

  const actorName =
    [log.actor_firstname, log.actor_middlename, log.actor_lastname]
      .filter(Boolean)
      .join(" ") ||
    log.actor_username ||
    "—";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="bg-card hover:border-primary/30 focus-visible:ring-ring cursor-pointer space-y-2 rounded-lg border p-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {/* Header: action badge + timestamp */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {typeof index === "number" && (
            <span className="bg-muted text-muted-foreground text-micro-legal inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-semibold tabular-nums">
              {index + 1}
            </span>
          )}
          <ActivityActionLabel action={log.action} />
        </div>
        <div className="text-muted-foreground flex items-center gap-1">
          <CalendarDays className="size-3 shrink-0" aria-hidden="true" />
          <span className="text-micro tabular-nums">
            {formatDate(getLogCreatedAt(log), `${dateFormat} HH:mm`)}
          </span>
        </div>
      </div>

      {/* Body: key info */}
      <div className="space-y-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <PersonAvatar
            fallback="icon"
            avatarUrl={log.actor_avatar}
            className="size-3 shrink-0"
            fallbackClassName="bg-transparent text-muted-foreground"
            iconClassName="size-full"
          />
          <span className="truncate text-xs font-semibold">{actorName}</span>
          {log.actor_username && actorName !== log.actor_username && (
            <span className="text-muted-foreground text-micro truncate">
              ({log.actor_username})
            </span>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <FileText
            className="text-muted-foreground size-3 shrink-0"
            aria-hidden="true"
          />
          <span className="truncate text-xs">
            {formatEntityType(log.entity_type) || "—"}
          </span>
        </div>

        {log.description && (
          <p className="text-muted-foreground text-micro line-clamp-2 pl-[1.125rem]">
            {log.description}
          </p>
        )}
      </div>

      {/* Footer: IP */}
      {log.ip_address && (
        <div className="flex items-center gap-1.5 border-t pt-1">
          <Globe
            className="text-muted-foreground size-3 shrink-0"
            aria-hidden="true"
          />
          <span className="text-muted-foreground text-micro">
            {log.ip_address}
          </span>
        </div>
      )}
    </div>
  );
}
