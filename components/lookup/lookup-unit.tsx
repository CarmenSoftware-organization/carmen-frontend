import { useState } from "react";
import { useTranslations } from "use-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnitDialog } from "@/components/share/unit-dialog";
import {
  useInvalidateLookup,
  useLookupResource,
} from "@/hooks/use-lookup-resource";
import { lookupLabel } from "@/types/lookup";
import { LookupCombobox } from "./lookup-combobox";

interface LookupUnitProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly excludeIds?: string[];
  readonly size?: "xs" | "sm";
  readonly error?: string;
  /**
   * ชื่อหน่วยของ `value` ที่รู้อยู่แล้ว (เช่น `product.inventory_unit.name`) —
   * list โหลดทีละ 30 เรียงตามตัวอักษร หน่วยที่อยู่หลังหน้าแรก (เช่น LT) จะหาชื่อ
   * ไม่เจอแล้วขึ้น placeholder ทั้งที่มีค่าอยู่
   */
  readonly defaultLabel?: string;
}

/**
 * Lookup Popover สำหรับเลือกหน่วยนับ (Unit)
 *
 * ดึงข้อมูลผ่าน Lookup API (`useLookupResource`) พร้อม server-side search และ infinite scroll (perpage 30)
 * รองรับ `excludeIds` กัน duplicate
 * มีปุ่ม "+" เปิด `UnitDialog` เพื่อสร้างหน่วยใหม่แบบ inline และ auto-select หลัง create สำเร็จ
 *
 * @param value - unit id ที่เลือกอยู่
 * @param onValueChange - callback เมื่อเปลี่ยนค่า ส่งเฉพาะ id
 * @returns JSX popover element ของ unit lookup (พร้อม UnitDialog)
 * @example
 * ```tsx
 * <Controller name="unit_id" control={form.control} render={({ field }) => (
 *   <LookupUnit value={field.value} onValueChange={field.onChange} />
 * )} />
 * ```
 */
export function LookupUnit({
  value,
  onValueChange,
  disabled,
  placeholder,
  className,
  excludeIds,
  size = "sm",
  error,
  defaultLabel,
}: LookupUnitProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  // Lazy: ยิงรายการตอนเปิด popover ครั้งแรก — ชื่อของค่าที่เลือกดึงตาม id แยก (selectedIds)
  const [hasOpened, setHasOpened] = useState(false);
  const excludedSet = excludeIds ? new Set(excludeIds) : undefined;

  const {
    items: units,
    selectedItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useLookupResource("unit", {
    search,
    enabled: hasOpened,
    selectedIds: value ? [value] : [],
    filter: excludedSet ? (u) => !excludedSet.has(u.id) : undefined,
  });

  const invalidateUnits = useInvalidateLookup("unit");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <LookupCombobox
        resizeKey="unit"
        value={value}
        onValueChange={(id) => onValueChange(id)}
        onOpenChange={(open) => {
          if (open) setHasOpened(true);
        }}
        items={units}
        selectedItems={selectedItems}
        getId={(u) => u.id}
        getLabel={lookupLabel}
        defaultLabel={defaultLabel}
        placeholder={placeholder ?? tl("select", { entity: tfl("unit") })}
        searchPlaceholder={tl("search", { entity: tfl("unit") })}
        disabled={disabled}
        isLoading={isLoading}
        className={className}
        serverSideSearch
        onSearchChange={setSearch}
        onLoadMore={loadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        size={size}
        error={error}
        headerSlot={
          <Button
            size="xs"
            className="absolute top-1/2 right-2 -translate-y-1/2 p-1"
            onClick={() => setDialogOpen(true)}
            type="button"
            aria-label={tl("addNew", { entity: tfl("unit") })}
          >
            <Plus className="h-3 w-3" />
          </Button>
        }
      />
      <UnitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={(id) => {
          // UnitDialog invalidate แค่ key ของ list เดิม — lookup ต้องล้างเองไม่งั้นชื่อของ id ใหม่ไม่ขึ้น
          invalidateUnits();
          onValueChange(id);
        }}
      />
    </>
  );
}
