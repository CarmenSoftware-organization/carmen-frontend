import { useState } from "react";
import { useTranslations } from "use-intl";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel, type RecipeLookup } from "@/types/lookup";
import { LookupCombobox } from "./lookup-combobox";

interface LookupRecipeProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** ส่ง object เต็มของสูตรที่ผู้ใช้เพิ่งเลือก (ฟอร์มวัตถุดิบใช้ตั้งหน่วยผลผลิต) */
  readonly onItemChange?: (recipe: RecipeLookup) => void;
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
 * Lookup Popover สำหรับเลือกสูตรอาหาร (Recipe) — ใช้เลือกสูตรย่อยเป็นวัตถุดิบ
 *
 * ดึงผ่าน Lookup API (`recipe`) พร้อม server-side search และ infinite scroll
 * ซ่อนสูตรที่เก็บถาวร (ARCHIVED) และ id ใน `excludeIds` (เช่นตัวสูตรเอง)
 *
 * @param value - recipe id ที่เลือกอยู่
 * @param onValueChange - callback เมื่อเปลี่ยนค่า ส่งเฉพาะ id
 * @returns JSX popover element ของ recipe lookup
 */
export function LookupRecipe({
  value,
  onValueChange,
  onItemChange,
  disabled,
  placeholder,
  className,
  size,
  excludeIds,
  error,
  defaultLabel,
}: LookupRecipeProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  // Lazy: ยิงรายการตอนเปิด popover ครั้งแรก — ชื่อของค่าที่เลือกดึงตาม id แยก (selectedIds)
  const [hasOpened, setHasOpened] = useState(false);

  const {
    items: recipes,
    selectedItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useLookupResource<RecipeLookup>("recipe", {
    search,
    enabled: hasOpened,
    selectedIds: value ? [value] : [],
    filter: (r) =>
      r.recipe_status !== "ARCHIVED" && !(excludeIds?.has(r.id) ?? false),
  });

  return (
    <LookupCombobox
      resizeKey="recipe"
      size={size}
      value={value}
      onValueChange={(id, item) => {
        onValueChange(id);
        if (item) onItemChange?.(item);
      }}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={recipes}
      selectedItems={selectedItems}
      getId={(r) => r.id}
      getLabel={lookupLabel}
      defaultLabel={defaultLabel}
      placeholder={placeholder ?? tl("select", { entity: tfl("recipe") })}
      searchPlaceholder={tl("search", { entity: tfl("recipe") })}
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
