import { useState } from "react";
import { useTranslations } from "use-intl";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel } from "@/types/lookup";
import { LookupCombobox } from "./lookup-combobox";

interface LookupEquipmentCategoryProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly excludeIds?: Set<string>;
  readonly error?: string;
  /**
   * ป้ายของ `value` ที่รู้อยู่แล้วจากเอกสาร — list โหลดทีละหน้า ค่าที่อยู่หลังหน้าแรก
   * จะหาชื่อไม่เจอแล้วขึ้น placeholder ทั้งที่มีค่าอยู่
   */
  readonly defaultLabel?: string;
}

/**
 * Lookup Popover สำหรับเลือกหมวดหมู่ของอุปกรณ์ (Equipment Category)
 *
 * ดึงข้อมูลผ่าน Lookup API (`useLookupResource`) พร้อม server-side search และ infinite scroll
 * (perpage 30) และรองรับ `excludeIds` กัน duplicate
 *
 * @param value - id ของ equipment category ที่เลือกอยู่
 * @param onValueChange - callback เมื่อเปลี่ยนค่า ส่งเฉพาะ id
 * @returns JSX popover element ของ equipment category lookup
 * @example
 * ```tsx
 * <Controller name="equipment_category_id" control={form.control} render={({ field }) => (
 *   <LookupEquipmentCategory value={field.value} onValueChange={field.onChange} />
 * )} />
 * ```
 */
export function LookupEquipmentCategory({
  value,
  onValueChange,
  disabled,
  placeholder,
  className,
  size,
  excludeIds,
  error,
  defaultLabel,
}: LookupEquipmentCategoryProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  // Lazy: ยิงรายการตอนเปิด popover ครั้งแรก — ชื่อของค่าที่เลือกดึงตาม id แยก (selectedIds)
  const [hasOpened, setHasOpened] = useState(false);

  const {
    items: categories,
    selectedItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useLookupResource("recipe_equipment_category", {
    search,
    enabled: hasOpened,
    selectedIds: value ? [value] : [],
    filter: excludeIds ? (c) => !excludeIds.has(c.id) : undefined,
  });

  return (
    <LookupCombobox
      resizeKey="equipment-category"
      size={size}
      value={value}
      onValueChange={(id) => onValueChange(id)}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={categories}
      selectedItems={selectedItems}
      getId={(c) => c.id}
      getLabel={lookupLabel}
      defaultLabel={defaultLabel}
      placeholder={placeholder ?? tl("select", { entity: tfl("category") })}
      searchPlaceholder={tl("search", { entity: tfl("category") })}
      disabled={disabled}
      className={className}
      isLoading={isLoading}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      error={error}
    />
  );
}
