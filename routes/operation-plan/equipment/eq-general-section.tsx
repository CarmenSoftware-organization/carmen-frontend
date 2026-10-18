import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldInput } from "@/components/ui/field";
import { LookupEquipmentCategory } from "@/components/lookup/lookup-equipment-category";
import { SettingSection } from "@/components/ui/setting-section";
import { EqImageField, type EqImageChange } from "./eq-image-field";
import type { EquipmentFormValues } from "./eq-form-schema";

/** ขีดแทนช่องว่างในโหมดอ่าน — placeholder ตัวอย่างอย่าง "e.g. Samsung" ดูเหมือนค่าจริง */
const READ_MODE_EMPTY = "—";

interface EqGeneralSectionProps {
  readonly form: UseFormReturn<EquipmentFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ช่องว่างขึ้น — แทน placeholder และไม่มีตัวนับตัวอักษร */
  readonly isView: boolean;
  readonly imageUrl?: string | null;
  readonly imageFile: File | null;
  readonly imageRemoved: boolean;
  readonly onImageChange: (next: EqImageChange) => void;
  /**
   * หมวดที่บันทึกไว้ — เป็น `defaultLabel` ของ lookup หมวด ซึ่งโหลดทีละ 30
   * หมวดที่อยู่หลังหน้าแรกจะขึ้น placeholder ทั้งที่มีค่า
   */
  readonly savedCategory?: { id: string | null; name: string | null };
}

export function EqGeneralSection({
  form,
  isDisabled,
  isView,
  imageUrl,
  imageFile,
  imageRemoved,
  onImageChange,
  savedCategory,
}: EqGeneralSectionProps) {
  const t = useTranslations("operationPlan.equipment");
  const tfl = useTranslations("field");
  const tf = useTranslations("form");
  const errors = form.formState.errors;

  return (
    <>
      {/* Identification */}
      <SettingSection
        plain
        first
        title={tf("generalInfo")}
        description={t("generalInfoDesc")}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="equipment-code" required>
              {tfl("code")}
            </FieldLabel>
            <FieldInput
              id="equipment-code"
              placeholder={t("codePlaceholder")}
              className="h-8"
              disabled={isDisabled}
              maxLength={10}
              error={errors.code?.message}
              {...form.register("code")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="equipment-name" required>
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="equipment-name"
              placeholder={t("namePlaceholder")}
              className="h-8"
              disabled={isDisabled}
              maxLength={100}
              error={errors.name?.message}
              {...form.register("name")}
            />
          </Field>

          <Field>
            <FieldLabel required>{tfl("category")}</FieldLabel>
            <Controller
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <LookupEquipmentCategory
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  defaultLabel={
                    field.value && field.value === savedCategory?.id
                      ? (savedCategory.name ?? undefined)
                      : undefined
                  }
                  disabled={isDisabled}
                  error={errors.category_id?.message}
                />
              )}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="equipment-brand">{tfl("brand")}</FieldLabel>
            <FieldInput
              id="equipment-brand"
              placeholder={isView ? READ_MODE_EMPTY : t("brandPlaceholder")}
              className="h-8"
              disabled={isDisabled}
              maxLength={100}
              error={errors.brand?.message}
              {...form.register("brand")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="equipment-model">{tfl("model")}</FieldLabel>
            <FieldInput
              id="equipment-model"
              placeholder={isView ? READ_MODE_EMPTY : t("modelPlaceholder")}
              className="h-8"
              disabled={isDisabled}
              maxLength={100}
              error={errors.model?.message}
              {...form.register("model")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="equipment-serial-no">
              {tfl("serialNo")}
            </FieldLabel>
            <FieldInput
              id="equipment-serial-no"
              placeholder={isView ? READ_MODE_EMPTY : t("serialNoPlaceholder")}
              className="h-8"
              disabled={isDisabled}
              maxLength={100}
              error={errors.serial_no?.message}
              {...form.register("serial_no")}
            />
          </Field>
        </div>

        <Field className="mt-4">
          <FieldLabel htmlFor="equipment-description">
            {tfl("description")}
          </FieldLabel>
          <Textarea
            id="equipment-description"
            placeholder={isView ? READ_MODE_EMPTY : tfl("optional")}
            rows={2}
            disabled={isDisabled}
            maxLength={isView ? undefined : 256}
            {...form.register("description")}
          />
        </Field>
      </SettingSection>

      {/* Specifications */}
      <SettingSection
        plain
        title={t("specifications")}
        description={t("specificationsDesc")}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="equipment-station">
              {tfl("station")}
            </FieldLabel>
            <FieldInput
              id="equipment-station"
              placeholder={isView ? READ_MODE_EMPTY : t("stationPlaceholder")}
              className="h-8"
              disabled={isDisabled}
              maxLength={100}
              error={errors.station?.message}
              {...form.register("station")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="equipment-capacity">
              {tfl("capacity")}
            </FieldLabel>
            <FieldInput
              id="equipment-capacity"
              placeholder={isView ? READ_MODE_EMPTY : t("capacityPlaceholder")}
              className="h-8"
              disabled={isDisabled}
              maxLength={100}
              error={errors.capacity?.message}
              {...form.register("capacity")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="equipment-power-rating">
              {tfl("powerRating")}
            </FieldLabel>
            <FieldInput
              id="equipment-power-rating"
              placeholder={
                isView ? READ_MODE_EMPTY : t("powerRatingPlaceholder")
              }
              className="h-8"
              disabled={isDisabled}
              maxLength={100}
              error={errors.power_rating?.message}
              {...form.register("power_rating")}
            />
          </Field>
        </div>
      </SettingSection>

      {/* Photo — โหมดอ่านที่ไม่มีรูป แถบสรุปบอกไว้แล้ว กล่อง "No photo" ซ้ำอีกรอบเป็นแค่ที่ว่าง */}
      {!(isView && !imageUrl) && (
        <SettingSection
          plain
          title={t("equipmentImage")}
          description={t("equipmentImageDesc")}
        >
          <div className="max-w-xs">
            <EqImageField
              disabled={isDisabled}
              serverImageUrl={imageUrl}
              file={imageFile}
              removed={imageRemoved}
              onChange={onImageChange}
            />
          </div>
        </SettingSection>
      )}
    </>
  );
}
