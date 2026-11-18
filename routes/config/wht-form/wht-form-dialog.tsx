import { masterDimensionsPayload } from "../shared/ap-master-crud";
import { dependencyDetails } from "../shared/ap-master-crud";
import { Controller } from "react-hook-form";
import { FileSpreadsheet } from "lucide-react";
import { useTranslations } from "use-intl";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldPlainText,
} from "@/components/ui/field";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import type { WhtFormMaster } from "@/types/accounting-master";
import { MasterAccountFields } from "../shared/ap-master-account-fields";
import {
  MasterDependencyDialog,
  MasterStatusField,
} from "../shared/ap-master-dependencies";
import {
  whtFormSchema,
  type WhtFormValues,
} from "../shared/ap-master-form-schema";
import { whtFormCrud, type WhtFormPayload } from "./use-wht-form";

export function WhtFormDialog({
  open,
  onOpenChange,
  entity,
  readOnly,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly entity?: WhtFormMaster | null;
  readonly readOnly?: boolean;
}) {
  const tf = useTranslations("field");
  const update = whtFormCrud.useUpdate();
  return (
    <>
      <ConfigEntityDialog<WhtFormMaster, WhtFormValues, WhtFormPayload>
        open={open}
        onOpenChange={onOpenChange}
        entity={entity}
        readOnly={readOnly}
        icon={FileSpreadsheet}
        translationNamespace="config.whtForm"
        useCreate={whtFormCrud.useCreate}
        useUpdate={() => update}
        serverFieldErrors={{ WHT_FORM_DUPLICATE_CODE: "code" }}
        buildSchema={whtFormSchema}
        toFormValues={(item) => ({
          code: item?.code ?? "",
          description: item?.description ?? "",
          is_active: item?.is_active ?? true,
          chart_of_accounts_id: item?.chart_of_accounts_id ?? null,
          cost_center_id: item?.cost_center_id ?? null,
          dimensions: item?.dimensions ?? [],
        })}
        toPayload={({ code, ...values }, current) => ({
          ...values,
          ...(!current ? { code } : {}),
          dimensions: masterDimensionsPayload(values.dimensions),
        })}
        contentClassName="@container max-h-[90dvh] overflow-y-auto sm:max-w-xl"
      >
        {({ form, disabled }) => {
          const value = form.watch();
          return (
            <div className="grid gap-4 @md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="wht-form-code" required>
                  {tf("code")}
                </FieldLabel>
                {readOnly ? (
                  <FieldPlainText>{value.code}</FieldPlainText>
                ) : (
                  <FieldInput
                    id="wht-form-code"
                    maxLength={15}
                    disabled={disabled || !!entity}
                    error={form.formState.errors.code?.message}
                    {...form.register("code", {
                      onChange: (event) =>
                        form.setValue("code", event.target.value.toUpperCase()),
                    })}
                  />
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="wht-form-description" required>
                  {tf("description")}
                </FieldLabel>
                {readOnly ? (
                  <FieldPlainText>{value.description}</FieldPlainText>
                ) : (
                  <FieldInput
                    id="wht-form-description"
                    maxLength={100}
                    disabled={disabled}
                    error={form.formState.errors.description?.message}
                    {...form.register("description")}
                  />
                )}
              </Field>
              <MasterAccountFields
                value={{ ...entity, ...value }}
                endpoint={API_ENDPOINTS.WHT_FORMS}
                readOnly={readOnly}
                disabled={disabled}
                onChange={(patch) => {
                  form.setValue(
                    "chart_of_accounts_id",
                    patch.chart_of_accounts_id,
                    { shouldDirty: true },
                  );
                  form.setValue(
                    "cost_center_id",
                    patch.cost_center_id ?? null,
                    { shouldDirty: true },
                  );
                  form.setValue("dimensions", patch.dimensions, {
                    shouldDirty: true,
                  });
                }}
              />
              <div className="@md:col-span-2">
                <Controller
                  name="is_active"
                  control={form.control}
                  render={({ field }) => (
                    <MasterStatusField
                      entity={entity}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={disabled}
                      readOnly={readOnly}
                      endpoint={API_ENDPOINTS.WHT_FORMS}
                    />
                  )}
                />
              </div>
            </div>
          );
        }}
      </ConfigEntityDialog>
      <MasterDependencyDialog
        dependencies={dependencyDetails(update.error)}
        onClose={update.reset}
      />
    </>
  );
}
