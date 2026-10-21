import { useState, useEffect } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useTranslations } from "use-intl";
import {
  scrollToFirstInvalidField,
  draftSaveHandler,
} from "@/lib/form-helpers";
import { FormPageShell } from "@/components/share/form-page-shell";
import {
  PR_STATUS,
  type PurchaseRequest,
  type PurchaseRequestTemplate,
} from "@/types/purchase-request";
import { STAGE_ROLE } from "@/types/stage-role";
import { type FormMode } from "@/types/form";
import { PrDescriptionField, PrWorkflowField } from "./pr-general-fields";
import { PrItemFields } from "./pr-item-fields";
import { PrFooterAction } from "./workflow/pr-footer-action";
import { PrFormDialogs } from "./pr-form-dialogs";
import { usePrFormActions } from "./use-pr-form-actions";
import {
  createPrSchema,
  type PrFormValues,
  getDefaultValues,
  getDuplicateValues,
} from "./pr-form-schema";
import { getStageActionFlags } from "@/lib/workflow-stage-actions";
import { useCan } from "@/hooks/use-can";
import { useProfile } from "@/hooks/use-profile";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import { canDeletePr } from "./pr-ownership";
import { usePrPreviousStages } from "./use-purchase-request";
import { formatDate } from "@/lib/date-utils";
import { PrHeader } from "./pr-header";

interface PurchaseRequestFormProps {
  readonly purchaseRequest?: PurchaseRequest;
  readonly template?: PurchaseRequestTemplate;
  readonly duplicateFrom?: PurchaseRequest;
}

export function PurchaseRequestForm({
  purchaseRequest,
  template,
  duplicateFrom,
}: PurchaseRequestFormProps) {
  const t = useTranslations("procurement.purchaseRequest");
  // คำนวณครั้งเดียวแล้วส่งให้ทั้งปุ่ม bulk และ footer — null (backend เก่า) = เปิดหมด
  const stageActions = getStageActionFlags(purchaseRequest?.stage_actions);
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");
  const {
    data: profile,
    defaultBu,
    buCode,
    dateFormat,
    hasDepartment,
    userId,
  } = useProfile();
  const { isAdmin } = useCan();

  const [mode, setMode] = useState<FormMode>(purchaseRequest ? "view" : "add");
  const isView = mode === "view";
  const isAdd = mode === "add";

  const showNoDepartment = isAdd && !!profile && !!defaultBu && !hasDepartment;
  const { data: previousStages, isLoading: stagesLoading } =
    usePrPreviousStages(
      purchaseRequest?.id,
      !!purchaseRequest?.workflow?.id &&
        !!purchaseRequest?.workflow_current_stage,
    );

  // ค่าแรกเข้าของฟอร์ม (มี template/duplicateFrom = เติมของมาให้แล้ว) ส่วน
  // baseline ที่ใช้เทียบ dirty ตอนมาจาก prefill ต้องเป็นฟอร์มเปล่า — ของที่
  // ถูกเติมคือของที่ยังไม่ save ถ้าปล่อยเป็น baseline ฟอร์มจะไม่ dirty
  // เลย กด back ออกเงียบ ๆ โดย discard ไม่ถามทั้งที่มีของค้างเต็มฟอร์ม
  const initialValues = duplicateFrom
    ? getDuplicateValues(duplicateFrom)
    : getDefaultValues(purchaseRequest, template);
  const isPrefilled = !!template || !!duplicateFrom;
  const defaultValues = isPrefilled ? getDefaultValues() : initialValues;
  const role = purchaseRequest?.role ?? STAGE_ROLE.CREATE;

  const form = useForm<PrFormValues>({
    resolver: zodResolver(
      createPrSchema(tv, tfl, role),
    ) as Resolver<PrFormValues>,
    defaultValues: initialValues,
    // Purchase stage บังคับ vendor/price/tax ผ่าน schema — ถ้า validate แบบ
    // onChange จะขึ้น error แดงทันทีที่แตะฟอร์ม ทำให้ตอน "send back" เหมือนถูก
    // บังคับกรอกทั้งที่ไม่ต้อง จึง validate เฉพาะตอนกด action (onSubmit) สำหรับ
    // purchase role ส่วน role อื่นคง live validation เดิมไว้
    mode: role === STAGE_ROLE.PURCHASE ? "onSubmit" : "onChange",
    reValidateMode: "onChange",
  });

  // จาก template/duplicate: สลับ baseline เป็นฟอร์มเปล่าโดยคงค่าที่เติมไว้ →
  // ฟอร์มนับเป็น dirty ตั้งแต่เกิด navGuard/discard เลยทำงานเหมือนผู้ใช้กรอกเองทุกช่อง
  // (ต้องมาก่อน effect auto-populate ข้างล่าง — ตัวนั้น reset ด้วย keepDirtyValues
  // ซึ่งจะคงค่าที่เติมไว้ก็ต่อเมื่อ field พวกนั้นถูกนับ dirty แล้วเท่านั้น)
  useEffect(() => {
    if (!isPrefilled) return;
    form.reset(defaultValues, { keepValues: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ครั้งเดียวตอน mount
  }, []);

  // validate เฉพาะตอนกด "Purchase Approve" เท่านั้น (action-aware) — send back
  // จะไม่เรียกตัวนี้จึงไม่บังคับกรอก vendor/price/tax. ใช้ handleSubmit เพื่อให้
  // submitCount เพิ่มและ reValidateMode:onChange ช่วยล้าง error ทันทีที่แก้ field
  const validatePurchase = () =>
    new Promise<boolean>((resolve) => {
      form.handleSubmit(
        () => resolve(true),
        () => {
          scrollToFirstInvalidField();
          resolve(false);
        },
      )();
    });

  // Re-validate เมื่อ role เปลี่ยน (schema change → ต้อง trigger ใหม่)
  useEffect(() => {
    if (form.formState.isSubmitted) form.trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form is stable
  }, [role]);

  useUnsavedChanges(form.formState.isDirty);

  const actions = usePrFormActions({
    form,
    purchaseRequest,
    defaultValues,
    mode,
    setMode,
    role,
  });

  // ใบของคนอื่น backend ลบให้ไม่ได้อยู่แล้ว — บอกตั้งแต่ตอนกดปุ่ม อย่าเพิ่งถามว่า
  // "จะลบไหม" แล้วค่อยไปบอกว่าลบไม่ได้หลังกดยืนยัน (ดู pr-ownership.ts)
  const handleDeleteClick = () => {
    if (!canDeletePr(purchaseRequest, userId, isAdmin)) {
      dispatchPermissionDenied(undefined, t("deleteNotOwner"));
      return;
    }
    actions.setShowDelete(true);
  };

  // draft/add เท่านั้นที่แสดง general fields — ไม่ draft แล้วซ่อน
  const isDraft =
    !purchaseRequest?.pr_status ||
    purchaseRequest.pr_status === PR_STATUS.DRAFT;

  // ไม่ lock ตาม status — backend ให้ role เป็น view_only อยู่แล้วถ้าผู้ใช้ไม่ใช่
  // actor ของ stage ปัจจุบัน ส่วน non-draft ที่ role = create คือใบถูก send back
  // กลับมาหาคนขอ ซึ่งต้องแก้ได้ (แถวที่ตัดสินแล้วยังล็อกราย row ผ่าน isRowLocked)
  const isDisabled = isView || actions.isPending;

  const hasHistory = !!purchaseRequest?.workflow_history?.length;

  // Notes (description) — view หรือหลัง submit (role != CREATE) แสดงเป็น plain text
  const descriptionReadOnly = isView || role !== STAGE_ROLE.CREATE;

  // workflow แก้ได้เฉพาะใบ draft ที่ผู้สร้างกำลังแก้อยู่และไม่ได้มาจาก template
  // นอกนั้นเป็นค่าอ่านอย่างเดียว → ไปอยู่ในแถบข้อมูลบนหัวรวมกับฟิลด์อื่น
  // (ไม่ใช่ปล่อยเป็น field เดี่ยวลอยอยู่ใต้คำอธิบาย ซึ่งอ่านเหมือนของตกหล่น)
  const workflowEditable =
    isDraft && !isView && role === STAGE_ROLE.CREATE && !template;
  const watchedDescription = useWatch({
    control: form.control,
    name: "description",
  });

  const requestorName = profile
    ? `${profile.user_info.firstname} ${profile.user_info.lastname}`
    : "";

  const defaultRequestorName = purchaseRequest?.requestor?.name;
  const defaultRequestorId = profile?.id ?? "";
  const defaultDefaultId = defaultBu?.department?.id ?? "";
  const defaultDepartmentName = purchaseRequest?.department?.name;
  const defaultPrDate = purchaseRequest?.pr_date;

  const reqName = defaultRequestorName ?? requestorName;
  const departmentName =
    defaultDepartmentName ?? defaultBu?.department?.name ?? "";

  const [todayIso] = useState(() => new Date().toISOString());
  const prDateDisplay = formatDate(defaultPrDate || todayIso, dateFormat);

  // Auto-populate ค่า default ที่ซ่อนไว้ (pr_date/requestor/department) — ต้อง
  // reset baseline ไม่ใช่ setValue. RHF คิด isDirty = !deepEqual(getValues(),
  // defaultValues) ทั้งฟอร์ม; setValue ค่าที่ต่างจาก default จะ "ค้าง" อยู่ใน
  // formValues แล้วพอมี action ใดไป trigger การ recompute (เช่นเพิ่ม/ลบ item,
  // profile โหลด, useWatch) ฟอร์มจะกลายเป็น dirty ทั้งที่ยังไม่ได้กรอกจริง →
  // back/navigate ติด discard. reset + keepDirtyValues ทำให้ค่า auto เป็น
  // baseline (ไม่นับ dirty) แต่ยังคงค่าที่ผู้ใช้แก้ไว้เป็น dirty ตามเดิม
  useEffect(() => {
    const values = form.getValues();
    const patch: Partial<PrFormValues> = {};
    if (!values.pr_date) {
      patch.pr_date = new Date().toISOString().split("T")[0];
    }
    if (profile && defaultBu) {
      if (!values.requestor_id) patch.requestor_id = defaultRequestorId;
      if (!values.department_id) patch.department_id = defaultDefaultId;
    }
    if (Object.keys(patch).length === 0) return;
    // จาก template/duplicate ฟอร์มต้อง dirty อยู่แล้ว (baseline เปล่า) — setValue
    // ตรง ๆ พอ ไม่ต้องเดินทาง reset ข้างล่าง
    //
    // ทางนั้นเคย **ล้างตารางทิ้ง** ใน react-hook-form ≤7.87 เพราะ `keepDirtyValues`
    // เก็บเฉพาะ field ที่อยู่ใน `dirtyFields` ซึ่งตอนนั้นไม่มี items ที่ prefill มา
    // 7.88 แก้ให้ `dirtyFields` sync ถูกต้อง (#13701) ตารางจึงไม่หายแล้ว — แต่ยังใช้
    // setValue ต่อ เพราะมันไม่ต้องพึ่ง `dirtyFields` ซึ่งเป็น internal state ที่
    // เปลี่ยนพฤติกรรมมาแล้วหนึ่งรอบ (ดู pr-form-dirty.test.tsx ที่ยืนยันทั้งสองชั้น)
    if (isPrefilled) {
      if (patch.pr_date) form.setValue("pr_date", patch.pr_date);
      if (patch.requestor_id) form.setValue("requestor_id", patch.requestor_id);
      if (patch.department_id)
        form.setValue("department_id", patch.department_id);
      return;
    }
    // ใช้ค่า auto ที่ตั้งไว้แล้วเป็น baseline ต่อ (patch.X ?? values.X) — กันเคส
    // profile โหลดทีหลัง (2 เฟส) แล้ว reset รอบสองไป wipe pr_date ที่ตั้งไว้รอบแรก
    form.reset(
      {
        ...defaultValues,
        pr_date: patch.pr_date ?? values.pr_date,
        requestor_id: patch.requestor_id ?? values.requestor_id,
        department_id: patch.department_id ?? values.department_id,
      },
      { keepDirtyValues: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form stable; defaultValues โครงสร้างคงที่ในโหมด add
  }, [profile, defaultBu, form, defaultRequestorId, defaultDefaultId]);

  useEffect(() => {
    const formEl = document.getElementById("purchase-request-form");
    if (!formEl) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
        e.preventDefault();
      }
    };
    formEl.addEventListener("keydown", handler);
    return () => formEl.removeEventListener("keydown", handler);
  }, []);

  return (
    <FormPageShell
      width="wide"
      header={
        <PrHeader
          purchaseRequest={purchaseRequest}
          mode={mode}
          role={role}
          isPending={actions.isPending}
          isDeletePending={actions.deletePr.isPending}
          onBack={actions.handleBack}
          onEdit={() => setMode("edit")}
          onCancel={actions.handleCancel}
          onDelete={handleDeleteClick}
          onComment={() => actions.setShowComment(true)}
          reqName={reqName}
          departmentName={departmentName ?? ""}
          prDateDisplay={prDateDisplay}
          description={descriptionReadOnly ? watchedDescription : undefined}
          workflowName={
            purchaseRequest?.workflow?.name ??
            template?.workflow?.name ??
            undefined
          }
          workflowField={
            workflowEditable ? (
              <PrWorkflowField
                form={form}
                disabled={actions.isPending}
                isAdd={isAdd}
              />
            ) : undefined
          }
          descriptionField={
            descriptionReadOnly ? undefined : (
              <PrDescriptionField
                form={form}
                disabled={actions.isPending}
                className="lg:col-span-2"
              />
            )
          }
          hasHistory={hasHistory}
          onShowHistory={() => actions.setShowHistory(true)}
        />
      }
      footer={
        <PrFooterAction
          role={role}
          prStatus={purchaseRequest?.pr_status}
          isPending={actions.isPending}
          hasRecord={!!purchaseRequest}
          control={form.control}
          currencyCode={defaultBu?.config?.default_currency?.code ?? ""}
          previousStages={previousStages}
          stagesLoading={stagesLoading}
          onSubmitPr={actions.handleSubmitPr}
          onValidateSubmit={actions.validateSubmitPr}
          onApprove={actions.handleApprove}
          onReject={actions.handleReject}
          onReview={actions.handleReview}
          stageActions={stageActions}
          onPurchaseApprove={actions.handlePurchaseApprove}
          onValidatePurchase={validatePurchase}
        />
      }
    >
      <form
        id="purchase-request-form"
        onSubmit={(e) => {
          actions.fillKnownItemDefaults();
          draftSaveHandler(form, actions.onSubmit)(e);
        }}
        className="space-y-4"
      >
        <hr className="border-border" />

        <PrItemFields
          form={form}
          isDisabled={isDisabled}
          role={role}
          prId={purchaseRequest?.id}
          prStatus={purchaseRequest?.pr_status}
          buCode={buCode}
          defaultBu={defaultBu}
          dateFormat={dateFormat}
          onSplit={actions.handleSplit}
          previousStages={previousStages}
          stagesLoading={stagesLoading}
          stageActions={stageActions}
          onBulkReview={actions.handleBulkReview}
        />
      </form>

      <PrFormDialogs
        purchaseRequest={purchaseRequest}
        showDelete={actions.showDelete}
        setShowDelete={actions.setShowDelete}
        deletePr={actions.deletePr}
        showComment={actions.showComment}
        setShowComment={actions.setShowComment}
        showHistory={actions.showHistory}
        setShowHistory={actions.setShowHistory}
        workflowHistory={purchaseRequest?.workflow_history}
        requestorName={purchaseRequest?.requestor?.name ?? undefined}
        createdAt={purchaseRequest?.audit?.created?.at}
        showNoDepartment={showNoDepartment}
        discardDialogProps={actions.discardDialogProps}
        navDiscardDialogProps={actions.navDiscardDialogProps}
        actionDialog={actions.actionDialog}
        setActionDialog={actions.setActionDialog}
        isPending={actions.isPending}
        onActionConfirm={actions.handleActionConfirm}
      />
    </FormPageShell>
  );
}
