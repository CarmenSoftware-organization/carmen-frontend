import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldInput,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { LookupRecipeCategory } from "@/components/lookup/lookup-recipe-category";
import { SettingSection } from "@/components/ui/setting-section";
import type { RecipeCategoryLookup } from "@/types/lookup";
import type { RecipeCategoryFormValues } from "./recipe-category-form-schema";

const READ_MODE_EMPTY = "—";

interface RecipeCategoryGeneralFieldsProps {
  readonly form: UseFormReturn<RecipeCategoryFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ช่องว่างแสดง "—" และซ่อนตัวนับตัวอักษร */
  readonly isView: boolean;
  readonly excludeIds?: Set<string>;
  /** หมวดแม่ที่ผู้ใช้เพิ่งเลือก (undefined = ล้างค่า) — ใช้คำนวณ level */
  readonly onParentChange: (parent?: RecipeCategoryLookup) => void;
}

export function RecipeCategoryGeneralFields({
  form,
  isDisabled,
  isView,
  excludeIds,
  onParentChange,
}: RecipeCategoryGeneralFieldsProps) {
  const t = useTranslations("operationPlan.recipeCategory");
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="rc-code" required>
            {tfl("code")}
          </FieldLabel>
          <FieldInput
            id="rc-code"
            placeholder={t("codePlaceholder")}
            className="h-8"
            disabled={isDisabled}
            maxLength={10}
            error={errors.code?.message}
            {...form.register("code")}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="rc-name" required>
            {tfl("name")}
          </FieldLabel>
          <FieldInput
            id="rc-name"
            placeholder={t("namePlaceholder")}
            className="h-8"
            disabled={isDisabled}
            maxLength={100}
            error={errors.name?.message}
            {...form.register("name")}
          />
        </Field>

        <Field>
          <FieldLabel>{tfl("parentCategory")}</FieldLabel>
          <Controller
            control={form.control}
            name="parent_id"
            render={({ field }) => (
              <LookupRecipeCategory
                value={field.value ?? ""}
                onValueChange={(id) => {
                  field.onChange(id || null);
                  if (!id) onParentChange(undefined);
                }}
                onItemChange={(parent) => onParentChange(parent)}
                disabled={isDisabled}
                placeholder={isView ? READ_MODE_EMPTY : t("notSet")}
                excludeIds={excludeIds}
                error={errors.parent_id?.message}
              />
            )}
          />
          {!isView && (
            <FieldDescription>{t("parentCategoryDesc")}</FieldDescription>
          )}
        </Field>
      </div>

      <Field className="mt-4">
        <FieldLabel htmlFor="rc-description">{tfl("description")}</FieldLabel>
        <Textarea
          id="rc-description"
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
