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
import { DOC_HEADER_CARD } from "@/components/loader/doc-page-skeleton";
import {
  DocAuditButton,
  DocAuditLine,
} from "@/components/share/doc-audit-line";
import { useProfile } from "@/hooks/use-profile";
import type { PriceListTemplate } from "@/types/price-list-template";
import type { FormMode } from "@/types/form";

import { CompactSection, FieldGrid } from "@/components/share/compact-section";
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

  const generalFields = isView ? (
    // ชื่อกับสถานะไม่แสดง — แถบหัวมีทั้งสองอย่างเป็นตัวเอกอยู่แล้ว
    // ข้อความล้วน → dense (2 คอลัมน์ตั้งแต่กล่องแคบสุด) ทรงเดียวกับหัว PR
    <FieldGrid dense>
      <SettingField
        label={tfl("currency")}
        value={priceListTemplate?.currency?.code}
      />
      <SettingField
        label={tfl("validityPeriod")}
        value={
          watchedValidity ? t("daysSuffix", { count: watchedValidity }) : null
        }
      />
      {/* data-wide = เต็มแถวบนมือถือ (dense 2 คอลัมน์) · ตั้งแต่ @md เหลือช่องเดียว (ทรงหัว PR)
          ตาราง audit กินที่ขวาของแถบ ถ้ายังกิน 2 ช่อง Description จะตกไปแถวสอง */}
      <div data-wide="" className="min-w-0 @md:col-span-1!">
        <SettingField
          label={tfl("description")}
          value={priceListTemplate?.description}
        />
      </div>
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
  );

  return (
    <FormPageShell
      width="wide"
      // หัวอยู่ในการ์ดมีพื้น ทรงเดียวกับหัวเอกสาร PR: ชื่อ+สถานะ+ปุ่ม · ช่อง General (ribbon)
      // + ตาราง audit ชิดขวาล่าง (โหมดดู) — ไม่มีการ์ด General แยก · ช่อง General อยู่นอก
      // <form> (แบบ PR — ปุ่มบนหัวไม่กลายเป็น submit) RHF ยังเก็บค่าครบ แค่กด Enter ไม่ submit
      header={
        <div className={DOC_HEADER_CARD}>
          <FormToolbar
            inlineBack
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
            onComment={
              priceListTemplate ? () => setShowComment(true) : undefined
            }
            activity={
              priceListTemplate && {
                id: priceListTemplate.id,
                label: priceListTemplate.name,
              }
            }
            badges={
              <>
                <StatusChip
                  status={watchedStatus}
                  label={tsStatus(watchedStatus)}
                  // เบากว่าในตาราง: ตัวเอกของแถบนี้คือชื่อเทมเพลต สถานะเป็นข้อมูลประกอบ
                />
                {/* มือถือ: ตาราง audit เต็มซ่อนอยู่ เหลือไอคอนข้างสถานะ (เทมเพลตไม่มีเลขที่ใบ/บรรทัดตัวตน) */}
                {isView && (
                  <DocAuditButton
                    audit={priceListTemplate?.audit}
                    docVersion={priceListTemplate?.doc_version}
                    className="-my-1 sm:hidden"
                  />
                )}
              </>
            }
            // ml-4 หักล้าง -ml-4 ของ DocFormHeader (เหมือนหัว PR) · ตาราง audit เฉพาะโหมดดู
            ribbon={
              isView ? (
                <div className="ml-4 flex min-w-0 flex-1 flex-wrap items-end gap-x-5 gap-y-3">
                  <div className="min-w-0 flex-1 basis-72">{generalFields}</div>
                  <DocAuditLine
                    audit={priceListTemplate?.audit}
                    docVersion={priceListTemplate?.doc_version}
                    className="ms-auto hidden sm:table"
                  />
                </div>
              ) : (
                <div className="ml-4 min-w-0 flex-1">{generalFields}</div>
              )
            }
          />
        </div>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit(actions.onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        <CompactSection
          // General ย้ายเข้าการ์ดหัวแล้ว — หมวดนี้เป็นหมวดแรกของตัวฟอร์ม
          first
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
              <FieldDescription>{t("vendorInstructionHelp")}</FieldDescription>
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
