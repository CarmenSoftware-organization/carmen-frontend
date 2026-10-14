import { useState } from "react";
import { useTranslations } from "use-intl";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel, type LookupItem } from "@/types/lookup";
import { LookupCombobox } from "./lookup-combobox";

interface LookupPrtProps {
  readonly value: string;
  readonly onValueChange: (value: string, template?: LookupItem) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly error?: string;
  /**
   * ป้ายของ `value` ที่รู้อยู่แล้วจากเอกสาร — list โหลดทีละหน้า ค่าที่อยู่หลังหน้าแรก
   * จะหาชื่อไม่เจอแล้วขึ้น placeholder ทั้งที่มีค่าอยู่
   */
  readonly defaultLabel?: string;
}

export function LookupPrt({
  value,
  onValueChange,
  disabled,
  placeholder,
  className,
  size,
  error,
  defaultLabel,
}: LookupPrtProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  // Lazy: ยิงรายการตอนเปิด popover ครั้งแรก — ชื่อของค่าที่เลือกดึงตาม id แยก (selectedIds)
  const [hasOpened, setHasOpened] = useState(false);

  const {
    items: templates,
    selectedItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useLookupResource("pricelist_template", {
    search,
    enabled: hasOpened,
    selectedIds: value ? [value] : [],
  });

  return (
    <LookupCombobox
      resizeKey="prt"
      size={size}
      value={value}
      onValueChange={(id, item) => onValueChange(id, item)}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={templates}
      selectedItems={selectedItems}
      getId={(t) => t.id}
      getLabel={lookupLabel}
      defaultLabel={defaultLabel}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      placeholder={placeholder ?? tl("select", { entity: tfl("template") })}
      searchPlaceholder={tl("search", { entity: tfl("template") })}
      disabled={disabled}
      isLoading={isLoading}
      className={className}
      error={error}
    />
  );
}
