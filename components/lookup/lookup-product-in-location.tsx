import { useState } from "react";
import { useTranslations } from "use-intl";
import { PackageSearch } from "lucide-react";
import { useProductsByLocation } from "@/hooks/use-products-by-location";
import { useLookupPagination } from "@/hooks/use-lookup-pagination";
import type { LookupListParams } from "@/hooks/use-entities-by-ids";
import type { ProductLookupItem } from "@/types/product";
import { Badge } from "@/components/ui/badge";
import { LookupCombobox } from "./lookup-combobox";

interface LookupProductInLocationProps {
  readonly locationId: string;
  readonly workflowId?: string;
  readonly value: string;
  readonly onValueChange: (value: string, product?: ProductLookupItem) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly excludeIds?: string[];
  readonly modal?: boolean;
  readonly defaultLabel?: string;
  readonly disableTooltip?: boolean;
  readonly error?: string;
  readonly readOnly?: boolean;
  readonly defaultOpen?: boolean;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

export function LookupProductInLocation({
  locationId,
  workflowId,
  value,
  onValueChange,
  disabled,
  defaultOpen,
  open,
  onOpenChange,
  placeholder,
  className,
  size,
  excludeIds,
  modal,
  defaultLabel,
  disableTooltip,
  error,
  readOnly,
}: LookupProductInLocationProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");

  const excludedSet = excludeIds ? new Set(excludeIds) : undefined;

  const useListHook = (
    params: LookupListParams,
    options?: { enabled?: boolean },
  ) =>
    useProductsByLocation(locationId || undefined, params, workflowId, options);

  const {
    items: products,
    selectedItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useLookupPagination<ProductLookupItem>({
    useListHook,
    search,
    // ดึงตาม id ได้เฉพาะเส้น workflow (`product_id|string:`) — เส้นธรรมดา
    // products/locations/:id เมิน filter จึงพึ่ง defaultLabel ของ caller เหมือนเดิม
    selectedIds: workflowId !== undefined && value ? [value] : [],
    idFilterKey: "product_id",
    filter: excludedSet ? (p) => !excludedSet.has(p.id) : undefined,
  });

  return (
    <LookupCombobox
      resizeKey="product-in-location"
      size={size}
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
      value={value}
      onValueChange={onValueChange}
      items={products}
      selectedItems={selectedItems}
      getId={(p) => p.id}
      getLabel={(p) => `${p.code} — ${p.name}`}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      renderItem={(p) => (
        <>
          <Badge size="xs" variant="secondary" className="shrink-0">
            {p.code}
          </Badge>
          <span className="flex-1 truncate text-left">{p.name}</span>
        </>
      )}
      placeholder={placeholder ?? tl("select", { entity: tfl("product") })}
      searchPlaceholder={tl("search", { entity: tfl("product") })}
      disabled={disabled || !locationId}
      className={className}
      popoverWidth="w-90"
      popoverAlign="start"
      emptyIcon={PackageSearch}
      emptyTitle={tl("noFound", { entity: tfl("product") })}
      emptyDescription={tl("noFoundDesc")}
      isLoading={isLoading}
      modal={modal}
      defaultLabel={defaultLabel}
      disableTooltip={disableTooltip}
      error={error}
      readOnly={readOnly}
    />
  );
}
