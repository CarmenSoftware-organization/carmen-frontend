import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Textarea } from "@/components/ui/textarea";
import { SettingSection } from "@/components/ui/setting-section";
import type { CuisineFormValues } from "./cuisine-form-schema";

const READ_MODE_EMPTY = "—";

interface CuisineAdditionalFieldsProps {
  readonly form: UseFormReturn<CuisineFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ช่องว่างแสดง "—" และซ่อนตัวนับตัวอักษร */
  readonly isView: boolean;
}

export function CuisineAdditionalFields({
  form,
  isDisabled,
  isView,
}: CuisineAdditionalFieldsProps) {
  const t = useTranslations("operationPlan.cuisine");
  const tfl = useTranslations("field");

  return (
    <SettingSection
      plain
      title={t("additional")}
      description={t("additionalDesc")}
    >
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="cuisine-note">{tfl("note")}</FieldLabel>
          <Textarea
            id="cuisine-note"
            placeholder={isView ? READ_MODE_EMPTY : tfl("optional")}
            rows={2}
            disabled={isDisabled}
            maxLength={isView ? undefined : 256}
            {...form.register("note")}
          />
        </Field>

        <Controller
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <StatusSwitch
              id="cuisine-is-active"
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={isDisabled}
            />
          )}
        />
      </FieldGroup>
    </SettingSection>
  );
}
