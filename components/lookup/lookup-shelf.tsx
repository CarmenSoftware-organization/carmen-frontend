import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel, type LookupItem } from "@/types/lookup";
import { LookupCombobox } from "./lookup-combobox";

interface LookupShelfProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onItemChange?: (shelf: LookupItem) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly readOnly?: boolean;
}

export function LookupShelf({
  value,
  onValueChange,
  onItemChange,
  disabled,
  placeholder,
  className,
  readOnly,
}: LookupShelfProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [hasOpened, setHasOpened] = useState(false);
  const [open, setOpen] = useState(false);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupResource("location_shelf", {
      search,
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
    });

  return (
    <LookupCombobox
      resizeKey="shelf"
      allowDeselect={false}
      size="sm"
      value={value}
      onValueChange={(id, shelf) => {
        onValueChange(id);
        if (shelf) onItemChange?.(shelf);
      }}
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setHasOpened(true);
      }}
      items={items}
      selectedItems={selectedItems}
      getId={(s) => s.id}
      getLabel={lookupLabel}
      placeholder={placeholder ?? tl("select", { entity: tfl("shelf") })}
      searchPlaceholder={tl("search", { entity: tfl("shelf") })}
      disabled={disabled}
      className={cn("w-full", className)}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      isLoading={isLoading}
      readOnly={readOnly}
      prependItems={
        <button
          type="button"
          aria-pressed={!value}
          className={cn(
            "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-hidden select-none",
            "hover:bg-accent hover:text-accent-foreground",
          )}
          onClick={() => {
            onValueChange("");
            setOpen(false);
          }}
        >
          —
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
