import { lazy, Suspense, useEffect, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";

import { StatusChip } from "@/components/ui/status-chip";
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

import {
  CompactSection,
  FieldGrid,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";

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
import { priceListTemplateCommentCrud } from "./use-plt-comments";

const EntityCommentSheet = lazy(() =>
  import("@/components/share/entity-comment-sheet").then((mod) => ({
    default: mod.EntityCommentSheet,
  })),
);

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

  const [showComment, setShowComment] = useState(false);
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
          onComment={priceListTemplate ? () => setShowComment(true) : undefined}
          activity={
            priceListTemplate && {
              id: priceListTemplate.id,
              label: priceListTemplate.name,
            }
          }
          badges={
            <StatusChip
              status={watchedStatus}
              label={tsStatus(watchedStatus)}
              // เบากว่าในตาราง: ตัวเอกของแถบนี้คือชื่อเทมเพลต สถานะเป็นข้อมูลประกอบ
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
        {/* General คู่กับ Instructions — วางเคียงกันบนจอ ≥1700px ต่ำกว่านั้นซ้อนกัน */}
        <div className={SECTION_PAIR}>
          <CompactSection
            first
            title={tfl("general")}
            description={t(isView ? "generalDescView" : "generalDesc")}
          >
            {isView ? (
              // ชื่อกับสถานะไม่แสดง — แถบหัวมีทั้งสองอย่างเป็นตัวเอกอยู่แล้ว
              <FieldGrid>
                <SettingField
                  label={tfl("currency")}
                  value={priceListTemplate?.currency?.code}
                />
                <SettingField
                  label={tfl("validityPeriod")}
                  value={
                    watchedValidity
                      ? t("daysSuffix", { count: watchedValidity })
                      : null
                  }
                />
                <SettingField
                  label={tfl("description")}
                  value={priceListTemplate?.description}
                  fullWidth
                />
              </FieldGrid>
            ) : (
              <FieldGrid>
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

                <Field>
                  <FieldLabel>
                    {tfl("currency")}
                    <span className="text-destructive"> *</span>
                  </FieldLabel>
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
                </Field>

                <Field>
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

                {/* stepper มีปุ่ม preset ต่อท้าย ต้องการที่ 2 ช่อง */}
                <Field className="@md:col-span-2">
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

                {/* ช่องเดียว (ไม่ span) — ช่องกว้าง 2 ช่องสองช่องติดกันตกคนละแถวในกริด 3 คอลัมน์ */}
                <Field>
                  <FieldLabel>{tfl("description")}</FieldLabel>
                  <Textarea
                    placeholder={tfl("optional")}
                    rows={2}
                    maxLength={256}
                    disabled={isDisabled}
                    className="resize-none"
                    {...form.register("description")}
                  />
                </Field>
              </FieldGrid>
            )}
          </CompactSection>

          {/* คู่นี้อยู่บนสุดของฟอร์ม: ก้อนซ้ายเป็น first (ไม่มี mt-5) ก้อนขวาต้องตัด mt-5 ทิ้ง
              ตอนวางเคียงกัน ไม่งั้นการ์ดขวาต่ำกว่าซ้าย 20px · ซ้อนกันเมื่อไรยังต้องมีระยะ */}
          <div className="min-[1700px]:[&>section]:mt-0">
            <CompactSection
              title={t("vendorInstructionTitle")}
              // คำอธิบายโหมดแก้ยาว ห่อบรรทัดบนหัวข้อคู่แล้วหัวข้อสองฝั่งไม่เสมอกัน → ย้ายเข้าการ์ด
              description={isView ? t("vendorInstructionHelpView") : undefined}
            >
              {isView ? (
                // ไม่มี label (ซ้ำกับหัว section ทั้งคำ) — ค่าว่างบอกเป็นคำ ไม่ใช่ "—" ลอย ๆ
                <FieldPlainText className="whitespace-pre-wrap">
                  {priceListTemplate?.vendor_instructions || (
                    <span className="text-muted-foreground font-normal">
                      {t("vendorInstructionEmpty")}
                    </span>
                  )}
                </FieldPlainText>
              ) : (
                <Field>
                  <FieldLabel className="sr-only">
                    {t("vendorInstructionTitle")}
                  </FieldLabel>
                  <FieldDescription>
                    {t("vendorInstructionHelp")}
                  </FieldDescription>
                  <Textarea
                    placeholder={t("vendorInstructionPlaceholder")}
                    rows={5}
                    maxLength={1000}
                    disabled={isDisabled}
                    className="resize-none leading-relaxed"
                    {...form.register("vendor_instruction")}
                  />
                </Field>
              )}
            </CompactSection>
          </div>
        </div>

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
        <Suspense fallback={null}>
          <EntityCommentSheet
            crud={priceListTemplateCommentCrud}
            entityId={priceListTemplate.id}
            open={showComment}
            onOpenChange={setShowComment}
          />
        </Suspense>
      )}

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
