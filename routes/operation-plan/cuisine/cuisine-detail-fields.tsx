import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { TagInput } from "@/components/ui/tag-input";
import { KeyValueInput } from "@/components/ui/key-value-input";
import { SettingSection } from "@/components/ui/setting-section";
import type { CuisineFormValues } from "./cuisine-form-schema";

type TagFieldName = "popular_dishes" | "key_ingredients" | "dimension";

interface CuisineDetailFieldsProps {
  readonly form: UseFormReturn<CuisineFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ซ่อนคำอธิบายวิธีกรอก */
  readonly isView: boolean;
}

export function CuisineDetailFields({
  form,
  isDisabled,
  isView,
}: CuisineDetailFieldsProps) {
  const t = useTranslations("operationPlan.cuisine");
  const tfl = useTranslations("field");

  const infoErrors = form.formState.errors.info;
  const infoError = Array.isArray(infoErrors)
    ? infoErrors.find((e) => e?.key?.message)?.key?.message
    : undefined;

  const tagField = (name: TagFieldName, label: string) => (
    <Field>
      <FieldLabel htmlFor={`cuisine-${name}`}>{label}</FieldLabel>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <TagInput
            id={`cuisine-${name}`}
            value={field.value}
            onChange={field.onChange}
            disabled={isDisabled}
            placeholder={t("tagPlaceholder")}
            removeLabel={(tag) => t("removeTag", { tag })}
          />
        )}
      />
    </Field>
  );

  return (
    <SettingSection
      plain
      title={t("cuisineDetails")}
      description={t("cuisineDetailsDesc")}
    >
      <div className="grid grid-cols-1 gap-4">
        {tagField("popular_dishes", tfl("popularDishes"))}
        {tagField("key_ingredients", tfl("keyIngredients"))}
        {tagField("dimension", tfl("dimension"))}

        <Field>
          <FieldLabel>{tfl("info")}</FieldLabel>
          <Controller
            control={form.control}
            name="info"
            render={({ field }) => (
              <KeyValueInput
                value={field.value}
                onChange={field.onChange}
                disabled={isDisabled}
                keyPlaceholder={t("infoKey")}
                valuePlaceholder={t("infoValue")}
                addLabel={t("addInfo")}
                removeLabel={t("removeInfo")}
              />
            )}
          />
          {!isView && !infoError && (
            <FieldDescription>{t("infoDesc")}</FieldDescription>
          )}
          {infoError && <FieldError>{infoError}</FieldError>}
        </Field>
      </div>
    </SettingSection>
  );
}
