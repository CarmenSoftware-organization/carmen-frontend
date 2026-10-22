import { useTranslations } from "use-intl";
import { Check, Eye, PackageCheck, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClaimFormPrimary } from "@/components/share/form-primary-action";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { useSrStockMovements } from "./use-sr";
import { formatCurrency } from "@/lib/currency-utils";
import { STAGE_ROLE } from "@/types/stage-role";
import { srStockVisible } from "./sr-form-helpers";
import type { StageActionFlags } from "@/lib/workflow-stage-actions";

type SrAction = "none" | "review" | "rejected" | "approved";

interface SrFooterProps {
  readonly canSubmit: boolean;
  readonly isPending: boolean;
  readonly role?: string;
  readonly action: SrAction;
  readonly grandTotal: number;
  readonly hasItems: boolean;
  /**
   * แท็บที่เปิดอยู่ — footer สรุปคนละชุดกัน: แท็บ Items ใช้ยอดรวมของใบ
   * ส่วนแท็บ Stock ใช้ยอดเข้า/ออกจาก API เพราะเป็นคนละหน่วยและคนละความหมาย
   */
  readonly activeTab: "items" | "stock";
  readonly srId?: string;
  readonly docStatus?: string;
  /** ตัวเลือกที่ stage ปัจจุบันเปิดให้ตัดสิน — AND กับสิทธิ์ตาม role เสมอ ไม่เพิ่มปุ่มที่ role ไม่มี */
  readonly stageActions: StageActionFlags;
  readonly onSubmit: () => void;
  readonly onApprove: () => void;
  readonly onIssue: () => void;
  readonly onReject: () => void;
  readonly onSendBack: () => void;
}

export function SrFooter({
  canSubmit,
  isPending,
  role,
  action,
  grandTotal,
  hasItems,
  activeTab,
  srId,
  docStatus,
  stageActions,
  onSubmit,
  onApprove,
  onIssue,
  onReject,
  onSendBack,
}: SrFooterProps) {
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const t = useTranslations("storeOperation.storeRequisition");

  // key เดียวกับที่ตารางในแท็บใช้ — react-query แชร์ผลให้ ไม่ได้ยิงเพิ่มอีกรอบ
  // และ enabled ผูกกับแท็บไว้ ไม่งั้น footer จะยิงตั้งแต่เปิดฟอร์มทั้งที่ยังไม่มีใครกดดู
  const { data: stock } = useSrStockMovements(srId, {
    enabled: activeTab === "stock" && srStockVisible(docStatus),
  });

  const isApprover = role === STAGE_ROLE.APPROVE;
  const isIssuer = role === STAGE_ROLE.ISSUE;
  const isWorkflowReviewer = isApprover || isIssuer;
  // flag ปิด = ปุ่มนั้นหาย (Issue ใช้ approve endpoint จึงผูกกับ flag approve) · ปิด reject
  // แต่ทุกแถวถูก reject แล้ว = ปุ่มไม่มี แต่ต้องบอกเหตุผล ไม่ใช่เงียบหาย
  const showSendBack = stageActions.sendback && action === "review";
  const showReject = stageActions.reject && action === "rejected";
  const showApprove = stageActions.approve && action === "approved";
  const showRejectAllBlocked = !stageActions.reject && action === "rejected";
  // เรื่องเดียวกัน: ปิด approve แต่ทุกแถวอนุมัติอยู่ = ไม่มีปุ่ม ต้องบอกให้ปัดตก/ส่งกลับแทน
  const showApproveBlocked = !stageActions.approve && action === "approved";
  const hasAction =
    showSendBack ||
    showReject ||
    showApprove ||
    showRejectAllBlocked ||
    showApproveBlocked;
  const showActions = canSubmit || (isWorkflowReviewer && hasAction);
  // ปุ่มที่กดได้จริงเท่านั้น — Submit โผล่เฉพาะคนที่ไม่ใช่ผู้ตรวจ · "blocked" ไม่ใช่ปุ่ม
  useClaimFormPrimary(
    (canSubmit && !isWorkflowReviewer) ||
      (isWorkflowReviewer && (showSendBack || showReject || showApprove)),
  );
  // มีรายการแล้วต้องเห็นยอดรวม แม้จะไม่มีปุ่มให้กด (view ใบที่ปิดแล้ว)
  const showBar = showActions || hasItems;

  // ยอดมาจาก `summary` ของ API ไม่ได้บวกจากแถวที่เห็น จึงเป็นยอดของทั้งใบเสมอ
  // ไม่ขยับตามตัวกรองทิศทางในตาราง
  const summaryItems =
    activeTab === "stock"
      ? stock
        ? [
            {
              key: "qtyIn",
              label: tfl("in"),
              value: stock.summary.total_qty_in,
            },
            {
              key: "qtyOut",
              label: tfl("out"),
              value: stock.summary.total_qty_out,
            },
            {
              key: "costIn",
              label: t("stockCostIn"),
              value: formatCurrency(stock.summary.total_cost_in),
            },
            {
              key: "costOut",
              label: t("stockCostOut"),
              value: formatCurrency(stock.summary.total_cost_out),
              emphasis: true,
            },
          ]
        : []
      : [
          {
            key: "grandTotal",
            label: tfl("grandTotal"),
            value: formatCurrency(grandTotal),
            emphasis: true,
          },
        ];

  if (!showBar) return null;

  return (
    <SummaryFooterBar hasRecord={hasItems} items={summaryItems}>
      {showActions && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {isWorkflowReviewer && showSendBack && (
            <Button
              type="button"
              size="sm"
              variant="warning"
              disabled={isPending}
              onClick={onSendBack}
            >
              <Eye />
              {tc("sendBack")}
            </Button>
          )}
          {isWorkflowReviewer && showRejectAllBlocked && (
            <span className="text-warning-ink text-xs">
              {tc("rejectAllNotAllowed")}
            </span>
          )}
          {isWorkflowReviewer && showApproveBlocked && (
            <span className="text-warning-ink text-xs">
              {tc("approveNotAllowed")}
            </span>
          )}
          {isWorkflowReviewer && showReject && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={onReject}
            >
              <X />
              {tc("reject")}
            </Button>
          )}
          {isApprover && showApprove && (
            <Button
              type="button"
              size="sm"
              variant="success"
              disabled={isPending}
              onClick={onApprove}
            >
              <Check />
              {tc("approve")}
            </Button>
          )}
          {isIssuer && showApprove && (
            <Button
              type="button"
              size="sm"
              variant="success"
              disabled={isPending}
              onClick={onIssue}
            >
              <PackageCheck />
              {tc("issue")}
            </Button>
          )}
          {!isWorkflowReviewer && (
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={onSubmit}
            >
              <SendHorizontal />
              {tc("submit")}
            </Button>
          )}
        </div>
      )}
    </SummaryFooterBar>
  );
}
