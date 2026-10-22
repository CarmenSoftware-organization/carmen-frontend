import { useState } from "react";
import { useTranslations } from "use-intl";
import { useWatch, type Control } from "react-hook-form";
import { Check, Eye, SendHorizontal, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClaimFormPrimary } from "@/components/share/form-primary-action";
import { formatCurrency, round2 } from "@/lib/currency-utils";
import { computeItemPricing } from "./po-item-pricing";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { PO_STATUS } from "@/types/purchase-order";
import { STAGE_ROLE } from "@/types/stage-role";
import { computePoAction } from "@/constant/purchase-order";
import type { StageActionFlags } from "@/lib/workflow-stage-actions";
import type { PoFormValues } from "./po-form-schema";
import { HiddenValue } from "@/components/share/hidden-value";
import type { HiddenPriceField } from "@/types/workflows";
import { getPoHiddenFlags } from "./po-hidden-fields";
import {
  PoActionDialog,
  type StageOption,
  type ActionDialogItem,
} from "./po-action-dialog";

interface PoFooterActionProps {
  readonly control: Control<PoFormValues>;
  readonly currencyCode?: string;
  readonly isPending: boolean;
  readonly role?: string;
  readonly poStatus?: string;
  readonly previousStages?: StageOption[];
  readonly stagesLoading?: boolean;
  readonly isEditMode?: boolean;
  /** ตัวเลือกที่ stage ปัจจุบันเปิดให้ตัดสิน — AND กับสิทธิ์ตาม role เสมอ ไม่เพิ่มปุ่มที่ role ไม่มี */
  readonly stageActions: StageActionFlags;
  /** `hidden_fields` ของใบ — ซ่อน `total_price` = ยอดรวมท้ายใบเป็น badge */
  readonly hiddenFields?: readonly HiddenPriceField[];
  readonly onSubmit?: () => void;
  /**
   * ตรวจก่อนเปิดกล่องยืนยัน "ส่งใบ" — คืน false = ไม่ต้องเปิดกล่อง
   * ตัว validator เป็นคนขึ้น toast/เลื่อนไปหาช่องที่ผิดเอง (ดู validateSubmitPo)
   */
  readonly onValidateSubmit?: () => Promise<boolean>;
  readonly onApprove?: () => void;
  readonly onReject?: () => void;
  readonly onReview?: (
    messages: Record<number, string>,
    desStage: string,
  ) => void;
}

type ConfirmConfig = {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant: "default" | "destructive" | "success" | "info" | "warning";
  onConfirm: () => void;
};

export function PoFooterAction({
  control,
  isPending,
  role,
  poStatus,
  previousStages,
  stagesLoading,
  isEditMode = false,
  stageActions,
  hiddenFields,
  onSubmit,
  onValidateSubmit,
  onApprove,
  onReject,
  onReview,
}: PoFooterActionProps) {
  const tc = useTranslations("common");
  const t = useTranslations("procurement.purchaseOrder");
  const tfl = useTranslations("field");
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const openConfirm = (config: ConfirmConfig) => setConfirm(config);

  const items = useWatch({ control, name: "items" });
  const docCurrencyCode = useWatch({ control, name: "currency_code" }) ?? "";

  // grand summary = ผลรวมของแถว โดยใช้ computeItemPricing ตัวเดียวกับที่ตารางใช้
  // ห้ามคำนวณเองซ้ำ — ส่วนลด/ภาษีอยู่ระดับ location (แต่ละที่คนละเรต และ override
  // เป็นจำนวนเงินได้) เขียนสูตรใหม่ที่นี่เมื่อไหร่ ยอดล่างกับยอดในตารางไม่ตรงกันทันที
  // ยอดในฟอร์มเป็น null→0 ปลอมเมื่อ stage ซ่อน — รวมแล้วจะโชว์ 0.00 หลอกตา
  const { hideTotal, hidePrice } = getPoHiddenFlags(hiddenFields);
  let subtotal = 0;
  let totalDiscount = 0;
  let totalNet = 0;
  let totalTax = 0;
  let grandTotal = 0;
  for (const item of items ?? []) {
    // ราคาต่อหน่วยซ่อน = ราคาในฟอร์มเป็น 0 ปลอม รวมยอดจากค่าที่ backend ส่งมาแทน
    const line = hidePrice
      ? {
          subtotal: Number(item?.sub_total_price) || 0,
          discountAmount: Number(item?.discount_amount) || 0,
          netAmount: Number(item?.net_amount) || 0,
          taxAmount: Number(item?.tax_amount) || 0,
          totalPrice: Number(item?.total_price) || 0,
        }
      : computeItemPricing(item);
    subtotal += line.subtotal;
    totalDiscount += line.discountAmount;
    totalNet += line.netAmount;
    totalTax += line.taxAmount;
    grandTotal += line.totalPrice;
  }
  const summary = {
    subtotal: round2(subtotal),
    totalDiscount: round2(totalDiscount),
    totalNet: round2(totalNet),
    totalTax: round2(totalTax),
    grandTotal: round2(grandTotal),
  };

  const itemStatuses = items.map((item) =>
    typeof item?.current_stage_status === "string"
      ? item.current_stage_status
      : "",
  );

  const reviewItems: ActionDialogItem[] = items
    .map((item, index) => ({ index, item }))
    .filter(({ item }) => item?.current_stage_status === "review")
    .map(({ index, item }) => ({
      index,
      productName: item?.product_name ?? "",
    }));

  // ไม่เช็ค `!!onSubmit` แล้ว — ใบใหม่ที่ยังไม่เคยเซฟก็กดส่งได้ handleSubmitPo
  // สร้างใบให้ก่อนแล้วค่อยส่ง (เหมือน PR) ของเดิมกันไว้เพราะยังไม่มีทางนั้น
  const canSubmit = role === STAGE_ROLE.CREATE;
  // ใบที่จบเส้นทางแล้วไม่มีอะไรให้ส่งอีก — PR กันด้วย `!isVoided` ตรงนี้ใช้สถานะ
  // ปลายทางของ PO แทน (PO ไม่มี voided) ของเดิมไม่ได้กันเลย ปุ่มจึงโผล่ได้ถ้า
  // backend ยังคืน role = create บนใบที่ส่งไปแล้ว
  const isTerminal =
    poStatus === PO_STATUS.APPROVED ||
    poStatus === PO_STATUS.SENT_OR_PRINT ||
    poStatus === PO_STATUS.CLOSED ||
    poStatus === PO_STATUS.COMPLETED;
  const showSubmit = canSubmit && !isTerminal;

  const isApprover =
    role === STAGE_ROLE.APPROVE && poStatus === PO_STATUS.IN_PROGRESS;
  const poAction = computePoAction(itemStatuses);
  const canApprove =
    !!onApprove &&
    isApprover &&
    stageActions.approve &&
    poAction === "approved";
  const canReject =
    !!onReject && isApprover && stageActions.reject && poAction === "rejected";
  const canReview =
    !!onReview && isApprover && stageActions.sendback && poAction === "review";
  // ปิด reject แต่ทุกแถวถูก reject แล้ว = ปุ่มไม่มี แต่ต้องบอกเหตุผล ไม่ใช่เงียบหาย
  // ผู้ใช้จะงงว่าทำไมตัดสินต่อไม่ได้
  const showRejectAllBlocked =
    !!onReject && isApprover && !stageActions.reject && poAction === "rejected";

  // เรื่องเดียวกัน: ปิด approve แต่ทุกแถวอนุมัติอยู่ = ไม่มีปุ่ม ต้องบอกให้ปัดตก/ส่งกลับแทน
  const showApproveBlocked =
    !!onApprove &&
    isApprover &&
    !stageActions.approve &&
    poAction === "approved";

  const showActions =
    showSubmit ||
    canApprove ||
    canReject ||
    canReview ||
    showRejectAllBlocked ||
    showApproveBlocked;
  // ปุ่มที่กดได้จริงเท่านั้น — ข้อความ "blocked" ไม่ใช่ปุ่ม หัวต้องกลับเป็นปุ่มหลัก
  useClaimFormPrimary(showSubmit || canApprove || canReject || canReview);
  const hasItems = (items?.length ?? 0) > 0;
  const showBar = isEditMode || showActions || hasItems;

  if (!showBar) return null;

  return (
    <>
      <SummaryFooterBar
        hasRecord={hasItems}
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
            suffix: docCurrencyCode,
          },
        ]}
      >
        {showActions && (
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
                    onConfirm: () => onSubmit?.(),
                  });
                }}
              >
                <SendHorizontal aria-hidden="true" />
                {tc("submit")}
              </Button>
            )}
            {showRejectAllBlocked && (
              <span className="text-warning-ink text-xs">
                {tc("rejectAllNotAllowed")}
              </span>
            )}
            {showApproveBlocked && (
              <span className="text-warning-ink text-xs">
                {tc("approveNotAllowed")}
              </span>
            )}
            {canApprove && (
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
                <Check aria-hidden="true" />
                {tc("approve")}
              </Button>
            )}
            {canReject && (
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
                <ThumbsDown aria-hidden="true" />
                {tc("reject")}
              </Button>
            )}
            {canReview && (
              <Button
                type="button"
                size="sm"
                variant="warning"
                disabled={isPending}
                onClick={() => setReviewOpen(true)}
              >
                <Eye aria-hidden="true" />
                {tc("sendBack")}
              </Button>
            )}
          </div>
        )}
      </SummaryFooterBar>

      <PoActionDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        title={t("reviewTitle")}
        description={t("reviewConfirm")}
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

      <PoActionDialog
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
