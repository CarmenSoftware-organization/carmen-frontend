import { useState } from "react";
import { useTranslations } from "use-intl";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel, type LookupItem } from "@/types/lookup";
import { LookupCombobox } from "./lookup-combobox";

interface LookupRecipeEquipmentProps {
  /** เรียกเมื่อเลือกอุปกรณ์ — ตัว picker ไม่ถือค่าเอง (ใช้เพิ่มเข้ารายการทีละชิ้น) */
  readonly onSelect: (item: LookupItem) => void;
  readonly excludeIds?: Set<string>;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
}

/**
 * Lookup Popover สำหรับเพิ่มอุปกรณ์ครัว (Recipe Equipment) เข้ารายการ
 *
 * ดึงผ่าน Lookup API (`recipe_equipment`) แบบ lazy + server-side search + infinite scroll
 * ค่าที่เลือกไม่ค้างในช่อง — ผู้เรียกเก็บรายการเอง แล้วส่ง `excludeIds` กันเลือกซ้ำ
 */
export function LookupRecipeEquipment({
  onSelect,
  excludeIds,
  disabled,
  placeholder,
  className,
  size,
}: LookupRecipeEquipmentProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [hasOpened, setHasOpened] = useState(false);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupResource("recipe_equipment", {
      search,
      enabled: hasOpened,
      selectedIds: [],
      filter: excludeIds ? (e) => !excludeIds.has(e.id) : undefined,
    });

  return (
    <LookupCombobox
      resizeKey="recipe-equipment"
      size={size}
      value=""
      onValueChange={(_id, item) => {
        if (item) onSelect(item);
      }}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={items}
      selectedItems={selectedItems}
      getId={(e) => e.id}
      getLabel={lookupLabel}
      placeholder={placeholder ?? tl("select", { entity: tfl("equipment") })}
      searchPlaceholder={tl("search", { entity: tfl("equipment") })}
      disabled={disabled}
      className={className}
      isLoading={isLoading}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
    />
  );
}
