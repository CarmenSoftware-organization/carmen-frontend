import { Controller, useFormState, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import {
  Field,
  FieldLabel,
  FieldInput,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Textarea } from "@/components/ui/textarea";
import { CUISINE_REGION_OPTIONS } from "@/constant/cuisine";
import { FieldGrid } from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import type { CuisineFormValues } from "./cuisine-form-schema";
import { CuisineRegionLabel } from "./cuisine-region-label";

interface CuisineGeneralFieldsProps {
  readonly form: UseFormReturn<CuisineFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ทุกช่องเป็นข้อความ (ป้ายจาง + ค่าเด่น) ไม่ใช่ input ที่ disable */
  readonly isView: boolean;
}

/**
 * ribbon ของการ์ดหัว (ทรงหัว PR) — รวมช่อง General เดิม + Note/Status ของหมวด Additional
 * เดิม (หมวดนั้นเหลือแค่สองช่อง และสถานะซ้ำกับป้ายข้างชื่อ จึงยุบเข้าหัว)
 */
export function CuisineGeneralFields({
  form,
  isDisabled,
  isView,
}: CuisineGeneralFieldsProps) {
  const t = useTranslations("operationPlan.cuisine");
  const tfl = useTranslations("field");
  // อ่าน error ผ่าน useFormState ในคอมโพเนนต์นี้เอง — ตัวนี้ถูกส่งเป็น ribbon ของการ์ดหัว
  // React Compiler memo element ที่ props คงที่ไว้ อ่าน form.formState.errors จาก prop
  // แล้วกด Save ค่าว่าง ช่องจะไม่ขึ้นแดง (บั๊กเดียวกับหัวใบ IA)
  const { errors } = useFormState({ control: form.control });

  if (isView) {
    const region = form.getValues("region");
    // ชื่อกับสถานะไม่แสดง — แถวหัวมีทั้งสองอย่างเป็นตัวเอกอยู่แล้ว · dense ทรงหัว PR
    return (
      <FieldGrid dense>
        {/* region มีจุดสีนำหน้า (CuisineRegionLabel) — ทรงเดียวกับ SettingField แต่ค่าเป็น node */}
        <div className="min-w-0">
          <div className="text-muted-foreground text-xs">{tfl("region")}</div>
          <div className="mt-0.5 text-xs">
            {region ? (
              <CuisineRegionLabel region={region} />
            ) : (
              <span className="text-muted-foreground/60">—</span>
            )}
          </div>
        </div>
        {/* data-wide = เต็มแถวบนมือถือ · ตั้งแต่ @md เหลือช่องเดียว ไม่งั้นตกแถวสอง
            เพราะตาราง audit กินที่ขวาของแถบ */}
        <div data-wide="" className="min-w-0 @md:col-span-1!">
          <SettingField
            label={tfl("description")}
            value={form.getValues("description")}
          />
        </div>
        <div data-wide="" className="min-w-0 @md:col-span-1!">
          <SettingField label={tfl("note")} value={form.getValues("note")} />
        </div>
      </FieldGrid>
    );
  }

  return (
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

      {/* ช่องเดียวทั้งคู่ — ช่องกว้าง 2 ช่องสองช่องติดกันตกคนละแถวในกริด 3 คอลัมน์ */}
      <Field>
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

      <Field>
        <FieldLabel htmlFor="cuisine-note">{tfl("note")}</FieldLabel>
        <Textarea
          id="cuisine-note"
          placeholder={tfl("optional")}
          rows={2}
          disabled={isDisabled}
          maxLength={256}
          {...form.register("note")}
        />
      </Field>
      <Controller
        control={form.control}
        name="is_active"
        render={({ field }) => (
          <StatusSwitch
            id="cuisine-is-active"
            checked={field.value}
            onCheckedChange={field.onChange}
            disabled={isDisabled}
          />
        )}
      />
    </FieldGrid>
  );
}
