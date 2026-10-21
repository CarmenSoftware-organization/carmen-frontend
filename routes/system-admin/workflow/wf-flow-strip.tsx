import { ChevronRight, Circle, Crown } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Stage, WorkflowDto } from "@/types/workflows";
import { cn } from "@/lib/utils";
import { ROLE_ICON } from "./wf-role-colors";

interface WfFlowStripProps {
  readonly workflow: WorkflowDto;
  readonly className?: string;
}

const MAX_VISIBLE = 5;

/**
 * ลำดับขั้นอนุมัติของ workflow หนึ่งตัว อ่านได้โดยไม่ต้อง hover
 *
 * ขั้นแรก (Create Request) กับขั้นสุดท้าย (Completed) เหมือนกันทุก workflow —
 * validator บังคับไว้ (issueFirstNotCreate / issueLastNotCompleted) — จึงไม่วาด
 * เพราะไม่ช่วยแยกแถวไหนออกจากแถวไหน แสดงเฉพาะขั้นตรงกลางที่ต่างกันจริง
 * พร้อมชื่อขั้น และตัวเลขจำนวนขั้นนำหน้าไว้กวาดตาเทียบทั้งคอลัมน์
 *
 * แยกขั้นด้วย "รูปร่าง" ของไอคอน role ไม่ใช่สี (ดู wf-role-colors) ยกเว้นมงกุฎ
 * HOD ที่ใช้ text-warning-ink ชุดเดียวกับในฟอร์ม เพราะเป็นป้ายสถานะพิเศษของขั้น
 * HOD ใช้มงกุฎ**แทน**ไอคอน role ไม่ใช่แปะทับ — สองสัญลักษณ์ที่ 12px อ่านเป็นก้อนเดียว
 */
export default function WfFlowStrip({ workflow, className }: WfFlowStripProps) {
  const t = useTranslations("systemAdmin.workflow");
  const stages: Stage[] = workflow.data?.stages?.slice(1, -1) ?? [];
  const visible = stages.slice(0, MAX_VISIBLE);
  const overflow = stages.length - visible.length;

  return (
    <div
      className={cn("flex min-w-0 items-start gap-2", className)}
      aria-label={stages.map((s) => s.name).join(" → ")}
    >
      <span className="text-muted-foreground w-12 shrink-0 text-xs leading-6 tabular-nums">
        {t("listStepCount", { count: stages.length })}
      </span>
      <ol className="flex min-w-0 flex-wrap items-center gap-1">
        {visible.map((stage, i) => (
          <li key={i} className="flex shrink-0 items-center gap-1">
            {i > 0 && (
              <ChevronRight
                className="text-muted-foreground/60 size-3 shrink-0"
                aria-hidden="true"
              />
            )}
            <StageChip stage={stage} />
          </li>
        ))}
        {overflow > 0 && (
          <li className="text-muted-foreground shrink-0 text-xs font-semibold tabular-nums">
            +{overflow}
          </li>
        )}
      </ol>
    </div>
  );
}

function StageChip({ stage }: { readonly stage: Stage }) {
  const Icon = stage.is_hod
    ? Crown
    : stage.role
      ? ROLE_ICON[stage.role]
      : Circle;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <span className="bg-muted/60 text-foreground inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-xs">
          <Icon
            className={cn(
              "size-3 shrink-0",
              stage.is_hod ? "text-warning-ink" : "text-muted-foreground",
            )}
            aria-hidden="true"
          />
          <span className="max-w-24 truncate">{stage.name}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {stage.name}
        {stage.is_hod && " · HOD"}
      </TooltipContent>
    </Tooltip>
  );
}
