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
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import type { RecipeCategoryLookup } from "@/types/lookup";
import type { RecipeCategoryFormValues } from "./recipe-category-form-schema";

interface RecipeCategoryGeneralFieldsProps {
  readonly form: UseFormReturn<RecipeCategoryFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ทุกช่องเป็นข้อความ (ป้ายจาง + ค่าเด่น) ไม่ใช่ input ที่ disable */
  readonly isView: boolean;
  /** ชื่อหมวดแม่ของหมวดที่บันทึกไว้ — ฟอร์มถือแค่ id */
  readonly parentName?: string | null;
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
  parentName,
}: RecipeCategoryGeneralFieldsProps) {
  const t = useTranslations("operationPlan.recipeCategory");
  const tfl = useTranslations("field");
  const tf = useTranslations("form");
  const errors = form.formState.errors;

  return (
    <CompactSection
      first
      title={tf("generalInfo")}
      description={t("generalInfoDesc")}
    >
      {isView ? (
        <FieldGrid>
          <SettingField label={tfl("code")} value={form.getValues("code")} />
          <SettingField label={tfl("name")} value={form.getValues("name")} />
          <SettingField label={tfl("parentCategory")} value={parentName} />
          <SettingField
            label={tfl("description")}
            value={form.getValues("description")}
            fullWidth
          />
        </FieldGrid>
      ) : (
        <FieldGrid>
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
                  placeholder={t("notSet")}
                  excludeIds={excludeIds}
                  error={errors.parent_id?.message}
                />
              )}
            />
            <FieldDescription>{t("parentCategoryDesc")}</FieldDescription>
          </Field>
          <Field className="@md:col-span-2">
            <FieldLabel htmlFor="rc-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="rc-description"
              placeholder={tfl("optional")}
              rows={2}
              disabled={isDisabled}
              maxLength={256}
              {...form.register("description")}
            />
          </Field>
        </FieldGrid>
      )}
    </CompactSection>
  );
}
