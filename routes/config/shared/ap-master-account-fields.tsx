import { useTranslations } from "use-intl";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import {
  Field,
  FieldLabel,
  FieldPlainText,
  FieldDescription,
} from "@/components/ui/field";
import { formatDimensionValue } from "@/lib/dimension-value";
import type {
  ApMasterDimension,
  ApMasterMapping,
} from "@/types/accounting-master";
import { useMasterAccountMapping } from "./ap-master-crud";
import { useState } from "react";
import { useChartOfAccount } from "@/hooks/use-chart-of-account";
import {
  useLookupPagination,
  ACTIVE_ONLY_FILTER,
} from "@/hooks/use-lookup-pagination";
import { useGlDimensionValues } from "@/hooks/use-gl-dimensions";

function MasterDimensionLookup({
  dimensionId,
  value,
  onChange,
  disabled,
}: {
  readonly dimensionId: string;
  readonly value?: ApMasterDimension;
  readonly onChange: (id: string) => void;
  readonly disabled: boolean;
}) {
  const values = useGlDimensionValues();
  const items =
    values.data?.filter(
      (item) => item.dimension_id === dimensionId && item.is_active,
    ) ?? [];
  return (
    <LookupCombobox
      value={value?.dimension_value_id ?? ""}
      onValueChange={(id) => onChange(id)}
      items={items}
      getId={(item) => item.id}
      getLabel={(item) => `${item.code} · ${item.name}`}
      getSearchValue={(item) => `${item.code} ${item.name}`}
      defaultLabel={
        value?.value_code
          ? `${value.value_code} · ${value.value_name ?? ""}`
          : undefined
      }
      disabled={disabled || values.isLoading || !!values.error}
      isLoading={values.isLoading}
      error={values.error?.message}
      allowDeselect
      modal
    />
  );
}

export function MasterAccountFields({
  value,
  onChange,
  endpoint,
  readOnly,
  disabled,
  required,
  accountError,
}: {
  readonly value: ApMasterMapping;
  readonly onChange: (
    patch: Pick<
      ApMasterMapping,
      "chart_of_accounts_id" | "cost_center_id" | "dimensions"
    >,
  ) => void;
  readonly endpoint: (bu: string) => string;
  readonly readOnly?: boolean;
  readonly disabled: boolean;
  readonly required?: boolean;
  readonly accountError?: string;
}) {
  const t = useTranslations("config.apMaster");
  const tf = useTranslations("field");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const accounts = useLookupPagination({
    useListHook: useChartOfAccount,
    search,
    enabled: !readOnly,
    selectedIds: value.chart_of_accounts_id ? [value.chart_of_accounts_id] : [],
    serverFilter: `${ACTIVE_ONLY_FILTER},type|string:balance_sheet,income_statement,statistic`,
  });
  const mapping = useMasterAccountMapping(
    endpoint,
    readOnly ? null : value.chart_of_accounts_id,
  );
  const accountLabel = [
    mapping.data?.account.code ?? value.account_code,
    mapping.data?.account.name ?? value.account_name,
  ]
    .filter(Boolean)
    .join(" · ");
  const ccLabel = [value.cost_center_code, value.cost_center_name]
    .filter(Boolean)
    .join(" · ");
  const visibleRules =
    mapping.data?.dimensions.filter(
      (rule) => rule.requirement !== "prohibited",
    ) ?? [];
  return (
    <>
      <Field>
        <FieldLabel required={required}>{tf("glAccount")}</FieldLabel>
        {readOnly ? (
          <FieldPlainText>{accountLabel || "—"}</FieldPlainText>
        ) : (
          <LookupCombobox
            value={value.chart_of_accounts_id ?? ""}
            onValueChange={(id) =>
              onChange({
                chart_of_accounts_id: id || null,
                cost_center_id: null,
                dimensions: [],
              })
            }
            items={accounts.items}
            selectedItems={accounts.selectedItems}
            getId={(item) => item.id}
            getLabel={(item) => `${item.code} · ${item.description_1}`}
            getSearchValue={(item) => `${item.code} ${item.description_1}`}
            defaultLabel={accountLabel || undefined}
            placeholder={t("selectAccount")}
            serverSideSearch
            onSearchChange={setSearch}
            onLoadMore={accounts.loadMore}
            hasMore={accounts.hasMore}
            isLoading={accounts.isLoading}
            isLoadingMore={accounts.isLoadingMore}
            allowDeselect={!required}
            disabled={disabled}
            error={accountError || accounts.error?.message}
            modal
          />
        )}
      </Field>
      <Field>
        <FieldLabel
          required={!readOnly && !!mapping.data?.is_require_cost_center}
        >
          {tf("costCenter")}
        </FieldLabel>
        {readOnly ? (
          <FieldPlainText>{ccLabel || "—"}</FieldPlainText>
        ) : (
          <LookupCombobox<{ id: string; code: string; name: string }>
            value={value.cost_center_id ?? ""}
            onValueChange={(id) =>
              onChange({
                chart_of_accounts_id: value.chart_of_accounts_id,
                cost_center_id: id || null,
                dimensions: value.dimensions,
              })
            }
            items={mapping.data?.cost_centers ?? []}
            getId={(item) => item.id}
            getLabel={(item) => `${item.code} · ${item.name}`}
            getSearchValue={(item) => `${item.code} ${item.name}`}
            defaultLabel={ccLabel || undefined}
            disabled={
              disabled ||
              !value.chart_of_accounts_id ||
              mapping.isLoading ||
              !!mapping.error
            }
            isLoading={mapping.isLoading}
            allowDeselect
            modal
          />
        )}
      </Field>
      {mapping.error && (
        <FieldDescription role="alert" className="text-destructive">
          {t("mappingLoadFailed")}
        </FieldDescription>
      )}
      {readOnly
        ? value.dimensions.map((dimension) => (
            <Field key={dimension.dimension_id}>
              <FieldLabel>
                {dimension.dimension_name ||
                  dimension.dimension_code ||
                  tf("dimension")}
              </FieldLabel>
              <FieldPlainText>
                {dimension.dimension_value_id
                  ? [dimension.value_code, dimension.value_name]
                      .filter(Boolean)
                      .join(" · ") || "—"
                  : formatDimensionValue(dimension, undefined, {
                      yes: tc("yes"),
                      no: tc("no"),
                    }) || "—"}
              </FieldPlainText>
            </Field>
          ))
        : visibleRules.map((rule) => (
            <Field key={rule.dimension_id}>
              <FieldLabel required={rule.requirement === "mandatory"}>
                {rule.code} · {rule.name}
              </FieldLabel>
              <MasterDimensionLookup
                dimensionId={rule.dimension_id}
                value={value.dimensions.find(
                  (item) => item.dimension_id === rule.dimension_id,
                )}
                disabled={disabled}
                onChange={(id) =>
                  onChange({
                    chart_of_accounts_id: value.chart_of_accounts_id,
                    cost_center_id: value.cost_center_id,
                    dimensions: [
                      ...value.dimensions.filter(
                        (item) => item.dimension_id !== rule.dimension_id,
                      ),
                      ...(id
                        ? [
                            {
                              dimension_id: rule.dimension_id,
                              dimension_value_id: id,
                            },
                          ]
                        : []),
                    ],
                  })
                }
              />
            </Field>
          ))}
      {!readOnly && value.chart_of_accounts_id && (
        <FieldDescription>{t("accountChangeHint")}</FieldDescription>
      )}
    </>
  );
}
