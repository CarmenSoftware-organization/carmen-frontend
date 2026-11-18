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
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import type { CuisineFormValues } from "./cuisine-form-schema";
import { CuisineRegionLabel } from "./cuisine-region-label";

interface CuisineGeneralFieldsProps {
  readonly form: UseFormReturn<CuisineFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ทุกช่องเป็นข้อความ (ป้ายจาง + ค่าเด่น) ไม่ใช่ input ที่ disable */
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
    <CompactSection
      first
      title={tf("generalInfo")}
      description={t("generalInfoDesc")}
    >
      {isView ? (
        <FieldGrid>
          <SettingField label={tfl("name")} value={form.getValues("name")} />
          {/* region มีจุดสีนำหน้า (CuisineRegionLabel) — ทรงเดียวกับ SettingField แต่ค่าเป็น node */}
          <div className="min-w-0">
            <div className="text-muted-foreground text-xs">{tfl("region")}</div>
            <div className="mt-0.5 text-sm">
              {form.getValues("region") ? (
                <CuisineRegionLabel region={form.getValues("region")} />
              ) : (
                <span className="text-muted-foreground/60">—</span>
              )}
            </div>
          </div>
          <SettingField
            label={tfl("description")}
            value={form.getValues("description")}
            fullWidth
          />
        </FieldGrid>
      ) : (
        <FieldGrid>
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
          <Field className="@md:col-span-2">
            <FieldLabel htmlFor="cuisine-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="cuisine-description"
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
