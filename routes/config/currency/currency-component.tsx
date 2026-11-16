import { lazy, Suspense } from "react";
import { useTranslations } from "use-intl";
import { useCurrency, useDeleteCurrency } from "@/hooks/use-currency";
import type { Currency } from "@/types/currency";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useCurrencyTable } from "./use-currency-table";
import { CURRENCY_FILTER_FIELDS } from "./currency-filter-fields";
import CurrencyCard from "./currency-card";

// แทน next/dynamic ด้วย React.lazy (code-split dialog chunk เหมือนเดิม)
const CurrencyDialog = lazy(() =>
  import("./currency-dialog").then((mod) => ({ default: mod.CurrencyDialog })),
);

export default function CurrencyComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  return (
    <ConfigListTemplate<Currency>
      fixedColumnWidths
      translationNamespace="config.currency"
      entityNameField="code"
      useList={useCurrency}
      useDelete={useDeleteCurrency}
      useTable={useCurrencyTable}
      permissionPrefix="configuration.currency"
      pageKey={LIST_PAGE_KEYS.CURRENCY}
      filterFields={CURRENCY_FILTER_FIELDS}
      defaultSort="code:asc"
      exportColumns={[
        { header: tfl("code"), value: (r) => r.code, width: 10 },
        { header: tfl("name"), value: (r) => r.name, width: 24 },
        { header: tfl("symbol"), value: (r) => r.symbol ?? "", width: 8 },
        {
          header: tfl("exchangeRate"),
          value: (r) => r.exchange_rate ?? 0,
          width: 14,
        },
        {
          header: tfl("decimalPlaces"),
          value: (r) => r.decimal_places ?? 0,
          width: 10,
        },
        {
          header: tfl("description"),
          value: (r) => r.description ?? "",
          width: 32,
        },
        {
          header: tfl("status"),
          value: (r) => (r.is_active ? ts("active") : ts("inactive")),
          width: 10,
        },
      ]}
      renderDialog={({ open, onOpenChange, entity, readOnly }) => (
        <Suspense fallback={null}>
          <CurrencyDialog
            open={open}
            onOpenChange={onOpenChange}
            currency={entity}
            readOnly={readOnly}
          />
        </Suspense>
      )}
      renderCard={({ item, onEdit, onDelete }) => (
        <CurrencyCard item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
