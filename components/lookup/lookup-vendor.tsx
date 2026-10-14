import { useState } from "react";
import { useTranslations } from "use-intl";
import { WarehouseIcon } from "lucide-react";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel, type LookupItem } from "@/types/lookup";
import { Badge } from "@/components/ui/badge";
import { LookupCombobox } from "./lookup-combobox";

interface LookupVendorProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onItemChange?: (vendor: LookupItem) => void;
  readonly excludeIds?: Set<string>;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly defaultLabel?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly error?: string;
  readonly readOnly?: boolean;
}

export function LookupVendor({
  value,
  onValueChange,
  onItemChange,
  excludeIds,
  disabled,
  placeholder,
  defaultLabel,
  className,
  size,
  error,
  readOnly,
}: LookupVendorProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  // Lazy: ยิงรายการตอนเปิด popover ครั้งแรก — ชื่อของค่าที่เลือกดึงตาม id แยก (selectedIds)
  const [hasOpened, setHasOpened] = useState(false);

  const {
    items: vendors,
    selectedItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useLookupResource("vendor", {
    search,
    enabled: hasOpened,
    selectedIds: value ? [value] : [],
    filter: excludeIds ? (v) => !excludeIds.has(v.id) : undefined,
  });

  return (
    <LookupCombobox
      resizeKey="vendor"
      size={size}
      value={value}
      onValueChange={(id, item) => {
        onValueChange(id);
        if (item) onItemChange?.(item);
      }}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={vendors}
      selectedItems={selectedItems}
      getId={(v) => v.id}
      getLabel={lookupLabel}
      getSearchValue={(v) => `${v.code ?? ""} ${v.name ?? ""}`}
      renderItem={(v) => (
        <>
          <Badge size="xs" variant="secondary" className="shrink-0">
            {v.code}
          </Badge>
          <span className="flex-1 truncate text-left">{v.name}</span>
        </>
      )}
      renderSelected={(v) => `${v.code ?? ""} - ${lookupLabel(v)}`}
      defaultLabel={defaultLabel}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      placeholder={placeholder ?? tl("select", { entity: tfl("vendor") })}
      searchPlaceholder={tl("search", { entity: tfl("vendor") })}
      disabled={disabled}
      className={className}
      popoverWidth="w-90"
      popoverAlign="start"
      emptyIcon={WarehouseIcon}
      emptyTitle={tl("noFound", { entity: tfl("vendor") })}
      emptyDescription={tl("noFoundDesc")}
      isLoading={isLoading}
      error={error}
      readOnly={readOnly}
    />
  );
}
