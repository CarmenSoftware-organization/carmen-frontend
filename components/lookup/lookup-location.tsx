import { useState } from "react";
import { useTranslations } from "use-intl";
import { Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupCodeName, type LocationLookup } from "@/types/lookup";
import { INVENTORY_TYPE } from "@/constant/location";
import { Badge } from "@/components/ui/badge";
import { LocationTypeLabel } from "@/components/share/location-type-label";
import { LookupCombobox } from "./lookup-combobox";

interface LookupLocationProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onItemChange?: (location: LocationLookup) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly excludeIds?: string[];
  readonly defaultLabel?: string;
  readonly size?: "xs" | "sm";
  readonly popoverWidth?: string;
  readonly modal?: boolean;
  readonly locationTypes?: INVENTORY_TYPE[];
  readonly error?: string;
  readonly readOnly?: boolean;
}

/**
 * Lookup Popover สำหรับเลือก Location (สถานที่เก็บสินค้า)
 *
 * ดึงข้อมูลผ่าน Lookup API (`location`, scope all) พร้อม server-side search และ infinite scroll
 * (perpage 30) endpoint กรอง active ให้เอง `locationTypes` กรองที่ server รองรับ `excludeIds` กัน duplicate
 * ตามประเภท (inventory/direct/consignment) พร้อม badge แสดงประเภทใน item มี `onItemChange`
 * ส่ง `LocationLookup` (มี `location_type` และ `delivery_point`)
 *
 * @param value - id ของ location ที่เลือกอยู่
 * @param onValueChange - callback เมื่อเปลี่ยนค่า ส่งเฉพาะ id
 * @returns JSX popover element ของ location lookup
 * @example
 * ```tsx
 * <Controller name="location_id" control={control} render={({ field }) => (
 *   <LookupLocation value={field.value} onValueChange={field.onChange} locationTypes={["inventory"]} />
 * )} />
 * ```
 */
export function LookupLocation({
  value,
  onValueChange,
  onItemChange,
  disabled,
  placeholder,
  className,
  excludeIds,
  defaultLabel,
  size = "sm",
  popoverWidth = "w-[26.25rem]",
  modal,
  locationTypes,
  error,
  readOnly,
}: LookupLocationProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  // Lazy: ยิงรายการตอนเปิด popover ครั้งแรก — ชื่อของค่าที่เลือกดึงตาม id แยก (selectedIds)
  const [hasOpened, setHasOpened] = useState(false);

  const excludedSet = excludeIds ? new Set(excludeIds) : undefined;
  const {
    items: locations,
    selectedItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useLookupResource<LocationLookup>("location", {
    search,
    // list เดิมคือ /config/locations = ทุกคลังของ BU · `mine` จะเหลือแค่คลังที่ assign ให้ user
    scope: "all",
    serverFilter: { location_type: locationTypes },
    enabled: hasOpened,
    selectedIds: value ? [value] : [],
    filter: excludedSet ? (l) => !excludedSet.has(l.id) : undefined,
  });

  return (
    <LookupCombobox
      resizeKey="location"
      value={value}
      onValueChange={(id, item) => {
        onValueChange(id);
        if (item) onItemChange?.(item);
      }}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={locations}
      selectedItems={selectedItems}
      getId={(l) => l.id}
      getLabel={lookupCodeName}
      size={size}
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
      className={cn("w-full", className)}
      popoverAlign="start"
      emptyIcon={Warehouse}
      emptyTitle={tl("noDefined", { entity: tfl("location") })}
      emptyDescription={tl("noDefined", { entity: tfl("location") })}
      defaultLabel={defaultLabel}
      isLoading={isLoading}
      popoverWidth={popoverWidth}
      modal={modal}
      error={error}
      readOnly={readOnly}
    />
  );
}
