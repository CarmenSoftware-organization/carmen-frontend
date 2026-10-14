import { useState } from "react";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel, type CreditTermLookup } from "@/types/lookup";
import { LookupCombobox } from "./lookup-combobox";

interface LookupCreditTermProps {
  readonly value: string;
  readonly onValueChange: (
    value: string,
    creditTerm?: CreditTermLookup,
  ) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly error?: string;
}

export function LookupCreditTerm({
  value,
  onValueChange,
  disabled,
  placeholder,
  className,
  size,
  error,
}: LookupCreditTermProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [hasOpened, setHasOpened] = useState(false);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupResource<CreditTermLookup>("credit_term", {
      search,
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
    });

  return (
    <LookupCombobox
      resizeKey="credit-term"
      allowDeselect={false}
      size={size}
      value={value}
      onValueChange={onValueChange}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={items}
      selectedItems={selectedItems}
      getId={(c) => c.id}
      getLabel={lookupLabel}
      placeholder={placeholder ?? tl("select", { entity: tfl("creditTerm") })}
      searchPlaceholder={tl("search", { entity: tfl("creditTerm") })}
      disabled={disabled}
      className={cn("w-full", className)}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      isLoading={isLoading}
      error={error}
    />
  );
}
