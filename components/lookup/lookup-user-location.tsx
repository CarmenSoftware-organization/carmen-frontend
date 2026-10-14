import { useState } from "react";
import { useTranslations } from "use-intl";
import { ChevronsUpDown, CircleAlert, Warehouse } from "lucide-react";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupCodeName, type LocationLookup } from "@/types/lookup";
import { INVENTORY_TYPE } from "@/constant/location";
import { Badge } from "@/components/ui/badge";
import { LocationTypeLabel } from "@/components/share/location-type-label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LookupCombobox } from "./lookup-combobox";

interface LookupUserLocationProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onItemChange?: (location: LocationLookup) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly excludeIds?: Set<string>;
  readonly popoverWidth?: string;
  readonly defaultLabel?: string;
  readonly locationTypes?: INVENTORY_TYPE[];
  readonly disableTooltip?: boolean;
  readonly error?: string;
  readonly nextFocusRef?: React.RefObject<HTMLElement | null>;
  readonly lazy?: boolean;
}

export function LookupUserLocation(props: LookupUserLocationProps) {
  const { lazy } = props;
  const [activated, setActivated] = useState(!lazy);

  if (lazy && !activated) {
    return <LazyPlaceholder {...props} onActivate={() => setActivated(true)} />;
  }

  return <LookupUserLocationInner {...props} defaultOpen={lazy} />;
}

function LazyPlaceholder({
  defaultLabel,
  placeholder,
  disabled,
  className,
  size,
  error,
  onActivate,
}: LookupUserLocationProps & { readonly onActivate: () => void }) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const label =
    defaultLabel ?? placeholder ?? tl("select", { entity: tfl("location") });

  return (
    <Button
      type="button"
      variant="outline"
      aria-invalid={!!error}
      onClick={onActivate}
      disabled={disabled}
      className={cn(
        // ต้องสูงเท่า LookupCombobox ที่จะมาแทนหลังกด — ไม่งั้นช่องเด้งขนาด
        // ตอนถูกกดครั้งแรก และไม่ตรงกับ field ข้าง ๆ ที่ตั้ง size เดียวกัน
        "flex items-center justify-between pr-1 pl-3 text-xs",
        size === "default" && "h-9",
        size === "xs" && "h-6 gap-1 px-2 text-xs",
        (!size || size === "sm") && "h-8",
        error && "border-destructive pr-7",
        className,
      )}
    >
      <span
        className={cn(
          "truncate",
          !defaultLabel && "text-muted-foreground text-xs",
        )}
      >
        {label}
      </span>
      {error ? (
        <CircleAlert
          className="text-destructive size-4 shrink-0"
          aria-hidden="true"
        />
      ) : (
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      )}
    </Button>
  );
}

// Default popover ที่กว้างพอสำหรับชื่อ location ยาว ๆ (code + name + type badge)
// — caller สามารถ override ผ่าน prop popoverWidth ได้ตามต้องการ
const DEFAULT_POPOVER_WIDTH = "w-[30rem]";

function LookupUserLocationInner({
  value,
  onValueChange,
  onItemChange,
  disabled,
  placeholder,
  className,
  size,
  excludeIds,
  popoverWidth = DEFAULT_POPOVER_WIDTH,
  defaultLabel,
  locationTypes,
  disableTooltip,
  error,
  nextFocusRef,
  defaultOpen,
}: LookupUserLocationProps & { readonly defaultOpen?: boolean }) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");

  const {
    items: locations,
    selectedItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useLookupResource<LocationLookup>("location", {
    search,
    // คลังที่ assign ให้ user (การ assign ที่ถูกถอนแล้วไม่นับ — /user-locations เดิมนับ)
    scope: "mine",
    serverFilter: { location_type: locationTypes },
    selectedIds: value ? [value] : [],
    filter: excludeIds ? (l) => !excludeIds.has(l.id) : undefined,
  });

  return (
    <LookupCombobox
      resizeKey="user-location"
      size={size}
      value={value}
      onValueChange={(id, item) => {
        onValueChange(id);
        if (item) onItemChange?.(item);
      }}
      items={locations}
      selectedItems={selectedItems}
      getId={(l) => l.id}
      getLabel={lookupCodeName}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      renderItem={(l) => (
        <>
          <Badge size="xs" variant="secondary" className="shrink-0">
            {l.code}
          </Badge>
          <span className="flex-1 truncate text-left">{l.name}</span>
          <LocationTypeLabel type={l.location_type} className="shrink-0" />
        </>
      )}
      placeholder={placeholder ?? tl("select", { entity: tfl("location") })}
      searchPlaceholder={tl("search", { entity: tfl("location") })}
      disabled={disabled}
      isLoading={isLoading}
      className={className}
      popoverAlign="start"
      emptyIcon={Warehouse}
      emptyTitle={tl("noDefined", { entity: tfl("location") })}
      emptyDescription={tl("noAvailable", { entity: tfl("location") })}
      popoverWidth={popoverWidth}
      defaultLabel={defaultLabel}
      disableTooltip={disableTooltip}
      error={error}
      nextFocusRef={nextFocusRef}
      defaultOpen={defaultOpen}
    />
  );
}
