import { Controller } from "react-hook-form";
import { Leaf } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import { useCreateEcoLabel, useUpdateEcoLabel } from "../shared/use-eco-label";
import {
  createEcoLabelSchema,
  getDefaultValues,
  type EcoLabelFormValues,
} from "./eco-form-schema";
import type { EcoLabel } from "@/types/eco-label";

interface EcoLabelDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly ecoLabel?: EcoLabel | null;
  readonly readOnly?: boolean;
}

type EcoLabelFields = {
  code: string;
  name: string;
  description: string;
  is_active: boolean;
};

type EcoLabelPayload = EcoLabelFields & {
  metadata: EcoLabelFields & { doc_version?: number };
};

export function EcoLabelDialog({
  open,
  onOpenChange,
  ecoLabel,
  readOnly,
}: EcoLabelDialogProps) {
  const t = useTranslations("productManagement.eco");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<EcoLabel, EcoLabelFormValues, EcoLabelPayload>
      open={open}
      onOpenChange={onOpenChange}
      entity={ecoLabel}
      readOnly={readOnly}
      icon={Leaf}
      translationNamespace="productManagement.eco"
      useCreate={useCreateEcoLabel}
      useUpdate={useUpdateEcoLabel}
      buildSchema={createEcoLabelSchema}
      toFormValues={(e) => getDefaultValues(e ?? undefined)}
      toPayload={(v) => {
        const fields = {
          code: v.code,
          name: v.name,
          description: v.description ?? "",
          is_active: v.is_active,
        };
        // doc_version is the optimistic-concurrency token; the backend reads it
        // from metadata on PATCH (omitting it → 400 "doc_version: Required").
        // On create ecoLabel is null so doc_version is simply undefined.
        return {
          ...fields,
          metadata: { ...fields, doc_version: ecoLabel?.doc_version },
        };
      }}
    >
      {({ form, disabled }) => (
        <>
          <Field>
            <FieldLabel htmlFor="eco-label-code" required>
              {tfl("code")}
            </FieldLabel>
            <FieldInput
              id="eco-label-code"
              placeholder={t("codePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.code?.message}
              {...form.register("code")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="eco-label-name" required>
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="eco-label-name"
              placeholder={t("namePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.name?.message}
              maxLength={100}
              {...form.register("name")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="eco-label-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="eco-label-description"
              placeholder={tfl("optional")}
              rows={2}
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
                id="eco-label-is-active"
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
