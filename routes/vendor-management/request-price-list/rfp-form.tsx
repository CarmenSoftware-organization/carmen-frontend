import { useEffect, useState } from "react";
import { Controller, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";

import { DeleteDialog } from "@/components/ui/delete-dialog";
import { PrintDocumentButton } from "@/components/print-document-button";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useEntityForm } from "@/hooks/use-entity-form";
import {
  Field,
  FieldDatePicker,
  FieldInput,
  FieldLabel,
  FieldPlainText,
} from "@/components/ui/field";
import { LookupPrt } from "@/components/lookup/lookup-prt";
import { Input } from "@/components/ui/input";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { formatDate } from "@/lib/date-utils";
import { useProfile } from "@/hooks/use-profile";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import {
  useCreateRequestPriceList,
  useDeleteRequestPriceList,
  useUpdateRequestPriceList,
} from "./use-rfp";
import type {
  CreateRequestPriceListDto,
  RequestPriceList,
} from "@/types/request-price-list";

import { SettingSection } from "@/components/ui/setting-section";
import {
  buildVendorChanges,
  createRfpSchema,
  getDefaultValues,
  type RfpFormValues,
} from "./rfp-form-schema";
import { RfpVendorFields } from "./rfp-vendor-fields";
import { RfpWindowBadge } from "./rfp-list-cells";

const FORM_ID = "rfp-form";

interface RequestPriceListFormProps {
  readonly requestPriceList?: RequestPriceList;
}

const LIST_PATH = "/vendor-management/request-price-list";

export function RequestPriceListForm({
  requestPriceList,
}: RequestPriceListFormProps) {
  const navigate = useNavigate();
  const { dateFormat } = useProfile();
  const t = useTranslations("vendorManagement.requestPriceList");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");

  const createRfp = useCreateRequestPriceList();
  const updateRfp = useUpdateRequestPriceList();
  const deleteRfp = useDeleteRequestPriceList();
  const [showDelete, setShowDelete] = useState(false);
  const isPending = createRfp.isPending || updateRfp.isPending;

  const defaultValues = getDefaultValues(requestPriceList);

  const f = useEntityForm<RfpFormValues>({
    entity: requestPriceList,
    resolver: zodResolver(createRfpSchema(tv, tfl)) as Resolver<RfpFormValues>,
    defaultValues,
    listPath: LIST_PATH,
    isPending,
  });
  const { form, isView, isAdd, isEdit, isDisabled } = f;

  const today = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const startDate = useWatch({ control: form.control, name: "start_date" });
  const endDate = useWatch({ control: form.control, name: "end_date" });
  const watchedName = useWatch({ control: form.control, name: "name" });

  const onSubmit = (values: RfpFormValues) => {
    const payload: CreateRequestPriceListDto = {
      name: values.name,
      pricelist_template_id: values.pricelist_template_id || undefined,
      start_date: values.start_date,
      end_date: values.end_date,
      custom_message: values.custom_message ?? "",
      email_template_id: values.email_template_id || undefined,
      info: values.info || undefined,
      dimension: values.dimension || undefined,
      vendors: buildVendorChanges(values.vendors, defaultValues.vendors),
    };

    if (isEdit && requestPriceList) {
      updateRfp.mutate(
        {
          id: requestPriceList.id,
          doc_version: requestPriceList.doc_version,
          ...payload,
        },
        {
          onSuccess: () => {
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            form.reset(values);
            f.setMode("view");
          },
        },
      );
    } else if (isAdd) {
      createRfp.mutate(payload, {
        onSuccess: (res) => {
          const id = (res as { data: { id: string } }).data.id;
          toast.success(tt("createSuccess", { entity: t("entity") }));
          navigate(`/vendor-management/request-price-list/${id}`, {
            replace: true,
            ...f.returnState,
          });
        },
      });
    }
  };

  const handleConfirmDelete = () => {
    if (!requestPriceList) return;
    deleteRfp.mutate(requestPriceList.id, {
      onSuccess: () => {
        toast.success(tt("deleteSuccess", { entity: t("entity") }));
        f.backToList();
      },
    });
  };

  // หลัง save สำเร็จ query ถูก invalidate แล้ว refetch — ผู้ขายที่เพิ่งเพิ่มจะได้
  // id จริงจาก server กลับมา ต้อง re-sync ฟอร์มในโหมด view ไม่งั้นแถวพวกนั้นยัง
  // id ว่างอยู่ แล้ว Save รอบถัดไปจะส่ง add ซ้ำ สร้างผู้ขายซ้ำฝั่ง backend
  // key ด้วยชุด id ของผู้ขาย ซึ่งเปลี่ยนพอดีตอนมีการเพิ่ม/ลบ (ดู pl-form)
  const vendorIdsKey = (requestPriceList?.vendors ?? [])
    .map((v) => v.id)
    .join(",");
  useEffect(() => {
    if (f.mode === "view" && requestPriceList) {
      form.reset(getDefaultValues(requestPriceList));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form/getDefaultValues stable; mode อ่านโดยไม่ retrigger
  }, [vendorIdsKey, requestPriceList?.id]);

  return (
    <FormPageShell
      width="wide"
      header={
        <FormToolbar
          mode={f.mode}
          formId={FORM_ID}
          isPending={isPending}
          title={watchedName || t("namePlaceholder")}
          titleMuted={!watchedName}
          onBack={f.handleBack}
          onCancel={f.handleCancel}
          onEdit={f.handleEdit}
          onDelete={requestPriceList ? () => setShowDelete(true) : undefined}
          deleteIsPending={deleteRfp.isPending}
          activity={
            requestPriceList && {
              id: requestPriceList.id,
              label: requestPriceList.name,
            }
          }
        >
          {isView && requestPriceList?.id && (
            <PrintDocumentButton
              documentType="RFP"
              documentId={requestPriceList.id}
              filters={
                requestPriceList.name
                  ? { DocumentNo: requestPriceList.name }
                  : undefined
              }
            />
          )}
        </FormToolbar>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        {/* General */}
        <SettingSection
          first
          title={tfl("general")}
          description={t(isView ? "generalDescView" : "generalDesc")}
        >
          {/* Name — โหมดดูไม่แสดง แถบหัวมีชื่อเป็นตัวเอกอยู่แล้ว (ท่าเดียวกับหน้า price list) */}
          {!isView && (
            <Field>
              <FieldLabel htmlFor="rfp-name">
                {tfl("name")}
                <span className="text-destructive"> *</span>
              </FieldLabel>
              <FieldInput
                id="rfp-name"
                placeholder={t("namePlaceholder")}
                disabled={isDisabled}
                error={form.formState.errors.name?.message}
                maxLength={100}
                {...form.register("name")}
              />
            </Field>
          )}

          {/* Template */}
          <Field>
            <FieldLabel>
              {tfl("template")}
              {!isView && <span className="text-destructive"> *</span>}
            </FieldLabel>
            {isView ? (
              <FieldPlainText>
                {requestPriceList?.pricelist_template?.name}
              </FieldPlainText>
            ) : (
              <Controller
                control={form.control}
                name="pricelist_template_id"
                render={({ field }) => (
                  <LookupPrt
                    value={field.value ?? ""}
                    onValueChange={(value) => field.onChange(value)}
                    defaultLabel={
                      field.value &&
                      field.value === requestPriceList?.pricelist_template?.id
                        ? (requestPriceList.pricelist_template.name ??
                          undefined)
                        : undefined
                    }
                    disabled={isDisabled}
                    className="w-full"
                    error={form.formState.errors.pricelist_template_id?.message}
                  />
                )}
              />
            )}
          </Field>

          {/* Request period — โหมดดูรวมเป็นช่องเดียวพร้อม badge บอกว่ารอบรับราคายังเปิดอยู่ไหม
              (ตัวเดียวกับคอลัมน์ในหน้า list) นั่งข้าง Template ในแถวเดียวกัน */}
          {isView ? (
            <Field>
              <FieldLabel>{t("requestPeriod")}</FieldLabel>
              {startDate && endDate && requestPriceList ? (
                <FieldPlainText className="flex-col items-start gap-1">
                  <span className="tabular-nums">
                    {formatDate(startDate, dateFormat)} -{" "}
                    {formatDate(endDate, dateFormat)}
                  </span>
                  <RfpWindowBadge item={requestPriceList} />
                </FieldPlainText>
              ) : (
                <FieldPlainText />
              )}
            </Field>
          ) : (
            <>
              <Field>
                <FieldLabel>{tfl("startDate")}</FieldLabel>
                <Controller
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FieldDatePicker
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isDisabled}
                      className="w-full"
                      placeholder={tfl("pickDate")}
                      fromDate={today}
                      error={form.formState.errors.start_date?.message}
                    />
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>{tfl("endDate")}</FieldLabel>
                <Controller
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FieldDatePicker
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isDisabled}
                      className="w-full"
                      placeholder={tfl("pickDate")}
                      fromDate={startDate ? new Date(startDate) : today}
                      error={form.formState.errors.end_date?.message}
                    />
                  )}
                />
              </Field>
            </>
          )}
        </SettingSection>

        <RfpVendorFields
          form={form}
          requestPriceList={requestPriceList}
          isDisabled={isDisabled}
          isView={isView}
        />

        {/* Custom message */}
        <SettingSection
          title={t("customMessageTitle")}
          description={t(
            isView ? "customMessageHelpView" : "customMessageHelp",
          )}
        >
          <Field className="sm:col-span-2">
            {/* โหมดดู label ซ้ำกับหัว section ทั้งคำ — ตัดทิ้ง เหลือแค่ข้อความ */}
            {!isView && <FieldLabel>{t("customMessageTitle")}</FieldLabel>}
            {isView ? (
              <FieldPlainText className="whitespace-pre-wrap">
                {/* ไม่มี label แล้ว "—" ลอย ๆ อ่านไม่ออกว่าหมายถึงอะไร — บอกเป็นคำ */}
                {requestPriceList?.custom_message || (
                  <span className="text-muted-foreground font-normal">
                    {t("customMessageEmpty")}
                  </span>
                )}
              </FieldPlainText>
            ) : (
              <Input
                type="text"
                disabled={isDisabled}
                placeholder={t("customMessagePlaceholder")}
                maxLength={500}
                {...form.register("custom_message")}
              />
            )}
          </Field>
        </SettingSection>
      </form>

      <DiscardDialog {...f.discard.dialogProps} variant="warning" />

      <DiscardDialog
        open={f.navGuard.isOpen}
        onOpenChange={(o) => {
          if (!o) f.navGuard.cancel();
        }}
        onConfirm={f.navGuard.confirm}
        onCancel={f.navGuard.cancel}
        variant="warning"
      />

      {requestPriceList && (
        <DeleteDialog
          open={showDelete}
          onOpenChange={(open) =>
            !open && !deleteRfp.isPending && setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={t("deleteConfirm", { name: requestPriceList.name })}
          isPending={deleteRfp.isPending}
          onConfirm={handleConfirmDelete}
        />
      )}
    </FormPageShell>
  );
}
