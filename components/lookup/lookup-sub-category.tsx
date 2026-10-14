import { useState } from "react";
import { useTranslations } from "use-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupCodeName, type LookupItem } from "@/types/lookup";
import { Badge } from "@/components/ui/badge";
import { LookupCombobox } from "./lookup-combobox";

interface LookupSubCategoryProps {
  readonly value: string;
  readonly onValueChange: (value: string, item?: LookupItem) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm";
  readonly filterCategoryId?: string;
  readonly defaultLabel?: string;
  readonly error?: string;
}

export function LookupSubCategory({
  value,
  onValueChange,
  disabled,
  placeholder,
  className,
  size = "sm",
  filterCategoryId,
  defaultLabel,
  error,
}: LookupSubCategoryProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [hasOpened, setHasOpened] = useState(false);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupResource("product_sub_category", {
      search,
      // กรองตามหมวดที่ server — กรองหลังโหลดทีละ 30 แถว หน้าแรกอาจว่างทั้งที่มีข้อมูล
      serverFilter: { product_category_id: filterCategoryId },
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
    });

  return (
    <LookupCombobox
      resizeKey="sub-category"
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
      getId={(s) => s.id}
      getLabel={lookupCodeName}
      getSearchValue={(s) => `${s.code ?? ""} ${s.name ?? ""}`}
      size={size}
      renderItem={(s) => (
        <>
          <Badge size="xs" variant="secondary">
            {s.code}
          </Badge>
          <span className="flex-1 truncate text-left text-xs">{s.name}</span>
        </>
      )}
      placeholder={placeholder ?? tl("select", { entity: tfl("subCategory") })}
      searchPlaceholder={tl("search", { entity: tfl("subCategory") })}
      disabled={disabled}
      className={className}
      defaultLabel={defaultLabel}
      emptyTitle={tl("noDefined", { entity: tfl("subCategory") })}
      emptyDescription={tl("noDefined", { entity: tfl("subCategory") })}
      isLoading={isLoading}
      error={error}
      prependItems={
        <button
          type="button"
          aria-pressed={!value}
          className={cn(
            "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-hidden select-none",
            "hover:bg-accent hover:text-accent-foreground",
          )}
          onClick={() => onValueChange("")}
        >
          {tl("none")}
          <Check
            className={cn(
              "ml-auto h-4 w-4 shrink-0",
              value ? "opacity-0" : "opacity-100",
            )}
          />
        </button>
      }
    />
  );
}
