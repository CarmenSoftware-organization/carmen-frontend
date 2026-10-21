import { useState } from "react";
import { AlertCircle, AlertTriangle, ChevronDown, Info } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ValidationIssue, IssueSeverity } from "./wf-validate";

interface WfValidationPanelProps {
  readonly issues: ValidationIssue[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly isReady: boolean;
  readonly onSelectStage?: (index: number) => void;
}

/**
 * สีของ severity อยู่ที่ไอคอนที่เดียว (DESIGN.md "avoid neon") — กล่อง ขอบ
 * และตัวอักษรเป็นสีกลางหมด ส่วน text ใช้ token `-ink` ไม่ใช่ `-foreground`
 * ซึ่งเป็นสีของ label ที่นั่งอยู่ *บน* พื้นสีนั้น (`destructive` ผ่าน AA
 * เป็น text อยู่แล้ว จึงไม่มี ink ของตัวเอง)
 */
const SEVERITY_CONFIG: Record<
  IssueSeverity,
  { icon: typeof AlertCircle; iconClass: string }
> = {
  error: { icon: AlertCircle, iconClass: "text-destructive" },
  warning: { icon: AlertTriangle, iconClass: "text-warning-ink" },
  info: { icon: Info, iconClass: "text-info-ink" },
};

export default function WfValidationPanel({
  issues,
  errorCount,
  warningCount,
  isReady,
  onSelectStage,
}: WfValidationPanelProps) {
  const t = useTranslations("systemAdmin.workflow");
  const [open, setOpen] = useState(false);

  const totalIssues = issues.length;

  // ไม่มีอะไรต้องแจ้ง = ไม่กินพื้นที่ทั้งแถว — สถานะ "พร้อมใช้งาน" ไปอยู่ที่หัวรางขั้นแทน
  if (totalIssues === 0) return null;

  const HeaderIcon = isReady ? AlertTriangle : AlertCircle;
  const headerIconClass = isReady ? "text-warning-ink" : "text-destructive";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-card rounded-xl border">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-auto w-full items-center justify-between gap-4 p-4 hover:bg-transparent"
            aria-expanded={open}
          >
            <div className="flex min-w-0 items-center gap-3">
              <HeaderIcon
                className={cn("size-5 shrink-0", headerIconClass)}
                aria-hidden="true"
              />
              <p className="text-sm font-semibold">
                {t("validationIssuesFound", { count: totalIssues })}
              </p>
              <div className="flex items-center gap-1">
                {errorCount > 0 && (
                  <Badge
                    variant="destructive-light"
                    size="xs"
                    className="tabular-nums"
                  >
                    {errorCount} {t("issueErrorLabel")}
                  </Badge>
                )}
                {warningCount > 0 && (
                  <Badge
                    variant="warning-light"
                    size="xs"
                    className="tabular-nums"
                  >
                    {warningCount} {t("issueWarningLabel")}
                  </Badge>
                )}
              </div>
            </div>
            <ChevronDown
              className={cn(
                "text-muted-foreground size-4 shrink-0 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden="true"
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ul className="space-y-3 border-t p-4">
            {issues.map((issue, i) => {
              const config = SEVERITY_CONFIG[issue.severity];
              const Icon = config.icon;
              const clickable =
                typeof issue.stageIndex === "number" && onSelectStage;
              const content = (
                <div className="flex w-full items-start gap-3">
                  <Icon
                    className={cn("mt-0.5 size-4 shrink-0", config.iconClass)}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm leading-snug">
                      {t(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        issue.translationKey as any,
                        issue.translationValues as never,
                      )}
                    </p>
                    {issue.stageName && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {t("stageName")}: {issue.stageName}
                      </p>
                    )}
                  </div>
                </div>
              );

              return (
                <li key={`${issue.code}-${issue.stageIndex ?? "x"}-${i}`}>
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => onSelectStage(issue.stageIndex!)}
                      className="hover:bg-accent focus-visible:ring-ring w-full rounded-md px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="px-3 py-2">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
