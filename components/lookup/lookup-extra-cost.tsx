import { useState } from "react";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel } from "@/types/lookup";
import { LookupCombobox } from "./lookup-combobox";

interface LookupExtraCostProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly error?: string;
}

export function LookupExtraCost({
  value,
  onValueChange,
  disabled,
  placeholder,
  className,
  size = "sm",
  error,
}: LookupExtraCostProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [hasOpened, setHasOpened] = useState(false);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupResource("extra_cost_type", {
      search,
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
    });

  return (
    <LookupCombobox
      resizeKey="extra-cost"
      allowDeselect={false}
      size={size}
      value={value}
      onValueChange={(id) => onValueChange(id)}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={items}
      selectedItems={selectedItems}
      getId={(c) => c.id}
      getLabel={lookupLabel}
      placeholder={placeholder ?? tl("select", { entity: tfl("extraCost") })}
      searchPlaceholder={tl("search", { entity: tfl("extraCost") })}
      disabled={disabled}
      disableTooltip
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
