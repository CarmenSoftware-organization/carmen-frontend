import { Controller } from "react-hook-form";
import { Briefcase } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  useCreateBusinessType,
  useUpdateBusinessType,
} from "@/hooks/use-business-type";
import {
  createBusinessTypeSchema,
  EMPTY_FORM,
  type BusinessTypeFormValues,
} from "./business-type-form-schema";
import type { BusinessType } from "@/types/business-type";

interface BusinessTypeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly businessType?: BusinessType | null;
  readonly readOnly?: boolean;
}

type BusinessTypePayload = { name: string; is_active: boolean };

export function BusinessTypeDialog({
  open,
  onOpenChange,
  businessType,
  readOnly,
}: BusinessTypeDialogProps) {
  const t = useTranslations("config.businessType");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<
      BusinessType,
      BusinessTypeFormValues,
      BusinessTypePayload
    >
      open={open}
      onOpenChange={onOpenChange}
      entity={businessType}
      readOnly={readOnly}
      icon={Briefcase}
      translationNamespace="config.businessType"
      useCreate={useCreateBusinessType}
      useUpdate={useUpdateBusinessType}
      serverFieldErrors={{ VENDOR_BUSINESS_TYPE_ALREADY_EXISTS: "name" }}
      buildSchema={createBusinessTypeSchema}
      toFormValues={(e) =>
        e ? { name: e.name, is_active: e.is_active } : EMPTY_FORM
      }
      toPayload={(v) => ({ name: v.name, is_active: v.is_active })}
    >
      {({ form, disabled }) => (
        <>
          <Field>
            <FieldLabel htmlFor="business-type-name" required>
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="business-type-name"
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
                id="business-type-is-active"
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
