import { Controller } from "react-hook-form";
import { Percent } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  useCreateTaxProfile,
  useUpdateTaxProfile,
} from "@/hooks/use-tax-profile";
import {
  createTaxProfileSchema,
  getDefaultValues,
  type TaxProfileFormValues,
} from "./tax-profile-form-schema";
import type { TaxProfile } from "@/types/tax-profile";

interface TaxProfileDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly taxProfile?: TaxProfile | null;
  readonly readOnly?: boolean;
}

export function TaxProfileDialog({
  open,
  onOpenChange,
  taxProfile,
  readOnly,
}: TaxProfileDialogProps) {
  const t = useTranslations("config.taxProfile");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<TaxProfile, TaxProfileFormValues, TaxProfileFormValues>
      open={open}
      onOpenChange={onOpenChange}
      entity={taxProfile}
      readOnly={readOnly}
      icon={Percent}
      translationNamespace="config.taxProfile"
      useCreate={useCreateTaxProfile}
      useUpdate={useUpdateTaxProfile}
      serverFieldErrors={{ TAX_PROFILE_NAME_ALREADY_EXISTS: "name" }}
      buildSchema={createTaxProfileSchema}
      toFormValues={getDefaultValues}
      toPayload={(v) => v}
    >
      {({ form, disabled }) => (
        <>
          <Field>
            <FieldLabel htmlFor="tax-profile-name" required>
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="tax-profile-name"
              placeholder={t("namePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.name?.message}
              maxLength={100}
              {...form.register("name")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="tax-profile-rate" required>
              {tfl("taxRate")}
            </FieldLabel>
            <FieldInput
              errorIconAlign="left"
              id="tax-profile-rate"
              type="number"
              inputMode="decimal"
              step="any"
              placeholder={t("ratePlaceholder")}
              className="text-right tabular-nums"
              disabled={disabled}
              error={form.formState.errors.tax_rate?.message}
              {...form.register("tax_rate", { valueAsNumber: true })}
            />
          </Field>

          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <StatusSwitch
                id="tax-profile-is-active"
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
