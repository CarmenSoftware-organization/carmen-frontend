import type { UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SettingSection } from "@/components/ui/setting-section";
import type { RecipeFormValues } from "./recipe-form-schema";

interface RecipeNotesFieldsProps {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly isDisabled: boolean;
}

/** วิธีจัดจาน + การเก็บรักษา — ข้อความที่ครัวต้องเห็นตอนทำ */
export function RecipeNotesFields({
  form,
  isDisabled,
}: RecipeNotesFieldsProps) {
  const t = useTranslations("operationPlan.recipe");

  return (
    <SettingSection
      plain
      title={t("notesSection")}
      description={t("notesSectionDesc")}
    >
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="recipe-plating">
            {t("platingInstructions")}
          </FieldLabel>
          <Textarea
            id="recipe-plating"
            rows={3}
            disabled={isDisabled}
            maxLength={2000}
            {...form.register("plating_instructions")}
          />
          <FieldDescription>{t("platingInstructionsDesc")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="recipe-storage">
            {t("storageInstructions")}
          </FieldLabel>
          <Textarea
            id="recipe-storage"
            rows={3}
            disabled={isDisabled}
            maxLength={2000}
            {...form.register("storage_instructions")}
          />
          <FieldDescription>{t("storageInstructionsDesc")}</FieldDescription>
        </Field>
      </FieldGroup>
    </SettingSection>
  );
}
