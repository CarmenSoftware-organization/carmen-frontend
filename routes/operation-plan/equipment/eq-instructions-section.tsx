import type { UseFormReturn, FieldPath } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SettingSection } from "@/components/ui/setting-section";
import type { EquipmentFormValues } from "./eq-form-schema";

/** ขีดแทนช่องว่างในโหมดอ่าน — placeholder ตัวอย่างอย่าง "e.g. Samsung" ดูเหมือนค่าจริง */
const READ_MODE_EMPTY = "—";

interface EqInstructionsSectionProps {
  readonly form: UseFormReturn<EquipmentFormValues>;
  readonly isDisabled: boolean;
  /** โหมดอ่าน — ช่องว่างขึ้น — แทน placeholder และไม่มีตัวนับตัวอักษร */
  readonly isView: boolean;
}

export function EqInstructionsSection({
  form,
  isDisabled,
  isView,
}: EqInstructionsSectionProps) {
  const t = useTranslations("operationPlan.equipment");
  const tfl = useTranslations("field");

  return (
    <SettingSection
      plain
      title={t("instructions")}
      description={t("instructionsDesc")}
    >
      <div className="grid grid-cols-1 gap-4">
        <InstructionTextarea
          form={form}
          name="operation_instructions"
          id="equipment-operation-instructions"
          label={t("operationInstructions")}
          placeholder={isView ? READ_MODE_EMPTY : tfl("optional")}
          isDisabled={isDisabled}
          isView={isView}
        />
        <InstructionTextarea
          form={form}
          name="safety_notes"
          id="equipment-safety-notes"
          label={t("safetyNotes")}
          placeholder={isView ? READ_MODE_EMPTY : tfl("optional")}
          isDisabled={isDisabled}
          isView={isView}
        />
        <InstructionTextarea
          form={form}
          name="cleaning_instructions"
          id="equipment-cleaning-instructions"
          label={t("cleaningInstructions")}
          placeholder={isView ? READ_MODE_EMPTY : tfl("optional")}
          isDisabled={isDisabled}
          isView={isView}
        />
      </div>
    </SettingSection>
  );
}

function InstructionTextarea({
  form,
  name,
  id,
  label,
  placeholder,
  isDisabled,
  isView,
}: {
  readonly form: UseFormReturn<EquipmentFormValues>;
  readonly name: FieldPath<EquipmentFormValues>;
  readonly id: string;
  readonly label: string;
  readonly placeholder: string;
  readonly isDisabled: boolean;
  readonly isView: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        placeholder={placeholder}
        rows={3}
        disabled={isDisabled}
        maxLength={isView ? undefined : 256}
        {...form.register(name)}
      />
    </Field>
  );
}
