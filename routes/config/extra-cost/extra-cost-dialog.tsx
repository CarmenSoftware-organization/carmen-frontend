import { Controller } from "react-hook-form";
import { Coins } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import { useCreateExtraCost, useUpdateExtraCost } from "@/hooks/use-extra-cost";
import {
  createExtraCostSchema,
  EMPTY_FORM,
  type ExtraCostFormValues,
} from "./extra-cost-form-schema";
import type { ExtraCost } from "@/types/extra-cost";

interface ExtraCostDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly extraCost?: ExtraCost | null;
  readonly readOnly?: boolean;
}

type ExtraCostPayload = { name: string; is_active: boolean };

export function ExtraCostDialog({
  open,
  onOpenChange,
  extraCost,
  readOnly,
}: ExtraCostDialogProps) {
  const t = useTranslations("config.extraCost");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<ExtraCost, ExtraCostFormValues, ExtraCostPayload>
      open={open}
      onOpenChange={onOpenChange}
      entity={extraCost}
      readOnly={readOnly}
      icon={Coins}
      translationNamespace="config.extraCost"
      useCreate={useCreateExtraCost}
      useUpdate={useUpdateExtraCost}
      serverFieldErrors={{ EXTRA_COST_TYPE_ALREADY_EXISTS: "name" }}
      buildSchema={createExtraCostSchema}
      toFormValues={(e) =>
        e ? { name: e.name, is_active: e.is_active } : EMPTY_FORM
      }
      toPayload={(v) => ({ name: v.name, is_active: v.is_active })}
    >
      {({ form, disabled }) => (
        <>
          <Field>
            <FieldLabel htmlFor="extra-cost-name" required>
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="extra-cost-name"
              placeholder={t("namePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.name?.message}
              maxLength={100}
              {...form.register("name")}
            />
          </Field>

          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <StatusSwitch
                id="extra-cost-is-active"
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
