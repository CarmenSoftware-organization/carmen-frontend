import { useState } from "react";
import { useWatch, type Control } from "react-hook-form";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Check, Eye, SendHorizontal, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { STAGE_ROLE } from "@/types/stage-role";
import { formatCurrency } from "@/lib/currency-utils";
import type { PrFormValues } from "../pr-form-schema";
import { computePrSummary } from "../pr-summary";
import { PR_STATUS, PR_ITEM_STAGE_STATUS } from "@/types/purchase-request";
import {
  PrActionDialog,
  type StageOption,
  type ActionDialogItem,
} from "./pr-action-dialog";
import { computePurchaseAction } from "./pr-purchase-action";
import type { StageActionFlags } from "@/lib/workflow-stage-actions";
import { HiddenValue } from "@/components/share/hidden-value";
import { isPriceHidden, type HiddenPriceField } from "@/types/workflows";

interface PrFooterActionProps {
  readonly role?: string;
  readonly prStatus?: string;
  readonly isPending: boolean;
  readonly hasRecord: boolean;
  readonly control: Control<PrFormValues>;
  readonly currencyCode?: string;
  readonly previousStages?: StageOption[];
  readonly stagesLoading?: boolean;
  /** ตัวเลือกที่ stage ปัจจุบันเปิดให้ตัดสิน — AND กับสิทธิ์ตาม role เสมอ ไม่เพิ่มปุ่มที่ role ไม่มี */
  readonly stageActions: StageActionFlags;
  /** `hidden_fields` ของใบ — ซ่อน `total_price` = ยอดรวมท้ายใบเป็น badge */
  readonly hiddenFields?: readonly HiddenPriceField[];
  readonly onSubmitPr?: () => void;
  readonly onApprove?: () => void;
  readonly onReject?: () => void;
  readonly onReview?: (
    messages: Record<number, string>,
    desStage: string,
  ) => void;
  readonly onPurchaseApprove?: () => void;
  /**
   * ตรวจก่อนเปิดกล่องยืนยัน "ส่งใบ" — คืน false = ไม่ต้องเปิดกล่อง
   * ตัว validator เป็นคนขึ้น toast/เลื่อนไปหาช่องที่ผิดเอง (ดู validateSubmitPr)
   */
  readonly onValidateSubmit?: () => Promise<boolean>;
  readonly onValidatePurchase?: () => Promise<boolean>;
}

type ConfirmConfig = {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant: "default" | "destructive" | "success" | "info" | "warning";
  onConfirm: () => void;
};

export function PrFooterAction({
  role,
  prStatus,
  isPending,
  hasRecord,
  control,
  currencyCode,
  previousStages,
  stagesLoading,
  stageActions,
  hiddenFields,
  onSubmitPr,
  onApprove,
  onReject,
  onReview,
  onPurchaseApprove,
  onValidateSubmit,
  onValidatePurchase,
}: PrFooterActionProps) {
  const t = useTranslations("procurement.purchaseRequest");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const openConfirm = (config: ConfirmConfig) => setConfirm(config);

  const isVoided = prStatus === PR_STATUS.VOIDED;
  const isViewOnly = role === STAGE_ROLE.VIEW_ONLY;
  const showWorkflowActions = hasRecord && !isVoided && !isViewOnly;

  const items = useWatch({ control, name: "items" });

  const itemStatuses = items.map((item) => item?.current_stage_status ?? "");

  const summary = computePrSummary(items);
  // ยอดในฟอร์มเป็น null→0 ปลอมเมื่อ stage ซ่อน — รวมแล้วจะโชว์ 0.00 หลอกตา
  const hideTotal = isPriceHidden(hiddenFields, "total_price");

  // const canSubmit = role === STAGE_ROLE.CREATE && prStatus !== "in_progress";
  const canSubmit = role === STAGE_ROLE.CREATE;
  const canApprove = role === STAGE_ROLE.APPROVE;
  const canPurchaseApprove = role === STAGE_ROLE.PURCHASE;
  const purchaseAction = computePurchaseAction(itemStatuses);

  const allItemsReadyForPurchase =
    items.length > 0 &&
    items.every(
      (item) =>
        item.vendor_id && item.pricelist_price > 0 && item.tax_profile_id,
    );

  const showSubmit = canSubmit && !isVoided;
  const canDecide = canApprove || canPurchaseApprove;
  // flag ปิด = ปุ่มนั้นหาย · ปิด reject แต่ทุกแถวถูก reject แล้ว = ปุ่มไม่มี แต่ต้องบอกเหตุผล
  // ไม่ใช่เงียบหาย ผู้ใช้จะงงว่าทำไมตัดสินต่อไม่ได้
  const showApprove = stageActions.approve && purchaseAction === "approved";
  const showReject = stageActions.reject && purchaseAction === "rejected";
  const showSendBack = stageActions.sendback && purchaseAction === "review";
  const showRejectAllBlocked =
    !stageActions.reject && purchaseAction === "rejected";
  // เรื่องเดียวกัน: ปิด approve แต่ทุกแถวอนุมัติอยู่ = ไม่มีปุ่ม ต้องบอกให้ปัดตก/ส่งกลับแทน
  const showApproveBlocked =
    !stageActions.approve && purchaseAction === "approved";
  const hasVisibleButton =
    showSubmit ||
    (showWorkflowActions &&
      canDecide &&
      (showApprove ||
        showReject ||
        showSendBack ||
        showRejectAllBlocked ||
        showApproveBlocked));

  const reviewItems: ActionDialogItem[] = items
    .map((item, index) => ({ index, item }))
    .filter(
      ({ item }) => item?.current_stage_status === PR_ITEM_STAGE_STATUS.REVIEW,
    )
    .map(({ index, item }) => ({
      index,
      productName: item?.product_name ?? "",
      locationName: item?.location_name ?? "",
    }));

  return (
    <>
      <SummaryFooterBar
        hasRecord={hasRecord}
        items={[
          {
            key: "subtotal",
            label: tfl("subtotal"),
            value: hideTotal ? (
              <HiddenValue />
            ) : (
              formatCurrency(summary.subtotal)
            ),
          },
          {
            key: "discount",
            label: tfl("discount"),
            value: hideTotal ? (
              <HiddenValue />
            ) : summary.totalDiscount > 0 ? (
              `-${formatCurrency(summary.totalDiscount)}`
            ) : (
              formatCurrency(0)
            ),
            valueClassName:
              !hideTotal && summary.totalDiscount > 0
                ? "text-destructive"
                : undefined,
          },
          {
            key: "net",
            label: tfl("net"),
            value: hideTotal ? (
              <HiddenValue />
            ) : (
              formatCurrency(summary.totalNet)
            ),
          },
          {
            key: "tax",
            label: tfl("tax"),
            value: hideTotal ? (
              <HiddenValue />
            ) : (
              formatCurrency(summary.totalTax)
            ),
          },
          {
            key: "grandTotal",
            label: tfl("grandTotal"),
            value: hideTotal ? (
              <HiddenValue />
            ) : (
              formatCurrency(summary.grandTotal)
            ),
            emphasis: true,
            suffix: currencyCode,
          },
        ]}
      >
        {hasVisibleButton && (
          <div className="flex shrink-0 items-center gap-2">
            {showSubmit && (
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={async () => {
                  // กรอกไม่ครบ = ไม่เปิดกล่องยืนยันเลย (validator เตือนเอง)
                  if (onValidateSubmit && !(await onValidateSubmit())) return;
                  openConfirm({
                    title: t("submitTitle"),
                    description: t("submitConfirm"),
                    confirmLabel: tc("submit"),
                    confirmVariant: "default",
                    onConfirm: () => onSubmitPr?.(),
                  });
                }}
              >
                <SendHorizontal />
                {tc("submit")}
              </Button>
            )}

            {canDecide && showRejectAllBlocked && (
              <span className="text-warning-ink text-xs">
                {tc("rejectAllNotAllowed")}
              </span>
            )}

            {canDecide && showApproveBlocked && (
              <span className="text-warning-ink text-xs">
                {tc("approveNotAllowed")}
              </span>
            )}

            {canApprove && showApprove && (
              <Button
                type="button"
                size="sm"
                variant="success"
                disabled={isPending}
                onClick={() =>
                  openConfirm({
                    title: t("approveTitle"),
                    description: t("approveConfirm"),
                    confirmLabel: tc("approve"),
                    confirmVariant: "success",
                    onConfirm: () => onApprove?.(),
                  })
                }
              >
                <Check />
                {tc("approve")}
              </Button>
            )}

            {canApprove && showReject && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={() =>
                  openConfirm({
                    title: t("rejectTitle"),
                    description: t("rejectConfirm"),
                    confirmLabel: tc("reject"),
                    confirmVariant: "destructive",
                    onConfirm: () => onReject?.(),
                  })
                }
              >
                <X />
                {tc("reject")}
              </Button>
            )}

            {canApprove && showSendBack && (
              <Button
                type="button"
                size="sm"
                variant="warning"
                disabled={isPending}
                onClick={() => setReviewOpen(true)}
              >
                <Eye />
                {tc("sendBack")}
              </Button>
            )}

            {canPurchaseApprove && showApprove && (
              <Button
                type="button"
                size="sm"
                variant="success"
                disabled={isPending}
                onClick={async () => {
                  // validate เฉพาะตอนกด approve (action-aware): trigger schema
                  // เพื่อโชว์กรอบแดงที่ field ที่ขาด แล้วค่อยเปิด confirm
                  const valid =
                    (await onValidatePurchase?.()) ?? allItemsReadyForPurchase;
                  if (!valid) {
                    toast.warning(t("purchaseIncomplete"));
                    return;
                  }
                  openConfirm({
                    title: t("purchaseApproveTitle"),
                    description: t("purchaseApproveConfirm"),
                    confirmLabel: t("purchaseApproveTitle"),
                    confirmVariant: "success",
                    onConfirm: () => onPurchaseApprove?.(),
                  });
                }}
              >
                <ShoppingCart />
                {tc("approve")}
              </Button>
            )}

            {canPurchaseApprove && showReject && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={() =>
                  openConfirm({
                    title: t("rejectTitle"),
                    description: t("rejectConfirm"),
                    confirmLabel: tc("reject"),
                    confirmVariant: "destructive",
                    onConfirm: () => onReject?.(),
                  })
                }
              >
                <X />
                {tc("reject")}
              </Button>
            )}

            {canPurchaseApprove && showSendBack && (
              <Button
                type="button"
                size="sm"
                variant="warning"
                disabled={isPending}
                onClick={() => setReviewOpen(true)}
              >
                <Eye />
                {tc("sendBack")}
              </Button>
            )}
          </div>
        )}
      </SummaryFooterBar>

      <PrActionDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        title={t("sendBackTitle")}
        description={t("sendBackConfirm")}
        confirmLabel={tc("sendBack")}
        confirmVariant="warning"
        isPending={isPending}
        stages={previousStages}
        stagesLoading={stagesLoading}
        items={reviewItems}
        onConfirm={(messages, desStage) => {
          onReview?.(messages, desStage ?? "");
          setReviewOpen(false);
        }}
      />

      <PrActionDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        confirmVariant={confirm?.confirmVariant ?? "default"}
        isPending={isPending}
        showMessage={false}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
      />
    </>
  );
}
