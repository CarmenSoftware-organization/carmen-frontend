import { Controller } from "react-hook-form";
import { Replace } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldSelect,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  useCreateAdjustmentType,
  useUpdateAdjustmentType,
} from "@/hooks/use-adjustment-type";
import {
  ADJUSTMENT_TYPE,
  ADJUSTMENT_TYPE_OPTIONS,
  adjustmentTypeSchema,
  type AdjustmentType,
  type AdjustmentTypeFormValues,
} from "@/types/adjustment-type";

interface AdjustmentTypeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly adjustmentType?: AdjustmentType | null;
  readonly readOnly?: boolean;
}

type AdjustmentTypePayload = {
  code: string;
  name: string;
  type: AdjustmentType["type"];
  description: string;
  note: string;
  is_active: boolean;
};

export function AdjustmentTypeDialog({
  open,
  onOpenChange,
  adjustmentType,
  readOnly,
}: AdjustmentTypeDialogProps) {
  const t = useTranslations("config.adjustmentType");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<
      AdjustmentType,
      AdjustmentTypeFormValues,
      AdjustmentTypePayload
    >
      open={open}
      onOpenChange={onOpenChange}
      entity={adjustmentType}
      readOnly={readOnly}
      icon={Replace}
      translationNamespace="config.adjustmentType"
      useCreate={useCreateAdjustmentType}
      useUpdate={useUpdateAdjustmentType}
      serverFieldErrors={{ ADJUSTMENT_TYPE_ALREADY_EXISTS: "code" }}
      buildSchema={() => adjustmentTypeSchema}
      toFormValues={(e) =>
        e
          ? {
              code: e.code,
              name: e.name,
              type: e.type,
              description: e.description,
              note: e.note,
              is_active: e.is_active,
            }
          : {
              code: "",
              name: "",
              type: ADJUSTMENT_TYPE.STOCK_IN,
              description: "",
              note: "",
              is_active: true,
            }
      }
      toPayload={(v) => ({
        code: v.code,
        name: v.name,
        type: v.type,
        description: v.description ?? "",
        note: v.note ?? "",
        is_active: v.is_active,
      })}
    >
      {({ form, disabled }) => (
        <>
          <Field>
            <FieldLabel htmlFor="adjustment-type-code" required>
              {tfl("code")}
            </FieldLabel>
            <FieldInput
              id="adjustment-type-code"
              placeholder={t("codePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.code?.message}
              maxLength={10}
              {...form.register("code")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="adjustment-type-name" required>
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="adjustment-type-name"
              placeholder={t("namePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.name?.message}
              maxLength={100}
              {...form.register("name")}
            />
          </Field>

          <Field>
            <FieldLabel required>{tfl("type")}</FieldLabel>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <FieldSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                  error={form.formState.errors.type?.message}
                  placeholder={tfl("selectType")}
                  className="h-8 text-sm"
                >
                  <SelectContent>
                    {ADJUSTMENT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </FieldSelect>
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="adjustment-type-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="adjustment-type-description"
              placeholder={tfl("optional")}
              rows={2}
              disabled={disabled}
              maxLength={256}
              {...form.register("description")}
            />
          </Field>

          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <StatusSwitch
                id="adjustment-type-is-active"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        </>
      )}
    </ConfigEntityDialog>
  );
}
