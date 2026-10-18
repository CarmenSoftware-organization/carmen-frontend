import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  Field,
  FieldLabel,
  FieldInput,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CUISINE_REGION_OPTIONS } from "@/constant/cuisine";
import { SettingSection } from "@/components/ui/setting-section";
import type { CuisineFormValues } from "./cuisine-form-schema";
import { CuisineRegionLabel } from "./cuisine-region-label";

const READ_MODE_EMPTY = "—";

interface CuisineGeneralFieldsProps {
  readonly form: UseFormReturn<CuisineFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ช่องว่างแสดง "—" และซ่อนตัวนับตัวอักษร */
  readonly isView: boolean;
}

export function CuisineGeneralFields({
  form,
  isDisabled,
  isView,
}: CuisineGeneralFieldsProps) {
  const t = useTranslations("operationPlan.cuisine");
  const tfl = useTranslations("field");
  const tf = useTranslations("form");
  const errors = form.formState.errors;

  return (
    <SettingSection
      plain
      first
      title={tf("generalInfo")}
      description={t("generalInfoDesc")}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="cuisine-name" required>
            {tfl("name")}
          </FieldLabel>
          <FieldInput
            id="cuisine-name"
            placeholder={t("namePlaceholder")}
            disabled={isDisabled}
            maxLength={100}
            error={errors.name?.message}
            {...form.register("name")}
          />
        </Field>

        <Field>
          <FieldLabel required>{tfl("region")}</FieldLabel>
          <Controller
            control={form.control}
            name="region"
            render={({ field }) => (
              <FieldSelect
                value={field.value}
                onValueChange={field.onChange}
                placeholder={t("selectRegion")}
                disabled={isDisabled}
                error={errors.region?.message}
              >
                <SelectContent>
                  {CUISINE_REGION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <CuisineRegionLabel region={opt.value} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </FieldSelect>
            )}
          />
        </Field>
      </div>

      <Field className="mt-4">
        <FieldLabel htmlFor="cuisine-description">
          {tfl("description")}
        </FieldLabel>
        <Textarea
          id="cuisine-description"
          placeholder={isView ? READ_MODE_EMPTY : tfl("optional")}
          rows={2}
          disabled={isDisabled}
          maxLength={isView ? undefined : 256}
          {...form.register("description")}
        />
      </Field>
    </SettingSection>
  );
}
