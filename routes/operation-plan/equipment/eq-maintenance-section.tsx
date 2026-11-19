import { useWatch, Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Field, FieldLabel, FieldDatePicker } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { useLocale } from "use-intl";
import { formatLocalizedDate } from "@/lib/date-utils";
import { EqTextField } from "./eq-text-field";
import type { EquipmentFormValues } from "./eq-form-schema";

interface EqMaintenanceSectionProps {
  readonly form: UseFormReturn<EquipmentFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ช่องว่างขึ้น — แทน placeholder และไม่มีตัวนับตัวอักษร */
  readonly isView: boolean;
}

export function EqMaintenanceSection({
  form,
  isDisabled,
  isView,
}: EqMaintenanceSectionProps) {
  // ค่าโหมดดูอ่านด้วย useWatch ไม่ใช่ getValues — หน้านี้ Save แล้วอยู่หน้าเดิม getValues ไม่ทำให้
  // วาดใหม่ตอนฟอร์ม reset เป็นค่าที่เพิ่งบันทึก จึงโชว์ค่าเก่าจนกว่าจะ reload
  const v = useWatch({ control: form.control }) as EquipmentFormValues;
  const t = useTranslations("operationPlan.equipment");
  const tfl = useTranslations("field");
  const errors = form.formState.errors;
  const locale = useLocale();
  const date = (d?: string | null) =>
    d ? formatLocalizedDate(d, locale) : null;

  return (
    <CompactSection title={t("maintenance")} description={t("maintenanceDesc")}>
      {isView ? (
        <FieldGrid>
          <EqTextField
            label={t("lastMaintenanceDate")}
            value={date(v.last_maintenance_date)}
          />
          <EqTextField
            label={t("nextMaintenanceDate")}
            value={date(v.next_maintenance_date)}
          />
          <EqTextField
            label={t("maintenanceSchedule")}
            value={v.maintenance_schedule}
            wide
          />
        </FieldGrid>
      ) : (
        <FieldGrid>
          <Field>
            <FieldLabel>{t("lastMaintenanceDate")}</FieldLabel>
            <Controller
              control={form.control}
              name="last_maintenance_date"
              render={({ field }) => (
                <FieldDatePicker
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isDisabled}
                  placeholder={tfl("pickDate")}
                  className="h-8 w-full text-sm"
                  error={errors.last_maintenance_date?.message}
                />
              )}
            />
          </Field>

          <Field>
            <FieldLabel>{t("nextMaintenanceDate")}</FieldLabel>
            <Controller
              control={form.control}
              name="next_maintenance_date"
              render={({ field }) => (
                <FieldDatePicker
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isDisabled}
                  placeholder={tfl("pickDate")}
                  className="h-8 w-full text-sm"
                  error={errors.next_maintenance_date?.message}
                />
              )}
            />
          </Field>
          <Field className="@md:col-span-2">
            <FieldLabel htmlFor="equipment-maintenance-schedule">
              {t("maintenanceSchedule")}
            </FieldLabel>
            <Textarea
              id="equipment-maintenance-schedule"
              placeholder={tfl("optional")}
              rows={2}
              disabled={isDisabled}
              maxLength={256}
              {...form.register("maintenance_schedule")}
            />
          </Field>
        </FieldGrid>
      )}
    </CompactSection>
  );
}
