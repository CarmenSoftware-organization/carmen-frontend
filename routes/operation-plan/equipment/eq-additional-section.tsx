import { Controller, type UseFormReturn } from "react-hook-form";
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
  const t = useTranslations("operationPlan.equipment");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const tc = useTranslations("common");

  return (
    <CompactSection title={t("additional")} description={t("additionalDesc")}>
      {isView ? (
        <FieldGrid>
          <EqTextField
            label={tfl("note")}
            value={form.getValues("note")}
            wide
          />
          <EqTextField
            label={tfl("status")}
            value={form.getValues("is_active") ? ts("active") : ts("inactive")}
          />
          <EqTextField
            label={t("portable")}
            value={form.getValues("is_portable") ? tc("yes") : tc("no")}
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
