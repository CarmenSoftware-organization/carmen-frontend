import {
  Controller,
  useFormState,
  type Control,
  type FieldPath,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
  FieldInput,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { LookupCuisine } from "@/components/lookup/lookup-cuisine";
import { LookupRecipeCategory } from "@/components/lookup/lookup-recipe-category";
import { LookupUnit } from "@/components/lookup/lookup-unit";
import { useUnitById } from "@/hooks/use-unit";
import { SettingSection } from "@/components/ui/setting-section";
import type { Recipe } from "@/types/recipe";
import type { RecipeFormValues } from "./recipe-form-schema";

interface RecipeGeneralFieldsProps {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly isDisabled: boolean;
  /**
   * สูตรที่บันทึกไว้ — ใช้ชื่อ cuisine/category เป็น `defaultLabel` ของ lookup
   * (list โหลดทีละ 30 ค่าที่อยู่หลังหน้าแรกหาชื่อไม่เจอแล้วขึ้น placeholder)
   */
  readonly recipe?: Recipe;
}

export function RecipeGeneralFields({
  form,
  isDisabled,
  recipe,
}: RecipeGeneralFieldsProps) {
  // base_yield_unit เป็น unit id เปล่า ๆ — API ไม่ส่งชื่อมาด้วย ดึงหน่วยที่บันทึกไว้
  // ตัวเดียวมาเป็น defaultLabel ไม่งั้นหน่วยที่อยู่หลัง 30 ตัวแรกจะขึ้น placeholder
  const { data: savedYieldUnit } = useUnitById(
    recipe?.base_yield_unit || undefined,
  );
  const t = useTranslations("operationPlan.recipe");
  const tfl = useTranslations("field");
  // subscribe เอง — อ่าน form.formState.errors ตรง ๆ ไม่ re-render เมื่อ error เปลี่ยน
  const { errors } = useFormState({ control: form.control });

  return (
    <SettingSection
      plain
      title={t("recipeDetails")}
      description={t("recipeDetailsDesc")}
    >
      <FieldGroup className="gap-3">
        {/* Code + Classification */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="recipe-code" required>
              {tfl("code")}
            </FieldLabel>
            <FieldInput
              id="recipe-code"
              size="sm"
              placeholder={t("codePlaceholder")}
              disabled={isDisabled}
              maxLength={10}
              error={errors.code?.message}
              {...form.register("code")}
            />
          </Field>

          <Field>
            <FieldLabel required>{tfl("cuisine")}</FieldLabel>
            <Controller
              control={form.control}
              name="cuisine_id"
              render={({ field }) => (
                <LookupCuisine
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  defaultLabel={
                    field.value && field.value === recipe?.cuisine?.id
                      ? recipe.cuisine.name
                      : undefined
                  }
                  disabled={isDisabled}
                  error={errors.cuisine_id?.message}
                />
              )}
            />
          </Field>

          <Field>
            <FieldLabel required>{tfl("category")}</FieldLabel>
            <Controller
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <LookupRecipeCategory
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  defaultLabel={
                    field.value && field.value === recipe?.category?.id
                      ? recipe.category.name
                      : undefined
                  }
                  disabled={isDisabled}
                  error={errors.category_id?.message}
                />
              )}
            />
          </Field>
        </div>

        {/* Description / Note */}
        <Field>
          <FieldLabel htmlFor="recipe-description">
            {tfl("description")}
          </FieldLabel>
          <Textarea
            id="recipe-description"
            placeholder={t("descriptionPlaceholder")}
            rows={2}
            disabled={isDisabled}
            maxLength={256}
            {...form.register("description")}
          />
          <FieldDescription>{t("descriptionDesc")}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="recipe-note">{tfl("internalNote")}</FieldLabel>
          <Textarea
            id="recipe-note"
            placeholder={t("internalNotePlaceholder")}
            rows={2}
            disabled={isDisabled}
            maxLength={256}
            {...form.register("note")}
          />
          <FieldDescription>{t("internalNoteDesc")}</FieldDescription>
        </Field>

        {/* Time + yield */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <NumberField
            id="recipe-prep-time"
            label={t("prepTime")}
            suffix={t("min")}
            control={form.control}
            name="prep_time"
            disabled={isDisabled}
            error={errors.prep_time?.message}
          />
          <NumberField
            id="recipe-cook-time"
            label={t("cookTime")}
            suffix={t("min")}
            control={form.control}
            name="cook_time"
            disabled={isDisabled}
            error={errors.cook_time?.message}
          />
          <NumberField
            id="recipe-base-yield"
            label={t("baseYield")}
            control={form.control}
            name="base_yield"
            disabled={isDisabled}
            error={errors.base_yield?.message}
          />

          <Field>
            <FieldLabel required>{t("yieldUnit")}</FieldLabel>
            <Controller
              control={form.control}
              name="base_yield_unit"
              render={({ field }) => (
                <LookupUnit
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  disabled={isDisabled}
                  placeholder={t("selectUnit")}
                  defaultLabel={
                    field.value && field.value === savedYieldUnit?.id
                      ? savedYieldUnit.name
                      : undefined
                  }
                  error={errors.base_yield_unit?.message}
                />
              )}
            />
          </Field>
        </div>
      </FieldGroup>
    </SettingSection>
  );
}

function NumberField({
  id,
  label,
  suffix,
  control,
  name,
  disabled,
  error,
}: {
  readonly id: string;
  readonly label: string;
  readonly suffix?: string;
  readonly control: Control<RecipeFormValues>;
  readonly name: FieldPath<RecipeFormValues>;
  readonly disabled: boolean;
  readonly error?: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id} className="w-full justify-end">
        {label}
      </FieldLabel>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <FieldInput
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            size="sm"
            className="text-right tabular-nums"
            value={(field.value as number | undefined) ?? 0}
            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
            disabled={disabled}
            error={error}
            errorIconAlign="left"
          />
        )}
      />
      {suffix && (
        <FieldDescription className="text-right">{suffix}</FieldDescription>
      )}
    </Field>
  );
}
