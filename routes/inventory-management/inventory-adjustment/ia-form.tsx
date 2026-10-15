import { useState, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { useListReturn } from "@/hooks/use-list-return";
import { useFormatter, useTranslations } from "use-intl";
import { toast } from "sonner";
import {
  useCreateInventoryAdjustment,
  useUpdateInventoryAdjustment,
  useDeleteInventoryAdjustment,
  useCommitInventoryAdjustment,
  useVoidInventoryAdjustment,
} from "./use-inventory-adjustment";
import { useProfile } from "@/hooks/use-profile";
import { ADJUSTMENT_TYPE } from "@/types/adjustment-type";
import {
  INVENTORY_ADJUSTMENT_BASE_PATH,
  type InventoryAdjustment,
  type InventoryAdjustmentType,
} from "@/types/inventory-adjustment";
import type { FormMode } from "@/types/form";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { useErrorToast } from "@/hooks/use-error-toast";
import { ApiError, ERROR_CODES, isAppStatusErrorCode } from "@/lib/api-error";
import { VoidDialog } from "@/components/share/void-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  buildItemChanges,
  scrollToFirstInvalidField,
} from "@/lib/form-helpers";
import {
  createAdjSchema,
  type AdjFormValues,
  getDefaultValues,
  mapItemToPayload,
  resolveDefaultDate,
} from "./ia-form-schema";
import { AdjItemFields } from "./ia-item-fields";
import { DocumentInfo } from "./ia-doc-info";
import { AdjSummaryFooter } from "./ia-summary";
import { FormPageShell } from "@/components/share/form-page-shell";
import { IaFormHero } from "./ia-form-hero";
import { Check } from "lucide-react";

interface InventoryAdjustmentFormProps {
  readonly adjustmentType: InventoryAdjustmentType;
  readonly inventoryAdjustment?: InventoryAdjustment;
}

export function InventoryAdjustmentForm({
  adjustmentType,
  inventoryAdjustment,
}: InventoryAdjustmentFormProps) {
  const navigate = useNavigate();
  const { toList, returnState } = useListReturn(INVENTORY_ADJUSTMENT_BASE_PATH);
  const [mode, setMode] = useState<FormMode>(
    inventoryAdjustment ? "view" : "add",
  );
  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isAdd = mode === "add";

  const createAdj = useCreateInventoryAdjustment();
  const updateAdj = useUpdateInventoryAdjustment();
  const deleteAdj = useDeleteInventoryAdjustment();
  const voidAdj = useVoidInventoryAdjustment();
  const commitAdj = useCommitInventoryAdjustment();
  const [showDelete, setShowDelete] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [showCommit, setShowCommit] = useState(false);
  const isPending =
    createAdj.isPending || updateAdj.isPending || commitAdj.isPending;
  const isDisabled = isView || isPending;

  const t = useTranslations("inventoryManagement.inventoryAdjustment");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const formatter = useFormatter();

  const { currentPeriod, dateFormat } = useProfile();
  const adjTypeFilter =
    adjustmentType === "stock-in"
      ? ADJUSTMENT_TYPE.STOCK_IN
      : ADJUSTMENT_TYPE.STOCK_OUT;
  const defaultValues = getDefaultValues(
    inventoryAdjustment,
    currentPeriod?.end_at,
  );

  const adjSchema = createAdjSchema(
    tv,
    tfl,
    currentPeriod?.start_at,
    currentPeriod?.end_at,
  );
  const form = useForm<AdjFormValues>({
    resolver: zodResolver(adjSchema) as Resolver<AdjFormValues>,
    defaultValues,
  });

  // guard สองตัวต้องอ่าน dirty ค่าเดียวกัน ไม่งั้นปุ่ม Back ถามแต่เมนู sidebar เงียบ
  const isFormDirty = form.formState.isDirty;

  const discard = useDiscardConfirm({
    isDirty: isFormDirty,
    isPending: isPending || deleteAdj.isPending || voidAdj.isPending,
  });

  // ระหว่าง submit ตอน create ปิด guard — ไม่งั้น sentinel ที่ guard ดันไว้ที่ /new
  // ค้างอยู่ใน history stack หลัง navigate ออกไป กด back แล้วเจอ /new ซ้ำ
  const [isSubmitting, setIsSubmitting] = useState(false);

  // useDiscardConfirm ดักได้แค่ปุ่มในฟอร์มเอง (Cancel/Back) — ลิงก์ข้างนอกอย่าง
  // เมนู sidebar ต้องใช้ตัวนี้ดัก ไม่งั้นกดแล้วหลุดออกไปพร้อมข้อมูลที่ยังไม่ได้เซฟ
  const navGuard = useNavigationGuard(
    (isAdd || isEdit) && isFormDirty && !isSubmitting,
  );

  // currentPeriod loads async after mount — sync the default date once it arrives.
  // reset baseline (ไม่ใช่ setValue) ให้ date เป็น default — กัน isDirty ค้างทำให้
  // back ติด discard ทั้งที่ยังไม่ได้แก้ (ดู pr-form.tsx). keepDirtyValues คงค่าที่แก้
  useEffect(() => {
    if (inventoryAdjustment || !currentPeriod?.end_at) return;
    if (form.formState.dirtyFields.date) return;
    form.reset(
      { ...defaultValues, date: resolveDefaultDate(currentPeriod.end_at) },
      { keepDirtyValues: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPeriod?.end_at, inventoryAdjustment]);

  const typeLabel =
    adjustmentType === "stock-in" ? tfl("stockIn") : tfl("stockOut");
  const isReadOnly =
    inventoryAdjustment?.doc_status === "voided" ||
    inventoryAdjustment?.doc_status === "completed";

  const errorToast = useErrorToast();
  const handleMutationError = (err: unknown) => {
    // backend คืน business error (เช่น "Insufficient stock. Requested: 3,
    // Available: 1") เป็น HTTP 500 → INTERNAL_ERROR ซึ่ง errorToast จะกลบเป็น
    // ข้อความ generic — กรณีนี้แสดง message จาก server ตรง ๆ
    // รหัสสถานะแอป (เช่น 503 APP_READ_ONLY) ก็เป็น INTERNAL_ERROR แต่ message คือประโยค default
    // ภาษาอังกฤษของ gateway — ปล่อยให้ errorToast แปลตาม appCode แทน
    if (
      err instanceof ApiError &&
      err.code === ERROR_CODES.INTERNAL_ERROR &&
      !isAppStatusErrorCode(err.appCode)
    ) {
      toast.error(err.message);
      return;
    }
    errorToast(err);
    // เปิด guard กลับทุกครั้งที่ยิงไม่ผ่าน ไม่งั้นฟอร์มที่ยัง dirty จะออกได้โดยไม่ถาม
    setIsSubmitting(false);
  };

  // เซฟแล้วอยู่กับใบเดิม ไม่เด้งกลับหน้ารายการ — คนเพิ่งกรอกเสร็จมักอยากเห็นผล
  // ที่ตัวเอกสารก่อน ถ้าจะกลับก็มีปุ่ม back อยู่แล้ว
  const handleUpdateSuccess = () => {
    toast.success(tt("updateSuccess", { entity: t("entity") }));
    // rebaseline ค่าที่เพิ่งเซฟ ไม่งั้น isDirty ค้างแล้วเตือน "ยังไม่ได้บันทึก"
    // ตอนออกจากหน้า ทั้งที่บันทึกไปแล้ว
    form.reset(form.getValues());
    setMode("view");
  };

  // ตอนสร้างยังไม่มี URL ของใบ — พาไปหน้าใบที่เพิ่งสร้าง (replace เพื่อไม่ให้กด
  // back แล้วย้อนกลับมาหน้า /new ที่ส่งไปแล้ว) ไม่มี id ค่อยตกกลับหน้ารายการ
  const handleCreateSuccess = (data: { data?: { id?: string } }) => {
    toast.success(tt("createSuccess", { entity: t("entity") }));
    const newId = data?.data?.id;
    if (newId) {
      navigate(
        `${INVENTORY_ADJUSTMENT_BASE_PATH}/${newId}?type=${adjustmentType}`,
        { replace: true, ...returnState },
      );
      return;
    }
    toList();
  };

  const buildBasePayload = (values: AdjFormValues) => {
    const dateKey = adjustmentType === "stock-in" ? "si_date" : "so_date";
    return {
      description: values.description,
      doc_status: values.doc_status,
      adjustment_type_id: values.adjustment_type_id ?? "",
      [dateKey]: values.date,
      location_id: values.location_id,
    };
  };

  const detailsKey =
    adjustmentType === "stock-in" ? "stock_in_detail" : "stock_out_detail";

  const buildUpdatePayload = (values: AdjFormValues) => ({
    id: inventoryAdjustment!.id,
    type: adjustmentType,
    doc_version: inventoryAdjustment!.doc_version,
    ...buildBasePayload(values),
    [detailsKey]: buildItemChanges(
      values.items,
      defaultValues.items,
      mapItemToPayload,
    ),
  });

  const buildCreatePayload = (values: AdjFormValues) => ({
    type: adjustmentType,
    ...buildBasePayload(values),
    [detailsKey]: { add: values.items.map(mapItemToPayload) },
  });

  const submitUpdate = (values: AdjFormValues) => {
    if (!inventoryAdjustment) return;
    updateAdj.mutate(buildUpdatePayload(values), {
      onSuccess: handleUpdateSuccess,
      onError: handleMutationError,
    });
  };

  const submitCreate = (values: AdjFormValues) => {
    // ปิด guard ก่อนยิง mutation → sentinel ถูก teardown ลบระหว่างรอ network
    setIsSubmitting(true);
    createAdj.mutate(buildCreatePayload(values), {
      onSuccess: handleCreateSuccess,
      onError: handleMutationError,
    });
  };

  const onSubmit = (values: AdjFormValues) => {
    if (isEdit && inventoryAdjustment) return submitUpdate(values);
    if (isAdd) return submitCreate(values);
  };

  // กด Commit = ปิดเอกสารเข้าสต๊อกจริงและแก้ไม่ได้อีก จึงต้องถามก่อน — validate
  // ให้ผ่านก่อนเปิด dialog (กติกาเดียวกับ SR) ไม่งั้นกดยืนยันแล้วเจอ error แดง
  // เอา doc_status ไปตั้งตอนยืนยันจริง ถ้ายกเลิกฟอร์มจะไม่ค้างสถานะ completed
  const openCommitDialog = () =>
    form.handleSubmit(
      () => setShowCommit(true),
      () => scrollToFirstInvalidField(),
    )();

  /**
   * ปิดเอกสาร — `/commit` เปลี่ยนแค่สถานะ ไม่ได้รับรายการสินค้าไปด้วย จึงต้องมีใบ
   * ที่บันทึกแล้วอยู่ก่อนเสมอ (ท่าเดียวกับ PR ที่เซฟของค้างให้ก่อนแล้วค่อยยิง action)
   *
   * - ยังไม่เคยเซฟเลย (กด Commit จากใบใหม่) → POST สร้างเป็น draft ก่อน แล้วค่อย PATCH
   * - เซฟแล้วแต่ยังแก้ค้าง → PATCH /save ก่อน แล้วใช้ doc_version ที่เพิ่งได้กลับมา
   *   (ตัวเดิม stale ทันทีที่ save สำเร็จ)
   * - ไม่มีอะไรค้าง → PATCH /commit ตรง ๆ
   */
  const confirmCommit = () => {
    setShowCommit(false);
    form.handleSubmit(
      async (values) => {
        // ทุกทางออกของ commit จบด้วย navigate — ปิด guard ตั้งแต่ต้น
        setIsSubmitting(true);
        try {
          if (!inventoryAdjustment) {
            const created = await createAdj.mutateAsync(
              buildCreatePayload({ ...values, doc_status: "draft" }),
            );
            const newId = created?.data?.id;
            if (!newId) {
              toList();
              return;
            }
            await commitAdj.mutateAsync({
              id: newId,
              type: adjustmentType,
              doc_version: created?.data?.doc_version,
            });
            toast.success(tt("createSuccess", { entity: t("entity") }));
            toList({ replace: true });
            return;
          }

          let docVersion = inventoryAdjustment.doc_version;
          if (form.formState.isDirty) {
            const saved = await updateAdj.mutateAsync(
              buildUpdatePayload(values),
            );
            docVersion = saved?.data?.doc_version ?? docVersion;
          }
          await commitAdj.mutateAsync({
            id: inventoryAdjustment.id,
            type: adjustmentType,
            doc_version: docVersion,
          });
          toast.success(tt("updateSuccess", { entity: t("entity") }));
          // reset ก่อนออกจากหน้า ไม่งั้น isDirty ค้างแล้วโดน discard ขวางตอน navigate
          form.reset(form.getValues());
          toList();
        } catch (err) {
          handleMutationError(err);
        }
      },
      () => scrollToFirstInvalidField(),
    )();
  };

  const handleCancel = () => {
    discard.confirm(() => {
      if (isEdit && inventoryAdjustment) {
        form.reset(defaultValues);
        setMode("view");
        return;
      }
      toList();
    });
  };

  // Back = กลับหน้า list เสมอ ไม่ใช่ history back — history คือเส้นทางที่เดินผ่านมา
  // ไม่ใช่ที่ที่อยากกลับไป กดครั้งเดียวต้องถึง list ไม่ใช่ถอยทีละหน้า
  const goBack = () => {
    toList();
  };

  const handleBack = () => {
    if (isEdit || isAdd) {
      discard.confirm(goBack);
    } else {
      goBack();
    }
  };

  return (
    // footer = แถบสรุป (mt-auto) — FormPageShell ยืดเต็มจอให้มันติดก้นจอเมื่อเนื้อสั้น
    // เต็มจอแบบเดียวกับ PO/PR/SR/GRN/CN — ตารางรายการได้ความกว้างเต็มที่
    <FormPageShell
      width="wide"
      header={
        <IaFormHero
          adjustmentType={adjustmentType}
          inventoryAdjustment={inventoryAdjustment}
          form={form}
          typeLabel={typeLabel}
          mode={mode}
          isReadOnly={isReadOnly}
          isPending={isPending}
          deleteIsPending={deleteAdj.isPending}
          formId="inventory-adjustment-form"
          onBack={handleBack}
          onCancel={handleCancel}
          onEdit={() => setMode("edit")}
          onDelete={() => setShowDelete(true)}
        />
      }
      footer={
        <AdjSummaryFooter
          form={form}
          adjustmentType={adjustmentType}
          formatter={formatter}
          t={t}
          canVoid={isEdit && !!inventoryAdjustment && !isReadOnly}
          canCommit={!isView}
          isPending={isPending}
          voidIsPending={voidAdj.isPending}
          onVoid={() => setShowVoid(true)}
          onCommit={openCommitDialog}
        />
      }
    >
      <form
        id="inventory-adjustment-form"
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
        // คอลัมน์เดียว — ยอดรวมย้ายลง footer bar แล้ว ตารางรายการจึงได้ 20rem
        // ที่ sidebar เคยกินคืนไป (DESIGN.md: an ERP table wants the pixels)
        className="min-w-0"
      >
        <DocumentInfo
          form={form}
          isView={isView}
          isDisabled={isDisabled}
          adjustmentKind={adjTypeFilter}
          inventoryAdjustment={inventoryAdjustment}
          currentPeriodStart={currentPeriod?.start_at}
          currentPeriodEnd={currentPeriod?.end_at}
          dateFormat={dateFormat}
          t={t}
          tc={tc}
          tfl={tfl}
        />

        {/* ── Line items ── */}
        <AdjItemFields
          form={form}
          disabled={isDisabled}
          adjustmentType={adjustmentType}
        />
      </form>

      <DiscardDialog {...discard.dialogProps} variant="warning" />

      <DiscardDialog
        open={navGuard.isOpen}
        onOpenChange={(o) => {
          if (!o) navGuard.cancel();
        }}
        onConfirm={navGuard.confirm}
        onCancel={navGuard.cancel}
        variant="warning"
      />

      {inventoryAdjustment && (
        <DeleteDialog
          open={showDelete}
          onOpenChange={(open) =>
            !open && !deleteAdj.isPending && setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={t("deleteConfirm", {
            documentNo:
              inventoryAdjustment.si_no ?? inventoryAdjustment.so_no ?? "",
          })}
          isPending={deleteAdj.isPending}
          onConfirm={() => {
            deleteAdj.mutate(
              { id: inventoryAdjustment.id, type: adjustmentType },
              {
                onSuccess: () => {
                  toast.success(tt("deleteSuccess", { entity: t("entity") }));
                  toList();
                },
                onError: errorToast,
              },
            );
          }}
        />
      )}

      {inventoryAdjustment && (
        <VoidDialog
          open={showVoid}
          onOpenChange={(open) =>
            !open && !voidAdj.isPending && setShowVoid(false)
          }
          title={t("voidTitle")}
          description={t("voidConfirm", {
            documentNo:
              inventoryAdjustment.si_no ?? inventoryAdjustment.so_no ?? "",
          })}
          isPending={voidAdj.isPending}
          onConfirm={(voidReason) => {
            voidAdj.mutate(
              {
                id: inventoryAdjustment.id,
                type: adjustmentType,
                void_reason: voidReason,
                doc_version: inventoryAdjustment.doc_version,
              },
              {
                onSuccess: () => {
                  toast.success(tt("voidSuccess", { entity: t("entity") }));
                  toList();
                },
                onError: errorToast,
              },
            );
          }}
        />
      )}

      <ConfirmDialog
        open={showCommit}
        onOpenChange={(open) => !open && setShowCommit(false)}
        title={t("commitTitle")}
        description={t("commitConfirm")}
        confirmText={t("commit")}
        confirmIcon={<Check />}
        isPending={isPending}
        onConfirm={confirmCommit}
      />
    </FormPageShell>
  );
}
