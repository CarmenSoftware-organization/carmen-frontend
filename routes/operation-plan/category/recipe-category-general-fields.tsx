import { Controller, useFormState, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldInput,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { LookupRecipeCategory } from "@/components/lookup/lookup-recipe-category";
import { FieldGrid } from "@/components/share/compact-section";
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
  // อ่าน error ผ่าน useFormState ในคอมโพเนนต์นี้เอง — ตัวนี้ถูกส่งเป็น ribbon ของการ์ดหัว
  // React Compiler memo element ที่ props คงที่ไว้ อ่าน form.formState.errors จาก prop
  // แล้วกด Save ค่าว่าง ช่องจะไม่ขึ้นแดง (บั๊กเดียวกับหัวใบ IA)
  const { errors } = useFormState({ control: form.control });

  // ribbon ของการ์ดหัว (ทรงหัว PR) — ไม่มีการ์ด General แยกแล้ว
  return (
    <>
      {isView ? (
        // รหัสกับชื่อไม่แสดง — แถวหัวมีทั้งสองอย่างเป็นตัวเอกอยู่แล้ว · dense ทรงหัว PR
        <FieldGrid dense>
          <SettingField label={tfl("parentCategory")} value={parentName} />
          {/* data-wide = เต็มแถวบนมือถือ · ตั้งแต่ @md เหลือช่องเดียว ไม่งั้นตกแถวสอง
              เพราะตาราง audit กินที่ขวาของแถบ */}
          <div data-wide="" className="min-w-0 @md:col-span-1!">
            <SettingField
              label={tfl("description")}
              value={form.getValues("description")}
            />
          </div>
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
          {/* ช่องเดียว — กล่อง 2 คอลัมน์ (iPad) วางข้าง Parent ไม่เหลือช่องว่างขวา */}
          <Field>
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
    </>
  );
}
