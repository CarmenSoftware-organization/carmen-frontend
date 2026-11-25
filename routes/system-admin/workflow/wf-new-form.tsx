import { useState } from "react";
import { useForm, useWatch, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { useListReturn } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { toast } from "sonner";
import {
  useApInvoiceWorkflows,
  useApPaymentWorkflows,
  useArInvoiceWorkflows,
  useArReceiptWorkflows,
} from "@/hooks/use-workflow";
import { useCreateWorkflow } from "./use-wf-mutations";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { getWorkflowTypeLabels, workflowTypeField } from "@/constant/workflow";
import { Separator } from "@/components/ui/separator";
import { WORKFLOW_TYPE } from "@/types/workflows";
import {
  createWorkflowFormSchema,
  mapToPayload,
  EMPTY_FORM,
  buildDefaultStages,
  type WorkflowFormValues,
} from "./wf-form-schema";
import { useSeededTemplateIds } from "./use-seeded-template-ids";
import { fillSeededTemplateIds } from "./wf-seeded-templates";
import { WfStageRailPreview } from "./wf-stage-rail-node";
import { useServerFieldErrors } from "@/hooks/use-server-field-errors";

interface WorkflowNewFormProps {
  /** ชนิดใบที่มาจากหน้ารายการ — ล็อกไว้ให้แก้ไม่ได้ เพราะหน้าที่กดมาเป็นของชนิดนั้น */
  readonly lockedType?: WORKFLOW_TYPE;
}

export default function WorkflowNewForm({
  lockedType,
}: WorkflowNewFormProps = {}) {
  const navigate = useNavigate();
  const { toList, returnState } = useListReturn("/system-admin/workflow");
  const createWorkflow = useCreateWorkflow();
  const isPending = createWorkflow.isPending;
  const t = useTranslations("systemAdmin.workflow");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");

  const schema = createWorkflowFormSchema(tv, t);
  const typeLabels = getWorkflowTypeLabels(t);
  // ชนิดที่ล็อกมาจากหน้ารายการเป็นข้อเท็จจริง ไม่ใช่ช่องกรอก — แสดงข้างหัวข้อแทน Select ที่ disable
  // (ค่าเข้าฟอร์มผ่าน defaultValues อยู่แล้ว)
  const lockedTypeLabel = lockedType
    ? (typeLabels[lockedType] ?? lockedType)
    : undefined;
  const form = useForm<WorkflowFormValues>({
    resolver: zodResolver(schema) as Resolver<WorkflowFormValues>,
    defaultValues: lockedType
      ? { ...EMPTY_FORM, workflow_type: lockedType }
      : EMPTY_FORM,
  });
  useServerFieldErrors(form, { WORKFLOW_ALREADY_EXISTS: "name" });

  // ตัวอย่างชื่อตามชนิดที่เลือก/ล็อกอยู่ — ยังไม่เลือกก็ใช้ PR เป็นตัวอย่าง
  const watchedType = useWatch({
    control: form.control,
    name: "workflow_type",
  });
  const namePlaceholder = t("workflowNamePlaceholder", {
    type: typeLabels[watchedType] ?? typeLabels[WORKFLOW_TYPE.PR],
  });

  // AP Invoice / AP Payment มี workflow ที่เปิดใช้ได้เส้นเดียวต่อ BU — ถ้ามีอยู่แล้วห้ามสร้างเพิ่ม
  // (backend ตอบ WORKFLOW_SINGLE_ACTIVE_EXISTS เป็นด่านสุดท้าย)
  // perpage ชัดเจนเพื่อให้เห็นเส้นที่เปิดอยู่แม้เกินหน้าแรก (ไม่ใช้ -1)
  // ยิงเฉพาะเมื่อฟอร์มนี้เป็นชนิดนั้นได้ — ฟอร์มชนิดอื่นไม่ยิง (env ที่ยังไม่ allowlist
  // workflow.findAllApInvoice / findAllApPayment จะ 401 แล้วผู้ใช้โดน logout)
  const apInvoiceQueryEnabled =
    !lockedType || lockedType === WORKFLOW_TYPE.AP_INVOICE;
  const { data: apInvoiceWorkflows, isPending: apInvoicePending } =
    useApInvoiceWorkflows({ perpage: 100 }, { enabled: apInvoiceQueryEnabled });
  const apPaymentQueryEnabled =
    !lockedType || lockedType === WORKFLOW_TYPE.AP_PAYMENT;
  const { data: apPaymentWorkflows, isPending: apPaymentPending } =
    useApPaymentWorkflows({ perpage: 100 }, { enabled: apPaymentQueryEnabled });
  const arInvoiceQueryEnabled =
    !lockedType || lockedType === WORKFLOW_TYPE.AR_INVOICE;
  const { data: arInvoiceWorkflows, isPending: arInvoicePending } =
    useArInvoiceWorkflows({ perpage: 100 }, { enabled: arInvoiceQueryEnabled });
  const arReceiptQueryEnabled =
    !lockedType || lockedType === WORKFLOW_TYPE.AR_RECEIPT;
  const { data: arReceiptWorkflows, isPending: arReceiptPending } =
    useArReceiptWorkflows({ perpage: 100 }, { enabled: arReceiptQueryEnabled });
  const apInvoiceActiveExists =
    apInvoiceQueryEnabled &&
    !!apInvoiceWorkflows?.data?.some((w) => w.is_active);
  const apPaymentActiveExists =
    apPaymentQueryEnabled &&
    !!apPaymentWorkflows?.data?.some((w) => w.is_active);
  const arInvoiceActiveExists =
    arInvoiceQueryEnabled &&
    !!arInvoiceWorkflows?.data?.some((w) => w.is_active);
  const arReceiptActiveExists =
    arReceiptQueryEnabled &&
    !!arReceiptWorkflows?.data?.some((w) => w.is_active);
  // ระหว่างโหลดรายการ ถือว่าชนิดนั้นถูกบล็อกไว้ก่อน จนรู้ว่าไม่มีเส้นที่เปิดอยู่
  const apBlocked =
    (watchedType === WORKFLOW_TYPE.AP_INVOICE &&
      ((apInvoiceQueryEnabled && apInvoicePending) || apInvoiceActiveExists)) ||
    (watchedType === WORKFLOW_TYPE.AP_PAYMENT &&
      ((apPaymentQueryEnabled && apPaymentPending) || apPaymentActiveExists)) ||
    (watchedType === WORKFLOW_TYPE.AR_INVOICE &&
      ((arInvoiceQueryEnabled && arInvoicePending) || arInvoiceActiveExists)) ||
    (watchedType === WORKFLOW_TYPE.AR_RECEIPT &&
      ((arReceiptQueryEnabled && arReceiptPending) || arReceiptActiveExists));

  const discard = useDiscardConfirm({
    isDirty: form.formState.isDirty,
    isPending,
  });
  const seededIds = useSeededTemplateIds();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navGuard = useNavigationGuard(form.formState.isDirty && !isSubmitting);

  const backToList = () => toList();
  const handleLeave = () => discard.confirm(backToList);

  const onSubmit = (values: WorkflowFormValues) => {
    if (apBlocked) return;
    const payload = mapToPayload(values);
    payload.data.stages = fillSeededTemplateIds(payload.data.stages, seededIds);

    setIsSubmitting(true);
    createWorkflow.mutate(payload, {
      onError: () => setIsSubmitting(false),
      onSuccess: (res) => {
        toast.success(tt("createSuccess", { entity: t("entity") }));
        const data = res as unknown as { data?: { id?: string } };
        const id = data?.data?.id ?? payload.id;
        navigate(`/system-admin/workflow/${id}`, {
          replace: true,
          ...returnState,
        });
      },
    });
  };

  return (
    <FormPageShell
      width="wide"
      header={
        <FormToolbar
          entity={t("entity")}
          mode="add"
          formId="new-workflow-form"
          isPending={isPending || apBlocked}
          submitLabel={t("createWorkflow")}
          onBack={handleLeave}
          onCancel={handleLeave}
          badges={
            lockedTypeLabel ? (
              <>
                <Separator orientation="vertical" className="mx-0.5 h-3.5" />
                <span className="text-muted-foreground text-xs">
                  {lockedTypeLabel}
                </span>
              </>
            ) : undefined
          }
        />
      }
    >
      <form
        id="new-workflow-form"
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        {/* General */}
        <CompactSection
          first
          title={t("general")}
          description={t(lockedType ? "generalDescLocked" : "generalDesc")}
        >
          <FieldGrid>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="wf-name" required>
                {t("workflowName")}
              </FieldLabel>
              <Input
                id="wf-name"
                size="sm"
                placeholder={namePlaceholder}
                disabled={isPending}
                maxLength={100}
                {...form.register("name")}
              />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>

            {!lockedType && (
              <Field data-invalid={!!form.formState.errors.workflow_type}>
                <FieldLabel htmlFor="wf-type" required>
                  {t("workflowType")}
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="workflow_type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending || !!lockedType}
                    >
                      <SelectTrigger id="wf-type">
                        <SelectValue placeholder={t("selectType")} />
                      </SelectTrigger>
                      <SelectContent>
                        {workflowTypeField.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            disabled={
                              (opt.value === WORKFLOW_TYPE.AP_INVOICE &&
                                apInvoiceActiveExists) ||
                              (opt.value === WORKFLOW_TYPE.AP_PAYMENT &&
                                apPaymentActiveExists) ||
                              (opt.value === WORKFLOW_TYPE.AR_INVOICE &&
                                arInvoiceActiveExists) ||
                              (opt.value === WORKFLOW_TYPE.AR_RECEIPT &&
                                arReceiptActiveExists)
                            }
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>
                  {form.formState.errors.workflow_type?.message}
                </FieldError>
                {watchedType === WORKFLOW_TYPE.AP_INVOICE &&
                  apInvoiceActiveExists && (
                    <p className="text-muted-foreground text-xs">
                      {t("apInvoiceSingleActiveHint")}
                    </p>
                  )}
                {watchedType === WORKFLOW_TYPE.AP_PAYMENT &&
                  apPaymentActiveExists && (
                    <p className="text-muted-foreground text-xs">
                      {t("apPaymentSingleActiveHint")}
                    </p>
                  )}
                {watchedType === WORKFLOW_TYPE.AR_INVOICE &&
                  arInvoiceActiveExists && (
                    <p className="text-muted-foreground text-xs">
                      {t("arInvoiceSingleActiveHint")}
                    </p>
                  )}
                {watchedType === WORKFLOW_TYPE.AR_RECEIPT &&
                  arReceiptActiveExists && (
                    <p className="text-muted-foreground text-xs">
                      {t("arReceiptSingleActiveHint")}
                    </p>
                  )}
              </Field>
            )}
            {lockedType === WORKFLOW_TYPE.AP_INVOICE &&
              apInvoiceActiveExists && (
                <p
                  role="alert"
                  className="text-warning-ink col-span-full text-xs"
                >
                  {t("apInvoiceSingleActiveHint")}
                </p>
              )}
            {lockedType === WORKFLOW_TYPE.AP_PAYMENT &&
              apPaymentActiveExists && (
                <p
                  role="alert"
                  className="text-warning-ink col-span-full text-xs"
                >
                  {t("apPaymentSingleActiveHint")}
                </p>
              )}
            {lockedType === WORKFLOW_TYPE.AR_INVOICE &&
              arInvoiceActiveExists && (
                <p
                  role="alert"
                  className="text-warning-ink col-span-full text-xs"
                >
                  {t("arInvoiceSingleActiveHint")}
                </p>
              )}
            {lockedType === WORKFLOW_TYPE.AR_RECEIPT &&
              arReceiptActiveExists && (
                <p
                  role="alert"
                  className="text-warning-ink col-span-full text-xs"
                >
                  {t("arReceiptSingleActiveHint")}
                </p>
              )}

            {/* สถานะเป็นช่องหนึ่งของ General (เหมือนหน้าแก้ใน wf-general) — ป้าย + สวิตช์สูงเท่าช่องกรอก
                ไม่ใช้ StatusSwitch เพราะเป็นกล่องมีขอบซ้อนในการ์ด และคำอธิบายแค่ทวนป้าย */}
            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="wf-is-active">{t("status")}</FieldLabel>
                  <div className="flex min-h-8 items-center gap-2">
                    <Switch
                      id="wf-is-active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isPending}
                    />
                    <span className="text-xs">
                      {tfl(field.value ? "active" : "inactive")}
                    </span>
                  </div>
                </Field>
              )}
            />

            <Field className="@md:col-span-2">
              <FieldLabel htmlFor="wf-description">
                {tfl("description")}
              </FieldLabel>
              <Textarea
                id="wf-description"
                placeholder={t("optionalDescription")}
                className="min-h-15 text-xs"
                disabled={isPending}
                maxLength={256}
                {...form.register("description")}
              />
            </Field>
          </FieldGrid>
        </CompactSection>

        {/* Stages — พรีวิวรางเดียวกับหน้ารายละเอียด ให้เห็นก่อนสร้างว่าจะได้อะไร */}
        <CompactSection title={t("stages")} description={t("newStagesDesc")}>
          <WfStageRailPreview stages={buildDefaultStages()} />
        </CompactSection>
      </form>

      <DiscardDialog {...discard.dialogProps} variant="warning" />

      <DiscardDialog
        open={navGuard.isOpen}
        onOpenChange={(open) => {
          if (!open) navGuard.cancel();
        }}
        onConfirm={navGuard.confirm}
        onCancel={navGuard.cancel}
        variant="warning"
      />
    </FormPageShell>
  );
}
