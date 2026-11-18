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
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import type { CuisineFormValues } from "./cuisine-form-schema";

type TagFieldName = "popular_dishes" | "key_ingredients";

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
    <Field className="@md:col-span-2">
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

  if (isView) {
    // โหมดอ่าน: ข้อความ (ป้ายจาง + ค่าเด่น) ไม่ใช่ tag input / key-value ที่ disable
    const v = form.getValues();
    const info = (v.info ?? []).filter((r) => r.key.trim());
    return (
      <CompactSection
        title={t("cuisineDetails")}
        description={t("cuisineDetailsDesc")}
      >
        <FieldGrid>
          <SettingField
            label={tfl("popularDishes")}
            value={(v.popular_dishes ?? []).join(", ")}
          />
          <SettingField
            label={tfl("keyIngredients")}
            value={(v.key_ingredients ?? []).join(", ")}
          />
          <div className="min-w-0 @md:col-span-2">
            <div className="text-muted-foreground text-xs">{tfl("info")}</div>
            {info.length === 0 ? (
              <div className="text-muted-foreground/60 mt-0.5 text-sm">—</div>
            ) : (
              <dl className="mt-0.5 space-y-0.5 text-sm">
                {info.map((row) => (
                  <div key={row._id} className="flex flex-wrap gap-x-2">
                    <dt className="text-muted-foreground">{row.key}</dt>
                    <dd className="min-w-0 break-words">{row.value || "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </FieldGrid>
      </CompactSection>
    );
  }

  return (
    <CompactSection
      title={t("cuisineDetails")}
      description={t("cuisineDetailsDesc")}
    >
      <FieldGrid>
        {tagField("popular_dishes", tfl("popularDishes"))}
        {tagField("key_ingredients", tfl("keyIngredients"))}

        <Field className="@md:col-span-2">
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
          {!infoError && <FieldDescription>{t("infoDesc")}</FieldDescription>}
          {infoError && <FieldError>{infoError}</FieldError>}
        </Field>
      </FieldGrid>
    </CompactSection>
  );
}
