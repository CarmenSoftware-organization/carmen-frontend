import { FileMinus } from "lucide-react";
import { useTranslations } from "use-intl";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  useCreateCnReasonConfig,
  useUpdateCnReasonConfig,
} from "./use-cn-reason-config";
import type { CnReason } from "@/types/cn-reason";
import {
  createCnReasonSchema,
  type CnReasonFormValues,
} from "./credit-note-reason-form-schema";

interface CreditNoteReasonDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly reason?: CnReason | null;
  readonly readOnly?: boolean;
}

type CnReasonPayload = { name: string; description: string };

export function CreditNoteReasonDialog({
  open,
  onOpenChange,
  reason,
  readOnly,
}: CreditNoteReasonDialogProps) {
  const t = useTranslations("config.creditNoteReason");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<CnReason, CnReasonFormValues, CnReasonPayload>
      open={open}
      onOpenChange={onOpenChange}
      entity={reason}
      readOnly={readOnly}
      icon={FileMinus}
      translationNamespace="config.creditNoteReason"
      useCreate={useCreateCnReasonConfig}
      useUpdate={useUpdateCnReasonConfig}
      serverFieldErrors={{ CREDIT_NOTE_REASON_ALREADY_EXISTS: "name" }}
      buildSchema={createCnReasonSchema}
      toFormValues={(e) =>
        e
          ? { name: e.name, description: e.description }
          : { name: "", description: "" }
      }
      toPayload={(v) => ({ name: v.name, description: v.description ?? "" })}
    >
      {({ form, disabled }) => (
        <>
          <Field>
            <FieldLabel htmlFor="cn-reason-name" required>
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="cn-reason-name"
              placeholder={t("namePlaceholder")}
              className="h-8"
              disabled={disabled}
              error={form.formState.errors.name?.message}
              maxLength={100}
              {...form.register("name")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="cn-reason-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="cn-reason-description"
              placeholder={tfl("optional")}
              className="h-8"
              disabled={disabled}
              maxLength={256}
              {...form.register("description")}
            />
          </Field>
        </>
      )}
    </ConfigEntityDialog>
  );
}
