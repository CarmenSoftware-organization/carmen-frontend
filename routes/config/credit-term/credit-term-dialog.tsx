import { Controller } from "react-hook-form";
import { CalendarClock } from "lucide-react";
import { useTranslations } from "use-intl";
import { Input } from "@/components/ui/input";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  useCreateCreditTerm,
  useUpdateCreditTerm,
} from "@/hooks/use-credit-term";
import type { CreditTerm } from "@/types/credit-term";
import {
  createCreditTermSchema,
  type CreditTermFormValues,
} from "./credit-term-form-schema";

interface CreditTermDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly creditTerm?: CreditTerm | null;
  readonly readOnly?: boolean;
}

type CreditTermPayload = {
  name: string;
  value: number;
  description: string;
  is_active: boolean;
};

export function CreditTermDialog({
  open,
  onOpenChange,
  creditTerm,
  readOnly,
}: CreditTermDialogProps) {
  const t = useTranslations("config.creditTerm");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<CreditTerm, CreditTermFormValues, CreditTermPayload>
      open={open}
      onOpenChange={onOpenChange}
      entity={creditTerm}
      readOnly={readOnly}
      icon={CalendarClock}
      translationNamespace="config.creditTerm"
      useCreate={useCreateCreditTerm}
      useUpdate={useUpdateCreditTerm}
      serverFieldErrors={{ CREDIT_TERM_ALREADY_EXISTS: "name" }}
      buildSchema={createCreditTermSchema}
      toFormValues={(e) =>
        e
          ? {
              name: e.name,
              value: e.value,
              description: e.description,
              is_active: e.is_active,
            }
          : {
              name: "",
              value: 0,
              description: "",
              is_active: true,
            }
      }
      toPayload={(v) => ({
        name: v.name,
        value: v.value,
        description: v.description ?? "",
        is_active: v.is_active,
      })}
    >
      {({ form, disabled }) => (
        <>
          <Field>
            <FieldLabel htmlFor="credit-term-name" required>
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="credit-term-name"
              placeholder={t("namePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.name?.message}
              maxLength={100}
              {...form.register("name")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="credit-term-value" required>
              {tfl("creditTermDays")}
            </FieldLabel>
            <Input
              id="credit-term-value"
              type="number"
              inputMode="decimal"
              placeholder={t("valuePlaceholder")}
              className="text-right tabular-nums"
              disabled={disabled}
              {...form.register("value")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="credit-term-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="credit-term-description"
              placeholder={tfl("optional")}
              className="h-8"
              disabled={disabled}
              maxLength={256}
              {...form.register("description")}
            />
          </Field>

          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <StatusSwitch
                id="credit-term-is-active"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        </>
      )}
    </ConfigEntityDialog>
  );
}
