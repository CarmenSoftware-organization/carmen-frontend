import { useState } from "react";
import { Controller } from "react-hook-form";
import { Link } from "react-router";
import { Crosshair } from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusSwitch } from "@/components/ui/status-switch";
import {
  Field,
  FieldDescription,
  FieldInput,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  useCreateCostCenter,
  useUpdateCostCenter,
} from "@/hooks/use-cost-center";
import type { CostCenter, CreateCostCenterDto } from "@/types/cost-center";
import {
  createCostCenterSchema,
  type CostCenterFormValues,
} from "./cost-center-form-schema";
import { LookupCostCenterGroup } from "./lookup-cost-center-group";

interface CostCenterDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly costCenter?: CostCenter | null;
  readonly readOnly?: boolean;
}

export function CostCenterDialog({
  open,
  onOpenChange,
  costCenter,
  readOnly,
}: CostCenterDialogProps) {
  const t = useTranslations("config.costCenter");
  const tfl = useTranslations("field");
  const [noGroup, setNoGroup] = useState(false);
  const groupLabel = costCenter?.cost_center_group_code
    ? `${costCenter.cost_center_group_code} · ${costCenter.cost_center_group_name ?? ""}`
    : undefined;

  return (
    <ConfigEntityDialog<CostCenter, CostCenterFormValues, CreateCostCenterDto>
      open={open}
      onOpenChange={onOpenChange}
      entity={costCenter}
      readOnly={readOnly}
      icon={Crosshair}
      translationNamespace="config.costCenter"
      useCreate={useCreateCostCenter}
      useUpdate={useUpdateCostCenter}
      buildSchema={createCostCenterSchema}
      toFormValues={(e) => ({
        code: e?.code ?? "",
        name: e?.name ?? "",
        cost_center_group_id: e?.cost_center_group_id ?? "",
        description: e?.description ?? "",
        note: e?.note ?? "",
        is_active: e?.is_active ?? true,
      })}
      toPayload={(v) => ({
        code: v.code.trim(),
        name: v.name.trim(),
        cost_center_group_id: v.cost_center_group_id,
        description: v.description?.trim() || null,
        note: v.note?.trim() || null,
        is_active: v.is_active,
      })}
    >
      {({ form, disabled }) => (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
            <Field>
              <FieldLabel htmlFor="cc-code" required>
                {tfl("code")}
              </FieldLabel>
              <FieldInput
                id="cc-code"
                placeholder={t("codePlaceholder")}
                className="h-8"
                disabled={disabled}
                error={form.formState.errors.code?.message}
                maxLength={20}
                {...form.register("code")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cc-name" required>
                {tfl("name")}
              </FieldLabel>
              <FieldInput
                id="cc-name"
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
            <FieldLabel htmlFor="cc-group" required>
              {tfl("costCenterGroup")}
            </FieldLabel>
            <Controller
              control={form.control}
              name="cost_center_group_id"
              render={({ field, fieldState }) => (
                <LookupCostCenterGroup
                  value={field.value || null}
                  onValueChange={(id) => field.onChange(id ?? "")}
                  defaultLabel={groupLabel}
                  disabled={disabled}
                  error={fieldState.error?.message}
                  onEmptyChange={setNoGroup}
                />
              )}
            />
            {noGroup && !disabled && !form.watch("cost_center_group_id") && (
              <FieldDescription>
                {t("noGroupHint")}{" "}
                <Link to="/config/cost-center-group" className="underline">
                  {t("createGroupLink")}
                </Link>
              </FieldDescription>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="cc-description">
              {tfl("description")}
            </FieldLabel>
            <Textarea
              id="cc-description"
              placeholder={tfl("optional")}
              className="h-8"
              disabled={disabled}
              maxLength={256}
              {...form.register("description")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="cc-note">{tfl("note")}</FieldLabel>
            <Textarea
              id="cc-note"
              placeholder={tfl("optional")}
              className="h-8"
              disabled={disabled}
              maxLength={256}
              {...form.register("note")}
            />
          </Field>

          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <StatusSwitch
                id="cc-is-active"
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
