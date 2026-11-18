import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Field, FieldLabel } from "@/components/ui/field";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Textarea } from "@/components/ui/textarea";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import type { CuisineFormValues } from "./cuisine-form-schema";

interface CuisineAdditionalFieldsProps {
  readonly form: UseFormReturn<CuisineFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ข้อความ ไม่ใช่ input ที่ disable */
  readonly isView: boolean;
}

export function CuisineAdditionalFields({
  form,
  isDisabled,
  isView,
}: CuisineAdditionalFieldsProps) {
  const t = useTranslations("operationPlan.cuisine");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");

  return (
    <CompactSection title={t("additional")} description={t("additionalDesc")}>
      {isView ? (
        <FieldGrid>
          <SettingField
            label={tfl("note")}
            value={form.getValues("note")}
            fullWidth
          />
          <SettingField
            label={tfl("status")}
            value={form.getValues("is_active") ? ts("active") : ts("inactive")}
          />
        </FieldGrid>
      ) : (
        <FieldGrid>
          <Field className="@md:col-span-2">
            <FieldLabel htmlFor="cuisine-note">{tfl("note")}</FieldLabel>
            <Textarea
              id="cuisine-note"
              placeholder={tfl("optional")}
              rows={2}
              disabled={isDisabled}
              maxLength={256}
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
        </FieldGrid>
      )}
    </CompactSection>
  );
}
