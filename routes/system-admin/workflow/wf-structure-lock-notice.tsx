import { ExternalLink, Lock, Plus } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WORKFLOW_TYPE } from "@/types/workflows";
import { cn } from "@/lib/utils";

// หน้ารายการเอกสารของแต่ละชนิด กับคอลัมน์สถานะที่ backend ใช้นับ in_progress
// (workflows.service.ts → countDocumentsByStatus) — ต้องตรงกันไม่งั้นลิงก์พาไปเจอจำนวนไม่เท่าแบนเนอร์
const DOCUMENT_LIST: Record<WORKFLOW_TYPE, { path: string; status: string }> = {
  [WORKFLOW_TYPE.PR]: {
    path: "/procurement/purchase-request",
    status: "pr_status",
  },
  [WORKFLOW_TYPE.PO]: {
    path: "/procurement/purchase-order",
    status: "po_status",
  },
  [WORKFLOW_TYPE.SR]: {
    path: "/store-operation/store-requisition",
    status: "doc_status",
  },
};

/**
 * ลิงก์ไปหน้ารายการเอกสารที่กรองไว้เฉพาะใบที่ยังดำเนินการอยู่บน workflow นี้ — ตัวที่ทำให้โครงถูกล็อก
 *
 * ค่า `filter` / `workflow` ใช้รูปแบบ clause เดียวกับตัวกรองของหน้ารายการ (`createStatusFilterOptions`,
 * `FilterWorkflow`) ส่วน `view=all-document` จำเป็นเพราะค่าเริ่มต้นของหน้าเป็น "รอฉันดำเนินการ"
 * ซึ่งจะซ่อนใบที่ค้างอยู่กับคนอื่น
 * @param workflowType - ชนิดของ workflow
 * @param workflowId - รหัส workflow
 * @returns path พร้อม query หรือ undefined ถ้าชนิดนี้ไม่มีหน้ารายการ
 */
export function getInProgressDocumentsHref(
  workflowType: string,
  workflowId: string,
): string | undefined {
  const target = DOCUMENT_LIST[workflowType as WORKFLOW_TYPE];
  if (!target) return undefined;
  const params = new URLSearchParams({
    view: "all-document",
    filter: `${target.status}|string:in_progress`,
    workflow: `workflow_id|string:${workflowId}`,
  });
  return `${target.path}?${params.toString()}`;
}

/**
 * บอกว่าทำไมส่วนของ stage กับเส้นทางถึงแก้ไม่ได้ ทั้งที่ส่วนอื่นของฟอร์มยังแก้ได้
 *
 * ถ้าไม่มีข้อความนี้ ผู้ใช้จะเห็นแค่ช่องที่เป็นสีเทาปะปนกับช่องที่ยังกรอกได้ในหน้าเดียวกัน แล้วเดาเอาเองว่า
 * ระบบพัง — ไม่ใช่ว่ามีเอกสารกำลังเดินอยู่บนโครงนี้ วางไว้ระดับฟอร์ม (ไม่ผูกกับแท็บ) เพราะการล็อก
 * กระทบทั้งรางขั้นด้านซ้าย แท็บ Stages และแท็บ Routing
 * @param props - ตัวเลือกของแบนเนอร์
 * @param props.count - จำนวนเอกสารที่ยังดำเนินการอยู่ ซึ่งเป็นเหตุผลของการล็อก
 * @param props.href - ลิงก์ไปหน้ารายการเอกสารเหล่านั้น (ไม่ส่ง = ไม่มีลิงก์)
 * @returns แบนเนอร์อธิบายเหตุผล
 */
export function WfStructureLockNotice({
  count,
  href,
}: {
  readonly count: number;
  readonly href?: string;
}) {
  const t = useTranslations("systemAdmin.workflow.documents");

  return (
    <div
      role="status"
      className="border-warning/30 bg-warning/5 text-warning-ink flex flex-wrap items-start gap-x-2.5 gap-y-1 rounded-lg border p-3 text-sm"
    >
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{t("structureLocked", { count })}</span>
      {href && (
        // แท็บใหม่ — ฟอร์มที่กำลังแก้ค้างอยู่จะได้ไม่โดน discard guard ถามระหว่างไปดูเอกสาร
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 font-medium underline underline-offset-2 hover:no-underline"
        >
          {t("viewInProgress")}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

interface WfStructureAddButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  /** โหมดดู (ไม่ได้กด Edit) — ไม่มีปุ่มให้เห็นเลย */
  readonly isDisabled: boolean;
  /** โครงถูกล็อกเพราะมีเอกสารค้าง — แสดงปุ่มสีเทาพร้อมเหตุผล แทนการซ่อน */
  readonly lockedReason?: string;
  readonly className?: string;
}

/**
 * ปุ่ม "เพิ่ม" ของรายการ stage / กฎ routing
 *
 * ตอนโครงถูกล็อก ปุ่มเคยหายไปเฉย ๆ ผู้ใช้หาไม่เจอแล้วคิดว่าระบบพัง — จึงคงปุ่มไว้แบบ disabled
 * พร้อมกุญแจกับ tooltip บอกเหตุผล ส่วนโหมดดูยังซ่อนเหมือนเดิม เพราะตรงนั้นไม่มีอะไรให้แก้อยู่แล้ว
 * ปุ่มที่ disabled ไม่รับ pointer event จึงห่อด้วย span ที่โฟกัสได้ให้ tooltip เปิดได้ทั้งเมาส์และคีย์บอร์ด
 * @param props - ตัวเลือกของปุ่ม
 * @returns ปุ่มเพิ่ม ปุ่มที่ล็อก หรือ null
 */
export function WfStructureAddButton({
  label,
  onClick,
  isDisabled,
  lockedReason,
  className,
}: WfStructureAddButtonProps) {
  if (lockedReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            aria-label={`${label} — ${lockedReason}`}
            className={cn(
              "inline-flex cursor-not-allowed rounded-md",
              className,
            )}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              aria-hidden="true"
              tabIndex={-1}
              className="pointer-events-none"
            >
              <Lock className="mr-1.5 size-3.5" />
              {label}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{lockedReason}</TooltipContent>
      </Tooltip>
    );
  }

  if (isDisabled) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn("hover:bg-muted/50", className)}
    >
      <Plus className="mr-1.5 size-3.5" />
      {label}
    </Button>
  );
}
