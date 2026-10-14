import { useState } from "react";
import { useTranslations } from "use-intl";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel, type LookupItem } from "@/types/lookup";
import { Badge } from "@/components/ui/badge";
import { LookupCombobox } from "./lookup-combobox";

interface LookupCategoryProps {
  readonly value: string;
  readonly onValueChange: (value: string, item?: LookupItem) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly size?: "xs" | "sm";
  readonly defaultLabel?: string;
  readonly error?: string;
}

export function LookupCategory({
  value,
  onValueChange,
  disabled,
  className,
  size = "sm",
  defaultLabel,
  error,
}: LookupCategoryProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  // Lazy: ยิงรายการตอนเปิด popover ครั้งแรก — ชื่อของค่าที่เลือกไว้ดึงตาม id แยก
  const [hasOpened, setHasOpened] = useState(false);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupResource("product_category", {
      search,
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
    });

  return (
    <LookupCombobox
      resizeKey="category"
      value={value}
      onValueChange={onValueChange}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={items}
      selectedItems={selectedItems}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      getId={(c) => c.id}
      getLabel={(c) => `${c.code ?? ""} — ${lookupLabel(c)}`}
      getSearchValue={(c) => `${c.code ?? ""} ${c.name ?? ""}`}
      size={size}
      renderItem={(c) => (
        <>
          <Badge size="xs" variant="secondary">
            {c.code}
          </Badge>
          <span className="flex-1 truncate text-left text-xs">{c.name}</span>
        </>
      )}
      placeholder={tl("select", { entity: tfl("category") })}
      searchPlaceholder={tl("search", { entity: tfl("category") })}
      disabled={disabled}
      className={className}
      defaultLabel={defaultLabel}
      emptyTitle={tl("noDefined", { entity: tfl("category") })}
      emptyDescription={tl("noDefined", { entity: tfl("category") })}
      isLoading={isLoading}
      error={error}
    />
  );
}
