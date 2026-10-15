import { Controller } from "react-hook-form";
import { Award } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  useCreateCertification,
  useUpdateCertification,
} from "../shared/use-certification";
import {
  createCertificationSchema,
  getDefaultValues,
  type CertificationFormValues,
} from "./certification-form-schema";
import type { Certification } from "@/types/certification";

interface CertificationDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly certification?: Certification | null;
  readonly readOnly?: boolean;
}

type CertificationPayload = {
  code: string;
  name: string;
  description: string;
  is_active: boolean;
};

export function CertificationDialog({
  open,
  onOpenChange,
  certification,
  readOnly,
}: CertificationDialogProps) {
  const t = useTranslations("vendorManagement.certification");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<
      Certification,
      CertificationFormValues,
      CertificationPayload
    >
      open={open}
      onOpenChange={onOpenChange}
      entity={certification}
      readOnly={readOnly}
      icon={Award}
      translationNamespace="vendorManagement.certification"
      useCreate={useCreateCertification}
      useUpdate={useUpdateCertification}
      serverFieldErrors={{
        VENDOR_MASTER_CERTIFICATE_ALREADY_EXISTS: ["code", "name"],
      }}
      buildSchema={createCertificationSchema}
      toFormValues={(e) => getDefaultValues(e ?? undefined)}
      toPayload={(v) => ({
        code: v.code,
        name: v.name,
        description: v.description ?? "",
        is_active: v.is_active,
      })}
    >
      {({ form, disabled }) => (
        <>
          <Field>
            <FieldLabel htmlFor="certification-code" required>
              {tfl("code")}
            </FieldLabel>
            <FieldInput
              id="certification-code"
              placeholder={t("codePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.code?.message}
              maxLength={10}
              {...form.register("code")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="certification-name" required>
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="certification-name"
              placeholder={t("namePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.name?.message}
              maxLength={100}
              {...form.register("name")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="certification-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="certification-description"
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
                id="certification-is-active"
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
