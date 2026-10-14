import { useState } from "react";
import { useTranslations } from "use-intl";
import { PackageSearch } from "lucide-react";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel, type LookupItem } from "@/types/lookup";
import { Badge } from "@/components/ui/badge";
import { LookupCombobox } from "./lookup-combobox";

interface LookupProductProps {
  readonly value: string;
  readonly onValueChange: (value: string, product?: LookupItem) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly excludeIds?: string[];
  readonly error?: string;
  readonly defaultOpen?: boolean;
  readonly nextFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * ป้ายของ `value` ที่รู้อยู่แล้วจากเอกสาร — list โหลดทีละ 30 และกรองเฉพาะ active
   * สินค้าที่อยู่หลังหน้าแรกหรือถูกปิดใช้งานไปแล้วจะหาชื่อไม่เจอ แล้วขึ้น placeholder
   */
  readonly defaultLabel?: string;
}

/**
 * Lookup Popover สำหรับเลือกสินค้า (Product)
 *
 * ดึงข้อมูลผ่าน Lookup API (`useLookupResource`) พร้อม server-side search และ infinite scroll (perpage 30)
 * endpoint กรองสินค้า active ให้เอง รองรับ `excludeIds` กัน duplicate ใน item list
 * onValueChange ส่ง id และแถว lookup (`LookupItem` — id/code/name/description/status เท่านั้น)
 *
 * @param value - product id ที่เลือกอยู่
 * @param onValueChange - callback เมื่อเปลี่ยนค่า ส่ง id และแถว lookup
 * @returns JSX popover element ของ product lookup
 * @example
 * ```tsx
 * <Controller name="product_id" control={control} render={({ field }) => (
 *   <LookupProduct value={field.value} onValueChange={(id) => field.onChange(id)} />
 * )} />
 * ```
 */
export function LookupProduct({
  value,
  onValueChange,
  disabled,
  placeholder,
  className,
  size,
  excludeIds,
  error,
  defaultOpen,
  nextFocusRef,
  defaultLabel,
}: LookupProductProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  // Lazy: ยิงรายการตอนเปิด popover ครั้งแรก — ชื่อของค่าที่เลือกดึงตาม id แยก (selectedIds)
  const [hasOpened, setHasOpened] = useState(false);
  const excludedSet = excludeIds ? new Set(excludeIds) : undefined;

  const {
    items: products,
    selectedItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useLookupResource("product", {
    search,
    // defaultOpen = เปิด popover ทันทีตอน mount (ฟอร์มพากรอกทีละช่อง) ต้องมีรายการรอ
    enabled: hasOpened || !!defaultOpen,
    selectedIds: value ? [value] : [],
    filter: excludedSet ? (p) => !excludedSet.has(p.id) : undefined,
  });

  return (
    <LookupCombobox
      resizeKey="product"
      size={size}
      value={value}
      onValueChange={onValueChange}
      defaultOpen={defaultOpen}
      nextFocusRef={nextFocusRef}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={products}
      selectedItems={selectedItems}
      getId={(p) => p.id}
      getLabel={(p) => `${p.code ?? ""} — ${lookupLabel(p)}`}
      defaultLabel={defaultLabel}
      getSearchValue={(p) => `${p.code ?? ""} ${p.name ?? ""}`}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      renderItem={(p) => (
        <>
          <Badge size="xs" variant="secondary" className="shrink-0">
            {p.code}
          </Badge>
          <span className="flex-1 truncate text-left">{p.name}</span>
        </>
      )}
      placeholder={placeholder ?? tl("select", { entity: tfl("product") })}
      searchPlaceholder={tl("search", { entity: tfl("product") })}
      disabled={disabled}
      className={className}
      popoverAlign="start"
      popoverWidth="w-[26.25rem]"
      emptyIcon={PackageSearch}
      emptyTitle={tl("noFound", { entity: tfl("product") })}
      emptyDescription={tl("noFoundDesc")}
      isLoading={isLoading}
      error={error}
    />
  );
}
