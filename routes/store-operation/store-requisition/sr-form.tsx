import { useState, useEffect } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { draftSaveHandler } from "@/lib/form-helpers";
import { FormPageShell } from "@/components/share/form-page-shell";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile } from "@/hooks/use-profile";
import {
  SR_TYPE,
  type StoreRequisition,
  type StoreRequisitionType,
} from "@/types/store-requisition";
import { type FormMode } from "@/types/form";
import { STAGE_ROLE } from "@/types/stage-role";
import { INVENTORY_TYPE } from "@/constant/location";
import {
  createSrSchema,
  computeSrAction,
  type SrFormValues,
} from "./sr-form-schema";
import {
  buildSrDefaultValues,
  buildSrDuplicateValues,
  srGrandTotal,
} from "./sr-form-helpers";
import { useSrFormActions } from "./use-sr-form-actions";
import { SrItemFields } from "./sr-item-fields";
import { SrHeader } from "./sr-header";
import { SrRequestDetails } from "./sr-request-details";
import { SrFooter } from "./sr-footer";
import { getStageActionFlags } from "@/lib/workflow-stage-actions";
import { SrFormDialogs } from "./sr-form-dialogs";
import { SrStockTable } from "./sr-stock-table";

interface StoreRequisitionFormProps {
  readonly storeRequisition?: StoreRequisition;
  readonly duplicateFrom?: StoreRequisition;
}

interface LocationInfo {
  readonly name: string;
  readonly code: string;
  readonly location_type?: string;
}

export function StoreRequisitionForm({
  storeRequisition,
  duplicateFrom,
}: StoreRequisitionFormProps) {
  "use no memo";
  const t = useTranslations("storeOperation.storeRequisition");
  const tfl = useTranslations("field");
  const tv = useTranslations("validation");
  const { data: profile, defaultBu, hasDepartment, dateFormat } = useProfile();

  const [mode, setMode] = useState<FormMode>(storeRequisition ? "view" : "add");
  const isView = mode === "view";
  const isAdd = mode === "add";

  const requestorName = profile
    ? `${profile.user_info.firstname} ${profile.user_info.lastname}`
    : "";
  // storeRequisition มาจาก useStoreRequisitionById (detail) เสมอ — endpoint นี้
  // ส่ง object (requestor/department/to_location) ไม่ใช่ flat _name เหมือน list
  const reqName = storeRequisition?.requestor?.name ?? requestorName;
  const defaultRequestorId = profile?.id ?? "";
  const departmentName =
    storeRequisition?.department?.name ?? defaultBu?.department?.name ?? "";
  const departmentCode = storeRequisition?.department?.code ?? "";
  const defaultDepartmentId = defaultBu?.department?.id ?? "";

  // ค่าแรกเข้า (duplicate = เติมของจากใบเดิมมาแล้ว) ส่วน baseline เทียบ dirty
  // ตอน duplicate ต้องเป็นฟอร์มเปล่า — เหตุผลเดียวกับ template ของ PR: ของที่
  // เติมคือของที่ยังไม่ save ฟอร์มต้องนับ dirty ตั้งแต่เกิดให้ navGuard ถามก่อนทิ้ง
  const initialValues = duplicateFrom
    ? buildSrDuplicateValues(
        duplicateFrom,
        defaultRequestorId,
        defaultDepartmentId,
      )
    : buildSrDefaultValues(
        storeRequisition,
        defaultRequestorId,
        defaultDepartmentId,
      );
  const defaultValues = duplicateFrom
    ? buildSrDefaultValues(undefined, defaultRequestorId, defaultDepartmentId)
    : initialValues;

  const srSchema = createSrSchema(tv, tfl);
  const form = useForm<SrFormValues>({
    resolver: zodResolver(srSchema) as Resolver<SrFormValues>,
    defaultValues: initialValues,
  });

  // จาก duplicate: สลับ baseline เป็นฟอร์มเปล่าโดยคงค่าที่เติมไว้ → dirty ตั้งแต่เกิด
  // (ต้องมาก่อน effect auto-populate ข้างล่าง — ดู pr-form.tsx เหตุผลเดียวกัน)
  useEffect(() => {
    if (!duplicateFrom) return;
    form.reset(defaultValues, { keepValues: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ครั้งเดียวตอน mount
  }, []);

  const actions = useSrFormActions({
    form,
    storeRequisition,
    defaultValues,
    mode,
    setMode,
  });
  const isDisabled = isView || actions.isPending;

  const [tab, setTab] = useState("items");

  // Radix ถอด TabsContent ที่ไม่ได้เลือกออกจาก DOM — กด submit ค้างอยู่แท็บ Stock
  // แล้วรายการกรอกไม่ครบ จะขึ้น toast เตือนแต่ไม่มีช่องให้เห็นว่าผิดตรงไหน
  const submitCount = form.formState.submitCount;
  useEffect(() => {
    if (!submitCount) return;
    if (form.formState.errors.items) setTab("items");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ยิงครั้งเดียวต่อการกด submit
  }, [submitCount]);

  const fromLocationId = useWatch({
    control: form.control,
    name: "from_location_id",
  });
  const toLocationId = useWatch({
    control: form.control,
    name: "to_location_id",
  });
  const srDate = useWatch({ control: form.control, name: "sr_date" });
  const workflowId = useWatch({ control: form.control, name: "workflow_id" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];
  const departmentId = useWatch({
    control: form.control,
    name: "department_id",
  });

  const [toLocInfo, setToLocInfo] = useState<LocationInfo>({
    name: storeRequisition?.to_location?.name ?? "",
    code: storeRequisition?.to_location?.code ?? "",
  });

  useEffect(() => {
    if (!profile || !defaultBu) return;
    // reset baseline (ไม่ใช่ setValue) ให้ค่า auto เป็น default — RHF คิด isDirty
    // จาก deepEqual(getValues, defaultValues) ทั้งฟอร์ม; setValue ค่าที่ต่างจาก
    // default จะทำให้ค้าง dirty ทั้งที่ยังไม่ได้กรอก → back/navigate ติด discard
    // (ดู pr-form.tsx). keepDirtyValues คงค่าที่ผู้ใช้แก้ไว้
    const values = form.getValues();
    const patch: Partial<SrFormValues> = {};
    if (!values.requestor_id) patch.requestor_id = defaultRequestorId;
    if (!values.department_id) patch.department_id = defaultDepartmentId;
    if (Object.keys(patch).length > 0) {
      // จาก duplicate ฟอร์ม dirty อยู่แล้ว (baseline เปล่า) — setValue ตรง ๆ พอ
      // ห้ามเดินทาง reset: keepDirtyValues เก็บเฉพาะ field ใน dirtyFields ซึ่ง
      // items ที่ prefill มายังไม่อยู่ → โดน wipe ทั้งตาราง (trap เดียวกับ PR)
      if (duplicateFrom) {
        if (patch.requestor_id)
          form.setValue("requestor_id", patch.requestor_id);
        if (patch.department_id)
          form.setValue("department_id", patch.department_id);
      } else {
        form.reset(
          {
            ...defaultValues,
            requestor_id: patch.requestor_id ?? values.requestor_id,
            department_id: patch.department_id ?? values.department_id,
          },
          { keepDirtyValues: true },
        );
      }
    }
    if (isAdd && !hasDepartment) {
      toast.warning(t("noDepartment"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaultValues โครงสร้างคงที่ในโหมด add; เว้นจาก deps กัน toast ยิงซ้ำทุก render
  }, [
    profile,
    defaultBu,
    form,
    defaultRequestorId,
    defaultDepartmentId,
    isAdd,
    hasDepartment,
    t,
  ]);

  // ปุ่ม Submit ค้างไว้ตั้งแต่ใบใหม่ — กดแล้วระบบ save ให้ก่อนค่อยส่ง (เหมือน PR)
  // แต่ต้องเป็นคนที่ backend ให้ role = create เท่านั้น (เจ้าของใบ/คนที่ถูก send back
  // กลับมา) — คนอื่นที่เปิดดูได้ role เป็น view_only ซึ่งเดิมหลุดมาเห็นปุ่มทั้งที่
  // ปุ่ม Edit ซ่อนไปแล้ว กดแล้วก็โดน backend ปัด; ใบใหม่ยังไม่มี role ถือเป็น create
  const role = storeRequisition?.role ?? STAGE_ROLE.CREATE;
  const canSubmit =
    role === STAGE_ROLE.CREATE &&
    (isAdd ||
      mode === "edit" ||
      (isView &&
        (storeRequisition?.doc_status === "draft" ||
          storeRequisition?.doc_status === "in_progress")));

  let derivedSrType: StoreRequisitionType | undefined;
  if (toLocInfo.location_type === INVENTORY_TYPE.DIRECT) {
    derivedSrType = SR_TYPE.ISSUE;
  } else if (toLocInfo.location_type) {
    derivedSrType = SR_TYPE.TRANSFER;
  } else {
    derivedSrType = storeRequisition?.sr_type;
  }

  // คำนวณครั้งเดียวแล้วส่งให้ทั้งปุ่ม bulk และ footer — null (backend เก่า) = เปิดหมด
  const stageActions = getStageActionFlags(storeRequisition?.stage_actions);

  const itemFieldsProps = {
    form,
    disabled: isDisabled,
    disableAdd: !fromLocationId || !toLocationId || !workflowId,
    fromLocationId: fromLocationId ?? "",
    toLocationId: toLocationId ?? "",
    workflowId: workflowId ?? "",
    role: storeRequisition ? storeRequisition.role : STAGE_ROLE.CREATE,
    srId: storeRequisition?.id,
    docStatus: storeRequisition?.doc_status,
    stageActions,
  };

  return (
    <FormPageShell
      width="wide"
      header={
        <SrHeader
          storeRequisition={storeRequisition}
          srType={derivedSrType}
          mode={mode}
          isPending={actions.isPending}
          hasDepartment={!!departmentId}
          isDeletePending={actions.deleteIsPending}
          srDate={srDate}
          dateFormat={dateFormat}
          requesterName={reqName}
          departmentName={departmentName}
          departmentCode={departmentCode}
          isLoading={!profile}
          onBack={actions.handleBack}
          onEdit={() => setMode("edit")}
          onCancel={actions.handleCancel}
          onDelete={() => actions.setShowDelete(true)}
          onComment={() => actions.setShowComment(true)}
        />
      }
      footer={
        <SrFooter
          canSubmit={!!canSubmit}
          isPending={actions.isPending}
          role={storeRequisition?.role}
          action={computeSrAction(items.map((i) => i.stage_status ?? ""))}
          grandTotal={srGrandTotal(items)}
          hasItems={items.length > 0}
          activeTab={tab === "stock" ? "stock" : "items"}
          srId={storeRequisition?.id}
          docStatus={storeRequisition?.doc_status}
          stageActions={stageActions}
          onSubmit={actions.openSubmitDialog}
          onApprove={() => actions.setActionDialog("approve")}
          onIssue={() => actions.setActionDialog("issue")}
          onReject={() => actions.setActionDialog("reject")}
          onSendBack={() => actions.setActionDialog("review")}
        />
      }
    >
      <form
        id="store-requisition-form"
        onSubmit={draftSaveHandler(form, actions.onSubmit)}
        className="space-y-4"
      >
        <SrRequestDetails
          form={form}
          readOnly={isView}
          disabled={actions.isPending}
          onToLocInfoChange={setToLocInfo}
          savedFromLocation={storeRequisition?.from_location}
          savedToLocation={storeRequisition?.to_location}
          role={storeRequisition?.role ?? STAGE_ROLE.CREATE}
          isDraft={
            !storeRequisition?.doc_status ||
            storeRequisition.doc_status === "draft"
          }
          isAdd={isAdd}
        />

        {/* เส้นคั่นเต็มความกว้าง แยกข้อมูลหัวใบออกจากตารางรายการ (เหมือน PO/GRN)
            สองก้อนนี้อ่านคนละจังหวะ ก้อนบนอ่านทีเดียวจบ ก้อนล่างกวาดตาทีละแถว */}
        <hr className="border-border" />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line">
            <TabsTrigger value="items">{t("tabItems")}</TabsTrigger>
            <TabsTrigger value="stock">{t("tabStock")}</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-4">
            {form.formState.errors.items?.message && (
              <p className="text-destructive text-xs" role="alert">
                {form.formState.errors.items.message}
              </p>
            )}
            <SrItemFields {...itemFieldsProps} />
          </TabsContent>

          <TabsContent value="stock">
            <SrStockTable
              srId={storeRequisition?.id}
              srNo={storeRequisition?.sr_no}
              docStatus={storeRequisition?.doc_status}
            />
          </TabsContent>
        </Tabs>
      </form>

      <SrFormDialogs
        storeRequisition={storeRequisition}
        form={form}
        items={items}
        actions={actions}
      />
    </FormPageShell>
  );
}
