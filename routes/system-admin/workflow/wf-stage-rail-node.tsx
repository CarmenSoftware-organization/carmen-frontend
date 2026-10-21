import type { ReactNode } from "react";
import { CheckCircle2, Clock, Crown, Play, Users } from "lucide-react";
import { useTranslations } from "use-intl";
import type { Role, Stage } from "@/types/workflows";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ROLE_ICON, ROLE_LABEL } from "./wf-role-colors";
import { formatStageSla } from "./wf-sla-utils";

/**
 * ชิ้นส่วนภาพของรางขั้นตอน ไม่ผูกกับ dnd-kit — รางในหน้ารายละเอียด
 * (`SortableStageItem`) กับพรีวิวในหน้าสร้าง (`WfStageRailPreview`) ใช้ชุดเดียวกัน
 * หน้าตาสองหน้าจึงไม่แยกทางกัน
 *
 * เลขลำดับนับเฉพาะขั้นกลาง (ขั้นสร้างเป็น Play ขั้นจบเป็น CheckCircle2)
 */

/** `ol` ของราง พร้อมเส้นเชื่อมแนวตั้ง — มาร์กเกอร์มีพื้น bg-card จึงทับเส้นพอดี */
export function StageRailList({
  count,
  className,
  children,
}: {
  readonly count: number;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <ol className={cn("relative space-y-1", className)}>
      {count > 1 && (
        <span
          aria-hidden="true"
          className="bg-border absolute top-5 bottom-4 left-3 w-px"
        />
      )}
      {children}
    </ol>
  );
}

export function StageRailMarker({
  index,
  isFirst,
  isLast,
  isSelected = false,
}: {
  readonly index: number;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly isSelected?: boolean;
}) {
  const renderMarker = () => {
    if (isLast) return <CheckCircle2 className="size-3.5" />;
    if (isFirst) return <Play className="size-3 fill-current" />;
    return index;
  };

  return (
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
  );
}

/** ชื่อขั้น + บรรทัดรอง (role · จำนวนคน · SLA) */
export function StageRailSummary({
  name,
  role,
  slaLabel,
  userCount = 0,
  isHod = false,
  isLast,
}: {
  readonly name: string;
  readonly role?: Role;
  readonly slaLabel?: string;
  readonly userCount?: number;
  readonly isHod?: boolean;
  readonly isLast: boolean;
}) {
  const t = useTranslations("systemAdmin.workflow");
  const RoleIcon = role ? ROLE_ICON[role] : null;

  return (
    <>
      <span className="flex items-center gap-1.5">
        <span className="text-foreground truncate text-sm font-medium">
          {name}
        </span>
        {isHod && !isLast && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Crown
                className="text-warning-ink size-3.5 shrink-0"
                aria-label={t("isHod")}
              />
            </TooltipTrigger>
            <TooltipContent>{t("isHod")}</TooltipContent>
          </Tooltip>
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
    </>
  );
}

/** รางแบบอ่านอย่างเดียว — ใช้ในหน้าสร้าง ให้เห็นก่อนกดสร้างว่าจะได้ขั้นอะไรบ้าง */
export function WfStageRailPreview({
  stages,
  className,
}: {
  readonly stages: Stage[];
  readonly className?: string;
}) {
  return (
    <StageRailList count={stages.length} className={className}>
      {stages.map((stage, index) => {
        const isFirst = index === 0;
        const isLast = index === stages.length - 1;
        return (
          <li key={`${stage.name}-${index}`} className="flex items-start gap-3">
            <StageRailMarker index={index} isFirst={isFirst} isLast={isLast} />
            <div className="min-w-0 flex-1 px-3 py-2">
              <StageRailSummary
                name={stage.name}
                role={stage.role}
                slaLabel={formatStageSla(stage)}
                userCount={stage.assigned_users?.length ?? 0}
                isHod={stage.is_hod ?? false}
                isLast={isLast}
              />
            </div>
          </li>
        );
      })}
    </StageRailList>
  );
}
