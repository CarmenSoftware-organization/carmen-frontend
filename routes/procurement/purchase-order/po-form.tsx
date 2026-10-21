import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { getStageActionFlags } from "@/lib/workflow-stage-actions";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import type { PurchaseOrder } from "@/types/purchase-order";
import { PO_STATUS, PO_TYPE } from "@/types/purchase-order";
import type { FormMode } from "@/types/form";
import { STAGE_ROLE } from "@/types/stage-role";
import { useProfile } from "@/hooks/use-profile";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  countInvalidItems,
  scrollToFirstInvalidField,
  draftSaveHandler,
} from "@/lib/form-helpers";
import { FormPageShell } from "@/components/share/form-page-shell";
import { PoHeader } from "./po-header";
import { PoGeneralFields } from "./po-general-fields";
import { PoItemFields } from "./po-item-fields";
import { buildGrnSourceMap, buildPrSourceMap } from "./po-item-cells";
import { PoFooterAction } from "./po-footer-action";
import {
  createPoSchema,
  type PoFormValues,
  getDefaultValues,
} from "./po-form-schema";
import { PoActionDialog } from "./po-action-dialog";
import {
  poCommentCrud,
  usePoPreviousStages,
} from "../shared/use-purchase-order";
import { usePoDialogState } from "./use-po-dialog-state";
import { usePoProfileSync } from "./use-po-profile-sync";
import { usePoFormHandlers } from "./use-po-form-handlers";
// action ของ workflow ใช้คำชุดเดียวกับ PR (workflow engine ตัวเดียวกัน)
import { PR_WORKFLOW_ACTION_CONFIG } from "@/constant/purchase-request";

const EntityCommentSheet = lazy(() =>
  import("@/components/share/entity-comment-sheet").then((mod) => ({
    default: mod.EntityCommentSheet,
  })),
);

const WorkflowHistoryTimeline = lazy(() =>
  import("@/components/share/workflow-history-timeline").then((mod) => ({
    default: mod.WorkflowHistoryTimeline,
  })),
);

interface PoFormProps {
  readonly purchaseOrder?: PurchaseOrder;
}

export default function PoForm({ purchaseOrder }: PoFormProps) {
  const t = useTranslations("procurement.purchaseOrder");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");
  const { defaultCurrencyId, defaultBu, data: profileData } = useProfile();
  const [mode, setMode] = useState<FormMode>(purchaseOrder ? "view" : "add");
  const isView = mode === "view";
  const isEditMode = mode === "edit";

  // ใบใหม่ยังไม่มี role จาก backend — คนที่กำลังทำใบอยู่คือคนสร้าง (ทรงเดียวกับ
  // PR: pr-form.tsx:81) ไม่ตั้ง default ปุ่มส่งจะไม่โผล่บนใบใหม่เพราะ canSubmit
  // เทียบ role === CREATE · ค่าอื่นที่อ่าน role ไม่กระทบ (undefined กับ "create"
  // ต่างก็ไม่เท่ากับ APPROVE/VIEW_ONLY อยู่แล้ว)
  const role = purchaseOrder?.role ?? STAGE_ROLE.CREATE;
  // คำนวณครั้งเดียวแล้วส่งให้ทั้งปุ่ม bulk และ footer — null (backend เก่า) = เปิดหมด
  const stageActions = getStageActionFlags(purchaseOrder?.stage_actions);
  const terminalStatus =
    purchaseOrder?.po_status === PO_STATUS.APPROVED ||
    purchaseOrder?.po_status === PO_STATUS.SENT_OR_PRINT ||
    purchaseOrder?.po_status === PO_STATUS.CLOSED ||
    purchaseOrder?.po_status === PO_STATUS.COMPLETED;
  const isReadOnly = role === STAGE_ROLE.APPROVE || terminalStatus;
  const isViewOnly = role === STAGE_ROLE.VIEW_ONLY;
  const canEdit = !isViewOnly && !terminalStatus;

  const dialogs = usePoDialogState();
  const { showDelete, showComment, showReject, showClose, showHistory } =
    dialogs;
  const hasHistory = !!purchaseOrder?.workflow_history?.length;

  const canClose =
    !!purchaseOrder &&
    (purchaseOrder.po_status === PO_STATUS.APPROVED ||
      purchaseOrder.po_status === PO_STATUS.SENT_OR_PRINT ||
      purchaseOrder.po_status === PO_STATUS.PARTIAL);
  const { data: previousStages, isLoading: stagesLoading } =
    usePoPreviousStages(purchaseOrder?.id);

  const buyerName = [
    profileData?.user_info?.firstname,
    profileData?.user_info?.lastname,
  ]
    .filter(Boolean)
    .join(" ");

  const defaultValues = getDefaultValues(purchaseOrder, {
    defaultCurrencyId,
    buyerId: profileData?.id ?? "",
    buyerName,
    email: profileData?.email,
  });

  const isManual = purchaseOrder?.po_type !== PO_TYPE.PR;

  const poSchema = createPoSchema(tv, tfl, isManual);
  const form = useForm<PoFormValues>({
    resolver: zodResolver(poSchema) as Resolver<PoFormValues>,
    defaultValues,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  usePoProfileSync({ form, profileData, purchaseOrder });

  // Rebaseline dirty state หลัง auto-populate (buyer/profile) + computed-sync
  // ของ item (order_qty/pricing/base_qty) settle. RHF (v7.78) คิด isDirty จาก
  // !deepEqual(getValues(), defaultValues) ทั้งฟอร์ม → setValue ค่า derived ที่
  // ต่างจาก default ทำให้ dirty ค้าง (ยังไม่ได้แก้จริง) → back/cancel ติด discard
  // dialog. reset(getValues, keepDirtyValues) ทำให้ค่า auto/derived เป็น baseline
  // (ไม่นับ dirty) แต่คงค่าที่ผู้ใช้แก้ไว้ — ทำครั้งเดียวหลัง data พร้อม
  const didRebaseline = useRef(false);
  useEffect(() => {
    if (didRebaseline.current) return;
    // add mode: รอ profile โหลด (buyer auto-fill) ก่อน rebaseline
    if (!purchaseOrder && !profileData) return;
    didRebaseline.current = true;
    form.reset(form.getValues(), { keepDirtyValues: true });
    // reset() re-validate ทั้งฟอร์ม → required field ที่ยังว่างโชว์ error แดงทั้งที่
    // user ยังไม่แตะ → clear (mode onChange จะ validate ใหม่เมื่อ user แก้จริง)
    form.clearErrors();
  }, [form, purchaseOrder, profileData]);

  // เดิมต้อง bump signal ให้ items grid กางแถวที่ location ติด error ก่อน เพราะช่อง
  // คลังอยู่ในแถวขยายเท่านั้น — ตอนนี้คลังเป็นคอลัมน์ปกติของตาราง ไม่มีอะไรให้กาง
  // scrollToFirstInvalidField หา field เจอเองตั้งแต่เฟรมแรก
  const revealErrors = (errors?: Record<string, unknown>) => {
    const count = countInvalidItems(errors);
    toast.warning(
      count > 0 ? tv("incompleteItems", { count }) : tv("incompleteDocument"),
    );
    // scroll หา field แรกที่ผิด — retry ข้ามเฟรมจน row ที่ auto-expand mount field เสร็จ
    // (order_qty rollup ระดับ item mark data-invalid ที่ QtyUnitCell ในแถวหลักแล้ว)
    scrollToFirstInvalidField();
  };

  const {
    deletePo,
    rejectPo,
    closePo,
    isPending,
    onSubmit,
    handleCancel,
    handleBack,
    validateSubmitPo,
    handleSubmitPo,
    handleApprovePo,
    handleRejectConfirm,
    handleReviewConfirm,
    handleClosePo,
    handleDeleteConfirm,
    discardDialogProps,
    navDiscardDialogProps,
  } = usePoFormHandlers({
    purchaseOrder,
    form,
    defaultValues,
    mode,
    setMode,
    role,
    setShowReject: dialogs.setShowReject,
    setShowClose: dialogs.setShowClose,
    revealErrors,
  });

  const isDisabled = (isView && role !== STAGE_ROLE.APPROVE) || isPending;

  // พ้น draft แล้ว workflow ล็อกถาวร — PoGeneralFields ใช้ค่านี้สั่ง disabled
  // ไม่ได้ใช้ซ่อน ฟิลด์จึงอยู่ที่เดิมทุกโหมด
  const isPoDraft =
    !purchaseOrder?.po_status || purchaseOrder.po_status === PO_STATUS.DRAFT;

  // ใบที่มาจาก price list ล็อกเนื้อหา **เฉพาะเมื่อพ้น draft แล้ว** — ตอนยังเป็นร่าง
  // คนทำใบต้องแก้ได้ ไม่งั้นกด Edit แล้วทั้งแถวกรอกไม่ได้สักช่อง ซึ่งเป็นทางตัน
  // (ของเดิมล็อกทันทีที่ po_type = pricelist โดยไม่ดูสถานะเลย)
  const isPriceListLocked =
    purchaseOrder?.po_type === PO_TYPE.PL &&
    !isPoDraft &&
    !isReadOnly &&
    !isViewOnly;
  const fieldsDisabled = isDisabled || isPriceListLocked;
  // PO ที่มาจาก PR: เนื้อหามาจาก PR หมดแล้ว ล็อกทุกอย่าง (items, คลัง, notes)
  // — ยกเว้น currency rate ที่ปลดไว้ใน PoGeneralFields (gate ที่ fieldsDisabled
  // ไม่ใช่ contentLocked) ให้ override เรตได้ · **ล็อกเมื่อพ้น draft แล้วเท่านั้น**
  // เหตุผลเดียวกับ price list ข้างบน
  const isFromPr = !isManual && !isPoDraft;
  const contentLocked = fieldsDisabled || isFromPr;
  // `isDisabled` ยกเว้นผู้อนุมัติไว้ (ดูบรรทัดที่ประกาศ) เพื่อให้ตัดสินรายแถวได้
  // แต่การยกเว้นนั้นรั่วมาถึงช่องคลังด้วย ผู้อนุมัติที่แค่เปิดอ่านใบเลยเจอ
  // combobox แทนข้อความ ทั้งที่ยังไม่ได้กด Edit — โหมดอ่านคือโหมดอ่านทุก role
  const locationsDisabled = isDisabled || isFromPr || isView;
  const departmentName = defaultBu?.department?.name ?? "";
  // ใบขอซื้อต้นทางรายแถว — อ่านจาก response ตรง ๆ ไม่ผ่านฟอร์ม เพราะเป็นข้อมูล
  // อ่านอย่างเดียวที่ไม่เคยถูกส่งกลับขึ้นไป (ลากเข้า PoFormValues จะรั่วขึ้น payload)
  const prSourcesByDetailId = useMemo(
    () => buildPrSourceMap(purchaseOrder),
    [purchaseOrder],
  );
  const grnSourcesByDetailId = useMemo(
    () => buildGrnSourceMap(purchaseOrder),
    [purchaseOrder],
  );

  return (
    <FormPageShell
      width="wide"
      header={
        <PoHeader
          purchaseOrder={purchaseOrder}
          mode={mode}
          canEdit={canEdit}
          canClose={canClose}
          terminalStatus={terminalStatus}
          isPending={isPending}
          deletePoIsPending={deletePo.isPending}
          departmentName={departmentName}
          buyerName={purchaseOrder?.buyer_name || buyerName}
          onBack={handleBack}
          onCancel={handleCancel}
          onEnterEdit={() => setMode("edit")}
          onShowClose={() => dialogs.setShowClose(true)}
          onShowComment={() => dialogs.setShowComment(true)}
          onShowDelete={() => dialogs.setShowDelete(true)}
          hasHistory={hasHistory}
          onShowHistory={() => dialogs.setShowHistory(true)}
        />
      }
      footer={
        <PoFooterAction
          control={form.control}
          currencyCode={form.getValues("currency_code")}
          isPending={isPending}
          isEditMode={isEditMode}
          role={role}
          poStatus={purchaseOrder?.po_status}
          previousStages={previousStages}
          stagesLoading={stagesLoading}
          // ใบใหม่ที่ยังไม่เคยเซฟก็กดส่งได้ — handleSubmitPo สร้างใบให้ก่อนแล้วค่อยส่ง
          // (ทรงเดียวกับ PR) ของเดิมส่ง undefined ทำให้ปุ่มหายจนกว่าจะกด Save ก่อน
          onSubmit={handleSubmitPo}
          onValidateSubmit={validateSubmitPo}
          onApprove={purchaseOrder ? handleApprovePo : undefined}
          onReject={
            purchaseOrder ? () => dialogs.setShowReject(true) : undefined
          }
          onReview={purchaseOrder ? handleReviewConfirm : undefined}
          stageActions={stageActions}
        />
      }
    >
      <form
        id="po-form"
        onSubmit={draftSaveHandler(form, onSubmit)}
        className="flex flex-col gap-4"
      >
        <PoGeneralFields
          form={form}
          disabled={fieldsDisabled || isView}
          isManual={isManual}
          readOnly={isReadOnly}
          isDraft={isPoDraft}
          isAdd={!purchaseOrder}
        />

        {/* เส้นคั่นเต็มความกว้าง แยกข้อมูลหัวใบ (ผู้ขาย/สกุลเงิน/วันที่/หมายเหตุ)
            ออกจากตารางรายการ — สองก้อนนี้อ่านคนละจังหวะกัน ก้อนบนอ่านทีเดียวจบ
            ก้อนล่างกวาดตาทีละแถว */}
        <hr className="border-border" />

        <PoItemFields
          form={form}
          prSourcesByDetailId={prSourcesByDetailId}
          grnSourcesByDetailId={grnSourcesByDetailId}
          disabled={contentLocked}
          locationsDisabled={locationsDisabled}
          role={role}
          poStatus={purchaseOrder?.po_status}
          isEditMode={isEditMode}
          isViewMode={isView}
          isPending={isPending}
          onApprove={purchaseOrder ? handleApprovePo : undefined}
          onReject={
            purchaseOrder ? () => dialogs.setShowReject(true) : undefined
          }
          onClose={purchaseOrder ? handleClosePo : undefined}
          stageActions={stageActions}
        />
      </form>

      <DiscardDialog {...discardDialogProps} variant="warning" />
      <DiscardDialog {...navDiscardDialogProps} variant="warning" />

      {purchaseOrder && (
        <>
          <DeleteDialog
            open={showDelete}
            onOpenChange={(open) =>
              !open && !deletePo.isPending && dialogs.setShowDelete(false)
            }
            title={t("deleteTitle")}
            description={t("deleteConfirm", { poNo: purchaseOrder.po_no })}
            isPending={deletePo.isPending}
            onConfirm={handleDeleteConfirm}
          />
          <Suspense fallback={null}>
            <EntityCommentSheet
              crud={poCommentCrud}
              entityId={purchaseOrder.id}
              open={showComment}
              onOpenChange={dialogs.setShowComment}
            />
          </Suspense>
          {hasHistory && (
            <Sheet open={showHistory} onOpenChange={dialogs.setShowHistory}>
              {/* ไม่ override ความกว้าง — ใช้ค่า default ของ SheetContent
                  (w-3/4 sm:max-w-sm) ให้เท่ากับ comment sheet */}
              <SheetContent side="right" className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{t("tabWorkflowHistory")}</SheetTitle>
                  <SheetDescription className="sr-only">
                    {t("tabWorkflowHistory")}
                  </SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-4">
                  <Suspense fallback={null}>
                    <WorkflowHistoryTimeline
                      history={purchaseOrder.workflow_history ?? []}
                      statusConfig={PR_WORKFLOW_ACTION_CONFIG}
                      emptyLabel={t("noWorkflowHistory")}
                      requestorName={purchaseOrder.buyer_name}
                      createdAt={purchaseOrder.audit?.created?.at}
                    />
                  </Suspense>
                </div>
              </SheetContent>
            </Sheet>
          )}
          <PoActionDialog
            open={showReject}
            onOpenChange={(open) => {
              if (!open && !rejectPo.isPending) dialogs.setShowReject(false);
            }}
            title={t("rejectTitle")}
            description={t("rejectConfirm")}
            confirmLabel={tc("reject")}
            confirmVariant="destructive"
            isPending={rejectPo.isPending}
            onConfirm={handleRejectConfirm}
          />
          <PoActionDialog
            open={showClose}
            onOpenChange={(open) => {
              if (!open && !closePo.isPending) dialogs.setShowClose(false);
            }}
            title={t("closeTitle")}
            description={t("closeConfirm")}
            confirmLabel={tc("close")}
            confirmVariant="warning"
            isPending={closePo.isPending}
            onConfirm={() => handleClosePo()}
          />
        </>
      )}
    </FormPageShell>
  );
}
