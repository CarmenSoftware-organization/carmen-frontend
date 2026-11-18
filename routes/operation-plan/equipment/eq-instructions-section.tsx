import type { UseFormReturn, FieldPath } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { EqTextField } from "./eq-text-field";
import type { EquipmentFormValues } from "./eq-form-schema";

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
    <CompactSection
      title={t("instructions")}
      description={t("instructionsDesc")}
    >
      {isView ? (
        <FieldGrid>
          <EqTextField
            label={t("operationInstructions")}
            value={form.getValues("operation_instructions")}
          />
          <EqTextField
            label={t("safetyNotes")}
            value={form.getValues("safety_notes")}
          />
          <EqTextField
            label={t("cleaningInstructions")}
            value={form.getValues("cleaning_instructions")}
          />
        </FieldGrid>
      ) : (
        <FieldGrid>
          <InstructionTextarea
            form={form}
            name="operation_instructions"
            id="equipment-operation-instructions"
            label={t("operationInstructions")}
            placeholder={tfl("optional")}
            isDisabled={isDisabled}
          />
          <InstructionTextarea
            form={form}
            name="safety_notes"
            id="equipment-safety-notes"
            label={t("safetyNotes")}
            placeholder={tfl("optional")}
            isDisabled={isDisabled}
          />
          <InstructionTextarea
            form={form}
            name="cleaning_instructions"
            id="equipment-cleaning-instructions"
            label={t("cleaningInstructions")}
            placeholder={tfl("optional")}
            isDisabled={isDisabled}
          />
        </FieldGrid>
      )}
    </CompactSection>
  );
}

function InstructionTextarea({
  form,
  name,
  id,
  label,
  placeholder,
  isDisabled,
}: {
  readonly form: UseFormReturn<EquipmentFormValues>;
  readonly name: FieldPath<EquipmentFormValues>;
  readonly id: string;
  readonly label: string;
  readonly placeholder: string;
  readonly isDisabled: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        placeholder={placeholder}
        rows={3}
        disabled={isDisabled}
        maxLength={256}
        {...form.register(name)}
      />
    </Field>
  );
}
