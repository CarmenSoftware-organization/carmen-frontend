import { dependencyDetails } from "../shared/ap-master-crud";
import { PaymentTypeBankLookup } from "./payment-type-bank-lookup";
import { Controller } from "react-hook-form";
import { CreditCard } from "lucide-react";
import { useTranslations } from "use-intl";
import { ConfigEntityDialog } from "@/components/templates/config-entity-dialog";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldPlainText,
  FieldDescription,
} from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import {
  MOCK_ACCOUNTS,
  MOCK_CHEQUE_FORMS,
  mockChequeForm,
} from "../shared/ap-master-mock-data";
import type { PaymentTypeMaster } from "@/types/accounting-master";
import { MasterAccountFields } from "../shared/ap-master-account-fields";
import {
  MasterDependencyDialog,
  MasterStatusField,
} from "../shared/ap-master-dependencies";
import {
  paymentTypeSchema,
  type PaymentTypeValues,
} from "../shared/ap-master-form-schema";
import { paymentTypeCrud, type PaymentTypePayload } from "./use-payment-type";

function paymentTypeValues(
  entity?: PaymentTypeMaster | null,
): PaymentTypeValues {
  return {
    code: entity?.code ?? "",
    description: entity?.description ?? "",
    is_active: entity?.is_active ?? true,
    chart_of_accounts_id: entity?.chart_of_accounts_id ?? "",
    cost_center_id: entity?.cost_center_id ?? null,
    dimensions: entity?.dimensions ?? [],
    available_ap: entity?.available_ap ?? true,
    available_ar: entity?.available_ar ?? false,
    bank_account_id: entity?.bank_account_id ?? null,
    is_cheque: entity?.is_cheque ?? false,
    cheque_form_id: entity?.cheque_form_id ?? null,
  };
}

export function PaymentTypeDialog({
  open,
  onOpenChange,
  entity,
  readOnly,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly entity?: PaymentTypeMaster | null;
  readonly readOnly?: boolean;
}) {
  const t = useTranslations("config.apMaster");
  const tf = useTranslations("field");
  const tc = useTranslations("common");
  const update = paymentTypeCrud.useUpdate();
  const chequeForms = {
    data: MOCK_CHEQUE_FORMS,
    isLoading: false,
    error: null,
  };
  return (
    <>
      <ConfigEntityDialog<
        PaymentTypeMaster,
        PaymentTypeValues,
        PaymentTypePayload
      >
        open={open}
        onOpenChange={onOpenChange}
        entity={entity}
        readOnly={readOnly}
        icon={CreditCard}
        translationNamespace="config.paymentType"
        useCreate={paymentTypeCrud.useCreate}
        useUpdate={() => update}
        serverFieldErrors={{ PAYMENT_TYPE_DUPLICATE_CODE: "code" }}
        buildSchema={paymentTypeSchema}
        toFormValues={paymentTypeValues}
        toPayload={({ code, ...values }, current) => ({
          ...values,
          ...(!current ? { code } : {}),
          dimensions: values.dimensions.map(
            ({ dimension_id, dimension_value_id }) => ({
              dimension_id,
              dimension_value_id,
            }),
          ),
          cheque_form_id: values.is_cheque ? values.cheque_form_id : null,
        })}
        contentClassName="@container max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
      >
        {({ form, disabled }) => {
          const value = form.watch();
          const mapping = { ...entity, ...value };
          return (
            <div className="grid gap-4 @md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="payment-type-code" required>
                  {tf("code")}
                </FieldLabel>
                {readOnly ? (
                  <FieldPlainText>{value.code}</FieldPlainText>
                ) : (
                  <FieldInput
                    id="payment-type-code"
                    maxLength={10}
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
                <FieldLabel htmlFor="payment-type-description" required>
                  {tf("description")}
                </FieldLabel>
                {readOnly ? (
                  <FieldPlainText>{value.description}</FieldPlainText>
                ) : (
                  <FieldInput
                    id="payment-type-description"
                    maxLength={50}
                    disabled={disabled}
                    error={form.formState.errors.description?.message}
                    {...form.register("description")}
                  />
                )}
              </Field>
              <Field className="@md:col-span-2">
                <FieldLabel required>{t("availableModules")}</FieldLabel>
                {readOnly ? (
                  <FieldPlainText>
                    {[value.available_ap && "AP", value.available_ar && "AR"]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </FieldPlainText>
                ) : (
                  <div className="flex gap-5">
                    {(["available_ap", "available_ar"] as const).map((name) => (
                      <Controller
                        key={name}
                        name={name}
                        control={form.control}
                        render={({ field }) => (
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) =>
                                field.onChange(checked === true)
                              }
                              disabled={disabled}
                            />
                            {name === "available_ap" ? "AP" : "AR"}
                          </label>
                        )}
                      />
                    ))}
                  </div>
                )}
                {form.formState.errors.available_ap && (
                  <FieldDescription className="text-destructive">
                    {form.formState.errors.available_ap.message}
                  </FieldDescription>
                )}
              </Field>
              <MasterAccountFields
                value={mapping}
                endpoint={API_ENDPOINTS.PAYMENT_TYPES}
                required
                readOnly={readOnly}
                disabled={disabled}
                accountError={
                  form.formState.errors.chart_of_accounts_id?.message
                }
                onChange={(patch) => {
                  if (
                    patch.chart_of_accounts_id !== value.chart_of_accounts_id
                  ) {
                    const bank =
                      MOCK_ACCOUNTS.find(
                        (item) => item.id === patch.chart_of_accounts_id,
                      )?.bank_account_id ?? null;
                    form.setValue("bank_account_id", bank, {
                      shouldDirty: true,
                    });
                    form.setValue(
                      "cheque_form_id",
                      value.is_cheque ? mockChequeForm(bank) : null,
                      { shouldDirty: true },
                    );
                  }
                  form.setValue(
                    "chart_of_accounts_id",
                    patch.chart_of_accounts_id ?? "",
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
              <Field>
                <FieldLabel>{t("bankAccount")}</FieldLabel>
                <Controller
                  control={form.control}
                  name="bank_account_id"
                  render={({ field }) => (
                    <PaymentTypeBankLookup
                      value={field.value}
                      onChange={(bank) => {
                        field.onChange(bank);
                        if (value.is_cheque)
                          form.setValue(
                            "cheque_form_id",
                            mockChequeForm(bank),
                            { shouldDirty: true },
                          );
                      }}
                      defaultLabel={entity?.bank_account_name ?? undefined}
                      disabled={disabled}
                      readOnly={readOnly}
                    />
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>{t("isCheque")}</FieldLabel>
                {readOnly ? (
                  <FieldPlainText>
                    {tc(value.is_cheque ? "yes" : "no")}
                  </FieldPlainText>
                ) : (
                  <Controller
                    control={form.control}
                    name="is_cheque"
                    render={({ field }) => (
                      <label className="flex min-h-8 items-center gap-2 text-xs">
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked === true);
                            form.setValue(
                              "cheque_form_id",
                              checked === true
                                ? mockChequeForm(value.bank_account_id)
                                : null,
                              {
                                shouldDirty: true,
                              },
                            );
                          }}
                          disabled={disabled}
                        />
                        {t("isCheque")}
                      </label>
                    )}
                  />
                )}
              </Field>
              {value.is_cheque && (
                <Field>
                  <FieldLabel required>{t("chequeForm")}</FieldLabel>
                  {readOnly ? (
                    <FieldPlainText>
                      {entity?.cheque_form_name || "—"}
                    </FieldPlainText>
                  ) : (
                    <Controller
                      control={form.control}
                      name="cheque_form_id"
                      render={({ field, fieldState }) => (
                        <LookupCombobox
                          value={field.value ?? ""}
                          onValueChange={(id) => field.onChange(id || null)}
                          items={chequeForms.data ?? []}
                          getId={(item) => item.id}
                          getLabel={(item) => item.name}
                          getSearchValue={(item) => item.name}
                          defaultLabel={entity?.cheque_form_name ?? undefined}
                          disabled={
                            disabled ||
                            chequeForms.isLoading ||
                            !!chequeForms.error
                          }
                          isLoading={chequeForms.isLoading}
                          error={fieldState.error?.message}
                          modal
                        />
                      )}
                    />
                  )}
                  {!readOnly &&
                    !chequeForms.isLoading &&
                    !chequeForms.data?.length && (
                      <FieldDescription>
                        {t(
                          chequeForms.error
                            ? "chequeFormsLoadFailed"
                            : "noChequeForms",
                        )}
                      </FieldDescription>
                    )}
                </Field>
              )}
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
                      endpoint={API_ENDPOINTS.PAYMENT_TYPES}
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
