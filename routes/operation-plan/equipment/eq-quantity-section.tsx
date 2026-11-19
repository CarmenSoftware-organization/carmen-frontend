import { useWatch, type UseFormReturn, type FieldPath } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Field, FieldLabel, FieldInput } from "@/components/ui/field";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { EqTextField } from "./eq-text-field";
import type { EquipmentFormValues } from "./eq-form-schema";

interface EqQuantitySectionProps {
  readonly form: UseFormReturn<EquipmentFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ตัวเลขเป็นข้อความ ไม่ใช่ input ที่ disable */
  readonly isView: boolean;
}

export function EqQuantitySection({
  form,
  isDisabled,
  isView,
}: EqQuantitySectionProps) {
  // ค่าโหมดดูอ่านด้วย useWatch ไม่ใช่ getValues — หน้านี้ Save แล้วอยู่หน้าเดิม getValues ไม่ทำให้
  // วาดใหม่ตอนฟอร์ม reset เป็นค่าที่เพิ่งบันทึก จึงโชว์ค่าเก่าจนกว่าจะ reload
  const v = useWatch({ control: form.control }) as EquipmentFormValues;
  const t = useTranslations("operationPlan.equipment");
  const tfl = useTranslations("field");

  return (
    <CompactSection title={t("qtySettings")} description={t("qtySettingsDesc")}>
      {isView ? (
        <FieldGrid>
          <EqTextField
            label={tfl("availableQty")}
            value={v.available_qty}
            numeric
          />
          <EqTextField label={tfl("totalQty")} value={v.total_qty} numeric />
          <EqTextField
            label={tfl("usageCount")}
            value={v.usage_count}
            numeric
          />
          <EqTextField
            label={t("avgUsageTime")}
            value={v.average_usage_time}
            numeric
          />
        </FieldGrid>
      ) : (
        <FieldGrid>
          <NumberField
            form={form}
            name="available_qty"
            id="equipment-available-qty"
            label={tfl("availableQty")}
            isDisabled={isDisabled}
          />
          <NumberField
            form={form}
            name="total_qty"
            id="equipment-total-qty"
            label={tfl("totalQty")}
            isDisabled={isDisabled}
          />
          <NumberField
            form={form}
            name="usage_count"
            id="equipment-usage-count"
            label={tfl("usageCount")}
            isDisabled={isDisabled}
          />
          <NumberField
            form={form}
            name="average_usage_time"
            id="equipment-average-usage-time"
            label={t("avgUsageTime")}
            isDisabled={isDisabled}
          />
        </FieldGrid>
      )}
    </CompactSection>
  );
}

function NumberField({
  form,
  name,
  id,
  label,
  isDisabled,
}: {
  readonly form: UseFormReturn<EquipmentFormValues>;
  readonly name: FieldPath<EquipmentFormValues>;
  readonly id: string;
  readonly label: string;
  readonly isDisabled: boolean;
}) {
  const error = form.formState.errors[name as keyof EquipmentFormValues]
    ?.message as string | undefined;
  return (
    <Field>
      <FieldLabel htmlFor={id} className="w-full justify-end">
        {label}
      </FieldLabel>
      <FieldInput
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        className="h-8 text-right tabular-nums"
        disabled={isDisabled}
        error={error}
        errorIconAlign="left"
        {...form.register(name)}
      />
    </Field>
  );
}
