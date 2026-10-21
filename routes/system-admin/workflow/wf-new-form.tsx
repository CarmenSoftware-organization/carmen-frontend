import { useState } from "react";
import { useForm, useWatch, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { useListReturn } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { Input } from "@/components/ui/input";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { SettingSection } from "@/components/ui/setting-section";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { toast } from "sonner";
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
      header={
        <FormToolbar
          entity={t("entity")}
          mode="add"
          formId="new-workflow-form"
          isPending={isPending}
          submitLabel={t("createWorkflow")}
          onBack={handleLeave}
          onCancel={handleLeave}
          badges={
            lockedTypeLabel ? (
              <>
                <Separator orientation="vertical" className="mx-0.5 h-3.5" />
                <span className="text-muted-foreground text-sm">
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
        <SettingSection
          first
          title={t("general")}
          description={t(lockedType ? "generalDescLocked" : "generalDesc")}
        >
          <Field
            data-invalid={!!form.formState.errors.name}
            className={lockedType ? "sm:col-span-2" : undefined}
          >
            <FieldLabel htmlFor="wf-name" required>
              {t("workflowName")}
            </FieldLabel>
            <Input
              id="wf-name"
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
                        <SelectItem key={opt.value} value={opt.value}>
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
            </Field>
          )}

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="wf-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="wf-description"
              placeholder={t("optionalDescription")}
              className="min-h-15 text-sm"
              disabled={isPending}
              maxLength={256}
              {...form.register("description")}
            />
          </Field>
        </SettingSection>

        {/* Stages — พรีวิวรางเดียวกับหน้ารายละเอียด ให้เห็นก่อนสร้างว่าจะได้อะไร */}
        <SettingSection title={t("stages")} description={t("newStagesDesc")}>
          <WfStageRailPreview
            stages={buildDefaultStages()}
            className="sm:col-span-2"
          />
        </SettingSection>

        {/* Status */}
        <SettingSection title={t("status")} description={t("statusDesc")}>
          <div className="space-y-3 sm:col-span-2">
            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <StatusSwitch
                  id="wf-is-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isPending}
                />
              )}
            />
          </div>
        </SettingSection>
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
