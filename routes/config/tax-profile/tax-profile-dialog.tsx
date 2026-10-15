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
  EMPTY_FORM,
  type TaxProfileFormValues,
} from "./tax-profile-form-schema";
import type { TaxProfile } from "@/types/tax-profile";

interface TaxProfileDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly taxProfile?: TaxProfile | null;
  readonly readOnly?: boolean;
}

type TaxProfilePayload = {
  name: string;
  tax_rate: number;
  is_active: boolean;
};

export function TaxProfileDialog({
  open,
  onOpenChange,
  taxProfile,
  readOnly,
}: TaxProfileDialogProps) {
  const t = useTranslations("config.taxProfile");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<TaxProfile, TaxProfileFormValues, TaxProfilePayload>
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
      toFormValues={(e) =>
        e
          ? {
              name: e.name,
              tax_rate: e.tax_rate,
              is_active: e.is_active,
            }
          : EMPTY_FORM
      }
      toPayload={(v) => ({
        name: v.name,
        tax_rate: v.tax_rate,
        is_active: v.is_active,
      })}
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
