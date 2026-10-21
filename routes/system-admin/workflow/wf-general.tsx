import { Controller, type UseFormReturn } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusSwitch } from "@/components/ui/status-switch";
import { useTranslations } from "use-intl";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { getWorkflowTypeLabels } from "@/constant/workflow";
import { WORKFLOW_TYPE } from "@/types/workflows";
import type { WorkflowCreateModel } from "./wf-form-schema";

/**
 * ฟอร์มส่วนหัวของ workflow — ใช้เฉพาะตอนแก้ (บนสุดของแท็บภาพรวม) ตอนดูเฉย ๆ ชื่อ คำอธิบาย และ
 * สถานะอยู่บนหัวหน้า ชนิดกับลายเซ็นจาก PR อยู่ในแถว fact ของ `WfInsights`
 */
interface WfGeneralProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly isDisabled: boolean;
}

export function WfGeneral({ form, isDisabled }: WfGeneralProps) {
  const t = useTranslations("systemAdmin.workflow");
  const tfl = useTranslations("field");

  // มีแต่ PO ที่มีเอกสารต้นทางให้รับลายเซ็นต่อ — PR/SR ติ๊กไปก็ไม่มีใครอ่าน (backend ลบ key ทิ้ง)
  const workflowType = form.watch("workflow_type");
  const isPurchaseOrder = workflowType === WORKFLOW_TYPE.PO;
  const typeLabels = getWorkflowTypeLabels(t);
  const namePlaceholder = t("workflowNamePlaceholder", {
    type: typeLabels[workflowType] ?? typeLabels[WORKFLOW_TYPE.PR],
  });

  return (
    <div className="@container w-full pt-4">
      <FieldGroup className="gap-4">
        <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
          <Field data-invalid={!!form.formState.errors.name}>
            <FieldLabel htmlFor="wf-name">{t("workflowName")}</FieldLabel>
            <Input
              id="wf-name"
              size="sm"
              placeholder={namePlaceholder}
              disabled={isDisabled}
              maxLength={100}
              {...form.register("name")}
            />
            <FieldError>{form.formState.errors.name?.message}</FieldError>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="wf-description">{tfl("description")}</FieldLabel>
          <Textarea
            id="wf-description"
            placeholder={t("optionalDescription")}
            disabled={isDisabled}
            maxLength={256}
            {...form.register("description")}
          />
        </Field>

        {isPurchaseOrder && (
          <Field orientation="horizontal">
            <Controller
              control={form.control}
              name="data.inherit_signature_from_pr"
              render={({ field }) => (
                <Checkbox
                  id="wf-inherit-signature"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  disabled={isDisabled}
                />
              )}
            />
            <FieldContent>
              <FieldLabel htmlFor="wf-inherit-signature">
                {t("inheritSignatureFromPr")}
              </FieldLabel>
              <FieldDescription>
                {t("inheritSignatureFromPrHint")}
              </FieldDescription>
            </FieldContent>
          </Field>
        )}

        <Controller
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <StatusSwitch
              id="wf-is-active"
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={isDisabled}
            />
          )}
        />
      </FieldGroup>
    </div>
  );
}
