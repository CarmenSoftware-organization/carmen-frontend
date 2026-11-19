import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldInput } from "@/components/ui/field";
import {
  CompactSection,
  FieldGrid,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import { EqTextField } from "./eq-text-field";
import { EqImageField, type EqImageChange } from "./eq-image-field";
import type { EquipmentFormValues } from "./eq-form-schema";

interface EqGeneralSectionProps {
  readonly form: UseFormReturn<EquipmentFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ทุกช่องเป็นข้อความ (ป้ายจาง + ค่าเด่น) ไม่ใช่ input ที่ disable */
  readonly isView: boolean;
  readonly imageUrl?: string | null;
  readonly imageFile: File | null;
  readonly imageRemoved: boolean;
  readonly onImageChange: (next: EqImageChange) => void;
}

export function EqGeneralSection({
  form,
  isDisabled,
  isView,
  imageUrl,
  imageFile,
  imageRemoved,
  onImageChange,
}: EqGeneralSectionProps) {
  const t = useTranslations("operationPlan.equipment");
  const tfl = useTranslations("field");
  const tf = useTranslations("form");
  const errors = form.formState.errors;
  // ค่าโหมดดูอ่านด้วย useWatch ไม่ใช่ getValues — หน้านี้ Save แล้วอยู่หน้าเดิม getValues ไม่ทำให้
  // วาดใหม่ตอนฟอร์ม reset เป็นค่าที่เพิ่งบันทึก จึงโชว์ค่าเก่าจนกว่าจะ reload
  const v = useWatch({ control: form.control }) as EquipmentFormValues;

  return (
    <>
      {/* จอ ≥1700px General | Specifications วางคู่ — คู่นี้อยู่บนสุดของฟอร์ม
          ก้อนขวาตัด mt-5 ตอนวางคู่ ไม่งั้นต่ำกว่าซ้าย 20px */}
      <div className={SECTION_PAIR}>
        <CompactSection
          first
          title={tf("generalInfo")}
          description={t("generalInfoDesc")}
        >
          {isView ? (
            <FieldGrid>
              {/* รหัส · ชื่อ · หมวด อยู่บนการ์ดหัวแล้ว */}
              <EqTextField label={tfl("brand")} value={v.brand} />
              <EqTextField label={tfl("model")} value={v.model} />
              <EqTextField label={tfl("serialNo")} value={v.serial_no} />
              <EqTextField
                label={tfl("description")}
                value={v.description}
                wide
              />
            </FieldGrid>
          ) : (
            <FieldGrid>
              <Field>
                <FieldLabel htmlFor="equipment-brand">
                  {tfl("brand")}
                </FieldLabel>
                <FieldInput
                  id="equipment-brand"
                  placeholder={t("brandPlaceholder")}
                  className="h-8"
                  disabled={isDisabled}
                  maxLength={100}
                  error={errors.brand?.message}
                  {...form.register("brand")}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="equipment-model">
                  {tfl("model")}
                </FieldLabel>
                <FieldInput
                  id="equipment-model"
                  placeholder={t("modelPlaceholder")}
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
                  placeholder={t("serialNoPlaceholder")}
                  className="h-8"
                  disabled={isDisabled}
                  maxLength={100}
                  error={errors.serial_no?.message}
                  {...form.register("serial_no")}
                />
              </Field>
              <Field className="@md:col-span-2">
                <FieldLabel htmlFor="equipment-description">
                  {tfl("description")}
                </FieldLabel>
                <Textarea
                  id="equipment-description"
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

        <div className="min-[1700px]:[&>section]:mt-0">
          <CompactSection
            title={t("specifications")}
            description={t("specificationsDesc")}
          >
            {isView ? (
              <FieldGrid>
                <EqTextField label={tfl("station")} value={v.station} />
                <EqTextField label={tfl("capacity")} value={v.capacity} />
                <EqTextField
                  label={tfl("powerRating")}
                  value={v.power_rating}
                />
              </FieldGrid>
            ) : (
              <FieldGrid>
                <Field>
                  <FieldLabel htmlFor="equipment-station">
                    {tfl("station")}
                  </FieldLabel>
                  <FieldInput
                    id="equipment-station"
                    placeholder={t("stationPlaceholder")}
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
                    placeholder={t("capacityPlaceholder")}
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
                    placeholder={t("powerRatingPlaceholder")}
                    className="h-8"
                    disabled={isDisabled}
                    maxLength={100}
                    error={errors.power_rating?.message}
                    {...form.register("power_rating")}
                  />
                </Field>
              </FieldGrid>
            )}
          </CompactSection>
        </div>
      </div>

      {/* Photo — โหมดอ่านที่ไม่มีรูป แถบสรุปบอกไว้แล้ว กล่อง "No photo" ซ้ำอีกรอบเป็นแค่ที่ว่าง */}
      {!(isView && !imageUrl) && (
        <CompactSection
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
        </CompactSection>
      )}
    </>
  );
}
