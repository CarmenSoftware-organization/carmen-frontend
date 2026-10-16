import {
  Controller,
  useFormState,
  useWatch,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslations } from "use-intl";
import { Check, Sparkles } from "lucide-react";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
  FieldInput,
} from "@/components/ui/field";
import { ALLERGEN_OPTIONS } from "@/constant/recipe";
import { cn } from "@/lib/utils";
import { SettingSection } from "@/components/ui/setting-section";
import { EyeBrow } from "@/components/ui/eye-brow";
import type { RecipeFormValues } from "./recipe-form-schema";

interface RecipeComplianceFieldsProps {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly isDisabled: boolean;
}

const TAG_CATALOG: { key: string; labelKey: string }[] = [
  { key: "seasonal", labelKey: "tagSeasonal" },
  { key: "best-seller", labelKey: "tagBestSeller" },
  { key: "new", labelKey: "tagNew" },
  { key: "high-margin", labelKey: "tagHighMargin" },
  { key: "vegetarian", labelKey: "tagVegetarian" },
];

export function RecipeComplianceFields({
  form,
  isDisabled,
}: RecipeComplianceFieldsProps) {
  const t = useTranslations("operationPlan.recipe");
  const { errors } = useFormState({
    control: form.control,
    name: "allergens.custom",
  });

  const standardAllergens = useWatch({
    control: form.control,
    name: "allergens.standard",
  });
  const customAllergens = useWatch({
    control: form.control,
    name: "allergens.custom",
  });
  const tags = useWatch({ control: form.control, name: "tags" });

  const customList = (customAllergens ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const flaggedCount = (standardAllergens?.length ?? 0) + customList.length;

  const tagsList = (tags ?? "")
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

  const toggleTag = (tag: string) => {
    const next = tagsList.includes(tag)
      ? tagsList.filter((x) => x !== tag)
      : [...tagsList, tag];
    form.setValue("tags", next.join("\n"), { shouldDirty: true });
  };

  return (
    <>
      {/* Allergens & tags */}
      <SettingSection
        plain
        title={t("safetyCompliance")}
        description={t("safetyComplianceDesc")}
      >
        <FieldGroup className="gap-4">
          <div>
            <EyeBrow className="flex items-center gap-1.5">
              {t("allergens")}
              <span className="text-muted-foreground ml-1 font-semibold tracking-normal normal-case">
                · {t("allergensFlagged", { count: flaggedCount })}
              </span>
            </EyeBrow>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {ALLERGEN_OPTIONS.map((allergen) => (
                <Controller
                  key={allergen.value}
                  control={form.control}
                  name="allergens.standard"
                  render={({ field }) => {
                    const on = field.value?.includes(allergen.value) ?? false;
                    return (
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          const current = field.value ?? [];
                          field.onChange(
                            on
                              ? current.filter(
                                  (v: string) => v !== allergen.value,
                                )
                              : [...current, allergen.value],
                          );
                        }}
                        aria-pressed={on}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-semibold transition-colors",
                          on
                            ? "border-primary/40 bg-primary/10 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40",
                          isDisabled && "cursor-not-allowed opacity-60",
                        )}
                      >
                        {on && (
                          <Check
                            className="text-primary size-3"
                            aria-hidden="true"
                          />
                        )}
                        {allergen.label}
                      </button>
                    );
                  }}
                />
              ))}
              {customList.map((custom) => (
                <span
                  key={custom}
                  className="border-border bg-muted text-foreground inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1 text-xs font-semibold"
                >
                  <Sparkles className="size-3" aria-hidden="true" />
                  {custom}
                  <span className="text-muted-foreground text-micro-legal font-semibold">
                    {t("customAllergen")}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <Field>
            <FieldLabel htmlFor="recipe-custom-allergens">
              {t("otherAllergens")}
            </FieldLabel>
            <FieldInput
              id="recipe-custom-allergens"
              placeholder={t("otherAllergensPlaceholder")}
              size="sm"
              disabled={isDisabled}
              maxLength={256}
              error={errors.allergens?.custom?.message}
              {...form.register("allergens.custom")}
            />
            <FieldDescription>{t("otherAllergensDesc")}</FieldDescription>
          </Field>

          <div>
            <EyeBrow>{t("tags")}</EyeBrow>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TAG_CATALOG.map((tag) => {
                const on = tagsList.includes(tag.key);
                return (
                  <button
                    key={tag.key}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => toggleTag(tag.key)}
                    aria-pressed={on}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-semibold transition-colors",
                      on
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40",
                      isDisabled && "cursor-not-allowed opacity-60",
                    )}
                  >
                    {on && (
                      <Check
                        className="text-primary size-3"
                        aria-hidden="true"
                      />
                    )}
                    {t(
                      tag.labelKey as
                        | "tagSeasonal"
                        | "tagBestSeller"
                        | "tagNew"
                        | "tagHighMargin"
                        | "tagVegetarian",
                    )}
                  </button>
                );
              })}
            </div>
            <FieldDescription className="mt-2">
              {t("tagsHint")}
            </FieldDescription>
          </div>
        </FieldGroup>
      </SettingSection>
    </>
  );
}
