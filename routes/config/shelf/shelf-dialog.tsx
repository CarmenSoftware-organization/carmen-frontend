import { Controller } from "react-hook-form";
import { Rows3 } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import { useCreateShelf, useUpdateShelf } from "@/hooks/use-shelf";
import {
  createShelfSchema,
  getDefaultValues,
  type ShelfFormValues,
} from "./shelf-form-schema";
import type { Shelf, CreateShelfDto } from "@/types/shelf";
import { Textarea } from "@/components/ui/textarea";

interface ShelfDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly shelf?: Shelf | null;
  readonly readOnly?: boolean;
}

type ShelfPayload = Omit<CreateShelfDto, "doc_version">;

export function ShelfDialog({
  open,
  onOpenChange,
  shelf,
  readOnly,
}: ShelfDialogProps) {
  const t = useTranslations("config.shelf");
  const tfl = useTranslations("field");

  return (
    <ConfigEntityDialog<Shelf, ShelfFormValues, ShelfPayload>
      open={open}
      onOpenChange={onOpenChange}
      entity={shelf}
      readOnly={readOnly}
      icon={Rows3}
      translationNamespace="config.shelf"
      useCreate={useCreateShelf}
      useUpdate={useUpdateShelf}
      serverFieldErrors={{ SHELF_ALREADY_EXISTS: ["code", "name"] }}
      buildSchema={createShelfSchema}
      toFormValues={(e) => getDefaultValues(e ?? undefined)}
      toPayload={(v) => ({
        code: v.code,
        name: v.name,
        description: v.description || undefined,
        sequence_no: v.sequence_no,
        is_active: v.is_active,
      })}
    >
      {({ form, disabled }) => (
        <>
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <Field>
              <FieldLabel htmlFor="shelf-code" required>
                {tfl("code")}
              </FieldLabel>
              <FieldInput
                id="shelf-code"
                placeholder={t("codePlaceholder")}
                className="h-8"
                disabled={disabled}
                error={form.formState.errors.code?.message}
                maxLength={20}
                {...form.register("code")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="shelf-name" required>
                {tfl("name")}
              </FieldLabel>
              <FieldInput
                id="shelf-name"
                placeholder={t("namePlaceholder")}
                className="h-8"
                disabled={disabled}
                error={form.formState.errors.name?.message}
                maxLength={100}
                {...form.register("name")}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="shelf-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="shelf-description"
              placeholder={tfl("optional")}
              disabled={disabled}
              maxLength={256}
              {...form.register("description")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="shelf-sequence">{tfl("sequence")}</FieldLabel>
            <FieldInput
              errorIconAlign="left"
              id="shelf-sequence"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder={t("sequencePlaceholder")}
              className="h-8 w-28 text-right tabular-nums"
              disabled={disabled}
              error={form.formState.errors.sequence_no?.message}
              {...form.register("sequence_no")}
            />
          </Field>

          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <StatusSwitch
                id="shelf-is-active"
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
