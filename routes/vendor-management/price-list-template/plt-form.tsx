import { useEffect, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";

import { StatusIconLabel } from "@/components/ui/status-icon-label";
import {
  Field,
  FieldDescription,
  FieldInput,
  FieldLabel,
  FieldPlainText,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LookupCurrency } from "@/components/lookup/lookup-currency";
import { PRICE_LIST_TEMPLATE_STATUS_OPTIONS } from "@/constant/price-list-template";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { useProfile } from "@/hooks/use-profile";
import type { PriceListTemplate } from "@/types/price-list-template";
import type { FormMode } from "@/types/form";

import { SettingSection } from "@/components/ui/setting-section";

import {
  createPltSchema,
  getDefaultValues,
  type PltFormValues,
} from "./plt-form-schema";
import { PltValidityStepper } from "./plt-validity-stepper";
import { PltItemFields } from "./plt-item-fields";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useServerFieldErrors } from "@/hooks/use-server-field-errors";
import { usePltFormActions } from "./use-plt-form-actions";
import { useStepperLabels } from "./plt-form-labels";

const FORM_ID = "plt-form";

interface PriceListTemplateFormProps {
  readonly priceListTemplate?: PriceListTemplate;
}

export function PriceListTemplateForm({
  priceListTemplate,
}: PriceListTemplateFormProps) {
  const t = useTranslations("vendorManagement.priceListTemplate");
  const tfl = useTranslations("field");
  const tv = useTranslations("validation");
  const ts = useTranslations("status");

  const [mode, setMode] = useState<FormMode>(
    priceListTemplate ? "view" : "add",
  );
  const isView = mode === "view";

  const { defaultCurrencyId } = useProfile();
  const defaultValues = getDefaultValues(priceListTemplate, {
    defaultCurrencyId,
  });

  const form = useForm<PltFormValues>({
    resolver: zodResolver(createPltSchema(tv, tfl)) as Resolver<PltFormValues>,
    defaultValues,
  });
  useServerFieldErrors(form, {
    PRICE_LIST_TEMPLATE_NAME_ALREADY_EXISTS: "name",
  });

  // หลัง save (edit) → mutation invalidate → byId refetch → priceListTemplate มา
  // ใหม่ (full-replace ทำให้ product ได้ id ใหม่) · re-sync form ในโหมด view ให้
  // โชว์ข้อมูล server จริง และ edit ครั้งถัดไปอ่าน id ใหม่ (ไม่งั้น remove จะใช้ id
  // เก่าที่ถูกลบไปแล้ว → save ซ้ำ = duplicate) · key ด้วยชุด product id ที่เปลี่ยน
  // ทุกครั้งที่ item ถูก add/remove/replace
  const productIdsKey = (priceListTemplate?.products ?? [])
    .map((p) => p.id)
    .join(",");
  useEffect(() => {
    if (mode === "view" && priceListTemplate) {
      form.reset(getDefaultValues(priceListTemplate, { defaultCurrencyId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form/getDefaultValues stable; mode/defaultCurrencyId อ่านโดยไม่ retrigger
  }, [productIdsKey, priceListTemplate?.id]);

  const actions = usePltFormActions({
    form,
    priceListTemplate,
    defaultValues,
    mode,
    setMode,
  });

  const isDisabled = isView || actions.isPending;
  // guard อยู่ใน usePltFormActions — handleBack ที่นั่นต้องใช้ navGuard.back()
  const navGuard = actions.navGuard;

  const watchedValidity = useWatch({
    control: form.control,
    name: "validity_period",
  });
  const watchedStatus = useWatch({ control: form.control, name: "status" });
  const watchedName = useWatch({ control: form.control, name: "name" });

  const stepperLabels = useStepperLabels(t);

  const tsStatus = ts as (key: "draft" | "active" | "inactive") => string;

  return (
    <FormPageShell
      width="wide"
      header={
        <FormToolbar
          mode={mode}
          formId={FORM_ID}
          isPending={actions.isPending}
          title={watchedName || t("namePlaceholder")}
          titleMuted={!watchedName}
          onBack={actions.handleBack}
          onCancel={actions.handleCancel}
          onEdit={() => setMode("edit")}
          onDelete={
            priceListTemplate ? () => actions.setShowDelete(true) : undefined
          }
          deleteIsPending={actions.isDeletePending}
          activity={
            priceListTemplate && {
              id: priceListTemplate.id,
              label: priceListTemplate.name,
            }
          }
          badges={
            <StatusIconLabel
              status={watchedStatus}
              label={tsStatus(watchedStatus)}
              // เบากว่าในตาราง: ตัวเอกของแถบนี้คือชื่อเทมเพลต สถานะเป็นข้อมูลประกอบ
              className="text-muted-foreground text-micro uppercase [&>svg]:size-3"
            />
          }
        />
      }
    >
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit(actions.onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        {/* General */}
        <SettingSection
          first
          title={tfl("general")}
          description={t(isView ? "generalDescView" : "generalDesc")}
        >
          <div className="grid grid-cols-2 gap-4 sm:col-span-2">
            {/* Name — โหมดดูไม่แสดง แถบหัวมีชื่อเป็นตัวเอกอยู่แล้ว (ท่าเดียวกับหน้า price list) */}
            {!isView && (
              <Field>
                <FieldLabel htmlFor="plt-name">
                  {tfl("name")}
                  <span className="text-destructive"> *</span>
                </FieldLabel>
                <FieldInput
                  id="plt-name"
                  placeholder={t("namePlaceholder")}
                  disabled={isDisabled}
                  error={form.formState.errors.name?.message}
                  maxLength={100}
                  {...form.register("name")}
                />
              </Field>
            )}

            {/* Currency */}
            <Field>
              <FieldLabel>
                {tfl("currency")}
                {!isView && <span className="text-destructive"> *</span>}
              </FieldLabel>
              {isView ? (
                <FieldPlainText>
                  {priceListTemplate?.currency?.code}
                </FieldPlainText>
              ) : (
                <Controller
                  control={form.control}
                  name="currency_id"
                  render={({ field }) => (
                    <LookupCurrency
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isDisabled}
                      fullWidth
                      error={form.formState.errors.currency_id?.message}
                    />
                  )}
                />
              )}
            </Field>

            {/* Validity period — โหมดดูเหลือแค่ค่าสั้น ๆ จึงนั่งข้างสกุลเงินในแถวเดียวกัน */}
            {isView && (
              <Field>
                <FieldLabel>{tfl("validityPeriod")}</FieldLabel>
                <FieldPlainText>
                  {watchedValidity
                    ? t("daysSuffix", { count: watchedValidity })
                    : null}
                </FieldPlainText>
              </Field>
            )}
          </div>

          {/* Validity period — โหมดแก้ใช้ stepper เต็มแถว */}
          {!isView && (
            <Field className="sm:col-span-2">
              <FieldLabel>{tfl("validityPeriod")}</FieldLabel>
              <FieldDescription>{stepperLabels.hint}</FieldDescription>
              <Controller
                control={form.control}
                name="validity_period"
                render={({ field }) => (
                  <PltValidityStepper
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isDisabled}
                    labels={stepperLabels}
                  />
                )}
              />
            </Field>
          )}

          {/* Description */}
          <Field className="sm:col-span-2">
            <FieldLabel>{tfl("description")}</FieldLabel>
            {isView ? (
              <FieldPlainText className="whitespace-pre-wrap">
                {priceListTemplate?.description}
              </FieldPlainText>
            ) : (
              <Textarea
                placeholder={tfl("optional")}
                rows={2}
                maxLength={256}
                disabled={isDisabled}
                className="resize-none"
                {...form.register("description")}
              />
            )}
          </Field>

          {/* Status — โหมดดูไม่แสดง แถบหัวมีสถานะอยู่แล้ว */}
          {!isView && (
            <Field className="sm:col-span-2">
              <FieldLabel>{tfl("status")}</FieldLabel>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FieldSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isDisabled}
                    placeholder={tfl("selectStatus")}
                    error={form.formState.errors.status?.message}
                  >
                    <SelectContent>
                      {PRICE_LIST_TEMPLATE_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <StatusIconLabel
                            status={opt.value}
                            label={tsStatus(
                              opt.value as "draft" | "active" | "inactive",
                            )}
                            className="uppercase"
                          />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </FieldSelect>
                )}
              />
            </Field>
          )}
        </SettingSection>

        {/* Vendor instructions */}
        <SettingSection
          title={t("vendorInstructionTitle")}
          description={t(
            isView ? "vendorInstructionHelpView" : "vendorInstructionHelp",
          )}
        >
          <Field className="sm:col-span-2">
            {/* โหมดดู label ซ้ำกับหัว section ทั้งคำ — ตัดทิ้ง เหลือแค่ข้อความ */}
            {!isView && <FieldLabel>{t("vendorInstructionTitle")}</FieldLabel>}
            {isView ? (
              <FieldPlainText className="whitespace-pre-wrap">
                {/* ไม่มี label แล้ว "—" ลอย ๆ อ่านไม่ออกว่าหมายถึงอะไร — บอกเป็นคำ */}
                {priceListTemplate?.vendor_instructions || (
                  <span className="text-muted-foreground font-normal">
                    {t("vendorInstructionEmpty")}
                  </span>
                )}
              </FieldPlainText>
            ) : (
              <Textarea
                placeholder={t("vendorInstructionPlaceholder")}
                rows={5}
                maxLength={1000}
                disabled={isDisabled}
                className="resize-none leading-relaxed"
                {...form.register("vendor_instruction")}
              />
            )}
          </Field>
        </SettingSection>

        <PltItemFields
          form={form}
          priceListTemplate={priceListTemplate}
          isView={isView}
          isDisabled={isDisabled}
        />
      </form>

      <DiscardDialog {...actions.discardDialogProps} variant="warning" />

      <DiscardDialog
        open={navGuard.isOpen}
        onOpenChange={(o) => {
          if (!o) navGuard.cancel();
        }}
        onConfirm={navGuard.confirm}
        onCancel={navGuard.cancel}
        variant="warning"
      />

      {priceListTemplate && (
        <DeleteDialog
          open={actions.showDelete}
          onOpenChange={(open) =>
            !open && !actions.isDeletePending && actions.setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={t("deleteConfirm", { name: priceListTemplate.name })}
          isPending={actions.isDeletePending}
          onConfirm={actions.handleConfirmDelete}
        />
      )}
    </FormPageShell>
  );
}
