import { useState } from "react";
import { useTranslations } from "use-intl";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel } from "@/types/lookup";
import { LookupCombobox } from "./lookup-combobox";

interface LookupDeliveryPointProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onItemChange?: (item: { id: string; name: string }) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly disableTooltip?: boolean;
  readonly error?: string;
  readonly readOnly?: boolean;
  readonly defaultLabel?: string;
}

export function LookupDeliveryPoint({
  value,
  onValueChange,
  onItemChange,
  disabled,
  placeholder,
  className,
  size,
  disableTooltip,
  error,
  readOnly,
  defaultLabel,
}: LookupDeliveryPointProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  // Lazy: ยิงรายการตอนเปิด popover ครั้งแรก — ชื่อของค่าที่เลือกดึงตาม id แยก (selectedIds)
  const [hasOpened, setHasOpened] = useState(false);

  const {
    items: deliveryPoints,
    selectedItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useLookupResource("delivery_point", {
    search,
    enabled: hasOpened,
    selectedIds: value ? [value] : [],
  });

  return (
    <LookupCombobox
      resizeKey="delivery-point"
      size={size}
      value={value}
      onValueChange={(id, item) => {
        onValueChange(id);
        if (item) onItemChange?.({ id: item.id, name: lookupLabel(item) });
      }}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={deliveryPoints}
      selectedItems={selectedItems}
      getId={(d) => d.id}
      getLabel={lookupLabel}
      placeholder={
        placeholder ?? tl("select", { entity: tfl("deliveryPoint") })
      }
      searchPlaceholder={tl("search", { entity: tfl("deliveryPoint") })}
      disabled={disabled}
      className={className}
      defaultLabel={defaultLabel}
      isLoading={isLoading}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      disableTooltip={disableTooltip}
      error={error}
      readOnly={readOnly}
    />
  );
}
