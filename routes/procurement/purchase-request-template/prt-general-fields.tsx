import { useTranslations } from "use-intl";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldPlainText,
} from "@/components/ui/field";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Textarea } from "@/components/ui/textarea";
import { LookupWorkflow } from "@/components/lookup/lookup-workflow";
import { WORKFLOW_TYPE } from "@/types/workflows";
import type { PrtFormValues } from "./prt-form-schema";

interface PrtGeneralFieldsProps {
  readonly form: UseFormReturn<PrtFormValues>;
  readonly readOnly: boolean;
  readonly disabled: boolean;
  readonly workflowName?: string;
  readonly isAdd?: boolean;
}

export function PrtGeneralFields({
  form,
  readOnly,
  disabled,
  workflowName,
  isAdd,
}: PrtGeneralFieldsProps) {
  const t = useTranslations("procurement.purchaseRequestTemplate");
  const tfl = useTranslations("field");
  const errors = form.formState.errors;
  const watchedName = useWatch({ control: form.control, name: "name" });
  const watchedDescription = useWatch({
    control: form.control,
    name: "description",
  });

  return (
    <CompactSection first title={tfl("general")} description={t("generalDesc")}>
      <FieldGrid>
        <Field>
          <FieldLabel required={!readOnly}>{tfl("workflow")}</FieldLabel>
          {/* ไม่ใช้ LookupWorkflow readOnly เพราะมัน render <span> ของตัวเอง — Field
            จะมุด label ให้ก็ต่อเมื่อ FieldPlainText เป็น direct child เท่านั้น */}
          {readOnly ? (
            <FieldPlainText>{workflowName}</FieldPlainText>
          ) : (
            <Controller
              control={form.control}
              name="workflow_id"
              render={({ field }) => (
                <LookupWorkflow
                  value={field.value}
                  onValueChange={field.onChange}
                  workflowType={WORKFLOW_TYPE.PR}
                  creatableOnly={isAdd}
                  disabled={disabled}
                  error={errors.workflow_id?.message}
                  className="w-full"
                />
              )}
            />
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="prt-name" required={!readOnly}>
            {tfl("name")}
          </FieldLabel>
          {readOnly ? (
            <FieldPlainText>{watchedName}</FieldPlainText>
          ) : (
            <FieldInput
              id="prt-name"
              placeholder={t("namePlaceholder")}
              disabled={disabled}
              maxLength={100}
              error={errors.name?.message}
              {...form.register("name")}
            />
          )}
        </Field>

        <Field className="@md:col-span-2">
          <FieldLabel htmlFor="prt-description">
            {tfl("description")}
          </FieldLabel>
          {readOnly ? (
            <FieldPlainText className="whitespace-pre-wrap">
              {watchedDescription || (
                <span className="text-muted-foreground/60">—</span>
              )}
            </FieldPlainText>
          ) : (
            <Textarea
              id="prt-description"
              placeholder={tfl("optional")}
              rows={2}
              disabled={disabled}
              maxLength={256}
              className="resize-none"
              {...form.register("description")}
            />
          )}
        </Field>

        <div>
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) =>
              // โหมดดูไม่โชว์สวิตช์ที่กดไม่ได้ — ป้ายจาง + badge แบบหน้า config
              readOnly ? (
                <div>
                  <div className="text-muted-foreground text-xs">
                    {tfl("status")}
                  </div>
                  <StatusBadge active={field.value} />
                </div>
              ) : (
                <StatusSwitch
                  id="prt-is-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={disabled}
                />
              )
            }
          />
        </div>
      </FieldGrid>
    </CompactSection>
  );
}
