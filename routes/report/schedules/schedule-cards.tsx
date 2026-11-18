import { Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ReportSchedule } from "@/types/report-schedule";
import {
  formatLabel,
  formatNotifyAt,
  formatRunAt,
  formatScheduleConfig,
  useWeekdayShort,
} from "./use-schedule-table";

interface ScheduleCardsProps {
  readonly schedules: ReportSchedule[];
  readonly onDelete: (schedule: ReportSchedule) => void;
}

/** กล่องแคบ (ต่ำกว่า SCHEDULE_CARD_BELOW) — การ์ดแถวละใบ มีทุกช่องของตาราง */
export function ScheduleCards({ schedules, onDelete }: ScheduleCardsProps) {
  const t = useTranslations("reportSchedule");
  const tc = useTranslations("common");
  const weekdayShort = useWeekdayShort();

  return (
    <ul className="divide-border divide-y">
      {schedules.map((s) => {
        const fields: [string, string][] = [
          [t("frequency"), formatScheduleConfig(s, t, weekdayShort)],
          [t("notifyAtColumn"), formatNotifyAt(s, t)],
          [t("nextRun"), formatRunAt(s.next_run_at)],
          [t("lastRun"), formatRunAt(s.last_run_at)],
        ];
        return (
          <li key={s.id} className="flex flex-col gap-2 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" title={s.name}>
                  {s.name}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {s.report_type} · {formatLabel(s.format, t)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(s)}
                aria-label={tc("delete")}
                title={tc("delete")}
              >
                <Trash2 className="text-destructive size-4" />
              </Button>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {fields.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium break-words">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center gap-1">
              <StatusBadge active={s.is_active} />
              {s.template_available === false && (
                <Badge
                  variant="warning"
                  size="sm"
                  title={t("templateUnavailableHint")}
                >
                  {t("templateUnavailable")}
                </Badge>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
