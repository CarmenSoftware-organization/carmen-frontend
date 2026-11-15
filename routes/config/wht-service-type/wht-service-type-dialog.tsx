import { dependencyDetails } from "../shared/ap-master-crud";
import { Controller } from "react-hook-form";
import { useEffect, useState } from "react";
import { Percent } from "lucide-react";
import { useTranslations } from "use-intl";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldPlainText,
} from "@/components/ui/field";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import type { WhtServiceTypeMaster } from "@/types/accounting-master";
import {
  MasterDependencyDialog,
  MasterStatusField,
} from "../shared/ap-master-dependencies";
import {
  whtServiceTypeSchema,
  type WhtServiceTypeValues,
} from "../shared/ap-master-form-schema";
import {
  whtServiceTypeCrud,
  type WhtServiceTypePayload,
} from "./use-wht-service-type";

export function WhtServiceTypeDialog({
  open,
  onOpenChange,
  entity,
  readOnly,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly entity?: WhtServiceTypeMaster | null;
  readonly readOnly?: boolean;
}) {
  const tf = useTranslations("field");
  const t = useTranslations("config.apMaster");
  const update = whtServiceTypeCrud.useUpdate();
  const [rateDraft, setRateDraft] = useState(() =>
    Number(entity?.rate_percent ?? 3).toFixed(2),
  );
  useEffect(() => {
    if (open) setRateDraft(Number(entity?.rate_percent ?? 3).toFixed(2));
  }, [open, entity]);
  return (
    <>
      <ConfigEntityDialog<
        WhtServiceTypeMaster,
        WhtServiceTypeValues,
        WhtServiceTypePayload
      >
        open={open}
        onOpenChange={onOpenChange}
        entity={entity}
        readOnly={readOnly}
        icon={Percent}
        translationNamespace="config.whtServiceType"
        useCreate={whtServiceTypeCrud.useCreate}
        useUpdate={() => update}
        serverFieldErrors={{ WHT_SERVICE_TYPE_DUPLICATE_CODE: "code" }}
        buildSchema={whtServiceTypeSchema}
        toFormValues={(item) => ({
          code: item?.code ?? "",
          description: item?.description ?? "",
          rate_percent: Number(item?.rate_percent ?? 3),
          is_active: item?.is_active ?? true,
        })}
        toPayload={({ code, ...values }, current) => ({
          ...values,
          ...(!current ? { code } : {}),
        })}
      >
        {({ form, disabled }) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="wht-service-code" required>
                  {tf("code")}
                </FieldLabel>
                {readOnly ? (
                  <FieldPlainText>{entity?.code}</FieldPlainText>
                ) : (
                  <FieldInput
                    id="wht-service-code"
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
                <FieldLabel htmlFor="wht-service-rate" required>
                  {t("defaultRate")}
                </FieldLabel>
                {readOnly ? (
                  <FieldPlainText>
                    {Number(entity?.rate_percent ?? 0).toFixed(2)}%
                  </FieldPlainText>
                ) : (
                  <Controller
                    name="rate_percent"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <FieldInput
                        id="wht-service-rate"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step="0.01"
                        disabled={disabled}
                        name={field.name}
                        ref={field.ref}
                        value={rateDraft}
                        error={fieldState.error?.message}
                        onChange={(event) => {
                          setRateDraft(event.target.value);
                          field.onChange(
                            event.target.value === ""
                              ? NaN
                              : Number(event.target.value),
                          );
                        }}
                        onBlur={() => {
                          field.onBlur();
                          const rate = Number(rateDraft);
                          if (
                            rateDraft.trim() &&
                            rate >= 0 &&
                            rate <= 100 &&
                            Math.abs(rate * 100 - Math.round(rate * 100)) <
                              0.0000001
                          )
                            setRateDraft(rate.toFixed(2));
                        }}
                      />
                    )}
                  />
                )}
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="wht-service-description" required>
                  {tf("description")}
                </FieldLabel>
                {readOnly ? (
                  <FieldPlainText>{entity?.description}</FieldPlainText>
                ) : (
                  <FieldInput
                    id="wht-service-description"
                    maxLength={255}
                    disabled={disabled}
                    error={form.formState.errors.description?.message}
                    {...form.register("description")}
                  />
                )}
              </Field>
            </div>
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
                  endpoint={API_ENDPOINTS.WHT_SERVICE_TYPES}
                />
              )}
            />
          </>
        )}
      </ConfigEntityDialog>
      <MasterDependencyDialog
        dependencies={dependencyDetails(update.error)}
        onClose={update.reset}
      />
    </>
  );
}
