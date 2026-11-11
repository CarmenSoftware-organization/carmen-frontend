import { useState } from "react";
import { useTranslations } from "use-intl";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import {
  ACTIVE_ONLY_FILTER,
  useLookupPagination,
} from "@/hooks/use-lookup-pagination";
import { useArCustomers, type ArCustomer } from "./use-ar-customer";

export function ArCustomerLookup({
  customer,
  change,
  disabled = false,
}: {
  readonly customer?: ArCustomer;
  readonly change: (customer?: ArCustomer) => void;
  readonly disabled?: boolean;
}) {
  const t = useTranslations("accounting.arRegister");
  const [search, setSearch] = useState("");
  const [opened, setOpened] = useState(false);
  const lookup = useLookupPagination({
    useListHook: useArCustomers,
    search,
    enabled: opened,
    serverFilter: ACTIVE_ONLY_FILTER,
    filter: (item) => item.is_active !== false,
  });
  return (
    <LookupCombobox
      value={customer?.id ?? ""}
      onValueChange={(_id, item) => change(item)}
      items={lookup.items}
      selectedItems={customer ? [customer] : undefined}
      getId={(item) => item.id}
      getLabel={(item) => `${item.code} · ${item.name}`}
      onOpenChange={(open) => {
        if (open) setOpened(true);
      }}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={lookup.loadMore}
      hasMore={lookup.hasMore}
      isLoading={lookup.isLoading}
      isLoadingMore={lookup.isLoadingMore}
      placeholder={t("selectCustomer")}
      searchPlaceholder={t("searchCustomer")}
      emptyTitle={
        lookup.error ? t("customerLookupError") : t("noActiveCustomers")
      }
      className="w-full"
      disabled={disabled}
      allowDeselect={false}
    />
  );
}
