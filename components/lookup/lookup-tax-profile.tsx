import { useState } from "react";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel, type TaxProfileLookup } from "@/types/lookup";
import { LookupCombobox } from "./lookup-combobox";

interface LookupTaxProfileProps {
  readonly value: string;
  readonly onValueChange: (
    value: string,
    taxRate: number,
    taxProfileName: string,
  ) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly error?: string;
}

export function LookupTaxProfile({
  value,
  onValueChange,
  disabled,
  placeholder,
  className,
  size = "sm",
  error,
}: LookupTaxProfileProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [hasOpened, setHasOpened] = useState(false);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupResource<TaxProfileLookup>("tax_profile", {
      search,
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
    });

  return (
    <LookupCombobox
      resizeKey="tax-profile"
      allowDeselect={false}
      size={size}
      value={value}
      onValueChange={(id, tp) =>
        onValueChange(id, tp?.tax_rate ?? 0, tp ? lookupLabel(tp) : "")
      }
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={items}
      selectedItems={selectedItems}
      getId={(tp) => tp.id}
      getLabel={lookupLabel}
      placeholder={placeholder ?? tl("select", { entity: tfl("taxProfile") })}
      searchPlaceholder={tl("search", { entity: tfl("taxProfile") })}
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
