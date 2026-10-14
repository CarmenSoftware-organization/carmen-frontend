import { Controller } from "react-hook-form";
import { Group } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  useCreateCostCenterGroup,
  useUpdateCostCenterGroup,
} from "@/routes/config/shared/use-cost-center-group";
import type {
  CostCenterGroup,
  CreateCostCenterGroupDto,
} from "@/types/cost-center-group";
import {
  createCostCenterGroupSchema,
  type CostCenterGroupFormValues,
} from "./cost-center-group-form-schema";

interface CostCenterGroupDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly costCenterGroup?: CostCenterGroup | null;
  readonly readOnly?: boolean;
}

export function CostCenterGroupDialog({
  open,
  onOpenChange,
  costCenterGroup,
  readOnly,
}: CostCenterGroupDialogProps) {
  const t = useTranslations("config.costCenterGroup");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<
      CostCenterGroup,
      CostCenterGroupFormValues,
      CreateCostCenterGroupDto
    >
      open={open}
      onOpenChange={onOpenChange}
      entity={costCenterGroup}
      readOnly={readOnly}
      icon={Group}
      translationNamespace="config.costCenterGroup"
      useCreate={useCreateCostCenterGroup}
      useUpdate={useUpdateCostCenterGroup}
      buildSchema={createCostCenterGroupSchema}
      toFormValues={(e) => ({
        code: e?.code ?? "",
        name: e?.name ?? "",
        description: e?.description ?? "",
        note: e?.note ?? "",
        is_active: e?.is_active ?? true,
      })}
      toPayload={(v) => ({
        code: v.code.trim(),
        name: v.name.trim(),
        description: v.description?.trim() || null,
        note: v.note?.trim() || null,
        is_active: v.is_active,
      })}
    >
      {({ form, disabled }) => (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
            <Field>
              <FieldLabel htmlFor="ccg-code" required>
                {tfl("code")}
              </FieldLabel>
              <FieldInput
                id="ccg-code"
                placeholder={t("codePlaceholder")}
                className="h-8"
                disabled={disabled}
                error={form.formState.errors.code?.message}
                maxLength={20}
                {...form.register("code")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ccg-name" required>
                {tfl("name")}
              </FieldLabel>
              <FieldInput
                id="ccg-name"
                placeholder={t("namePlaceholder")}
                className="h-8"
                disabled={disabled}
                error={form.formState.errors.name?.message}
                maxLength={100}
                {...form.register("name")}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="ccg-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="ccg-description"
              placeholder={tfl("optional")}
              className="h-8"
              disabled={disabled}
              maxLength={256}
              {...form.register("description")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="ccg-note">{tfl("note")}</FieldLabel>
            <Textarea
              id="ccg-note"
              placeholder={tfl("optional")}
              className="h-8"
              disabled={disabled}
              maxLength={256}
              {...form.register("note")}
            />
          </Field>

          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <StatusSwitch
                id="ccg-is-active"
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
