import { useWatch, Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Field, FieldLabel } from "@/components/ui/field";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Textarea } from "@/components/ui/textarea";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { EqTextField } from "./eq-text-field";
import type { EquipmentFormValues } from "./eq-form-schema";

interface EqAdditionalSectionProps {
  readonly form: UseFormReturn<EquipmentFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ช่องว่างขึ้น — แทน placeholder และไม่มีตัวนับตัวอักษร */
  readonly isView: boolean;
}

export function EqAdditionalSection({
  form,
  isDisabled,
  isView,
}: EqAdditionalSectionProps) {
  // ค่าโหมดดูอ่านด้วย useWatch ไม่ใช่ getValues — หน้านี้ Save แล้วอยู่หน้าเดิม getValues ไม่ทำให้
  // วาดใหม่ตอนฟอร์ม reset เป็นค่าที่เพิ่งบันทึก จึงโชว์ค่าเก่าจนกว่าจะ reload
  const v = useWatch({ control: form.control }) as EquipmentFormValues;
  const t = useTranslations("operationPlan.equipment");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const tc = useTranslations("common");

  return (
    <CompactSection title={t("additional")} description={t("additionalDesc")}>
      {isView ? (
        <FieldGrid>
          <EqTextField label={tfl("note")} value={v.note} wide />
          <EqTextField
            label={tfl("status")}
            value={v.is_active ? ts("active") : ts("inactive")}
          />
          <EqTextField
            label={t("portable")}
            value={v.is_portable ? tc("yes") : tc("no")}
          />
        </FieldGrid>
      ) : (
        <FieldGrid>
          <Field className="@md:col-span-2">
            <FieldLabel htmlFor="equipment-note">{tfl("note")}</FieldLabel>
            <Textarea
              id="equipment-note"
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
                id="equipment-is-active"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isDisabled}
              />
            )}
          />

          <Controller
            control={form.control}
            name="is_portable"
            render={({ field }) => (
              <StatusSwitch
                id="equipment-is-portable"
                label={t("portable")}
                description={t("portableDesc")}
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isDisabled}
                hideBadge
              />
            )}
          />
        </FieldGrid>
      )}
    </CompactSection>
  );
}
