import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Field, FieldLabel, FieldDatePicker } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SettingSection } from "@/components/ui/setting-section";
import type { EquipmentFormValues } from "./eq-form-schema";

/** ขีดแทนช่องว่างในโหมดอ่าน — placeholder ตัวอย่างอย่าง "e.g. Samsung" ดูเหมือนค่าจริง */
const READ_MODE_EMPTY = "—";

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
  const t = useTranslations("operationPlan.equipment");
  const tfl = useTranslations("field");
  const errors = form.formState.errors;

  return (
    <SettingSection
      plain
      title={t("maintenance")}
      description={t("maintenanceDesc")}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                placeholder={isView ? READ_MODE_EMPTY : tfl("pickDate")}
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
                placeholder={isView ? READ_MODE_EMPTY : tfl("pickDate")}
                className="h-8 w-full text-sm"
                error={errors.next_maintenance_date?.message}
              />
            )}
          />
        </Field>
      </div>

      <Field className="mt-3">
        <FieldLabel htmlFor="equipment-maintenance-schedule">
          {t("maintenanceSchedule")}
        </FieldLabel>
        <Textarea
          id="equipment-maintenance-schedule"
          placeholder={isView ? READ_MODE_EMPTY : tfl("optional")}
          rows={2}
          disabled={isDisabled}
          maxLength={isView ? undefined : 256}
          {...form.register("maintenance_schedule")}
        />
      </Field>
    </SettingSection>
  );
}
