import { useState } from "react";
import { useTranslations } from "use-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useItemGroup } from "@/hooks/use-item-group";
import {
  ACTIVE_ONLY_FILTER,
  useLookupPagination,
} from "@/hooks/use-lookup-pagination";
import type { ItemGroupDto } from "@/types/category";
import { Badge } from "@/components/ui/badge";
import { LookupCombobox } from "./lookup-combobox";

interface LookupItemGroupProps {
  readonly value: string;
  readonly onValueChange: (value: string, item?: ItemGroupDto) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm";
  readonly filterSubCategoryId?: string;
  readonly defaultLabel?: string;
  readonly error?: string;
}

export function LookupItemGroup({
  value,
  onValueChange,
  disabled,
  placeholder,
  className,
  size = "sm",
  filterSubCategoryId,
  defaultLabel,
  error,
}: LookupItemGroupProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [hasOpened, setHasOpened] = useState(false);

  const serverFilter = filterSubCategoryId
    ? `${ACTIVE_ONLY_FILTER},product_subcategory_id|string:${filterSubCategoryId}`
    : ACTIVE_ONLY_FILTER;

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupPagination<ItemGroupDto>({
      useListHook: useItemGroup,
      search,
      serverFilter,
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
    });

  return (
    <LookupCombobox
      resizeKey="item-group"
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
      getId={(g) => g.id}
      getLabel={(g) => `${g.code} — ${g.name}`}
      getSearchValue={(g) => `${g.code} ${g.name}`}
      size={size}
      renderItem={(g) => (
        <>
          <Badge size="xs" variant="secondary">
            {g.code}
          </Badge>
          <span className="flex-1 truncate text-left text-xs">{g.name}</span>
        </>
      )}
      placeholder={placeholder ?? tl("select", { entity: tfl("itemGroup") })}
      searchPlaceholder={tl("search", { entity: tfl("itemGroup") })}
      disabled={disabled}
      className={className}
      defaultLabel={defaultLabel}
      emptyTitle={tl("noDefined", { entity: tfl("itemGroup") })}
      emptyDescription={tl("noDefined", { entity: tfl("itemGroup") })}
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
