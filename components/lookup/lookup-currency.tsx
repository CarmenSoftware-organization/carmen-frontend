import { useState } from "react";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import type { CurrencyLookup } from "@/types/lookup";
import { LookupCombobox } from "./lookup-combobox";

interface LookupCurrencyProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onItemChange?: (currency: CurrencyLookup) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly disableTooltip?: boolean;
  readonly excludeIds?: Set<string>;
  readonly error?: string;
  readonly readOnly?: boolean;
  readonly fullWidth?: boolean;
}

export function LookupCurrency({
  value,
  onValueChange,
  onItemChange,
  disabled,
  placeholder,
  className,
  size,
  disableTooltip,
  excludeIds,
  error,
  readOnly,
  fullWidth,
}: LookupCurrencyProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [hasOpened, setHasOpened] = useState(false);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupResource<CurrencyLookup>("currency", {
      search,
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
      filter: excludeIds ? (c) => !excludeIds.has(c.id) : undefined,
    });

  return (
    <LookupCombobox
      resizeKey="currency"
      allowDeselect={false}
      size={size}
      value={value}
      onValueChange={(id, item) => {
        onValueChange(id);
        if (item) onItemChange?.(item);
      }}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={items}
      selectedItems={selectedItems}
      getId={(c) => c.id}
      getLabel={(c) => c.code ?? ""}
      getSearchValue={(c) => `${c.code ?? ""} ${c.name ?? ""}`}
      renderItem={(c) => (
        <>
          <span className="w-10 shrink-0 font-semibold">{c.code}</span>
          <span className="text-muted-foreground flex-1 truncate text-left">
            {c.name}
          </span>
        </>
      )}
      placeholder={placeholder ?? tl("select", { entity: tfl("currency") })}
      searchPlaceholder={tl("search", { entity: tfl("currency") })}
      disabled={disabled}
      disableTooltip={disableTooltip}
      className={cn(fullWidth ? "w-full" : "w-fit", className)}
      popoverWidth="w-72"
      popoverAlign="end"
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      isLoading={isLoading}
      error={error}
      readOnly={readOnly}
    />
  );
}
