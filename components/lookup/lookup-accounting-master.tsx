import { useState } from "react";
import { useTranslations } from "use-intl";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import {
  useLookupPagination,
  ACTIVE_ONLY_FILTER,
} from "@/hooks/use-lookup-pagination";
import {
  usePaymentTypes,
  useWhtForms,
  useWhtServiceTypes,
} from "@/hooks/use-accounting-master";
import type { ApMasterBase } from "@/types/accounting-master";

interface ApMasterOption extends ApMasterBase {
  rate_percent?: number | string;
  bank_account_id?: string | null;
  is_cheque?: boolean;
}

const lists = {
  payment: usePaymentTypes,
  form: useWhtForms,
  service: useWhtServiceTypes,
};

export function LookupAccountingMaster({
  kind,
  value,
  onChange,
  defaultLabel,
  disabled,
  readOnly,
  allowDeselect,
}: {
  readonly kind: keyof typeof lists;
  readonly value?: string | null;
  readonly onChange: (id: string | null, item?: ApMasterOption) => void;
  readonly defaultLabel?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly allowDeselect?: boolean;
}) {
  const [search, setSearch] = useState("");
  const t = useTranslations("accounting.accountsPayable.master");
  const lookup = useLookupPagination({
    useListHook: lists[
      kind
    ] as import("@/hooks/use-entities-by-ids").LookupListHook<ApMasterOption>,
    search,
    selectedIds: value ? [value] : [],
    serverFilter: `${ACTIVE_ONLY_FILTER}${kind === "payment" ? ",available_ap|boolean:true" : ""}`,
  });
  return (
    <LookupCombobox
      value={value ?? ""}
      onValueChange={(id, item) => onChange(id || null, item)}
      items={lookup.items}
      selectedItems={lookup.selectedItems}
      getId={(item) => item.id}
      getLabel={(item) => `${item.code} · ${item.description}`}
      getSearchValue={(item) => `${item.code} ${item.description}`}
      placeholder={t(kind)}
      defaultLabel={defaultLabel}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={lookup.loadMore}
      hasMore={lookup.hasMore}
      isLoading={lookup.isLoading}
      isLoadingMore={lookup.isLoadingMore}
      disabled={disabled}
      error={lookup.error?.message}
      readOnly={readOnly}
      allowDeselect={allowDeselect ?? kind === "service"}
      modal
    />
  );
}
